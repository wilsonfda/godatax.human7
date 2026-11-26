#!/usr/bin/env node
/**
 * F4_REFERENCE_PROFILES
 *
 * Annotates and pairs what F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS already freezes into
 * GDX_HNF_CDI_REFERENCE_SET / GDX_HNF_CDI_REFERENCE_VALUE / GDX_HNF_CDI_RUN / GDX_HNF_CDI_VALUE.
 * Never recomputes a reference center or a CDI value. Three independent modes, exactly one per
 * invocation:
 *
 *   1. --stratum VAR=VALUE [--stratum VAR2=VALUE2 ...]   structured provenance for a
 *      STUDY_COHORT/POPULATION_REFERENCE reference set -- which covariate(s) defined the group.
 *      Writes GDX_HNF_REFPROF_STRATUM.
 *
 *   2. --norm-source <path.json>                         structured provenance for an
 *      INSTRUMENT_NORM reference set -- instrument/version, manual, validation population, unit
 *      kind, transformation. Writes GDX_HNF_REFPROF_NORM_SOURCE.
 *
 *   3. (default) pairing mode                             pairs one PERSONAL_BASELINE-scored
 *      GDX_HNF_CDI_RUN (CDIpersonal) with one STUDY_COHORT/POPULATION_REFERENCE-scored
 *      GDX_HNF_CDI_RUN (CDIpopulation) evaluated against the SAME GDX_HNF_FEATURE_SPACE_RUN, and
 *      freezes both real scalars side by side, person by person -- never fused into one score.
 *      Writes GDX_HNF_REFPROF_DUAL_RUN / GDX_HNF_REFPROF_DUAL_VALUE.
 *
 * Usage:
 *   node generate_reference_profiles.js --sample
 *
 *   # Mode 1 -- stratum annotation (reference set must already resolve to STUDY_COHORT or
 *   # POPULATION_REFERENCE):
 *   node generate_reference_profiles.js --study <slug> --reference-set-id <id> \
 *     --stratum AGE_BAND=18-25 --stratum PROTOCOL=B [--dry-run]
 *
 *   # Mode 2 -- norm-source annotation (reference set must already resolve to INSTRUMENT_NORM):
 *   node generate_reference_profiles.js --study <slug> --reference-set-id <id> \
 *     --norm-source ./norm_source_example.json [--dry-run]
 *
 *   # Mode 3 -- two parallel indices, paired (default mode; run ids optional, default to each
 *   # study's latest run of the required reference type):
 *   node generate_reference_profiles.js --study <slug> \
 *     [--personal-cdi-run-id <id>] [--population-cdi-run-id <id>] [--dry-run]
 *
 *   --study <slug>                REQUIRED outside --sample. Same slug F1/F4 use -- resolves to
 *                                  GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                                  study.title.
 *   --reference-set-id <id>        REQUIRED for modes 1/2, refused in mode 3. The
 *                                  GDX_HNF_CDI_REFERENCE_SET.ID_REFERENCE_SET to annotate.
 *   --stratum VAR=VALUE             repeatable, mode 1 only. Each occurrence writes one
 *                                  GDX_HNF_REFPROF_STRATUM row. A variable already recorded for
 *                                  this reference set is refused -- stratification is frozen once
 *                                  written, never updated in place.
 *   --norm-source <path>            mode 2 only. A JSON file:
 *                                  { "instrumentName": "...", "instrumentVersion": "..." (optional),
 *                                    "sourceDocument": "...", "normPopulation": "..." (optional),
 *                                    "languageOrCulture": "..." (optional),
 *                                    "normUnitKind": "PERCENTILE"|"RAW_INTERVAL"|"ORDINAL_CATEGORY"|
 *                                      "STANDARD_SCORE"|"OTHER",
 *                                    "transformationNotes": "..." (required, non-empty) }
 *                                  Refused if this reference set already has a
 *                                  GDX_HNF_REFPROF_NORM_SOURCE row (frozen once written).
 *   --personal-cdi-run-id <id>      mode 3 only, optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN
 *                                  whose reference set must resolve to REFERENCE_TYPE=
 *                                  'PERSONAL_BASELINE'. Defaults to the study's latest such run.
 *   --population-cdi-run-id <id>    mode 3 only, optional. A specific GDX_HNF_CDI_RUN.ID_CDI_RUN
 *                                  whose reference set must resolve to REFERENCE_TYPE IN
 *                                  ('STUDY_COHORT','POPULATION_REFERENCE'). Defaults to the
 *                                  study's latest such run.
 *   --intake-dir <path>              optional override of the default new_study_intake/<slug>/
 *                                  location.
 *   --dry-run                        computes everything and logs it, writing no row.
 *   --sample                         prints a worked numeric example (CDIpersonal vs.
 *                                  CDIpopulation on small, explicitly-labeled illustrative data) --
 *                                  never connects to Firebird, never writes anything.
 *
 * Mode 3's own two runs must share the exact same GDX_HNF_CDI_RUN.ID_INPUT_FEATURE_RUN (the same
 * frozen z(t) standardization) -- see SKILL.md "Separation between normalization and reference".
 * A mismatch is refused, never silently paired across two different standardizations.
 *
 * Connection (real mode): entirely from environment variables (see ../.env.example). Never
 * hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const POPULATION_TYPES = ['STUDY_COHORT', 'POPULATION_REFERENCE'];
const NORM_UNIT_KINDS = ['PERCENTILE', 'RAW_INTERVAL', 'ORDINAL_CATEGORY', 'STANDARD_SCORE', 'OTHER'];

function parseArgs(argv) {
  const args = {
    study: null, referenceSetId: null, strata: [], normSource: null,
    personalCdiRunId: null, populationCdiRunId: null,
    intakeDir: null, dryRun: false, sample: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sample') args.sample = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--reference-set-id') args.referenceSetId = parseInt(argv[++i], 10);
    else if (a === '--stratum') args.strata.push(argv[++i]);
    else if (a === '--norm-source') args.normSource = argv[++i];
    else if (a === '--personal-cdi-run-id') args.personalCdiRunId = parseInt(argv[++i], 10);
    else if (a === '--population-cdi-run-id') args.populationCdiRunId = parseInt(argv[++i], 10);
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }

  if (args.sample) return args;

  if (!args.study) {
    throw new Error('--study <slug> is required (same slug F1/F4 use), unless --sample is passed.');
  }
  if (args.strata.length > 0 && args.normSource) {
    throw new Error('--stratum and --norm-source are mutually exclusive -- one reference set, one annotation mode per run.');
  }
  const annotating = args.strata.length > 0 || !!args.normSource;
  if (annotating) {
    if (!args.referenceSetId) {
      throw new Error('--reference-set-id <id> is required with --stratum/--norm-source.');
    }
    if (args.personalCdiRunId || args.populationCdiRunId) {
      throw new Error('--personal-cdi-run-id/--population-cdi-run-id cannot be combined with --stratum/--norm-source -- annotation and pairing are separate modes.');
    }
  } else if (args.referenceSetId) {
    throw new Error('--reference-set-id is only used with --stratum/--norm-source. Pairing mode (the default) resolves runs via --personal-cdi-run-id/--population-cdi-run-id or the study\'s latest.');
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
/** node-firebird returns an INSERT...RETURNING result as a plain object, not an array of rows the
 * way a SELECT does -- normalizes both shapes to one row object. */
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

