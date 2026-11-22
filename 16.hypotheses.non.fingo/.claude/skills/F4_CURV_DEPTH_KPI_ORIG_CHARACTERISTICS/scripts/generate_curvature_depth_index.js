#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS (F4)
 *
 * For one study, computes the Curvature Depth Index (CDI) of every complete-case person's own
 * observed, normalized profile z(t) -- already frozen by F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE
 * (MFS) in GDX_HNF_FEATURE_VALUE, a ZSCORE run -- against an explicit, frozen reference profile
 * z_ref. Two formulas, both an RMS distance in the same shape F3_GDX_SKILL_DISTANCE_SIMILARITY_
 * PROFILES already validates one layer down (its own METRIC='RMS'), applied here between one
 * observed profile and a reference instead of between two observed profiles:
 *
 *   CDIx(t)   = sqrt( (1/n) * sum_j (z_j(t) - z_j_ref)^2 )                          unweighted
 *   CDIx_w(t) = sqrt( sum_j w_j * (z_j(t) - z_j_ref)^2  /  sum_j w_j )               weighted
 *               w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to CDIx)
 *
 * Records the result into the GDX_HNF_CDI_* tables (see
 * ../../../hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql):
 *   GDX_HNF_CDI_REFERENCE_SET / GDX_HNF_CDI_REFERENCE_VALUE   the frozen reference z_ref
 *   GDX_HNF_CDI_RUN / GDX_HNF_CDI_RUN_FEATURE                 one run's own feature set and weights
 *   GDX_HNF_CDI_VALUE / GDX_HNF_CDI_VALUE_DETAIL               the CDI scalar per person, plus the
 *                                                              full per-feature difference vector
 *
 * This is the layer that defines "the center" a distance is measured from -- a materially
 * different, more consequential decision than F3's own "distance between two OBSERVED profiles",
 * which this skill deliberately never recomputes on its own. See SKILL.md for the full rationale
 * of the four reference bases (PERSONAL_BASELINE, STUDY_COHORT, POPULATION_REFERENCE,
 * INSTRUMENT_NORM).
 *
 * Never re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
 * 7.multidimensional.database or 9.knowledge.graph directly, and never re-normalizes a feature --
 * only GDX_HNF_FEATURE_SPACE_RUN / GDX_HNF_FEATURE_VALUE / GDX_HNF_FEATURE_DICTIONARY, already
 * assembled by F1, same posture F2/F3 already take one layer down.
 *
 * Usage:
 *   node generate_curvature_depth_index.js --study <slug>
 *     ( --reference-set-id <id>
 *       | --reference-type study_cohort|population_reference|personal_baseline|instrument_norm
 *           [--population-run-id <id>] [--subject <id_person>]
 *           [--baseline-sessions <m>] [--baseline-estimator mean|median]
 *           [--norm-file <path>] )
 *     [--run-id <id>] [--feature <code-substring>]
 *     [--weighted --weights-file <path>]
 *     [--reference-label <text>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>            REQUIRED outside --sample. Same slug MFS/F2/F3 use.
 *   --reference-set-id <id>   Reuse an already-frozen GDX_HNF_CDI_REFERENCE_SET instead of
 *                             building a new one. Mutually exclusive with --reference-type.
 *   --reference-type           study_cohort | population_reference | personal_baseline |
 *                             instrument_norm. Required when --reference-set-id is not given --
 *                             see SKILL.md "Four reference bases" for what each one means and
 *                             what it needs.
 *   --population-run-id <id>   REQUIRED for --reference-type population_reference: a DIFFERENT
 *                             ZSCORE GDX_HNF_FEATURE_SPACE_RUN.ID_RUN to source the reference
 *                             from (never the same run being evaluated -- that would silently
 *                             collapse this into study_cohort under a different label).
 *   --subject <id_person>      REQUIRED for --reference-type personal_baseline: the GDX_PSY_PERSON
 *                             whose own earliest sessions become the baseline.
 *   --baseline-sessions <m>    default 3. --reference-type personal_baseline only -- how many of
 *                             that person's own earliest real observations (by OBS_INSTANT) to
 *                             average per feature. Using fewer than requested (because fewer
 *                             exist) is reported in NOTES, never treated as an error.
 *   --baseline-estimator        mean (default) | median. --reference-type personal_baseline only.
 *   --norm-file <path>          REQUIRED for --reference-type instrument_norm: a JSON file
 *                             { "<FEATURE_CODE>": { "value": <number>, "dispersion": <number|null>,
 *                             "sampleSize": <integer> } }. A candidate feature absent from this
 *                             file gets no reference row at all -- never defaulted to a
 *                             placeholder value.
 *   --run-id <id>               optional. A specific GDX_HNF_FEATURE_SPACE_RUN.ID_RUN (must be
 *                             ZSCORE) to evaluate, instead of the study's latest.
 *   --feature <text>            optional. Only candidate features whose FEATURE_CODE contains
 *                             this text (case-insensitive) are considered -- same convention as
 *                             F2/F3 (recommended today: --feature "PSY.VAR.").
 *   --weighted                   compute CDIx_w instead of CDIx. Requires --weights-file.
 *   --weights-file <path>        REQUIRED with --weighted: a JSON file
 *                             { "<FEATURE_CODE>": <weight, number >= 0> }. Every feature that
 *                             survives all other exclusions must have an explicit entry --
 *                             nothing here is ever defaulted to 1 once --weighted is passed
 *                             (that would silently smuggle an unweighted feature into a
 *                             "weighted" run). All-zero weights is refused, never silently
 *                             computed as an undefined 0/0.
 *   --reference-label <text>     optional. Overrides the auto-generated REFERENCE_LABEL when
 *                             building a new reference set.
 *   --intake-dir <path>          optional override of the default new_study_intake/<slug>/
 *                             location.
 *   --dry-run                    computes everything (candidate/final features, reference
 *                             values, complete-case persons) and logs it, writing no row.
 *   --sample                     runs the two worked numeric examples from this layer's own
 *                             mathematical foundation on small, explicitly-labeled synthetic
 *                             data -- never connects to Firebird, never writes anything.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

const REFERENCE_TYPES = ['STUDY_COHORT', 'POPULATION_REFERENCE', 'PERSONAL_BASELINE', 'INSTRUMENT_NORM'];

function parseArgs(argv) {
  const args = {
    study: null, referenceSetId: null, referenceType: null, populationRunId: null, subject: null,
    baselineSessions: 3, baselineEstimator: 'MEAN', normFile: null, runId: null, feature: null,
    weighted: false, weightsFile: null, referenceLabel: null, intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--weighted') args.weighted = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--reference-set-id') args.referenceSetId = parseInt(argv[++i], 10);
    else if (a === '--reference-type') args.referenceType = String(argv[++i] || '').toUpperCase();
    else if (a === '--population-run-id') args.populationRunId = parseInt(argv[++i], 10);
    else if (a === '--subject') args.subject = parseInt(argv[++i], 10);
    else if (a === '--baseline-sessions') args.baselineSessions = parseInt(argv[++i], 10);
    else if (a === '--baseline-estimator') args.baselineEstimator = String(argv[++i] || '').toUpperCase();
    else if (a === '--norm-file') args.normFile = argv[++i];
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--weights-file') args.weightsFile = argv[++i];
    else if (a === '--reference-label') args.referenceLabel = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample) {
    if (!args.study) throw new Error('--study <slug> is required (same slug MFS/F2/F3 use), unless --sample is passed.');
    if (!args.referenceSetId && !args.referenceType) {
      throw new Error('Either --reference-set-id <id> (reuse) or --reference-type <type> (build new) is required.');
    }
    if (args.referenceSetId && args.referenceType) {
      throw new Error('--reference-set-id and --reference-type are mutually exclusive -- reuse an existing reference, or build a new one, not both.');
    }
    if (args.referenceType && !REFERENCE_TYPES.includes(args.referenceType)) {
      throw new Error(`--reference-type ${args.referenceType} is not recognized. Supported: ${REFERENCE_TYPES.map((t) => t.toLowerCase()).join(', ')}.`);
    }
    if (args.referenceType === 'POPULATION_REFERENCE' && !args.populationRunId) {
      throw new Error('--reference-type population_reference requires --population-run-id <id> (a DIFFERENT ZSCORE run to source the reference from).');
    }
    if (args.referenceType === 'PERSONAL_BASELINE' && !args.subject) {
      throw new Error('--reference-type personal_baseline requires --subject <id_person>.');
    }
    if (args.referenceType === 'INSTRUMENT_NORM' && !args.normFile) {
      throw new Error('--reference-type instrument_norm requires --norm-file <path> (this project has no automated source for instrument norms).');
    }
    if (!['MEAN', 'MEDIAN'].includes(args.baselineEstimator)) {
      throw new Error(`--baseline-estimator ${args.baselineEstimator} is not recognized. Supported: mean, median.`);
    }
    if (args.baselineSessions < 1) throw new Error('--baseline-sessions must be at least 1.');
    if (args.weighted && !args.weightsFile) {
      throw new Error('--weighted requires --weights-file <path> -- weights are never defaulted or invented.');
    }
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export ` +
      `the vars before running this script (or pass --sample to exercise the CDI formulas with no database connection).`
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
 * sibling F1/F2/F3 scripts: a plain template-literal interpolation of a Date renders its timezone
 * NAME in the OS's configured locale. */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS/scripts)
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
 * Resolving a ZSCORE GDX_HNF_FEATURE_SPACE_RUN -- identical posture to F2/F3's own scripts one
 * layer down (only a ZSCORE run's NORMALIZED_VALUE is a real z-score).
 * ------------------------------------------------------------------------------------------- */
async function resolveZscoreRun(db, studyId, studyTitle, runId, label) {
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `
      SELECT ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, GENERATED_AT
      FROM GDX_HNF_FEATURE_SPACE_RUN WHERE ID_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_FEATURE_SPACE_RUN with ID_RUN=${runId} (${label}).`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} (${label}) belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    if (run.NORMALIZATION_METHOD !== 'ZSCORE') {
      throw new Error(
        `GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} (${label}) used NORMALIZATION_METHOD='${run.NORMALIZATION_METHOD}', not 'ZSCORE' -- ` +
        `the CDI formula assumes a real z-score input. Run F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE with --normalization zscore first.`
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
      `No GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE' found for study "${studyTitle}" (${label}). Run ` +
      `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE --study ${JSON.stringify(studyTitle)} first.`
    );
  }
  return rows[0];
}

