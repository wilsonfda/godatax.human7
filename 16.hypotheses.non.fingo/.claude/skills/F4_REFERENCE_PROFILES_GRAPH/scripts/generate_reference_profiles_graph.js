#!/usr/bin/env node
/**
 * F4_REFERENCE_PROFILES_GRAPH
 *
 * Renders this folder's own "first m real sessions establish a constant reference, compared
 * with later real sessions" figure (this layer's own mathematical foundation, section 8.1 --
 * "Construcao de baseline individual") for one real subject of one study, as a standalone HTML
 * page, one chart card per feature.
 *
 * Deliberately does NOT read the frozen GDX_HNF_CDI_REFERENCE_VALUE this folder's own
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS skill may already have written for a PERSONAL_BASELINE
 * reference set: that table stores only the final mean/median, not the per-session values behind
 * it, and may have been built with a different --baseline-sessions than this figure's own
 * (m=4, "as quatro primeiras sessoes"). Instead this script independently, and deterministically,
 * recomputes the first `m` real sessions' own mean/median live from GDX_HNF_FEATURE_VALUE (F1's
 * own frozen z(t)) every time it runs -- the same lightweight, render-time, non-persisted
 * computation posture every other GRAPH skill in this folder already takes (e.g. F3's own Pearson
 * r, computed live from already-frozen coordinates, never stored by F3 itself).
 *
 * Only a feature with MORE real sessions than `m` is plotted -- there must be at least one real
 * "later" session to compare the baseline against, or the figure has nothing to show beyond the
 * baseline itself. A feature administered once per person (most psychometric items in this
 * project) never qualifies; a repeated-session feature (e.g. cardiac-coherence) usually does.
 *
 * Usage:
 *   node generate_reference_profiles_graph.js --study <slug>
 *     [--subject <id_person>] [--run-id <id>] [--baseline-sessions <m>]
 *     [--baseline-estimator mean|median] [--feature <code-substring>]
 *     [--out-dir <path>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>              REQUIRED outside --sample. Same slug F1/F4/F4_REFERENCE_PROFILES
 *                                use -- resolves to GDX_PSY_STUDY.ID_STUDY via
 *                                new_study_intake/<slug>/intake.json's study.title.
 *   --subject <id_person>        optional. Defaults to the ID_SUBJECT of the study's latest
 *                                PERSONAL_BASELINE GDX_HNF_CDI_REFERENCE_SET (built by
 *                                F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS) -- errors, naming that
 *                                skill, if none exists and --subject is not given.
 *   --run-id <id>                optional. A specific GDX_HNF_FEATURE_SPACE_RUN.ID_RUN (must be
 *                                ZSCORE) instead of the study's latest.
 *   --baseline-sessions <m>      default 4 -- "as quatro primeiras sessoes" ("the first four
 *                                sessions") this figure's own caption names. A feature with m or
 *                                fewer real sessions for this subject is skipped (not enough
 *                                "later" sessions to compare).
 *   --baseline-estimator mean|median   default mean.
 *   --feature <text>             optional. Only features whose FEATURE_CODE contains this text
 *                                (case-insensitive), e.g. --feature "CC." for the
 *                                cardiac-coherence features that actually have repeat sessions.
 *   --out-dir <path>             optional. Defaults to this folder (16.hypotheses.non.fingo/).
 *   --intake-dir <path>          optional override of the default new_study_intake/<slug>/
 *                                location.
 *   --dry-run                    computes and logs everything (subject, run, features in/out of
 *                                scope, session counts), writes no file.
 *   --sample                     renders from embedded, clearly-labeled sample data instead of
 *                                connecting to Firebird.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, renderBaselineSessionsCard, emptyCard, hookTooltips } = require('./chart_renderer');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function parseArgs(argv) {
  const args = {
    study: null, subject: null, runId: null, baselineSessions: 4, baselineEstimator: 'MEAN',
    feature: null, outDir: null, intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--subject') args.subject = parseInt(argv[++i], 10);
    else if (a === '--run-id') args.runId = parseInt(argv[++i], 10);
    else if (a === '--baseline-sessions') args.baselineSessions = parseInt(argv[++i], 10);
    else if (a === '--baseline-estimator') args.baselineEstimator = String(argv[++i] || '').toUpperCase();
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample) {
    if (!args.study) throw new Error('--study <slug> is required (same slug F1/F4/F4_REFERENCE_PROFILES use), unless --sample is passed.');
    if (!Number.isInteger(args.baselineSessions) || args.baselineSessions < 1) {
      throw new Error('--baseline-sessions must be a positive integer.');
    }
    if (!['MEAN', 'MEDIAN'].includes(args.baselineEstimator)) {
      throw new Error('--baseline-estimator must be mean or median.');
    }
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
 * (16.hypotheses.non.fingo/.claude/skills/F4_REFERENCE_PROFILES_GRAPH/scripts) -- same depth/shape
 * as this folder's other GRAPH skills' resolveIntakePath(). */
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
  return `f4_reference_profiles_graph_baseline_sessions__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

/** Date -> a fixed, locale-independent "YYYY-MM-DD HH:MM:SS UTC" string -- same reasoning as this
 * folder's other GRAPH skills' formatTimestampUtc(). Only for GENERATED_AT (this run's own
 * metadata, a real instant captured by CURRENT_TIMESTAMP at insert time). */
function formatTimestampUtc(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** Date -> "YYYY-MM-DD HH:MM:SS", with NO timezone conversion and NO "UTC" label -- for
 * GDX_HNF_FEATURE_VALUE.OBS_INSTANT specifically. A Firebird TIMESTAMP carries no timezone of its
 * own; node-firebird hands this driver a JS Date built from that same naive wall-clock value
 * using LOCAL date/time components (confirmed empirically: a session stored as "09:00:00"
 * round-trips as toString() "09:00:00 GMT+0100", i.e. the DRIVER treats the naive value as this
 * machine's local time, not as a UTC instant). Calling toISOString() on it (as
 * formatTimestampUtc() does, correctly, for a REAL instant like GENERATED_AT) would therefore
 * silently shift every session time by this machine's own UTC offset and mislabel the result
 * "UTC" -- wrong for a session grain, where the only honest thing to show is the exact value
 * Firebird stored. Reading the Date's own LOCAL getters (not UTC getters) undoes the driver's
 * local-time construction and recovers that original, untouched value. */
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

/** Resolves which subject to plot: an explicit --subject, or else the ID_SUBJECT of the study's
 * latest PERSONAL_BASELINE GDX_HNF_CDI_REFERENCE_SET (built by
 * F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS) -- this script never invents a subject to plot. */
async function resolveSubject(db, studyId, studyTitle, explicitSubject) {
  if (explicitSubject !== null && explicitSubject !== undefined && !Number.isNaN(explicitSubject)) {
    const rows = await query(db, 'SELECT FIRST 1 ID_PERSON FROM GDX_PSY_PERSON WHERE ID_PERSON = ?', [explicitSubject]);
    if (rows.length === 0) throw new Error(`No GDX_PSY_PERSON with ID_PERSON=${explicitSubject}.`);
    return explicitSubject;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_SUBJECT FROM GDX_HNF_CDI_REFERENCE_SET
    WHERE ID_STUDY = ? AND REFERENCE_TYPE = 'PERSONAL_BASELINE'
    ORDER BY GENERATED_AT DESC, ID_REFERENCE_SET DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(
      `No PERSONAL_BASELINE GDX_HNF_CDI_REFERENCE_SET found for study "${studyTitle}" to default a subject from. ` +
      `Pass --subject <id_person> directly, or run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS ` +
      `--study ${JSON.stringify(studyTitle)} --reference-type personal_baseline --subject <id_person> first.`
    );
  }
  return rows[0].ID_SUBJECT;
}

/** Resolves which GDX_HNF_FEATURE_SPACE_RUN to plot from: an explicit --run-id (validated to
 * belong to this study and be NORMALIZATION_METHOD='ZSCORE'), or else the latest ZSCORE run --
 * same convention and rationale as F1_GDX_SKILL_MFS_GRAPH's own resolveRun(). */
async function resolveRun(db, studyId, studyTitle, runId) {
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
      throw new Error(`GDX_HNF_FEATURE_SPACE_RUN ID_RUN=${runId} used NORMALIZATION_METHOD='${run.NORMALIZATION_METHOD}', not 'ZSCORE' -- this figure compares real sessions in z-scale.`);
    }
    return run;
  }
  const rows = await query(db, `
    SELECT FIRST 1 ID_RUN, ID_STUDY, RUN_LABEL, NORMALIZATION_METHOD, GENERATED_AT
    FROM GDX_HNF_FEATURE_SPACE_RUN
    WHERE ID_STUDY = ? AND NORMALIZATION_METHOD = 'ZSCORE'
    ORDER BY GENERATED_AT DESC, ID_RUN DESC`, [studyId]);
  if (rows.length === 0) {
    throw new Error(`No GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE' found for study "${studyTitle}". Run F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE first.`);
  }
  return rows[0];
}

