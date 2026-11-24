#!/usr/bin/env node
/**
 * F1_GDX_SKILL_MFS_GRAPH
 *
 * Renders the real feature-space z-score data this project already has -- the GDX_HNF_* tables
 * written by F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS), this folder's first skill -- as a
 * standalone HTML page, one chart card per feature, using as its template figure 3.F1 from
 * GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataX_Human7ph_Documento_Unificado_Completo.docx, section 3
 * ("F1 -- Normalizacao e comparabilidade"): "Figura -- Curva de referencia e observacao em escala
 * z; valores apenas ilustrativos" (word/media/image2.png) -- a standard normal reference curve, a
 * dashed line at the reference mean (z=0), and one solid rule at one illustrative observation
 * (z=1.35).
 *
 * The key difference from that figure: every mark this script draws is a real
 * GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE row for the study passed via --study, never a
 * placeholder/illustrative number (CLAUDE.md "Never invent missing data"). A study typically has
 * many real observations per feature (one per participant with a non-missing value in that run),
 * not one -- each is drawn as its own solid rule, so the chart becomes a reference curve plus a
 * rug of real observations rather than a single illustrative point.
 *
 * Only runs with NORMALIZATION_METHOD='ZSCORE' are eligible: the standard normal reference curve
 * is only the correct reference distribution for a z-score ("escala z"). A MINMAX run (values in
 * an arbitrary [a,b]) or a ROBUST run (median/IQR-centered, not necessarily normal-shaped) would
 * make the shared N(0,1) curve this script draws meaningless for that run's own values -- run MFS
 * with its default --normalization zscore (or no --normalization flag at all) first.
 *
 * Usage:
 *   node generate_mfs_graph.js --study <slug> [--run-id <id>] [--feature <code-substring>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>     REQUIRED. Same slug GDX_SKILL_NEW_STUDY/F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE
 *                       use -- resolves to GDX_PSY_STUDY.ID_STUDY via
 *                       new_study_intake/<slug>/intake.json's study.title.
 *   --run-id <id>       optional. Plot a specific GDX_HNF_FEATURE_SPACE_RUN.ID_RUN instead of the
 *                       latest ZSCORE run for this study (errors if that run is not ZSCORE, or
 *                       belongs to a different study).
 *   --feature <text>    optional. Only features whose FEATURE_CODE contains this text
 *                       (case-insensitive), e.g. --feature "CC.HRV" for physiology-only.
 *   --out-dir <path>    optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path> optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run           computes and logs everything (features, observation counts, output
 *                       filename), writes no file.
 *   --sample            renders from embedded, clearly-labeled sample data instead of connecting
 *                       to Firebird -- lets the rendering logic be checked with no live database.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderZScaleCard, emptyCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = { study: null, runId: null, feature: null, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study) {
    throw new Error('--study <slug> is required (same slug GDX_SKILL_NEW_STUDY/F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE use).');
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
 * script (16.hypotheses.non.fingo/.claude/skills/F1_GDX_SKILL_MFS_GRAPH/scripts) -- same depth/shape
 * as F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE's resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
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
  return `f1_mfs_graph_reference_curve_zscale__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string. Date.prototype.toString()
 * (what template-literal interpolation of a Date would otherwise call) renders its timezone NAME
 * in the OS's configured locale (e.g. "Hora padrão da Europa Ocidental" on a pt-PT/pt-BR machine)
 * -- this keeps every timestamp shown on the generated page in English regardless of the host OS. */
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

/** Resolves which GDX_HNF_FEATURE_SPACE_RUN to plot: an explicit --run-id (validated to belong
 * to this study and be NORMALIZATION_METHOD='ZSCORE'), or else the latest ZSCORE run for this
 * study. Only a ZSCORE run's NORMALIZED_VALUE is literally "escala z" -- the standard normal
 * reference curve this script draws is only correct for that method (see file header). */
async function resolveRun(db, studyId, studyTitle, runId) {
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `
      SELECT ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, FEATURE_COUNT, PERSON_COUNT, SOURCES_USED, GENERATED_AT
      FROM GDX_HNF_FEATURE_SPACE_RUN WHERE ID_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_FEATURE_SPACE_RUN with ID_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    if (run.NORMALIZATION_METHOD !== 'ZSCORE') {
      throw new Error(
        `GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} used NORMALIZATION_METHOD='${run.NORMALIZATION_METHOD}', not 'ZSCORE' -- ` +
        `the standard normal reference curve this skill draws (figure 3.F1's template) is only valid for a z-score run. ` +
        `Run F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE with --normalization zscore (its default) for this study first, or pass a different --run-id.`
      );
    }
    return run;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, FEATURE_COUNT, PERSON_COUNT, SOURCES_USED, GENERATED_AT
    FROM GDX_HNF_FEATURE_SPACE_RUN
    WHERE ID_STUDY = ? AND NORMALIZATION_METHOD = 'ZSCORE'
    ORDER BY GENERATED_AT DESC, ID_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE' found for study "${studyTitle}". Run ` +
      `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE --study ${JSON.stringify(studyTitle)} first (zscore is its default normalization).`
    );
  }
  return rows[0];
}

