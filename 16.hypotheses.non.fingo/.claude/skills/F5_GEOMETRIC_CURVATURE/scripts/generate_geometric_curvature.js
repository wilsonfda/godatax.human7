#!/usr/bin/env node
/**
 * F5_GEOMETRIC_CURVATURE
 *
 * Implements this folder's F5 layer: the question "is the Curvature Depth Index a geometric
 * curvature?" and this project's own answer, NO -- split into exactly what IS well-defined and
 * computable and what is NOT computed here, by design, and why (a true Riemannian scalar
 * curvature R(h)). Two real, computable transforms of an already-frozen CDI value, never a
 * recomputation of CDIx/CDIh itself:
 *
 *   profundidade_visual(t) = a * CDI(t),               a > 0        (9.1 -- linear rescaling)
 *   y(s) = -CDI(t) * exp( -s^2 / (2*sigma^2) ),         sigma > 0    (9.3 -- Gaussian dip curve)
 *
 *   R(h) = g^(ab)(h) * R_(ab)(h)                         (9 -- established mathematics, but NOT
 *                                                          computed here: no manifold/metric/
 *                                                          connection is defined anywhere in this
 *                                                          project's own pipeline -- see this
 *                                                          folder's own DDL header and SKILL.md)
 *
 * Reads back one already-computed CDI source (a GDX_HNF_CDI_RUN, CDIx, or a GDX_HNF_CDIH_RUN,
 * CDIh) and records either GDX_HNF_VISDEPTH_RUN/GDX_HNF_VISDEPTH_VALUE (9.1, --gain) or
 * GDX_HNF_DEPTHCURVE_RUN/GDX_HNF_DEPTHCURVE_VALUE (9.3, --sigma) -- see
 * ../../../hypotheses_non_fingo_geometric_curvature_model_firebird25.sql. Never recomputes CDIx
 * or CDIh itself, and never computes or fabricates a scalar curvature -- both parent runs' own
 * SCALAR_CURVATURE_COMPUTED column is schema-CHECKed to always be 0; this script always supplies
 * the same fixed, honest SCALAR_CURVATURE_SCOPE_NOTE explaining why.
 *
 * Section 9.3's own point: y(0) = -CDI(t) is the ONLY point on the Gaussian dip a real number
 * actually determines (e^0 = 1 regardless of sigma) -- sigma only controls how WIDE the dip looks
 * away from that one real point, never a real quantity. This script therefore stores exactly
 * that one real, per-person number (CURVE_MIN_VALUE = -CDI(t)) plus the run's own sigma; sampling
 * y(s) across a grid of s to actually draw the dip is left to a rendering step, never persisted
 * here.
 *
 * Usage:
 *   node generate_geometric_curvature.js --study <slug> --source-kind cdix|cdih (--gain <a> | --sigma <s>)
 *     [--source-run-id <id>] [--intake-dir <path>] [--dry-run] [--sample]
 *
 *   --study <slug>          REQUIRED outside --sample. Same slug F1/F4/F4_REFERENCE_PROFILES use.
 *   --source-kind cdix|cdih  REQUIRED outside --sample. cdix reads GDX_HNF_CDI_RUN/GDX_HNF_CDI_
 *                            VALUE (original characteristics); cdih reads GDX_HNF_CDIH_RUN/
 *                            GDX_HNF_CDIH_VALUE (latent space). Never both, never a third,
 *                            invented source.
 *   --gain <a>               Mode 9.1 (visual-depth rescaling). a > 0. Mutually exclusive with
 *                            --sigma -- exactly one of the two is required outside --sample. This
 *                            script never defaults it; a value chosen simply to make a drawing
 *                            look a particular way is this project's own responsibility, not this
 *                            script's to prevent (it only enforces a > 0).
 *   --sigma <s>               Mode 9.3 (Gaussian dip curve). s > 0. Mutually exclusive with
 *                            --gain. Never defaulted, same governance posture as --gain.
 *   --source-run-id <id>     optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN or
 *                            GDX_HNF_CDIH_RUN.ID_CDIH_RUN (matching --source-kind) instead of the
 *                            study's latest of that kind.
 *   --intake-dir <path>      optional override of the default new_study_intake/<slug>/ location.
 *   --dry-run                 computes the transform and logs it, writing no row.
 *   --sample                  runs the worked numeric examples below (both modes) on small,
 *                            explicitly-labeled synthetic data -- never connects to Firebird,
 *                            never writes anything.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const SOURCE_KINDS = ['CDIX', 'CDIH'];

/** This layer's own permanent, fixed explanation for why GDX_HNF_VISDEPTH_RUN.
 * SCALAR_CURVATURE_COMPUTED is always 0 -- never per-run customized, since the reason is a
 * project-wide epistemic stance, not a per-run decision. */
