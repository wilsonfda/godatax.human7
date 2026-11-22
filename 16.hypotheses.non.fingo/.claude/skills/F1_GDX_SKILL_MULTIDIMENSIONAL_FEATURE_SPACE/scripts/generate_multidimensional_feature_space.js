#!/usr/bin/env node
/**
 * F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS)
 *
 * Implements F1 ("Normalizacao e comparabilidade") of this project's own
 * multidimensional feature-space mathematical model: for one study,
 * assembles a per-person, per-feature vector x(t) from every perspective
 * this project already has real data for
 * (today: Psi/psychometrics from 2.relational.model.psychometrics, Phi/
 * physiology from 6.cardiac.coherence), normalizes it into z(t), and records
 * both in the tables created by
 * ../../../hypotheses_non_fingo_feature_space_model_firebird25.sql.
 *
 * Deliberately out of scope for this first skill (left for later skills in
 * this same folder, per the document's F2-F8): latent representations (PCA/
 * autoencoder), distance/similarity, the Curvature Depth Index, reference
 * baselines (individual/population/normative), temporal trajectories, the
 * Knowledge Graph relations layer, and the Virtology application layer.
 * Nothing here computes a CDI, a distance, or a baseline.
 *
 * Data sources read, in this order of preference:
 *   1. Relational OLTP   -- GDX_PSY_VARIABLE_RESULT / GDX_PSY_APPLICATION
 *                           (2.relational.model.psychometrics), GDX_CC_HRV_WINDOW /
 *                           GDX_CC_SESSION (6.cardiac.coherence).
 *   2. BI star schema    -- DW_FACT_PSY_VARIABLE_RESULT / DW_FACT_CC_HRV_WINDOW
 *                           (7.multidimensional.database), used INSTEAD of the
 *                           OLTP source for a given modality when
 *                           GDX_SKILL_LOAD_NEW_STUDY_DW has already loaded this
 *                           study into the DW (checked live, not assumed).
 *   3. Knowledge Graph    -- Neo4j, ONLY when --include-graph is passed. Scans
 *                           each person's own GDX_PSY_PERSON node for numeric
 *                           properties beyond the standard catalog columns.
 *                           As of this writing the two read-only graph-ML
 *                           skills in 10.gdx.machine.learning do not persist
 *                           their outputs back onto any node, so this
 *                           ordinarily finds nothing -- when it finds nothing,
 *                           or finds something, it is reported in the run's
 *                           NOTES rather than silently cataloged: deciding
 *                           which perspective/feature_type an arbitrary graph
 *                           property belongs under is a human judgment call,
 *                           not something this skill infers on its own.
 *
 * Missing data is never invented (CLAUDE.md "Never invent missing data"):
 * every (person, psychometric variable) pair this study's participants are
 * expected to have a value for gets a row even when no
 * GDX_PSY_VARIABLE_RESULT exists yet -- IS_MISSING=1, NORMALIZED_VALUE left
 * NULL, MISSING_REASON filled in. Physiological features stay in their
 * natural sparse shape instead (a person may have zero, one or many
 * cardiac-coherence sessions -- there is no fixed expected count to diff
 * against, so no "missing session" rows are fabricated).
 *
 * Usage:
 *   node generate_multidimensional_feature_space.js --study <slug> [--dry-run]
 *     [--normalization zscore|minmax|robust] [--include-graph]
 *     [--intake-dir <path>]
 *
 *   --study <slug>      REQUIRED. Same slug GDX_SKILL_NEW_STUDY/
 *                        GDX_SKILL_LOAD_NEW_STUDY_DW use -- resolves to
 *                        GDX_PSY_STUDY.ID_STUDY via
 *                        new_study_intake/<slug>/intake.json's study.title.
 *   --normalization      F1 method applied to every feature's own sample in
 *                        this run (default zscore). This run's STUDY_SAMPLE
 *                        is the only reference basis this skill uses --
 *                        individual/population/instrument-normative
 *                        references belong to a later CDI skill (F4).
 *   --include-graph      also scan Neo4j for extra numeric GDX_PSY_PERSON
 *                        node properties (see above). Requires NEO4J_* env
 *                        vars only when passed.
 *   --intake-dir          override the default new_study_intake/<slug>/
 *                        location.
 *   --dry-run             compute and print everything, write nothing.
 *
 * Every run is a brand-new GDX_HNF_FEATURE_SPACE_RUN row (never merged into
 * a previous run) -- re-running this skill for the same study on purpose
 * produces a new, independently reproducible snapshot, per the document's
 * insistence (section 8.5/31/32) that normalization parameters must stay
 * frozen and versioned rather than silently redefined. Only the shared
 * catalogs (GDX_HNF_PERSPECTIVE, GDX_HNF_FEATURE_DICTIONARY) are
 * insert-if-missing across runs/studies.
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const neo4j = require('neo4j-driver');

const HRV_COLUMNS = [
  'MEAN_RR_MS', 'MEAN_HEART_RATE_BPM', 'RMSSD_MS', 'SDNN_MS',
  'RESPIRATORY_RATE', 'COHERENCE_INDEX', 'ARTIFACT_PERCENTAGE',
];

// All seven are window-level aggregates over a beat time series, so all map
// to the document's "resumo de serie temporal (HRV em janela fixa)" feature
// type (section 1), not CONTINUOUS.
const HRV_FEATURE_META = {
  MEAN_RR_MS: { name: 'Mean RR interval', unit: 'ms', description: 'Mean beat-to-beat (RR) interval within the HRV window.' },
  MEAN_HEART_RATE_BPM: { name: 'Mean heart rate', unit: 'bpm', description: 'Mean heart rate within the HRV window.' },
  RMSSD_MS: { name: 'RMSSD', unit: 'ms', description: 'Root mean square of successive RR interval differences (short-term HRV).' },
  SDNN_MS: { name: 'SDNN', unit: 'ms', description: 'Standard deviation of NN (RR) intervals within the window.' },
  RESPIRATORY_RATE: { name: 'Respiratory rate', unit: 'breaths/min', description: 'Estimated respiratory rate within the window.' },
  COHERENCE_INDEX: { name: 'Cardiac coherence index', unit: null, description: 'Device/algorithm-specific cardiac coherence index for the window.' },
  ARTIFACT_PERCENTAGE: { name: 'Artifact percentage', unit: '%', description: "Percentage of the window flagged as artifact by the device's signal-quality algorithm." },
};

// The document's eight perspectives, x(t) = [Psi, Phi, N, B, A, C, E, M]
// (section 1.1). IS_DIRECTLY_OPERATIONALIZABLE=0 on METAPHYSICS mirrors the
// document's own warning that metaphysical categories never automatically
// receive a numeric value -- this skill never generates a METAPHYSICS
// feature itself.
const PERSPECTIVES = [
  { code: 'PSI', namePt: 'Psicometria', nameEn: 'Psychometrics', description: 'Questionnaires, traits, operationalized psychological indicators.', operationalizable: 1 },
  { code: 'PHI', namePt: 'Fisiologia', nameEn: 'Physiology', description: 'Heart rate, HRV, respiration and other signals with a defined protocol.', operationalizable: 1 },
  { code: 'NEURO', namePt: 'Neurofisiologia', nameEn: 'Neurophysiology', description: 'EEG, EMG, EDA and other electrophysiological measures.', operationalizable: 1 },
  { code: 'BEHAVIOR', namePt: 'Comportamento', nameEn: 'Behavior', description: 'Habits, decisions and behavioral responses.', operationalizable: 1 },
  { code: 'ENVIRONMENT', namePt: 'Ambiente', nameEn: 'Environment', description: 'Luminosity, temperature and other environmental sensor readings.', operationalizable: 1 },
  { code: 'CONSCIOUSNESS', namePt: 'Consciencia operacionalizada', nameEn: 'Operationalized consciousness', description: 'Self-reports and defined constructs -- not equivalent to the seven philosophical levels.', operationalizable: 1 },
  { code: 'ENERGY', namePt: 'Energia', nameEn: 'Energy', description: 'Measurable physical quantities, kept separate from interpretive "energy" categories.', operationalizable: 1 },
  { code: 'METAPHYSICS', namePt: 'Metafisica', nameEn: 'Metaphysics', description: 'Five Ways, chakras, septenary constitution -- ontology/interpretive hypothesis, not a direct measurement.', operationalizable: 0 },
];

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, dryRun: false, includeGraph: false, normalization: 'ZSCORE' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--include-graph') args.includeGraph = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else if (a === '--normalization') args.normalization = String(argv[++i] || '').toUpperCase();
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study) {
    throw new Error('--study <slug> is required (same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_LOAD_NEW_STUDY_DW use).');
  }
  if (!['ZSCORE', 'MINMAX', 'ROBUST'].includes(args.normalization)) {
    throw new Error(`--normalization must be one of zscore, minmax, robust (got "${args.normalization}").`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export ` +
      `the vars before running this script. Never hardcode credentials in this file or anywhere in the repo.`
    );
  }
  return v;
}

/** GDX_HUMAN7/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (16.hypotheses.non.fingo/.claude/skills/
 * F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE/scripts) -- same depth/path shape as
 * GDX_SKILL_LOAD_NEW_STUDY_DW's resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}

function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) {
    throw new Error(
      `intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug "${args.study}" first, ` +
      `or pass --intake-dir if it lives somewhere else.`
    );
  }
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
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
/** node-firebird returns a SELECT's rows as an array, but a single-row
 * `INSERT ... RETURNING col` as a plain object -- normalizes either shape. */
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