async function loadRunFeatures(db, runId, featureFilter) {
  const rows = await query(db, `
    SELECT M.FEATURE_ORDER, D.ID_FEATURE, D.FEATURE_CODE, D.NAME, D.MEASUREMENT_UNIT, D.SCALE_DIRECTION, P.NAME_EN AS PERSPECTIVE_NAME_EN
    FROM GDX_HNF_FEATURE_RUN_MEMBER M
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = M.ID_FEATURE
    JOIN GDX_HNF_PERSPECTIVE P ON P.ID_PERSPECTIVE = D.ID_PERSPECTIVE
    WHERE M.ID_RUN = ?
    ORDER BY M.FEATURE_ORDER`, [runId]);
  if (!featureFilter) return rows;
  const needle = featureFilter.toLowerCase();
  return rows.filter((r) => String(r.FEATURE_CODE).toLowerCase().includes(needle));
}

async function loadNormalizationParams(db, runId) {
  const rows = await query(db, `
    SELECT ID_FEATURE, PARAM_1, PARAM_2, SAMPLE_SIZE
    FROM GDX_HNF_NORMALIZATION_PARAM WHERE ID_RUN = ?`, [runId]);
  const byFeature = new Map();
  for (const r of rows) byFeature.set(r.ID_FEATURE, { mean: Number(r.PARAM_1), std: Number(r.PARAM_2), sampleSize: r.SAMPLE_SIZE });
  return byFeature;
}

/** Only non-missing, non-null z-scores -- a missing raw value (IS_MISSING=1) never gets a
 * fabricated rule, and a feature this run could not normalize (zero variance/insufficient
 * sample) has NORMALIZED_VALUE left NULL for every row, per CLAUDE.md "Never invent missing data"
 * and MFS's own F1 contract. */