/** 0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this script
 * (16.hypotheses.non.fingo/.claude/skills/F4_REFERENCE_PROFILES/scripts) -- same depth/shape as
 * this folder's other skills' resolveIntakePath(). */
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

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
  }
  return rows[0].ID_STUDY;
}

/** Resolves a GDX_HNF_CDI_REFERENCE_SET by id, joined to its own ID_STUDY, for annotation
 * (modes 1/2). Validates it belongs to the resolved study. */
async function resolveReferenceSet(db, studyId, studyTitle, referenceSetId) {
  const rows = await query(db, `
    SELECT ID_REFERENCE_SET, ID_STUDY, REFERENCE_TYPE, REFERENCE_LABEL
    FROM GDX_HNF_CDI_REFERENCE_SET WHERE ID_REFERENCE_SET = ?`, [referenceSetId]);
  if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_REFERENCE_SET with ID_REFERENCE_SET=${referenceSetId}.`);
  const rset = rows[0];
  if (rset.ID_STUDY !== studyId) {
    throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${referenceSetId} belongs to a different study (ID_STUDY=${rset.ID_STUDY}), not "${studyTitle}".`);
  }
  return rset;
}

/** Resolves which GDX_HNF_CDI_RUN to use for mode 3, filtered to the reference-set types this
 * role (personal|population) requires: an explicit id (validated to belong to this study AND to
 * resolve to an allowed REFERENCE_TYPE), or else the study's latest run of an allowed type. */
