#!/usr/bin/env node
/**
 * F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH
 *
 * Renders the real GDX_HNF_CDI_COMPARE_* rows this project already has -- written by
 * F4_CURV_DEPTH_KPI_COMPARE_MODEL, this folder's F4 comparison skill -- as a standalone HTML page
 * with three cards, built from one chosen GDX_HNF_CDI_COMPARE_RUN:
 *
 *   1. two histograms side by side (CDIx's own distribution, CDIh's own distribution) over the
 *      SAME paired-person set, each kept on its own scale,
 *   2. a scatter of (CDIx, CDIh) per paired person, annotated with the real Pearson r --
 *      COMPUTED HERE, at render time, from the frozen paired values (never stored by the compute
 *      layer),
 *   3. a back-to-back bar panel for the three representative persons (lowest / median-closest /
 *      highest CDIx among the paired set), each with its own real CDIx and CDIh side by side --
 *      ranks ALSO computed here, at render time.
 *
 * Shaped after this project's own design document section 7.1 ("Exemplo numerico completo e
 * comparacao"), whose own figure ("Figura -- Comparacao puramente ficticia de indices em dois
 * espacos; valores nao sao uma avaliacao de desempenho") works a single FICTITIOUS pair of
 * numbers. This skill plots only real, paired GDX_HNF_CDI_COMPARE_VALUE rows instead.
 *
 * Never writes to the database -- purely a reader, same posture as this folder's other graph
 * skills. Never re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
 * 7.multidimensional.database or 9.knowledge.graph, and never re-computes a CDIx or CDIh value,
 * and never re-pairs two runs -- only GDX_HNF_CDI_COMPARE_RUN / GDX_HNF_CDI_COMPARE_VALUE
 * (already written by F4_CURV_DEPTH_KPI_COMPARE_MODEL), plus GDX_HNF_CDI_RUN /
 * GDX_HNF_CDI_REFERENCE_SET (F4) and GDX_HNF_CDIH_RUN / GDX_HNF_CDIH_REFERENCE_SET /
 * GDX_HNF_LATENT_RUN (F4-alternative) for the two source runs' own labels.
 *
 * Usage:
 *   node generate_curvature_depth_compare_graph.js --study <slug>
 *     [--compare-run-id <id>] [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>        REQUIRED outside --sample. Same slug F1/F2/F3/F4/F4-alternative/
 *                         F4_CURV_DEPTH_KPI_COMPARE_MODEL use -- resolves to
 *                         GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                         study.title.
 *   --compare-run-id <id> optional. A specific GDX_HNF_CDI_COMPARE_RUN.ID_COMPARE_RUN instead of
 *                         the study's latest (errors if that run belongs to a different study).
 *   --out-dir <path>      optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>   optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run             computes everything (resolved run, paired count, representative
 *                         persons, Pearson r, output filename) and logs it, writing no file.
 *   --sample              renders from small, explicitly-labeled embedded synthetic data instead
 *                         of connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderPairedHistogramsCard, renderComparisonScatterCard, renderRepresentativePairCard, pickRepresentatives, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = { study: null, compareRunId: null, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--compare-run-id') args.compareRunId = parseInt(argv[++i], 10);
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
 * script (16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH/scripts) --
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
  return `f4_curvature_depth_index_compare_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
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

/** Resolves which GDX_HNF_CDI_COMPARE_RUN to plot: an explicit --compare-run-id (validated to
 * belong to this study), or else the latest one for this study. Joins in both source runs' own
 * labels/reference info -- GDX_HNF_CDI_COMPARE_RUN itself stores neither. */
