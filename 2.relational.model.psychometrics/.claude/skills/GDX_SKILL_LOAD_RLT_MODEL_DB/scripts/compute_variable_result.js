#!/usr/bin/env node
/**
 * Computes GDX_PSY_VARIABLE_RESULT.RAW_SCORE as the UNWEIGHTED MEAN of a fixed
 * set of raw item responses (ITEM_ORDER values, all from the same instrument),
 * for any application that has every one of those items answered but does not
 * yet have a GDX_PSY_VARIABLE_RESULT row for the target variable.
 *
 * Exists because GDX_SKILL_LOAD_NEW_STUDY_ANSWERS deliberately never computes
 * a score (see its own header comment) -- it only loads what a participant
 * answered. For a variable whose exact scoring formula has been independently
 * confirmed (see the self-check below), this script is the missing "compute
 * the score" step for any application loaded outside the original .sav
 * pipeline (samples.SQL/07_load_variable_results.sql, which only covers the
 * .sav's own 21 pre-computed columns -- see generate_load_scripts.py and
 * SPSS_to_Firebird_Mapping.md).
 *
 * Self-check (safety net): before computing anything NEW, this script first
 * checks the formula (--items' unweighted mean) against every application
 * that ALREADY has both a GDX_PSY_VARIABLE_RESULT row for --variable and all
 * of --items answered. If the mean does not reproduce every existing score
 * within tolerance, it refuses outright -- this guards against the wrong item
 * subset being passed for a variable this script has never verified. If there
 * are zero existing rows to check against, it proceeds but prints a clear
 * warning that the formula is unvalidated.
 *
 * Confirmed example (see 2.relational.model.psychometrics/.claude/skills/
 * GDX_SKILL_MAKE_ANALYSES_CFA_EFA's own Track A methodology, applied here to
 * one Track B variable): ID_VARIABLE=22 "Emotional Exhaustion" (Maslach
 * Burnout Inventory - Student Survey, ID_INSTRUMENT=9) = unweighted mean of
 * ITEM_ORDER 1-5 -- verified byte-for-byte (max discrepancy 0) against all
 * 423 existing rows before this script was written:
 *   node compute_variable_result.js --instrument 9 --variable 22 --items 1,2,3,4,5 --dry-run
 *
 * Never invents a formula: --items is always supplied by the caller (a human
 * who has independently confirmed it, e.g. via GDX_SKILL_MAKE_ANALYSES_CFA_EFA's
 * analyze_instrument.js discovery, or domain documentation). This script only
 * verifies and applies it.
 *
 * Usage:
 *   node compute_variable_result.js --instrument <ID> --variable <ID_VARIABLE> --items <o1,o2,...>
 *                                    [--study <slug>] [--intake-dir <path>] [--dry-run]
 *
 *   --instrument <ID>   the instrument --items' ITEM_ORDER values belong to.
 *   --variable <ID>     the GDX_PSY_VARIABLE to write RAW_SCORE for.
 *   --items <list>      comma-separated ITEM_ORDER values (not ID_ITEM) whose unweighted mean is
 *                        the score, e.g. "1,2,3,4,5".
 *   --study <slug>      optional. Same slug the other --study-scoped skills use -- restricts which
 *                        applications are considered (both for the self-check and for computing new
 *                        scores) to one study. Omit to consider every application in the database.
 *   --intake-dir         override the default new_study_intake/<slug>/ location.
 *   --dry-run            compute and print what would be inserted; write nothing.
 *
 * Connection: environment variables only (see ../.env.example). Never hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { instrument: null, variable: null, items: null, study: null, intakeDir: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--instrument') args.instrument = parseInt(argv[++i], 10);
    else if (a === '--variable') args.variable = parseInt(argv[++i], 10);
    else if (a === '--items') args.items = argv[++i].split(',').map((s) => parseInt(s.trim(), 10));
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.instrument) throw new Error('--instrument <ID> is required.');
  if (!args.variable) throw new Error('--variable <ID_VARIABLE> is required.');
  if (!args.items || args.items.length === 0) throw new Error('--items <o1,o2,...> (ITEM_ORDER values) is required.');
  return args;
}

function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) {
    throw new Error(`intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug "${args.study}" first, or pass --intake-dir.`);
  }
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and export the vars first.`);
  return v;
}
function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}
async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  return rows[0].ID_STUDY;
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

async function main() {
  const args = parseArgs(process.argv);

  const options = {
    host: requireEnv('GDX_HUMAN_FB_HOST'), port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'), user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'), lowercase_keys: false, role: null, pageSize: 4096,
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const instRows = await query(db, 'SELECT NAME FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ?', [args.instrument]);
    if (instRows.length === 0) throw new Error(`No GDX_PSY_INSTRUMENT row for ID_INSTRUMENT=${args.instrument}.`);
    const varRows = await query(db, 'SELECT NAME FROM GDX_PSY_VARIABLE WHERE ID_VARIABLE = ?', [args.variable]);
    if (varRows.length === 0) throw new Error(`No GDX_PSY_VARIABLE row for ID_VARIABLE=${args.variable}.`);
    const varName = varRows[0].NAME;

    const itemCatalogRows = await query(db,
      `SELECT ITEM_ORDER FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ? AND ITEM_ORDER IN (${args.items.join(',')})`,
      [args.instrument]);
    const foundOrders = new Set(itemCatalogRows.map((r) => r.ITEM_ORDER));
    const badOrders = args.items.filter((o) => !foundOrders.has(o));
    if (badOrders.length) {
      throw new Error(`ITEM_ORDER ${badOrders.join(', ')} not found in GDX_PSY_INSTRUMENT_ITEM for instrument ${args.instrument}.`);
    }

    let studyId = null;
    if (args.study) {
      const intake = loadIntake(args);
      const studyTitle = intake.study && intake.study.title;
      if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);
      studyId = await resolveStudyId(db, studyTitle, args.study);
      console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);
    }
    const studyFilter = studyId !== null
      ? ` AND ir.ID_APPLICATION IN (SELECT ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ${studyId})`
      : '';

    const itemResponseRows = await query(db, `
      SELECT ir.ID_APPLICATION, ii.ITEM_ORDER, ir.NUMERIC_VALUE
      FROM GDX_PSY_ITEM_RESPONSE ir
      JOIN GDX_PSY_INSTRUMENT_ITEM ii ON ii.ID_ITEM = ir.ID_ITEM
      WHERE ii.ID_INSTRUMENT = ? AND ii.ITEM_ORDER IN (${args.items.join(',')})${studyFilter}
      ORDER BY ir.ID_APPLICATION`, [args.instrument]);

    const byApp = new Map();
    for (const r of itemResponseRows) {
      if (!byApp.has(r.ID_APPLICATION)) byApp.set(r.ID_APPLICATION, {});
      byApp.get(r.ID_APPLICATION)[r.ITEM_ORDER] = r.NUMERIC_VALUE;
    }

    const computable = new Map(); // appId -> mean
    let incomplete = 0;
    for (const [appId, items] of byApp) {
      if (args.items.every((o) => items[o] !== undefined && items[o] !== null)) {
        computable.set(appId, mean(args.items.map((o) => items[o])));
      } else {
        incomplete++;
      }
    }

    const existingRows = await query(db, 'SELECT ID_APPLICATION, RAW_SCORE FROM GDX_PSY_VARIABLE_RESULT WHERE ID_VARIABLE = ?', [args.variable]);
    const existingByApp = new Map(existingRows.map((r) => [r.ID_APPLICATION, r.RAW_SCORE]));

    // --- Self-check: does --items' unweighted mean reproduce every EXISTING score? ---
    let checked = 0, maxDiscrepancy = 0;
    for (const [appId, computedMean] of computable) {
      if (existingByApp.has(appId)) {
        checked++;
        maxDiscrepancy = Math.max(maxDiscrepancy, Math.abs(computedMean - existingByApp.get(appId)));
      }
    }
    if (checked > 0) {
      console.log(`Self-check: mean(items ${args.items.join(',')}) vs. ${checked} EXISTING GDX_PSY_VARIABLE_RESULT row(s) for variable ${args.variable} ("${varName}") -- max discrepancy ${maxDiscrepancy}.`);
      if (maxDiscrepancy > 1e-3) {
        throw new Error(`Formula does not reproduce existing scores (max discrepancy ${maxDiscrepancy} > 1e-3 tolerance) -- ` +
          `--items is likely the wrong subset for variable ${args.variable}. Refusing to compute new rows with an unverified formula.`);
      }
      console.log('Self-check passed -- formula reproduces every existing score within tolerance.');
    } else {
      console.log(`WARNING: no existing GDX_PSY_VARIABLE_RESULT rows for variable ${args.variable} to self-check the formula against -- proceeding UNVALIDATED. Verify --items independently before trusting this run's output.`);
    }

    // --- New rows: computable applications that do not already have a score ---
    const toInsert = [...computable.entries()].filter(([appId]) => !existingByApp.has(appId));

    console.log(`\nApplications with instrument ${args.instrument} responses in scope: ${byApp.size}.`);
    console.log(`  Missing one or more of items ${args.items.join(',')}: ${incomplete} (skipped).`);
    console.log(`  Already have a GDX_PSY_VARIABLE_RESULT row for variable ${args.variable}: ${computable.size - toInsert.length} (skipped).`);
    console.log(`  ${args.dryRun ? 'Would insert' : 'Inserting'}: ${toInsert.length} new row(s).`);
    for (const [appId, val] of toInsert) console.log(`    ID_APPLICATION=${appId}: RAW_SCORE=${val.toFixed(6)}`);

    if (args.dryRun || toInsert.length === 0) {
      console.log(args.dryRun ? '\n[DRY RUN] Nothing written.' : '\nNothing to insert.');
      return;
    }

    for (const [appId, val] of toInsert) {
      await query(db, 'INSERT INTO GDX_PSY_VARIABLE_RESULT (ID_APPLICATION, ID_VARIABLE, RAW_SCORE) VALUES (?, ?, ?)', [appId, args.variable, val]);
    }
    console.log(`\nDone. ${toInsert.length} row(s) inserted into GDX_PSY_VARIABLE_RESULT.`);
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
