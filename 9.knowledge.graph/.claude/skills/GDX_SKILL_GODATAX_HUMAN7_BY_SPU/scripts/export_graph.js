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
 *   node export_graph.js --study <slug> [--dry-run] [--tables T1,T2,...] [--limit N] [--intake-dir <path>]
 *
 *   --study <slug>   REQUIRED. Same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_MAKE_DASHBOARS_DW/
 *                    GDX_SKILL_LOAD_NEW_STUDY_DW use -- resolves to GDX_PSY_STUDY.ID_STUDY
 *                    via new_study_intake/<slug>/intake.json's study.title. Every
 *                    study-scoped table (see STUDY_SCOPE below) is filtered to only
 *                    this one study's rows; shared reference/catalog tables (levels,
 *                    chakras, instrument definitions, etc.) are still exported in
 *                    full -- see "What counts as study-scoped" below.
 *   --intake-dir     override the default new_study_intake/<slug>/ location.
 *   --dry-run        introspect and count rows only, write nothing to Neo4j
 *   --tables T1,T2   only export these tables (still respects their FKs to
 *                    each other; a FK to a table outside this list is
 *                    skipped, not an error)
 *   --limit N        cap each table at its first N rows (for a fast,
 *                    small-scale test run before a full export)
 *
 * Connection: entirely from environment variables (see ../.env.example) --
 * both the Firebird source (GDX_HUMAN_FB_*) and the Neo4j target (NEO4J_*,
 * same variable names as Neo4j-a6a03aab-Created-2026-09-18.txt). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const neo4j = require('neo4j-driver');
const { introspectSchema } = require('./introspect');

const BATCH_SIZE = 1000;

function parseArgs(argv) {
  const args = { dryRun: false, tables: null, limit: null, study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--tables') args.tables = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()));
    else if (argv[i] === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json -- every study-scoped table is filtered to that one study.'
    );
  }
  return args;
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (9.knowledge.graph/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts)
 * -- same depth/pattern as the other two --study-scoped skills' resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}

function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) {
    throw new Error(
      `intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug ` +
      `"${args.study}" first, or pass --intake-dir if it lives somewhere else.`
    );
  }
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

/** Every table this exporter treats as STUDY-SCOPED, and the SQL WHERE
 * fragment (no leading "WHERE") that filters it to one study's rows given a
 * resolved numeric studyId. A table with no entry here is exported in FULL,
 * regardless of --study -- it is shared reference/catalog data (septenary
 * levels, chakras, instrument/construct/variable/item definitions, devices,
 * the DW's calendar dimension, ...), the same "bootstrapped once, not
 * scoped by study" philosophy GDX_SKILL_LOAD_NEW_STUDY_DW already documents
 * for its own global dimensions. Filtering catalogs too would risk starving
 * a relationship of its parent node for no real benefit -- they are small
 * (tens to low hundreds of rows) next to the fact tables this actually
 * matters for (tens of thousands).
 *
 * GDX_PSY_PERSON and GDX_CC_PERSON are both filtered by ID_PERSON directly:
 * cardiac-coherence and psychometric person ids share the same numbering by
 * convention in this dataset (see GoDataX_Human_7_DW.md section 2), so a
 * person enrolled via GDX_PSY_STUDY_PARTICIPANT is assumed to be the same
 * person as any GDX_CC_PERSON/GDX_CC_SESSION row with that same ID_PERSON --
 * exactly the assumption GDX_SKILL_LOAD_NEW_STUDY_DW's own
 * loadDevicesAndSessions() already makes. */
