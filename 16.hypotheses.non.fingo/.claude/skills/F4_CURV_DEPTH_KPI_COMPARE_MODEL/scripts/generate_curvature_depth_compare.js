#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_COMPARE_MODEL
 *
 * Pairs the real outputs of this folder's two F4 skills -- CDIx (GDX_HNF_CDI_VALUE, written by
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS, original normalized feature space) and CDIh
 * (GDX_HNF_CDIH_VALUE, written by F4_CURV_DEPTH_KPI_LATENT_SPACE, fitted latent space) -- for one
 * chosen GDX_HNF_CDI_RUN and one chosen GDX_HNF_CDIH_RUN of the same study, and freezes the
 * result into GDX_HNF_CDI_COMPARE_RUN / GDX_HNF_CDI_COMPARE_VALUE
 * (hypotheses_non_fingo_curvature_depth_index_compare_model_firebird25.sql, this folder).
 *
 * A person contributes only if present in BOTH source runs -- a person in only one of the two is
 * excluded from the pairing and counted (EXCLUDED_CDI_ONLY_COUNT / EXCLUDED_CDIH_ONLY_COUNT),
 * never imputed. This module never recomputes CDIx or CDIh themselves, and never computes a
 * derived statistic (Pearson r, rank, "representative person") -- those are lightweight,
 * deterministic descriptive statistics of the two already-frozen numbers this module writes,
 * left to this module's own GRAPH sibling (F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH) to compute at
 * render time, the same posture F3's/F4's own GRAPH skills already take toward their own
 * lightweight render-time statistics.
 *
 * Usage:
 *   node generate_curvature_depth_compare.js --study <slug>
 *     [--cdi-run-id <id>] [--cdih-run-id <id>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>       REQUIRED outside --sample. Same slug F1/F2/F3/F4/F4-alternative use --
 *                         resolves to GDX_PSY_STUDY.ID_STUDY via
 *                         new_study_intake/<slug>/intake.json's study.title.
 *   --cdi-run-id <id>     optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN instead of the study's
 *                         latest (errors if that run belongs to a different study).
 *   --cdih-run-id <id>    optional. A specific GDX_HNF_CDIH_RUN.ID_CDIH_RUN instead of the study's
 *                         latest (errors if that run belongs to a different study).
 *   --intake-dir <path>   optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run             computes the pairing (paired/excluded counts) and logs it, writing no
 *                         row.
 *   --sample              prints this project's own worked numeric example (CDIx ~= 0.1732 vs.
 *                         CDIh ~= 0.1458, section 7.1 of this folder's design document) -- no DB,
 *                         writes nothing.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = { study: null, cdiRunId: null, cdihRunId: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--cdi-run-id') args.cdiRunId = parseInt(argv[++i], 10);
    else if (a === '--cdih-run-id') args.cdihRunId = parseInt(argv[++i], 10);
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F2/F3/F4/F4-alternative use), unless --sample is passed.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and ` +
      `export the vars before running this script (or pass --sample to print the worked numeric ` +
      `example with no database connection).`
    );
  }
  return v;
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
/** node-firebird returns an INSERT...RETURNING result as a plain object, not an array of rows
 * the way a SELECT does -- normalizes both shapes to one row object. */
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_COMPARE_MODEL/scripts) -- same
 * depth/shape as this folder's other skills' resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
  if (!args.study && !args.intakeDir) return null;
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) return null;
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves which GDX_HNF_CDI_RUN to pair: an explicit --cdi-run-id (validated to belong to this
 * study), or else the latest one for this study. */
async function resolveCdiRun(db, studyId, studyTitle, cdiRunId) {
  const selectSql = `SELECT ID_CDI_RUN, ID_STUDY, RUN_LABEL FROM GDX_HNF_CDI_RUN`;
  if (cdiRunId !== null && cdiRunId !== undefined && !Number.isNaN(cdiRunId)) {
    const rows = await query(db, `${selectSql} WHERE ID_CDI_RUN = ?`, [cdiRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_RUN with ID_CDI_RUN=${cdiRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${cdiRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_CDI_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_CDI_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS --study ${JSON.stringify(studyTitle)} first.`);
  }
  return rows[0];
}

/** Resolves which GDX_HNF_CDIH_RUN to pair: an explicit --cdih-run-id (validated to belong to
 * this study), or else the latest one for this study. */
