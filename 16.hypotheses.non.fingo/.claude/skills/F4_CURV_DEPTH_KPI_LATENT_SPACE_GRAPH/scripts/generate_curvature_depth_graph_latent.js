#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH
 *
 * Renders the real GDX_HNF_CDIH_* rows this project already has -- written by
 * F4_CURV_DEPTH_KPI_LATENT_SPACE (F4-alternative), this folder's fifth skill -- as a standalone
 * HTML page with three cards, built from one chosen GDX_HNF_CDIH_RUN:
 *
 *   1. a histogram of every complete-case person's own real CDIh(t)/CDIh_w(t) in that run,
 *   2. a per-latent-dimension ranking of the real RMS contribution to that run's own CDIh
 *      (sqrt(mean over persons of DIFFERENCE^2) per dimension, from GDX_HNF_CDIH_VALUE_DETAIL) --
 *      the per-dimension breakdown F4-alternative stores precisely so it is never discarded behind
 *      the aggregate scalar,
 *   3. one diverging bar chart per representative person (the run's own lowest CDIh, the person
 *      whose CDIh sits closest to the run's median, and the highest), showing that real person's
 *      own full per-dimension signed difference vector.
 *
 * Never writes to the database -- purely a reader, same posture as this folder's other four graph
 * skills (F1/F2/F3/F4-original) toward their own compute layer. Never re-reads
 * 2.relational.model.psychometrics, 6.cardiac.coherence, 7.multidimensional.database or
 * 9.knowledge.graph, and never re-computes a CDIh value -- only GDX_HNF_CDIH_RUN /
 * GDX_HNF_CDIH_REFERENCE_SET / GDX_HNF_CDIH_RUN_DIMENSION / GDX_HNF_CDIH_VALUE /
 * GDX_HNF_CDIH_VALUE_DETAIL (already written by F4_CURV_DEPTH_KPI_LATENT_SPACE), plus
 * GDX_HNF_LATENT_RUN / GDX_HNF_LATENT_DIMENSION (F2) for the evaluated run's own METHOD,
 * LATENT_DIMENSION_COUNT, DIMENSION_LABEL and EXPLAINED_VARIANCE_RATIO -- never GDX_HNF_LATENT_VALUE
 * or GDX_HNF_FEATURE_VALUE, which F4_CURV_DEPTH_KPI_LATENT_SPACE already consumed and froze into the
 * GDX_HNF_CDIH_* rows this page reads back.
 *
 * There is no "perspective" grouping the way F4-original's input features have one (psychometrics
 * vs. physiology): a latent run's own dimensions are all of one kind, produced by one fitted model.
 * The evaluated run's own METHOD (PCA/AUTOENCODER/UMAP) fills that same slot instead, so every bar
 * in card 2 shares one consistent legend entry naming the method -- the renderer itself needed no
 * change for this, only different data at the call site.
 *
 * Usage:
 *   node generate_curvature_depth_graph_latent.js --study <slug> [--cdih-run-id <id>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>        REQUIRED outside --sample. Same slug F1/F2/F3/F4/F4-alternative use --
 *                          resolves to GDX_PSY_STUDY.ID_STUDY via
 *                          new_study_intake/<slug>/intake.json's study.title.
 *   --cdih-run-id <id>     optional. A specific GDX_HNF_CDIH_RUN.ID_CDIH_RUN instead of the study's
 *                          latest (errors if that run belongs to a different study).
 *   --out-dir <path>       optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>    optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run              computes everything (resolved run, person/dimension counts, output
 *                          filename) and logs it, writing no file.
 *   --sample                renders from small, explicitly-labeled embedded synthetic data instead
 *                          of connecting to Firebird.
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
  const args = { study: null, cdihRunId: null, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--cdih-run-id') args.cdihRunId = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
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
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH/scripts) --
 * same depth/shape as this folder's other skills' resolveIntakePath(). */
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
  return `f4_curvature_depth_index_latent_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
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

/** Resolves which GDX_HNF_CDIH_RUN to plot: an explicit --cdih-run-id (validated to belong to this
 * study), or else the latest one for this study. Joins in the run's own reference (type/label) and
 * the evaluated GDX_HNF_LATENT_RUN's own METHOD/LATENT_DIMENSION_COUNT/RUN_LABEL -- GDX_HNF_CDIH_RUN
 * itself stores neither; this is the one join this skill needs beyond F4-alternative's own tables. */
async function resolveCdihRun(db, studyId, studyTitle, cdihRunId) {
  const selectSql = `
    SELECT R.ID_CDIH_RUN, R.ID_STUDY, R.ID_LATENT_RUN, R.ID_REFERENCE_SET, R.WEIGHTING,
           R.RUN_LABEL AS CDIH_RUN_LABEL, R.DIMENSION_COUNT, R.PERSON_COUNT, R.GENERATED_AT,
           S.REFERENCE_TYPE, S.REFERENCE_LABEL,
           L.METHOD, L.RUN_LABEL AS LATENT_RUN_LABEL, L.LATENT_DIMENSION_COUNT
    FROM GDX_HNF_CDIH_RUN R
    JOIN GDX_HNF_CDIH_REFERENCE_SET S ON S.ID_REFERENCE_SET = R.ID_REFERENCE_SET
    JOIN GDX_HNF_LATENT_RUN L ON L.ID_LATENT_RUN = R.ID_LATENT_RUN`;
  if (cdihRunId !== null && cdihRunId !== undefined && !Number.isNaN(cdihRunId)) {
    const rows = await query(db, `${selectSql} WHERE R.ID_CDIH_RUN = ?`, [cdihRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDIH_RUN with ID_CDIH_RUN=${cdihRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${cdihRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE R.ID_STUDY = ? ORDER BY R.GENERATED_AT DESC, R.ID_CDIH_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_CDIH_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_LATENT_SPACE --study ${JSON.stringify(studyTitle)} first.`
    );
  }
  return rows[0];
}

