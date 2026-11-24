#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_LATENT_SPACE (F4-alternative)
 *
 * For one study, computes the Curvature Depth Index in latent space (CDIh) of every complete-case
 * person's own fitted representation h(t) -- already frozen by F2_GDX_SKILL_LATENT_REPRESENTATIONS
 * (F2) in GDX_HNF_LATENT_VALUE, one GDX_HNF_LATENT_RUN -- against an explicit, frozen reference h_ref
 * expressed in that SAME run's own coordinate system. Same RMS-distance shape
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS (F4, original characteristics) already establishes, applied
 * here between fitted latent coordinates instead of directly normalized features:
 *
 *   CDIh(t)   = sqrt( (1/k) * sum_j (h_j(t) - h_j_ref)^2 )                          unweighted
 *   CDIh_w(t) = sqrt( sum_j w_j * (h_j(t) - h_j_ref)^2  /  sum_j w_j )               weighted
 *               w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to CDIh)
 *
 * Records the result into the GDX_HNF_CDIH_* tables (see
 * ../../../hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql):
 *   GDX_HNF_CDIH_REFERENCE_SET / GDX_HNF_CDIH_REFERENCE_VALUE / GDX_HNF_CDIH_REFERENCE_MEMBER
 *                                                              the frozen reference h_ref
 *   GDX_HNF_CDIH_RUN / GDX_HNF_CDIH_RUN_DIMENSION              one run's own dimension set/weights
 *   GDX_HNF_CDIH_VALUE / GDX_HNF_CDIH_VALUE_DETAIL             the CDIh scalar per person, plus the
 *                                                              full per-dimension difference vector
 *
 * The single invariant this whole layer is built around: every h_j(t) and h_j_ref compared by one
 * run must come from the EXACT SAME GDX_HNF_LATENT_RUN (same fitted method, same parameters, same
 * k) -- re-fitting PCA/an autoencoder/UMAP produces a different coordinate system, and two CDIh
 * values computed under different ID_LATENT_RUN values are not comparable without a separate
 * alignment procedure this script does not implement. Every reference built here is therefore
 * pinned to the evaluated run's own ID_LATENT_RUN. See SKILL.md for the full rationale of the three
 * reference bases (PERSONAL_BASELINE, LATENT_COHORT, POPULATION_REFERENCE).
 *
 * Reconstructing mean_z for a PERSONAL_BASELINE projection (PCA only):
 * GDX_HNF_LATENT_RUN.METHOD_PARAMS for a PCA run does not store the fitted mean_z vector (only
 * {library, method, center, scale, dimsRequested} -- see F2's own generate_latent_representations.js).
 * h_ref = W^T (z_ref - mean_z) needs it, so this script reconstructs mean_z deterministically,
 * never approximated: it re-reads GDX_HNF_LATENT_RUN_FEATURE (the exact ordered input feature set
 * PCA was fit on) and GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE (F1's own frozen z(t), reduced to one
 * scalar per (person, feature) the same way F2 itself does), restricted to exactly the complete-case
 * persons already embedded in GDX_HNF_LATENT_VALUE for that run -- the literal matrix PCA centered
 * when it was fit, read back through the same tables F2 already froze, in the same order. This is
 * the one place this script transitively reads GDX_HNF_FEATURE_VALUE/GDX_HNF_LATENT_RUN_FEATURE
 * directly; everywhere else it only reads GDX_HNF_LATENT_*.
 *
 * Never re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
 * 7.multidimensional.database or 9.knowledge.graph directly, and never re-fits a latent
 * representation on its own -- F2 has already done that work. "Reading the relational/BI/graph
 * sources" for this layer is satisfied *transitively*, through an already-run F2 latent run.
 *
 * Usage:
 *   node generate_curvature_depth_index_latent.js --study <slug>
 *     ( --reference-set-id <id>
 *       | --reference-type latent_cohort|population_reference|personal_baseline
 *           [--population-members-file <path>] [--subject <id_person>] [--orig-reference-set-id <id>] )
 *     [--latent-run-id <id>]
 *     [--weighted --weights-file <path>]
 *     [--reference-label <text>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>                REQUIRED outside --sample. Same slug MFS/F2/F3/F4 use.
 *   --reference-set-id <id>       Reuse an already-frozen GDX_HNF_CDIH_REFERENCE_SET instead of
 *                                 building a new one. Mutually exclusive with --reference-type.
 *                                 Must already be pinned to the SAME ID_LATENT_RUN being evaluated.
 *   --reference-type               latent_cohort | population_reference | personal_baseline.
 *                                 Required when --reference-set-id is not given -- see SKILL.md
 *                                 "Three reference bases" for what each one means and needs.
 *   --population-members-file <path>  REQUIRED for --reference-type population_reference: a JSON
 *                                 array of GDX_PSY_PERSON.ID_PERSON integers, each of which must
 *                                 already have a GDX_HNF_LATENT_VALUE row in the evaluated run.
 *                                 Refused, naming the offending id(s), if any does not. Refused if
 *                                 the resulting subset equals the run's own full complete-case set
 *                                 (that is latent_cohort under a different label).
 *   --subject <id_person>          REQUIRED for --reference-type personal_baseline.
 *   --orig-reference-set-id <id>    REQUIRED for --reference-type personal_baseline: the
 *                                 F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS GDX_HNF_CDI_REFERENCE_SET
 *                                 row (REFERENCE_TYPE='PERSONAL_BASELINE', ID_SUBJECT matching
 *                                 --subject, same study) to project through this run's own PCA
 *                                 loadings. Never auto-resolved or guessed. Refused if the evaluated
 *                                 run's METHOD is not PCA (an autoencoder/UMAP embedding has no
 *                                 stored, reapplicable linear map for an arbitrary reference point).
 *   --latent-run-id <id>            optional. Evaluate a specific GDX_HNF_LATENT_RUN.ID_LATENT_RUN
 *                                 instead of the study's latest. REQUIRED (refused otherwise) when
 *                                 the study has latent runs of more than one METHOD -- never
 *                                 silently picks "the latest" across incomparable methods. If the
 *                                 study has exactly one METHOD (however many runs of it), the latest
 *                                 run of that method is used.
 *   --weighted                      compute CDIh_w instead of CDIh. Requires --weights-file.
 *   --weights-file <path>           REQUIRED with --weighted: a JSON file
 *                                 { "<DIMENSION_LABEL>": <weight, number >= 0> } (e.g. "PC1": 1.0).
 *                                 Every dimension in the run's final dimension set must have an
 *                                 explicit entry -- nothing is ever defaulted to 1 once --weighted
 *                                 is passed. All-zero weights is refused.
 *   --reference-label <text>        optional. Overrides the auto-generated REFERENCE_LABEL when
 *                                 building a new reference set.
 *   --intake-dir <path>             optional override of the default new_study_intake/<slug>/
 *                                 location.
 *   --dry-run                       computes everything (resolved run, reference values/members,
 *                                 complete-case persons, per-dimension differences) and logs it,
 *                                 writing no row.
 *   --sample                        runs a small worked numeric example of the CDIh formula on
 *                                 synthetic latent coordinates -- never connects to Firebird, never
 *                                 writes anything.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const REFERENCE_TYPES = ['LATENT_COHORT', 'POPULATION_REFERENCE', 'PERSONAL_BASELINE'];

function parseArgs(argv) {
  const args = {
    study: null, referenceSetId: null, referenceType: null, populationMembersFile: null,
    subject: null, origReferenceSetId: null, latentRunId: null,
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
    else if (a === '--population-members-file') args.populationMembersFile = argv[++i];
    else if (a === '--subject') args.subject = parseInt(argv[++i], 10);
    else if (a === '--orig-reference-set-id') args.origReferenceSetId = parseInt(argv[++i], 10);
    else if (a === '--latent-run-id') args.latentRunId = parseInt(argv[++i], 10);
    else if (a === '--weights-file') args.weightsFile = argv[++i];
    else if (a === '--reference-label') args.referenceLabel = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample) {
    if (!args.study) throw new Error('--study <slug> is required (same slug MFS/F2/F3/F4 use), unless --sample is passed.');
    if (!args.referenceSetId && !args.referenceType) {
      throw new Error('Either --reference-set-id <id> (reuse) or --reference-type <type> (build new) is required.');
    }
    if (args.referenceSetId && args.referenceType) {
      throw new Error('--reference-set-id and --reference-type are mutually exclusive -- reuse an existing reference, or build a new one, not both.');
    }
    if (args.referenceType && !REFERENCE_TYPES.includes(args.referenceType)) {
      throw new Error(`--reference-type ${args.referenceType} is not recognized. Supported: ${REFERENCE_TYPES.map((t) => t.toLowerCase()).join(', ')}.`);
    }
    if (args.referenceType === 'POPULATION_REFERENCE' && !args.populationMembersFile) {
      throw new Error('--reference-type population_reference requires --population-members-file <path> (an explicit JSON array of ID_PERSON).');
    }
    if (args.referenceType === 'PERSONAL_BASELINE' && !args.subject) {
      throw new Error('--reference-type personal_baseline requires --subject <id_person>.');
    }
    if (args.referenceType === 'PERSONAL_BASELINE' && !args.origReferenceSetId) {
      throw new Error('--reference-type personal_baseline requires --orig-reference-set-id <id> (the F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS PERSONAL_BASELINE reference set to project -- never auto-resolved).');
    }
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
      `the vars before running this script (or pass --sample to exercise the CDIh formula with no database connection).`
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

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string -- same reason as every
 * sibling script in this folder: a plain template-literal interpolation of a Date renders its
 * timezone NAME in the OS's configured locale. */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_LATENT_SPACE/scripts) -- same
 * depth/shape as every sibling skill in this folder. */
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

/** Resolves the evaluated GDX_HNF_LATENT_RUN: an explicit --latent-run-id (validated to belong to
 * this study), or else -- when the study's own latent runs span more than one METHOD -- a hard
 * refusal (two methods are two incomparable coordinate systems; never silently prefer one), or else
 * the latest run of the study's one-and-only METHOD. */
async function resolveLatentRun(db, studyId, studyTitle, latentRunId) {
  if (latentRunId !== null && latentRunId !== undefined && !Number.isNaN(latentRunId)) {
    const rows = await query(db, `
      SELECT ID_LATENT_RUN, ID_INPUT_RUN, ID_STUDY, METHOD, RUN_LABEL, LATENT_DIMENSION_COUNT, GENERATED_AT
      FROM GDX_HNF_LATENT_RUN WHERE ID_LATENT_RUN = ?`, [latentRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_LATENT_RUN with ID_LATENT_RUN=${latentRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_LATENT_RUN ID_LATENT_RUN=${latentRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `
    SELECT ID_LATENT_RUN, ID_INPUT_RUN, ID_STUDY, METHOD, RUN_LABEL, LATENT_DIMENSION_COUNT, GENERATED_AT
    FROM GDX_HNF_LATENT_RUN WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_LATENT_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_LATENT_RUN found for study "${studyTitle}". Run F2_GDX_SKILL_LATENT_REPRESENTATIONS --study ${JSON.stringify(studyTitle)} first.`);
  }
  const methods = [...new Set(rows.map((r) => r.METHOD))];
  if (methods.length > 1) {
    const summary = rows.map((r) => `ID_LATENT_RUN=${r.ID_LATENT_RUN} (${r.METHOD}, ${formatTimestampUtc(r.GENERATED_AT)})`).join('; ');
    throw new Error(
      `Study "${studyTitle}" has latent runs under more than one METHOD (${methods.join(', ')}) -- these are different, ` +
      `non-comparable coordinate systems, so this script never silently picks "the latest" across them. Pass an explicit ` +
      `--latent-run-id. Existing runs: ${summary}.`
    );
  }
  return rows[0];
}

/** The exact ordered input feature set the evaluated PCA run was fit on -- needed only to
 * reconstruct mean_z for a PERSONAL_BASELINE projection (see file header). */
async function loadLatentRunFeatures(db, latentRunId) {
  const rows = await query(db, `
    SELECT ID_FEATURE, FEATURE_ORDER FROM GDX_HNF_LATENT_RUN_FEATURE
    WHERE ID_LATENT_RUN = ? ORDER BY FEATURE_ORDER`, [latentRunId]);
  return rows;
}

async function loadLatentDimensions(db, latentRunId) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, DIMENSION_ORDER, DIMENSION_LABEL, EXPLAINED_VARIANCE_RATIO
    FROM GDX_HNF_LATENT_DIMENSION WHERE ID_LATENT_RUN = ? ORDER BY DIMENSION_ORDER`, [latentRunId]);
  return rows;
}

/** h(t): every real GDX_HNF_LATENT_VALUE row for this run. Already a complete, rectangular
 * (dimension x person) matrix by construction -- F2 only ever writes a COORDINATE_VALUE for a
 * person it already classified as a complete case for every one of the run's own dimensions.
 * Returns Map(personId -> Map(dimId -> value)) and the sorted list of person ids present. */
async function loadLatentValues(db, latentRunId) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, ID_PERSON, COORDINATE_VALUE
    FROM GDX_HNF_LATENT_VALUE WHERE ID_LATENT_RUN = ?`, [latentRunId]);
  const byPerson = new Map();
  for (const r of rows) {
    if (!byPerson.has(r.ID_PERSON)) byPerson.set(r.ID_PERSON, new Map());
    byPerson.get(r.ID_PERSON).set(r.ID_LATENT_DIM, Number(r.COORDINATE_VALUE));
  }
  const personIds = [...byPerson.keys()].sort((a, b) => a - b);
  return { byPerson, personIds };
}

async function loadLatentLoadings(db, dimIds) {
  const byDim = new Map();
  for (const dimId of dimIds) {
    const rows = await query(db, 'SELECT ID_FEATURE, LOADING_VALUE FROM GDX_HNF_LATENT_LOADING WHERE ID_LATENT_DIM = ?', [dimId]);
    byDim.set(dimId, new Map(rows.map((r) => [r.ID_FEATURE, Number(r.LOADING_VALUE)])));
  }
  return byDim;
}

/** Reduces F1's per-(person, feature[, session]) grain to one scalar per (person, feature) -- same
 * averaging principle every other script in this folder applies (identical in shape to F2's own
 * aggregatePersonFeatureMeans()). Used only to reconstruct mean_z for a PERSONAL_BASELINE
 * projection. */
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

/** Reconstructs mean_z[featureId] for the evaluated PCA run's own training sample: the mean, across
 * exactly the complete-case persons already embedded in this run (latentPersonIds), of each input
 * feature's own F1 z(t) (reduced to one scalar per (person, feature) exactly as F2 does before
 * fitting). This is the literal matrix PCA centered when it was fit -- never an approximation. */
async function reconstructPcaMeanZ(db, inputRunId, latentRunFeatures, latentPersonIds) {
  const featureIdSet = new Set(latentRunFeatures.map((f) => f.ID_FEATURE));
  const rows = await query(db, `
    SELECT ID_PERSON, ID_FEATURE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_PERSON, ID_FEATURE`, [inputRunId]);
  const filtered = rows.filter((r) => featureIdSet.has(r.ID_FEATURE));
  const personFeatureMeans = aggregatePersonFeatureMeans(filtered);

  const personSet = new Set(latentPersonIds);
  const meanZ = new Map();
  for (const f of latentRunFeatures) {
    let sum = 0, count = 0;
    for (const personId of latentPersonIds) {
      const perFeature = personFeatureMeans.get(personId);
      if (!perFeature || !perFeature.has(f.ID_FEATURE)) {
        throw new Error(
          `Cannot reconstruct mean_z: person ${personId} (one of this latent run's own complete-case persons) has no ` +
          `GDX_HNF_FEATURE_VALUE for feature ID_FEATURE=${f.ID_FEATURE} in input run ID_RUN=${inputRunId}. This should ` +
          `be impossible if GDX_HNF_LATENT_VALUE was built from COMPLETE_CASES -- the data may have drifted since this ` +
          `latent run was fit.`
        );
      }
      sum += perFeature.get(f.ID_FEATURE);
      count += 1;
    }
    meanZ.set(f.ID_FEATURE, sum / count);
  }
  void personSet;
  return meanZ;
}

/* ---------------------------------------------------------------------------------------------
 * The CDIh formulas themselves -- identical arithmetic to F4 (original characteristics)'s own
 * CDIx/CDIx_w, applied here to latent dimensions instead of features.
 * ------------------------------------------------------------------------------------------- */

/** CDIh(t) = sqrt( (1/k) * sum_j (h_j(t) - h_j_ref)^2 ). */
function cdiUnweighted(current, reference) {
  let sumSq = 0;
  for (let j = 0; j < current.length; j++) {
    const d = current[j] - reference[j];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / current.length);
}

/** CDIh_w(t) = sqrt( sum_j w_j*(h_j(t)-h_j_ref)^2 / sum_j w_j ). w_j=1 for every j reduces this to
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
    throw new Error('Sum of weights must be positive -- all-zero weights make the weighted CDIh undefined (0/0), refusing to compute it.');
  }
  return Math.sqrt(sumWeightedSq / sumWeights);
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
function populationStd(values) {
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length;
  return Math.sqrt(variance);
}

function assertFinite(values, label) {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`Non-finite value encountered in ${label} -- refusing to compute a CDIh from NaN/Infinity input.`);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * Building a new reference set (one branch per REFERENCE_TYPE). Each returns
 * { referenceValuesByDim: Map<ID_LATENT_DIM, {value, dispersion, sampleSize}>, ... }.
 * ------------------------------------------------------------------------------------------- */

/** LATENT_COHORT / POPULATION_REFERENCE: the mean (and population std) of h(t), dimension by
 * dimension, over a (sub)set of the evaluated run's own complete-case persons -- computed from real
 * GDX_HNF_LATENT_VALUE rows every time, never assumed to be exactly the zero vector. */
function buildCohortLikeReference(byPerson, personIds, dimensions) {
  const referenceValuesByDim = new Map();
  for (const dim of dimensions) {
    const values = personIds.map((pid) => byPerson.get(pid).get(dim.ID_LATENT_DIM));
    referenceValuesByDim.set(dim.ID_LATENT_DIM, {
      value: mean(values),
      dispersion: populationStd(values),
      sampleSize: values.length,
    });
  }
  return referenceValuesByDim;
}

/** PERSONAL_BASELINE: projects the F4-original (original-feature-space) personal baseline z_ref
 * through the evaluated PCA run's own fitted linear map, h_ref = W^T (z_ref - mean_z). A dimension
 * for which the stored W (GDX_HNF_LATENT_LOADING) or z_ref (GDX_HNF_CDI_REFERENCE_VALUE) does not
 * cover every one of the run's own input features is excluded entirely, never approximated. */
async function buildPersonalBaselineReference(db, latentRun, origReferenceSet, latentRunFeatures, latentDimensions, meanZ) {
  const origValuesRows = await query(db, `
    SELECT ID_FEATURE, REFERENCE_VALUE FROM GDX_HNF_CDI_REFERENCE_VALUE WHERE ID_REFERENCE_SET = ?`, [origReferenceSet.ID_REFERENCE_SET]);
  const zRef = new Map(origValuesRows.map((r) => [r.ID_FEATURE, Number(r.REFERENCE_VALUE)]));

  const loadingsByDim = await loadLatentLoadings(db, latentDimensions.map((d) => d.ID_LATENT_DIM));

  const referenceValuesByDim = new Map();
  const excludedDims = [];
  for (const dim of latentDimensions) {
    const loadings = loadingsByDim.get(dim.ID_LATENT_DIM);
    let hRef = 0;
    let coversAll = true;
    for (const f of latentRunFeatures) {
      const w = loadings.get(f.ID_FEATURE);
      const z = zRef.get(f.ID_FEATURE);
      const mz = meanZ.get(f.ID_FEATURE);
      if (w === undefined || z === undefined || mz === undefined) { coversAll = false; break; }
      hRef += w * (z - mz);
    }
    if (!coversAll) { excludedDims.push(dim.DIMENSION_LABEL); continue; }
    // A single projected point, not a sampled quantity -- no dispersion, sample size of 1 (one
    // subject's own baseline), same convention F4-original uses for a baseline with one session.
    referenceValuesByDim.set(dim.ID_LATENT_DIM, { value: hRef, dispersion: null, sampleSize: 1 });
  }
  return { referenceValuesByDim, excludedDims };
}

/* ---------------------------------------------------------------------------------------------
 * --sample: a worked numeric example of the CDIh formula on synthetic latent coordinates (NOT from
 * any real study) -- same convention every sibling script in this folder uses for --sample.
 * ------------------------------------------------------------------------------------------- */
function runSample() {
  console.log('[SAMPLE] Worked example 1 -- unweighted CDIh, five synthetic latent dimensions, a fixed reference 0.5 on every dimension:');
  const current1 = [0.8, 0.6, 0.4, 0.7, 0.5];
  const reference1 = [0.5, 0.5, 0.5, 0.5, 0.5];
  const cdi1 = cdiUnweighted(current1, reference1);
  console.log(`  current (h)   = [${current1.join(', ')}]`);
  console.log(`  reference (h_ref) = [${reference1.join(', ')}]`);
  console.log(`  diff          = [${current1.map((v, j) => (v - reference1[j]).toFixed(4)).join(', ')}]`);
  console.log(`  CDIh = ${cdi1.toFixed(4)} (expected ~0.1732 -- same arithmetic as CDIx, different space)`);

  console.log('\n[SAMPLE] Worked example 2 -- weighted CDIh_w, same five dimensions, non-uniform weights:');
  const weights = [1, 1, 0.5, 0.5, 2];
  const cdi2 = cdiWeighted(current1, reference1, weights);
  console.log(`  weights = [${weights.join(', ')}]`);
  console.log(`  CDIh_w = ${cdi2.toFixed(4)}`);

  console.log('\n[SAMPLE] Worked example 3 -- all-zero weights is refused, not silently computed:');
  try {
    cdiWeighted(current1, reference1, [0, 0, 0, 0, 0]);
    console.log('  UNEXPECTED: did not throw.');
  } catch (e) {
    console.log(`  Refused as expected: ${e.message}`);
  }
  console.log('\nNone of the numbers above come from a real GDX_HUMAN latent run. Nothing is written to the database.');
}

/* ---------------------------------------------------------------------------------------------
 * Main.
 * ------------------------------------------------------------------------------------------- */
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
    const latentRun = await resolveLatentRun(db, studyId, studyTitle, args.latentRunId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Evaluated F2 run "${latentRun.RUN_LABEL}" (ID_LATENT_RUN=${latentRun.ID_LATENT_RUN}, METHOD=${latentRun.METHOD}, k=${latentRun.LATENT_DIMENSION_COUNT}).`);

    const latentDimensions = await loadLatentDimensions(db, latentRun.ID_LATENT_RUN);
    const { byPerson, personIds: allPersonIds } = await loadLatentValues(db, latentRun.ID_LATENT_RUN);
    if (allPersonIds.length === 0) {
      throw new Error(`GDX_HNF_LATENT_RUN ID_LATENT_RUN=${latentRun.ID_LATENT_RUN} has no GDX_HNF_LATENT_VALUE rows -- nothing to evaluate.`);
    }

    // --- Resolve or build the reference set --------------------------------------------------
    let referenceSetId, referenceType, referenceValuesByDim, referenceBuildNotes = [];

    if (args.referenceSetId) {
      const rsRows = await query(db, `
        SELECT ID_REFERENCE_SET, ID_STUDY, ID_LATENT_RUN, REFERENCE_TYPE, REFERENCE_LABEL
        FROM GDX_HNF_CDIH_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [args.referenceSetId]);
      if (rsRows.length === 0) throw new Error(`No GDX_HNF_CDIH_REFERENCE_SET with ID_REFERENCE_SET=${args.referenceSetId}.`);
      const rs = rsRows[0];
      if (rs.ID_STUDY !== studyId) {
        throw new Error(`GDX_HNF_CDIH_REFERENCE_SET ID_REFERENCE_SET=${args.referenceSetId} belongs to a different study, not "${studyTitle}".`);
      }
      if (rs.ID_LATENT_RUN !== latentRun.ID_LATENT_RUN) {
        throw new Error(
          `GDX_HNF_CDIH_REFERENCE_SET ID_REFERENCE_SET=${args.referenceSetId} is pinned to ID_LATENT_RUN=${rs.ID_LATENT_RUN}, ` +
          `not the evaluated run's ID_LATENT_RUN=${latentRun.ID_LATENT_RUN} -- a reference built under one fitted coordinate ` +
          `system can never be reused against a different one.`
        );
      }
      referenceSetId = rs.ID_REFERENCE_SET;
      referenceType = rs.REFERENCE_TYPE;
      console.log(`Reusing existing GDX_HNF_CDIH_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} (${referenceType}, "${rs.REFERENCE_LABEL}").`);

      const rvRows = await query(db, `
        SELECT ID_LATENT_DIM, REFERENCE_VALUE, REFERENCE_DISPERSION, SAMPLE_SIZE
        FROM GDX_HNF_CDIH_REFERENCE_VALUE WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
      referenceValuesByDim = new Map(rvRows.map((r) => [r.ID_LATENT_DIM, {
        value: Number(r.REFERENCE_VALUE), dispersion: r.REFERENCE_DISPERSION === null ? null : Number(r.REFERENCE_DISPERSION), sampleSize: r.SAMPLE_SIZE,
      }]));
    } else {
      referenceType = args.referenceType;
      let subjectId = null, origReferenceSetId = null, populationMemberIds = null;

      if (referenceType === 'LATENT_COHORT') {
        referenceValuesByDim = buildCohortLikeReference(byPerson, allPersonIds, latentDimensions);
      } else if (referenceType === 'POPULATION_REFERENCE') {
        if (!fs.existsSync(args.populationMembersFile)) throw new Error(`--population-members-file not found: ${args.populationMembersFile}.`);
        const raw = JSON.parse(fs.readFileSync(args.populationMembersFile, 'utf8'));
        if (!Array.isArray(raw) || raw.length === 0 || !raw.every((v) => Number.isInteger(v))) {
          throw new Error('--population-members-file must be a non-empty JSON array of integer ID_PERSON values.');
        }
        populationMemberIds = [...new Set(raw)];
        const allPersonSet = new Set(allPersonIds);
        const missing = populationMemberIds.filter((pid) => !allPersonSet.has(pid));
        if (missing.length) {
          throw new Error(`--population-members-file lists person id(s) with no GDX_HNF_LATENT_VALUE row in ID_LATENT_RUN=${latentRun.ID_LATENT_RUN}: ${missing.join(', ')}.`);
        }
        if (populationMemberIds.length === allPersonIds.length) {
          throw new Error('--population-members-file lists every complete-case person in this run -- that is a latent_cohort reference, not a population_reference. Use --reference-type latent_cohort instead.');
        }
        referenceValuesByDim = buildCohortLikeReference(byPerson, populationMemberIds, latentDimensions);
      } else {
        // PERSONAL_BASELINE
        if (latentRun.METHOD !== 'PCA') {
          throw new Error(
            `--reference-type personal_baseline requires a PCA latent run (evaluated run ID_LATENT_RUN=${latentRun.ID_LATENT_RUN} ` +
            `has METHOD=${latentRun.METHOD}) -- only PCA has a stored, reapplicable linear map from an arbitrary reference point ` +
            `into h-space. Use --reference-type latent_cohort/population_reference instead, or point --latent-run-id at a PCA run of this study.`
          );
        }
        subjectId = args.subject;
        origReferenceSetId = args.origReferenceSetId;
        const origRows = await query(db, `
          SELECT ID_REFERENCE_SET, ID_STUDY, REFERENCE_TYPE, ID_SUBJECT, REFERENCE_LABEL
          FROM GDX_HNF_CDI_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [origReferenceSetId]);
        if (origRows.length === 0) throw new Error(`No GDX_HNF_CDI_REFERENCE_SET with ID_REFERENCE_SET=${origReferenceSetId} (F4, original characteristics).`);
        const orig = origRows[0];
        if (orig.ID_STUDY !== studyId) throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${origReferenceSetId} belongs to a different study, not "${studyTitle}".`);
        if (orig.REFERENCE_TYPE !== 'PERSONAL_BASELINE') throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${origReferenceSetId} has REFERENCE_TYPE=${orig.REFERENCE_TYPE}, not PERSONAL_BASELINE.`);
        if (orig.ID_SUBJECT !== subjectId) throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${origReferenceSetId} belongs to ID_SUBJECT=${orig.ID_SUBJECT}, not --subject ${subjectId}.`);

        const latentRunFeatures = await loadLatentRunFeatures(db, latentRun.ID_LATENT_RUN);
        const meanZ = await reconstructPcaMeanZ(db, latentRun.ID_INPUT_RUN, latentRunFeatures, allPersonIds);
        const built = await buildPersonalBaselineReference(db, latentRun, orig, latentRunFeatures, latentDimensions, meanZ);
        referenceValuesByDim = built.referenceValuesByDim;
        if (built.excludedDims.length) {
          referenceBuildNotes.push(`Could not project onto (missing loading or source reference value for a required input feature): ${built.excludedDims.join(', ')}.`);
        }
      }

      if (referenceValuesByDim.size === 0) {
        throw new Error('The chosen reference has no value for any latent dimension -- nothing to compute a CDIh against.');
      }

      if (args.dryRun) {
        console.log(`[DRY RUN] Would build a new GDX_HNF_CDIH_REFERENCE_SET (${referenceType}) with ${referenceValuesByDim.size} GDX_HNF_CDIH_REFERENCE_VALUE row(s).`);
        referenceBuildNotes.forEach((n) => console.log(`  NOTE: ${n}`));
      } else {
        const referenceLabel = args.referenceLabel || `${args.study}_CDIH_${referenceType}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const sourcePersonCount = referenceType === 'LATENT_COHORT' ? allPersonIds.length
          : referenceType === 'POPULATION_REFERENCE' ? populationMemberIds.length : null;
        const rsRow = returningRow(await query(db, `
          INSERT INTO GDX_HNF_CDIH_REFERENCE_SET
            (ID_STUDY, ID_LATENT_RUN, REFERENCE_TYPE, ID_SUBJECT, ID_ORIG_REFERENCE_SET, REFERENCE_LABEL,
             SOURCE_PERSON_COUNT, GENERATED_BY, NOTES)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_REFERENCE_SET`,
          [studyId, latentRun.ID_LATENT_RUN, referenceType, subjectId, origReferenceSetId, referenceLabel,
            sourcePersonCount, 'F4_CURV_DEPTH_KPI_LATENT_SPACE', referenceBuildNotes.join('\n') || null]));
        referenceSetId = rsRow.ID_REFERENCE_SET;
        for (const [dimId, v] of referenceValuesByDim.entries()) {
          await query(db, `
            INSERT INTO GDX_HNF_CDIH_REFERENCE_VALUE (ID_REFERENCE_SET, ID_LATENT_DIM, REFERENCE_VALUE, REFERENCE_DISPERSION, SAMPLE_SIZE)
            VALUES (?, ?, ?, ?, ?)`, [referenceSetId, dimId, v.value, v.dispersion, v.sampleSize]);
        }
        if (referenceType === 'POPULATION_REFERENCE') {
          for (const pid of populationMemberIds) {
            await query(db, 'INSERT INTO GDX_HNF_CDIH_REFERENCE_MEMBER (ID_REFERENCE_SET, ID_PERSON) VALUES (?, ?)', [referenceSetId, pid]);
          }
        }
        console.log(`Wrote GDX_HNF_CDIH_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} (${referenceType}, "${referenceLabel}") with ${referenceValuesByDim.size} GDX_HNF_CDIH_REFERENCE_VALUE row(s).`);
      }
    }

    // --- Final dimension set = latent dimensions that ALSO have a reference value ------------
    const finalDimensions = latentDimensions.filter((d) => referenceValuesByDim.has(d.ID_LATENT_DIM));
    const droppedNoReference = latentDimensions.filter((d) => !referenceValuesByDim.has(d.ID_LATENT_DIM)).map((d) => d.DIMENSION_LABEL);
    if (finalDimensions.length === 0) {
      throw new Error('No latent dimension has a reference value in the chosen reference set -- nothing to compute.');
    }

    // --- Weights --------------------------------------------------------------------------------
    let weightsByDim = new Map(finalDimensions.map((d) => [d.ID_LATENT_DIM, 1]));
    if (args.weighted) {
      if (!fs.existsSync(args.weightsFile)) throw new Error(`--weights-file not found: ${args.weightsFile}.`);
      const rawWeights = JSON.parse(fs.readFileSync(args.weightsFile, 'utf8'));
      const missingWeights = [];
      for (const d of finalDimensions) {
        const w = rawWeights[d.DIMENSION_LABEL];
        if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) { missingWeights.push(d.DIMENSION_LABEL); continue; }
        weightsByDim.set(d.ID_LATENT_DIM, w);
      }
      if (missingWeights.length) {
        throw new Error(`--weights-file is missing a valid (>= 0) weight for: ${missingWeights.join(', ')}. Every dimension in a weighted run needs an explicit weight -- none are ever defaulted.`);
      }
      const sumWeights = [...weightsByDim.values()].reduce((a, b) => a + b, 0);
      if (sumWeights <= 0) {
        throw new Error('Sum of weights in --weights-file is zero or negative for the final dimension set -- refusing to compute an undefined (0/0) weighted CDIh.');
      }
    }

    // --- Complete-case persons for the FINAL dimension set -------------------------------------
    const personIds = allPersonIds.filter((pid) => {
      const perDim = byPerson.get(pid);
      return finalDimensions.every((d) => perDim.has(d.ID_LATENT_DIM));
    });
    if (personIds.length === 0) {
      throw new Error(`No complete-case person has a value on every one of the ${finalDimensions.length} final dimension(s).`);
    }

    const weighting = args.weighted ? 'WEIGHTED' : 'UNWEIGHTED';
    const notesLines = [
      `Evaluated F2 latent run: ${latentRun.RUN_LABEL} (ID_LATENT_RUN=${latentRun.ID_LATENT_RUN}, METHOD=${latentRun.METHOD}), generated ${formatTimestampUtc(latentRun.GENERATED_AT)}.`,
      `Reference set: ${referenceSetId ? `ID_REFERENCE_SET=${referenceSetId}` : '(not yet written -- dry run)'} (${referenceType}).`,
      `Latent dimensions in evaluated run: ${latentDimensions.length}.`,
      droppedNoReference.length ? `Excluded (no reference value for this dimension in the chosen reference set): ${droppedNoReference.join(', ')}.` : null,
      `Final dimension set (k=${finalDimensions.length}): ${finalDimensions.map((d) => d.DIMENSION_LABEL).join(', ')}.`,
      `Weighting: ${weighting}.`,
      `Complete-case persons: ${personIds.length} of ${allPersonIds.length} person(s) embedded in this latent run.`,
      'CDIh is an RMS displacement in a fitted latent space against an explicit reference pinned to the same coordinate system -- it is not the scalar curvature of a manifold, carries no claim about a real or psychological distance, and by itself is never evidence of a causal mechanism, a clinical condition, or a validated metaphysical correspondence. CDIh and CDIx (original characteristics) are not comparable to each other.',
    ].filter(Boolean).join('\n');

    if (args.dryRun) {
      console.log(`[DRY RUN] Would write 1 GDX_HNF_CDIH_RUN row, ${finalDimensions.length} GDX_HNF_CDIH_RUN_DIMENSION row(s), ` +
        `${personIds.length} GDX_HNF_CDIH_VALUE row(s), ${personIds.length * finalDimensions.length} GDX_HNF_CDIH_VALUE_DETAIL row(s).`);
      console.log(notesLines);
      return;
    }

    const runLabel = `${args.study}_CDIH_${weighting}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const runRow = returningRow(await query(db, `
      INSERT INTO GDX_HNF_CDIH_RUN
        (ID_STUDY, ID_LATENT_RUN, ID_REFERENCE_SET, WEIGHTING, RUN_LABEL, DIMENSION_COUNT, PERSON_COUNT, GENERATED_BY, NOTES)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_CDIH_RUN`,
      [studyId, latentRun.ID_LATENT_RUN, referenceSetId, weighting, runLabel, finalDimensions.length, personIds.length,
        'F4_CURV_DEPTH_KPI_LATENT_SPACE', notesLines]));
    const cdihRunId = runRow.ID_CDIH_RUN;

    const orderedDimensions = finalDimensions.map((d, idx) => ({ order: idx + 1, dim: d, weight: weightsByDim.get(d.ID_LATENT_DIM) }));
    for (const od of orderedDimensions) {
      await query(db, 'INSERT INTO GDX_HNF_CDIH_RUN_DIMENSION (ID_CDIH_RUN, DIMENSION_ORDER, ID_LATENT_DIM, WEIGHT) VALUES (?, ?, ?, ?)',
        [cdihRunId, od.order, od.dim.ID_LATENT_DIM, od.weight]);
    }

    let valueRowCount = 0, detailRowCount = 0;
    for (const personId of personIds) {
      const perDim = byPerson.get(personId);
      const current = orderedDimensions.map((od) => perDim.get(od.dim.ID_LATENT_DIM));
      const reference = orderedDimensions.map((od) => referenceValuesByDim.get(od.dim.ID_LATENT_DIM).value);
      const weights = orderedDimensions.map((od) => od.weight);
      assertFinite(current, `person ${personId}'s own latent coordinates`);

      const cdihValue = args.weighted ? cdiWeighted(current, reference, weights) : cdiUnweighted(current, reference);
      if (!Number.isFinite(cdihValue)) {
        throw new Error(`Computed a non-finite CDIh for person ${personId} -- refusing to write NaN/Infinity.`);
      }

      const cdihValueRow = returningRow(await query(db,
        'INSERT INTO GDX_HNF_CDIH_VALUE (ID_CDIH_RUN, ID_PERSON, CDIH_VALUE) VALUES (?, ?, ?) RETURNING ID_CDIH_VALUE',
        [cdihRunId, personId, cdihValue]));
      valueRowCount += 1;

      for (let j = 0; j < orderedDimensions.length; j++) {
        const od = orderedDimensions[j];
        await query(db, `
          INSERT INTO GDX_HNF_CDIH_VALUE_DETAIL (ID_CDIH_VALUE, ID_LATENT_DIM, CURRENT_VALUE, REFERENCE_VALUE, DIFFERENCE, WEIGHT)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [cdihValueRow.ID_CDIH_VALUE, od.dim.ID_LATENT_DIM, current[j], reference[j], current[j] - reference[j], weights[j]]);
        detailRowCount += 1;
      }
    }

    console.log(`\nWrote GDX_HNF_CDIH_RUN ID_CDIH_RUN=${cdihRunId} ("${runLabel}"):`);
    console.log(`  ${orderedDimensions.length} GDX_HNF_CDIH_RUN_DIMENSION row(s)`);
    console.log(`  ${valueRowCount} GDX_HNF_CDIH_VALUE row(s)`);
    console.log(`  ${detailRowCount} GDX_HNF_CDIH_VALUE_DETAIL row(s)`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
