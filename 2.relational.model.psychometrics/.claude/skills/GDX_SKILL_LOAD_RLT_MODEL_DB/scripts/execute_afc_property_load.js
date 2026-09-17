#!/usr/bin/env node
/**
 * One-off executor for GDX_PSY_PSYCHOMETRIC_PROPERTY loads that come from an
 * external statistical analysis (e.g. a CFA run outside the .sav-derived
 * pipeline), not from generate_load_scripts.py. Reuses the same connection
 * conventions as execute_load.js (env vars only, no hardcoded credentials --
 * see CLAUDE.md) and its statement parser, but targets a single arbitrary
 * SQL file instead of the fixed 01..08 pipeline.
 *
 * Required env vars (same as execute_load.js):
 *   GDX_HUMAN_FB_HOST, GDX_HUMAN_FB_PORT, GDX_HUMAN_FB_DATABASE,
 *   GDX_HUMAN_FB_USER, GDX_HUMAN_FB_PASSWORD
 *
 * Usage:
 *   node execute_afc_property_load.js --file <path.sql> [--dry-run] [--force]
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { parseStatements } = require('./execute_load.js');

function parseArgs(argv) {
  const args = { file: null, dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.file) throw new Error('--file <path.sql> is required.');
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env in this ` +
      `folder, fill it in, and export the vars before running this script.`
    );
  }
  return v;
}

function connect(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)));
  });
}
function query(db, sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, result) => (err ? reject(err) : resolve(result)));
  });
}
function startTransaction(db) {
  return new Promise((resolve, reject) => {
    db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, tr) => (err ? reject(err) : resolve(tr)));
  });
}
function txQuery(tr, sql) {
  return new Promise((resolve, reject) => {
    tr.query(sql, (err, result) => (err ? reject(err) : resolve(result)));
  });
}
function commit(tr) {
  return new Promise((resolve, reject) => {
    tr.commit((err) => (err ? reject(err) : resolve()));
  });
}
function rollback(tr) {
  return new Promise((resolve) => {
    tr.rollback(() => resolve());
  });
}

async function tableExists(db, name) {
  const rows = await query(db, `SELECT 1 FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = '${name}'`);
  return rows.length > 0;
}

async function preflight(db, force) {
  if (!(await tableExists(db, 'GDX_PSY_PSYCHOMETRIC_PROPERTY'))) {
    throw new Error(
      'GDX_PSY_PSYCHOMETRIC_PROPERTY does not exist on this database. Apply ' +
      'psychometrics_model_firebird25.sql (the DDL) first.'
    );
  }
  const instrumentRows = await query(
    db,
    'SELECT COUNT(*) AS CNT FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = 3'
  );
  if (instrumentRows[0].CNT === 0) {
    throw new Error(
      'GDX_PSY_INSTRUMENT.ID_INSTRUMENT = 3 (Career Adapt-Abilities Scale) not found -- ' +
      'run the base 01..08 load first (see SKILL.md), this file depends on that catalog row.'
    );
  }
  const dupRows = await query(
    db,
    "SELECT COUNT(*) AS CNT FROM GDX_PSY_PSYCHOMETRIC_PROPERTY WHERE ID_INSTRUMENT = 3 AND TYPE = 'CFI'"
  );
  const alreadyLoaded = dupRows[0].CNT > 0;
  if (alreadyLoaded && !force) {
    throw new Error(
      "GDX_PSY_PSYCHOMETRIC_PROPERTY already has a 'CFI' row for ID_INSTRUMENT=3 -- this CFA " +
      'result looks already loaded. Refusing to proceed to avoid duplicates (this script never ' +
      'deletes anything). Pass --force to load again anyway (e.g. a re-run with updated numbers).'
    );
  }
  return { alreadyLoaded };
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = path.resolve(args.file);
  const statements = parseStatements(fs.readFileSync(filePath, 'utf8'));
  console.log(`${path.basename(filePath)}: ${statements.length} statement(s)`);

  const options = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const { alreadyLoaded } = await preflight(db, args.force);
    if (alreadyLoaded) console.log('WARNING: proceeding despite existing data (--force).');

    if (args.dryRun) {
      console.log(`Dry run complete. ${statements.length} statement(s) would be executed. Nothing written.`);
      return;
    }

    const tr = await startTransaction(db);
    try {
      for (const stmt of statements) {
        await txQuery(tr, stmt);
      }
      await commit(tr);
      console.log(`Done. ${statements.length} statement(s) executed and committed.`);
    } catch (err) {
      await rollback(tr);
      throw err;
    }
  } finally {
    db.detach();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