const SCALAR_CURVATURE_SCOPE_NOTE_VISDEPTH =
  'R(h) = g^(ab)(h) * R_(ab)(h) is established mathematics, but computing it for this ' +
  "project's own feature/latent space would require choosing coordinates, estimating a local " +
  'structure AND metric, defining the regularity of a differentiable manifold, and validating ' +
  'the statistical stability of all of that -- none of which this pipeline (F1-F4, ' +
  'F4_REFERENCE_PROFILES) defines or fits anywhere. Training an autoencoder does not ' +
  'automatically hand back an interpretable scalar curvature. This run therefore computes only ' +
  'the visual-depth rescaling (profundidade_visual = gain * CDI), never a true Riemannian ' +
  'scalar curvature; VISUAL_GAIN is a graphic gain, not a physical constant, and this value ' +
  'carries no claim about curved space, consciousness, or spiritual energy.';

/** Same permanent refusal as SCALAR_CURVATURE_SCOPE_NOTE_VISDEPTH above, worded for the Gaussian
 * dip curve (section 9.3) instead of the linear rescaling (section 9.1). */
const SCALAR_CURVATURE_SCOPE_NOTE_DEPTHCURVE =
  'R(h) = g^(ab)(h) * R_(ab)(h) is established mathematics, but computing it for this ' +
  "project's own feature/latent space would require choosing coordinates, estimating a local " +
  'structure AND metric, defining the regularity of a differentiable manifold, and validating ' +
  'the statistical stability of all of that -- none of which this pipeline (F1-F4, ' +
  'F4_REFERENCE_PROFILES) defines or fits anywhere. This run therefore computes only an ' +
  'illustrative Gaussian dip curve, y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), whose single ' +
  'real-determined point is its minimum at s=0 (= -CDI(t)); sigma only controls how wide the ' +
  'dip LOOKS, never a real quantity. Never a true Riemannian scalar curvature, and this value ' +
  'carries no claim about curved space, consciousness, or spiritual energy.';