async function resolveCdiRunByType(db, studyId, studyTitle, explicitId, allowedTypes, roleLabel) {
  const selectSql = `
    SELECT r.ID_CDI_RUN, r.ID_STUDY, r.ID_INPUT_FEATURE_RUN, r.ID_REFERENCE_SET, r.RUN_LABEL, rs.REFERENCE_TYPE
    FROM GDX_HNF_CDI_RUN r
    JOIN GDX_HNF_CDI_REFERENCE_SET rs ON rs.ID_REFERENCE_SET = r.ID_REFERENCE_SET`;
  if (explicitId !== null && explicitId !== undefined && !Number.isNaN(explicitId)) {
    const rows = await query(db, `${selectSql} WHERE r.ID_CDI_RUN = ?`, [explicitId]);
    if (rows.length === 0) throw new Error(`No GDX_HNF_CDI_RUN with ID_CDI_RUN=${explicitId}.`);
    const run = rows[0];
    if (run.ID_STUDY !== studyId) {
      throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${explicitId} belongs to a different study (ID_STUDY=${run.ID_STUDY}), not "${studyTitle}".`);
    }
    if (!allowedTypes.includes(run.REFERENCE_TYPE)) {
      throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${explicitId} is scored against a ${run.REFERENCE_TYPE} reference set -- the ${roleLabel} role requires one of: ${allowedTypes.join(', ')}.`);
    }
    return run;
  }
  const rows = await query(db, `
    ${selectSql} WHERE r.ID_STUDY = ? AND rs.REFERENCE_TYPE IN (${allowedTypes.map(() => '?').join(',')})
    ORDER BY r.GENERATED_AT DESC, r.ID_CDI_RUN DESC`, [studyId, ...allowedTypes]);
  if (rows.length === 0) {
    throw new Error(
      `No GDX_HNF_CDI_RUN found for study "${studyTitle}" scored against a ${allowedTypes.join('/')} ` +
      `reference set (needed for the ${roleLabel} role). Run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS ` +
      `--study ${JSON.stringify(studyTitle)} --reference-type ${allowedTypes[0].toLowerCase()} first.`
    );
  }
  return rows[0];
}

async function loadCdiValues(db, cdiRunId) {
  const rows = await query(db, `SELECT ID_PERSON, CDI_VALUE FROM GDX_HNF_CDI_VALUE WHERE ID_CDI_RUN = ?`, [cdiRunId]);
  return rows.map((r) => ({ personId: r.ID_PERSON, cdiValue: Number(r.CDI_VALUE) }));
}

/** Pairs two independently-fetched CDI value lists by ID_PERSON. A person in only one list is
 * excluded from the pairing entirely and counted (never imputed, never silently dropped without
 * being reported). */
function pairByPerson(personalValues, populationValues) {
  const popByPerson = new Map(populationValues.map((v) => [v.personId, v.cdiValue]));
  const personalPersonIds = new Set(personalValues.map((v) => v.personId));
  const paired = [];
  let excludedPersonalOnly = 0;
  for (const v of personalValues) {
    if (popByPerson.has(v.personId)) {
      paired.push({ personId: v.personId, personalValue: v.cdiValue, populationValue: popByPerson.get(v.personId) });
    } else {
      excludedPersonalOnly += 1;
    }
  }
  const excludedPopulationOnly = populationValues.filter((v) => !personalPersonIds.has(v.personId)).length;
  return { paired, excludedPersonalOnly, excludedPopulationOnly };
}

function isoForLabel(d) {
  return d.toISOString().replace(/[:.]/g, '-');
}

async function insertStratumRows(db, referenceSetId, strata) {
  for (const { variable, value } of strata) {
    await query(db, `
      INSERT INTO GDX_HNF_REFPROF_STRATUM (ID_REFERENCE_SET, STRATUM_VARIABLE, STRATUM_VALUE)
      VALUES (?, ?, ?)`, [referenceSetId, variable, value]);
  }
}

