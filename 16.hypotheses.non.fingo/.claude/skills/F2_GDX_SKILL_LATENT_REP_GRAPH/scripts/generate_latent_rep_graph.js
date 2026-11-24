#!/usr/bin/env node
/**
 * F2_GDX_SKILL_LATENT_REP_GRAPH
 *
 * For one study, renders the real latent-representation results F2_GDX_SKILL_LATENT_REPRESENTATIONS
 * already wrote into the GDX_HNF_LATENT_* tables -- one standalone HTML page with up to three
 * cards, one per method (PCA, AUTOENCODER, UMAP): a 2D scatter of each person's own first two
 * latent coordinates (GDX_HNF_LATENT_VALUE, dimension order 1 vs 2), with a dashed crosshair
 * through the origin. PCA's card is additionally overlaid with loading-direction arrows
 * (GDX_HNF_LATENT_LOADING) for the features with the largest combined magnitude on those two
 * dimensions -- a standard PCA biplot. Autoencoder/UMAP never get an arrow overlay: neither method
 * has a GDX_HNF_LATENT_LOADING row (no fixed per-feature coefficient exists for either), so nothing
 * is approximated or implied in its place.
 *
 * A method with no GDX_HNF_LATENT_RUN for this study yet (today: AUTOENCODER and UMAP are not
 * implemented by F2_GDX_SKILL_LATENT_REPRESENTATIONS) still gets its own card, explicitly marked
 * "Not available", never silently omitted.
 *
 * Only reads GDX_HNF_LATENT_RUN / GDX_HNF_LATENT_DIMENSION / GDX_HNF_LATENT_VALUE /
 * GDX_HNF_LATENT_LOADING plus GDX_HNF_FEATURE_DICTIONARY (feature names for the loading table) --
 * never re-reads GDX_HNF_FEATURE_VALUE or any of the lower-level sources F1/F2 already assembled
 * from (same "consume the prior skill's own output" posture this folder's other graph skill uses).
 *
 * Usage:
 *   node generate_latent_rep_graph.js --study <slug> [--pca-run-id <id>]
 *     [--autoencoder-run-id <id>] [--umap-run-id <id>] [--top-loadings <n>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>           REQUIRED outside --sample. Same slug F2/F1 use -- resolves to
 *                            GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                            study.title.
 *   --pca-run-id <id>         optional. Use a specific GDX_HNF_LATENT_RUN.ID_LATENT_RUN (method
 *                            PCA) instead of the latest PCA run for this study.
 *   --autoencoder-run-id <id> same, for METHOD='AUTOENCODER'.
 *   --umap-run-id <id>        same, for METHOD='UMAP'.
 *   --top-loadings <n>        how many PCA feature-loading arrows to draw, ranked by combined
 *                            magnitude on the two plotted dimensions (default 8). Every loading
 *                            still appears in that card's table-view fallback regardless of this
 *                            cap -- this only controls how many arrows are drawn on the plot itself.
 *   --out-dir <path>          optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>       optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run                 computes everything and logs the output filename, writing no file.
 *   --sample                   renders from embedded, explicitly-labeled sample data (one method
 *                            with points+arrows, one with points only, one marked unavailable)
 *                            instead of connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderLatentScatterCard, renderNotAvailableCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const METHODS = ['PCA', 'AUTOENCODER', 'UMAP'];

function parseArgs(argv) {
  const args = {
    study: null, topLoadings: 8, outDir: null, intakeDir: null, dryRun: false, sample: false,
    runIdByMethod: { PCA: null, AUTOENCODER: null, UMAP: null },
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--pca-run-id') args.runIdByMethod.PCA = parseInt(argv[++i], 10);
    else if (a === '--autoencoder-run-id') args.runIdByMethod.AUTOENCODER = parseInt(argv[++i], 10);
    else if (a === '--umap-run-id') args.runIdByMethod.UMAP = parseInt(argv[++i], 10);
    else if (a === '--top-loadings') args.topLoadings = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F2 use), unless --sample is passed.');
  }
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

function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
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
  return `f2_latent_rep_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves one method's GDX_HNF_LATENT_RUN: an explicit --<method>-run-id (validated to belong to
 * this study and actually be that method), or else the latest run of that method for this study.
 * Returns null (not a throw) when none exists -- the caller renders a "Not available" card instead
 * of failing the whole page over one missing method. */
