#!/usr/bin/env node
/**
 * Generic loader for a GDX_PSY_PSYCHOMETRIC_PROPERTY SQL file produced by
 * run_efa_generic.py (or run_cfa_from_db.py / run_efa_from_db.py), for ANY
 * ID_INSTRUMENT -- unlike ../../GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/
 * execute_afc_property_load.js, whose preflight() is hardcoded to
 * ID_INSTRUMENT=3 / TYPE='CFI' (CAAS's own CFA load only). Reuses that
 * sibling skill's parseStatements() for the same tested multi-line
 * INSERT/comment-stripping behavior.
 *
 * Preflight: refuses to load if GDX_PSY_PSYCHOMETRIC_PROPERTY already has ANY
 * row for --instrument (checked, not assumed) unless --force is passed --
 * this script never deletes anything, only ever appends.
 *
 * Usage:
 *   node load_property_file.js --file <path.sql> --instrument <ID> [--dry-run] [--force]
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { parseStatements } = require('../../GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/execute_load.js');

function parseArgs(argv) {
  const args = { file: null, instrument: null, dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--instrument') args.instrument = parseInt(argv[++i], 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.file) throw new Error('--file <path.sql> is required.');
  if (!args.instrument) throw new Error('--instrument <ID> is required (used only for the preflight duplicate check).');
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
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql) {
  return new Promise((resolve, reject) => db.query(sql, (err, result) => (err ? reject(err) : resolve(result))));
}
function startTransaction(db) {
  return new Promise((resolve, reject) => db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, tr) => (err ? reject(err) : resolve(tr))));
}
function txQuery(tr, sql) {
  return new Promise((resolve, reject) => tr.query(sql, (err, result) => (err ? reject(err) : resolve(result))));
}
function commit(tr) {
  return new Promise((resolve, reject) => tr.commit((err) => (err ? reject(err) : resolve())));
}
function rollback(tr) {
  return new Promise((resolve) => tr.rollback(() => resolve()));
}

async function preflight(db, instrument, force) {
  const instRows = await query(db, `SELECT COUNT(*) AS CNT FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ${instrument}`);
  if (instRows[0].CNT === 0) throw new Error(`GDX_PSY_INSTRUMENT.ID_INSTRUMENT=${instrument} not found.`);
  const dupRows = await query(db, `SELECT COUNT(*) AS CNT FROM GDX_PSY_PSYCHOMETRIC_PROPERTY WHERE ID_INSTRUMENT = ${instrument}`);
  const alreadyLoaded = dupRows[0].CNT > 0;
  if (alreadyLoaded && !force) {
    throw new Error(
      `GDX_PSY_PSYCHOMETRIC_PROPERTY already has ${dupRows[0].CNT} row(s) for ID_INSTRUMENT=${instrument} -- ` +
      `refusing to proceed to avoid duplicates (this script never deletes anything). Pass --force to load again anyway.`
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
    const { alreadyLoaded } = await preflight(db, args.instrument, args.force);
    if (alreadyLoaded) console.log('WARNING: proceeding despite existing data (--force).');

    if (args.dryRun) {
      console.log(`Dry run complete. ${statements.length} statement(s) would be executed. Nothing written.`);
      return;
    }

    const tr = await startTransaction(db);
    try {
      for (const stmt of statements) await txQuery(tr, stmt);
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
