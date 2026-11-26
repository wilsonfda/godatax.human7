#!/usr/bin/env node
/**
 * F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH
 *
 * For one study, renders the real distance/similarity results F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES
 * already wrote into the GDX_HNF_DISTANCE_* tables -- one standalone HTML page with two cards:
 *
 *   1. Constant-Mahalanobis-distance curves over a real 2-dimension marginal of a real
 *      GDX_HNF_DISTANCE_RUN (METRIC='MAHALANOBIS'): the actual stored GDX_HNF_DISTANCE_COVARIANCE
 *      entries for two chosen dimensions define the ellipses' real shape and orientation, and the
 *      same run's own complete-case persons are plotted on top of them as a real scatter -- never
 *      a fabricated or illustrative anisotropic distribution.
 *   2. A scatter between two real dimensions of the same run, annotated with their real Pearson
 *      correlation coefficient -- an association, never a causal claim.
 *
 * Only GDX_HNF_DISTANCE_RUN/GDX_HNF_DISTANCE_DIMENSION/GDX_HNF_DISTANCE_COVARIANCE are F3's own
 * output. This script additionally resolves, via the distance run's own FK, the exact upstream
 * GDX_HNF_FEATURE_VALUE (F1) or GDX_HNF_LATENT_VALUE (F2) rows needed to plot the real per-person
 * coordinates on the two chosen dimensions -- GDX_HNF_DISTANCE_* itself stores only pairwise
 * distances and the covariance matrix, never raw per-person coordinates, so there is no other real
 * source for the scatter overlay. This is the same "transitively satisfied" reading posture F3's
 * own compute script already documents one layer down, applied one layer further for the chart.
 *
 * Usage:
 *   node generate_distance_similarity_graph.js --study <slug> [--run-id <id>]
 *     [--ellipse-dim-a <order>] [--ellipse-dim-b <order>] [--ellipse-radii 1,2,3]
 *     [--assoc-dim-a <order>] [--assoc-dim-b <order>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>        REQUIRED outside --sample. Same slug F1/F2/F3 use -- resolves to
 *                          GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                          study.title.
 *   --run-id <id>           optional. A specific GDX_HNF_DISTANCE_RUN.ID_DISTANCE_RUN with
 *                          METRIC='MAHALANOBIS' instead of the study's latest such run (errors if
 *                          that run belongs to a different study or is not MAHALANOBIS -- only a
 *                          Mahalanobis run has a GDX_HNF_DISTANCE_COVARIANCE to draw from).
 *   --ellipse-dim-a <order> / --ellipse-dim-b <order>  which two of the run's own dimensions (by
 *                          DIMENSION_ORDER) to draw ellipses/scatter for. Default: 1 and 2.
 *   --ellipse-radii <csv>   constant-Mahalanobis-distance values to draw, comma-separated.
 *                          Default "1,2,3".
 *   --assoc-dim-a <order> / --assoc-dim-b <order>  which two dimensions the association card
 *                          plots. Default: auto-selected -- the pair (preferring two different
 *                          perspectives, when such a pair exists in this run) with the largest
 *                          real |Pearson r| among every pair of the run's own dimensions.
 *   --out-dir <path>        optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>     optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run               computes everything and logs the output filename, writing no file.
 *   --sample                 renders from embedded, explicitly-labeled synthetic anisotropic/
 *                          correlated data instead of connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');
const {
  pageShell, renderMahalanobisEllipseCard, renderAssociationScatterCard, renderNotAvailableCard,
  hookTooltips, pearsonR,
} = require('./chart_renderer');

function parseArgs(argv) {
  const args = {
    study: null, runId: null,
    ellipseDimA: 1, ellipseDimB: 2, ellipseRadii: [1, 2, 3],
    assocDimA: null, assocDimB: null,
    outDir: null, intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--ellipse-dim-a') args.ellipseDimA = parseInt(argv[++i], 10);
    else if (a === '--ellipse-dim-b') args.ellipseDimB = parseInt(argv[++i], 10);
    else if (a === '--ellipse-radii') args.ellipseRadii = String(argv[++i]).split(',').map((s) => parseFloat(s.trim())).filter((n) => n > 0);
    else if (a === '--assoc-dim-a') args.assocDimA = parseInt(argv[++i], 10);
    else if (a === '--assoc-dim-b') args.assocDimB = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F2/F3 use), unless --sample is passed.');
  }
  if (args.ellipseRadii.length === 0) throw new Error('--ellipse-radii must list at least one positive number.');
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export ` +
      `the vars before running this script (or pass --sample to render from embedded sample data with no database connection).`
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
  return `f3_distance_similarity_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves the GDX_HNF_DISTANCE_RUN to render: an explicit --run-id (validated to belong to this
 * study and actually be METRIC='MAHALANOBIS'), or else the latest Mahalanobis run for this study.
 * Only a Mahalanobis run has a GDX_HNF_DISTANCE_COVARIANCE to draw ellipses from. */
