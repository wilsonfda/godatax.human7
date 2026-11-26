#!/usr/bin/env node
/**
 * F5_GEOMETRIC_CURVATURE_GRAPH
 *
 * Renders TWO of this folder's own figures for one study, as a standalone HTML page:
 *
 *   Card 1 (section 9.1, "Tres profundidades graficas parametrizadas por CDI; relacao escolhida
 *   por design") -- the SAME real CDI(t)/CDIh(t) population mapped through several different
 *   graphic gains `a` (profundidade_visual = a * CDI), plus this run's own three representative
 *   real persons (lowest/median-closest/highest CDI) marked on every line.
 *
 *   Card 2 (section 9.3, "Como produzir a curva utilizando os dados reais?") -- the SAME three
 *   representative persons, each drawn as a Gaussian dip curve y(s) = -CDI(t) *
 *   exp(-s^2/(2*sigma^2)) -- only each curve's point at s=0 (= -CDI(t)) is determined by a real
 *   number; sigma only changes how wide the dip looks.
 *
 * Deliberately does NOT require a pre-existing GDX_HNF_VISDEPTH_RUN/GDX_HNF_DEPTHCURVE_RUN --
 * both gain/sigma are rendering/design choices (sections 9.1 and 9.3's own point: neither is a
 * physical constant), so this script reads the real CDI source directly (GDX_HNF_CDI_VALUE or
 * GDX_HNF_CDIH_VALUE) and applies both transforms live, at render time -- the same lightweight,
 * deterministic, non-persisted computation posture every other GRAPH skill in this folder already
 * takes (e.g. F3's own Pearson r, computed live from already-frozen coordinates, never stored by
 * F3 itself). The defaults (gains 1, 2, 5; sigma 1) are the exact values this folder's own
 * F5_GEOMETRIC_CURVATURE --sample worked examples already use -- not arbitrary, and documented.
 *
 * Never computes or displays a true Riemannian scalar curvature -- see
 * F5_GEOMETRIC_CURVATURE/SKILL.md for why that is permanently out of scope for this project's own
 * pipeline.
 *
 * Usage:
 *   node generate_geometric_curvature_graph.js --study <slug>
 *     [--source-kind cdix|cdih] [--source-run-id <id>] [--gains 1,2,5] [--sigma 1]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>              REQUIRED outside --sample. Same slug F1/F4/F5 use -- resolves to
 *                                GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                                study.title.
 *   --source-kind cdix|cdih      optional, default cdix. cdix reads GDX_HNF_CDI_RUN/GDX_HNF_CDI_
 *                                VALUE (original characteristics); cdih reads GDX_HNF_CDIH_RUN/
 *                                GDX_HNF_CDIH_VALUE (latent space).
 *   --source-run-id <id>         optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN or
 *                                GDX_HNF_CDIH_RUN.ID_CDIH_RUN (matching --source-kind) instead of
 *                                the study's latest of that kind.
 *   --gains <a1,a2,...>           optional, default "1,2,5" -- each a > 0. Card 1's graphic gains;
 *                                same meaning as F5_GEOMETRIC_CURVATURE's own --gain, here applied
 *                                live, at render time, to every real CDI value.
 *   --sigma <s>                   optional, default 1, s > 0. Card 2's curve width; same meaning
 *                                as F5_GEOMETRIC_CURVATURE's own --sigma, here applied live.
 *   --out-dir <path>             optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>          optional override of the default new_study_intake/<slug>/
 *                                location.
 *   --dry-run                     computes and logs everything (source run, person count,
 *                                representative persons), writes no file.
 *   --sample                      renders from embedded, clearly-labeled sample data instead of
 *                                connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderThreeDepthsCard, renderDepthCurveCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const SOURCE_KINDS = ['CDIX', 'CDIH'];
const DEFAULT_GAINS = [1, 2, 5];
const DEFAULT_SIGMA = 1;

function parseArgs(argv) {
  const args = { study: null, sourceKind: 'CDIX', sourceRunId: null, gains: DEFAULT_GAINS, sigma: DEFAULT_SIGMA, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--source-kind') args.sourceKind = String(argv[++i] || '').toUpperCase();
    else if (a === '--source-run-id') args.sourceRunId = parseInt(argv[++i], 10);
    else if (a === '--gains') {
      args.gains = String(argv[++i] || '').split(',').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n));
    } else if (a === '--sigma') args.sigma = parseFloat(argv[++i]);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F4/F5 use), unless --sample is passed.');
  }
  if (!SOURCE_KINDS.includes(args.sourceKind)) {
    throw new Error(`--source-kind ${args.sourceKind} is not recognized. Supported: cdix, cdih.`);
  }
  if (args.gains.length === 0) throw new Error('--gains must list at least one positive number.');
  if (args.gains.some((g) => !(g > 0))) throw new Error('Every --gains value must be > 0 (profundidade_visual = a * CDI(t), a > 0).');
  args.gains = [...new Set(args.gains)].sort((a, b) => a - b);
  if (Number.isNaN(args.sigma) || !(args.sigma > 0)) {
    throw new Error('--sigma must be > 0 (y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), sigma > 0).');
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

/** 0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this script
 * (16.hypotheses.non.fingo/.claude/skills/F5_GEOMETRIC_CURVATURE_GRAPH/scripts) -- same
 * depth/shape as this folder's other GRAPH skills' resolveIntakePath(). */
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
  return `f5_geometric_curvature_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves the GDX_HNF_CDI_RUN (CDIX) to read: an explicit --source-run-id (validated to belong
 * to this study), or else the study's latest. */
async function resolveCdiRun(db, studyId, studyTitle, runId) {
  const selectSql = `SELECT ID_CDI_RUN, ID_STUDY, RUN_LABEL FROM GDX_HNF_CDI_RUN`;
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `${selectSql} WHERE ID_CDI_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_RUN with ID_CDI_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_CDI_RUN DESC`, [studyId]);
  if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS --study ${JSON.stringify(studyTitle)} first.`);
  return rows[0];
}

