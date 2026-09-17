#!/usr/bin/env node
/**
 * GDX_SKILL_NEW_STUDY - read-only helper: lists what already exists in the
 * live GDX_PSY_* catalog (studies, phenomena, constructs, instruments,
 * distinct RESPONSE_TYPE/DIRECTION values in use), so the interview can
 * avoid re-asking for a scale that is already cataloged and can reuse the
 * project's existing naming conventions instead of inventing new ones.
 *
 * Read-only by construction: every statement here is a SELECT. This script
 * never INSERTs/UPDATEs/DELETEs anything -- that is GDX_SKILL_RECORD_NEW_STUDY's
 * job, not this one's.
 *
 * Connection is read entirely from environment variables, same as
 * GDX_SKILL_LOAD_RLT_MODEL_DB (see .env.example in this folder) -- never
 * hardcode host/user/password (see CLAUDE.md).
 *
 * Usage:
 *   node check_catalog.js               # human-readable report on stdout
 *   node check_catalog.js --json         # same data as one JSON object
 */
const Firebird = require('node-firebird');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env ` +
      `in this folder, fill it in, and export the vars before running this script.`
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

async function main() {
  const asJson = process.argv.includes('--json');

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

  const db = await connect(options);
  try {
    const report = {};

    report.studies = await query(db,
      'SELECT ID_STUDY, TITLE, STATUS FROM GDX_PSY_STUDY ORDER BY ID_STUDY');

    report.phenomena = await query(db,
      'SELECT ID_PHENOMENON, NAME FROM GDX_PSY_PHENOMENON ORDER BY NAME');

    report.constructs = await query(db,
      'SELECT ID_CONSTRUCT, NAME, DOMAIN FROM GDX_PSY_CONSTRUCT ORDER BY NAME');

    report.instruments = await query(db,
      "SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE FROM GDX_PSY_INSTRUMENT ORDER BY NAME");

    report.variables_per_construct = await query(db,
      `SELECT c.NAME AS CONSTRUCT_NAME, v.NAME AS VARIABLE_NAME, v.MEASUREMENT_LEVEL
       FROM GDX_PSY_VARIABLE v
       JOIN GDX_PSY_CONSTRUCT c ON c.ID_CONSTRUCT = v.ID_CONSTRUCT
       ORDER BY c.NAME, v.NAME`);

    report.distinct_response_types = await query(db,
      'SELECT DISTINCT RESPONSE_TYPE FROM GDX_PSY_INSTRUMENT_ITEM ORDER BY RESPONSE_TYPE');

    report.distinct_indicator_directions = await query(db,
      "SELECT DISTINCT DIRECTION FROM GDX_PSY_INDICATOR WHERE DIRECTION IS NOT NULL ORDER BY DIRECTION");

    report.distinct_indicator_types = await query(db,
      "SELECT DISTINCT INDICATOR_TYPE FROM GDX_PSY_INDICATOR WHERE INDICATOR_TYPE IS NOT NULL ORDER BY INDICATOR_TYPE");

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`Studies (${report.studies.length}):`);
    for (const r of report.studies) console.log(`  #${r.ID_STUDY}  ${r.TITLE}  [${r.STATUS}]`);

    console.log(`\nPhenomena (${report.phenomena.length}):`);
    for (const r of report.phenomena) console.log(`  #${r.ID_PHENOMENON}  ${r.NAME}`);

    console.log(`\nConstructs (${report.constructs.length}):`);
    for (const r of report.constructs) console.log(`  #${r.ID_CONSTRUCT}  ${r.NAME}  (domain: ${r.DOMAIN || 'n/a'})`);

    console.log(`\nInstruments (${report.instruments.length}):`);
    for (const r of report.instruments) {
      console.log(`  #${r.ID_INSTRUMENT}  ${r.NAME}  v${r.VERSION || 'n/a'}  [${r.TYPE}]  ${r.ACTIVE ? 'active' : 'INACTIVE'}`);
    }

    console.log(`\nVariables per construct (${report.variables_per_construct.length}):`);
    for (const r of report.variables_per_construct) {
      console.log(`  ${r.CONSTRUCT_NAME} -> ${r.VARIABLE_NAME}  (${r.MEASUREMENT_LEVEL || 'n/a'})`);
    }

    console.log(`\nRESPONSE_TYPE values already in use: ${report.distinct_response_types.map(r => r.RESPONSE_TYPE).join(', ') || '(none)'}`);
    console.log(`INDICATOR.DIRECTION values already in use: ${report.distinct_indicator_directions.map(r => r.DIRECTION).join(', ') || '(none)'}`);
    console.log(`INDICATOR.INDICATOR_TYPE values already in use: ${report.distinct_indicator_types.map(r => r.INDICATOR_TYPE).join(', ') || '(none)'}`);
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
