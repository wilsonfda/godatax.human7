#!/usr/bin/env node
/**
 * Track C of GDX_SKILL_MAKE_ANALYSES_CFA_EFA -- single-item instruments
 * (Personal Satisfaction ID_INSTRUMENT=7, Perceived Control of Life
 * ID_INSTRUMENT=8). Neither EFA nor CFA is mathematically defined for a
 * single item: factor analysis extracts shared variance across >=2
 * variables, and a 1x1 correlation matrix has none to extract (KMO/Bartlett
 * are undefined, and a "loading" of a single item on its own single factor
 * is trivially 1 by construction, not a finding). analyze_instrument.js
 * already refuses to run structure discovery for these -- this script covers
 * the honest remainder: descriptive statistics only (item mean/SD, which for
 * a single item equals the variable's own DIMENSION_MEAN/STD_DEV read
 * straight from GDX_PSY_VARIABLE_RESULT).
 *
 * Usage:
 *   node describe_single_item_instrument.js --instrument <ID> [--study <slug>] [--intake-dir <path>] [--out-dir <path>]
 *
 *   --study <slug>   optional. Same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_GODATAX_HUMAN7_BY_SPU use --
 *                     resolves to GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                     study.title, and filters responses to that one study's applications. Omit to
 *                     describe every response to this instrument across every study.
 *   --intake-dir     override the default new_study_intake/<slug>/ location.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { instrument: null, outDir: path.join(__dirname, '..', 'output'), study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--instrument') args.instrument = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.instrument) throw new Error('--instrument <ID> is required.');
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
    throw new Error(
      `intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug ` +
      `"${args.study}" first, or pass --intake-dir if it lives somewhere else.`
    );
  }
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  }
  return rows[0].ID_STUDY;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and export the vars first.`);
  return v;
}
function loadDotEnvIfPresent(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim(), v = t.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}
function esc(x) { return String(x).replace(/'/g, "''"); }
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function sd(xs) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));
  const options = {
    host: requireEnv('GDX_HUMAN_FB_HOST'), port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'), user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'), lowercase_keys: false, role: null, pageSize: 4096,
  };
  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const instRows = await query(db, 'SELECT ID_INSTRUMENT, NAME FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ?', [args.instrument]);
    if (instRows.length === 0) throw new Error(`No GDX_PSY_INSTRUMENT row for ID_INSTRUMENT=${args.instrument}.`);
    const instrumentName = instRows[0].NAME;

    const itemRows = await query(db, 'SELECT ID_ITEM, ITEM_ORDER FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ?', [args.instrument]);
    if (itemRows.length !== 1) {
      throw new Error(`Instrument ${args.instrument} has ${itemRows.length} item(s), not 1 -- use analyze_instrument.js + run_efa_generic.py (or run_cfa_generic.py) instead, this script is only for genuine single-item instruments.`);
    }

    const varRows = await query(db, `
      SELECT V.ID_VARIABLE, V.NAME, V.ID_CONSTRUCT
      FROM GDX_PSY_VARIABLE V JOIN GDX_PSY_INSTRUMENT_CONSTRUCT IC ON IC.ID_CONSTRUCT = V.ID_CONSTRUCT
      WHERE IC.ID_INSTRUMENT = ?`, [args.instrument]);
    if (varRows.length !== 1) throw new Error(`Expected exactly 1 named variable for instrument ${args.instrument}, found ${varRows.length}.`);
    const { ID_VARIABLE: idVariable, NAME: varName, ID_CONSTRUCT: idConstruct } = varRows[0];

    let studyId = null;
    if (args.study) {
      const intake = loadIntake(args);
      const studyTitle = intake.study && intake.study.title;
      if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);
      studyId = await resolveStudyId(db, studyTitle, args.study);
      console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);
    }
    const appFilter = studyId !== null
      ? ` AND ID_APPLICATION IN (SELECT ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ${studyId})`
      : '';

    const responseRows = await query(db, `SELECT NUMERIC_VALUE FROM GDX_PSY_ITEM_RESPONSE WHERE ID_ITEM = ?${appFilter}`, [itemRows[0].ID_ITEM]);
    const values = responseRows.map((r) => r.NUMERIC_VALUE).filter((v) => v !== null && v !== undefined);
    const n = values.length;
    if (n === 0) {
      throw new Error(`No responses to instrument ${args.instrument} ("${instrumentName}")` +
        (studyId !== null ? ` for study "${args.study}" (ID_STUDY=${studyId}).` : '.'));
    }
    const itemMean = mean(values);
    const itemSd = n >= 2 ? sd(values) : null;

    const scoreRows = await query(db, `SELECT RAW_SCORE FROM GDX_PSY_VARIABLE_RESULT WHERE ID_VARIABLE = ?${appFilter}`, [idVariable]);
    const scores = scoreRows.map((r) => r.RAW_SCORE).filter((v) => v !== null && v !== undefined);
    const dimMean = scores.length ? mean(scores) : null;
    const dimSd = scores.length >= 2 ? sd(scores) : null;

    console.log(`Instrument ${args.instrument} ("${instrumentName}"): 1 item, 1 variable ("${varName}"). n=${n}.`);
    console.log(`  Item mean=${itemMean.toFixed(4)} sd=${itemSd !== null ? itemSd.toFixed(4) : 'undefined (n<2)'}`);
    console.log(`  ${varName} (GDX_PSY_VARIABLE_RESULT): mean=${dimMean !== null ? dimMean.toFixed(4) : 'n/a'} sd=${dimSd !== null ? dimSd.toFixed(4) : 'undefined (n<2)'} (n=${scores.length})`);
    console.log('  No KMO/Bartlett/EFA/CFA: a single item has no cross-item variance to factor-analyze.');
    if (n < 2 || scores.length < 2) {
      console.log(`  NOTE: n<2 -- standard deviation is undefined with fewer than 2 respondents. ` +
        `STD_DEV row(s) below are omitted rather than written as NaN/0.`);
    }

    const calculatedAt = new Date().toISOString().slice(0, 10);
    const method = 'Descriptive statistics only - single item, no factor analysis possible';
    const insert = (typ, val, ref, sampleN) =>
      'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) ' +
      `VALUES (${args.instrument}, ${idConstruct}, '${typ}', '${esc(method)}', ${val.toFixed(6)}, ${sampleN}, '${esc(ref)}', '${calculatedAt}');`;

    const lines = [
      '/* ============================================================================',
      '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
      `   Descriptive statistics only - ${esc(instrumentName)}`,
      `   Instrument: ID_INSTRUMENT=${args.instrument}  Construct: ID_CONSTRUCT=${idConstruct}`,
      '   No EFA/CFA/KMO/Bartlett: this instrument has exactly 1 item, so there is no cross-item',
      '   variance to factor-analyze (a "loading" of a single item on its own factor would be a',
      '   trivial 1, not a finding). Generated by describe_single_item_instrument.js.',
      ...(n < 2 || scores.length < 2
        ? ['   STD_DEV row(s) omitted: fewer than 2 respondents, standard deviation is undefined.']
        : []),
      '   ============================================================================ */',
      '',
      '-- ---- Item + named-variable descriptive statistics ----',
      insert('ITEM_MEAN', itemMean, `Raw item mean, the single item behind ${varName}.`, n),
      ...(itemSd !== null ? [insert('ITEM_STD_DEV', itemSd, `Raw item standard deviation, the single item behind ${varName}.`, n)] : []),
      ...(dimMean !== null ? [insert('DIMENSION_MEAN', dimMean, `Mean of ${varName}, read directly from GDX_PSY_VARIABLE_RESULT (identical to ITEM_MEAN here -- single-item variable).`, scores.length)] : []),
      ...(dimSd !== null ? [insert('DIMENSION_STD_DEV', dimSd, `Standard deviation of ${varName}, read directly from GDX_PSY_VARIABLE_RESULT.`, scores.length)] : []),
    ];

    const slug = instrumentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const outPath = path.join(args.outDir, `describe_instrument_${args.instrument}_${slug}.sql`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    console.log(`\nWrote ${outPath} (${lines.filter((l) => l.startsWith('INSERT')).length} INSERT statements).`);
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