async function tableExists(db, tableName) {
  try {
    await query(db, `SELECT 1 FROM ${tableName} WHERE 1 = 0`);
    return true;
  } catch (e) {
    return false;
  }
}

async function hasDwPsychResults(db, studyId) {
  if (!(await tableExists(db, 'DW_FACT_PSY_VARIABLE_RESULT'))) return false;
  const rows = await query(db, `
    SELECT COUNT(*) AS CNT FROM DW_FACT_PSY_VARIABLE_RESULT F
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON WHERE P.ID_STUDY = ?`, [studyId]);
  return Number(rows[0].CNT) > 0;
}
async function hasDwHrvWindows(db, studyId) {
  if (!(await tableExists(db, 'DW_FACT_CC_HRV_WINDOW'))) return false;
  const rows = await query(db, `
    SELECT COUNT(*) AS CNT FROM DW_FACT_CC_HRV_WINDOW F
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON WHERE P.ID_STUDY = ?`, [studyId]);
  return Number(rows[0].CNT) > 0;
}

function psychQuery(useDw) {
  if (useDw) {
    return `
      SELECT F.ID_PERSON, F.ID_VARIABLE, F.ID_APPLICATION, F.RAW_SCORE, F.STANDARDIZED_SCORE, A.START_TIMESTAMP
      FROM DW_FACT_PSY_VARIABLE_RESULT F
      JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON
      LEFT JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = F.ID_APPLICATION
      WHERE P.ID_STUDY = ?`;
  }
  return `
    SELECT A.ID_PERSON, VR.ID_VARIABLE, VR.ID_APPLICATION, VR.RAW_SCORE, VR.STANDARDIZED_SCORE, A.START_TIMESTAMP
    FROM GDX_PSY_VARIABLE_RESULT VR
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`;
}

