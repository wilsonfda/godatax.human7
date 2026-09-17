#!/usr/bin/env node
/**
 * GDX_SKILL_GODATAX_HUMAN7_BY_SPU
 *
 * Generic relational -> property-graph exporter, in the spirit of the SPU
 * layer's Neo4j export scripts (GDX_SPU_LAYER/*NEO4J Export.py -- idempotent
 * MERGE upserts, one node label per source table) but driven entirely by
 * Firebird's own RDB$ system catalog (see introspect.js) instead of a
 * hand-written table-by-table mapping. Every table matching
 * GDX_PSY_/GDX_TA_/GDX_CC_/DW_DIM_/DW_FACT_ becomes a node label; every
 * FOREIGN KEY constraint on those tables becomes a relationship type (named
 * after the constraint itself); every column becomes a node property.
 *
 * Covers, in one run: 2.relational.model.psychometrics, 3_septenary.
 * constitution, 4.kundalini.chakras, 5.five.ways.tomas.aquino,
 * 6.cardiac.coherence, and 7.multidimensional.database (the DW) -- because
 * all of those already live in the same Firebird database and all of their
 * tables match the prefixes above.
 *
 * Usage:
 *   node export_graph.js [--dry-run] [--tables T1,T2,...] [--limit N]
 *
 *   --dry-run        introspect and count rows only, write nothing to Neo4j
 *   --tables T1,T2   only export these tables (still respects their FKs to
 *                    each other; a FK to a table outside this list is
 *                    skipped, not an error)
 *   --limit N        cap each table at its first N rows (for a fast,
 *                    small-scale test run before a full export)
 *
 * Connection: entirely from environment variables (see ../.env.example) --
 * both the Firebird source (GDX_HUMAN_FB_*) and the Neo4j target (NEO4J_*,
 * same variable names as Neo4j-7d0a3815-Created-2026-09-10.txt). Never
 * hardcode credentials here.
 */

const Firebird = require('node-firebird');
const neo4j = require('neo4j-driver');
const { introspectSchema } = require('./introspect');

const BATCH_SIZE = 1000;