async function loadFeatureValues(db, runId) {
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, RAW_VALUE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_FEATURE, ID_PERSON`, [runId]);
  const byFeature = new Map();
  for (const r of rows) {
    if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, []);
    byFeature.get(r.ID_FEATURE).push({ personId: r.ID_PERSON, rawValue: Number(r.RAW_VALUE), zValue: Number(r.NORMALIZED_VALUE) });
  }
  return byFeature;
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study, same
 * convention GDX_SKILL_MAKE_DASHBOARS_DW's --sample uses. Shapes two illustrative features (one
 * Psi, one Phi) with a handful of observations each, enough to exercise every rendering path
 * (reference curve, mean line, multiple overlapping observation rules, legend, table fallback). */
function buildSampleData() {
  const run = { ID_RUN: 0, RUN_LABEL: 'SAMPLE_RUN (not a real GDX_HNF_FEATURE_SPACE_RUN)', NORMALIZATION_METHOD: 'ZSCORE', GENERATED_AT: new Date() };
  const features = [
    { FEATURE_ORDER: 1, ID_FEATURE: 1001, FEATURE_CODE: 'SAMPLE.PSY.VAR.1', NAME: 'Sample resilience score', MEASUREMENT_UNIT: null, SCALE_DIRECTION: 'HIGHER_BETTER', PERSPECTIVE_NAME_EN: 'Psychometrics' },
    { FEATURE_ORDER: 2, ID_FEATURE: 1002, FEATURE_CODE: 'SAMPLE.CC.HRV.RMSSD_MS', NAME: 'Sample RMSSD', MEASUREMENT_UNIT: 'ms', SCALE_DIRECTION: 'UNDEFINED', PERSPECTIVE_NAME_EN: 'Physiology' },
  ];
  const rawA = [7.0, 5.0, 6.0, 8.0, 4.0, 6.5, 7.5];
  const rawB = [42.0, 38.0, 50.0, 45.0, 36.0];
  function zOf(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
    const std = Math.sqrt(variance);
    return { mean, std, z: values.map((v) => (v - mean) / std) };
  }
  const statsA = zOf(rawA);
  const statsB = zOf(rawB);
  const valuesByFeature = new Map([
    [1001, rawA.map((v, i) => ({ personId: `SAMPLE-${i + 1}`, rawValue: v, zValue: statsA.z[i] }))],
    [1002, rawB.map((v, i) => ({ personId: `SAMPLE-${i + 1}`, rawValue: v, zValue: statsB.z[i] }))],
  ]);
  const paramsByFeature = new Map([
    [1001, { mean: statsA.mean, std: statsA.std, sampleSize: rawA.length }],
    [1002, { mean: statsB.mean, std: statsB.std, sampleSize: rawB.length }],
  ]);
  return { run, features, valuesByFeature, paramsByFeature, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, run, features, valuesByFeature, paramsByFeature, sample }) {
  let plottedCount = 0;
  const cards = features.map((f) => {
    const observations = valuesByFeature.get(f.ID_FEATURE) || [];
    if (observations.length === 0) {
      const hasParam = paramsByFeature.has(f.ID_FEATURE);
      const reason = hasParam
        ? 'this feature was normalized in this run, but no observation row with a non-null z-score was found.'
        : 'not normalized in this run (insufficient sample size or zero variance in this run’s own study sample) -- see this run’s GDX_HNF_FEATURE_SPACE_RUN.NOTES.';
      return emptyCard({ featureCode: f.FEATURE_CODE, featureName: f.NAME, perspectiveName: f.PERSPECTIVE_NAME_EN, reason });
    }
    plottedCount += 1;
    return renderZScaleCard({
      featureCode: f.FEATURE_CODE,
      featureName: f.NAME,
      perspectiveName: f.PERSPECTIVE_NAME_EN,
      unit: f.MEASUREMENT_UNIT,
      direction: f.SCALE_DIRECTION,
      observations,
      refParams: paramsByFeature.get(f.ID_FEATURE) || null,
      cardId: `feat-${f.ID_FEATURE}`,
    });
  });

  const title = `Reference curve and observations in z-scale -- ${studyTitle}`;
  const description =
    `For each feature in this run, the reference distribution is the standard normal (every ` +
    `value is already this run's own z-score, mean&nbsp;0 / std&nbsp;1 by construction), plotted ` +
    `with a dashed line at the reference mean and one solid rule per real, non-missing observation. ` +
    `Every rule drawn below comes from a real <code>GDX_HNF_FEATURE_VALUE</code> row for this study ` +
    `and run -- never an illustrative placeholder.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `Run: ${run.RUN_LABEL}${run.ID_RUN ? ` (ID_RUN=${run.ID_RUN})` : ''}, normalization method ${run.NORMALIZATION_METHOD}, generated ${formatTimestampUtc(run.GENERATED_AT)}`,
    `Features with a plotted reference curve: ${plottedCount} of ${features.length} in this run${features.length !== plottedCount ? ' (the rest are listed below with the reason they have no curve)' : ''}.`,
    'A position in z-scale is not diagnostic -- its meaning depends on the population, instrument and context the reference mean/std were computed from.',
  ].filter(Boolean);

  return pageShell({
    title,
    description,
    metaLines,
    bodyHtml: cards.join('\n'),
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
  const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..');
  const timestamp = timestampForFilename(new Date());

  if (args.sample) {
    const sampleData = buildSampleData();
    const intake = loadIntake(args);
    const studyTitle = (intake && intake.study && intake.study.title) || sampleData.studyTitle;
    const html = buildPageHtml({
      studyTitle, study: args.study, run: sampleData.run, features: sampleData.features,
      valuesByFeature: sampleData.valuesByFeature, paramsByFeature: sampleData.paramsByFeature, sample: true,
    });
    const filename = buildFilename(args.study, studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.features.length} feature(s), ${[...sampleData.valuesByFeature.values()].reduce((a, v) => a + v.length, 0)} observation(s) total.`);
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
    const run = await resolveRun(db, studyId, studyTitle, args.runId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Run "${run.RUN_LABEL}" (ID_RUN=${run.ID_RUN}), method=${run.NORMALIZATION_METHOD}, generated ${formatTimestampUtc(run.GENERATED_AT)}.`);

    const features = await loadRunFeatures(db, run.ID_RUN, args.feature);
    if (features.length === 0) {
      throw new Error(args.feature
        ? `No feature in run ID_RUN=${run.ID_RUN} has a FEATURE_CODE containing "${args.feature}".`
        : `Run ID_RUN=${run.ID_RUN} has no GDX_HNF_FEATURE_RUN_MEMBER rows -- nothing to plot.`);
    }
    const paramsByFeature = await loadNormalizationParams(db, run.ID_RUN);
    const valuesByFeature = await loadFeatureValues(db, run.ID_RUN);

    let totalObservations = 0;
    let plotted = 0;
    for (const f of features) {
      const obs = valuesByFeature.get(f.ID_FEATURE) || [];
      totalObservations += obs.length;
      if (obs.length > 0) plotted += 1;
    }
    console.log(`Features in scope: ${features.length} (${plotted} with a plotted reference curve). Total observations: ${totalObservations}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, run, features, valuesByFeature, paramsByFeature, sample: false });
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
