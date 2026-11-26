#!/usr/bin/env node
/**
 * F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH
 *
 * Renders this folder's own "Before-During-After-Follow-up" figure (this layer's own
 * mathematical foundation, section 10 -- right above its own 10.1) for one study, as a
 * standalone HTML page: a line connecting one subject's own real CDIx(t_s) across real sessions,
 * each segment tinted by the sign of its own real DELTA_CDI (never implying "better/worse"), with
 * hover detail for every point (session/instant/CDIx) and every segment (DELTA_CDI, elapsed time,
 * discrete velocity).
 *
 * Reads the already-written GDX_HNF_TRAJECTORY_RUN/POINT/STEP rows
 * (F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION's own output) -- unlike this folder's F5 GRAPH skills,
 * which recompute a rendering/design choice live, a trajectory is a real compute result (which
 * features/sessions qualified, the per-session CDIx) worth freezing once rather than
 * re-deriving at every render; this script only reads that frozen result back, never
 * recomputing CDIx or re-grouping sessions itself.
 *
 * Every point drawn against a real study is labeled by its own real session grain
 * (GDX_HNF_TRAJECTORY_POINT.OBS_GRAIN_KEY) -- never a fictitious phase name. "Before/during/
 * after/follow-up" is used only for --sample's own clearly-labeled synthetic data, exactly where
 * the document's own figure is itself fictitious.
 *
 * Usage:
 *   node generate_temporal_dynamics_graph.js --study <slug>
 *     [--trajectory-run-id <id>] [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>              REQUIRED outside --sample. Same slug F1/F4/F6 use -- resolves to
 *                                GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                                study.title.
 *   --trajectory-run-id <id>     optional. A specific GDX_HNF_TRAJECTORY_RUN.ID_TRAJECTORY_RUN
 *                                instead of the study's latest.
 *   --out-dir <path>             optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>          optional override of the default new_study_intake/<slug>/
 *                                location.
 *   --dry-run                     computes and logs everything (run, subject, session/step
 *                                counts), writes no file.
 *   --sample                      renders from embedded, clearly-labeled sample data (the
 *                                document's own four named phases) instead of connecting to
 *                                Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderTrajectoryCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = { study: null, trajectoryRunId: null, outDir: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--trajectory-run-id') args.trajectoryRunId = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample && !args.study) {
    throw new Error('--study <slug> is required (same slug F1/F4/F6 use), unless --sample is passed.');
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
 * (16.hypotheses.non.fingo/.claude/skills/F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH/scripts) --
 * same depth/shape as this folder's other GRAPH skills' resolveIntakePath(). */
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
  return `f6_temporal_dynamics_graph__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

/** Date -> "YYYY-MM-DD HH:MM:SS", with NO timezone conversion and NO "UTC" label -- for
 * GDX_HNF_TRAJECTORY_POINT.OBS_INSTANT specifically. Same reasoning (and the same empirically
 * confirmed node-firebird local-time construction) as this folder's own
 * F4_REFERENCE_PROFILES_GRAPH/scripts/generate_reference_profiles_graph.js
 * formatNaiveTimestamp() -- calling toISOString() here would silently shift every session time
 * by this machine's own UTC offset and mislabel the result "UTC". */
function formatNaiveTimestamp(d) {
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves which GDX_HNF_TRAJECTORY_RUN to plot: an explicit --trajectory-run-id (validated to
 * belong to this study), or else the study's latest. */
async function resolveTrajectoryRun(db, studyId, studyTitle, runId) {
  const selectSql = `
    SELECT ID_TRAJECTORY_RUN, ID_STUDY, ID_SUBJECT, ID_REFERENCE_SET, SESSION_COUNT, FEATURE_COUNT, RUN_LABEL, CAUSAL_CAVEAT_NOTE, GENERATED_AT
    FROM GDX_HNF_TRAJECTORY_RUN`;
  if (runId !== null && runId !== undefined && !Number.isNaN(runId)) {
    const rows = await query(db, `${selectSql} WHERE ID_TRAJECTORY_RUN = ?`, [runId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_TRAJECTORY_RUN with ID_TRAJECTORY_RUN=${runId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_TRAJECTORY_RUN ID_TRAJECTORY_RUN=${runId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    return run;
  }
  const rows = await query(db, `${selectSql} WHERE ID_STUDY = ? ORDER BY GENERATED_AT DESC, ID_TRAJECTORY_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_TRAJECTORY_RUN found for study "${studyTitle}". Run F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION --study ${JSON.stringify(studyTitle)} --reference-set-id <id> first.`);
  }
  return rows[0];
}

async function loadReferenceLabel(db, referenceSetId) {
  const rows = await query(db, `SELECT REFERENCE_LABEL, REFERENCE_TYPE FROM GDX_HNF_CDI_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
  return rows.length ? rows[0] : null;
}

async function loadPoints(db, trajectoryRunId) {
  const rows = await query(db, `
    SELECT SESSION_ORDER, OBS_GRAIN_KEY, OBS_INSTANT, CDI_VALUE
    FROM GDX_HNF_TRAJECTORY_POINT WHERE ID_TRAJECTORY_RUN = ? ORDER BY SESSION_ORDER`, [trajectoryRunId]);
  return rows.map((r) => ({
    sessionOrder: r.SESSION_ORDER,
    label: r.OBS_GRAIN_KEY,
    obsInstant: r.OBS_INSTANT ? formatNaiveTimestamp(r.OBS_INSTANT) : null,
    cdiValue: Number(r.CDI_VALUE),
  }));
}