async function insertNormSource(db, referenceSetId, norm) {
  await query(db, `
    INSERT INTO GDX_HNF_REFPROF_NORM_SOURCE
      (ID_REFERENCE_SET, INSTRUMENT_NAME, INSTRUMENT_VERSION, SOURCE_DOCUMENT, NORM_POPULATION, LANGUAGE_OR_CULTURE, NORM_UNIT_KIND, TRANSFORMATION_NOTES)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [referenceSetId, norm.instrumentName, norm.instrumentVersion || null, norm.sourceDocument,
      norm.normPopulation || null, norm.languageOrCulture || null, norm.normUnitKind, norm.transformationNotes]);
}

async function insertDualRun(db, { studyId, personalRun, populationRun, pairedCount, excludedPersonalOnly, excludedPopulationOnly }) {
  const runLabel = `${studyId}_REFPROF_${personalRun.ID_CDI_RUN}x${populationRun.ID_CDI_RUN}_${isoForLabel(new Date())}`;
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_REFPROF_DUAL_RUN
      (ID_STUDY, ID_PERSONAL_CDI_RUN, ID_POPULATION_CDI_RUN, RUN_LABEL, PAIRED_PERSON_COUNT, EXCLUDED_PERSONAL_ONLY_COUNT, EXCLUDED_POPULATION_ONLY_COUNT, GENERATED_BY)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING ID_DUAL_RUN`,
    [studyId, personalRun.ID_CDI_RUN, populationRun.ID_CDI_RUN, runLabel, pairedCount, excludedPersonalOnly, excludedPopulationOnly, 'F4_REFERENCE_PROFILES']));
  return { id: row.ID_DUAL_RUN, runLabel };
}

async function insertDualValues(db, dualRunId, paired) {
  for (const p of paired) {
    await query(db, `
      INSERT INTO GDX_HNF_REFPROF_DUAL_VALUE (ID_DUAL_RUN, ID_PERSON, CDI_PERSONAL_VALUE, CDI_POPULATION_VALUE)
      VALUES (?, ?, ?, ?)`,
      [dualRunId, p.personId, p.personalValue, p.populationValue]);
  }
}

function parseStrataArgs(rawStrata) {
  return rawStrata.map((s) => {
    const idx = s.indexOf('=');
    if (idx <= 0) throw new Error(`--stratum expects VARIABLE=VALUE, got "${s}".`);
    return { variable: s.slice(0, idx), value: s.slice(idx + 1) };
  });
}

function loadNormSourceFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`--norm-source file not found: ${filePath}`);
  const norm = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const required = ['instrumentName', 'sourceDocument', 'normUnitKind', 'transformationNotes'];
  const missing = required.filter((k) => !norm[k] || String(norm[k]).trim() === '');
  if (missing.length > 0) {
    throw new Error(`--norm-source file ${filePath} is missing required field(s): ${missing.join(', ')}.`);
  }
  if (!NORM_UNIT_KINDS.includes(norm.normUnitKind)) {
    throw new Error(`--norm-source normUnitKind "${norm.normUnitKind}" is not recognized. Supported: ${NORM_UNIT_KINDS.join(', ')}.`);
  }
  return norm;
}

/** Illustrative numeric example, explicitly labeled -- NOT real study data. Reuses this folder's
 * own personal-baseline figures (current session vs. a personal baseline on four features) and
 * pairs them against an unrelated, equally illustrative cohort/population center, to show the two
 * parallel indices side by side without ever fusing them into one score. Printed only for
 * --sample; never written anywhere, never connects to the database. */
