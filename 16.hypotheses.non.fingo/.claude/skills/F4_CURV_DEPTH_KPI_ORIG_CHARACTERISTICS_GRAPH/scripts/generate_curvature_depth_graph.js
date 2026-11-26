#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH
 *
 * Renders the real GDX_HNF_CDI_* rows this project already has -- written by
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS (F4), this folder's fourth skill -- as a standalone HTML
 * page with three cards, built from one chosen GDX_HNF_CDI_RUN:
 *
 *   1. a histogram of every complete-case person's own real CDIx(t)/CDIx_w(t) in that run,
 *   2. a per-feature ranking of the real RMS contribution to that run's own CDI (sqrt(mean over
 *      persons of DIFFERENCE^2) per feature, from GDX_HNF_CDI_VALUE_DETAIL) -- the per-feature
 *      breakdown F4 stores precisely so it is never discarded behind the aggregate scalar,
 *   3. one diverging bar chart per representative person (the run's own lowest CDI, the person
 *      whose CDI sits closest to the run's median, and the highest CDI), showing that real
 *      person's own full per-feature signed difference vector.
 *
 * Never writes to the database -- purely a reader, same posture as this folder's other three
 * graph skills toward F1/F2/F3. Never re-reads 2.relational.model.psychometrics,
 * 6.cardiac.coherence, 7.multidimensional.database or 9.knowledge.graph, and never re-computes a
 * CDI value -- only GDX_HNF_CDI_RUN / GDX_HNF_CDI_RUN_FEATURE / GDX_HNF_CDI_VALUE /
 * GDX_HNF_CDI_VALUE_DETAIL / GDX_HNF_CDI_REFERENCE_SET, already written by F4.
 *
 * Usage:
 *   node generate_curvature_depth_graph.js --study <slug> [--cdi-run-id <id>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>      REQUIRED outside --sample. Same slug F1/F2/F3/F4 use -- resolves to
 *                        GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                        study.title.
 *   --cdi-run-id <id>    optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN instead of the study's
 *                        latest (errors if that run belongs to a different study).
 *   --out-dir <path>     optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>  optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run            computes everything (resolved run, person/feature counts, output
 *                        filename) and logs it, writing no file.
 *   --sample             renders from small, explicitly-labeled embedded synthetic data instead
 *                        of connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderHistogramCard, renderFeatureContributionCard, renderPersonProfileCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = { study: null, cdiRunId: null, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--cdi-run-id') args.cdiRunId = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F2/F3/F4 use), unless --sample is passed.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and ` +
      `export the vars before running this script (or pass --sample to render from embedded sample ` +
      `data with no database connection).`
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

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH/scripts)
 * -- same depth/shape as this folder's other skills' resolveIntakePath(). */
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

function slugifyForFilename(str) {
  return String(str)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}
function timestampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function buildFilename(studySlug, studyTitle, timestamp) {
  return `f4_curvature_depth_index_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string -- same reason as this
 * folder's other graph skills: a plain template-literal interpolation of a Date renders its
 * timezone NAME in the OS's configured locale. */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves which GDX_HNF_CDI_RUN to plot: an explicit --cdi-run-id (validated to belong to this
 * study), or else the latest one for this study. Also resolves the run's own reference set label
 * (for the histogram card's own subtitle). */
async function resolveCdiRun(db, studyId, studyTitle, cdiRunId) {
  const selectSql = `
    SELECT R.ID_CDI_RUN, R.ID_STUDY, R.ID_INPUT_FEATURE_RUN, R.ID_REFERENCE_SET, R.WEIGHTING,
           R.RUN_LABEL, R.FEATURE_COUNT, R.PERSON_COUNT, R.GENERATED_AT,
           S.REFERENCE_TYPE, S.REFERENCE_LABEL
    FROM GDX_HNF_CDI_RUN R
    JOIN GDX_HNF_CDI_REFERENCE_SET S ON S.ID_REFERENCE_SET = R.ID_REFERENCE_SET`;
  if (cdiRunId !== null && cdiRunId !== undefined && !Number.isNaN(cdiRunId)) {
    const rows = await query(db, `${selectSql} WHERE R.ID_CDI_RUN = ?`, [cdiRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_RUN with ID_CDI_RUN=${cdiRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${cdiRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE R.ID_STUDY = ? ORDER BY R.GENERATED_AT DESC, R.ID_CDI_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_CDI_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS --study ${JSON.stringify(studyTitle)} first.`
    );
  }
  return rows[0];
}