async function resolveMethodRun(db, studyId, method, explicitRunId) {
  if (explicitRunId !== null && explicitRunId !== undefined && !Number.isNaN(explicitRunId)) {
    const rows = await query(db, `
      SELECT ID_LATENT_RUN, ID_STUDY, METHOD, RUN_LABEL, PERSON_COUNT, GENERATED_AT
      FROM GDX_HNF_LATENT_RUN WHERE ID_LATENT_RUN = ?`, [explicitRunId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_LATENT_RUN with ID_LATENT_RUN=${explicitRunId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) throw new Error(`GDX_HNF_LATENT_RUN ID_LATENT_RUN=${explicitRunId} belongs to a different study (ID_STUDY=${run.ID_STUDY}).`);
    if (run.METHOD !== method) throw new Error(`GDX_HNF_LATENT_RUN ID_LATENT_RUN=${explicitRunId} has METHOD='${run.METHOD}', not '${method}'.`);
    return run;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_LATENT_RUN, ID_STUDY, METHOD, RUN_LABEL, PERSON_COUNT, GENERATED_AT
    FROM GDX_HNF_LATENT_RUN
    WHERE ID_STUDY = ? AND METHOD = ?
    ORDER BY GENERATED_AT DESC, ID_LATENT_RUN DESC`, [studyId, method]);
  return rows.length ? rows[0] : null;
}

async function loadFirstTwoDimensions(db, latentRunId) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, DIMENSION_ORDER, DIMENSION_LABEL, EXPLAINED_VARIANCE_RATIO
    FROM GDX_HNF_LATENT_DIMENSION
    WHERE ID_LATENT_RUN = ? AND DIMENSION_ORDER IN (1, 2)
    ORDER BY DIMENSION_ORDER`, [latentRunId]);
  return rows;
}

async function loadValuesForDimensions(db, dimIds) {
  const rows = await query(db, `
    SELECT ID_LATENT_DIM, ID_PERSON, COORDINATE_VALUE
    FROM GDX_HNF_LATENT_VALUE
    WHERE ID_LATENT_DIM IN (${dimIds.map(() => '?').join(',')})`, dimIds);
  return rows;
}

async function loadLoadingsForDimensions(db, dimIds) {
  const rows = await query(db, `
    SELECT L.ID_LATENT_DIM, L.ID_FEATURE, L.LOADING_VALUE, D.FEATURE_CODE, D.NAME
    FROM GDX_HNF_LATENT_LOADING L
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = L.ID_FEATURE
    WHERE L.ID_LATENT_DIM IN (${dimIds.map(() => '?').join(',')})`, dimIds);
  return rows;
}

/** Builds one method's card data: points (one per person present on both dimensions) and, for
 * PCA, the top-N loading arrows by combined magnitude, pre-scaled for plot visibility. Returns
 * null fields (never throws) when the run/dimensions aren't usable -- the caller decides the
 * "Not available" message. */
async function buildMethodCard(db, studyId, method, explicitRunId, topLoadings) {
  const run = await resolveMethodRun(db, studyId, method, explicitRunId);
  if (!run) {
    return { available: false, reason: `No GDX_HNF_LATENT_RUN with METHOD='${method}' found for this study yet.` +
      (method !== 'PCA' ? ` As of this writing, F2_GDX_SKILL_LATENT_REPRESENTATIONS only implements --method pca -- ${method.toLowerCase()} runs will appear here once a later increment adds it.` :
        ' Run F2_GDX_SKILL_LATENT_REPRESENTATIONS --study <slug> --method pca first.') };
  }

  const dims = await loadFirstTwoDimensions(db, run.ID_LATENT_RUN);
  if (dims.length < 2) {
    return { available: false, reason: `Run "${run.RUN_LABEL}" (ID_LATENT_RUN=${run.ID_LATENT_RUN}) has only ${dims.length} dimension(s) -- a 2D projection needs at least 2.` };
  }
  const [dim1, dim2] = dims;

  const valueRows = await loadValuesForDimensions(db, [dim1.ID_LATENT_DIM, dim2.ID_LATENT_DIM]);
  const byPerson = new Map();
  for (const r of valueRows) {
    if (!byPerson.has(r.ID_PERSON)) byPerson.set(r.ID_PERSON, {});
    byPerson.get(r.ID_PERSON)[r.ID_LATENT_DIM] = Number(r.COORDINATE_VALUE);
  }
  const points = [];
  for (const [personId, coords] of byPerson.entries()) {
    if (coords[dim1.ID_LATENT_DIM] === undefined || coords[dim2.ID_LATENT_DIM] === undefined) continue;
    points.push({ personId, x: coords[dim1.ID_LATENT_DIM], y: coords[dim2.ID_LATENT_DIM] });
  }
  points.sort((a, b) => a.personId - b.personId);

  if (points.length === 0) {
    return { available: false, reason: `Run "${run.RUN_LABEL}" (ID_LATENT_RUN=${run.ID_LATENT_RUN}) has no GDX_HNF_LATENT_VALUE rows on both of its first two dimensions.` };
  }

  let loadings = null;
  if (method === 'PCA') {
    const loadingRows = await loadLoadingsForDimensions(db, [dim1.ID_LATENT_DIM, dim2.ID_LATENT_DIM]);
    const byFeature = new Map();
    for (const r of loadingRows) {
      if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, { featureCode: r.FEATURE_CODE, name: r.NAME });
      byFeature.get(r.ID_FEATURE)[r.ID_LATENT_DIM] = Number(r.LOADING_VALUE);
    }
    const allLoadings = [];
    for (const [, l] of byFeature.entries()) {
      const rawX = l[dim1.ID_LATENT_DIM], rawY = l[dim2.ID_LATENT_DIM];
      if (rawX === undefined || rawY === undefined) continue;
      allLoadings.push({ featureCode: l.featureCode, featureName: l.name, rawX, rawY, magnitude: Math.sqrt(rawX * rawX + rawY * rawY) });
    }
    allLoadings.sort((a, b) => b.magnitude - a.magnitude);
    const selected = allLoadings.slice(0, Math.max(0, topLoadings));

    const maxScoreRadius = Math.max(...points.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)), 1e-9);
    const maxLoadingRadius = Math.max(...allLoadings.map((l) => l.magnitude), 1e-9);
    const scaleFactor = maxLoadingRadius > 0 ? (maxScoreRadius * 0.85) / maxLoadingRadius : 1;

    loadings = selected.map((l) => ({
      featureCode: l.featureCode, featureName: l.featureName,
      rawX: l.rawX, rawY: l.rawY,
      x: l.rawX * scaleFactor, y: l.rawY * scaleFactor,
    }));
  }

  return {
    available: true,
    runLabel: run.RUN_LABEL,
    personCount: points.length,
    dim1: { label: dim1.DIMENSION_LABEL, explainedVarianceRatio: dim1.EXPLAINED_VARIANCE_RATIO === null ? null : Number(dim1.EXPLAINED_VARIANCE_RATIO) },
    dim2: { label: dim2.DIMENSION_LABEL, explainedVarianceRatio: dim2.EXPLAINED_VARIANCE_RATIO === null ? null : Number(dim2.EXPLAINED_VARIANCE_RATIO) },
    points,
    loadings,
  };
}