/** Which GDX_HNF_LATENT_DIMENSION rows this run's own GDX_HNF_CDIH_RUN_DIMENSION selected, in what
 * order, under which weight -- joined to GDX_HNF_LATENT_DIMENSION for DIMENSION_LABEL and (PCA only)
 * EXPLAINED_VARIANCE_RATIO, since GDX_HNF_CDIH_RUN_DIMENSION itself stores neither. */
async function loadRunDimensions(db, cdihRunId) {
  const rows = await query(db, `
    SELECT RD.DIMENSION_ORDER, RD.ID_LATENT_DIM, RD.WEIGHT, LD.DIMENSION_LABEL, LD.EXPLAINED_VARIANCE_RATIO
    FROM GDX_HNF_CDIH_RUN_DIMENSION RD
    JOIN GDX_HNF_LATENT_DIMENSION LD ON LD.ID_LATENT_DIM = RD.ID_LATENT_DIM
    WHERE RD.ID_CDIH_RUN = ?
    ORDER BY RD.DIMENSION_ORDER`, [cdihRunId]);
  return rows;
}

async function loadCdihValues(db, cdihRunId) {
  const rows = await query(db, `
    SELECT ID_CDIH_VALUE, ID_PERSON, CDIH_VALUE
    FROM GDX_HNF_CDIH_VALUE WHERE ID_CDIH_RUN = ? ORDER BY CDIH_VALUE`, [cdihRunId]);
  return rows.map((r) => ({ idCdihValue: r.ID_CDIH_VALUE, personId: r.ID_PERSON, cdiValue: Number(r.CDIH_VALUE) }));
}

/** RMS of each latent dimension's real per-person DIFFERENCE within this run, computed by the
 * database itself (AVG of the squared difference, square-rooted here) -- never re-pulling all
 * detail rows just to aggregate client-side. */
async function loadDimensionRmsContribution(db, cdihRunId) {
  const rows = await query(db, `
    SELECT D.ID_LATENT_DIM, AVG(D.DIFFERENCE * D.DIFFERENCE) AS MEAN_SQ
    FROM GDX_HNF_CDIH_VALUE_DETAIL D
    JOIN GDX_HNF_CDIH_VALUE V ON V.ID_CDIH_VALUE = D.ID_CDIH_VALUE
    WHERE V.ID_CDIH_RUN = ?
    GROUP BY D.ID_LATENT_DIM`, [cdihRunId]);
  const byDim = new Map();
  for (const r of rows) byDim.set(r.ID_LATENT_DIM, Math.sqrt(Number(r.MEAN_SQ)));
  return byDim;
}

async function loadPersonDetails(db, idCdihValue) {
  const rows = await query(db, `
    SELECT Det.ID_LATENT_DIM, LD.DIMENSION_LABEL, LD.DIMENSION_ORDER, Det.DIFFERENCE
    FROM GDX_HNF_CDIH_VALUE_DETAIL Det
    JOIN GDX_HNF_LATENT_DIMENSION LD ON LD.ID_LATENT_DIM = Det.ID_LATENT_DIM
    WHERE Det.ID_CDIH_VALUE = ?
    ORDER BY LD.DIMENSION_ORDER`, [idCdihValue]);
  return rows.map((r) => ({ featureCode: r.DIMENSION_LABEL, featureName: r.DIMENSION_LABEL, difference: Number(r.DIFFERENCE) }));
}

