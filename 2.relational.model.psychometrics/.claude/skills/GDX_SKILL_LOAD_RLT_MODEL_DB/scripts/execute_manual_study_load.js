#!/usr/bin/env node
/**
 * One-off executor for a manual GDX_PSY_STUDY insert (e.g.
 * ../../../samples.SQL/manual_load_study2_burnout_test.sql) that does not go
 * through the full 01-08 pipeline (execute_load.js) because it reuses an
 * existing instrument -- no instrument/construct/variable/item rows to load.
 *
 * Preflight: refuses if a GDX_PSY_STUDY row with the file's own ID_STUDY (or
 * the same TITLE) already exists, unless --force.
 *
 * Usage:
 *   node execute_manual_study_load.js --file <path.sql> [--dry-run] [--force]
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
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and export the vars first.`);
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
function commit(tr) { return new Promise((resolve, reject) => tr.commit((err) => (err ? reject(err) : resolve()))); }
function rollback(tr) { return new Promise((resolve) => tr.rollback(() => resolve())); }

async function preflight(db, statements, force) {
  const idMatch = statements.join('\n').match(/INSERT INTO GDX_PSY_STUDY \(ID_STUDY[^)]*\)\s*VALUES\s*\((\d+)/i);
  if (!idMatch) throw new Error('Could not find an "INSERT INTO GDX_PSY_STUDY (ID_STUDY, ...) VALUES (N, ..." statement to preflight-check.');
  const idStudy = idMatch[1];
  const rows = await query(db, `SELECT TITLE FROM GDX_PSY_STUDY WHERE ID_STUDY = ${idStudy}`);
  if (rows.length > 0 && !force) {
    throw new Error(`GDX_PSY_STUDY already has ID_STUDY=${idStudy} ("${rows[0].TITLE}") -- refusing to proceed to avoid a duplicate/collision. Pass --force to proceed anyway.`);
  }
  return { idStudy, alreadyExists: rows.length > 0 };
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
    const { idStudy, alreadyExists } = await preflight(db, statements, args.force);
    console.log(`Preflight: ID_STUDY=${idStudy} ${alreadyExists ? 'ALREADY EXISTS' : 'is free'}.`);
    if (alreadyExists) console.log('WARNING: proceeding despite existing row (--force).');

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