function hrvQuery(useDw) {
  const cols = HRV_COLUMNS.map((c) => `W.${c}`).join(', ');
  if (useDw) {
    return `
      SELECT F.ID_PERSON, F.SESSION_ID, S.STARTED_AT, ${HRV_COLUMNS.map((c) => `F.${c}`).join(', ')}
      FROM DW_FACT_CC_HRV_WINDOW F
      JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON
      LEFT JOIN DW_DIM_SESSION S ON S.SESSION_ID = F.SESSION_ID
      WHERE P.ID_STUDY = ?`;
  }
  return `
    SELECT S.ID_PERSON, W.SESSION_ID, S.STARTED_AT, ${cols}
    FROM GDX_CC_HRV_WINDOW W
    JOIN GDX_CC_SESSION S ON S.SESSION_ID = W.SESSION_ID
    JOIN GDX_PSY_STUDY_PARTICIPANT SP ON SP.ID_PERSON = S.ID_PERSON AND SP.ID_STUDY = ?`;
}

/** Mean of every numeric HRV_COLUMNS value per SESSION_ID, ignoring NULLs
 * per column independently (a session's windows can have different columns
 * missing for different windows). Returns Map(sessionId -> {personId,
 * startedAt, windowCount, means: {COLUMN: number|null}}). */
function aggregateHrvBySession(rows) {
  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.SESSION_ID)) {
      bySession.set(r.SESSION_ID, { personId: r.ID_PERSON, startedAt: r.STARTED_AT || null, windowCount: 0, sums: {}, counts: {} });
    }
    const agg = bySession.get(r.SESSION_ID);
    agg.windowCount += 1;
    for (const col of HRV_COLUMNS) {
      const val = r[col];
      if (val === null || val === undefined) continue;
      agg.sums[col] = (agg.sums[col] || 0) + Number(val);
      agg.counts[col] = (agg.counts[col] || 0) + 1;
    }
  }
  const result = new Map();
  for (const [sessionId, agg] of bySession.entries()) {
    const means = {};
    for (const col of HRV_COLUMNS) means[col] = agg.counts[col] ? agg.sums[col] / agg.counts[col] : null;
    result.set(sessionId, { personId: agg.personId, startedAt: agg.startedAt, windowCount: agg.windowCount, means });
  }
  return result;
}

function mapFeatureType(measurementLevel) {
  const lvl = String(measurementLevel || '').toUpperCase();
  if (lvl.includes('NOMINAL')) return 'NOMINAL';
  if (lvl.includes('ORDINAL')) return 'ORDINAL';
  return 'CONTINUOUS';
}

async function loadPersons(db, studyId) {
  const rows = await query(db, 'SELECT ID_PERSON FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ?', [studyId]);
  return rows.map((r) => r.ID_PERSON);
}

/** Resolves which GDX_PSY_VARIABLE rows belong to this study's feature
 * space. Adapted from GDX_SKILL_LOAD_NEW_STUDY_DW's resolveScope(), trimmed
 * to variables only (this skill has no use for items/instrument metadata
 * beyond ID_INSTRUMENT for traceability) and extended to also select
 * MEASUREMENT_LEVEL for F1's feature-type mapping. */