function parseArgs(argv) {
  const args = { study: null, sourceKind: null, gain: null, sigma: null, sourceRunId: null, intakeDir: null, dryRun: false, sample: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--source-kind') args.sourceKind = String(argv[++i] || '').toUpperCase();
    else if (a === '--gain') args.gain = parseFloat(argv[++i]);
    else if (a === '--sigma') args.sigma = parseFloat(argv[++i]);
    else if (a === '--source-run-id') args.sourceRunId = parseInt(argv[++i], 10);
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.sample) {
    if (!args.study) throw new Error('--study <slug> is required (same slug F1/F4/F4_REFERENCE_PROFILES use), unless --sample is passed.');
    if (!args.sourceKind) throw new Error('--source-kind cdix|cdih is required, unless --sample is passed.');
    if (!SOURCE_KINDS.includes(args.sourceKind)) {
      throw new Error(`--source-kind ${args.sourceKind} is not recognized. Supported: cdix, cdih.`);
    }
    const hasGain = args.gain !== null && args.gain !== undefined && !Number.isNaN(args.gain);
    const hasSigma = args.sigma !== null && args.sigma !== undefined && !Number.isNaN(args.sigma);
    if (hasGain && hasSigma) {
      throw new Error('--gain (mode 9.1, visual-depth rescaling) and --sigma (mode 9.3, Gaussian dip curve) are mutually exclusive -- one mode per run.');
    }
    if (!hasGain && !hasSigma) {
      throw new Error('Either --gain <a> (mode 9.1) or --sigma <s> (mode 9.3) is required, unless --sample is passed -- this script never defaults either.');
    }
    if (hasGain && !(args.gain > 0)) {
      throw new Error('--gain must be > 0 (profundidade_visual = a * CDI(t), a > 0).');
    }
    if (hasSigma && !(args.sigma > 0)) {
      throw new Error('--sigma must be > 0 (y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), sigma > 0).');
    }
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
 * (16.hypotheses.non.fingo/.claude/skills/F5_GEOMETRIC_CURVATURE/scripts) -- same depth/shape as
 * this folder's other skills' resolveIntakePath(). */
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

/** Resolves the GDX_HNF_CDI_RUN (CDIX) to scale: an explicit --source-run-id (validated to
 * belong to this study), or else the study's latest. */
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

/** Resolves the GDX_HNF_CDIH_RUN (CDIH) to scale -- same shape as resolveCdiRun above. */
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

function isoForLabel(d) {
  return d.toISOString().replace(/[:.]/g, '-');
}

async function insertVisDepthRun(db, { studyId, sourceKind, cdiRunId, cdihRunId, gain, personCount }) {
  const sourceLabel = sourceKind === 'CDIX' ? `CDI${cdiRunId}` : `CDIH${cdihRunId}`;
  const runLabel = `${studyId}_VISDEPTH_${sourceLabel}_g${gain}_${isoForLabel(new Date())}`;
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_VISDEPTH_RUN
      (ID_STUDY, SOURCE_KIND, ID_CDI_RUN, ID_CDIH_RUN, VISUAL_GAIN, RUN_LABEL, PERSON_COUNT, SCALAR_CURVATURE_COMPUTED, SCALAR_CURVATURE_SCOPE_NOTE, GENERATED_BY)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    RETURNING ID_VISDEPTH_RUN`,
    [studyId, sourceKind, cdiRunId, cdihRunId, gain, runLabel, personCount, SCALAR_CURVATURE_SCOPE_NOTE_VISDEPTH, 'F5_GEOMETRIC_CURVATURE']));
  return { id: row.ID_VISDEPTH_RUN, runLabel };
}

async function insertVisDepthValues(db, visDepthRunId, values, gain) {
  for (const v of values) {
    const depth = gain * v.cdiValue;
    await query(db, `
      INSERT INTO GDX_HNF_VISDEPTH_VALUE (ID_VISDEPTH_RUN, ID_PERSON, SOURCE_CDI_VALUE, VISUAL_DEPTH_VALUE)
      VALUES (?, ?, ?, ?)`,
      [visDepthRunId, v.personId, v.cdiValue, depth]);
  }
}

async function insertDepthCurveRun(db, { studyId, sourceKind, cdiRunId, cdihRunId, sigma, personCount }) {
  const sourceLabel = sourceKind === 'CDIX' ? `CDI${cdiRunId}` : `CDIH${cdihRunId}`;
  const runLabel = `${studyId}_DEPTHCURVE_${sourceLabel}_s${sigma}_${isoForLabel(new Date())}`;
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_DEPTHCURVE_RUN
      (ID_STUDY, SOURCE_KIND, ID_CDI_RUN, ID_CDIH_RUN, CURVE_SIGMA, RUN_LABEL, PERSON_COUNT, SCALAR_CURVATURE_COMPUTED, SCALAR_CURVATURE_SCOPE_NOTE, GENERATED_BY)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    RETURNING ID_DEPTHCURVE_RUN`,
    [studyId, sourceKind, cdiRunId, cdihRunId, sigma, runLabel, personCount, SCALAR_CURVATURE_SCOPE_NOTE_DEPTHCURVE, 'F5_GEOMETRIC_CURVATURE']));
  return { id: row.ID_DEPTHCURVE_RUN, runLabel };
}

