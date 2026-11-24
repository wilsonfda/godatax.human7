#!/usr/bin/env node
/**
 * F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES (F3)
 *
 * For one study, computes pairwise distances between every pair of persons' own profile vectors
 * -- either F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE's normalized z(t)
 * (GDX_HNF_FEATURE_VALUE, a ZSCORE run) or F2_GDX_SKILL_LATENT_REPRESENTATIONS's learned h(t)
 * (GDX_HNF_LATENT_VALUE) -- under three metrics, and records the result into the
 * GDX_HNF_DISTANCE_* tables (see ../../../hypotheses_non_fingo_distance_similarity_model_firebird25.sql):
 *
 *   --metric euclidean     dE(u,v)   = sqrt( sum_j (u_j - v_j)^2 )
 *   --metric rms           dRMS(u,v) = sqrt( (1/n) * sum_j (u_j - v_j)^2 ) = dE(u,v) / sqrt(n)
 *   --metric mahalanobis   dM(u,v)   = sqrt( (u - v)^T * Sigma^-1 * (u - v) ), Sigma estimated
 *                          from this run's own complete-case sample (regularized -- shrunk toward
 *                          its own diagonal -- when ill-conditioned; see "Mahalanobis and
 *                          regularization" in SKILL.md)
 *   --metric all (default) computes and writes all three above, each its own GDX_HNF_DISTANCE_RUN
 *
 * Never re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
 * 7.multidimensional.database or 9.knowledge.graph directly, and never re-fits a latent
 * representation -- only GDX_HNF_FEATURE_SPACE_RUN / GDX_HNF_FEATURE_VALUE /
 * GDX_HNF_FEATURE_DICTIONARY (F1) or GDX_HNF_LATENT_RUN / GDX_HNF_LATENT_DIMENSION /
 * GDX_HNF_LATENT_VALUE (F2), already assembled/fitted by those two prior skills. See SKILL.md
 * "What it reads -- and deliberately does NOT re-read".
 *
 * Usage:
 *   node generate_distance_similarity_profiles.js --study <slug> [--space feature|latent]
 *     [--metric euclidean|rms|mahalanobis|all] [--run-id <id>] [--feature <code-substring>]
 *     [--latent-method pca|autoencoder|umap] [--dims <k>]
 *     [--covariance-regularization auto|none|shrinkage] [--lambda <0..1>]
 *     [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>       REQUIRED outside --sample. Same slug MFS/F2 use -- resolves to
 *                         GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                         study.title.
 *   --space               feature (default) | latent. "feature" compares F1's own normalized
 *                         z(t); "latent" compares F2's own learned h(t) for one latent run.
 *   --metric               euclidean | rms | mahalanobis | all (default).
 *   --run-id <id>           optional. --space feature: a specific GDX_HNF_FEATURE_SPACE_RUN.ID_RUN
 *                         (must be ZSCORE) instead of the study's latest. --space latent: a
 *                         specific GDX_HNF_LATENT_RUN.ID_LATENT_RUN instead of the study's latest
 *                         (optionally narrowed further by --latent-method).
 *   --feature <text>        optional, --space feature only. Only input features whose
 *                         FEATURE_CODE contains this text (case-insensitive) are candidates --
 *                         same convention and same recommendation as F2 (--feature "PSY.VAR."
 *                         today, see SKILL.md).
 *   --latent-method         optional, --space latent only. pca | autoencoder | umap -- narrows
 *                         which GDX_HNF_LATENT_RUN is "the latest" when --run-id is not given.
 *   --dims <k>               optional, --space latent only. Use only the first k latent
 *                         dimensions (by DIMENSION_ORDER) instead of all of them.
 *   --covariance-regularization   auto (default) | none | shrinkage. --metric mahalanobis only.
 *                         "auto" estimates the condition number of the raw sample covariance
 *                         matrix and applies diagonal shrinkage only when it is ill-conditioned
 *                         (see SKILL.md); "none"/"shrinkage" force that choice.
 *   --lambda <0..1>          optional. Shrinkage weight when regularization is (or becomes)
 *                         SHRINKAGE_DIAGONAL. Default when auto-triggered: 0.1.
 *   --intake-dir <path>     optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run               computes everything (candidates/usable dimensions, complete-case
 *                         persons, condition number, pair count) and logs it, writing no row.
 *   --sample                 computes all three metrics on small, explicitly-labeled synthetic
 *                         profiles instead of connecting to Firebird, and only ever prints the
 *                         result -- never writes to the database.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { Matrix, SingularValueDecomposition, inverse } = require('ml-matrix');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const METRICS = ['EUCLIDEAN', 'RMS', 'MAHALANOBIS'];
const CONDITION_NUMBER_THRESHOLD = 1e8;
const DEFAULT_AUTO_LAMBDA = 0.1;

function parseArgs(argv) {
  const args = {
    study: null, space: 'FEATURE', metric: 'ALL', runId: null, feature: null,
    latentMethod: null, dims: null, covarianceRegularization: 'AUTO', lambda: null,
    intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--space') args.space = String(argv[++i] || '').toUpperCase();
    else if (a === '--metric') args.metric = String(argv[++i] || '').toUpperCase();
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--latent-method') args.latentMethod = String(argv[++i] || '').toUpperCase();
    else if (a === '--dims') args.dims = parseInt(argv[++i], 10);
    else if (a === '--covariance-regularization') args.covarianceRegularization = String(argv[++i] || '').toUpperCase();
    else if (a === '--lambda') args.lambda = parseFloat(argv[++i]);
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug MFS/F2 use), unless --sample is passed.');
  }
  if (!['FEATURE', 'LATENT'].includes(args.space)) {
    throw new Error(`--space ${args.space} is not recognized. Supported: feature, latent.`);
  }
  if (!['EUCLIDEAN', 'RMS', 'MAHALANOBIS', 'ALL'].includes(args.metric)) {
    throw new Error(`--metric ${args.metric} is not recognized. Supported: euclidean, rms, mahalanobis, all.`);
  }
  if (!['AUTO', 'NONE', 'SHRINKAGE'].includes(args.covarianceRegularization)) {
    throw new Error(`--covariance-regularization ${args.covarianceRegularization} is not recognized. Supported: auto, none, shrinkage.`);
  }
  if (args.lambda !== null && (Number.isNaN(args.lambda) || args.lambda < 0 || args.lambda > 1)) {
    throw new Error(`--lambda must be between 0 and 1 (got ${args.lambda}).`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export ` +
      `the vars before running this script (or pass --sample to exercise the distance formulas with no database connection).`
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
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string -- same reason as the
 * sibling F1/F2 scripts: a plain template-literal interpolation of a Date renders its timezone
 * NAME in the OS's configured locale. */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES/scripts)
 * -- same depth/shape as the sibling skills in this folder. */
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

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/* ---------------------------------------------------------------------------------------------
 * --space feature: resolving the input F1 run and its usable dimensions, same posture as
 * F2_GDX_SKILL_LATENT_REPRESENTATIONS's own script one layer down (only a ZSCORE run's
 * NORMALIZED_VALUE is a real z-score).
 * ------------------------------------------------------------------------------------------- */

