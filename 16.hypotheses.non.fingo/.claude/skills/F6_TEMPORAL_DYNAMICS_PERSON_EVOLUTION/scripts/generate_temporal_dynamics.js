#!/usr/bin/env node
/**
 * F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION
 *
 * Implements this folder's F6 layer: for one real subject, evaluates this folder's own
 * RMS-distance CDIx shape (already validated by F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS) once PER
 * REAL SESSION instead of once, turning a sequence of real points into a trajectory --
 *
 *   gamma_i(t) = h_i(t)                               trajectory (real points, one per session)
 *   CDIx(t_s) = sqrt( (1/n) * sum_j (z_j(t_s) - z_j_ref)^2 )     same RMS shape as GDX_HNF_CDI_VALUE
 *   DeltaCDI  = CDIx(t_after) - CDIx(t_before)         change between two real, adjacent sessions
 *   v(t)      = |DeltaCDI| / Delta_t                    DISCRETE finite-difference approximation
 *
 * Never recomputes a reference center (reuses an already-built GDX_HNF_CDI_REFERENCE_SET, F4) and
 * never attributes a real CDIx change to a cause -- GDX_HNF_TRAJECTORY_RUN.CAUSAL_CLAIM_MADE is
 * schema-CHECKed to always be 0; this script always supplies the same fixed CAUSAL_CAVEAT_NOTE.
 *
 * Why the trajectory lives in the ORIGINAL feature space z(t), never the latent h(t): F2 already
 * collapses every repeated session into exactly one latent coordinate per person before fitting --
 * there is no multi-session latent trajectory anywhere in this project's own data today. A
 * physiological feature with repeated real sessions (e.g. cardiac-coherence) does carry several
 * real GDX_HNF_FEATURE_VALUE rows per person, each with a real OBS_INSTANT -- that is where this
 * module's trajectory actually comes from.
 *
 * Session structure: every feature in the trajectory's own feature set must share the EXACT SAME
 * ordered sequence of real OBS_GRAIN_KEY values for the subject. Among all candidate features
 * (covered by the chosen reference AND with more than one real session for the subject), this
 * script picks the single largest group that actually shares one common session sequence -- it
 * never merges two different session structures into one trajectory.
 *
 * Usage:
 *   node generate_temporal_dynamics.js --study <slug> --reference-set-id <id> [--subject <id_person>]
 *     [--feature <code-substring>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>              REQUIRED outside --sample. Same slug F1/F4/F4_REFERENCE_PROFILES/
 *                                F5 use.
 *   --reference-set-id <id>      REQUIRED outside --sample. An already-built GDX_HNF_CDI_
 *                                REFERENCE_SET (F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS) whose own
 *                                GDX_HNF_CDI_REFERENCE_VALUE rows cover the trajectory's feature
 *                                set. This module never builds a reference of its own.
 *   --subject <id_person>        REQUIRED when the chosen reference set is not PERSONAL_BASELINE
 *                                (which already carries its own subject). When the reference IS
 *                                PERSONAL_BASELINE, --subject may be omitted (defaults to that
 *                                reference's own subject) or passed to confirm it explicitly --
 *                                passing a DIFFERENT subject than a PERSONAL_BASELINE's own is
 *                                refused (that reference is, by definition, one specific person's
 *                                own history).
 *   --feature <text>             optional. Only candidate features whose FEATURE_CODE contains
 *                                this text (case-insensitive) are considered, same convention as
 *                                this folder's other skills.
 *   --intake-dir <path>          optional override of the default new_study_intake/<slug>/
 *                                location.
 *   --dry-run                     computes the trajectory (session grouping, per-session CDIx,
 *                                deltas, velocities) and logs it, writing no row.
 *   --sample                      runs the worked numeric example below on small,
 *                                explicitly-labeled synthetic data -- never connects to Firebird,
 *                                never writes anything.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

/** This layer's own permanent, fixed explanation for why GDX_HNF_TRAJECTORY_RUN.
 * CAUSAL_CLAIM_MADE is always 0 -- never per-run customized, since the reason is a project-wide
 * epistemic stance, not a per-run decision. */