async function loadRunFeatures(db, runId, featureFilter) {
  const rows = await query(db, `
    SELECT M.FEATURE_ORDER, D.ID_FEATURE, D.FEATURE_CODE, D.NAME, D.MEASUREMENT_UNIT, P.NAME_EN AS PERSPECTIVE_NAME_EN
    FROM GDX_HNF_FEATURE_RUN_MEMBER M
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = M.ID_FEATURE
    JOIN GDX_HNF_PERSPECTIVE P ON P.ID_PERSPECTIVE = D.ID_PERSPECTIVE
    WHERE M.ID_RUN = ?
    ORDER BY M.FEATURE_ORDER`, [runId]);
  if (!featureFilter) return rows;
  const needle = featureFilter.toLowerCase();
  return rows.filter((r) => String(r.FEATURE_CODE).toLowerCase().includes(needle));
}

/** Every real, non-missing session this one subject has for this run, per feature, ordered by
 * OBS_INSTANT when present (physiological/repeated-session features) and otherwise by
 * OBS_GRAIN_KEY (a stable, deterministic fallback for the single-session psychometric features,
 * where ordering has no real meaning anyway since there is only ever one row). */
async function loadSubjectSessions(db, runId, subjectId) {
  const rows = await query(db, `
    SELECT ID_FEATURE, OBS_GRAIN_KEY, OBS_INSTANT, RAW_VALUE, NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE
    WHERE ID_RUN = ? AND ID_PERSON = ? AND IS_MISSING = 0 AND NORMALIZED_VALUE IS NOT NULL
    ORDER BY ID_FEATURE, OBS_INSTANT, OBS_GRAIN_KEY`, [runId, subjectId]);
  const byFeature = new Map();
  for (const r of rows) {
    if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, []);
    byFeature.get(r.ID_FEATURE).push({
      grainKey: r.OBS_GRAIN_KEY,
      obsInstant: r.OBS_INSTANT ? formatNaiveTimestamp(r.OBS_INSTANT) : null,
      rawValue: Number(r.RAW_VALUE),
      zValue: Number(r.NORMALIZED_VALUE),
    });
  }
  return byFeature;
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Builds one feature's own session list with roles + the live-computed baseline, or null when
 * this subject has `baselineSessions` or fewer real sessions for this feature (nothing "later"
 * to compare -- see file header). Never fabricates a session or a baseline value. */