async function resolveDistanceRun(db, studyId, studyTitle, explicitRunId) {
  if (explicitRunId !== null && explicitRunId !== undefined && !Number.isNaN(explicitRunId)) {
    const rows = await query(db, `
      SELECT ID_DISTANCE_RUN, ID_STUDY, SPACE_KIND, ID_INPUT_FEATURE_RUN, ID_INPUT_LATENT_RUN, METRIC,
             RUN_LABEL, DIMENSION_COUNT, PERSON_COUNT, COVARIANCE_REGULARIZATION
      FROM GDX_HNF_DISTANCE_RUN WHERE ID_DISTANCE_RUN = ?`, [explicitRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_DISTANCE_RUN with ID_DISTANCE_RUN=${explicitRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) throw new Error(`GDX_HNF_DISTANCE_RUN ID_DISTANCE_RUN=${explicitRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}).`);
    if (run.METRIC !== 'MAHALANOBIS') throw new Error(`GDX_HNF_DISTANCE_RUN ID_DISTANCE_RUN=${explicitRunId} has METRIC='${run.METRIC}', not 'MAHALANOBIS' -- only a Mahalanobis run has a covariance matrix to draw ellipses from.`);
    return run;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_DISTANCE_RUN, ID_STUDY, SPACE_KIND, ID_INPUT_FEATURE_RUN, ID_INPUT_LATENT_RUN, METRIC,
           RUN_LABEL, DIMENSION_COUNT, PERSON_COUNT, COVARIANCE_REGULARIZATION
    FROM GDX_HNF_DISTANCE_RUN
    WHERE ID_STUDY = ? AND METRIC = 'MAHALANOBIS'
    ORDER BY GENERATED_AT DESC, ID_DISTANCE_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_DISTANCE_RUN with METRIC='MAHALANOBIS' found for study "${studyTitle}". Run ` +
      `F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES --study ${JSON.stringify(studyTitle)} --metric mahalanobis first.`
    );
  }
  return rows[0];
}

async function loadDistanceDimensions(db, distanceRunId) {
  const rows = await query(db, `
    SELECT DIMENSION_ORDER, ID_FEATURE, ID_LATENT_DIM
    FROM GDX_HNF_DISTANCE_DIMENSION
    WHERE ID_DISTANCE_RUN = ?
    ORDER BY DIMENSION_ORDER`, [distanceRunId]);
  return rows;
}

async function loadFeatureLabels(db, featureIds) {
  if (featureIds.length === 0) return new Map();
  const rows = await query(db, `
    SELECT D.ID_FEATURE, D.FEATURE_CODE, D.NAME, P.NAME_EN AS PERSPECTIVE_NAME_EN
    FROM GDX_HNF_FEATURE_DICTIONARY D
    JOIN GDX_HNF_PERSPECTIVE P ON P.ID_PERSPECTIVE = D.ID_PERSPECTIVE
    WHERE D.ID_FEATURE IN (${featureIds.map(() => '?').join(',')})`, featureIds);
  const byId = new Map();
  for (const r of rows) byId.set(r.ID_FEATURE, { label: r.FEATURE_CODE, name: r.NAME, perspective: r.PERSPECTIVE_NAME_EN });
  return byId;
}

async function loadLatentDimensionLabels(db, latentDimIds) {
  if (latentDimIds.length === 0) return new Map();
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, DIMENSION_LABEL
    FROM GDX_HNF_LATENT_DIMENSION
    WHERE ID_LATENT_DIM IN (${latentDimIds.map(() => '?').join(',')})`, latentDimIds);
  const byId = new Map();
  for (const r of rows) byId.set(r.ID_LATENT_DIM, { label: r.DIMENSION_LABEL, name: r.DIMENSION_LABEL, perspective: null });
  return byId;
}

/** Same reduction F3's own compute script uses: F1's per-(person, feature[, session]) grain
 * collapsed to one scalar per (person, feature) -- the mean of a person's own NORMALIZED_VALUE
 * rows for that feature in the input run. */
async function loadFeatureSpaceMatrix(db, inputFeatureRunId, featureIds) {
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_PERSON, ID_FEATURE`, [inputFeatureRunId]);
  const featureIdSet = new Set(featureIds);
  const sums = new Map();
  for (const r of rows) {
    if (!featureIdSet.has(r.ID_FEATURE)) continue;
    if (!sums.has(r.ID_PERSON)) sums.set(r.ID_PERSON, new Map());
    const perFeature = sums.get(r.ID_PERSON);
    const entry = perFeature.get(r.ID_FEATURE) || { sum: 0, count: 0 };
    entry.sum += Number(r.NORMALIZED_VALUE);
    entry.count += 1;
    perFeature.set(r.ID_FEATURE, entry);
  }
  const byPerson = new Map();
  for (const [personId, perFeature] of sums.entries()) {
    const out = new Map();
    for (const [featureId, { sum, count }] of perFeature.entries()) out.set(featureId, sum / count);
    byPerson.set(personId, out);
  }
  return byPerson; // Map(personId -> Map(featureId -> meanZ))
}

async function loadLatentMatrix(db, inputLatentRunId, latentDimIds) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, ID_PERSON, COORDINATE_VALUE
    FROM GDX_HNF_LATENT_VALUE
    WHERE ID_LATENT_RUN = ?`, [inputLatentRunId]);
  const dimIdSet = new Set(latentDimIds);
  const byPerson = new Map();
  for (const r of rows) {
    if (!dimIdSet.has(r.ID_LATENT_DIM)) continue;
    if (!byPerson.has(r.ID_PERSON)) byPerson.set(r.ID_PERSON, new Map());
    byPerson.get(r.ID_PERSON).set(r.ID_LATENT_DIM, Number(r.COORDINATE_VALUE));
  }
  return byPerson; // Map(personId -> Map(latentDimId -> value))
}

async function loadCovarianceEntries(db, distanceRunId) {
  const rows = await query(db, `
    SELECT ROW_ORDER, COL_ORDER, COV_VALUE
    FROM GDX_HNF_DISTANCE_COVARIANCE
    WHERE ID_DISTANCE_RUN = ?`, [distanceRunId]);
  const byPair = new Map();
  for (const r of rows) byPair.set(`${r.ROW_ORDER}:${r.COL_ORDER}`, Number(r.COV_VALUE));
  return byPair;
}
function covEntry(byPair, orderA, orderB) {
  const lo = Math.min(orderA, orderB), hi = Math.max(orderA, orderB);
  const v = byPair.get(`${lo}:${hi}`);
  if (v === undefined) throw new Error(`No GDX_HNF_DISTANCE_COVARIANCE entry for (row=${lo}, col=${hi}).`);
  return v;
}

/** Builds the full complete-case (person, dimensionKey) matrix across EVERY dimension of the
 * distance run -- same set of persons the run's own stored covariance/distances were computed
 * from, so a chart drawn from this matrix's columns is numerically consistent with what F3 itself
 * already wrote. dimensionKey is ID_FEATURE or ID_LATENT_DIM, matching SPACE_KIND. */
function buildCompleteCaseMatrix(byPerson, dimensionKeys) {
  const personIds = [...byPerson.keys()].sort((a, b) => a - b)
    .filter((pid) => dimensionKeys.every((k) => byPerson.get(pid).has(k)));
  const matrix = personIds.map((pid) => dimensionKeys.map((k) => byPerson.get(pid).get(k)));
  return { personIds, matrix };
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }

/** Picks the association-card dimension pair: an explicit --assoc-dim-a/--assoc-dim-b, or else
 * the pair (by index into dims/matrix columns) with the largest real |Pearson r|, preferring a
 * pair spanning two different perspectives when one exists with real data in this run (FEATURE_SPACE
 * only -- a latent dimension has no single perspective). Never fabricates a pair: every candidate
 * is computed from the same real complete-case matrix the rest of this page uses. */
function pickAssociationPair(dims, matrix, explicitA, explicitB) {
  const n = dims.length;
  if (explicitA !== null && explicitB !== null) {
    const ia = dims.findIndex((d) => d.order === explicitA);
    const ib = dims.findIndex((d) => d.order === explicitB);
    if (ia === -1) throw new Error(`--assoc-dim-a ${explicitA} is not a dimension of this run.`);
    if (ib === -1) throw new Error(`--assoc-dim-b ${explicitB} is not a dimension of this run.`);
    if (ia === ib) throw new Error('--assoc-dim-a and --assoc-dim-b must be different dimensions.');
    const xs = matrix.map((row) => row[ia]), ys = matrix.map((row) => row[ib]);
    return { ia, ib, r: pearsonR(xs, ys), crossPerspective: dims[ia].perspective && dims[ib].perspective ? dims[ia].perspective !== dims[ib].perspective : null, forced: true };
  }

  let best = null, bestCross = null;
  for (let ia = 0; ia < n; ia++) {
    for (let ib = ia + 1; ib < n; ib++) {
      const xs = matrix.map((row) => row[ia]), ys = matrix.map((row) => row[ib]);
      const r = pearsonR(xs, ys);
      const isCross = dims[ia].perspective && dims[ib].perspective ? dims[ia].perspective !== dims[ib].perspective : false;
      const candidate = { ia, ib, r, crossPerspective: isCross };
      if (!best || Math.abs(r) > Math.abs(best.r)) best = candidate;
      if (isCross && (!bestCross || Math.abs(r) > Math.abs(bestCross.r))) bestCross = candidate;
    }
  }
  const chosen = bestCross || best;
  return { ...chosen, crossPerspective: dims[chosen.ia].perspective ? chosen.crossPerspective : null, forced: false };
}

/** Resolves one card's full real data: dimension labels, the complete-case matrix across every
 * dimension of the run, and (Mahalanobis card only) the raw covariance entries. */
async function buildRunData(db, run) {
  const dims = await loadDistanceDimensions(db, run.ID_DISTANCE_RUN);
  if (dims.length < 2) throw new Error(`GDX_HNF_DISTANCE_RUN ID_DISTANCE_RUN=${run.ID_DISTANCE_RUN} has only ${dims.length} dimension(s) -- at least 2 are needed for a 2-D view.`);

  let labelById;
  let dimensionKeys;
  let byPerson;
  if (run.SPACE_KIND === 'FEATURE_SPACE') {
    const featureIds = dims.map((d) => d.ID_FEATURE);
    labelById = await loadFeatureLabels(db, featureIds);
    dimensionKeys = featureIds;
    byPerson = await loadFeatureSpaceMatrix(db, run.ID_INPUT_FEATURE_RUN, featureIds);
  } else {
    const latentDimIds = dims.map((d) => d.ID_LATENT_DIM);
    labelById = await loadLatentDimensionLabels(db, latentDimIds);
    dimensionKeys = latentDimIds;
    byPerson = await loadLatentMatrix(db, run.ID_INPUT_LATENT_RUN, latentDimIds);
  }

  const labeledDims = dims.map((d, idx) => {
    const key = dimensionKeys[idx];
    const info = labelById.get(key) || { label: `DIM_${d.DIMENSION_ORDER}`, name: `DIM_${d.DIMENSION_ORDER}`, perspective: null };
    return { order: d.DIMENSION_ORDER, key, label: info.label, name: info.name, perspective: info.perspective };
  });

  const { personIds, matrix } = buildCompleteCaseMatrix(byPerson, dimensionKeys);
  if (personIds.length !== run.PERSON_COUNT) {
    console.log(`WARNING: recomputed complete-case person count (${personIds.length}) does not match the stored run's own PERSON_COUNT (${run.PERSON_COUNT}) -- the upstream F1/F2 run may have changed since this distance run was generated. Rendering from what is actually resolvable now.`);
  }

  const covByPair = await loadCovarianceEntries(db, run.ID_DISTANCE_RUN);
  return { dims: labeledDims, personIds, matrix, covByPair };
}

function buildEllipseCardFromRunData(runData, run, args) {
  const { dims, personIds, matrix, covByPair } = runData;
  const ia = dims.findIndex((d) => d.order === args.ellipseDimA);
  const ib = dims.findIndex((d) => d.order === args.ellipseDimB);
  if (ia === -1) throw new Error(`--ellipse-dim-a ${args.ellipseDimA} is not a dimension of this run (has orders 1..${dims.length}).`);
  if (ib === -1) throw new Error(`--ellipse-dim-b ${args.ellipseDimB} is not a dimension of this run (has orders 1..${dims.length}).`);
  if (ia === ib) throw new Error('--ellipse-dim-a and --ellipse-dim-b must be different dimensions.');

  const xs = matrix.map((row) => row[ia]), ys = matrix.map((row) => row[ib]);
  const cov2x2 = {
    a: covEntry(covByPair, dims[ia].order, dims[ia].order),
    b: covEntry(covByPair, dims[ia].order, dims[ib].order),
    d: covEntry(covByPair, dims[ib].order, dims[ib].order),
  };
  const meanPoint = { x: mean(xs), y: mean(ys) };
  const points = personIds.map((pid, i) => ({ personId: pid, x: xs[i], y: ys[i] }));

  const regularizationNote = run.COVARIANCE_REGULARIZATION && run.COVARIANCE_REGULARIZATION !== 'NONE'
    ? `Note: this run's own full-dimension pairwise Mahalanobis distances used a ${run.COVARIANCE_REGULARIZATION.toLowerCase().replace('_', ' ')}-regularized inverse covariance; this 2-D marginal view uses the real, unregularized covariance entries directly (a 2x2 submatrix is essentially always well-conditioned on its own).`
    : null;

  return {
    html: renderMahalanobisEllipseCard({
      runLabel: run.RUN_LABEL, personCount: points.length,
      dimA: dims[ia], dimB: dims[ib], cov2x2, mean: meanPoint, points,
      radii: args.ellipseRadii, cardId: 'f3-ellipse', regularizationNote,
    }),
    summary: `ellipse card: ${dims[ia].label} vs ${dims[ib].label}, ${points.length} person(s), radii [${args.ellipseRadii.join(', ')}]`,
  };
}

function buildAssociationCardFromRunData(runData, run, args) {
  const { dims, personIds, matrix } = runData;
  const pick = pickAssociationPair(dims, matrix, args.assocDimA, args.assocDimB);
  const xs = matrix.map((row) => row[pick.ia]), ys = matrix.map((row) => row[pick.ib]);
  const points = personIds.map((pid, i) => ({ personId: pid, x: xs[i], y: ys[i] }));

  return {
    html: renderAssociationScatterCard({
      runLabel: run.RUN_LABEL, personCount: points.length,
      dimA: dims[pick.ia], dimB: dims[pick.ib], points, r: pick.r,
      crossPerspective: pick.crossPerspective, cardId: 'f3-assoc',
    }),
    summary: `association card: ${dims[pick.ia].label} vs ${dims[pick.ib].label}, r=${pick.r.toFixed(3)}, ${pick.forced ? 'explicit selection' : (pick.crossPerspective ? 'auto, cross-perspective' : 'auto, strongest |r|')}`,
  };
}

/** Small, explicitly-labeled embedded synthetic dataset -- NOT from any real study. Two
 * correlated, anisotropic dimensions for the ellipse card; two separately correlated dimensions
 * for the association card. */
function buildSampleData() {
  const n = 40;
  const points = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const x = Math.cos(t) * 2.4 + Math.sin(t * 3) * 0.3;
    const y = x * 0.6 + Math.sin(t) * 0.8; // correlated with x -> anisotropic cloud
    return { personId: `SAMPLE-${i + 1}`, x, y };
  });
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const mx = mean(xs), my = mean(ys);
  let a = 0, b = 0, d = 0;
  for (let i = 0; i < n; i++) { a += (xs[i] - mx) ** 2; b += (xs[i] - mx) * (ys[i] - my); d += (ys[i] - my) ** 2; }
  a /= (n - 1); b /= (n - 1); d /= (n - 1);

  const assocPoints = Array.from({ length: n }, (_, i) => {
    const x = (i - n / 2) / 5 + (Math.sin(i) * 0.4);
    const y = x * 0.75 + (Math.cos(i * 1.7) * 0.9);
    return { personId: `SAMPLE-${i + 1}`, x, y };
  });
  const assocXs = assocPoints.map((p) => p.x), assocYs = assocPoints.map((p) => p.y);

  return {
    ellipse: {
      dimA: { order: 1, label: 'SAMPLE.DIM.X' }, dimB: { order: 2, label: 'SAMPLE.DIM.Y' },
      cov2x2: { a, b, d }, mean: { x: mx, y: my }, points,
    },
    association: {
      dimA: { order: 1, label: 'SAMPLE.DIM.A' }, dimB: { order: 2, label: 'SAMPLE.DIM.B' },
      points: assocPoints, r: pearsonR(assocXs, assocYs),
    },
  };
}

