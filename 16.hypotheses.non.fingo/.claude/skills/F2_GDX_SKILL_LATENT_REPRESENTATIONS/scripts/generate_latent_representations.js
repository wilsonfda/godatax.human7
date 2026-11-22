#!/usr/bin/env node
/**
 * F2_GDX_SKILL_LATENT_REPRESENTATIONS (F2)
 *
 * For one study, fits a latent representation h(t) = f_theta(z(t)) on top of the z-scored feature
 * vectors F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS, F1) already wrote into
 * GDX_HNF_FEATURE_VALUE, and records the result into the GDX_HNF_LATENT_* tables (see
 * ../../../hypotheses_non_fingo_latent_representations_model_firebird25.sql).
 *
 * Three methods, all writing the exact same GDX_HNF_LATENT_* shape:
 *   --method pca          linear, h = W^T (z - mean_z), W^T W = I -- fit directly in this script
 *                         via the `ml-pca` package's SVD method. No subprocess, no extra runtime.
 *   --method autoencoder  non-linear, h = f_theta(z) / z_hat = g_phi(h) -- fit by spawning
 *                         scripts/fit_latent.py (Python 3 + numpy + scikit-learn), which trains a
 *                         symmetric MLPRegressor encoder/decoder and reads out the bottleneck
 *                         activation as h. See fit_latent.py's own docstring for exactly how.
 *   --method umap          non-linear, neighborhood-preserving -- fit by the same
 *                         scripts/fit_latent.py subprocess, via the real `umap-learn` package
 *                         (never approximated with t-SNE/PCA/anything else under the UMAP label).
 * autoencoder/umap need Python 3 with the packages in ../requirements.txt installed first (`python
 * -m pip install -r ../requirements.txt`) -- pca needs nothing beyond this folder's own
 * node_modules. See this skill's SKILL.md, "Current status".
 *
 * Never re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
 * 7.multidimensional.database or 9.knowledge.graph directly -- only GDX_HNF_FEATURE_SPACE_RUN /
 * GDX_HNF_FEATURE_VALUE / GDX_HNF_FEATURE_DICTIONARY / GDX_HNF_PERSPECTIVE, already assembled and
 * z-scored by MFS. See SKILL.md "What it reads -- and deliberately does NOT re-read".
 *
 * Usage:
 *   node generate_latent_representations.js --study <slug> [--method pca] [--dims <k>]
 *     [--run-id <id>] [--feature <code-substring>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>    REQUIRED outside --sample. Same slug MFS/F1_GDX_SKILL_MFS_GRAPH use -- resolves
 *                      to GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                      study.title.
 *   --method           pca (default) | autoencoder | umap.
 *   --dims <k>          number of latent dimensions to keep. Default: min(10, usable feature
 *                      count, complete-case person count - 1) for pca/autoencoder; min(2, that
 *                      same ceiling) for umap (2D is the standard UMAP visualization target). Must
 *                      be between 1 and min(usable feature count, complete-case person count - 1).
 *   --run-id <id>       optional. Fit on a specific GDX_HNF_FEATURE_SPACE_RUN.ID_RUN instead of the
 *                      latest ZSCORE run for this study (errors if that run is not ZSCORE, or
 *                      belongs to a different study).
 *   --feature <text>    optional. Only input features whose FEATURE_CODE contains this text
 *                      (case-insensitive) are candidates, e.g. --feature "PSY.VAR." to fit on the
 *                      psychometric perspective only (recommended today -- see SKILL.md on why a
 *                      run mixing Psi and the still-sparse Phi perspective collapses complete-case
 *                      coverage to very few persons).
 *   --random-seed <n>   default 42. Passed to the autoencoder's weight initialization/training and
 *                      to UMAP's own stochastic layout -- pca is deterministic (SVD), so this is
 *                      ignored (and RANDOM_SEED stays NULL) for --method pca.
 *   --autoencoder-max-iter <n>  default 2000. --method autoencoder only.
 *   --umap-n-neighbors <n>       optional. --method umap only; default: fit_latent.py's own
 *                      default (15), capped to this run's own complete-case person count.
 *   --umap-min-dist <d>           default 0.1. --method umap only.
 *   --intake-dir <path> optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run           computes everything (candidate/used features, complete-case persons,
 *                      explained variance where applicable) and logs it, writing no row.
 *   --sample             fits PCA on small embedded synthetic data instead of connecting to
 *                      Firebird, and only ever prints the result to the console -- never writes to
 *                      the database (there is no real GDX_PSY_PERSON/GDX_HNF_FEATURE_SPACE_RUN for
 *                      fabricated sample ids to point at). PCA only -- autoencoder/umap need the
 *                      Python subprocess, exercised instead via --dry-run against a real study.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Firebird = require('node-firebird');
const { PCA } = require('ml-pca');

const IMPLEMENTED_METHODS = ['PCA', 'AUTOENCODER', 'UMAP'];
const DIMENSION_LABEL_PREFIX = { PCA: 'PC', AUTOENCODER: 'LATENT_', UMAP: 'UMAP_' };

function parseArgs(argv) {
  const args = {
    study: null, method: 'PCA', dims: null, runId: null, feature: null,
    randomSeed: 42, autoencoderMaxIter: 2000, umapNNeighbors: null, umapMinDist: 0.1,
    intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--method') args.method = String(argv[++i] || '').toUpperCase();
    else if (a === '--dims') args.dims = parseInt(argv[++i], 10);
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--random-seed') args.randomSeed = parseInt(argv[++i], 10);
    else if (a === '--autoencoder-max-iter') args.autoencoderMaxIter = parseInt(argv[++i], 10);
    else if (a === '--umap-n-neighbors') args.umapNNeighbors = parseInt(argv[++i], 10);
    else if (a === '--umap-min-dist') args.umapMinDist = parseFloat(argv[++i]);
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug MFS/F1_GDX_SKILL_MFS_GRAPH use), unless --sample is passed.');
  }
  if (!IMPLEMENTED_METHODS.includes(args.method)) {
    throw new Error(`--method ${args.method} is not recognized. Supported: ${IMPLEMENTED_METHODS.join(', ')}.`);
  }
  if (args.sample && args.method !== 'PCA') {
    throw new Error('--sample only exercises --method pca (no Firebird/Python involved). Use --dry-run against a real --study to exercise autoencoder/umap.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export ` +
      `the vars before running this script (or pass --sample to exercise the PCA fit with no database connection).`
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

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string. Plain template-literal
 * interpolation of a Date calls Date.prototype.toString(), which renders its timezone NAME in the
 * OS's configured locale (e.g. a non-English name on a non-English-locale machine) -- this keeps
 * every timestamp written into GDX_HNF_LATENT_RUN.NOTES and logged to the console in English. */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F2_GDX_SKILL_LATENT_REPRESENTATIONS/scripts) -- same
 * depth/shape as the sibling skills in this folder. */
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