function parseArgs(argv) {
  const args = { dryRun: false, tables: null, limit: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--tables') args.tables = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()));
    else if (argv[i] === '--limit') args.limit = parseInt(argv[++i], 10);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export the vars first.`);
  }
  return v;
}

function fbConnect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function fbQuery(db, sql) {
  return new Promise((resolve, reject) => db.query(sql, (err, result) => (err ? reject(err) : resolve(result))));
}

function stringifyKey(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toNeoValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return Number.isInteger(v) ? neo4j.int(v) : v;
  return v;
}

function gdxKeyOf(row, pkColumns) {
  return pkColumns.map((c) => stringifyKey(row[c])).join('::');
}

async function runBatched(session, cypher, items, label) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await session.executeWrite((tx) => tx.run(cypher, { batch }));
    done += batch.length;
    if (items.length > BATCH_SIZE) console.log(`    ... ${label}: ${done}/${items.length}`);
  }
  return done;
}

async function exportNodesForTable(fbDb, neoSession, table, args) {
  const limitClause = args.limit ? `FIRST ${args.limit} ` : '';
  const rows = await fbQuery(fbDb, `SELECT ${limitClause}* FROM ${table.name}`);

  const items = rows.map((row) => {
    const props = { gdx_source_table: table.name };
    for (const col of table.columns) props[col.name] = toNeoValue(row[col.name]);
    return { gdx_key: gdxKeyOf(row, table.primaryKey.length ? table.primaryKey : table.columns.map((c) => c.name)), props };
  });

  if (items.length > 0) {
    const cypher = `UNWIND $batch AS row MERGE (n:\`${table.name}\` {gdx_key: row.gdx_key}) SET n += row.props`;
    await runBatched(neoSession, cypher, items, table.name);
  }
  return { table: table.name, rows };
}

async function exportRelationshipsForFk(neoSession, childTable, fk, childRows) {
  const items = [];
  for (const row of childRows) {
    const fkValues = fk.childFields.map((f) => row[f]);
    if (fkValues.some((v) => v === null || v === undefined)) continue; // nullable FK, no edge
    const childKey = gdxKeyOf(row, childTable.primaryKey.length ? childTable.primaryKey : childTable.columns.map((c) => c.name));
    const parentKey = fkValues.map(stringifyKey).join('::');
    items.push({ childKey, parentKey });
  }
  if (items.length === 0) return 0;
  const cypher = `
    UNWIND $batch AS row
    MATCH (a:\`${fk.childTable}\` {gdx_key: row.childKey})
    MATCH (b:\`${fk.parentTable}\` {gdx_key: row.parentKey})
    MERGE (a)-[r:\`${fk.fkName}\`]->(b)`;
  return runBatched(neoSession, cypher, items, fk.fkName);
}

async function main() {
  const args = parseArgs(process.argv);

  const fbOptions = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsText: true, // required so BLOB SUB_TYPE TEXT columns read as plain strings
  };

  console.log(`Connecting to Firebird ${fbOptions.host}:${fbOptions.port}${fbOptions.database} ...`);
  const fbDb = await fbConnect(fbOptions);

  let neoDriver = null;
  let neoSession = null;
  if (!args.dryRun) {
    const uri = requireEnv('NEO4J_URI');
    const user = requireEnv('NEO4J_USERNAME');
    const password = requireEnv('NEO4J_PASSWORD');
    const database = requireEnv('NEO4J_DATABASE');
    console.log(`Connecting to Neo4j ${uri} (database ${database}) ...`);
    neoDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await neoDriver.verifyConnectivity();
    neoSession = neoDriver.session({ database });
  } else {
    console.log('[DRY RUN] introspecting and counting only -- no Neo4j connection, nothing written.');
  }

  try {
    console.log('Introspecting schema (RDB$ system catalog) ...');
    let schema = await introspectSchema(fbDb);
    if (args.tables) {
      schema = Object.fromEntries(Object.entries(schema).filter(([name]) => args.tables.has(name)));
    }
    const tableNames = Object.keys(schema);
    console.log(`${tableNames.length} table(s) in scope: ${tableNames.join(', ')}`);

    // Phase 1: nodes (also keeps each table's raw rows in memory for phase 2 --
    // fine at this dataset's scale; revisit with streaming if a table grows
    // far beyond the ~60k rows seen today).
    const rowsByTable = {};
    let totalNodes = 0;
    for (const table of Object.values(schema)) {
      if (args.dryRun) {
        const limitClause = args.limit ? `FIRST ${args.limit} ` : '';
        const rows = await fbQuery(fbDb, `SELECT ${limitClause}* FROM ${table.name}`);
        rowsByTable[table.name] = rows;
        console.log(`  ${table.name}: ${rows.length} row(s) (PK: ${table.primaryKey.join(',') || '(none)'}, ${table.foreignKeys.length} FK(s))`);
        totalNodes += rows.length;
        continue;
      }
      console.log(`  Nodes :${table.name} ...`);
      const { rows } = await exportNodesForTable(fbDb, neoSession, table, args);
      rowsByTable[table.name] = rows;
      totalNodes += rows.length;
    }
    console.log(`Phase 1 done. ${totalNodes} row(s) processed as nodes across ${tableNames.length} table(s).`);

    if (args.dryRun) {
      let totalFks = 0;
      for (const table of Object.values(schema)) totalFks += table.foreignKeys.length;
      console.log(`Would also create relationships for ${totalFks} FK constraint(s).`);
      return;
    }

    // Phase 2: relationships (after ALL nodes exist, so a FK is never matched
    // against a not-yet-created parent).
    let totalRels = 0;
    for (const table of Object.values(schema)) {
      for (const fk of table.foreignKeys) {
        console.log(`  Rels  :${fk.fkName} (${fk.childTable} -> ${fk.parentTable}) ...`);
        totalRels += await exportRelationshipsForFk(neoSession, table, fk, rowsByTable[table.name]);
      }
    }
    console.log(`Phase 2 done. ${totalRels} relationship(s) created/merged.`);
  } finally {
    fbDb.detach();
    if (neoSession) await neoSession.close();
    if (neoDriver) await neoDriver.close();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