/** Candidate input features for this CDI run: every feature F1 included in the evaluated run,
 * minus NOMINAL-scale features (no sensible numeric input for an RMS-based formula) and
 * IS_METAPHYSICAL_INTERPRETATION=1 features (an interpretive ontology, never a measurement -- see
 * CLAUDE.md "Empirical finding != interpretive reading"), further narrowed by --feature if
 * passed. Identical logic to F2/F3's own scripts. */
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

/** Reduces F1's per-(person, feature[, session]) grain to one scalar per (person, feature) -- the
 * mean of a person's own NORMALIZED_VALUE rows for that feature in this run. Same averaging
 * principle F2/F3's own scripts already apply one level down. */
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

/* ---------------------------------------------------------------------------------------------
 * The CDI formulas themselves -- see the mathematical foundation in this file's own header.
 * ------------------------------------------------------------------------------------------- */

/** CDIx(t) = sqrt( (1/n) * sum_j (z_j(t) - z_j_ref)^2 ). */
function cdiUnweighted(current, reference) {
  let sumSq = 0;
  for (let j = 0; j < current.length; j++) {
    const d = current[j] - reference[j];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / current.length);
}

/** CDIx_w(t) = sqrt( sum_j w_j*(z_j(t)-z_j_ref)^2 / sum_j w_j ). w_j=1 for every j reduces this to
 * cdiUnweighted(). Refuses (never silently computes 0/0) when every weight is zero. */