/** Resolves the input F1 run: an explicit --run-id (validated to belong to this study and be
 * NORMALIZATION_METHOD='ZSCORE'), or else the latest ZSCORE run for this study. Same posture
 * F1_GDX_SKILL_MFS_GRAPH already takes -- only a ZSCORE run's NORMALIZED_VALUE is a real z-score, and
 * every formula this skill fits on top of it assumes that. */
async function resolveInputRun(db, studyId, studyTitle, runId) {
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
        `PCA's own centering/variance formulas assume a real z-score input. Run F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE ` +
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

/** Candidate input features for this latent run: every feature F1 included in the input run,
 * minus NOMINAL-scale features (no sensible numeric input for PCA) and
 * IS_METAPHYSICAL_INTERPRETATION=1 features (an interpretive ontology, never a measurement -- see
 * this repo's CLAUDE.md "Empirical finding != interpretive reading"; MFS never sets this flag
 * today, so this exclusion is a no-op in practice but stays as a hard rule for any future writer
 * of GDX_HNF_FEATURE_DICTIONARY), further narrowed by --feature if passed. Returns both the
 * surviving candidates and the excluded ones (with why), so nothing is dropped unexplained.
 */
async function loadCandidateFeatures(db, inputRunId, featureFilter) {
  const rows = await query(db, `
    SELECT M.FEATURE_ORDER, D.ID_FEATURE, D.FEATURE_CODE, D.NAME, D.FEATURE_TYPE, D.IS_METAPHYSICAL_INTERPRETATION,
           P.NAME_EN AS PERSPECTIVE_NAME_EN
    FROM GDX_HNF_FEATURE_RUN_MEMBER M
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = M.ID_FEATURE
    JOIN GDX_HNF_PERSPECTIVE P ON P.ID_PERSPECTIVE = D.ID_PERSPECTIVE
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

/** Real, non-missing z-scores for the input run, restricted to the given feature ids (filtered
 * client-side -- simpler and safe at this project's current data volume than building a dynamic
 * IN-list). Same IS_MISSING=0 AND NORMALIZED_VALUE IS NOT NULL filter F1_GDX_SKILL_MFS_GRAPH already
 * uses -- a missing or un-normalizable value is never turned into a fabricated input. */
async function loadFeatureValues(db, inputRunId, featureIdSet) {
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_PERSON, ID_FEATURE`, [inputRunId]);
  return rows.filter((r) => featureIdSet.has(r.ID_FEATURE));
}

/** Reduces F1's per-(person, feature[, session]) grain to exactly one scalar per (person,
 * feature): the mean of a person's own NORMALIZED_VALUE rows for that feature in this run. For a
 * dense psychometric feature this is a no-op (exactly one row already); for a sparse
 * cardiac-coherence feature with several sessions, this averages across that person's own
 * sessions -- the same averaging principle MFS itself already applies one level down (averaging a
 * session's own HRV windows). See SKILL.md "Turning F1's per-(person, feature, session) grain into
 * one row per person". Returns Map(personId -> Map(featureId -> meanZ)). */
function aggregatePersonFeatureMeans(valueRows) {
  const sums = new Map(); // personId -> Map(featureId -> {sum, count})
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

/** Builds the COMPLETE_CASES input matrix (see GDX_HNF_LATENT_RUN.INPUT_SELECTION): drops any
 * candidate feature with zero observations anywhere in this run's sample, then keeps only persons
 * who have a real, non-missing value on every one of the remaining features. Per CLAUDE.md "Never
 * invent missing data", a person failing this is simply excluded, never imputed. */
function buildCompleteCaseMatrix(personFeatureMeans, candidates) {
  const featuresWithData = new Set();
  for (const perFeature of personFeatureMeans.values()) {
    for (const featureId of perFeature.keys()) featuresWithData.add(featureId);
  }
  const droppedZeroObservation = candidates.filter((f) => !featuresWithData.has(f.ID_FEATURE)).map((f) => f.FEATURE_CODE);
  const usableFeatures = candidates.filter((f) => featuresWithData.has(f.ID_FEATURE));

  const allPersonIds = [...personFeatureMeans.keys()].sort((a, b) => a - b);
  const personIds = allPersonIds.filter((pid) => {
    const perFeature = personFeatureMeans.get(pid);
    return usableFeatures.every((f) => perFeature.has(f.ID_FEATURE));
  });

  const matrix = personIds.map((pid) => {
    const perFeature = personFeatureMeans.get(pid);
    return usableFeatures.map((f) => perFeature.get(f.ID_FEATURE));
  });

  return { usableFeatures, droppedZeroObservation, personIds, matrix, candidatePersonCount: allPersonIds.length };
}

/** Default: min(10, usable feature count, complete-case person count - 1) for pca/autoencoder, or
 * min(2, that same ceiling) for umap (2D is the standard UMAP visualization target -- see
 * SKILL.md). A conservative cap so a small complete-case sample never silently asks for more
 * components than it can support. Explicit --dims is validated against the same ceiling
 * regardless of method. */
function resolveDims(requestedDims, nFeatures, personCount, method) {
  const cap = Math.min(nFeatures, personCount - 1);
  if (cap < 1) {
    throw new Error(
      `Only ${personCount} complete-case person(s) across ${nFeatures} usable feature(s) -- this method needs at ` +
      `least 2 persons and at least 1 usable feature with some variance. Try a narrower --feature filter to shrink ` +
      `the feature set (and so admit more complete cases), or pick a different --run-id.`
    );
  }
  if (requestedDims !== null && requestedDims !== undefined && !Number.isNaN(requestedDims)) {
    if (requestedDims < 1 || requestedDims > cap) {
      throw new Error(`--dims must be between 1 and ${cap} for this run's ${nFeatures} usable feature(s) and ${personCount} complete-case person(s) (got ${requestedDims}).`);
    }
    return requestedDims;
  }
  return Math.min(method === 'UMAP' ? 2 : 10, cap);
}

/** Fits PCA via ml-pca's SVD method, centered (mean_z computed from THIS run's own complete-case
 * submatrix -- generally not exactly 0 even though every input column is already a z-score,
 * because complete-case filtering can drop a different subset of persons per feature) and NOT
 * further scaled (F1 already standardized every input column; scaling again here would
 * double-normalize). Returns plain 2D arrays (not ml-matrix Matrix objects) so the caller's
 * DB-writing code can treat every method's fit result identically. */
function computePcaFit(matrix, dims) {
  const pca = new PCA(matrix, { center: true, scale: false });
  const explainedAll = pca.getExplainedVariance();
  const maxComponents = explainedAll.length;
  if (dims > maxComponents) {
    throw new Error(`Requested --dims ${dims} exceeds the ${maxComponents} component(s) this fit actually produced.`);
  }
  const scores = pca.predict(matrix, { nComponents: dims }).to2DArray();
  const loadings = pca.getLoadings().to2DArray(); // maxComponents x nFeatures -- caller uses rows [0, dims)
  return {
    scores, explainedAll, loadings, maxComponents,
    reconstructionLoss: null, randomSeed: null,
    methodParams: { library: 'ml-pca', method: 'SVD', center: true, scale: false, dimsRequested: dims },
  };
}

/** Spawns scripts/fit_latent.py, writes `payload` as JSON to its stdin, and resolves with its
 * parsed stdout JSON. Used for --method autoencoder/umap only -- pca never shells out. Rejects
 * with a clear, actionable message (naming requirements.txt) on a missing interpreter or a
 * non-zero exit, rather than a raw spawn/parse error. */
function runPythonFit(payload) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || 'python';
    const scriptPath = path.join(__dirname, 'fit_latent.py');
    const proc = spawn(pythonBin, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => reject(new Error(
      `Failed to launch Python ("${pythonBin}"): ${err.message}. Install Python 3 and ` +
      `"python -m pip install -r ../requirements.txt" (numpy, scikit-learn for --method autoencoder; ` +
      `also umap-learn for --method umap), or set PYTHON_BIN to a working interpreter path.`
    )));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`fit_latent.py exited with code ${code}:\n${(stderr || stdout).trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Could not parse fit_latent.py's output as JSON: ${e.message}\nRaw stdout: ${stdout.slice(0, 2000)}`));
      }
    });
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