function studyScopeRules(studyId) {
  const PEOPLE = `(SELECT ID_PERSON FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ${studyId})`;
  const APPLICATIONS = `(SELECT ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ${studyId})`;
  const CC_SESSIONS = `(SELECT SESSION_ID FROM GDX_CC_SESSION WHERE ID_PERSON IN ${PEOPLE})`;

  return {
    // The study itself and its enrollment roster.
    GDX_PSY_STUDY: `ID_STUDY = ${studyId}`,
    GDX_PSY_STUDY_PARTICIPANT: `ID_STUDY = ${studyId}`,

    // People enrolled in this study (both identity spaces).
    GDX_PSY_PERSON: `ID_PERSON IN ${PEOPLE}`,
    GDX_CC_PERSON: `ID_PERSON IN ${PEOPLE}`,
    DW_DIM_PERSON: `ID_STUDY = ${studyId}`,

    // Psychometric applications/responses/results/evaluations for this study.
    GDX_PSY_APPLICATION: `ID_STUDY = ${studyId}`,
    GDX_PSY_ITEM_RESPONSE: `ID_APPLICATION IN ${APPLICATIONS}`,
    GDX_PSY_VARIABLE_RESULT: `ID_APPLICATION IN ${APPLICATIONS}`,
    GDX_PSY_CONSTRUCT_RESULT: `ID_APPLICATION IN ${APPLICATIONS}`,
    GDX_PSY_INDICATOR_RESULT: `ID_APPLICATION IN ${APPLICATIONS}`,
    GDX_PSY_OBSERVATION: `ID_STUDY = ${studyId}`,
    GDX_PSY_EVALUATION: `ID_STUDY = ${studyId}`,
    GDX_PSY_EVALUATION_ACTION: `ID_EVALUATION IN (SELECT ID_EVALUATION FROM GDX_PSY_EVALUATION WHERE ID_STUDY = ${studyId})`,

    // Cardiac-coherence sessions/signals for this study's people.
    GDX_CC_SESSION: `ID_PERSON IN ${PEOPLE}`,
    GDX_CC_RR_INTERVAL: `SESSION_ID IN ${CC_SESSIONS}`,
    GDX_CC_ECG_SAMPLE: `SESSION_ID IN ${CC_SESSIONS}`,
    GDX_CC_MOTION: `SESSION_ID IN ${CC_SESSIONS}`,
    GDX_CC_HRV_WINDOW: `SESSION_ID IN ${CC_SESSIONS}`,
    GDX_CC_DEVICE_EVENT: `SESSION_ID IN ${CC_SESSIONS}`,

    // DW facts/dimensions for this study's people.
    DW_DIM_SESSION: `ID_PERSON IN ${PEOPLE}`,
    DW_FACT_PSY_ITEM_RESPONSE: `ID_PERSON IN ${PEOPLE}`,
    DW_FACT_PSY_VARIABLE_RESULT: `ID_PERSON IN ${PEOPLE}`,
    DW_FACT_CC_HRV_WINDOW: `ID_PERSON IN ${PEOPLE}`,
  };
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

/** SELECT for one table: --limit's FIRST N clause plus this table's study
 * WHERE fragment, if `scope` has one for it (undefined = global/unfiltered). */
function buildSelectSql(table, args, whereSql) {
  const limitClause = args.limit ? `FIRST ${args.limit} ` : '';
  const whereClause = whereSql ? ` WHERE ${whereSql}` : '';
  return `SELECT ${limitClause}* FROM ${table.name}${whereClause}`;
}

async function exportNodesForTable(fbDb, neoSession, table, args, whereSql) {
  const rows = await fbQuery(fbDb, buildSelectSql(table, args, whereSql));

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

/** Resolves --study's slug to GDX_PSY_STUDY.ID_STUDY via the intake's
 * study.title -- same lookup the other two --study-scoped skills use. */
async function resolveStudyId(fbDb, studyTitle, studySlug) {
  const rows = await new Promise((resolve, reject) =>
    fbDb.query('SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle],
      (err, result) => (err ? reject(err) : resolve(result))));
  if (rows.length === 0) {
    throw new Error(
      `Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run ` +
      `GDX_SKILL_RECORD_NEW_STUDY and GDX_SKILL_LOAD_NEW_STUDY_DW for this study first.`
    );
  }
  return rows[0].ID_STUDY;
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

  const intake = loadIntake(args);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) {
    throw new Error(`intake.json for study slug "${args.study}" has no study.title -- is this a valid intake file?`);
  }

  console.log(`Connecting to Firebird ${fbOptions.host}:${fbOptions.port}${fbOptions.database} ...`);
  const fbDb = await fbConnect(fbOptions);
  const studyId = await resolveStudyId(fbDb, studyTitle, args.study);
  console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);
  const scope = studyScopeRules(studyId);

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
    const scopedCount = tableNames.filter((n) => scope[n]).length;
    console.log(`${tableNames.length} table(s) in scope: ${tableNames.join(', ')}`);
    console.log(`  ${scopedCount} scoped to study "${studyTitle}" (ID_STUDY=${studyId}); ` +
      `${tableNames.length - scopedCount} exported in full (shared reference/catalog data).`);

    // Phase 1: nodes (also keeps each table's raw rows in memory for phase 2 --
    // fine at this dataset's scale; revisit with streaming if a table grows
    // far beyond the ~60k rows seen today).
    const rowsByTable = {};
    let totalNodes = 0;
    for (const table of Object.values(schema)) {
      const whereSql = scope[table.name];
      const scopeTag = whereSql ? ` [study-scoped]` : ` [global]`;
      if (args.dryRun) {
        const rows = await fbQuery(fbDb, buildSelectSql(table, args, whereSql));
        rowsByTable[table.name] = rows;
        console.log(`  ${table.name}${scopeTag}: ${rows.length} row(s) (PK: ${table.primaryKey.join(',') || '(none)'}, ${table.foreignKeys.length} FK(s))`);
        totalNodes += rows.length;
        continue;
      }
      console.log(`  Nodes :${table.name}${scopeTag} ...`);
      const { rows } = await exportNodesForTable(fbDb, neoSession, table, args, whereSql);
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