/** Small, explicitly-labeled embedded sample exercising all three card states this skill can
 * render: PCA (points + loading arrows), AUTOENCODER (points only, no arrows), UMAP (not
 * available) -- NOT from any real study. */
function buildSampleCards() {
  const points = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * Math.PI * 2;
    return { personId: `SAMPLE-${i + 1}`, x: Math.cos(angle) * (1 + (i % 3) * 0.3), y: Math.sin(angle) * (1 + (i % 5) * 0.2) };
  });
  const pca = {
    available: true, runLabel: 'SAMPLE_RUN (not a real GDX_HNF_LATENT_RUN)', personCount: points.length,
    dim1: { label: 'PC1', explainedVarianceRatio: 0.31 }, dim2: { label: 'PC2', explainedVarianceRatio: 0.17 },
    points,
    loadings: [
      { featureCode: 'SAMPLE.VAR.A', featureName: 'Sample variable A', rawX: 0.62, rawY: 0.11, x: 0.9, y: 0.16 },
      { featureCode: 'SAMPLE.VAR.B', featureName: 'Sample variable B', rawX: -0.48, rawY: 0.34, x: -0.7, y: 0.5 },
      { featureCode: 'SAMPLE.VAR.C', featureName: 'Sample variable C', rawX: 0.1, rawY: -0.55, x: 0.14, y: -0.8 },
    ],
  };
  const autoencoder = {
    available: true, runLabel: 'SAMPLE_RUN (not a real GDX_HNF_LATENT_RUN)', personCount: points.length,
    dim1: { label: 'LATENT_1', explainedVarianceRatio: null }, dim2: { label: 'LATENT_2', explainedVarianceRatio: null },
    points: points.map((p) => ({ ...p, x: p.x * 0.8 + 0.2, y: p.y * 1.1 - 0.1 })),
    loadings: null,
  };
  const umap = { available: false, reason: 'SAMPLE mode does not fabricate a third method -- this card demonstrates the "Not available" state.' };
  return { PCA: pca, AUTOENCODER: autoencoder, UMAP: umap };
}