/** Resolves the GDX_HNF_CDIH_RUN (CDIH) to read -- same shape as resolveCdiRun above. */
async function resolveCdihRun(db, studyId, studyTitle, runId) {
  const selectSql = `SELECT ID_CDIH_RUN, ID_STUDY, RUN_LABEL FROM GDX_HNF_CDIH_RUN`;
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `${selectSql} WHERE ID_CDIH_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDIH_RUN with ID_CDIH_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) throw new Error(`GDX_HNF_CDIH_RUN ID_CDIH_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_CDIH_RUN DESC`, [studyId]);
  if (rows.length === 0) throw new Error(`No GDX_HNF_CDIH_RUN found for study "${studyTitle}". Run F4_CURV_DEPTH_KPI_LATENT_SPACE --study ${JSON.stringify(studyTitle)} first.`);
  return rows[0];
}

async function loadCdiValues(db, cdiRunId) {
  const rows = await query(db, `SELECT ID_PERSON, CDI_VALUE FROM GDX_HNF_CDI_VALUE WHERE ID_CDI_RUN = ?`, [cdiRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdiValue: Number(r.CDI_VALUE) }));
}
async function loadCdihValues(db, cdihRunId) {
  const rows = await query(db, `SELECT ID_PERSON, CDIH_VALUE FROM GDX_HNF_CDIH_VALUE WHERE ID_CDIH_RUN = ?`, [cdihRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdiValue: Number(r.CDIH_VALUE) }));
}

/** Picks three representative complete-case persons: this run's own lowest CDI, the one whose
 * CDI sits closest to the run's median, and the highest -- same selection rule this folder's own
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH already uses one layer down. When the run has
 * fewer than 3 persons, duplicates collapse naturally rather than this skill fabricating a
 * nonexistent fourth case. */
function pickRepresentativePersons(values) {
  const sorted = [...values].sort((a, b) => a.cdiValue - b.cdiValue);
  const n = sorted.length;
  const lowest = sorted[0];
  const highest = sorted[n - 1];
  const medianValue = n % 2 === 1 ? sorted[(n - 1) / 2].cdiValue : (sorted[n / 2 - 1].cdiValue + sorted[n / 2].cdiValue) / 2;
  let medianClosest = sorted[0];
  let bestDist = Infinity;
  for (const v of sorted) {
    const dist = Math.abs(v.cdiValue - medianValue);
    if (dist < bestDist) { bestDist = dist; medianClosest = v; }
  }
  return [
    { ...lowest, roleLabel: 'lowest' },
    { ...medianClosest, roleLabel: 'closest to median' },
    { ...highest, roleLabel: 'highest' },
  ];
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Twelve
 * synthetic CDIx values, enough to exercise the rug, the three lines and the three
 * representative-person markers. */
function buildSampleData() {
  const values = [0.02, 0.05, 0.08, 0.10, 0.12, 0.15, 0.17, 0.20, 0.23, 0.27, 0.31, 0.38].map((v, i) => ({ personId: `SAMPLE-${i + 1}`, cdiValue: v }));
  return { values, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, sourceKind, sourceLabel, values, gains, sigma, sample }) {
  const cdiLabel = sourceKind === 'CDIH' ? 'CDIh' : 'CDIx';
  const representatives = pickRepresentativePersons(values);
  const cdiValues = values.map((v) => v.cdiValue);

  const depthsCard = renderThreeDepthsCard({
    sourceLabel, cdiLabel, cdiValues, gains, representatives, cardId: 'visdepth',
  });
  const curveCard = renderDepthCurveCard({
    sourceLabel, cdiLabel, sigma, representatives, cardId: 'depthcurve',
  });

  const title = `Geometric curvature -- visual depth and the Gaussian dip curve -- ${studyTitle}`;
  const description =
    `Two figures from this layer's own mathematical foundation, both over the same real ` +
    `${cdiLabel}(t) population and the same three representative persons. Card 1 (section 9.1) ` +
    `compares ${gains.length} graphic gains as straight lines; card 2 (section 9.3) draws each ` +
    `representative person's own Gaussian dip curve. Every point is a real, non-fabricated value ` +
    `-- never an illustrative placeholder -- and neither card computes or implies a scalar ` +
    `curvature.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    `Source: ${sourceLabel}`,
    `Card 1 gains: ${gains.join(', ')} (default 1, 2, 5 -- the exact worked example F5_GEOMETRIC_CURVATURE's own --sample already uses).`,
    `Card 2 sigma: ${sigma} (default 1 -- the exact worked example F5_GEOMETRIC_CURVATURE's own --sample already uses).`,
    `Representative persons (both cards): ${representatives.map((r) => `#${r.personId} (${r.roleLabel})`).join(', ')}.`,
    '`a` and `sigma` are graphic design choices, not physical constants -- neither fixes anything about curvature, energy or geometry.',
  ].filter(Boolean);

  return pageShell({
    title,
    description,
    metaLines,
    bodyHtml: depthsCard + curveCard,
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
      studyTitle, study: args.study || 'sample', sourceKind: args.sourceKind,
      sourceLabel: 'SAMPLE_RUN (not a real GDX_HNF_CDI_RUN)', values: sampleData.values, gains: args.gains, sigma: args.sigma, sample: true,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.values.length} value(s). Gains: ${args.gains.join(', ')}. Sigma: ${args.sigma}.`);
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
    // See F5_GEOMETRIC_CURVATURE/scripts/generate_geometric_curvature.js and
    // _shared/account_gate/check_account_registration.js for why this is pinned rather than
    // auto-negotiated.
    pluginName: Firebird.AUTH_PLUGIN_LEGACY,
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const studyId = await resolveStudyId(db, studyTitle, args.study);

    let values, sourceLabel;
    if (args.sourceKind === 'CDIX') {
      const run = await resolveCdiRun(db, studyId, studyTitle, args.sourceRunId);
      sourceLabel = `CDIx run "${run.RUN_LABEL}" (ID_CDI_RUN=${run.ID_CDI_RUN})`;
      values = await loadCdiValues(db, run.ID_CDI_RUN);
    } else {
      const run = await resolveCdihRun(db, studyId, studyTitle, args.sourceRunId);
      sourceLabel = `CDIh run "${run.RUN_LABEL}" (ID_CDIH_RUN=${run.ID_CDIH_RUN})`;
      values = await loadCdihValues(db, run.ID_CDIH_RUN);
    }
    if (values.length === 0) throw new Error(`Source ${sourceLabel} has no value rows -- nothing to plot.`);

    const representatives = pickRepresentativePersons(values);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Source: ${sourceLabel}. Persons: ${values.length}. Gains: ${args.gains.join(', ')}. Sigma: ${args.sigma}.`);
    console.log(`Representative persons: ${representatives.map((r) => `#${r.personId} (${r.roleLabel})`).join(', ')}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, sourceKind: args.sourceKind, sourceLabel, values, gains: args.gains, sigma: args.sigma, sample: false });
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