function buildFeatureSessions(rawSessions, baselineSessions, baselineEstimator) {
  if (rawSessions.length <= baselineSessions) return null;
  const baseSlice = rawSessions.slice(0, baselineSessions).map((s) => s.zValue);
  const baselineValue = baselineEstimator === 'MEDIAN' ? median(baseSlice) : mean(baseSlice);
  const sessions = rawSessions.map((s, i) => ({
    sessionIndex: i + 1,
    grainKey: s.grainKey,
    obsInstant: s.obsInstant,
    rawValue: s.rawValue,
    zValue: s.zValue,
    isBaselineSession: i < baselineSessions,
  }));
  return { sessions, baselineValue };
}

/** Embedded, explicitly-labeled sample data for --sample -- NOT from any real study. Shapes one
 * illustrative repeated-session feature (6 sessions: 4 forming the baseline, 2 later) and one
 * single-session feature (never plotted, to exercise the "not enough sessions" empty card). */
function buildSampleData() {
  const features = [
    { FEATURE_ORDER: 1, ID_FEATURE: 1001, FEATURE_CODE: 'SAMPLE.CC.HRV.RMSSD_MS', NAME: 'Sample RMSSD', MEASUREMENT_UNIT: 'ms', PERSPECTIVE_NAME_EN: 'Physiology' },
    { FEATURE_ORDER: 2, ID_FEATURE: 1002, FEATURE_CODE: 'SAMPLE.PSY.VAR.1', NAME: 'Sample resilience score', MEASUREMENT_UNIT: null, PERSPECTIVE_NAME_EN: 'Psychometrics' },
  ];
  const rawA = [42.0, 38.0, 50.0, 45.0, 30.0, 60.0];
  function zOf(values) {
    const m = mean(values);
    const sd = Math.sqrt(mean(values.map((v) => (v - m) * (v - m))));
    return values.map((v) => (v - m) / sd);
  }
  const zA = zOf(rawA);
  const sessionsA = rawA.map((v, i) => ({ grainKey: `SAMPLE_SESSION:${i + 1}`, obsInstant: null, rawValue: v, zValue: zA[i] }));
  const byFeature = new Map([
    [1001, sessionsA],
    [1002, [{ grainKey: 'SAMPLE_APPLICATION', obsInstant: null, rawValue: 7.0, zValue: 0.0 }]],
  ]);
  return { features, byFeature, studyTitle: 'Sample Study (illustrative, not a real GDX_HUMAN study)', subject: 'SAMPLE-1' };
}