function buildPageHtml({ studyTitle, study, cardsByMethod, sample }) {
  const cardsHtml = METHODS.map((method) => {
    const card = cardsByMethod[method];
    if (!card.available) return renderNotAvailableCard({ method, reason: card.reason });
    return renderLatentScatterCard({
      method, runLabel: card.runLabel, personCount: card.personCount,
      dim1: card.dim1, dim2: card.dim2, points: card.points, loadings: card.loadings,
      cardId: `latent-${method.toLowerCase()}`,
    });
  }).join('\n');

  const availableCount = METHODS.filter((m) => cardsByMethod[m].available).length;
  const title = `Latent representations -- ${studyTitle}`;
  const description =
    `One card per latent-representation method (PCA, an autoencoder, UMAP): each person's own ` +
    `first two latent coordinates, plotted as a 2D scatter around the origin. PCA's card is also ` +
    `overlaid with loading-direction arrows for the input features with the largest combined ` +
    `weight on those two dimensions -- the one method with a real, fixed per-feature coefficient ` +
    `to show. A visual grouping or distance in a 2D projection is not, by itself, evidence of a ` +
    `real subgroup or a meaningful similarity -- that needs separate validation, and a PCA, an ` +
    `autoencoder and a UMAP projection of the same data are three independent, ` +
    `non-interchangeable views, never merged or compared as if they were the same space.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `Methods with data available: ${availableCount} of ${METHODS.length}.`,
    'Only each run\'s first two dimensions (order 1 and 2) are plotted, even when a run has more than two.',
  ].filter(Boolean);

  return pageShell({
    title,
    description,
    metaLines,
    bodyHtml: cardsHtml,
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
    const intake = args.study ? loadIntake(args) : null;
    const studyTitle = (intake && intake.study && intake.study.title) || 'Sample Study (illustrative, not a real GDX_HUMAN study)';
    const html = buildPageHtml({ studyTitle, study: args.study || 'sample', cardsByMethod: buildSampleCards(), sample: true });
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
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}).`);

    const cardsByMethod = {};
    for (const method of METHODS) {
      cardsByMethod[method] = await buildMethodCard(db, studyId, method, args.runIdByMethod[method], args.topLoadings);
      if (cardsByMethod[method].available) {
        console.log(`  ${method}: run "${cardsByMethod[method].runLabel}", ${cardsByMethod[method].personCount} person(s) plotted` +
          (cardsByMethod[method].loadings ? `, ${cardsByMethod[method].loadings.length} loading arrow(s)` : '') + '.');
      } else {
        console.log(`  ${method}: not available -- ${cardsByMethod[method].reason}`);
      }
    }

    const html = buildPageHtml({ studyTitle, study: args.study, cardsByMethod, sample: false });
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