async function loadRunFeatures(db, cdiRunId) {
  const rows = await query(db, `
    SELECT F.FEATURE_ORDER, F.ID_FEATURE, F.WEIGHT, D.FEATURE_CODE, D.NAME, P.NAME_EN AS PERSPECTIVE_NAME_EN
    FROM GDX_HNF_CDI_RUN_FEATURE F
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = F.ID_FEATURE
    JOIN GDX_HNF_PERSPECTIVE P ON P.ID_PERSPECTIVE = D.ID_PERSPECTIVE
    WHERE F.ID_CDI_RUN = ?
    ORDER BY F.FEATURE_ORDER`, [cdiRunId]);
  return rows;
}

async function loadCdiValues(db, cdiRunId) {
  const rows = await query(db, `
    SELECT ID_CDI_VALUE, ID_PERSON, CDI_VALUE
    FROM GDX_HNF_CDI_VALUE WHERE ID_CDI_RUN = ? ORDER BY CDI_VALUE`, [cdiRunId]);
  return rows.map((r) => ({ idCdiValue: r.ID_CDI_VALUE, personId: r.ID_PERSON, cdiValue: Number(r.CDI_VALUE) }));
}

/** RMS of each feature's real per-person DIFFERENCE within this run, computed by the database
 * itself (AVG of the squared difference, square-rooted here) -- never re-pulling all detail rows
 * just to aggregate client-side. */
async function loadFeatureRmsContribution(db, cdiRunId) {
  const rows = await query(db, `
    SELECT D.ID_FEATURE, AVG(D.DIFFERENCE * D.DIFFERENCE) AS MEAN_SQ
    FROM GDX_HNF_CDI_VALUE_DETAIL D
    JOIN GDX_HNF_CDI_VALUE V ON V.ID_CDI_VALUE = D.ID_CDI_VALUE
    WHERE V.ID_CDI_RUN = ?
    GROUP BY D.ID_FEATURE`, [cdiRunId]);
  const byFeature = new Map();
  for (const r of rows) byFeature.set(r.ID_FEATURE, Math.sqrt(Number(r.MEAN_SQ)));
  return byFeature;
}

async function loadPersonDetails(db, idCdiValue) {
  const rows = await query(db, `
    SELECT Det.ID_FEATURE, D.FEATURE_CODE, D.NAME, Det.DIFFERENCE
    FROM GDX_HNF_CDI_VALUE_DETAIL Det
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = Det.ID_FEATURE
    WHERE Det.ID_CDI_VALUE = ?
    ORDER BY D.FEATURE_CODE`, [idCdiValue]);
  return rows.map((r) => ({ featureCode: r.FEATURE_CODE, featureName: r.NAME, difference: Number(r.DIFFERENCE) }));
}

/** Picks three representative complete-case persons from an already CDI-ascending-sorted list:
 * the run's own lowest CDI, the one whose CDI sits closest to the run's median, and the highest.
 * When the run has fewer than 3 persons, duplicates collapse naturally (the same person can be
 * shown more than once with a different role label) rather than this skill fabricating a
 * nonexistent fourth case. */