function buildPageHtml({ studyTitle, study, subjectId, run, features, byFeature, baselineSessions, baselineEstimator, sample }) {
  let plottedCount = 0;
  const cards = features.map((f) => {
    const raw = byFeature.get(f.ID_FEATURE) || [];
    const built = buildFeatureSessions(raw, baselineSessions, baselineEstimator);
    if (!built) {
      const reason = raw.length === 0
        ? 'no real, non-missing session found for this subject in this run.'
        : `needs more than ${baselineSessions} real session(s) to compare a later session against a baseline; found ${raw.length}.`;
      return emptyCard({ featureCode: f.FEATURE_CODE, featureName: f.NAME, perspectiveName: f.PERSPECTIVE_NAME_EN, reason });
    }
    plottedCount += 1;
    return renderBaselineSessionsCard({
      featureCode: f.FEATURE_CODE,
      featureName: f.NAME,
      perspectiveName: f.PERSPECTIVE_NAME_EN,
      unit: f.MEASUREMENT_UNIT,
      sessions: built.sessions,
      baselineSessionCount: baselineSessions,
      baselineEstimator,
      baselineValue: built.baselineValue,
      cardId: `feat-${f.ID_FEATURE}`,
    });
  });

  const title = `Baseline vs. later sessions in z-scale -- ${studyTitle}`;
  const description =
    `For subject #${subjectId}, the first ${baselineSessions} real session(s) of each eligible feature are ` +
    `averaged (${baselineEstimator.toLowerCase()}) into a constant reference line, then every later real ` +
    `session is plotted against it. Every point below comes from a real <code>GDX_HNF_FEATURE_VALUE</code> ` +
    `row -- never an illustrative placeholder -- and the reference line is this subject's own real history, ` +
    `not a population or instrument norm.`;

  const metaLines = [
    sample ? 'SAMPLE DATA -- embedded illustrative values, not from any real study or database. Re-run without --sample against a real study.' : null,
    `Study: ${studyTitle} (slug "${study}")`,
    run ? `Run: ${run.RUN_LABEL}${run.ID_RUN ? ` (ID_RUN=${run.ID_RUN})` : ''}, normalization method ${run.NORMALIZATION_METHOD}, generated ${formatTimestampUtc(run.GENERATED_AT)}.` : null,
    `Subject: #${subjectId}. Baseline: first ${baselineSessions} real session(s), ${baselineEstimator.toLowerCase()}.`,
    `Features with a plotted comparison: ${plottedCount} of ${features.length} in this run${features.length !== plottedCount ? ' (the rest are listed below with the reason they have no comparison)' : ''}.`,
    'A baseline here is one person\'s own history -- it says nothing about health, virtue, or a population norm; see this layer\'s own SKILL.md for the other two reference bases.',
  ].filter(Boolean);

  return pageShell({
    title,
    description,
    metaLines,
    bodyHtml: cards.join('\n'),
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
    const html = buildPageHtml({
      studyTitle, study: args.study || 'sample', subjectId: sampleData.subject, run: null,
      features: sampleData.features, byFeature: sampleData.byFeature,
      baselineSessions: args.baselineSessions, baselineEstimator: args.baselineEstimator, sample: true,
    });
    const filename = buildFilename(args.study || 'sample', studyTitle, timestamp);
    console.log(`[SAMPLE] ${sampleData.features.length} feature(s).`);
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
    // See F4_REFERENCE_PROFILES/scripts/generate_reference_profiles.js and
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
    const subjectId = await resolveSubject(db, studyId, studyTitle, args.subject);
    const run = await resolveRun(db, studyId, studyTitle, args.runId);
    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Subject #${subjectId}. Run "${run.RUN_LABEL}" (ID_RUN=${run.ID_RUN}), generated ${formatTimestampUtc(run.GENERATED_AT)}.`);

    const features = await loadRunFeatures(db, run.ID_RUN, args.feature);
    if (features.length === 0) {
      throw new Error(args.feature
        ? `No feature in run ID_RUN=${run.ID_RUN} has a FEATURE_CODE containing "${args.feature}".`
        : `Run ID_RUN=${run.ID_RUN} has no GDX_HNF_FEATURE_RUN_MEMBER rows -- nothing to plot.`);
    }
    const byFeature = await loadSubjectSessions(db, run.ID_RUN, subjectId);

    let plotted = 0;
    for (const f of features) {
      const built = buildFeatureSessions(byFeature.get(f.ID_FEATURE) || [], args.baselineSessions, args.baselineEstimator);
      if (built) plotted += 1;
    }
    console.log(`Features in scope: ${features.length} (${plotted} with a plotted baseline-vs-later comparison; needs > ${args.baselineSessions} real session(s)).`);

    const html = buildPageHtml({
      studyTitle, study: args.study, subjectId, run, features, byFeature,
      baselineSessions: args.baselineSessions, baselineEstimator: args.baselineEstimator, sample: false,
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