const CAUSAL_CAVEAT_NOTE =
  'Observing CDIx(t) rise or fall across real sessions shows a temporal association, never an ' +
  'isolated cause. Sleep, expectation, maturation, test-repetition effects and environmental ' +
  'context can all explain a real change; attributing it to Virtology or any other intervention ' +
  'requires an appropriate design, a comparison condition and an assessment of bias this run ' +
  'does not, and cannot, supply on its own. A negative DELTA_CDI means movement toward the ' +
  'chosen reference between two real sessions -- it is never, by itself, evidence of improvement.';

function parseArgs(argv) {
  const args = { study: null, referenceSetId: null, subject: null, feature: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--reference-set-id') args.referenceSetId = parseInt(argv[++i], 10);
    else if (a === '--subject') args.subject = parseInt(argv[++i], 10);
    else if (a === '--feature') args.feature = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample) {
    if (!args.study) throw new Error('--study <slug> is required (same slug F1/F4/F5 use), unless --sample is passed.');
    if (!args.referenceSetId) throw new Error('--reference-set-id <id> is required, unless --sample is passed -- this module never builds a reference of its own.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and ` +
      `export the vars before running this script (or pass --sample to print the worked numeric ` +
      `example with no database connection).`
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
/** node-firebird returns an INSERT...RETURNING result as a plain object, not an array of rows
 * the way a SELECT does -- normalizes both shapes to one row object. */
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

/** 0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this script
 * (16.hypotheses.non.fingo/.claude/skills/F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION/scripts) -- same
 * depth/shape as this folder's other skills' resolveIntakePath(). */
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

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves and validates the chosen GDX_HNF_CDI_REFERENCE_SET: must belong to this study. Never
 * built here -- this module only reads it back (see file header). */
async function resolveReferenceSet(db, studyId, studyTitle, referenceSetId) {
  const rows = await query(db, `
    SELECT ID_REFERENCE_SET, ID_STUDY, ID_INPUT_FEATURE_RUN, REFERENCE_TYPE, ID_SUBJECT, REFERENCE_LABEL
    FROM GDX_HNF_CDI_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
  if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_REFERENCE_SET with ID_REFERENCE_SET=${referenceSetId}.`);
  const rset = rows[0];
  if (rset.ID_STUDY !== studyId) {
    throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} belongs to a different study (ID_STUDY=${rset.ID_STUDY}), not "${studyTitle}".`);
  }
  return rset;
}

/** Resolves the subject to build a trajectory for: an explicit --subject (validated against a
 * PERSONAL_BASELINE reference's own subject, if that is what was chosen), or else that
 * reference's own subject when it has one. Never guessed for a population-level reference. */
function resolveSubject(rset, explicitSubject) {
  if (rset.REFERENCE_TYPE === 'PERSONAL_BASELINE') {
    if (explicitSubject !== null && explicitSubject !== undefined && !Number.isNaN(explicitSubject) && explicitSubject !== rset.ID_SUBJECT) {
      throw new Error(`--subject ${explicitSubject} does not match GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}'s own ID_SUBJECT=${rset.ID_SUBJECT} (a PERSONAL_BASELINE reference is one specific person's own history).`);
    }
    return rset.ID_SUBJECT;
  }
  if (explicitSubject === null || explicitSubject === undefined || Number.isNaN(explicitSubject)) {
    throw new Error(`--subject <id_person> is required: reference set ID_REFERENCE_SET=${rset.ID_REFERENCE_SET} is ${rset.REFERENCE_TYPE}, which has no subject of its own.`);
  }
  return explicitSubject;
}

async function loadReferenceValues(db, referenceSetId) {
  const rows = await query(db, `SELECT ID_FEATURE, REFERENCE_VALUE FROM GDX_HNF_CDI_REFERENCE_VALUE WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
  const map = new Map();
  for (const r of rows) map.set(r.ID_FEATURE, Number(r.REFERENCE_VALUE));
  return map;
}

/** Every real, non-missing session this subject has for this run, per feature, ordered by
 * OBS_INSTANT when present and otherwise by OBS_GRAIN_KEY -- same convention this folder's own
 * F4_REFERENCE_PROFILES_GRAPH already uses for session ordering. */
async function loadSubjectSessions(db, runId, subjectId, featureFilter) {
  const rows = await query(db, `
    SELECT V.ID_FEATURE, D.FEATURE_CODE, V.OBS_GRAIN_KEY, V.OBS_INSTANT, V.NORMALIZED_VALUE
    FROM GDX_HNF_FEATURE_VALUE V
    JOIN GDX_HNF_FEATURE_DICTIONARY D ON D.ID_FEATURE = V.ID_FEATURE
    WHERE V.ID_RUN = ? AND V.ID_PERSON = ? AND V.IS_MISSING = 0 AND V.NORMALIZED_VALUE IS NOT NULL
    ORDER BY V.ID_FEATURE, V.OBS_INSTANT, V.OBS_GRAIN_KEY`, [runId, subjectId]);
  const needle = featureFilter ? featureFilter.toLowerCase() : null;
  const byFeature = new Map();
  for (const r of rows) {
    if (needle && !String(r.FEATURE_CODE).toLowerCase().includes(needle)) continue;
    if (!byFeature.has(r.ID_FEATURE)) byFeature.set(r.ID_FEATURE, []);
    byFeature.get(r.ID_FEATURE).push({
      grainKey: r.OBS_GRAIN_KEY,
      obsInstant: r.OBS_INSTANT || null,
      zValue: Number(r.NORMALIZED_VALUE),
    });
  }
  return byFeature;
}

/** Groups candidate features (>1 real session, covered by the reference) by their own ordered
 * grain-key signature, and returns the single largest group -- the features that actually share
 * one common session sequence. Never merges two different session structures. Returns null when
 * no feature has more than one real session. */
function pickTrajectoryFeatureGroup(sessionsByFeature, referenceValues) {
  const groups = new Map(); // signature -> { grainKeys: [...], featureIds: [...] }
  for (const [featureId, sessions] of sessionsByFeature.entries()) {
    if (!referenceValues.has(featureId)) continue;
    if (sessions.length < 2) continue;
    const signature = sessions.map((s) => s.grainKey).join('|');
    if (!groups.has(signature)) groups.set(signature, { grainKeys: sessions.map((s) => s.grainKey), featureIds: [] });
    groups.get(signature).featureIds.push(featureId);
  }
  if (groups.size === 0) return null;
  let best = null;
  for (const group of groups.values()) {
    if (!best || group.featureIds.length > best.featureIds.length) best = group;
  }
  best.featureIds.sort((a, b) => a - b);
  return best;
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }

/** Builds the real trajectory: one CDIx(t_s) per real shared session, using the exact RMS shape
 * GDX_HNF_CDI_VALUE already validates, plus the per-session OBS_INSTANT (for a real elapsed time
 * between consecutive sessions, when available). */
function buildTrajectory(group, sessionsByFeature, referenceValues) {
  const S = group.grainKeys.length;
  const points = [];
  for (let s = 0; s < S; s++) {
    const diffsSquared = group.featureIds.map((featureId) => {
      const session = sessionsByFeature.get(featureId)[s];
      const zRef = referenceValues.get(featureId);
      const d = session.zValue - zRef;
      return d * d;
    });
    const cdiValue = Math.sqrt(mean(diffsSquared));
    const anyFeature = group.featureIds[0];
    const session = sessionsByFeature.get(anyFeature)[s];
    points.push({ sessionOrder: s + 1, grainKey: session.grainKey, obsInstant: session.obsInstant, cdiValue });
  }
  const steps = [];
  for (let s = 0; s < S - 1; s++) {
    const from = points[s], to = points[s + 1];
    const deltaCdi = to.cdiValue - from.cdiValue;
    let deltaTSeconds = null, velocity = null;
    if (from.obsInstant && to.obsInstant) {
      const dt = (new Date(to.obsInstant).getTime() - new Date(from.obsInstant).getTime()) / 1000;
      if (dt > 0) { deltaTSeconds = dt; velocity = Math.abs(deltaCdi) / dt; }
    }
    steps.push({ fromSessionOrder: from.sessionOrder, toSessionOrder: to.sessionOrder, deltaCdi, deltaTSeconds, velocity });
  }
  return { points, steps };
}

function isoForLabel(d) {
  return d.toISOString().replace(/[:.]/g, '-');
}

async function insertTrajectoryRun(db, { studyId, subjectId, inputFeatureRunId, referenceSetId, sessionCount, featureCount }) {
  const runLabel = `${studyId}_TRAJECTORY_SUBJ${subjectId}_${isoForLabel(new Date())}`;
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_TRAJECTORY_RUN
      (ID_STUDY, ID_SUBJECT, ID_INPUT_FEATURE_RUN, ID_REFERENCE_SET, SESSION_COUNT, FEATURE_COUNT, RUN_LABEL, CAUSAL_CLAIM_MADE, CAUSAL_CAVEAT_NOTE, GENERATED_BY)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    RETURNING ID_TRAJECTORY_RUN`,
    [studyId, subjectId, inputFeatureRunId, referenceSetId, sessionCount, featureCount, runLabel, CAUSAL_CAVEAT_NOTE, 'F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION']));
  return { id: row.ID_TRAJECTORY_RUN, runLabel };
}

async function insertTrajectoryRunFeatures(db, trajectoryRunId, featureIds) {
  let order = 1;
  for (const featureId of featureIds) {
    await query(db, `
      INSERT INTO GDX_HNF_TRAJECTORY_RUN_FEATURE (ID_TRAJECTORY_RUN, FEATURE_ORDER, ID_FEATURE)
      VALUES (?, ?, ?)`, [trajectoryRunId, order++, featureId]);
  }
}

async function insertTrajectoryPoints(db, trajectoryRunId, points) {
  for (const p of points) {
    await query(db, `
      INSERT INTO GDX_HNF_TRAJECTORY_POINT (ID_TRAJECTORY_RUN, SESSION_ORDER, OBS_GRAIN_KEY, OBS_INSTANT, CDI_VALUE)
      VALUES (?, ?, ?, ?, ?)`, [trajectoryRunId, p.sessionOrder, p.grainKey, p.obsInstant, p.cdiValue]);
  }
}

async function insertTrajectorySteps(db, trajectoryRunId, steps) {
  for (const s of steps) {
    await query(db, `
      INSERT INTO GDX_HNF_TRAJECTORY_STEP (ID_TRAJECTORY_RUN, FROM_SESSION_ORDER, TO_SESSION_ORDER, DELTA_CDI, DELTA_T_SECONDS, VELOCITY)
      VALUES (?, ?, ?, ?, ?, ?)`, [trajectoryRunId, s.fromSessionOrder, s.toSessionOrder, s.deltaCdi, s.deltaTSeconds, s.velocity]);
  }
}

/** This layer's own worked numeric example: a small, explicitly-labeled, four-session synthetic
 * trajectory (illustrating "antes-durante-depois-seguimento" / "before-during-after-follow-up"
 * with real-shaped, fictitious numbers) -- never connects to the database, never written
 * anywhere. */
function printWorkedExample() {
  const labels = ['before', 'during', 'after', 'follow-up'];
  const cdi = [0.42, 0.65, 0.30, 0.38];
  const minutesBetween = [20, 15, 1440]; // illustrative: during->after same session block, after->follow-up a day later
  console.log('[SAMPLE] Worked numeric example -- a four-session trajectory (illustrative, not real data):');
  labels.forEach((label, i) => console.log(`  CDIx(${label}) = ${cdi[i]}`));
  console.log('');
  for (let i = 0; i < cdi.length - 1; i++) {
    const deltaCdi = cdi[i + 1] - cdi[i];
    const deltaTSeconds = minutesBetween[i] * 60;
    const velocity = Math.abs(deltaCdi) / deltaTSeconds;
    console.log(`  ${labels[i]} -> ${labels[i + 1]}: DeltaCDI = ${deltaCdi.toFixed(4)}, Delta_t = ${minutesBetween[i]} min, v = ${velocity.toExponential(4)} /s`);
  }
  console.log('');
  console.log('  The "during -> after" step is NEGATIVE: the profile moved TOWARD the reference --');
  console.log('  never, by itself, evidence of improvement or of any intervention\'s effect. Observing');
  console.log('  this sequence shows temporal association only; see SKILL.md for why no causal claim');
  console.log('  is ever recorded by this module.');
  console.log('');
  console.log('  This is a sanity check only -- no database connection, nothing written. Run without');
  console.log('  --sample, with --study <slug> --reference-set-id <id>, against a real run.');
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
    printWorkedExample();
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
    const rset = await resolveReferenceSet(db, studyId, studyTitle, args.referenceSetId);
    const subjectId = resolveSubject(rset, args.subject);

    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Subject #${subjectId}. Reference set "${rset.REFERENCE_LABEL}" (ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}, ${rset.REFERENCE_TYPE}). Evaluated run ID_INPUT_FEATURE_RUN=${rset.ID_INPUT_FEATURE_RUN}.`);

    const referenceValues = await loadReferenceValues(db, rset.ID_REFERENCE_SET);
    if (referenceValues.size === 0) throw new Error(`Reference set ID_REFERENCE_SET=${rset.ID_REFERENCE_SET} has no GDX_HNF_CDI_REFERENCE_VALUE rows -- nothing to evaluate against.`);

    const sessionsByFeature = await loadSubjectSessions(db, rset.ID_INPUT_FEATURE_RUN, subjectId, args.feature);
    const group = pickTrajectoryFeatureGroup(sessionsByFeature, referenceValues);
    if (!group) {
      throw new Error(
        `Subject #${subjectId} has no feature, covered by reference set ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}, with more than one real session in run ID_INPUT_FEATURE_RUN=${rset.ID_INPUT_FEATURE_RUN}` +
        (args.feature ? ` matching --feature "${args.feature}"` : '') +
        ` -- nothing to build a trajectory from.`
      );
    }

    const { points, steps } = buildTrajectory(group, sessionsByFeature, referenceValues);
    console.log(`Trajectory feature set (n=${group.featureIds.length}): ID_FEATURE ${group.featureIds.join(', ')}.`);
    console.log(`Real sessions (S=${points.length}): ${points.map((p) => `${p.grainKey}=${p.cdiValue.toFixed(4)}`).join(', ')}.`);
    console.log(`Steps (${steps.length}): ${steps.map((s) => `#${s.fromSessionOrder}->#${s.toSessionOrder} DeltaCDI=${s.deltaCdi.toFixed(4)}${s.velocity !== null ? `, v=${s.velocity.toExponential(3)}/s` : ', v=n/a (no real elapsed time)'}`).join(' | ')}.`);

    if (args.dryRun) {
      console.log(`[DRY RUN] Would insert 1 GDX_HNF_TRAJECTORY_RUN row, ${group.featureIds.length} GDX_HNF_TRAJECTORY_RUN_FEATURE row(s), ${points.length} GDX_HNF_TRAJECTORY_POINT row(s), ${steps.length} GDX_HNF_TRAJECTORY_STEP row(s). Writing nothing.`);
      return;
    }

    const { id: trajectoryRunId, runLabel } = await insertTrajectoryRun(db, {
      studyId, subjectId, inputFeatureRunId: rset.ID_INPUT_FEATURE_RUN, referenceSetId: rset.ID_REFERENCE_SET,
      sessionCount: points.length, featureCount: group.featureIds.length,
    });
    await insertTrajectoryRunFeatures(db, trajectoryRunId, group.featureIds);
    await insertTrajectoryPoints(db, trajectoryRunId, points);
    await insertTrajectorySteps(db, trajectoryRunId, steps);

    console.log(`Wrote GDX_HNF_TRAJECTORY_RUN ID_TRAJECTORY_RUN=${trajectoryRunId} ("${runLabel}"), ${group.featureIds.length} GDX_HNF_TRAJECTORY_RUN_FEATURE row(s), ${points.length} GDX_HNF_TRAJECTORY_POINT row(s), ${steps.length} GDX_HNF_TRAJECTORY_STEP row(s).`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