async function loadSteps(db, trajectoryRunId) {
  const rows = await query(db, `
    SELECT FROM_SESSION_ORDER, TO_SESSION_ORDER, DELTA_CDI, DELTA_T_SECONDS, VELOCITY
    FROM GDX_HNF_TRAJECTORY_STEP WHERE ID_TRAJECTORY_RUN = ? ORDER BY FROM_SESSION_ORDER`, [trajectoryRunId]);
  return rows.map((r) => ({
    fromSessionOrder: r.FROM_SESSION_ORDER,
    toSessionOrder: r.TO_SESSION_ORDER,
    deltaCdi: Number(r.DELTA_CDI),
    deltaTSeconds: r.DELTA_T_SECONDS === null ? null : Number(r.DELTA_T_SECONDS),
    velocity: r.VELOCITY === null ? null : Number(r.VELOCITY),
  }));
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Reuses this
 * folder's own F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION --sample worked example (the document's own
 * four named phases), the only place in this skill where a fictitious phase name is ever shown. */
function buildSampleData() {
  const labels = ['before', 'during', 'after', 'follow-up'];
  const cdi = [0.42, 0.65, 0.30, 0.38];
  const minutesBetween = [20, 15, 1440];
  const points = labels.map((label, i) => ({ sessionOrder: i + 1, label, obsInstant: null, cdiValue: cdi[i] }));
  const steps = [];
  for (let i = 0; i < cdi.length - 1; i++) {
    const deltaCdi = cdi[i + 1] - cdi[i];
    const deltaTSeconds = minutesBetween[i] * 60;
    steps.push({ fromSessionOrder: i + 1, toSessionOrder: i + 2, deltaCdi, deltaTSeconds, velocity: Math.abs(deltaCdi) / deltaTSeconds });
  }
  return { points, steps, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)' };
}

function buildPageHtml({ studyTitle, study, run, referenceInfo, points, steps, sample }) {
  const cdiLabel = 'CDIx';
  const subtitle = run
    ? `Subject #${run.ID_SUBJECT} &middot; reference "${referenceInfo ? referenceInfo.REFERENCE_LABEL : 'n/a'}"${referenceInfo ? ` (${referenceInfo.REFERENCE_TYPE})` : ''} &middot; ${points.length} real session(s), ${run.FEATURE_COUNT} feature(s).`
    : 'Illustrative sample sequence -- not a real study.';

  const card = renderTrajectoryCard({ subtitle, cdiLabel, points, steps, cardId: 'trajectory' });

  const title = `Before-during-after-follow-up: a real ${cdiLabel} trajectory -- ${studyTitle}`;
  const description =
    `One subject's own real ${cdiLabel}(t) across real sessions, the same shape as this layer's ` +
    `own "before/during/after/follow-up" figure -- except every point here is a real, ` +
    `non-fabricated value, labeled by its own real session, never a fictitious phase name. ` +
    `Repetitions form a trajectory that need not be monotonic; a rising-then-falling (or ` +
    `falling-then-rising) sequence is not an error.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values (this layer\'s own document-style named phases), not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    run ? `Trajectory run: "${run.RUN_LABEL}" (ID_TRAJECTORY_RUN=${run.ID_TRAJECTORY_RUN}), generated ${run.GENERATED_AT}.` : null,
    'Velocity here is a discrete finite-difference approximation of the scalar CDIx index\'s own rate of change -- not a vector velocity under a metric on feature space, and never computed when no real elapsed time is available.',
    run ? run.CAUSAL_CAVEAT_NOTE : 'Observing this sequence shows temporal association only -- never an isolated cause (sleep, expectation, maturation, test-repetition and context can all explain a real change).',
  ].filter(Boolean);

  return pageShell({
    title,
    description,
    metaLines,
    bodyHtml: card,
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
      studyTitle, study: args.study || 'sample', run: null, referenceInfo: null,
      points: sampleData.points, steps: sampleData.steps, sample: true,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.points.length} point(s), ${sampleData.steps.length} step(s).`);
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
    const run = await resolveTrajectoryRun(db, studyId, studyTitle, args.trajectoryRunId);
    const referenceInfo = await loadReferenceLabel(db, run.ID_REFERENCE_SET);
    const points = await loadPoints(db, run.ID_TRAJECTORY_RUN);
    const steps = await loadSteps(db, run.ID_TRAJECTORY_RUN);
    if (points.length === 0) throw new Error(`GDX_HNF_TRAJECTORY_RUN ID_TRAJECTORY_RUN=${run.ID_TRAJECTORY_RUN} has no GDX_HNF_TRAJECTORY_POINT rows -- nothing to plot.`);

    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Trajectory run "${run.RUN_LABEL}" (ID_TRAJECTORY_RUN=${run.ID_TRAJECTORY_RUN}). Subject #${run.ID_SUBJECT}. Points: ${points.length}. Steps: ${steps.length}.`);

    const html = buildPageHtml({ studyTitle, study: args.study, run, referenceInfo, points, steps, sample: false });
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
