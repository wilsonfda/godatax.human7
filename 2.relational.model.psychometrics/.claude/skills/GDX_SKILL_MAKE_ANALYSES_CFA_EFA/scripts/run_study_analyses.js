#!/usr/bin/env node
/**
 * Orchestrator for GDX_SKILL_MAKE_ANALYSES_CFA_EFA -- runs every applicable
 * track (A/B/C) for every instrument actually used by one study, instead of
 * requiring one `--instrument <ID>` invocation per instrument.
 *
 * 1. Resolves `--study <slug>` to GDX_PSY_STUDY.ID_STUDY (same intake.json
 *    lookup the other --study-scoped skills use: GDX_SKILL_GODATAX_HUMAN7_BY_SPU,
 *    GDX_SKILL_MAKE_DASHBOARS_DW, GDX_SKILL_LOAD_NEW_STUDY_DW).
 * 2. Queries GDX_PSY_APPLICATION for the distinct instruments this study
 *    actually has responses for, and each one's application count (n).
 * 3. Routes each instrument to its track the same way this skill's own
 *    SKILL.md does: ID_INSTRUMENT=3 -> Track A (CAAS), exactly 1 item ->
 *    Track C (descriptive only), everything else -> Track B (discovered
 *    grouping, EFA + CFA).
 * 4. Runs each track's stage(s) as a child process, passing --study <slug>
 *    through to the fetch/discovery stage so results are scoped to this
 *    study's own applications, not every study in the database. Python
 *    stages (CFA/EFA) take no --study of their own -- they read the CSV/JSON
 *    the Node stage already scoped.
 *
 * Does NOT run the small-n math itself: an instrument with too few
 * respondents for a stable factor model is not silently skipped by some
 * arbitrary threshold here -- the stage scripts are always invoked, and
 * whatever they report (a real fit, a solver error, an "n=1, no variance"
 * outcome) is captured and shown honestly in the final summary. This matches
 * the rest of the skill's own philosophy (see Track B's CFI 0.64 case in
 * SKILL.md): an honest failure or a weak fit is information, not something to
 * hide by refusing to try.
 *
 * Does NOT load anything into Firebird -- it only generates output/*.sql
 * files, same as running each track by hand. Loading (execute_afc_property_load.js /
 * load_property_file.js) is a separate, explicitly-confirmed step per SKILL.md.
 *
 * Usage:
 *   node run_study_analyses.js --study <slug> [--intake-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study) throw new Error('--study <slug> is required.');
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
async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  return rows[0].ID_STUDY;
}

/** Runs one child process step; never throws -- returns { ok, status } so the
 * caller can keep going to the next instrument/step and report honestly. */
function runStep(label, cmd, cmdArgs) {
  console.log(`\n--- ${label}: ${cmd} ${cmdArgs.join(' ')} ---`);
  const result = spawnSync(cmd, cmdArgs, { cwd: __dirname, stdio: 'inherit' });
  if (result.error) {
    console.error(`  FAILED to launch: ${result.error.message}`);
    return { ok: false, status: `launch error: ${result.error.message}` };
  }
  if (result.status !== 0) {
    console.error(`  FAILED (exit code ${result.status}).`);
    return { ok: false, status: `exit ${result.status}` };
  }
  return { ok: true, status: 'ok' };
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));

  const options = {
    host: requireEnv('GDX_HUMAN_FB_HOST'), port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'), user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'), lowercase_keys: false, role: null, pageSize: 4096,
  };

  const intake = loadIntake(args);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  let instruments;
  try {
    const studyId = await resolveStudyId(db, studyTitle, args.study);
    console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);

    const usedRows = await query(db, `
      SELECT a.ID_INSTRUMENT, i.NAME, COUNT(*) AS N
      FROM GDX_PSY_APPLICATION a
      JOIN GDX_PSY_INSTRUMENT i ON i.ID_INSTRUMENT = a.ID_INSTRUMENT
      WHERE a.ID_STUDY = ?
      GROUP BY a.ID_INSTRUMENT, i.NAME
      ORDER BY a.ID_INSTRUMENT`, [studyId]);
    if (usedRows.length === 0) {
      console.log(`No GDX_PSY_APPLICATION rows for study "${studyTitle}" -- nothing to analyze.`);
      return;
    }

    instruments = [];
    for (const r of usedRows) {
      const itemCountRows = await query(db, 'SELECT COUNT(*) AS C FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ?', [r.ID_INSTRUMENT]);
      const itemCount = itemCountRows[0].C;
      const track = r.ID_INSTRUMENT === 3 ? 'A' : itemCount === 1 ? 'C' : 'B';
      instruments.push({ id: r.ID_INSTRUMENT, name: r.NAME, n: r.N, itemCount, track });
    }
  } finally {
    db.detach();
  }

  console.log(`\nInstruments used by study "${studyTitle}" (slug "${args.study}"):`);
  for (const inst of instruments) {
    console.log(`  ID_INSTRUMENT=${inst.id} ("${inst.name}"): ${inst.itemCount} item(s), n=${inst.n} application(s) -> Track ${inst.track}`);
  }

  const summary = [];
  for (const inst of instruments) {
    const steps = [];
    if (inst.track === 'A') {
      steps.push(runStep(`Instrument ${inst.id} fetch (Track A)`, 'node', ['fetch_career_adaptability_items.js', '--study', args.study]));
      if (steps[steps.length - 1].ok) {
        steps.push(runStep(`Instrument ${inst.id} CFA (Track A)`, 'python', ['run_cfa_from_db.py']));
        steps.push(runStep(`Instrument ${inst.id} EFA (Track A)`, 'python', ['run_efa_from_db.py']));
      }
    } else if (inst.track === 'C') {
      steps.push(runStep(`Instrument ${inst.id} describe (Track C)`, 'node', ['describe_single_item_instrument.js', '--instrument', String(inst.id), '--study', args.study]));
    } else {
      steps.push(runStep(`Instrument ${inst.id} discovery (Track B)`, 'node', ['analyze_instrument.js', '--instrument', String(inst.id), '--study', args.study]));
      if (steps[steps.length - 1].ok) {
        steps.push(runStep(`Instrument ${inst.id} EFA (Track B)`, 'python', ['run_efa_generic.py', '--instrument', String(inst.id)]));
        steps.push(runStep(`Instrument ${inst.id} CFA (Track B)`, 'python', ['run_cfa_generic.py', '--instrument', String(inst.id)]));
      }
    }
    summary.push({ inst, steps });
  }

  console.log(`\n=== Summary: study "${studyTitle}" (slug "${args.study}") ===`);
  for (const { inst, steps } of summary) {
    const allOk = steps.every((s) => s.ok);
    console.log(`  Instrument ${inst.id} ("${inst.name}"), Track ${inst.track}, n=${inst.n}: ${allOk ? 'OK' : 'INCOMPLETE'} (${steps.map((s) => s.status).join(', ')})`);
  }
  const anyFailed = summary.some(({ steps }) => steps.some((s) => !s.ok));
  if (anyFailed) {
    console.log('\nOne or more steps failed above -- see their own output for the reason (commonly: too few ' +
      'respondents for a stable factor model). Nothing was loaded into Firebird either way -- review ' +
      'output/*.sql, then use load_property_file.js / execute_afc_property_load.js to load, per SKILL.md.');
    process.exitCode = 1;
  } else {
    console.log('\nAll tracks completed. Nothing was loaded into Firebird -- review output/*.sql, then use ' +
      'load_property_file.js / execute_afc_property_load.js to load, per SKILL.md.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