/** CURVE_MIN_VALUE = y(0) = -CDI(t) -- the only point on the Gaussian dip a real number
 * determines (see file header). sigma plays no role in this value, only in how the dip looks
 * away from s=0; it is still recorded once, at the run level, for anyone sampling y(s) later. */
async function insertDepthCurveValues(db, depthCurveRunId, values) {
  for (const v of values) {
    const curveMin = -v.cdiValue;
    await query(db, `
      INSERT INTO GDX_HNF_DEPTHCURVE_VALUE (ID_DEPTHCURVE_RUN, ID_PERSON, SOURCE_CDI_VALUE, CURVE_MIN_VALUE)
      VALUES (?, ?, ?, ?)`,
      [depthCurveRunId, v.personId, v.cdiValue, curveMin]);
  }
}

/** This layer's own worked numeric examples (both modes): a small, explicitly-labeled CDI value
 * scaled by three different gains (9.1) and the same value plugged into the Gaussian dip curve
 * (9.3, this layer's own worked participant #784, CDIx(t) = 0.8). Printed only for --sample;
 * never written anywhere, never connects to the database. */
function printWorkedExample() {
  const cdi = 0.1732; // this folder's own worked CDIx example (five features, reference 0.5)
  const gains = [1, 2, 5];
  console.log('[SAMPLE] Mode 9.1 -- visual depth is a graphic rescaling, not a curvature:');
  console.log(`  CDI(t) = ${cdi} (this folder's own worked CDIx example)`);
  for (const a of gains) {
    console.log(`  a = ${a} -> profundidade_visual = a * CDI(t) = ${(a * cdi).toFixed(4)}`);
  }
  console.log('');
  console.log('  The THREE results above describe the exact same underlying displacement -- only the');
  console.log('  drawing changes. None of them is closer to a "true" curvature than another; `a` is a');
  console.log('  graphic gain chosen for legibility, not a physical constant.');
  console.log('');

  const cdiParticipant = 0.8; // this layer's own worked participant #784 example (section 9.3)
  const sigma = 1;
  const yAt0 = -cdiParticipant * Math.exp(0);
  console.log('[SAMPLE] Mode 9.3 -- the Gaussian dip curve, y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)):');
  console.log(`  Participant #784, CDIx(t) = ${cdiParticipant}, sigma = ${sigma}`);
  console.log(`  y(0) = -${cdiParticipant} * exp(0) = ${yAt0.toFixed(4)}  <- the curve's deepest point`);
  for (const s of [0.5, 1, 1.5, 2]) {
    const y = -cdiParticipant * Math.exp(-(s * s) / (2 * sigma * sigma));
    console.log(`  y(${s}) = ${y.toFixed(4)}`);
  }
  console.log('');
  console.log('  Only y(0) is determined by a real number (CDIx(t)); sigma only changes how WIDE the');
  console.log('  dip looks away from that one point, never a real quantity. This is why this script');
  console.log('  stores just CURVE_MIN_VALUE (= -CDI(t)) and the run\'s own sigma, never a sampled curve.');
  console.log('');
  console.log('  A true Riemannian scalar curvature R(h) is never computed by this script -- see');
  console.log('  SKILL.md for why. This is a sanity check only -- no database connection, nothing');
  console.log('  written. Run without --sample, with --study <slug> --source-kind cdix|cdih');
  console.log('  (--gain <a> | --sigma <s>), against a real run.');
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
    // See F4_REFERENCE_PROFILES/scripts/generate_reference_profiles.js and
    // _shared/account_gate/check_account_registration.js for why this is pinned rather than
    // auto-negotiated (harmless against a local Firebird 2.5 target; required against a
    // Firebird 3+ target that only offers this account Legacy_Auth).
    pluginName: Firebird.AUTH_PLUGIN_LEGACY,
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const studyId = await resolveStudyId(db, studyTitle, args.study);

    let cdiRunId = null, cdihRunId = null, sourceRunLabel, values;
    if (args.sourceKind === 'CDIX') {
      const run = await resolveCdiRun(db, studyId, studyTitle, args.sourceRunId);
      cdiRunId = run.ID_CDI_RUN;
      sourceRunLabel = run.RUN_LABEL;
      values = await loadCdiValues(db, cdiRunId);
    } else {
      const run = await resolveCdihRun(db, studyId, studyTitle, args.sourceRunId);
      cdihRunId = run.ID_CDIH_RUN;
      sourceRunLabel = run.RUN_LABEL;
      values = await loadCdihValues(db, cdihRunId);
    }
    if (values.length === 0) {
      throw new Error(`Source run "${sourceRunLabel}" has no value rows -- nothing to scale.`);
    }

    const mode = args.gain !== null && args.gain !== undefined && !Number.isNaN(args.gain) ? 'VISDEPTH' : 'DEPTHCURVE';
    const idLabel = args.sourceKind === 'CDIX' ? 'ID_CDI_RUN' : 'ID_CDIH_RUN';

    if (mode === 'VISDEPTH') {
      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Source: ${args.sourceKind} run "${sourceRunLabel}" (${idLabel}=${cdiRunId || cdihRunId}). Mode 9.1, gain a=${args.gain}.`);
      console.log(`Persons: ${values.length}. Scalar curvature R(h): NOT computed (see SCALAR_CURVATURE_SCOPE_NOTE).`);

      if (args.dryRun) {
        console.log(`[DRY RUN] Would insert 1 GDX_HNF_VISDEPTH_RUN row and ${values.length} GDX_HNF_VISDEPTH_VALUE row(s). Writing nothing.`);
        return;
      }

      const { id: visDepthRunId, runLabel } = await insertVisDepthRun(db, {
        studyId, sourceKind: args.sourceKind, cdiRunId, cdihRunId, gain: args.gain, personCount: values.length,
      });
      await insertVisDepthValues(db, visDepthRunId, values, args.gain);

      console.log(`Wrote GDX_HNF_VISDEPTH_RUN ID_VISDEPTH_RUN=${visDepthRunId} ("${runLabel}") and ${values.length} GDX_HNF_VISDEPTH_VALUE row(s).`);
    } else {
      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Source: ${args.sourceKind} run "${sourceRunLabel}" (${idLabel}=${cdiRunId || cdihRunId}). Mode 9.3, sigma=${args.sigma}.`);
      console.log(`Persons: ${values.length}. Scalar curvature R(h): NOT computed (see SCALAR_CURVATURE_SCOPE_NOTE).`);

      if (args.dryRun) {
        console.log(`[DRY RUN] Would insert 1 GDX_HNF_DEPTHCURVE_RUN row and ${values.length} GDX_HNF_DEPTHCURVE_VALUE row(s). Writing nothing.`);
        return;
      }

      const { id: depthCurveRunId, runLabel } = await insertDepthCurveRun(db, {
        studyId, sourceKind: args.sourceKind, cdiRunId, cdihRunId, sigma: args.sigma, personCount: values.length,
      });
      await insertDepthCurveValues(db, depthCurveRunId, values);

      console.log(`Wrote GDX_HNF_DEPTHCURVE_RUN ID_DEPTHCURVE_RUN=${depthCurveRunId} ("${runLabel}") and ${values.length} GDX_HNF_DEPTHCURVE_VALUE row(s).`);
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