/** Fits AUTOENCODER or UMAP via the Python subprocess. Returns the same shape computePcaFit()
 * does, with explainedAll/loadings left null (neither method has a per-component variance share
 * or a fixed per-feature coefficient -- see this skill's SKILL.md and the DDL file's own header). */
async function fitAutoencoderOrUmap(method, matrix, dims, args) {
  const payload = { method, matrix, dims, randomSeed: args.randomSeed };
  if (method === 'AUTOENCODER') payload.autoencoder = { maxIter: args.autoencoderMaxIter };
  if (method === 'UMAP') payload.umap = { nNeighbors: args.umapNNeighbors || null, minDist: args.umapMinDist };

  const result = await runPythonFit(payload);
  if (!Array.isArray(result.scores) || result.scores.length !== matrix.length) {
    throw new Error(`fit_latent.py returned ${Array.isArray(result.scores) ? result.scores.length : 'non-array'} score row(s), expected ${matrix.length}.`);
  }
  return {
    scores: result.scores, explainedAll: null, loadings: null, maxComponents: dims,
    reconstructionLoss: result.reconstructionLoss === undefined ? null : result.reconstructionLoss,
    randomSeed: args.randomSeed,
    methodParams: result.methodParams || {},
  };
}

/** Small, explicitly-labeled embedded sample for --sample: 10 synthetic "persons" over 4
 * correlated "features" (two pairs, each pair correlated with the other member so PCA has
 * something real to compress) -- NOT from any real study. Mirrors the --sample convention the
 * other skills in this folder already use. */