function cdiWeighted(current, reference, weights) {
  let sumWeightedSq = 0;
  let sumWeights = 0;
  for (let j = 0; j < current.length; j++) {
    const d = current[j] - reference[j];
    sumWeightedSq += weights[j] * d * d;
    sumWeights += weights[j];
  }
  if (sumWeights <= 0) {
    throw new Error('Sum of weights must be positive -- all-zero weights make the weighted CDI undefined (0/0), refusing to compute it.');
  }
  return Math.sqrt(sumWeightedSq / sumWeights);
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
function populationStd(values) {
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length;
  return Math.sqrt(variance);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function assertFinite(values, label) {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`Non-finite value encountered in ${label} -- refusing to compute a CDI from NaN/Infinity input.`);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * Building a new reference set (one branch per REFERENCE_TYPE). Each returns
 * { referenceValuesByFeature: Map<ID_FEATURE, {value, dispersion, sampleSize}>, meta }.
 * ------------------------------------------------------------------------------------------- */

/** STUDY_COHORT / POPULATION_REFERENCE: the mean (and population std) of z(t), feature by
 * feature, across every complete real observation in one F1 run's own sample -- computed from
 * real data every time, never assumed to be exactly the zero vector. */
async function buildCohortReference(db, sourceRunId, candidateFeatureIds) {
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_FEATURE, ID_PERSON`, [sourceRunId]);

  const byFeature = new Map();
  for (const r of rows) {
    if (!candidateFeatureIds.has(r.ID_FEATURE)) continue;
    if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, []);
    byFeature.get(r.ID_FEATURE).push(Number(r.NORMALIZED_VALUE));
  }
  const referenceValuesByFeature = new Map();
  const missingFromSource = [];
  for (const featureId of candidateFeatureIds) {
    const values = byFeature.get(featureId);
    if (!values || values.length === 0) { missingFromSource.push(featureId); continue; }
    referenceValuesByFeature.set(featureId, {
      value: mean(values),
      dispersion: populationStd(values),
      sampleSize: values.length,
    });
  }
  return { referenceValuesByFeature, missingFromSource };
}

/** PERSONAL_BASELINE: the mean (or median) of ONE person's own earliest --baseline-sessions real
 * observations per feature, across any ZSCORE run of this same study (so a feature's own sparse,
 * multi-session grain -- e.g. physiological Phi -- is honored, and repeated applications of the
 * same study over time are honored too). Using fewer sessions than requested (because fewer real
 * ones exist) is reported, never treated as an error; zero real sessions excludes that feature
 * from the reference entirely. */
async function buildPersonalBaselineReference(db, studyId, subjectId, candidateFeatureIds, m, estimator) {
  const rows = await query(db, `
    SELECT V.ID_FEATURE, V.NORMALIZED_VALUE, V.OBS_INSTANT, V.ID_VALUE
    FROM GDX_HNF_FEATURE_VALUE V
    JOIN GDX_HNF_FEATURE_SPACE_RUN R ON R.ID_RUN = V.ID_RUN
    WHERE R.ID_STUDY = ? AND R.NORMALIZATION_METHOD = 'ZSCORE'
      AND V.ID_PERSON = ? AND V.IS_MISSING = 0 AND V.NORMALIZED_VALUE IS NOT NULL
    ORDER BY V.ID_FEATURE, V.OBS_INSTANT, V.ID_VALUE`, [studyId, subjectId]);

  const byFeature = new Map();
  for (const r of rows) {
    if (!candidateFeatureIds.has(r.ID_FEATURE)) continue;
    if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, []);
    byFeature.get(r.ID_FEATURE).push(Number(r.NORMALIZED_VALUE));
  }
  const referenceValuesByFeature = new Map();
  const missingFromSource = [];
  const fewerThanRequested = [];
  for (const featureId of candidateFeatureIds) {
    const all = byFeature.get(featureId);
    if (!all || all.length === 0) { missingFromSource.push(featureId); continue; }
    const used = all.slice(0, m);
    if (used.length < m) fewerThanRequested.push({ featureId, used: used.length, requested: m });
    referenceValuesByFeature.set(featureId, {
      value: estimator === 'MEDIAN' ? median(used) : mean(used),
      dispersion: used.length > 1 ? populationStd(used) : null,
      sampleSize: used.length,
    });
  }
  return { referenceValuesByFeature, missingFromSource, fewerThanRequested };
}

/** INSTRUMENT_NORM: values taken verbatim from a human-supplied JSON file keyed by FEATURE_CODE.
 * No automated source exists for this in the project -- a candidate feature absent from the file
 * gets no reference row at all, never a fabricated placeholder (per the project's own "Never
 * invent missing data" rule, explicitly including "do not fill an unavailable norm with 0.5 as if
 * it were a known ideal"). */
function buildInstrumentNormReference(normFilePath, candidates) {
  if (!fs.existsSync(normFilePath)) {
    throw new Error(`--norm-file not found: ${normFilePath}.`);
  }
  const raw = JSON.parse(fs.readFileSync(normFilePath, 'utf8'));
  const referenceValuesByFeature = new Map();
  const missingFromSource = [];
  for (const c of candidates) {
    const entry = raw[c.FEATURE_CODE];
    if (!entry || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      missingFromSource.push(c.ID_FEATURE);
      continue;
    }
    const sampleSize = Number.isInteger(entry.sampleSize) && entry.sampleSize > 0 ? entry.sampleSize : 1;
    referenceValuesByFeature.set(c.ID_FEATURE, {
      value: entry.value,
      dispersion: typeof entry.dispersion === 'number' && Number.isFinite(entry.dispersion) ? entry.dispersion : null,
      sampleSize,
    });
  }
  return { referenceValuesByFeature, missingFromSource };
}

/* ---------------------------------------------------------------------------------------------
 * --sample: the two worked numeric examples from this layer's own mathematical foundation, on
 * small, explicitly-labeled synthetic data (NOT from any real study) -- same convention F1/F2/F3's
 * own scripts already use for --sample.
 * ------------------------------------------------------------------------------------------- */
function runSample() {
  console.log('[SAMPLE] Worked example 1 -- unweighted CDIx, five features, a single fixed reference 0.5 on every feature:');
  const current1 = [0.8, 0.6, 0.4, 0.7, 0.5];
  const reference1 = [0.5, 0.5, 0.5, 0.5, 0.5];
  const cdi1 = cdiUnweighted(current1, reference1);
  console.log(`  current   = [${current1.join(', ')}]`);
  console.log(`  reference = [${reference1.join(', ')}]`);
  console.log(`  diff      = [${current1.map((v, j) => (v - reference1[j]).toFixed(4)).join(', ')}]`);
  console.log(`  CDIx = ${cdi1.toFixed(4)} (expected ~0.1732)`);

  console.log('\n[SAMPLE] Worked example 2 -- unweighted CDIx against a personal baseline, four features:');
  const baseline = [0.62, 0.50, 0.55, 0.44];
  const current2 = [0.70, 0.45, 0.61, 0.49];
  const cdi2 = cdiUnweighted(current2, baseline);
  console.log(`  baseline (personal reference) = [${baseline.join(', ')}]`);
  console.log(`  current session               = [${current2.join(', ')}]`);
  console.log(`  diff                          = [${current2.map((v, j) => (v - baseline[j]).toFixed(4)).join(', ')}]`);
  console.log(`  CDIx_personal = ${cdi2.toFixed(4)} (expected ~0.0612)`);

  console.log('\n[SAMPLE] Worked example 3 -- weighted CDIx_w, same five features as example 1, non-uniform weights:');
  const weights = [1, 1, 0.5, 0.5, 2];
  const cdi3 = cdiWeighted(current1, reference1, weights);
  console.log(`  weights = [${weights.join(', ')}]`);
  console.log(`  CDIx_w = ${cdi3.toFixed(4)}`);

  console.log('\n[SAMPLE] Worked example 4 -- all-zero weights is refused, not silently computed:');
  try {
    cdiWeighted(current1, reference1, [0, 0, 0, 0, 0]);
    console.log('  UNEXPECTED: did not throw.');
  } catch (e) {
    console.log(`  Refused as expected: ${e.message}`);
  }
  console.log('\nNone of the numbers above come from a real GDX_HUMAN study. Nothing is written to the database.');
}

/* ---------------------------------------------------------------------------------------------
 * Main.
 * ------------------------------------------------------------------------------------------- */
async function main() {
  const args = parseArgs(process.argv);

  if (args.sample) { runSample(); return; }

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
    const evaluatedRun = await resolveZscoreRun(db, studyId, studyTitle, args.runId, 'evaluated run');
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Evaluated F1 run "${evaluatedRun.RUN_LABEL}" (ID_RUN=${evaluatedRun.ID_RUN}).`);

    const { candidates, excludedNominal, excludedMetaphysical, excludedByFilter } = await loadCandidateFeatures(db, evaluatedRun.ID_RUN, args.feature);
    if (candidates.length === 0) {
      throw new Error(args.feature
        ? `No eligible (non-NOMINAL, non-metaphysical) feature in evaluated run ID_RUN=${evaluatedRun.ID_RUN} has a FEATURE_CODE containing "${args.feature}".`
        : `Evaluated run ID_RUN=${evaluatedRun.ID_RUN} has no eligible (non-NOMINAL, non-metaphysical) features.`);
    }
    const candidateFeatureIds = new Set(candidates.map((f) => f.ID_FEATURE));
    const candidateByFeatureId = new Map(candidates.map((f) => [f.ID_FEATURE, f]));

    // --- Resolve or build the reference set --------------------------------------------------
    let referenceSetId, referenceType, referenceValuesByFeature, referenceBuildNotes = [];

    if (args.referenceSetId) {
      const rsRows = await query(db, `
        SELECT ID_REFERENCE_SET, ID_STUDY, REFERENCE_TYPE, REFERENCE_LABEL
        FROM GDX_HNF_CDI_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [args.referenceSetId]);
      if (rsRows.length === 0) throw new Error(`No GDX_HNF_CDI_REFERENCE_SET with ID_REFERENCE_SET=${args.referenceSetId}.`);
      if (rsRows[0].ID_STUDY !== studyId) {
        throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${args.referenceSetId} belongs to a different study, not "${studyTitle}".`);
      }
      referenceSetId = rsRows[0].ID_REFERENCE_SET;
      referenceType = rsRows[0].REFERENCE_TYPE;
      console.log(`Reusing existing GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} (${referenceType}, "${rsRows[0].REFERENCE_LABEL}").`);

      const rvRows = await query(db, `
        SELECT ID_FEATURE, REFERENCE_VALUE, REFERENCE_DISPERSION, SAMPLE_SIZE
        FROM GDX_HNF_CDI_REFERENCE_VALUE WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
      referenceValuesByFeature = new Map(rvRows.map((r) => [r.ID_FEATURE, {
        value: Number(r.REFERENCE_VALUE), dispersion: r.REFERENCE_DISPERSION === null ? null : Number(r.REFERENCE_DISPERSION), sampleSize: r.SAMPLE_SIZE,
      }]));
    } else {
      referenceType = args.referenceType;
      let built, subjectId = null, populationRunRow = null;

      if (referenceType === 'STUDY_COHORT') {
        built = await buildCohortReference(db, evaluatedRun.ID_RUN, candidateFeatureIds);
      } else if (referenceType === 'POPULATION_REFERENCE') {
        if (args.populationRunId === evaluatedRun.ID_RUN) {
          throw new Error('--population-run-id must be a DIFFERENT run than the evaluated run -- otherwise this is a study_cohort reference, not a population_reference.');
        }
        populationRunRow = await resolveZscoreRun(db, studyId, studyTitle, args.populationRunId, 'population reference run');
        built = await buildCohortReference(db, populationRunRow.ID_RUN, candidateFeatureIds);
      } else if (referenceType === 'PERSONAL_BASELINE') {
        subjectId = args.subject;
        built = await buildPersonalBaselineReference(db, studyId, subjectId, candidateFeatureIds, args.baselineSessions, args.baselineEstimator);
        if (built.fewerThanRequested.length) {
          referenceBuildNotes.push(`Used fewer sessions than requested for: ${built.fewerThanRequested.map((x) => `${candidateByFeatureId.get(x.featureId).FEATURE_CODE} (${x.used}/${x.requested})`).join(', ')}.`);
        }
      } else {
        built = buildInstrumentNormReference(args.normFile, candidates);
      }

      if (built.missingFromSource && built.missingFromSource.length) {
        const codes = built.missingFromSource.map((id) => candidateByFeatureId.get(id).FEATURE_CODE).join(', ');
        referenceBuildNotes.push(`No reference value available (norm unavailable, not defaulted to any placeholder) for: ${codes}.`);
      }
      referenceValuesByFeature = built.referenceValuesByFeature;
      if (referenceValuesByFeature.size === 0) {
        throw new Error('The chosen reference has no value for any candidate feature -- nothing to compute a CDI against.');
      }

      if (args.dryRun) {
        console.log(`[DRY RUN] Would build a new GDX_HNF_CDI_REFERENCE_SET (${referenceType}) with ${referenceValuesByFeature.size} GDX_HNF_CDI_REFERENCE_VALUE row(s).`);
        referenceBuildNotes.forEach((n) => console.log(`  NOTE: ${n}`));
      } else {
        const referenceLabel = args.referenceLabel || `${args.study}_${referenceType}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const sourcePersonCount = (referenceType === 'STUDY_COHORT' || referenceType === 'POPULATION_REFERENCE')
          ? Math.max(...[...referenceValuesByFeature.values()].map((v) => v.sampleSize))
          : null;
        const rsRow = returningRow(await query(db, `
          INSERT INTO GDX_HNF_CDI_REFERENCE_SET
            (ID_STUDY, REFERENCE_TYPE, ID_SUBJECT, ID_INPUT_FEATURE_RUN, REFERENCE_LABEL,
             BASELINE_ESTIMATOR, BASELINE_SESSION_COUNT, SOURCE_PERSON_COUNT, GENERATED_BY, NOTES)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_REFERENCE_SET`,
          [studyId, referenceType, subjectId,
            referenceType === 'POPULATION_REFERENCE' ? populationRunRow.ID_RUN : evaluatedRun.ID_RUN,
            referenceLabel,
            referenceType === 'PERSONAL_BASELINE' ? args.baselineEstimator : null,
            referenceType === 'PERSONAL_BASELINE' ? args.baselineSessions : null,
            sourcePersonCount,
            'F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS', referenceBuildNotes.join('\n') || null]));
        referenceSetId = rsRow.ID_REFERENCE_SET;
        for (const [featureId, v] of referenceValuesByFeature.entries()) {
          await query(db, `
            INSERT INTO GDX_HNF_CDI_REFERENCE_VALUE (ID_REFERENCE_SET, ID_FEATURE, REFERENCE_VALUE, REFERENCE_DISPERSION, SAMPLE_SIZE)
            VALUES (?, ?, ?, ?, ?)`, [referenceSetId, featureId, v.value, v.dispersion, v.sampleSize]);
        }
        console.log(`Wrote GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} (${referenceType}, "${referenceLabel}") with ${referenceValuesByFeature.size} GDX_HNF_CDI_REFERENCE_VALUE row(s).`);
      }
    }

    // --- Final feature set = candidates that ALSO have a reference value ---------------------
    const finalFeatures = candidates.filter((f) => referenceValuesByFeature.has(f.ID_FEATURE));
    const droppedNoReference = candidates.filter((f) => !referenceValuesByFeature.has(f.ID_FEATURE)).map((f) => f.FEATURE_CODE);
    if (finalFeatures.length === 0) {
      throw new Error('No candidate feature has a reference value in the chosen reference set -- nothing to compute.');
    }

    // --- Weights ------------------------------------------------------------------------------
    let weightsByFeature = new Map(finalFeatures.map((f) => [f.ID_FEATURE, 1]));
    if (args.weighted) {
      if (!fs.existsSync(args.weightsFile)) throw new Error(`--weights-file not found: ${args.weightsFile}.`);
      const rawWeights = JSON.parse(fs.readFileSync(args.weightsFile, 'utf8'));
      const missingWeights = [];
      for (const f of finalFeatures) {
        const w = rawWeights[f.FEATURE_CODE];
        if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) { missingWeights.push(f.FEATURE_CODE); continue; }
        weightsByFeature.set(f.ID_FEATURE, w);
      }
      if (missingWeights.length) {
        throw new Error(`--weights-file is missing a valid (>= 0) weight for: ${missingWeights.join(', ')}. Every feature in a weighted run needs an explicit weight -- none are ever defaulted.`);
      }
      const sumWeights = [...weightsByFeature.values()].reduce((a, b) => a + b, 0);
      if (sumWeights <= 0) {
        throw new Error('Sum of weights in --weights-file is zero or negative for the final feature set -- refusing to compute an undefined (0/0) weighted CDI.');
      }
    }

    // --- Complete-case (person, feature) matrix over the evaluated run ------------------------
    const featureIdSet = new Set(finalFeatures.map((f) => f.ID_FEATURE));
    const valueRows = await loadFeatureValues(db, evaluatedRun.ID_RUN, featureIdSet);
    const personFeatureMeans = aggregatePersonFeatureMeans(valueRows);

    const allPersonIds = [...personFeatureMeans.keys()].sort((a, b) => a - b);
    const personIds = allPersonIds.filter((pid) => {
      const perFeature = personFeatureMeans.get(pid);
      return finalFeatures.every((f) => perFeature.has(f.ID_FEATURE));
    });
    if (personIds.length === 0) {
      throw new Error(`No complete-case person has a real value on every one of the ${finalFeatures.length} final feature(s). Try a narrower --feature filter.`);
    }

    const weighting = args.weighted ? 'WEIGHTED' : 'UNWEIGHTED';
    const notesLines = [
      `Evaluated F1 run: ${evaluatedRun.RUN_LABEL} (ID_RUN=${evaluatedRun.ID_RUN}), generated ${formatTimestampUtc(evaluatedRun.GENERATED_AT)}.`,
      `Reference set: ${referenceSetId ? `ID_REFERENCE_SET=${referenceSetId}` : '(not yet written -- dry run)'} (${referenceType}).`,
      `Candidate features from evaluated run: ${candidates.length}.`,
      excludedNominal.length ? `Excluded (NOMINAL scale): ${excludedNominal.join(', ')}.` : null,
      excludedMetaphysical.length ? `Excluded (metaphysical-interpretation flag set): ${excludedMetaphysical.join(', ')}.` : null,
      excludedByFilter.length ? `Excluded by --feature "${args.feature}": ${excludedByFilter.join(', ')}.` : null,
      droppedNoReference.length ? `Excluded (no reference value for this feature in the chosen reference set): ${droppedNoReference.join(', ')}.` : null,
      `Final feature set (n=${finalFeatures.length}): ${finalFeatures.map((f) => f.FEATURE_CODE).join(', ')}.`,
      `Weighting: ${weighting}.`,
      `Complete-case persons: ${personIds.length} of ${allPersonIds.length} person(s) who had any usable value.`,
      'CDIx is an RMS displacement in a normalized feature space against an explicit reference -- it is not the scalar curvature of a manifold, and by itself is never evidence of a causal mechanism, a clinical condition, or a validated metaphysical correspondence.',
    ].filter(Boolean).join('\n');

    if (args.dryRun) {
      console.log(`[DRY RUN] Would write 1 GDX_HNF_CDI_RUN row, ${finalFeatures.length} GDX_HNF_CDI_RUN_FEATURE row(s), ` +
        `${personIds.length} GDX_HNF_CDI_VALUE row(s), ${personIds.length * finalFeatures.length} GDX_HNF_CDI_VALUE_DETAIL row(s).`);
      console.log(notesLines);
      return;
    }

    const runLabel = `${args.study}_CDI_${weighting}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const runRow = returningRow(await query(db, `
      INSERT INTO GDX_HNF_CDI_RUN
        (ID_STUDY, ID_INPUT_FEATURE_RUN, ID_REFERENCE_SET, WEIGHTING, RUN_LABEL, FEATURE_COUNT, PERSON_COUNT, GENERATED_BY, NOTES)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_CDI_RUN`,
      [studyId, evaluatedRun.ID_RUN, referenceSetId, weighting, runLabel, finalFeatures.length, personIds.length,
        'F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS', notesLines]));
    const cdiRunId = runRow.ID_CDI_RUN;

    const orderedFeatures = finalFeatures.map((f, idx) => ({ order: idx + 1, feature: f, weight: weightsByFeature.get(f.ID_FEATURE) }));
    for (const of_ of orderedFeatures) {
      await query(db, 'INSERT INTO GDX_HNF_CDI_RUN_FEATURE (ID_CDI_RUN, FEATURE_ORDER, ID_FEATURE, WEIGHT) VALUES (?, ?, ?, ?)',
        [cdiRunId, of_.order, of_.feature.ID_FEATURE, of_.weight]);
    }

    let valueRowCount = 0, detailRowCount = 0;
    for (const personId of personIds) {
      const perFeature = personFeatureMeans.get(personId);
      const current = orderedFeatures.map((of_) => perFeature.get(of_.feature.ID_FEATURE));
      const reference = orderedFeatures.map((of_) => referenceValuesByFeature.get(of_.feature.ID_FEATURE).value);
      const weights = orderedFeatures.map((of_) => of_.weight);
      assertFinite(current, `person ${personId}'s own feature values`);

      const cdiValue = args.weighted ? cdiWeighted(current, reference, weights) : cdiUnweighted(current, reference);
      if (!Number.isFinite(cdiValue)) {
        throw new Error(`Computed a non-finite CDI for person ${personId} -- refusing to write NaN/Infinity.`);
      }

      const cdiValueRow = returningRow(await query(db,
        'INSERT INTO GDX_HNF_CDI_VALUE (ID_CDI_RUN, ID_PERSON, CDI_VALUE) VALUES (?, ?, ?) RETURNING ID_CDI_VALUE',
        [cdiRunId, personId, cdiValue]));
      valueRowCount += 1;

      for (let j = 0; j < orderedFeatures.length; j++) {
        const of_ = orderedFeatures[j];
        await query(db, `
          INSERT INTO GDX_HNF_CDI_VALUE_DETAIL (ID_CDI_VALUE, ID_FEATURE, CURRENT_VALUE, REFERENCE_VALUE, DIFFERENCE, WEIGHT)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [cdiValueRow.ID_CDI_VALUE, of_.feature.ID_FEATURE, current[j], reference[j], current[j] - reference[j], weights[j]]);
        detailRowCount += 1;
      }
    }

    console.log(`\nWrote GDX_HNF_CDI_RUN ID_CDI_RUN=${cdiRunId} ("${runLabel}"):`);
    console.log(`  ${orderedFeatures.length} GDX_HNF_CDI_RUN_FEATURE row(s)`);
    console.log(`  ${valueRowCount} GDX_HNF_CDI_VALUE row(s)`);
    console.log(`  ${detailRowCount} GDX_HNF_CDI_VALUE_DETAIL row(s)`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