async function resolveFeatureInputRun(db, studyId, studyTitle, runId) {
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `
      SELECT ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, GENERATED_AT
      FROM GDX_HNF_FEATURE_SPACE_RUN WHERE ID_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_FEATURE_SPACE_RUN with ID_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    if (run.NORMALIZATION_METHOD !== 'ZSCORE') {
      throw new Error(
        `GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} used NORMALIZATION_METHOD='${run.NORMALIZATION_METHOD}', not 'ZSCORE' -- ` +
        `every formula this skill computes assumes a real z-score input. Run F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE ` +
        `with --normalization zscore (its default) for this study first, or pass a different --run-id.`
      );
    }
    return run;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, GENERATED_AT
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

/** Candidate input features for this distance run: every feature F1 included in the input run,
 * minus NOMINAL-scale features (no sensible numeric input for a Euclidean/RMS/Mahalanobis
 * formula) and IS_METAPHYSICAL_INTERPRETATION=1 features (an interpretive ontology, never a
 * measurement -- see CLAUDE.md "Empirical finding != interpretive reading"), further narrowed by
 * --feature if passed. Same logic as F2_GDX_SKILL_LATENT_REPRESENTATIONS's own script. */
async function loadCandidateFeatures(db, inputRunId, featureFilter) {
  const rows = await query(db, `
    SELECT M.FEATURE_ORDER, D.ID_FEATURE, D.FEATURE_CODE, D.NAME, D.FEATURE_TYPE, D.IS_METAPHYSICAL_INTERPRETATION
    FROM GDX_HNF_FEATURE_RUN_MEMBER M
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = M.ID_FEATURE
    WHERE M.ID_RUN = ?
    ORDER BY M.FEATURE_ORDER`, [inputRunId]);

  const excludedNominal = [];
  const excludedMetaphysical = [];
  const excludedByFilter = [];
  let candidates = [];
  for (const r of rows) {
    if (r.FEATURE_TYPE === 'NOMINAL') { excludedNominal.push(r.FEATURE_CODE); continue; }
    if (r.IS_METAPHYSICAL_INTERPRETATION === 1) { excludedMetaphysical.push(r.FEATURE_CODE); continue; }
    candidates.push(r);
  }
  if (featureFilter) {
    const needle = featureFilter.toLowerCase();
    const kept = candidates.filter((r) => String(r.FEATURE_CODE).toLowerCase().includes(needle));
    for (const r of candidates) {
      if (!kept.includes(r)) excludedByFilter.push(r.FEATURE_CODE);
    }
    candidates = kept;
  }
  return { candidates, excludedNominal, excludedMetaphysical, excludedByFilter };
}

async function loadFeatureValues(db, inputRunId, featureIdSet) {
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_PERSON, ID_FEATURE`, [inputRunId]);
  return rows.filter((r) => featureIdSet.has(r.ID_FEATURE));
}