async function resolveCdihRun(db, studyId, studyTitle, cdihRunId) {
  const selectSql = `SELECT ID_CDIH_RUN, ID_STUDY, RUN_LABEL FROM GDX_HNF_CDIH_RUN`;
  if (cdihRunId !== null && cdihRunId !== undefined && !Number.isNaN(cdihRunId)) {
    const rows = await query(db, `${selectSql} WHERE ID_CDIH_RUN = ?`, [cdihRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDIH_RUN with ID_CDIH_RUN=${cdihRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${cdihRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_CDIH_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_CDIH_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_LATENT_SPACE --study ${JSON.stringify(studyTitle)} first.`);
  }
  return rows[0];
}

async function loadCdiValues(db, cdiRunId) {
  const rows = await query(db, `SELECT ID_PERSON, CDI_VALUE FROM GDX_HNF_CDI_VALUE WHERE ID_CDI_RUN = ?`, [cdiRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdiValue: Number(r.CDI_VALUE) }));
}
async function loadCdihValues(db, cdihRunId) {
  const rows = await query(db, `SELECT ID_PERSON, CDIH_VALUE FROM GDX_HNF_CDIH_VALUE WHERE ID_CDIH_RUN = ?`, [cdihRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdihValue: Number(r.CDIH_VALUE) }));
}

/** Pairs two independently-fetched value lists by ID_PERSON. A person in only one list is
 * excluded from the pairing entirely and counted (never imputed, never silently dropped without
 * being reported). Returns { paired: [{personId,cdiValue,cdihValue}], excludedCdiOnly,
 * excludedCdihOnly } where excludedCdiOnly/excludedCdihOnly are the counts of persons present in
 * that one source run only. */
function pairByPerson(cdiValues, cdihValues) {
  const cdihByPerson = new Map(cdihValues.map((v) => [v.personId, v.cdihValue]));
  const cdiPersonIds = new Set(cdiValues.map((v) => v.personId));
  const paired = [];
  let excludedCdiOnly = 0;
  for (const v of cdiValues) {
    if (cdihByPerson.has(v.personId)) {
      paired.push({ personId: v.personId, cdiValue: v.cdiValue, cdihValue: cdihByPerson.get(v.personId) });
    } else {
      excludedCdiOnly += 1;
    }
  }
  const excludedCdihOnly = cdihValues.filter((v) => !cdiPersonIds.has(v.personId)).length;
  return { paired, excludedCdiOnly, excludedCdihOnly };
}

function isoForLabel(d) {
  return d.toISOString().replace(/[:.]/g, '-');
}

async function insertCompareRun(db, { studyId, cdiRun, cdihRun, pairedCount, excludedCdiOnly, excludedCdihOnly }) {
  const runLabel = `${studyId}_CDICOMPARE_${cdiRun.ID_CDI_RUN}x${cdihRun.ID_CDIH_RUN}_${isoForLabel(new Date())}`;
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_CDI_COMPARE_RUN
      (ID_STUDY, ID_CDI_RUN, ID_CDIH_RUN, RUN_LABEL, PAIRED_PERSON_COUNT, EXCLUDED_CDI_ONLY_COUNT, EXCLUDED_CDIH_ONLY_COUNT, GENERATED_BY)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ID_COMPARE_RUN`,
    [studyId, cdiRun.ID_CDI_RUN, cdihRun.ID_CDIH_RUN, runLabel, pairedCount, excludedCdiOnly, excludedCdihOnly, 'F4_CURV_DEPTH_KPI_COMPARE_MODEL']));
  return { id: row.ID_COMPARE_RUN, runLabel };
}

async function insertCompareValues(db, compareRunId, paired) {
  for (const p of paired) {
    await query(db, `
      INSERT INTO GDX_HNF_CDI_COMPARE_VALUE (ID_COMPARE_RUN, ID_PERSON, CDI_VALUE, CDIH_VALUE)
      VALUES (?, ?, ?, ?)`,
      [compareRunId, p.personId, p.cdiValue, p.cdihValue]);
  }
}

/** This project's own worked numeric example (GoDataX_Human7ph_Matematica_Completo.docx, section
 * 7.1 "Exemplo numerico completo e comparacao"): CDIx computed on five original features,
 * compared against a deliberately simple, untrained two-dimension "latent" transform -- NOT a
 * fitted PCA/autoencoder/UMAP, purely illustrative. Printed only for --sample; never written
 * anywhere, never connects to the database. */
function printWorkedExample() {
  const z = [0.8, 0.6, 0.4, 0.7, 0.5];
  const zRef = [0.5, 0.5, 0.5, 0.5, 0.5];
  const diffs = z.map((v, i) => v - zRef[i]);
  const cdix = Math.sqrt(diffs.reduce((a, d) => a + d * d, 0) / diffs.length);

  const h = [(z[0] + z[1]) / 2, (z[2] + z[3]) / 2];
  const hRef = [(zRef[0] + zRef[1]) / 2, (zRef[2] + zRef[3]) / 2];
  const hDiffs = h.map((v, i) => v - hRef[i]);
  const cdih = Math.sqrt(hDiffs.reduce((a, d) => a + d * d, 0) / hDiffs.length);

  console.log('[SAMPLE] Worked numeric example (section 7.1 of this folder\'s design document):');
  console.log(`  z (5 original features)        = [${z.join(', ')}]`);
  console.log(`  z_ref                           = [${zRef.join(', ')}]`);
  console.log(`  CDIx = sqrt(mean((z - z_ref)^2)) = ${cdix.toFixed(4)}`);
  console.log(`  h = [(z1+z2)/2, (z3+z4)/2] (illustrative transform, NOT a trained PCA/autoencoder/UMAP; z5 excluded)`);
  console.log(`    h                              = [${h.map((v) => v.toFixed(2)).join(', ')}]`);
  console.log(`    h_ref                          = [${hRef.map((v) => v.toFixed(2)).join(', ')}]`);
  console.log(`  CDIh = sqrt(mean((h - h_ref)^2)) = ${cdih.toFixed(4)}`);
  console.log('');
  console.log(`  CDIx=${cdix.toFixed(4)} and CDIh=${cdih.toFixed(4)} are NOT directly interchangeable -- they`);
  console.log('  depend on different spaces and scales. A smaller CDIh does not mean improvement, lower');
  console.log('  anomaly, or algorithm superiority. The appropriate comparison is to test the STABILITY');
  console.log('  and ASSOCIATION of each indicator against externally defined outcomes -- exactly what');
  console.log('  this module\'s GRAPH sibling computes (Pearson r) from real, paired GDX_HNF_CDI_COMPARE_VALUE');
  console.log('  rows, never from a single illustrative pair like this one.');
  console.log('');
  console.log('  This is a sanity check only -- no database connection, nothing written. Run without');
  console.log('  --sample, with --study <slug>, to pair this project\'s own real CDIx/CDIh runs.');
}

async function main() {
  try {
    await assertAccountRegistered();
  } catch (err) {
    console.error(err.message);
    process.exit(
      err instanceof AccountNotRegisteredError ? 2 :
      err instanceof NoInternetConnectionError ? 3 :
      err instanceof AccountEmailUnknownError ? 4 : 1
    );
  }

  const args = parseArgs(process.argv);

  if (args.sample) {
    printWorkedExample();
    return;
  }

  const intake = loadIntake(args);
  if (!intake || !intake.study || !intake.study.title) {
    throw new Error(`intake.json not found or missing study.title for study slug "${args.study}". Run GDX_SKILL_NEW_STUDY first, or pass --intake-dir.`);
  }
  const studyTitle = intake.study.title;

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
    const studyId = await resolveStudyId(db, studyTitle, args.study);

    const cdiRun = await resolveCdiRun(db, studyId, studyTitle, args.cdiRunId);
    const cdihRun = await resolveCdihRun(db, studyId, studyTitle, args.cdihRunId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). CDIx run "${cdiRun.RUN_LABEL}" (ID_CDI_RUN=${cdiRun.ID_CDI_RUN}) vs. CDIh run "${cdihRun.RUN_LABEL}" (ID_CDIH_RUN=${cdihRun.ID_CDIH_RUN}).`);

    const cdiValues = await loadCdiValues(db, cdiRun.ID_CDI_RUN);
    if (cdiValues.length === 0) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${cdiRun.ID_CDI_RUN} has no GDX_HNF_CDI_VALUE rows -- nothing to pair.`);
    const cdihValues = await loadCdihValues(db, cdihRun.ID_CDIH_RUN);
    if (cdihValues.length === 0) throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${cdihRun.ID_CDIH_RUN} has no GDX_HNF_CDIH_VALUE rows -- nothing to pair.`);

    const { paired, excludedCdiOnly, excludedCdihOnly } = pairByPerson(cdiValues, cdihValues);
    if (paired.length === 0) {
      throw new Error(
        `No person is present in BOTH GDX_HNF_CDI_RUN ID_CDI_RUN=${cdiRun.ID_CDI_RUN} and ` +
        `GDX_HNF_CDIH_RUN ID_CDIH_RUN=${cdihRun.ID_CDIH_RUN} -- nothing to pair. Choose a ` +
        `different pair of runs with --cdi-run-id/--cdih-run-id.`
      );
    }

    console.log(`Paired persons: ${paired.length}. Excluded (CDIx run only): ${excludedCdiOnly}. Excluded (CDIh run only): ${excludedCdihOnly}.`);

    if (args.dryRun) {
      console.log('[DRY RUN] Would insert 1 GDX_HNF_CDI_COMPARE_RUN row and ' + paired.length + ' GDX_HNF_CDI_COMPARE_VALUE row(s).');
      return;
    }

    const { id: compareRunId, runLabel } = await insertCompareRun(db, {
      studyId, cdiRun, cdihRun, pairedCount: paired.length, excludedCdiOnly, excludedCdihOnly,
    });
    await insertCompareValues(db, compareRunId, paired);

    console.log(`Wrote GDX_HNF_CDI_COMPARE_RUN ID_COMPARE_RUN=${compareRunId} ("${runLabel}") and ${paired.length} GDX_HNF_CDI_COMPARE_VALUE row(s).`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