function printWorkedExample() {
  const current = [0.70, 0.45, 0.61, 0.49];
  const personalBase = [0.62, 0.50, 0.55, 0.44];
  const populationRef = [0.50, 0.50, 0.50, 0.50];

  const rms = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0) / a.length);
  const cdiPersonal = rms(current, personalBase);
  const cdiPopulation = rms(current, populationRef);

  console.log('[SAMPLE] Worked numeric example -- two parallel indices on the same current session:');
  console.log(`  current session (z-space)       = [${current.join(', ')}]`);
  console.log(`  personal baseline (z_base)       = [${personalBase.join(', ')}]`);
  console.log(`  CDIpersonal = sqrt(mean((z - z_base)^2))   = ${cdiPersonal.toFixed(4)}`);
  console.log('');
  console.log(`  population/cohort center (z_pop-ref) = [${populationRef.join(', ')}]`);
  console.log(`  CDIpopulation = sqrt(mean((z - z_pop-ref)^2)) = ${cdiPopulation.toFixed(4)}`);
  console.log('');
  console.log(`  CDIpersonal=${cdiPersonal.toFixed(4)} answers "how much has this person changed relative`);
  console.log('  to their own history?"; CDIpopulation=' + cdiPopulation.toFixed(4) + ' answers "how does this');
  console.log('  profile differ from the chosen group?". Both are real, legitimate questions about the');
  console.log('  SAME observation -- they are never fused into one score here or in');
  console.log('  GDX_HNF_REFPROF_DUAL_VALUE, which stores both side by side with no merged column.');
  console.log('');
  console.log('  This is a sanity check only -- no database connection, nothing written. Run without');
  console.log('  --sample, with --study <slug>, to pair this project\'s own real GDX_HNF_CDI_RUN rows.');
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

  const strata = parseStrataArgs(args.strata);
  const norm = args.normSource ? loadNormSourceFile(args.normSource) : null;

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
    // Pinned instead of auto-negotiated: harmless against a local Firebird 2.5 database (which
    // only ever speaks Legacy_Auth), and required against a Firebird 3+ target (e.g. this
    // folder's own account-registration gate's GDX_WEB_FB_* server) that offers this account
    // only Legacy_Auth -- node-firebird's default SRP/SRP256 negotiation stalls past connect
    // against such a server instead of failing fast. See _shared/account_gate/
    // check_account_registration.js for the same fix, documented in more detail.
    pluginName: Firebird.AUTH_PLUGIN_LEGACY,
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const studyId = await resolveStudyId(db, studyTitle, args.study);

    if (strata.length > 0) {
      // Mode 1: stratum annotation.
      const rset = await resolveReferenceSet(db, studyId, studyTitle, args.referenceSetId);
      if (!POPULATION_TYPES.includes(rset.REFERENCE_TYPE)) {
        throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${rset.ID_REFERENCE_SET} is ${rset.REFERENCE_TYPE} -- stratum annotation only applies to ${POPULATION_TYPES.join('/')}.`);
      }
      const existingRows = await query(db, `SELECT STRATUM_VARIABLE FROM GDX_HNF_REFPROF_STRATUM WHERE ID_REFERENCE_SET = ?`, [rset.ID_REFERENCE_SET]);
      const existingVars = new Set(existingRows.map((r) => r.STRATUM_VARIABLE));
      const clashes = strata.filter((s) => existingVars.has(s.variable));
      if (clashes.length > 0) {
        throw new Error(`Reference set ${rset.ID_REFERENCE_SET} already has a frozen stratum for: ${clashes.map((c) => c.variable).join(', ')}. Stratification is never updated in place.`);
      }

      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Reference set "${rset.REFERENCE_LABEL}" (ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}, ${rset.REFERENCE_TYPE}).`);
      console.log(`Stratum variable(s) to write: ${strata.map((s) => `${s.variable}=${s.value}`).join(', ')}.`);

      if (args.dryRun) {
        console.log(`[DRY RUN] Would insert ${strata.length} GDX_HNF_REFPROF_STRATUM row(s). Writing nothing.`);
        return;
      }
      await insertStratumRows(db, rset.ID_REFERENCE_SET, strata);
      console.log(`Wrote ${strata.length} GDX_HNF_REFPROF_STRATUM row(s) for ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}.`);
      return;
    }

    if (norm) {
      // Mode 2: norm-source annotation.
      const rset = await resolveReferenceSet(db, studyId, studyTitle, args.referenceSetId);
      if (rset.REFERENCE_TYPE !== 'INSTRUMENT_NORM') {
        throw new Error(`GDX_HNF_CDI_REFERENCE_SET ID_REFERENCE_SET=${rset.ID_REFERENCE_SET} is ${rset.REFERENCE_TYPE} -- norm-source annotation only applies to INSTRUMENT_NORM.`);
      }
      const existing = await query(db, `SELECT ID_REFERENCE_SET FROM GDX_HNF_REFPROF_NORM_SOURCE WHERE ID_REFERENCE_SET = ?`, [rset.ID_REFERENCE_SET]);
      if (existing.length > 0) {
        throw new Error(`Reference set ${rset.ID_REFERENCE_SET} already has a frozen GDX_HNF_REFPROF_NORM_SOURCE row. Norm provenance is never updated in place.`);
      }

      console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Reference set "${rset.REFERENCE_LABEL}" (ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}, ${rset.REFERENCE_TYPE}).`);
      console.log(`Norm source: ${norm.instrumentName}${norm.instrumentVersion ? ' v' + norm.instrumentVersion : ''} (${norm.normUnitKind}) -- "${norm.sourceDocument}".`);

      if (args.dryRun) {
        console.log('[DRY RUN] Would insert 1 GDX_HNF_REFPROF_NORM_SOURCE row. Writing nothing.');
        return;
      }
      await insertNormSource(db, rset.ID_REFERENCE_SET, norm);
      console.log(`Wrote GDX_HNF_REFPROF_NORM_SOURCE for ID_REFERENCE_SET=${rset.ID_REFERENCE_SET}.`);
      return;
    }

    // Mode 3 (default): pair CDIpersonal and CDIpopulation.
    const personalRun = await resolveCdiRunByType(db, studyId, studyTitle, args.personalCdiRunId, ['PERSONAL_BASELINE'], 'personal');
    const populationRun = await resolveCdiRunByType(db, studyId, studyTitle, args.populationCdiRunId, POPULATION_TYPES, 'population');

    if (personalRun.ID_CDI_RUN === populationRun.ID_CDI_RUN) {
      throw new Error('The personal and population CDI runs must be two different GDX_HNF_CDI_RUN rows.');
    }
    if (personalRun.ID_INPUT_FEATURE_RUN !== populationRun.ID_INPUT_FEATURE_RUN) {
      throw new Error(
        `GDX_HNF_CDI_RUN ID_CDI_RUN=${personalRun.ID_CDI_RUN} (personal, ID_INPUT_FEATURE_RUN=${personalRun.ID_INPUT_FEATURE_RUN}) and ` +
        `ID_CDI_RUN=${populationRun.ID_CDI_RUN} (population, ID_INPUT_FEATURE_RUN=${populationRun.ID_INPUT_FEATURE_RUN}) are scored against two ` +
        `DIFFERENT GDX_HNF_FEATURE_SPACE_RUN rows -- two different frozen standardizations. Refused: see ` +
        `SKILL.md "Separation between normalization and reference". Re-run F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS ` +
        `for both reference types against the SAME evaluated run first.`
      );
    }

    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}). Personal run "${personalRun.RUN_LABEL}" (ID_CDI_RUN=${personalRun.ID_CDI_RUN}, ${personalRun.REFERENCE_TYPE}) vs. population run "${populationRun.RUN_LABEL}" (ID_CDI_RUN=${populationRun.ID_CDI_RUN}, ${populationRun.REFERENCE_TYPE}), both on ID_INPUT_FEATURE_RUN=${personalRun.ID_INPUT_FEATURE_RUN}.`);

    const personalValues = await loadCdiValues(db, personalRun.ID_CDI_RUN);
    if (personalValues.length === 0) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${personalRun.ID_CDI_RUN} has no GDX_HNF_CDI_VALUE rows -- nothing to pair.`);
    const populationValues = await loadCdiValues(db, populationRun.ID_CDI_RUN);
    if (populationValues.length === 0) throw new Error(`GDX_HNF_CDI_RUN ID_CDI_RUN=${populationRun.ID_CDI_RUN} has no GDX_HNF_CDI_VALUE rows -- nothing to pair.`);

    const { paired, excludedPersonalOnly, excludedPopulationOnly } = pairByPerson(personalValues, populationValues);
    if (paired.length === 0) {
      throw new Error(
        `No person is present in BOTH ID_CDI_RUN=${personalRun.ID_CDI_RUN} (personal) and ` +
        `ID_CDI_RUN=${populationRun.ID_CDI_RUN} (population) -- nothing to pair. Choose a different ` +
        `pair of runs with --personal-cdi-run-id/--population-cdi-run-id.`
      );
    }

    console.log(`Paired persons: ${paired.length}. Excluded (personal run only): ${excludedPersonalOnly}. Excluded (population run only): ${excludedPopulationOnly}.`);

    if (args.dryRun) {
      console.log(`[DRY RUN] Would insert 1 GDX_HNF_REFPROF_DUAL_RUN row and ${paired.length} GDX_HNF_REFPROF_DUAL_VALUE row(s). Writing nothing.`);
      return;
    }

    const { id: dualRunId, runLabel } = await insertDualRun(db, {
      studyId, personalRun, populationRun, pairedCount: paired.length, excludedPersonalOnly, excludedPopulationOnly,
    });
    await insertDualValues(db, dualRunId, paired);

    console.log(`Wrote GDX_HNF_REFPROF_DUAL_RUN ID_DUAL_RUN=${dualRunId} ("${runLabel}") and ${paired.length} GDX_HNF_REFPROF_DUAL_VALUE row(s).`);
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