/** Reduces F1's per-(person, feature[, session]) grain to one scalar per (person, feature) --
 * the mean of a person's own NORMALIZED_VALUE rows for that feature in this run. Same averaging
 * principle F2's own script already applies one level down (and MFS one level below that). */
function aggregatePersonFeatureMeans(valueRows) {
  const sums = new Map();
  for (const r of valueRows) {
    if (!sums.has(r.ID_PERSON)) sums.set(r.ID_PERSON, new Map());
    const perFeature = sums.get(r.ID_PERSON);
    const entry = perFeature.get(r.ID_FEATURE) || { sum: 0, count: 0 };
    entry.sum += Number(r.NORMALIZED_VALUE);
    entry.count += 1;
    perFeature.set(r.ID_FEATURE, entry);
  }
  const means = new Map();
  for (const [personId, perFeature] of sums.entries()) {
    const out = new Map();
    for (const [featureId, { sum, count }] of perFeature.entries()) out.set(featureId, sum / count);
    means.set(personId, out);
  }
  return means;
}

/** Builds the COMPLETE_CASES input matrix: drops any candidate feature with zero observations
 * anywhere in this run's sample, then keeps only persons with a real, non-missing value on
 * every remaining feature. Per CLAUDE.md "Never invent missing data", a person failing this is
 * simply excluded, never imputed. Same logic as F2's own script. */
function buildCompleteCaseMatrix(personFeatureMeans, candidates) {
  const dimsWithData = new Set();
  for (const perFeature of personFeatureMeans.values()) {
    for (const featureId of perFeature.keys()) dimsWithData.add(featureId);
  }
  const droppedZeroObservation = candidates.filter((f) => !dimsWithData.has(f.ID_FEATURE)).map((f) => f.FEATURE_CODE);
  const usableDimensions = candidates.filter((f) => dimsWithData.has(f.ID_FEATURE));

  const allPersonIds = [...personFeatureMeans.keys()].sort((a, b) => a - b);
  const personIds = allPersonIds.filter((pid) => {
    const perFeature = personFeatureMeans.get(pid);
    return usableDimensions.every((f) => perFeature.has(f.ID_FEATURE));
  });

  const matrix = personIds.map((pid) => {
    const perFeature = personFeatureMeans.get(pid);
    return usableDimensions.map((f) => perFeature.get(f.ID_FEATURE));
  });

  return { usableDimensions, droppedZeroObservation, personIds, matrix, candidatePersonCount: allPersonIds.length };
}

/* ---------------------------------------------------------------------------------------------
 * --space latent: resolving the input F2 run (always already COMPLETE_CASES -- see F2's own
 * GDX_HNF_LATENT_RUN.INPUT_SELECTION) and its dimensions/values. No averaging needed: F2 already
 * wrote exactly one coordinate per (dimension, person).
 * ------------------------------------------------------------------------------------------- */

async function resolveLatentInputRun(db, studyId, studyTitle, runId, latentMethod) {
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `
      SELECT ID_LATENT_RUN, ID_STUDY, METHOD, RUN_LABEL, LATENT_DIMENSION_COUNT, PERSON_COUNT, GENERATED_AT
      FROM GDX_HNF_LATENT_RUN WHERE ID_LATENT_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_LATENT_RUN with ID_LATENT_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_LATENT_RUN ID_LATENT_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const params = [studyId];
  let methodClause = '';
  if (latentMethod) { methodClause = 'AND METHOD = ?'; params.push(latentMethod); }
  const rows = await query(db, `
    SELECT FIRST 1 ID_LATENT_RUN, ID_STUDY, METHOD, RUN_LABEL, LATENT_DIMENSION_COUNT, PERSON_COUNT, GENERATED_AT
    FROM GDX_HNF_LATENT_RUN
    WHERE ID_STUDY = ? ${methodClause}
    ORDER BY GENERATED_AT DESC, ID_LATENT_RUN DESC`, params);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_LATENT_RUN found for study "${studyTitle}"${latentMethod ? ` with METHOD='${latentMethod}'` : ''}. Run ` +
      `F2_GDX_SKILL_LATENT_REPRESENTATIONS --study ${JSON.stringify(studyTitle)} first, or pass --space feature to compare F1's own z(t) instead.`
    );
  }
  return rows[0];
}