function buildPageHtml({ studyTitle, study, ellipseResult, associationResult, sample, runLabel }) {
  const cardsHtml = [ellipseResult.html, associationResult.html].join('\n');
  const title = `Distance and similarity between profiles -- ${studyTitle}`;
  const description =
    `Two views built from this study's own real GDX_HNF_DISTANCE_* data: constant-Mahalanobis-` +
    `distance curves over a real 2-dimension marginal (with the real complete-case scatter ` +
    `overlaid, so any anisotropy shown is this study's own, never fabricated), and a scatter ` +
    `between two real dimensions annotated with their real Pearson correlation. Proximity, ` +
    `anisotropy and correlation shown here are purely geometric/statistical facts about the ` +
    `chosen coordinates -- never, by themselves, evidence of a causal mechanism or a validated ` +
    `metaphysical correspondence.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    runLabel ? `Source run: ${runLabel}` : null,
  ].filter(Boolean);

  return pageShell({
    title, description, metaLines, bodyHtml: cardsHtml, script: hookTooltips(),
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
    const intake = args.study ? loadIntake(args) : null;
    const studyTitle = (intake && intake.study && intake.study.title) || 'Sample Study (illustrative, not a real GDX_HUMAN study)';
    const sampleData = buildSampleData();
    const ellipseHtml = renderMahalanobisEllipseCard({
      runLabel: 'SAMPLE_RUN (not a real GDX_HNF_DISTANCE_RUN)', personCount: sampleData.ellipse.points.length,
      dimA: sampleData.ellipse.dimA, dimB: sampleData.ellipse.dimB, cov2x2: sampleData.ellipse.cov2x2,
      mean: sampleData.ellipse.mean, points: sampleData.ellipse.points, radii: args.ellipseRadii,
      cardId: 'f3-ellipse', regularizationNote: null,
    });
    const assocHtml = renderAssociationScatterCard({
      runLabel: 'SAMPLE_RUN (not a real GDX_HNF_DISTANCE_RUN)', personCount: sampleData.association.points.length,
      dimA: sampleData.association.dimA, dimB: sampleData.association.dimB,
      points: sampleData.association.points, r: sampleData.association.r, crossPerspective: null, cardId: 'f3-assoc',
    });
    const html = buildPageHtml({
      studyTitle, study: args.study || 'sample',
      ellipseResult: { html: ellipseHtml }, associationResult: { html: assocHtml },
      sample: true, runLabel: null,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    if (args.dryRun) { console.log(`[DRY RUN][SAMPLE] Would write ${path.join(outDir, filename)}`); return; }
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[SAMPLE] Wrote ${outPath}`);
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
    const run = await resolveDistanceRun(db, studyId, studyTitle, args.runId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Distance run "${run.RUN_LABEL}" (ID_DISTANCE_RUN=${run.ID_DISTANCE_RUN}, SPACE_KIND=${run.SPACE_KIND}, ${run.DIMENSION_COUNT} dimension(s), ${run.PERSON_COUNT} person(s)).`);

    const runData = await buildRunData(db, run);
    const ellipseResult = buildEllipseCardFromRunData(runData, run, args);
    const associationResult = buildAssociationCardFromRunData(runData, run, args);
    console.log(`  ${ellipseResult.summary}`);
    console.log(`  ${associationResult.summary}`);

    const html = buildPageHtml({
      studyTitle, study: args.study, ellipseResult, associationResult, sample: false, runLabel: run.RUN_LABEL,
    });
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