async function resolveCompareRun(db, studyId, studyTitle, compareRunId) {
  const selectSql = `
    SELECT CR.ID_COMPARE_RUN, CR.ID_STUDY, CR.ID_CDI_RUN, CR.ID_CDIH_RUN, CR.RUN_LABEL,
           CR.PAIRED_PERSON_COUNT, CR.EXCLUDED_CDI_ONLY_COUNT, CR.EXCLUDED_CDIH_ONLY_COUNT, CR.GENERATED_AT,
           R1.RUN_LABEL AS CDI_RUN_LABEL, R1.WEIGHTING AS CDI_WEIGHTING,
           S1.REFERENCE_TYPE AS CDI_REFERENCE_TYPE, S1.REFERENCE_LABEL AS CDI_REFERENCE_LABEL,
           R2.RUN_LABEL AS CDIH_RUN_LABEL, R2.WEIGHTING AS CDIH_WEIGHTING,
           S2.REFERENCE_TYPE AS CDIH_REFERENCE_TYPE, S2.REFERENCE_LABEL AS CDIH_REFERENCE_LABEL,
           L.METHOD AS CDIH_METHOD
    FROM GDX_HNF_CDI_COMPARE_RUN CR
    JOIN GDX_HNF_CDI_RUN R1 ON R1.ID_CDI_RUN = CR.ID_CDI_RUN
    JOIN GDX_HNF_CDI_REFERENCE_SET S1 ON S1.ID_REFERENCE_SET = R1.ID_REFERENCE_SET
    JOIN GDX_HNF_CDIH_RUN R2 ON R2.ID_CDIH_RUN = CR.ID_CDIH_RUN
    JOIN GDX_HNF_CDIH_REFERENCE_SET S2 ON S2.ID_REFERENCE_SET = R2.ID_REFERENCE_SET
    JOIN GDX_HNF_LATENT_RUN L ON L.ID_LATENT_RUN = R2.ID_LATENT_RUN`;
  if (compareRunId !== null && compareRunId !== undefined && !Number.isNaN(compareRunId)) {
    const rows = await query(db, `${selectSql} WHERE CR.ID_COMPARE_RUN = ?`, [compareRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_COMPARE_RUN with ID_COMPARE_RUN=${compareRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDI_COMPARE_RUN ID_COMPARE_RUN=${compareRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE CR.ID_STUDY = ? ORDER BY CR.GENERATED_AT DESC, CR.ID_COMPARE_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_CDI_COMPARE_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_COMPARE_MODEL --study ${JSON.stringify(studyTitle)} first.`);
  }
  return rows[0];
}

async function loadCompareValues(db, compareRunId) {
  const rows = await query(db, `
    SELECT ID_PERSON, CDI_VALUE, CDIH_VALUE FROM GDX_HNF_CDI_COMPARE_VALUE WHERE ID_COMPARE_RUN = ?`, [compareRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdiValue: Number(r.CDI_VALUE), cdihValue: Number(r.CDIH_VALUE) }));
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Eight
 * synthetic persons with both a synthetic CDIx and CDIh, deliberately rank-shuffled between the
 * two series so the "ranks need not agree between the two spaces" point is visible even here. */
function buildSampleData() {
  const run = {
    ID_COMPARE_RUN: 0, RUN_LABEL: 'SAMPLE_CDICOMPARE_RUN (not real)', GENERATED_AT: new Date(),
    CDI_RUN_LABEL: 'SAMPLE_CDI_RUN (not real)', CDI_WEIGHTING: 'UNWEIGHTED',
    CDI_REFERENCE_TYPE: 'STUDY_COHORT', CDI_REFERENCE_LABEL: 'SAMPLE_REFERENCE (not real)',
    CDIH_RUN_LABEL: 'SAMPLE_CDIH_RUN (not real)', CDIH_WEIGHTING: 'UNWEIGHTED',
    CDIH_REFERENCE_TYPE: 'LATENT_COHORT', CDIH_REFERENCE_LABEL: 'SAMPLE_REFERENCE (not real)',
    CDIH_METHOD: 'PCA', EXCLUDED_CDI_ONLY_COUNT: 0, EXCLUDED_CDIH_ONLY_COUNT: 0,
  };
  // personId -> [cdiValue, cdihValue], deliberately NOT rank-preserving between the two columns.
  const rows = {
    'SAMPLE-1': [0.12, 0.40],
    'SAMPLE-2': [0.25, 0.18],
    'SAMPLE-3': [0.31, 0.52],
    'SAMPLE-4': [0.44, 0.22],
    'SAMPLE-5': [0.58, 0.61],
    'SAMPLE-6': [0.63, 0.15],
    'SAMPLE-7': [0.77, 0.70],
    'SAMPLE-8': [0.90, 0.34],
  };
  const paired = Object.entries(rows).map(([personId, [cdiValue, cdihValue]]) => ({ personId, cdiValue, cdihValue }));
  return { run, paired, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, run, paired, representatives, sample }) {
  const histogramsCard = renderPairedHistogramsCard({
    cdiNums: paired.map((p) => p.cdiValue), cdihNums: paired.map((p) => p.cdihValue),
    cdiRunLabel: run.CDI_RUN_LABEL, cdihRunLabel: run.CDIH_RUN_LABEL,
    cdiReferenceLabel: `${run.CDI_REFERENCE_TYPE} -- ${run.CDI_REFERENCE_LABEL}`,
    cdihReferenceLabel: `${run.CDIH_REFERENCE_TYPE} -- ${run.CDIH_REFERENCE_LABEL}`,
    cdihMethod: run.CDIH_METHOD, cardId: 'paired-hist',
  });
  const scatterCard = renderComparisonScatterCard({ points: paired, cardId: 'scatter' });
  const representativeCard = renderRepresentativePairCard({ representatives, cardId: 'representatives' });

  const title = `CDIx vs. CDIh -- ${studyTitle}`;
  const description =
    `CDIx (original normalized feature space) and CDIh (fitted latent space) are both RMS ` +
    `displacements from an explicit reference, but computed in two different spaces under ` +
    `two different runs. Every value plotted below is a real <code>GDX_HNF_CDI_COMPARE_VALUE</code> ` +
    `row for this study, already paired by person by <code>F4_CURV_DEPTH_KPI_COMPARE_MODEL</code>. ` +
    `Pearson r, ranks and the three representative persons below are computed at render time, from ` +
    `these already-frozen rows, and are never themselves persisted.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `Compare run: ${run.RUN_LABEL}${run.ID_COMPARE_RUN ? ` (ID_COMPARE_RUN=${run.ID_COMPARE_RUN})` : ''}, generated ${formatTimestampUtc(run.GENERATED_AT)}.`,
    `CDIx run: ${run.CDI_RUN_LABEL}, weighting=${run.CDI_WEIGHTING}, reference=${run.CDI_REFERENCE_TYPE} ("${run.CDI_REFERENCE_LABEL}").`,
    `CDIh run: ${run.CDIH_RUN_LABEL}, METHOD=${run.CDIH_METHOD}, weighting=${run.CDIH_WEIGHTING}, reference=${run.CDIH_REFERENCE_TYPE} ("${run.CDIH_REFERENCE_LABEL}").`,
    `Paired persons: ${paired.length}. Excluded (CDIx run only): ${run.EXCLUDED_CDI_ONLY_COUNT}. Excluded (CDIh run only): ${run.EXCLUDED_CDIH_ONLY_COUNT}.`,
  ].filter(Boolean);

  return pageShell({
    title, description, metaLines,
    bodyHtml: [histogramsCard, scatterCard, representativeCard].join('\n'),
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
    const representatives = pickRepresentatives(sampleData.paired);
    const html = buildPageHtml({ studyTitle, study: args.study || 'sample', run: sampleData.run, paired: sampleData.paired, representatives, sample: true });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.paired.length} paired person(s).`);
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
    const run = await resolveCompareRun(db, studyId, studyTitle, args.compareRunId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Compare run "${run.RUN_LABEL}" (ID_COMPARE_RUN=${run.ID_COMPARE_RUN}): CDIx run "${run.CDI_RUN_LABEL}" vs. CDIh run "${run.CDIH_RUN_LABEL}" (METHOD=${run.CDIH_METHOD}).`);

    const paired = await loadCompareValues(db, run.ID_COMPARE_RUN);
    if (paired.length === 0) throw new Error(`GDX_HNF_CDI_COMPARE_RUN ID_COMPARE_RUN=${run.ID_COMPARE_RUN} has no GDX_HNF_CDI_COMPARE_VALUE rows -- nothing to plot.`);

    const representatives = pickRepresentatives(paired);
    console.log(`Paired persons: ${paired.length}. Representative persons: ${representatives.map((r) => `#${r.personId} (${r.roleLabel}, CDIx rank ${r.cdiRank}/${r.totalPaired}, CDIh rank ${r.cdihRank}/${r.totalPaired})`).join(', ')}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, run, paired, representatives, sample: false });
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