async function loadLatentDimensions(db, latentRunId, dimsLimit) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, DIMENSION_ORDER, DIMENSION_LABEL
    FROM GDX_HNF_LATENT_DIMENSION
    WHERE ID_LATENT_RUN = ?
    ORDER BY DIMENSION_ORDER`, [latentRunId]);
  if (dimsLimit !== null && dimsLimit !== undefined && !Number.isNaN(dimsLimit)) {
    if (dimsLimit < 1 || dimsLimit > rows.length) {
      throw new Error(`--dims must be between 1 and ${rows.length} for this latent run's own ${rows.length} dimension(s) (got ${dimsLimit}).`);
    }
    return rows.slice(0, dimsLimit);
  }
  return rows;
}

async function loadLatentMatrix(db, latentRunId, dimensionRows) {
  const dimIds = dimensionRows.map((d) => d.ID_LATENT_DIM);
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, ID_PERSON, COORDINATE_VALUE
    FROM GDX_HNF_LATENT_VALUE
    WHERE ID_LATENT_RUN = ?
    ORDER BY ID_PERSON, ID_LATENT_DIM`, [latentRunId]);
  const dimIdSet = new Set(dimIds);
  const byPerson = new Map();
  for (const r of rows) {
    if (!dimIdSet.has(r.ID_LATENT_DIM)) continue;
    if (!byPerson.has(r.ID_PERSON)) byPerson.set(r.ID_PERSON, new Map());
    byPerson.get(r.ID_PERSON).set(r.ID_LATENT_DIM, Number(r.COORDINATE_VALUE));
  }
  const personIds = [...byPerson.keys()].sort((a, b) => a - b)
    .filter((pid) => dimIds.every((id) => byPerson.get(pid).has(id))); // defensive: F2's own run is already complete-case
  const matrix = personIds.map((pid) => dimIds.map((id) => byPerson.get(pid).get(id)));
  return { personIds, matrix };
}

/* ---------------------------------------------------------------------------------------------
 * The three F3 metrics themselves.
 * ------------------------------------------------------------------------------------------- */

/** dE(u,v) = sqrt( sum_j (u_j - v_j)^2 ). The ordinary Euclidean distance -- grows with both the
 * number and the magnitude of the per-dimension deviations; depends only on coordinates, units
 * and scale, never on an interpretive category. */
function squaredDiffSum(u, v) {
  let s = 0;
  for (let j = 0; j < u.length; j++) {
    const d = u[j] - v[j];
    s += d * d;
  }
  return s;
}
function euclideanDistance(u, v) {
  return Math.sqrt(squaredDiffSum(u, v));
}

/** dRMS(u,v) = sqrt( (1/n) * sum_j (u_j - v_j)^2 ) = dE(u,v) / sqrt(n). Dividing the sum of
 * squared deviations by n before the square root changes only the scale, never the ordering of
 * distances within a fixed-n run -- the same rescaling this project's own deviation-index layer
 * (a later, separate skill) will build directly on top of. */
function rmsDistance(u, v) {
  return Math.sqrt(squaredDiffSum(u, v) / u.length);
}

/** Sample covariance matrix (divisor person_count - 1) of an n-dimension, P-person
 * complete-case matrix. Mean-centers each dimension across THIS run's own sample before
 * accumulating cross-products -- the same "this run's own sample, nothing external" posture
 * F1's own normalization and F2's own PCA centering already take. */
function sampleCovariance(matrix) {
  const p = matrix.length;
  const n = matrix[0].length;
  const means = new Array(n).fill(0);
  for (const row of matrix) for (let j = 0; j < n; j++) means[j] += row[j];
  for (let j = 0; j < n; j++) means[j] /= p;

  const cov = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const row of matrix) {
    const centered = row.map((v, j) => v - means[j]);
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) {
        cov[a][b] += centered[a] * centered[b];
      }
    }
  }
  const divisor = p - 1;
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      cov[a][b] /= divisor;
      cov[b][a] = cov[a][b];
    }
  }
  return cov;
}

/** Condition number estimate via SVD singular values: max(s) / min(s). A very large value means
 * Sigma is near-singular (e.g. too few complete-case persons relative to dimensions, or strongly
 * correlated dimensions double-counting one direction) and its naive inverse is unusable --
 * see SKILL.md "Mahalanobis and regularization". */
function conditionNumber(covMatrix) {
  const m = new Matrix(covMatrix);
  const svd = new SingularValueDecomposition(m);
  const s = svd.diagonal;
  const maxS = Math.max(...s);
  const minS = Math.min(...s);
  if (minS <= 0) return Infinity;
  return maxS / minS;
}

/** Sigma_reg = (1 - lambda) * Sigma + lambda * diag(diag(Sigma)) -- a convex combination of the
 * raw sample covariance with its own diagonal (variances only, no cross-covariance), per
 * SKILL.md "Mahalanobis and regularization". lambda=0 is the untouched raw covariance;
 * lambda=1 collapses every off-diagonal entry to zero (equivalent to a per-dimension-weighted
 * Euclidean distance). Never a fabricated or approximated covariance -- always a documented,
 * explicit function of the real, estimated Sigma. */
function shrinkToDiagonal(covMatrix, lambda) {
  const n = covMatrix.length;
  const reg = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const raw = covMatrix[a][b];
      reg[a][b] = a === b ? raw : (1 - lambda) * raw;
    }
  }
  return reg;
}

function invertMatrix(covMatrix) {
  const m = new Matrix(covMatrix);
  return inverse(m).to2DArray();
}

/** dM(u,v) = sqrt( (u - v)^T * invCov * (u - v) ). invCov is the (possibly regularized) Sigma^-1
 * resolved once per run and reused for every pair -- recomputing it per pair would be wasteful
 * and would risk a different regularization choice silently leaking into different pairs of the
 * same run. */
function mahalanobisDistance(u, v, invCov) {
  const n = u.length;
  const diff = new Array(n);
  for (let j = 0; j < n; j++) diff[j] = u[j] - v[j];
  let total = 0;
  for (let a = 0; a < n; a++) {
    let rowSum = 0;
    for (let b = 0; b < n; b++) rowSum += invCov[a][b] * diff[b];
    total += diff[a] * rowSum;
  }
  // A regularized-but-still-slightly-indefinite Sigma^-1 from floating-point error can produce a
  // total infinitesimally below zero for a near-zero diff -- clamp rather than hand back NaN from
  // sqrt() of a negative number for what is mathematically a zero distance.
  return Math.sqrt(Math.max(total, 0));
}

function assertFinite(values, label) {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`Non-finite value encountered in ${label} -- refusing to compute a distance from NaN/Infinity input.`);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * --sample: small, explicitly-labeled embedded synthetic profiles (NOT from any real study) --
 * same convention F1/F2's own scripts already use for --sample.
 * ------------------------------------------------------------------------------------------- */
function buildSampleProfiles() {
  const dimensionLabels = ['SAMPLE.DIM.1', 'SAMPLE.DIM.2', 'SAMPLE.DIM.3', 'SAMPLE.DIM.4', 'SAMPLE.DIM.5'];
  const personIds = ['SAMPLE-1', 'SAMPLE-2', 'SAMPLE-3', 'SAMPLE-4'];
  const matrix = [
    [0.8, 0.6, 0.4, 0.7, 0.5],
    [0.5, 0.5, 0.5, 0.5, 0.5],
    [-0.2, 0.9, -0.6, 0.3, 1.1],
    [0.1, -0.4, 0.8, -0.3, 0.2],
  ];
  return { dimensionLabels, personIds, matrix };
}

function printPairwiseMatrix(personIds, distanceFn) {
  for (let i = 0; i < personIds.length; i++) {
    for (let j = i + 1; j < personIds.length; j++) {
      console.log(`  ${personIds[i]} <-> ${personIds[j]}: ${distanceFn(i, j).toFixed(6)}`);
    }
  }
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
    const { dimensionLabels, personIds, matrix } = buildSampleProfiles();
    console.log(`[SAMPLE] ${personIds.length} synthetic person(s) x ${dimensionLabels.length} synthetic dimension(s). Never written to the database.`);

    console.log('\nEuclidean dE(u,v):');
    printPairwiseMatrix(personIds, (i, j) => euclideanDistance(matrix[i], matrix[j]));

    console.log('\nRMS dRMS(u,v):');
    printPairwiseMatrix(personIds, (i, j) => rmsDistance(matrix[i], matrix[j]));

    const cov = sampleCovariance(matrix);
    const cond = conditionNumber(cov);
    const regularization = cond > CONDITION_NUMBER_THRESHOLD ? 'SHRINKAGE_DIAGONAL' : 'NONE';
    const lambda = regularization === 'SHRINKAGE_DIAGONAL' ? (args.lambda ?? DEFAULT_AUTO_LAMBDA) : null;
    const regCov = regularization === 'SHRINKAGE_DIAGONAL' ? shrinkToDiagonal(cov, lambda) : cov;
    const invCov = invertMatrix(regCov);
    console.log(`\nMahalanobis dM(u,v) [condition number of raw Sigma ~ ${cond.toFixed(2)}, regularization=${regularization}${lambda !== null ? `, lambda=${lambda}` : ''}]:`);
    printPairwiseMatrix(personIds, (i, j) => mahalanobisDistance(matrix[i], matrix[j], invCov));
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

    // --- Resolve the input run and the (person, dimension) complete-case matrix, once -- shared
    // across however many metrics this invocation computes. ---
    let spaceKind, inputFeatureRunId, inputLatentRunId, dimensionRows, personIds, matrix, inputRunNotesLine;

    if (args.space === 'FEATURE') {
      const inputRun = await resolveFeatureInputRun(db, studyId, studyTitle, args.runId);
      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Input F1 run "${inputRun.RUN_LABEL}" (ID_RUN=${inputRun.ID_RUN}).`);

      const { candidates, excludedNominal, excludedMetaphysical, excludedByFilter } = await loadCandidateFeatures(db, inputRun.ID_RUN, args.feature);
      if (candidates.length === 0) {
        throw new Error(args.feature
          ? `No eligible (non-NOMINAL, non-metaphysical) feature in input run ID_RUN=${inputRun.ID_RUN} has a FEATURE_CODE containing "${args.feature}".`
          : `Input run ID_RUN=${inputRun.ID_RUN} has no eligible (non-NOMINAL, non-metaphysical) features -- nothing to compare.`);
      }
      const featureIdSet = new Set(candidates.map((f) => f.ID_FEATURE));
      const valueRows = await loadFeatureValues(db, inputRun.ID_RUN, featureIdSet);
      const personFeatureMeans = aggregatePersonFeatureMeans(valueRows);
      const built = buildCompleteCaseMatrix(personFeatureMeans, candidates);
      if (built.usableDimensions.length < 1) {
        throw new Error(`Only ${built.usableDimensions.length} usable feature(s) with real observations in this run -- need at least 1. Try a broader --feature filter or a different --run-id.`);
      }
      if (built.personIds.length < 2) {
        throw new Error(`Only ${built.personIds.length} complete-case person(s) -- need at least 2 to form a pair. Try a narrower --feature filter to admit more complete cases.`);
      }

      spaceKind = 'FEATURE_SPACE';
      inputFeatureRunId = inputRun.ID_RUN;
      inputLatentRunId = null;
      dimensionRows = built.usableDimensions.map((f, idx) => ({ order: idx + 1, idFeature: f.ID_FEATURE, idLatentDim: null, label: f.FEATURE_CODE }));
      personIds = built.personIds;
      matrix = built.matrix;
      inputRunNotesLine = [
        `Input F1 run: ${inputRun.RUN_LABEL} (ID_RUN=${inputRun.ID_RUN}), generated ${formatTimestampUtc(inputRun.GENERATED_AT)}.`,
        `Candidate features from input run: ${candidates.length}.`,
        excludedNominal.length ? `Excluded (NOMINAL scale): ${excludedNominal.join(', ')}.` : null,
        excludedMetaphysical.length ? `Excluded (metaphysical-interpretation flag set): ${excludedMetaphysical.join(', ')}.` : null,
        excludedByFilter.length ? `Excluded by --feature "${args.feature}": ${excludedByFilter.join(', ')}.` : null,
        built.droppedZeroObservation.length ? `Excluded (zero real observations in this run's sample): ${built.droppedZeroObservation.join(', ')}.` : null,
        `Dimensions actually used (n=${dimensionRows.length}): ${dimensionRows.map((d) => d.label).join(', ')}.`,
        `Complete-case persons: ${personIds.length} of ${built.candidatePersonCount} person(s) who had any usable value.`,
      ].filter(Boolean).join('\n');
    } else {
      const inputRun = await resolveLatentInputRun(db, studyId, studyTitle, args.runId, args.latentMethod);
      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Input F2 run "${inputRun.RUN_LABEL}" (ID_LATENT_RUN=${inputRun.ID_LATENT_RUN}, METHOD=${inputRun.METHOD}).`);

      const dims = await loadLatentDimensions(db, inputRun.ID_LATENT_RUN, args.dims);
      const loaded = await loadLatentMatrix(db, inputRun.ID_LATENT_RUN, dims);
      if (loaded.personIds.length < 2) {
        throw new Error(`Only ${loaded.personIds.length} complete-case person(s) in this latent run -- need at least 2 to form a pair.`);
      }

      spaceKind = 'LATENT';
      inputFeatureRunId = null;
      inputLatentRunId = inputRun.ID_LATENT_RUN;
      dimensionRows = dims.map((d, idx) => ({ order: idx + 1, idFeature: null, idLatentDim: d.ID_LATENT_DIM, label: d.DIMENSION_LABEL }));
      personIds = loaded.personIds;
      matrix = loaded.matrix;
      inputRunNotesLine = [
        `Input F2 run: ${inputRun.RUN_LABEL} (ID_LATENT_RUN=${inputRun.ID_LATENT_RUN}), METHOD=${inputRun.METHOD}, generated ${formatTimestampUtc(inputRun.GENERATED_AT)}.`,
        `Dimensions actually used (k=${dimensionRows.length} of ${inputRun.LATENT_DIMENSION_COUNT} available): ${dimensionRows.map((d) => d.label).join(', ')}.`,
        `Complete-case persons: ${personIds.length}.`,
        'A latent run is only ever comparable to another distance run built on the exact same latent run -- never across a PCA run, an autoencoder run and a UMAP run of the same input.',
      ].join('\n');
    }

    for (const row of matrix) assertFinite(row, 'the input (person, dimension) matrix');

    const pairCount = (personIds.length * (personIds.length - 1)) / 2;
    const metricsToRun = args.metric === 'ALL' ? METRICS : [args.metric];
    console.log(`Dimensions: ${dimensionRows.length}. Complete-case persons: ${personIds.length}. Pairs per metric: ${pairCount}.`);
    console.log(`Computing: ${metricsToRun.join(', ')}.`);

    for (const metric of metricsToRun) {
      let covPayload = null; // { regularization, lambda, condBefore, condAfter, covMatrix, invCov }
      let distanceFn;

      if (metric === 'EUCLIDEAN') {
        distanceFn = euclideanDistance;
      } else if (metric === 'RMS') {
        distanceFn = rmsDistance;
      } else {
        const covMatrix = sampleCovariance(matrix);
        const condBefore = conditionNumber(covMatrix);
        let regularization = args.covarianceRegularization;
        if (regularization === 'AUTO') regularization = condBefore > CONDITION_NUMBER_THRESHOLD ? 'SHRINKAGE' : 'NONE';
        const dbRegularization = regularization === 'SHRINKAGE' ? 'SHRINKAGE_DIAGONAL' : 'NONE';
        const lambda = dbRegularization === 'SHRINKAGE_DIAGONAL' ? (args.lambda ?? DEFAULT_AUTO_LAMBDA) : null;
        const regCovMatrix = dbRegularization === 'SHRINKAGE_DIAGONAL' ? shrinkToDiagonal(covMatrix, lambda) : covMatrix;
        const condAfter = dbRegularization === 'SHRINKAGE_DIAGONAL' ? conditionNumber(regCovMatrix) : condBefore;
        if (dbRegularization === 'NONE' && condBefore > CONDITION_NUMBER_THRESHOLD) {
          console.log(`WARNING: raw covariance condition number ~${condBefore.toExponential(2)} exceeds the ${CONDITION_NUMBER_THRESHOLD.toExponential(0)} threshold but --covariance-regularization none was forced -- the resulting inverse may be numerically unstable.`);
        }
        let invCov;
        try {
          invCov = invertMatrix(regCovMatrix);
        } catch (e) {
          throw new Error(`Could not invert the covariance matrix (condition number ~${condBefore.toExponential(2)}) even after regularization=${dbRegularization}: ${e.message}. Try --covariance-regularization shrinkage with a larger --lambda, or narrow --feature/--dims to reduce the dimension count relative to the complete-case person count.`);
        }
        distanceFn = (u, v) => mahalanobisDistance(u, v, invCov);
        covPayload = { regularization: dbRegularization, lambda, condBefore, condAfter, covMatrix, invCov };
        console.log(`Mahalanobis: condition number before regularization ~${condBefore.toExponential(2)}; regularization=${dbRegularization}${lambda !== null ? ` (lambda=${lambda})` : ''}; condition number after ~${condAfter.toExponential(2)}.`);
      }

      const notesLines = [
        inputRunNotesLine,
        `Metric: ${metric}.`,
        metric === 'MAHALANOBIS'
          ? `Covariance estimated from this run's own ${personIds.length}-person complete-case sample (sample covariance, divisor n-1). Regularization=${covPayload.regularization}${covPayload.lambda !== null ? `, lambda=${covPayload.lambda}` : ''}. Condition number before/after: ${covPayload.condBefore.toExponential(4)} / ${covPayload.condAfter.toExponential(4)}.`
          : metric === 'RMS'
            ? 'dRMS = dE / sqrt(n) -- same pairwise ordering as EUCLIDEAN within this run; only the scale differs.'
            : 'dE depends only on coordinates, units and scale -- not on any interpretive category.',
        'Distance here measures how far apart two OBSERVED profiles are -- proximity/distance is not evidence of a causal mechanism, and is never, by itself, a claim about a metaphysical correspondence (chakra, Thomistic Way, septenary level) or a clinical/diagnostic conclusion.',
      ].filter(Boolean).join('\n');

      if (args.dryRun) {
        console.log(`[DRY RUN] [${metric}] Would write 1 GDX_HNF_DISTANCE_RUN row, ${dimensionRows.length} GDX_HNF_DISTANCE_DIMENSION row(s), ` +
          `${metric === 'MAHALANOBIS' ? (dimensionRows.length * (dimensionRows.length + 1)) / 2 : 0} GDX_HNF_DISTANCE_COVARIANCE row(s), ${pairCount} GDX_HNF_DISTANCE_VALUE row(s).`);
        continue;
      }

      const runLabel = `${args.study}_${args.space}_${metric}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const runRow = returningRow(await query(db, `
        INSERT INTO GDX_HNF_DISTANCE_RUN
          (ID_STUDY, SPACE_KIND, ID_INPUT_FEATURE_RUN, ID_INPUT_LATENT_RUN, METRIC, RUN_LABEL, DIMENSION_COUNT,
           PERSON_COUNT, PAIR_COUNT, COVARIANCE_SOURCE, COVARIANCE_REGULARIZATION, REGULARIZATION_LAMBDA,
           CONDITION_NUMBER_BEFORE_REG, CONDITION_NUMBER_AFTER_REG, GENERATED_BY, NOTES)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_DISTANCE_RUN`,
        [studyId, spaceKind, inputFeatureRunId, inputLatentRunId, metric, runLabel, dimensionRows.length,
          personIds.length, pairCount,
          metric === 'MAHALANOBIS' ? 'RUN_COMPLETE_CASE_SAMPLE' : null,
          metric === 'MAHALANOBIS' ? covPayload.regularization : null,
          metric === 'MAHALANOBIS' ? covPayload.lambda : null,
          metric === 'MAHALANOBIS' ? covPayload.condBefore : null,
          metric === 'MAHALANOBIS' ? covPayload.condAfter : null,
          'F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES', notesLines]));
      const distanceRunId = runRow.ID_DISTANCE_RUN;

      for (const d of dimensionRows) {
        await query(db, 'INSERT INTO GDX_HNF_DISTANCE_DIMENSION (ID_DISTANCE_RUN, DIMENSION_ORDER, ID_FEATURE, ID_LATENT_DIM) VALUES (?, ?, ?, ?)',
          [distanceRunId, d.order, d.idFeature, d.idLatentDim]);
      }

      let covRowCount = 0;
      if (metric === 'MAHALANOBIS') {
        const n = dimensionRows.length;
        for (let a = 0; a < n; a++) {
          for (let b = a; b < n; b++) {
            await query(db, 'INSERT INTO GDX_HNF_DISTANCE_COVARIANCE (ID_DISTANCE_RUN, ROW_ORDER, COL_ORDER, COV_VALUE, INV_COV_VALUE) VALUES (?, ?, ?, ?, ?)',
              [distanceRunId, a + 1, b + 1, covPayload.covMatrix[a][b], covPayload.invCov[a][b]]);
            covRowCount += 1;
          }
        }
      }

      let pairRowCount = 0;
      for (let i = 0; i < personIds.length; i++) {
        for (let j = i + 1; j < personIds.length; j++) {
          const value = distanceFn(matrix[i], matrix[j]);
          if (!Number.isFinite(value)) {
            throw new Error(`Computed a non-finite ${metric} distance for persons (${personIds[i]}, ${personIds[j]}) -- refusing to write NaN/Infinity.`);
          }
          await query(db, 'INSERT INTO GDX_HNF_DISTANCE_VALUE (ID_DISTANCE_RUN, ID_PERSON_A, ID_PERSON_B, DISTANCE_VALUE) VALUES (?, ?, ?, ?)',
            [distanceRunId, personIds[i], personIds[j], value]);
          pairRowCount += 1;
        }
      }

      console.log(`\nWrote GDX_HNF_DISTANCE_RUN ID_DISTANCE_RUN=${distanceRunId} ("${runLabel}"):`);
      console.log(`  ${dimensionRows.length} GDX_HNF_DISTANCE_DIMENSION row(s)`);
      console.log(`  ${covRowCount} GDX_HNF_DISTANCE_COVARIANCE row(s)`);
      console.log(`  ${pairRowCount} GDX_HNF_DISTANCE_VALUE row(s)`);
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
