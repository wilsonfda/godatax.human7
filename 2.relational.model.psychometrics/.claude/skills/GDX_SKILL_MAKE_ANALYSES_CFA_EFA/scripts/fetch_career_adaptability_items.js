#!/usr/bin/env node
/**
 * Stage 1 (Node.js) of GDX_SKILL_MAKE_ANALYSES_CFA_EFA.
 *
 * Reads the Career Adapt-Abilities Scale (CAAS, ID_INSTRUMENT=3) raw item
 * responses and the precomputed dimension scores straight from a live
 * Firebird database, over the wire protocol (node-firebird, no native
 * client library required) -- this is the DB equivalent of the AC1-AC28
 * columns and ACpreocup/ACcontrole/ACcuriosid/ACconfianc columns that
 * run_cfa_career_adaptability.py / run_efa_loadings_means_sd_career_adaptability.py
 * (in ../../../analyses.CFA and ../../../analyses.EFA) read from the .sav file.
 *
 * Writes two CSVs that the stage-2 Python scripts in this same skill folder
 * consume instead of pyreadstat.read_sav(...):
 *   - career_adaptability_items.csv             ID_APPLICATION, AC1..AC28
 *   - career_adaptability_dimension_scores.csv   ID_APPLICATION, Concern, Control, Curiosity, Confidence
 *
 * Required env vars (same as GDX_SKILL_LOAD_RLT_MODEL_DB, see .env.example):
 *   GDX_HUMAN_FB_HOST, GDX_HUMAN_FB_PORT, GDX_HUMAN_FB_DATABASE,
 *   GDX_HUMAN_FB_USER, GDX_HUMAN_FB_PASSWORD
 *
 * Usage:
 *   node fetch_career_adaptability_items.js [--out-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

const ID_INSTRUMENT = 3; // Career Adapt-Abilities Scale (CAAS)
const N_ITEMS = 28;
const DIMENSION_VARIABLE = {
  7: 'Concern',
  8: 'Control',
  9: 'Curiosity',
  10: 'Confidence',
};

function parseArgs(argv) {
  const args = { outDir: path.join(__dirname, '..', 'data') };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir') args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
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

function loadDotEnvIfPresent(envPath) {
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function connect(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)));
  });
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function tableExists(db, name) {
  const rows = await query(db, `SELECT 1 FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = '${name}'`);
  return rows.length > 0;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeCsv(filePath, header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));

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
    for (const t of ['GDX_PSY_ITEM_RESPONSE', 'GDX_PSY_INSTRUMENT_ITEM', 'GDX_PSY_VARIABLE_RESULT']) {
      if (!(await tableExists(db, t))) {
        throw new Error(`${t} does not exist on this database. Apply psychometrics_model_firebird25.sql and run GDX_SKILL_LOAD_RLT_MODEL_DB first.`);
      }
    }

    // --- Raw item responses, AC1..AC28, one row per application ---
    const itemRows = await query(
      db,
      `SELECT ir.ID_APPLICATION, ii.ITEM_ORDER, ir.NUMERIC_VALUE
       FROM GDX_PSY_ITEM_RESPONSE ir
       JOIN GDX_PSY_INSTRUMENT_ITEM ii ON ii.ID_ITEM = ir.ID_ITEM
       WHERE ii.ID_INSTRUMENT = ?
       ORDER BY ir.ID_APPLICATION, ii.ITEM_ORDER`,
      [ID_INSTRUMENT]
    );

    const byApp = new Map();
    for (const r of itemRows) {
      if (!byApp.has(r.ID_APPLICATION)) byApp.set(r.ID_APPLICATION, {});
      byApp.get(r.ID_APPLICATION)[r.ITEM_ORDER] = r.NUMERIC_VALUE;
    }

    const incomplete = [];
    for (const [appId, items] of byApp) {
      const missing = [];
      for (let i = 1; i <= N_ITEMS; i++) {
        if (items[i] === undefined || items[i] === null) missing.push(i);
      }
      if (missing.length) incomplete.push({ appId, missing });
    }
    if (incomplete.length) {
      console.error(`ERROR: ${incomplete.length} application(s) have missing AC items (expected all ${N_ITEMS} present, no NULLs, same as the .sav source):`);
      for (const { appId, missing } of incomplete.slice(0, 10)) {
        console.error(`  ID_APPLICATION=${appId} missing AC${missing.join(', AC')}`);
      }
      throw new Error('Refusing to write an incomplete items CSV. Fix the data (or the 01..08 load) before re-running.');
    }

    const appIds = [...byApp.keys()].sort((a, b) => a - b);
    const itemHeader = ['ID_APPLICATION', ...Array.from({ length: N_ITEMS }, (_, i) => `AC${i + 1}`)];
    const itemsCsvRows = appIds.map((appId) => [appId, ...Array.from({ length: N_ITEMS }, (_, i) => byApp.get(appId)[i + 1])]);

    const itemsCsvPath = path.join(args.outDir, 'career_adaptability_items.csv');
    writeCsv(itemsCsvPath, itemHeader, itemsCsvRows);
    console.log(`Wrote ${itemsCsvPath} (${appIds.length} applications x ${N_ITEMS} items).`);

    // --- Precomputed dimension scores (Concern/Control/Curiosity/Confidence), for
    //     the same cross-validation role the .sav-sourced scripts give the SPSS
    //     ACpreocup/ACcontrole/ACcuriosid/ACconfianc columns, and for the EFA
    //     script's dimension-level mean/SD and Pearson correlation sections. ---
    const dimVarIds = Object.keys(DIMENSION_VARIABLE).map(Number);
    const dimRows = await query(
      db,
      `SELECT ID_APPLICATION, ID_VARIABLE, RAW_SCORE
       FROM GDX_PSY_VARIABLE_RESULT
       WHERE ID_VARIABLE IN (${dimVarIds.join(',')})
       ORDER BY ID_APPLICATION`,
      []
    );
    const dimByApp = new Map();
    for (const r of dimRows) {
      if (!dimByApp.has(r.ID_APPLICATION)) dimByApp.set(r.ID_APPLICATION, {});
      dimByApp.get(r.ID_APPLICATION)[DIMENSION_VARIABLE[r.ID_VARIABLE]] = r.RAW_SCORE;
    }
    const dimNames = ['Concern', 'Control', 'Curiosity', 'Confidence'];
    const missingDim = appIds.filter((appId) => {
      const d = dimByApp.get(appId);
      return !d || dimNames.some((name) => d[name] === undefined || d[name] === null);
    });
    if (missingDim.length) {
      throw new Error(
        `${missingDim.length} application(s) present in GDX_PSY_ITEM_RESPONSE have no (or partial) ` +
        `GDX_PSY_VARIABLE_RESULT row for Concern/Control/Curiosity/Confidence (ID_VARIABLE 7-10). ` +
        `First few: ${missingDim.slice(0, 10).join(', ')}. Run GDX_SKILL_LOAD_RLT_MODEL_DB's step 06/07 first.`
      );
    }

    const dimHeader = ['ID_APPLICATION', ...dimNames];
    const dimCsvRows = appIds.map((appId) => [appId, ...dimNames.map((name) => dimByApp.get(appId)[name])]);
    const dimCsvPath = path.join(args.outDir, 'career_adaptability_dimension_scores.csv');
    writeCsv(dimCsvPath, dimHeader, dimCsvRows);
    console.log(`Wrote ${dimCsvPath} (${appIds.length} applications x ${dimNames.length} dimensions).`);

    console.log(`\nDone. n=${appIds.length} (expected 423 if this is the same population the .sav-sourced analyses used).`);
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

module.exports = { main };