async function resolveVariableScope(db, intake, studyId) {
  if (!intake.instruments || intake.instruments.length === 0) {
    return resolveVariablesFromDatabase(db, studyId);
  }
  const variables = [];
  const seen = new Set();

  for (const instrumentIntake of intake.instruments) {
    const candidates = await query(db, 'SELECT ID_INSTRUMENT, VERSION FROM GDX_PSY_INSTRUMENT WHERE NAME = ?', [instrumentIntake.name]);
    const instRow = candidates.length > 1 && instrumentIntake.version
      ? candidates.find((c) => c.VERSION === instrumentIntake.version) || candidates[0]
      : candidates[0];
    if (!instRow) {
      throw new Error(`Instrument "${instrumentIntake.name}" not found in GDX_PSY_INSTRUMENT. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
    }
    const instrumentId = instRow.ID_INSTRUMENT;

    if (!instrumentIntake.constructs || instrumentIntake.constructs.length === 0 ||
        !instrumentIntake.variables || instrumentIntake.variables.length === 0) {
      // Minimal intake entry (instrument reused verbatim, never onboarded through the full interview)
      // -- derive variables from real GDX_PSY_VARIABLE_RESULT rows for this instrument+study, same
      // "nothing hypothetical, nothing borrowed from another study" discipline as
      // GDX_SKILL_LOAD_NEW_STUDY_DW's own fallback.
      const varRows = await query(db, `
        SELECT DISTINCT V.ID_VARIABLE, V.NAME, V.OPERATIONAL_DEFINITION, V.MEASUREMENT_LEVEL, V.ID_CONSTRUCT
        FROM GDX_PSY_VARIABLE V
        JOIN GDX_PSY_INSTRUMENT_CONSTRUCT IC ON IC.ID_CONSTRUCT = V.ID_CONSTRUCT
        JOIN GDX_PSY_VARIABLE_RESULT VR ON VR.ID_VARIABLE = V.ID_VARIABLE
        JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
        WHERE IC.ID_INSTRUMENT = ? AND A.ID_STUDY = ?`, [instrumentId, studyId]);
      for (const v of varRows) {
        if (seen.has(v.ID_VARIABLE)) continue;
        seen.add(v.ID_VARIABLE);
        variables.push({ ...v, ID_INSTRUMENT: instrumentId });
      }
      continue;
    }

    const constructIdByName = new Map();
    for (const c of instrumentIntake.constructs) {
      const cRows = await query(db, 'SELECT FIRST 1 ID_CONSTRUCT FROM GDX_PSY_CONSTRUCT WHERE NAME = ?', [c.name]);
      if (!cRows[0]) throw new Error(`Construct "${c.name}" not found in GDX_PSY_CONSTRUCT. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
      constructIdByName.set(c.name, cRows[0].ID_CONSTRUCT);
    }
    for (const v of instrumentIntake.variables) {
      const constructId = constructIdByName.get(v.construct_name);
      if (!constructId) {
        throw new Error(`Variable "${v.name}" references construct "${v.construct_name}", which was not declared in this instrument's constructs[].`);
      }
      const vRows = await query(db,
        'SELECT FIRST 1 ID_VARIABLE, NAME, OPERATIONAL_DEFINITION, MEASUREMENT_LEVEL, ID_CONSTRUCT FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = ? AND NAME = ?',
        [constructId, v.name]);
      if (!vRows[0]) {
        throw new Error(`Variable "${v.name}" (construct "${v.construct_name}") not found in GDX_PSY_VARIABLE. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
      }
      if (seen.has(vRows[0].ID_VARIABLE)) continue;
      seen.add(vRows[0].ID_VARIABLE);
      variables.push({ ...vRows[0], ID_INSTRUMENT: instrumentId });
    }
  }
  return { variables, derivedFromDatabase: false };
}

async function resolveVariablesFromDatabase(db, studyId) {
  const varRows = await query(db, `
    SELECT DISTINCT V.ID_VARIABLE, V.NAME, V.OPERATIONAL_DEFINITION, V.MEASUREMENT_LEVEL, V.ID_CONSTRUCT
    FROM GDX_PSY_VARIABLE V
    JOIN GDX_PSY_VARIABLE_RESULT VR ON VR.ID_VARIABLE = V.ID_VARIABLE
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`, [studyId]);
  return { variables: varRows.map((v) => ({ ...v, ID_INSTRUMENT: null })), derivedFromDatabase: true };
}

/** Scans each person's own GDX_PSY_PERSON node (gdx_key = String(ID_PERSON),
 * per 9.knowledge.graph's schema-driven exporter) for numeric properties
 * beyond the standard catalog columns. See the file header for why any
 * property found here is only reported, never auto-cataloged. */
async function collectGraphFeatures(personIds) {
  const uri = requireEnv('NEO4J_URI');
  const username = requireEnv('NEO4J_USERNAME');
  const password = requireEnv('NEO4J_PASSWORD');
  const database = requireEnv('NEO4J_DATABASE');
  const KNOWN_PROPS = new Set(['ID_PERSON', 'NAME', 'EXTERNAL_IDENTIFIER', 'BIRTH_DATE', 'GENDER', 'EDUCATION_LEVEL', 'REGISTRATION_DATE']);

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  const session = driver.session({ database });
  try {
    const found = [];
    for (const personId of personIds) {
      const result = await session.run(
        'MATCH (p:GDX_PSY_PERSON {gdx_key: $key}) RETURN properties(p) AS props',
        { key: String(personId) }
      );
      if (result.records.length === 0) continue;
      const props = result.records[0].get('props');
      for (const [key, value] of Object.entries(props)) {
        if (KNOWN_PROPS.has(key)) continue;
        const num = typeof value === 'number' ? value
          : (value && typeof value.toNumber === 'function' ? value.toNumber() : null);
        if (num === null || Number.isNaN(num)) continue;
        found.push({ personId, propertyKey: key, value: num });
      }
    }
    return {
      found,
      note: found.length === 0
        ? 'Neo4j connected; no extra numeric GDX_PSY_PERSON node properties found beyond the standard catalog ' +
          'columns (the 10.gdx.machine.learning graph-ML skills do not currently persist their outputs back onto ' +
          'any node, so this is expected today).'
        : `Neo4j connected; found ${found.length} extra numeric GDX_PSY_PERSON property value(s) across ` +
          `${new Set(found.map((f) => f.propertyKey)).size} distinct property key(s) -- NOT catalogued ` +
          `automatically (deciding which perspective/feature_type these belong under is a human judgment call). ` +
          `Property keys: ${[...new Set(found.map((f) => f.propertyKey))].join(', ')}.`,
    };
  } finally {
    await session.close();
    await driver.close();
  }
}

function meanStd(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  return { mean, std: Math.sqrt(variance) };
}
function percentile(sortedValues, p) {
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}
function medianIqr(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: percentile(sorted, 0.5), iqr: percentile(sorted, 0.75) - percentile(sorted, 0.25) };
}

/** Computes this run's own frozen normalization parameters for one
 * feature's sample (STUDY_SAMPLE reference -- see file header). Returns
 * null when the sample is too small (<2) or has zero spread, in which case
 * the feature is reported, not normalized, rather than producing a
 * division-by-zero or a meaningless constant z-score. */
function computeParams(method, values) {
  if (values.length < 2) return null;
  if (method === 'ZSCORE') {
    const { mean, std } = meanStd(values);
    return std === 0 ? null : { param1: mean, param2: std, sampleSize: values.length };
  }
  if (method === 'MINMAX') {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max === min ? null : { param1: min, param2: max, sampleSize: values.length };
  }
  // ROBUST
  const { median, iqr } = medianIqr(values);
  return iqr === 0 ? null : { param1: median, param2: iqr, sampleSize: values.length };
}
function normalizeValue(method, raw, param1, param2) {
  if (method === 'ZSCORE') return (raw - param1) / param2;
  if (method === 'MINMAX') return (raw - param1) / (param2 - param1);
  return (raw - param1) / param2; // ROBUST
}

async function bootstrapPerspectives(db, dryRun, summary) {
  const ids = {};
  for (const p of PERSPECTIVES) {
    const existing = await query(db, 'SELECT ID_PERSPECTIVE FROM GDX_HNF_PERSPECTIVE WHERE SYMBOL_CODE = ?', [p.code]);
    if (existing.length > 0) {
      ids[p.code] = existing[0].ID_PERSPECTIVE;
      summary.reused.push(`PERSPECTIVE: ${p.code}`);
      continue;
    }
    summary.inserted.push(`PERSPECTIVE: ${p.code}`);
    if (dryRun) { ids[p.code] = null; continue; }
    const row = returningRow(await query(db, `
      INSERT INTO GDX_HNF_PERSPECTIVE (SYMBOL_CODE, NAME_PT, NAME_EN, DESCRIPTION, IS_DIRECTLY_OPERATIONALIZABLE)
      VALUES (?, ?, ?, ?, ?) RETURNING ID_PERSPECTIVE`,
      [p.code, p.namePt, p.nameEn, p.description, p.operationalizable]));
    ids[p.code] = row.ID_PERSPECTIVE;
  }
  return ids;
}

/** Insert-if-missing by FEATURE_CODE, shared across every study/run. Returns
 * null (not an id) in dry-run mode, same convention as the rest of this
 * script's write paths. */
async function ensureFeature(db, dryRun, summary, cache, def) {
  if (cache.has(def.code)) return cache.get(def.code);
  const existing = await query(db, 'SELECT ID_FEATURE FROM GDX_HNF_FEATURE_DICTIONARY WHERE FEATURE_CODE = ?', [def.code]);
  if (existing.length > 0) {
    cache.set(def.code, existing[0].ID_FEATURE);
    summary.reused.push(`FEATURE_DICTIONARY: ${def.code}`);
    return existing[0].ID_FEATURE;
  }
  summary.inserted.push(`FEATURE_DICTIONARY: ${def.code}`);
  if (dryRun) { cache.set(def.code, null); return null; }
  const row = returningRow(await query(db, `
    INSERT INTO GDX_HNF_FEATURE_DICTIONARY
      (ID_PERSPECTIVE, FEATURE_CODE, NAME, DESCRIPTION, FEATURE_TYPE, MEASUREMENT_UNIT, SCALE_DIRECTION,
       SOURCE_SCHEMA, SOURCE_TABLE, SOURCE_COLUMN, SOURCE_ENTITY_TYPE, SOURCE_ENTITY_ID)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_FEATURE`,
    [def.perspectiveId, def.code, def.name, def.description || null, def.featureType, def.unit || null,
      def.direction || 'UNDEFINED', def.sourceSchema, def.sourceTable, def.sourceColumn || null,
      def.sourceEntityType || null, def.sourceEntityId || null]));
  cache.set(def.code, row.ID_FEATURE);
  return row.ID_FEATURE;
}

async function main() {
  const args = parseArgs(process.argv);
  const intake = loadIntake(args);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) {
    throw new Error(`intake.json for study slug "${args.study}" has no study.title -- is this a valid intake file?`);
  }

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
    const studyRows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
    if (studyRows.length === 0) {
      throw new Error(`Study "${studyTitle}" (slug "${args.study}") not found in GDX_PSY_STUDY. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
    }
    const studyId = studyRows[0].ID_STUDY;

    const personIds = await loadPersons(db, studyId);
    if (personIds.length === 0) {
      throw new Error(`No GDX_PSY_STUDY_PARTICIPANT rows for study "${studyTitle}" -- nothing to build a feature space from.`);
    }
    const personIdSet = new Set(personIds);

    const scope = await resolveVariableScope(db, intake, studyId);
    const useDwPsych = await hasDwPsychResults(db, studyId);
    const useDwHrv = await hasDwHrvWindows(db, studyId);
    const psychSourceLabel = useDwPsych ? 'DW_FACT_PSY_VARIABLE_RESULT' : 'GDX_PSY_VARIABLE_RESULT';
    const hrvSourceLabel = useDwHrv ? 'DW_FACT_CC_HRV_WINDOW' : 'GDX_CC_HRV_WINDOW';

    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}): ${personIds.length} participant(s), ` +
      `${scope.variables.length} psychometric variable(s) in scope${scope.derivedFromDatabase ? ' (derived from database, no instruments[] in intake.json)' : ''}.`);
    console.log(`Psychometric source: ${psychSourceLabel}. Physiological source: ${hrvSourceLabel}.`);

    const psychRows = scope.variables.length > 0 ? await query(db, psychQuery(useDwPsych), [studyId]) : [];
    const hrvRows = await query(db, hrvQuery(useDwHrv), [studyId]);

    const scopeVarIds = new Set(scope.variables.map((v) => v.ID_VARIABLE));
    const psychByKey = new Map();
    let psychCollisions = 0;
    for (const r of psychRows) {
      if (!scopeVarIds.has(r.ID_VARIABLE) || !personIdSet.has(r.ID_PERSON)) continue;
      const key = `${r.ID_PERSON}:${r.ID_VARIABLE}`;
      if (psychByKey.has(key)) { psychCollisions += 1; continue; }
      psychByKey.set(key, r);
    }

    const dictDefsByCode = new Map();
    const orderedCodes = [];
    const records = [];
    const valuesByCode = new Map();

    function registerFeature(def) {
      if (!dictDefsByCode.has(def.code)) { dictDefsByCode.set(def.code, def); orderedCodes.push(def.code); }
    }
    function addRecord(rec) {
      records.push(rec);
      if (!rec.isMissing) {
        if (!valuesByCode.has(rec.code)) valuesByCode.set(rec.code, []);
        valuesByCode.get(rec.code).push(rec.rawValue);
      }
    }

    // -- Psychometric perspective (Psi): dense per (person, variable) --
    for (const personId of personIds) {
      for (const v of scope.variables) {
        const code = `PSY.VAR.${v.ID_VARIABLE}`;
        registerFeature({
          code, perspectiveCode: 'PSI', name: v.NAME, description: v.OPERATIONAL_DEFINITION || null,
          featureType: mapFeatureType(v.MEASUREMENT_LEVEL), unit: null, direction: 'UNDEFINED',
          sourceSchema: 'GDX_PSY', sourceTable: psychSourceLabel, sourceColumn: 'STANDARDIZED_SCORE (fallback RAW_SCORE)',
          sourceEntityType: 'ID_VARIABLE', sourceEntityId: v.ID_VARIABLE,
        });
        const entry = psychByKey.get(`${personId}:${v.ID_VARIABLE}`);
        if (!entry) {
          addRecord({ code, personId, obsGrainKey: 'APPLICATION:NONE', obsInstant: null, rawValue: null,
            isMissing: true, missingReason: 'No GDX_PSY_VARIABLE_RESULT row for this person/variable in this study.' });
          continue;
        }
        const std = entry.STANDARDIZED_SCORE;
        const raw = entry.RAW_SCORE;
        const value = (std !== null && std !== undefined) ? Number(std) : (raw !== null && raw !== undefined ? Number(raw) : null);
        addRecord({
          code, personId, obsGrainKey: `APPLICATION:${entry.ID_APPLICATION}`, obsInstant: entry.START_TIMESTAMP || null,
          rawValue: value, isMissing: value === null,
          missingReason: value === null ? 'GDX_PSY_VARIABLE_RESULT row exists but both STANDARDIZED_SCORE and RAW_SCORE are NULL.' : null,
        });
      }
    }

    // -- Physiological perspective (Phi): sparse, one record per real session --
    const hrvMeans = aggregateHrvBySession(hrvRows.filter((r) => personIdSet.has(r.ID_PERSON)));
    for (const [sessionId, agg] of hrvMeans.entries()) {
      for (const col of HRV_COLUMNS) {
        const meta = HRV_FEATURE_META[col];
        const code = `CC.HRV.${col}`;
        registerFeature({
          code, perspectiveCode: 'PHI', name: meta.name, description: meta.description, featureType: 'TIME_SERIES_SUMMARY',
          unit: meta.unit, direction: 'UNDEFINED', sourceSchema: 'GDX_CC', sourceTable: hrvSourceLabel,
          sourceColumn: col, sourceEntityType: null, sourceEntityId: null,
        });
        const value = agg.means[col];
        addRecord({
          code, personId: agg.personId, obsGrainKey: `CC_SESSION:${sessionId}`, obsInstant: agg.startedAt,
          rawValue: value, isMissing: value === null,
          missingReason: value === null ? `No valid (non-null) ${col} reading across this session's HRV windows.` : null,
        });
      }
    }

    if (orderedCodes.length === 0) {
      throw new Error(
        `No candidate features found for study "${studyTitle}" (no psychometric variable scope resolved and no ` +
        `GDX_CC_HRV_WINDOW session data) -- nothing to build a feature space from.`
      );
    }

    let graphResult = null;
    if (args.includeGraph) {
      console.log('Scanning Neo4j for extra person-level numeric properties (--include-graph) ...');
      graphResult = await collectGraphFeatures(personIds);
      console.log(`  ${graphResult.note}`);
    }

    // -- F1: normalization, per feature, over this run's own sample --
    const method = args.normalization;
    const paramsByCode = new Map();
    for (const code of orderedCodes) {
      paramsByCode.set(code, computeParams(method, valuesByCode.get(code) || []));
    }
    for (const rec of records) {
      if (rec.isMissing) { rec.normalizedValue = null; continue; }
      const stats = paramsByCode.get(rec.code);
      rec.normalizedValue = stats ? normalizeValue(method, rec.rawValue, stats.param1, stats.param2) : null;
    }

    const hasPsych = [...dictDefsByCode.values()].some((d) => d.perspectiveCode === 'PSI');
    const hasPhi = [...dictDefsByCode.values()].some((d) => d.perspectiveCode === 'PHI');
    const observationGrain = hasPsych && hasPhi ? 'CUSTOM_WINDOW' : (hasPhi ? 'CC_SESSION' : 'APPLICATION');
    const sourcesUsed = [...new Set([...dictDefsByCode.values()].map((d) => d.sourceSchema))]
      .concat(useDwPsych || useDwHrv ? ['DW'] : [])
      .concat(args.includeGraph ? ['NEO4J'] : [])
      .join(',');

    const notesLines = [];
    notesLines.push(`Study participants: ${personIds.length}.`);
    notesLines.push(`Psychometric source: ${psychSourceLabel}${useDwPsych ? ' (BI/star-schema)' : ' (relational OLTP; DW not yet loaded for this study)'}.`);
    if (scope.derivedFromDatabase) notesLines.push('Variable scope derived directly from GDX_PSY_VARIABLE_RESULT (no instruments[] section in intake.json).');
    notesLines.push(hrvMeans.size > 0
      ? `Physiological source: ${hrvSourceLabel}${useDwHrv ? ' (BI/star-schema)' : ' (relational OLTP)'}, ${hrvMeans.size} session(s).`
      : 'No cardiac-coherence session data found for this study -- physiological perspective not represented in this run.');
    if (psychCollisions > 0) notesLines.push(`${psychCollisions} duplicate (person, variable) result row(s) found; only the first was used -- needs a human look.`);
    for (const [code, stats] of paramsByCode.entries()) {
      if (!stats) notesLines.push(`Feature ${code}: not normalized (insufficient sample or zero variance in this run's own sample).`);
    }
    notesLines.push(args.includeGraph
      ? graphResult.note
      : 'Graph database not read (pass --include-graph to also scan Neo4j for extra numeric person-level properties).');
    notesLines.push(`Reference basis for normalization: this run's own study sample (STUDY_SAMPLE). Individual/population/` +
      `instrument-normative references are out of scope for this skill (see a later CDI/F4 skill).`);

    const summary = { inserted: [], reused: [] };
    const perspectiveIds = await bootstrapPerspectives(db, args.dryRun, summary);
    for (const def of dictDefsByCode.values()) def.perspectiveId = perspectiveIds[def.perspectiveCode];

    const featureIdByCode = new Map();
    for (const code of orderedCodes) {
      await ensureFeature(db, args.dryRun, summary, featureIdByCode, dictDefsByCode.get(code));
    }

    const runLabel = `${args.study}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    let runId = null;
    if (!args.dryRun) {
      const row = returningRow(await query(db, `
        INSERT INTO GDX_HNF_FEATURE_SPACE_RUN
          (ID_STUDY, RUN_LABEL, OBSERVATION_GRAIN, NORMALIZATION_METHOD, FEATURE_COUNT, PERSON_COUNT,
           SOURCES_USED, INCLUDED_GRAPH_FEATURES, GENERATED_BY, NOTES)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ID_RUN`,
        [studyId, runLabel, observationGrain, method, orderedCodes.length, personIds.length,
          sourcesUsed, args.includeGraph ? 1 : 0, 'F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE', notesLines.join('\n')]));
      runId = row.ID_RUN;
    }
    summary.inserted.push(`FEATURE_SPACE_RUN: ${runLabel}${runId !== null ? ` (ID_RUN=${runId})` : ''}`);

    if (!args.dryRun) {
      let order = 0;
      for (const code of orderedCodes) {
        order += 1;
        await query(db, 'INSERT INTO GDX_HNF_FEATURE_RUN_MEMBER (ID_RUN, ID_FEATURE, FEATURE_ORDER) VALUES (?, ?, ?)',
          [runId, featureIdByCode.get(code), order]);
      }
    }
    summary.inserted.push(`FEATURE_RUN_MEMBER rows: ${orderedCodes.length}`);

    let normalizedFeatureCount = 0;
    for (const [code, stats] of paramsByCode.entries()) {
      if (!stats) continue;
      normalizedFeatureCount += 1;
      if (!args.dryRun) {
        await query(db, `
          INSERT INTO GDX_HNF_NORMALIZATION_PARAM (ID_RUN, ID_FEATURE, METHOD, PARAM_1, PARAM_2, REFERENCE_SAMPLE, SAMPLE_SIZE)
          VALUES (?, ?, ?, ?, ?, 'STUDY_SAMPLE', ?)`,
          [runId, featureIdByCode.get(code), method, stats.param1, stats.param2, stats.sampleSize]);
      }
    }
    summary.inserted.push(`NORMALIZATION_PARAM rows: ${normalizedFeatureCount} (of ${orderedCodes.length} features)`);

    let missingCount = 0;
    for (const rec of records) {
      if (rec.isMissing) missingCount += 1;
      if (!args.dryRun) {
        await query(db, `
          INSERT INTO GDX_HNF_FEATURE_VALUE
            (ID_RUN, ID_PERSON, ID_FEATURE, OBS_GRAIN_KEY, OBS_INSTANT, RAW_VALUE, NORMALIZED_VALUE, IS_MISSING, MISSING_REASON)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [runId, rec.personId, featureIdByCode.get(rec.code), rec.obsGrainKey, rec.obsInstant || null,
            rec.rawValue, rec.normalizedValue, rec.isMissing ? 1 : 0, rec.missingReason || null]);
      }
    }
    summary.inserted.push(`FEATURE_VALUE rows: ${records.length} (${missingCount} flagged IS_MISSING)`);

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary:`);
    console.log(`  features: ${orderedCodes.length} (Psi: ${[...dictDefsByCode.values()].filter((d) => d.perspectiveCode === 'PSI').length}, ` +
      `Phi: ${[...dictDefsByCode.values()].filter((d) => d.perspectiveCode === 'PHI').length})`);
    console.log(`  values: ${records.length} rows, ${missingCount} missing`);
    console.log(`  catalog: ${summary.inserted.length} new / ${summary.reused.length} reused catalog entries`);
    summary.inserted.forEach((s) => console.log(`    + ${s}`));
    console.log('  notes:');
    notesLines.forEach((s) => console.log(`    - ${s}`));
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