function buildSampleMatrix() {
  const featureCodes = ['SAMPLE.PSY.VAR.A', 'SAMPLE.PSY.VAR.B', 'SAMPLE.PSY.VAR.C', 'SAMPLE.PSY.VAR.D'];
  const base1 = [1.2, -0.4, 0.8, -1.1, 0.3, -0.9, 1.5, -1.7, 0.6, -0.2];
  const base2 = [0.5, 1.1, -0.7, 0.9, -1.3, 0.2, -0.6, 1.0, -1.4, 0.8];
  const matrix = base1.map((v, i) => [v, v * 0.9 + 0.05 * base2[i], base2[i], base2[i] * 0.85 - 0.05 * v]);
  const personIds = matrix.map((_, i) => `SAMPLE-${i + 1}`);
  return { featureCodes, personIds, matrix };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.sample) {
    const { featureCodes, personIds, matrix } = buildSampleMatrix();
    const dims = resolveDims(args.dims, featureCodes.length, personIds.length, 'PCA');
    const { scores, explainedAll, loadings } = computePcaFit(matrix, dims);
    console.log(`[SAMPLE] PCA fit on ${personIds.length} synthetic person(s) x ${featureCodes.length} synthetic feature(s), keeping ${dims} component(s). Never written to the database.`);
    console.log('Explained variance ratio per kept component:', explainedAll.slice(0, dims).map((v) => v.toFixed(4)));
    console.log('Cumulative explained variance (kept components):', explainedAll.slice(0, dims).reduce((a, b) => a + b, 0).toFixed(4));
    console.log('Loadings (component x feature):');
    for (let k = 0; k < dims; k++) {
      const row = featureCodes.map((code, j) => `${code}=${loadings[k][j].toFixed(4)}`).join(', ');
      console.log(`  PC${k + 1}: ${row}`);
    }
    console.log('Scores (first 3 persons x kept components):');
    for (let p = 0; p < Math.min(3, personIds.length); p++) {
      const row = Array.from({ length: dims }, (_, k) => scores[p][k].toFixed(4)).join(', ');
      console.log(`  ${personIds[p]}: ${row}`);
    }
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
    const inputRun = await resolveInputRun(db, studyId, studyTitle, args.runId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Input run "${inputRun.RUN_LABEL}" (ID_RUN=${inputRun.ID_RUN}), method=${inputRun.NORMALIZATION_METHOD}.`);

    const { candidates, excludedNominal, excludedMetaphysical, excludedByFilter } = await loadCandidateFeatures(db, inputRun.ID_RUN, args.feature);
    if (candidates.length === 0) {
      throw new Error(args.feature
        ? `No eligible (non-NOMINAL, non-metaphysical) feature in input run ID_RUN=${inputRun.ID_RUN} has a FEATURE_CODE containing "${args.feature}".`
        : `Input run ID_RUN=${inputRun.ID_RUN} has no eligible (non-NOMINAL, non-metaphysical) features -- nothing to fit.`);
    }

    const featureIdSet = new Set(candidates.map((f) => f.ID_FEATURE));
    const valueRows = await loadFeatureValues(db, inputRun.ID_RUN, featureIdSet);
    const personFeatureMeans = aggregatePersonFeatureMeans(valueRows);
    const { usableFeatures, droppedZeroObservation, personIds, matrix, candidatePersonCount } =
      buildCompleteCaseMatrix(personFeatureMeans, candidates);

    if (usableFeatures.length < 2) {
      throw new Error(`Only ${usableFeatures.length} usable feature(s) with real observations in this run -- this method needs at least 2. Try a broader --feature filter or a different --run-id.`);
    }

    const dims = resolveDims(args.dims, usableFeatures.length, personIds.length, args.method);
    console.log(`Candidates: ${candidates.length}. Usable (>=1 real observation): ${usableFeatures.length}. Complete-case persons: ${personIds.length} of ${candidatePersonCount} who had any usable value.`);
    console.log(`Fitting ${args.method}, keeping ${dims} dimension(s) ...`);

    const fit = args.method === 'PCA'
      ? computePcaFit(matrix, dims)
      : await fitAutoencoderOrUmap(args.method, matrix, dims, args);
    const { scores, explainedAll, loadings, maxComponents, reconstructionLoss, randomSeed, methodParams } = fit;

    if (args.method === 'PCA') {
      const cumulativeExplained = explainedAll.slice(0, dims).reduce((a, b) => a + b, 0);
      console.log(`Explained variance ratio, kept components: ${explainedAll.slice(0, dims).map((v) => v.toFixed(4)).join(', ')} (cumulative ${cumulativeExplained.toFixed(4)}).`);
    } else if (args.method === 'AUTOENCODER') {
      console.log(`Reconstruction loss (mean squared error): ${reconstructionLoss.toFixed(6)}. Architecture: ${methodParams.architecture}, ${methodParams.actualIterations} iteration(s).`);
    } else {
      console.log(`UMAP fit complete (n_neighbors=${methodParams.nNeighbors}, min_dist=${methodParams.minDist}). UMAP has no reconstruction loss or explained variance -- neither is a meaningful concept for this method.`);
    }

    const labelPrefix = DIMENSION_LABEL_PREFIX[args.method];
    const dimensionLabels = Array.from({ length: dims }, (_, k) => `${labelPrefix}${k + 1}`);

    const notesLines = [
      `Input run: ${inputRun.RUN_LABEL} (ID_RUN=${inputRun.ID_RUN}), method ${inputRun.NORMALIZATION_METHOD}, generated ${formatTimestampUtc(inputRun.GENERATED_AT)}.`,
      `Candidate features from input run: ${candidates.length}.`,
      excludedNominal.length ? `Excluded before fitting (NOMINAL scale, no sensible numeric input for this method): ${excludedNominal.join(', ')}.` : null,
      excludedMetaphysical.length ? `Excluded before fitting (metaphysical-interpretation flag set): ${excludedMetaphysical.join(', ')}.` : null,
      excludedByFilter.length ? `Excluded by --feature "${args.feature}": ${excludedByFilter.join(', ')}.` : null,
      droppedZeroObservation.length ? `Excluded (zero real observations in this run's sample): ${droppedZeroObservation.join(', ')}.` : null,
      `Features actually used (n=${usableFeatures.length}): ${usableFeatures.map((f) => f.FEATURE_CODE).join(', ')}.`,
      `Complete-case persons: ${personIds.length} of ${candidatePersonCount} person(s) who had any usable value for at least one used feature.`,
      args.method === 'PCA'
        ? `Retained ${dims} of ${maxComponents} computable component(s); cumulative explained variance = ${explainedAll.slice(0, dims).reduce((a, b) => a + b, 0).toFixed(6)}.`
        : `Retained ${dims} dimension(s).`,
      `Dimension labels (${dimensionLabels[0]}..${dimensionLabels[dimensionLabels.length - 1]}) are neutral machine labels only -- naming one as a psychological construct requires a separate validating analysis, never implied by this run alone.`,
      args.method === 'PCA'
        ? "Loadings and scores reflect only this run's own complete-case training sample -- not directly comparable to a PCA fit on a different sample or a different feature set."
        : args.method === 'AUTOENCODER'
          ? "Scores reflect only this run's own complete-case training sample and this specific architecture/random seed -- not directly comparable to a different autoencoder fit, and distances in this space are only meaningful after separately defining their own scale (an autoencoder can also memorize a small sample, producing distances with no stable meaning)."
          : "Global distances between points/clusters in this UMAP projection can be distorted relative to the original space -- no cluster or group claim is implied by this run; interpreting a visual grouping needs separate validation. A different random seed or --umap-n-neighbors/--umap-min-dist can produce a visibly different layout of the same data.",
      'A PCA run, an autoencoder run, and a UMAP run of the same input are three independent, non-interchangeable representations -- never merged or compared as if they shared one space.',
    ].filter(Boolean);

    if (args.dryRun) {
      console.log('[DRY RUN] Would write 1 GDX_HNF_LATENT_RUN row, ' +
        `${usableFeatures.length} GDX_HNF_LATENT_RUN_FEATURE row(s), ${dims} GDX_HNF_LATENT_DIMENSION row(s), ` +
        `${dims * personIds.length} GDX_HNF_LATENT_VALUE row(s), ${loadings ? dims * usableFeatures.length : 0} GDX_HNF_LATENT_LOADING row(s).`);
      console.log('Notes:');
      notesLines.forEach((l) => console.log(`  - ${l}`));
      return;
    }

    const runLabel = `${args.study}_${args.method}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const runRow = returningRow(await query(db, `
      INSERT INTO GDX_HNF_LATENT_RUN
        (ID_INPUT_RUN, ID_STUDY, METHOD, RUN_LABEL, LATENT_DIMENSION_COUNT, INPUT_FEATURE_COUNT, PERSON_COUNT,
         INPUT_SELECTION, METHOD_PARAMS, RECONSTRUCTION_LOSS, RANDOM_SEED, GENERATED_BY, NOTES)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETE_CASES', ?, ?, ?, ?, ?) RETURNING ID_LATENT_RUN`,
      [inputRun.ID_RUN, studyId, args.method, runLabel, dims, usableFeatures.length, personIds.length,
        JSON.stringify(methodParams), reconstructionLoss, randomSeed, 'F2_GDX_SKILL_LATENT_REPRESENTATIONS', notesLines.join('\n')]));
    const latentRunId = runRow.ID_LATENT_RUN;

    let order = 0;
    for (const f of usableFeatures) {
      order += 1;
      await query(db, 'INSERT INTO GDX_HNF_LATENT_RUN_FEATURE (ID_LATENT_RUN, ID_FEATURE, FEATURE_ORDER) VALUES (?, ?, ?)',
        [latentRunId, f.ID_FEATURE, order]);
    }

    const dimIds = [];
    for (let k = 0; k < dims; k++) {
      const row = returningRow(await query(db, `
        INSERT INTO GDX_HNF_LATENT_DIMENSION (ID_LATENT_RUN, DIMENSION_ORDER, DIMENSION_LABEL, EXPLAINED_VARIANCE_RATIO)
        VALUES (?, ?, ?, ?) RETURNING ID_LATENT_DIM`,
        [latentRunId, k + 1, dimensionLabels[k], explainedAll ? explainedAll[k] : null]));
      dimIds.push(row.ID_LATENT_DIM);
    }

    for (let p = 0; p < personIds.length; p++) {
      for (let k = 0; k < dims; k++) {
        await query(db, `
          INSERT INTO GDX_HNF_LATENT_VALUE (ID_LATENT_RUN, ID_LATENT_DIM, ID_PERSON, COORDINATE_VALUE)
          VALUES (?, ?, ?, ?)`, [latentRunId, dimIds[k], personIds[p], scores[p][k]]);
      }
    }

    let loadingCount = 0;
    if (loadings) {
      for (let k = 0; k < dims; k++) {
        for (let j = 0; j < usableFeatures.length; j++) {
          await query(db, `
            INSERT INTO GDX_HNF_LATENT_LOADING (ID_LATENT_DIM, ID_FEATURE, LOADING_VALUE)
            VALUES (?, ?, ?)`, [dimIds[k], usableFeatures[j].ID_FEATURE, loadings[k][j]]);
          loadingCount += 1;
        }
      }
    }

    console.log(`\nWrote GDX_HNF_LATENT_RUN ID_LATENT_RUN=${latentRunId} ("${runLabel}"):`);
    console.log(`  ${usableFeatures.length} GDX_HNF_LATENT_RUN_FEATURE row(s)`);
    console.log(`  ${dims} GDX_HNF_LATENT_DIMENSION row(s)`);
    console.log(`  ${dims * personIds.length} GDX_HNF_LATENT_VALUE row(s)`);
    console.log(`  ${loadingCount} GDX_HNF_LATENT_LOADING row(s)`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