/** Picks three representative complete-case persons from an already CDIh-ascending-sorted list:
 * the run's own lowest CDIh, the one whose CDIh sits closest to the run's median, and the highest.
 * When the run has fewer than 3 persons, duplicates collapse naturally (the same person can be
 * shown more than once with a different role label) rather than this skill fabricating a
 * nonexistent fourth case. Identical selection logic to F4-original's own GRAPH skill. */
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
    { ...lowest, roleLabel: 'lowest CDIh' },
    { ...medianClosest, roleLabel: 'closest to median CDIh' },
    { ...highest, roleLabel: 'highest CDIh' },
  ];
}

/** Secondary annotation for card 2's tooltip: a PCA dimension's own real EXPLAINED_VARIANCE_RATIO,
 * never fabricated for AUTOENCODER/UMAP (where it stays absent, per F2's own schema). */
function dimensionFeatureName(dim, method) {
  if (method === 'PCA' && dim.EXPLAINED_VARIANCE_RATIO !== null && dim.EXPLAINED_VARIANCE_RATIO !== undefined) {
    return `Latent dimension ${dim.DIMENSION_LABEL} (explained variance ${(Number(dim.EXPLAINED_VARIANCE_RATIO) * 100).toFixed(1)}%)`;
  }
  return `Latent dimension ${dim.DIMENSION_LABEL} (${method})`;
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Eight
 * synthetic persons, four synthetic latent dimensions of a synthetic PCA run, enough to exercise
 * every rendering path (histogram spread, dimension ranking, three representative-person profiles
 * with both positive and negative differences). */
function buildSampleData() {
  const run = {
    ID_CDIH_RUN: 0, CDIH_RUN_LABEL: 'SAMPLE_CDIH_RUN (not a real GDX_HNF_CDIH_RUN)', WEIGHTING: 'UNWEIGHTED',
    REFERENCE_TYPE: 'LATENT_COHORT', REFERENCE_LABEL: 'SAMPLE_REFERENCE (not real)',
    METHOD: 'PCA', LATENT_RUN_LABEL: 'SAMPLE_LATENT_RUN (not real)', LATENT_DIMENSION_COUNT: 4,
    GENERATED_AT: new Date(),
  };
  const dimensions = [
    { ID_LATENT_DIM: 1, DIMENSION_LABEL: 'PC1', DIMENSION_ORDER: 1, EXPLAINED_VARIANCE_RATIO: 0.42, WEIGHT: 1 },
    { ID_LATENT_DIM: 2, DIMENSION_LABEL: 'PC2', DIMENSION_ORDER: 2, EXPLAINED_VARIANCE_RATIO: 0.21, WEIGHT: 1 },
    { ID_LATENT_DIM: 3, DIMENSION_LABEL: 'PC3', DIMENSION_ORDER: 3, EXPLAINED_VARIANCE_RATIO: 0.11, WEIGHT: 1 },
    { ID_LATENT_DIM: 4, DIMENSION_LABEL: 'PC4', DIMENSION_ORDER: 4, EXPLAINED_VARIANCE_RATIO: 0.06, WEIGHT: 1 },
  ];
  // [diff_PC1, diff_PC2, diff_PC3, diff_PC4] per synthetic person -- deliberately varied signs/magnitudes.
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
  const detailsByCdihValue = new Map();
  let idCounter = 1;
  for (const [personId, diffs] of Object.entries(diffsByPerson)) {
    const cdiValue = Math.sqrt(diffs.reduce((a, d) => a + d * d, 0) / diffs.length);
    const idCdihValue = idCounter++;
    values.push({ idCdihValue, personId, cdiValue });
    detailsByCdihValue.set(idCdihValue, dimensions.map((d, i) => ({ featureCode: d.DIMENSION_LABEL, featureName: d.DIMENSION_LABEL, difference: diffs[i] })));
  }
  values.sort((a, b) => a.cdiValue - b.cdiValue);
  const dimensionRms = new Map();
  for (let i = 0; i < dimensions.length; i++) {
    const sq = Object.values(diffsByPerson).map((d) => d[i] * d[i]);
    dimensionRms.set(dimensions[i].ID_LATENT_DIM, Math.sqrt(sq.reduce((a, b) => a + b, 0) / sq.length));
  }
  return { run, dimensions, values, dimensionRms, detailsByCdihValue, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, run, dimensions, values, dimensionRms, representatives, personDetailsByRole, sample }) {
  const histogramCard = renderHistogramCard({
    values, runLabel: run.CDIH_RUN_LABEL, weighting: run.WEIGHTING,
    referenceLabel: `${run.REFERENCE_TYPE} -- ${run.REFERENCE_LABEL}`, cardId: 'histogram',
    metricLabel: 'CDIh', metricNoun: `this run's own fitted latent space (${run.METHOD})`,
  });

  const dimensionCard = renderFeatureContributionCard({
    features: dimensions.map((d) => ({
      featureCode: d.DIMENSION_LABEL, featureName: dimensionFeatureName(d, run.METHOD), perspectiveName: run.METHOD,
      weight: Number(d.WEIGHT), rmsDiff: dimensionRms.get(d.ID_LATENT_DIM) ?? 0,
    })),
    weighting: run.WEIGHTING, cardId: 'dimension-contribution',
    metricLabel: 'CDIh', axisNoun: 'dimension',
  });

  const personCards = representatives.map((rep, idx) => renderPersonProfileCard({
    personId: rep.personId, cdiValue: rep.cdiValue, roleLabel: rep.roleLabel,
    details: personDetailsByRole[idx], cardId: `person-${idx}`,
    metricLabel: 'CDIh', axisNoun: 'dimension',
  }));

  const title = `Curvature Depth Index, latent space (CDIh) -- ${studyTitle}`;
  const description =
    `CDIh is an RMS displacement between a person's own real, fitted latent profile h(t) and this ` +
    `run's explicit reference, pinned to the same fitted coordinate system -- never the scalar ` +
    `curvature of a manifold, never comparable to CDIx (original characteristics), never evidence ` +
    `of a causal mechanism or a clinical condition. Every value plotted below is a real ` +
    `<code>GDX_HNF_CDIH_VALUE</code>/<code>GDX_HNF_CDIH_VALUE_DETAIL</code> row for this study and run.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `Evaluated latent run: ${run.LATENT_RUN_LABEL} (ID_LATENT_RUN=${run.ID_LATENT_RUN}), METHOD=${run.METHOD}, k=${run.LATENT_DIMENSION_COUNT}.`,
    `CDIh run: ${run.CDIH_RUN_LABEL}${run.ID_CDIH_RUN ? ` (ID_CDIH_RUN=${run.ID_CDIH_RUN})` : ''}, weighting=${run.WEIGHTING}, reference=${run.REFERENCE_TYPE} ("${run.REFERENCE_LABEL}"), generated ${formatTimestampUtc(run.GENERATED_AT)}.`,
    `Latent dimensions in this run: ${dimensions.length}. Complete-case persons: ${values.length}.`,
    'A larger CDIh means a larger displacement from the chosen reference within this one fitted latent coordinate system -- never, by itself, a "worse" condition, and carries no fixed upper bound. CDIh values from two different GDX_HNF_LATENT_RUN rows are never comparable to each other.',
  ].filter(Boolean);

  return pageShell({
    title, description, metaLines,
    bodyHtml: [histogramCard, dimensionCard, ...personCards].join('\n'),
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
    const personDetailsByRole = representatives.map((r) => sampleData.detailsByCdihValue.get(r.idCdihValue));
    const html = buildPageHtml({
      studyTitle, study: args.study || 'sample', run: sampleData.run, dimensions: sampleData.dimensions,
      values: sampleData.values, dimensionRms: sampleData.dimensionRms, representatives, personDetailsByRole, sample: true,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.dimensions.length} latent dimension(s), ${sampleData.values.length} person(s).`);
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
    const run = await resolveCdihRun(db, studyId, studyTitle, args.cdihRunId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). CDIh run "${run.CDIH_RUN_LABEL}" (ID_CDIH_RUN=${run.ID_CDIH_RUN}), evaluated latent run METHOD=${run.METHOD} (ID_LATENT_RUN=${run.ID_LATENT_RUN}), weighting=${run.WEIGHTING}, reference=${run.REFERENCE_TYPE}.`);

    const dimensions = await loadRunDimensions(db, run.ID_CDIH_RUN);
    if (dimensions.length === 0) throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${run.ID_CDIH_RUN} has no GDX_HNF_CDIH_RUN_DIMENSION rows -- nothing to plot.`);

    const values = await loadCdihValues(db, run.ID_CDIH_RUN);
    if (values.length === 0) throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${run.ID_CDIH_RUN} has no GDX_HNF_CDIH_VALUE rows -- nothing to plot.`);

    const dimensionRms = await loadDimensionRmsContribution(db, run.ID_CDIH_RUN);

    const representatives = pickRepresentativePersons(values);
    const personDetailsByRole = [];
    for (const rep of representatives) personDetailsByRole.push(await loadPersonDetails(db, rep.idCdihValue));

    console.log(`Latent dimensions: ${dimensions.length}. Complete-case persons: ${values.length}. Representative persons: ${representatives.map((r) => `#${r.personId} (${r.roleLabel})`).join(', ')}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, run, dimensions, values, dimensionRms, representatives, personDetailsByRole, sample: false });
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