function pickRepresentativePersons(sortedValues) {
  const n = sortedValues.length;
  const lowest = sortedValues[0];
  const highest = sortedValues[n - 1];
  const medianValue = n % 2 === 1 ? sortedValues[(n - 1) / 2].cdiValue : (sortedValues[n / 2 - 1].cdiValue + sortedValues[n / 2].cdiValue) / 2;
  let medianClosest = sortedValues[0];
  let bestDist = Infinity;
  for (const v of sortedValues) {
    const dist = Math.abs(v.cdiValue - medianValue);
    if (dist < bestDist) { bestDist = dist; medianClosest = v; }
  }
  return [
    { ...lowest, roleLabel: 'lowest CDI' },
    { ...medianClosest, roleLabel: 'closest to median CDI' },
    { ...highest, roleLabel: 'highest CDI' },
  ];
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Eight
 * synthetic persons, four synthetic features, enough to exercise every rendering path (histogram
 * spread, feature ranking, three representative-person profiles with both positive and negative
 * differences). */
function buildSampleData() {
  const run = {
    ID_CDI_RUN: 0, RUN_LABEL: 'SAMPLE_RUN (not a real GDX_HNF_CDI_RUN)', WEIGHTING: 'UNWEIGHTED',
    REFERENCE_TYPE: 'STUDY_COHORT', REFERENCE_LABEL: 'SAMPLE_REFERENCE (not real)', GENERATED_AT: new Date(),
  };
  const features = [
    { ID_FEATURE: 1, FEATURE_CODE: 'SAMPLE.PSY.VAR.1', NAME: 'Sample resilience score', PERSPECTIVE_NAME_EN: 'Psychometrics', WEIGHT: 1 },
    { ID_FEATURE: 2, FEATURE_CODE: 'SAMPLE.PSY.VAR.2', NAME: 'Sample adaptability score', PERSPECTIVE_NAME_EN: 'Psychometrics', WEIGHT: 1 },
    { ID_FEATURE: 3, FEATURE_CODE: 'SAMPLE.CC.HRV.RMSSD_MS', NAME: 'Sample RMSSD', PERSPECTIVE_NAME_EN: 'Physiology', WEIGHT: 1 },
    { ID_FEATURE: 4, FEATURE_CODE: 'SAMPLE.CC.HRV.SDNN_MS', NAME: 'Sample SDNN', PERSPECTIVE_NAME_EN: 'Physiology', WEIGHT: 1 },
  ];
  // [diff_f1, diff_f2, diff_f3, diff_f4] per synthetic person -- deliberately varied signs/magnitudes.
  const diffsByPerson = {
    'SAMPLE-1': [0.10, -0.05, 0.20, 0.00],
    'SAMPLE-2': [-0.30, 0.15, -0.10, 0.25],
    'SAMPLE-3': [0.05, 0.05, 0.05, 0.05],
    'SAMPLE-4': [1.20, -0.80, 0.60, -0.40],
    'SAMPLE-5': [-0.60, -0.60, -0.60, -0.60],
    'SAMPLE-6': [0.02, -0.01, 0.03, -0.02],
    'SAMPLE-7': [0.40, 0.40, -0.40, -0.40],
    'SAMPLE-8': [-0.15, 0.25, -0.05, 0.10],
  };
  const values = [];
  const detailsByCdiValue = new Map();
  let idCounter = 1;
  for (const [personId, diffs] of Object.entries(diffsByPerson)) {
    const cdiValue = Math.sqrt(diffs.reduce((a, d) => a + d * d, 0) / diffs.length);
    const idCdiValue = idCounter++;
    values.push({ idCdiValue, personId, cdiValue });
    detailsByCdiValue.set(idCdiValue, features.map((f, i) => ({ featureCode: f.FEATURE_CODE, featureName: f.NAME, difference: diffs[i] })));
  }
  values.sort((a, b) => a.cdiValue - b.cdiValue);
  const featureRms = new Map();
  for (let i = 0; i < features.length; i++) {
    const sq = Object.values(diffsByPerson).map((d) => d[i] * d[i]);
    featureRms.set(features[i].ID_FEATURE, Math.sqrt(sq.reduce((a, b) => a + b, 0) / sq.length));
  }
  return { run, features, values, featureRms, detailsByCdiValue, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, run, features, values, featureRms, representatives, personDetailsByRole, sample }) {
  const histogramCard = renderHistogramCard({
    values, runLabel: run.RUN_LABEL, weighting: run.WEIGHTING,
    referenceLabel: `${run.REFERENCE_TYPE} -- ${run.REFERENCE_LABEL}`, cardId: 'histogram',
  });

  const featureCard = renderFeatureContributionCard({
    features: features.map((f) => ({
      featureCode: f.FEATURE_CODE, featureName: f.NAME, perspectiveName: f.PERSPECTIVE_NAME_EN,
      weight: Number(f.WEIGHT), rmsDiff: featureRms.get(f.ID_FEATURE) ?? 0,
    })),
    weighting: run.WEIGHTING, cardId: 'feature-contribution',
  });

  const personCards = representatives.map((rep, idx) => renderPersonProfileCard({
    personId: rep.personId, cdiValue: rep.cdiValue, roleLabel: rep.roleLabel,
    details: personDetailsByRole[idx], cardId: `person-${idx}`,
  }));

  const title = `Curvature Depth Index (CDI) -- ${studyTitle}`;
  const description =
    `CDIx is an RMS displacement between a person's own real, normalized profile and this run's ` +
    `explicit reference -- never the scalar curvature of a manifold, never evidence of a causal ` +
    `mechanism or a clinical condition. Every value plotted below is a real ` +
    `<code>GDX_HNF_CDI_VALUE</code>/<code>GDX_HNF_CDI_VALUE_DETAIL</code> row for this study and run.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `CDI run: ${run.RUN_LABEL}${run.ID_CDI_RUN ? ` (ID_CDI_RUN=${run.ID_CDI_RUN})` : ''}, weighting=${run.WEIGHTING}, reference=${run.REFERENCE_TYPE} ("${run.REFERENCE_LABEL}"), generated ${formatTimestampUtc(run.GENERATED_AT)}.`,
    `Features in this run: ${features.length}. Complete-case persons: ${values.length}.`,
    'A larger CDI means a larger normalized displacement from the chosen reference -- never, by itself, a "worse" condition, and carries no fixed upper bound under a z-score input.',
  ].filter(Boolean);

  return pageShell({
    title, description, metaLines,
    bodyHtml: [histogramCard, featureCard, ...personCards].join('\n'),
    script: hookTooltips(),
  });
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
  const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..', 'output');
  const timestamp = timestampForFilename(new Date());

  if (args.sample) {
    const sampleData = buildSampleData();
    const intake = loadIntake(args);
    const studyTitle = (intake && intake.study && intake.study.title) || sampleData.studyTitle;
    const representatives = pickRepresentativePersons(sampleData.values);
    const personDetailsByRole = representatives.map((r) => sampleData.detailsByCdiValue.get(r.idCdiValue));
    const html = buildPageHtml({
      studyTitle, study: args.study || 'sample', run: sampleData.run, features: sampleData.features,
      values: sampleData.values, featureRms: sampleData.featureRms, representatives, personDetailsByRole, sample: true,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.features.length} feature(s), ${sampleData.values.length} person(s).`);
    if (args.dryRun) { console.log(`[DRY RUN] Would write ${path.join(outDir, filename)}`); return; }
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Wrote ${outPath}`);
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
    const run = await resolveCdiRun(db, studyId, studyTitle, args.cdiRunId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). CDI run "${run.RUN_LABEL}" (ID_CDI_RUN=${run.ID_CDI_RUN}), weighting=${run.WEIGHTING}, reference=${run.REFERENCE_TYPE}.`);

    const features = await loadRunFeatures(db, run.ID_CDI_RUN);
    if (features.length === 0) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${run.ID_CDI_RUN} has no GDX_HNF_CDI_RUN_FEATURE rows -- nothing to plot.`);

    const values = await loadCdiValues(db, run.ID_CDI_RUN);
    if (values.length === 0) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${run.ID_CDI_RUN} has no GDX_HNF_CDI_VALUE rows -- nothing to plot.`);

    const featureRms = await loadFeatureRmsContribution(db, run.ID_CDI_RUN);

    const representatives = pickRepresentativePersons(values);
    const personDetailsByRole = [];
    for (const rep of representatives) personDetailsByRole.push(await loadPersonDetails(db, rep.idCdiValue));

    console.log(`Features: ${features.length}. Complete-case persons: ${values.length}. Representative persons: ${representatives.map((r) => `#${r.personId} (${r.roleLabel})`).join(', ')}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, run, features, values, featureRms, representatives, personDetailsByRole, sample: false });
    const filename = buildFilename(args.study, studyTitle, timestamp);
    const outPath = path.join(outDir, filename);

    if (args.dryRun) {
      console.log(`[DRY RUN] Would write ${outPath}`);
      return;
    }
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Wrote ${outPath}`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
