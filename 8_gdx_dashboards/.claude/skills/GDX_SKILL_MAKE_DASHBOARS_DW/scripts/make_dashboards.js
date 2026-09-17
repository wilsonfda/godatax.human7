#!/usr/bin/env node
/**
 * GDX_SKILL_MAKE_DASHBOARS_DW
 *
 * Reads GDX_HUMAN's DW (7_multidimensional.database, see GoDataX_Human_7_DW.md)
 * and generates 6 self-contained HTML charts:
 *
 *   1. Line (multi-dimension)  - dashboard_01_physiological_response.html
 *      Cardiac-coherence metrics (coherence index, heart rate, RMSSD, SDNN)
 *      across the protocol phases in DW_FACT_CC_HRV_WINDOW, each indexed to
 *      its own BASELINE value = 100 (four different units -> one shared axis
 *      would be a dual-axis anti-pattern; indexing to a common base is the
 *      dataviz-skill-endorsed fix).
 *
 *   2. Bar                     - dashboard_02_score_by_septenary_level.html
 *      Average psychometric DW_FACT_PSY_VARIABLE_RESULT.RAW_SCORE grouped by
 *      DW_DIM_SEPTENARY_LEVEL -- the metaphysical cross-perspective the DW
 *      was built for, at its simplest: does any level score systematically
 *      higher or lower across the 423 participants?
 *
 *   3-6. Heatmap x4             - dashboard_0[3-6]_instrument_by_*_heatmap.html
 *      Average score per (instrument x <something>) cell. A heatmap (one
 *      sequential hue) was chosen over a radar/spider chart for all four of
 *      these: radar charts distort area/angle and are flagged as an
 *      anti-pattern in the dataviz skill; a heatmap reads magnitude
 *      accurately per cell. The four "somethings":
 *        3. Septenary Level  (GDX_HUMAN's own metaphysical dimension)
 *        4. Cardiac Coherence STRESS_CLASS (physiological, folder 6) --
 *           joined to psychometric results through the shared DW_DIM_PERSON,
 *           since there is no direct fact linking instruments to sessions.
 *        5. Kundalini Chakra (energetic, folder 4) -- each chakra maps 1:1
 *           to a septenary level (DW_DIM_CHAKRA.ID_SEPTENARY_LEVEL), so this
 *           re-reads chart 3's numbers through the chakra lens instead of
 *           the "level" lens.
 *        6. Five Ways of Aquinas (metaphysical, folder 5) -- each way maps
 *           N:1 to a septenary level (DW_DIM_FIVE_WAY.ID_SEPTENARY_LEVEL,
 *           several ways can share one level), so a level's score is
 *           repeated across every way that shares it; levels with no way
 *           (1, 2, 3, 7) are entirely empty here even though they may have
 *           data in chart 3/5.
 *
 * Usage:
 *   node make_dashboards.js --study <slug> [--out-dir <path>] [--sample] [--intake-dir <path>]
 *
 *   --study <slug>    REQUIRED. Same slug GDX_SKILL_NEW_STUDY used for
 *                      new_study_intake/<slug>/intake.json. All 6 charts are
 *                      scoped to this one study's people only (joined through
 *                      DW_DIM_PERSON.ID_STUDY, resolved from the intake's
 *                      study.title via GDX_PSY_STUDY), and every output
 *                      filename carries this slug, the study's title, and the
 *                      generation timestamp -- see buildFilename().
 *
 *   --sample   use embedded sample data instead of connecting to the
 *              database -- lets the chart-generation logic be verified
 *              without touching the live DW. Real use omits this flag. In
 *              --sample mode, --study only needs to resolve a real intake.json
 *              if one happens to exist for that slug; otherwise the filename
 *              falls back to a generic "Sample Study" title.
 *
 * Connection (real mode): entirely from environment variables, see
 * ../.env.example. Never hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { renderLineChart, renderBarChart, renderHeatmap } = require('./chart_lib');

function parseArgs(argv) {
  const args = { outDir: null, sample: false, study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out-dir') args.outDir = argv[++i];
    else if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json -- every chart is scoped to that one study.'
    );
  }
  return args;
}

/** GDX_HUMAN/0_new_instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (8_gdx_dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts) --
 * same depth/pattern as GDX_SKILL_LOAD_NEW_STUDY_DW's resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0_new_instrument', 'new_study_intake', args.study, 'intake.json');
}

function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) return null;
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

/** Filesystem-safe slug for a filename component: strips accents, lowercases,
 * collapses anything non [a-z0-9] into a single "-", trims edges, caps length
 * so 6 chart filenames stay reasonable even for a long study title. */
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

/** Every output filename carries: the base chart name, the study's slug (the
 * literal --study code), the study's title (slugified), and the moment this
 * run was generated -- so re-running for a different study, or re-running the
 * same study later, never collides with or overwrites a previous run's files. */
function buildFilename(baseName, studySlug, studyTitle, timestamp) {
  return `${baseName}__${studySlug}__${slugifyForFilename(studyTitle)}__${timestamp}.html`;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, ` +
      `fill it in, and export the vars before running this script (or pass --sample ` +
      `to generate charts from embedded sample data with no database connection).`
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

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Resolves --study's slug to GDX_PSY_STUDY.ID_STUDY via the intake's
 * study.title, same lookup GDX_SKILL_LOAD_NEW_STUDY_DW uses. Every chart
 * query below joins DW_DIM_PERSON on this id to scope to that one study's
 * people (DW_DIM_PERSON.ID_STUDY is set when GDX_SKILL_LOAD_NEW_STUDY_DW
 * first loads a person for a study -- see GoDataX_Human_7_DW.md section 8). */
async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(
      `Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run ` +
      `GDX_SKILL_RECORD_NEW_STUDY and GDX_SKILL_LOAD_NEW_STUDY_DW for this study first.`
    );
  }
  return rows[0].ID_STUDY;
}

// --- Chart 1: line, multi-dimension -----------------------------------------
async function loadPhysiologicalSeries(db, studyId) {
  // DW_FACT_CC_HRV_WINDOW has no start-timestamp column (only DATE_KEY /
  // WINDOW_SECONDS) -- the real per-window clock time lives on
  // DW_DIM_SESSION.STARTED_AT, so order by that instead.
  return query(db, `
    SELECT S.PROTOCOL_NAME, S.STARTED_AT, H.COHERENCE_INDEX,
           H.MEAN_HEART_RATE_BPM, H.RMSSD_MS, H.SDNN_MS
    FROM DW_FACT_CC_HRV_WINDOW H
    JOIN DW_DIM_SESSION S ON S.SESSION_ID = H.SESSION_ID
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = H.ID_PERSON
    WHERE P.ID_STUDY = ?
    ORDER BY S.STARTED_AT`, [studyId]);
}

function samplePhysiologicalRows() {
  return [
    { PROTOCOL_NAME: 'BASELINE 5 MIN', COHERENCE_INDEX: 0.42, MEAN_HEART_RATE_BPM: 69.4, RMSSD_MS: 13.5, SDNN_MS: 10.3 },
    { PROTOCOL_NAME: 'MENTAL ARITHMETIC 5 MIN', COHERENCE_INDEX: 0.12, MEAN_HEART_RATE_BPM: 92.6, RMSSD_MS: 6.0, SDNN_MS: 4.3 },
    { PROTOCOL_NAME: 'PACED BREATHING 6 BPM', COHERENCE_INDEX: 0.91, MEAN_HEART_RATE_BPM: 60.8, RMSSD_MS: 63.0, SDNN_MS: 63.2 },
    { PROTOCOL_NAME: 'RECOVERY 5 MIN', COHERENCE_INDEX: 0.58, MEAN_HEART_RATE_BPM: 74.4, RMSSD_MS: 21.6, SDNN_MS: 17.8 },
    { PROTOCOL_NAME: 'QUIET WORRY 5 MIN', COHERENCE_INDEX: 0.25, MEAN_HEART_RATE_BPM: 77.9, RMSSD_MS: 12.2, SDNN_MS: 7.9 },
  ];
}

function buildLineChartHtml(rows) {
  if (rows.length === 0) return null;
  const metrics = [
    { key: 'COHERENCE_INDEX', name: 'Coherence Index' },
    { key: 'MEAN_HEART_RATE_BPM', name: 'Mean Heart Rate' },
    { key: 'RMSSD_MS', name: 'RMSSD' },
    { key: 'SDNN_MS', name: 'SDNN' },
  ];
  const xLabels = rows.map((r) => r.PROTOCOL_NAME);
  const series = metrics.map((m) => {
    const base = rows[0][m.key];
    const values = rows.map((r) => round2((r[m.key] / base) * 100));
    return { name: m.name, values };
  });
  return renderLineChart({
    title: 'Physiological Response Across the Coherence Protocol',
    description: 'Four cardiac-coherence metrics from <code>DW_FACT_CC_HRV_WINDOW</code>, each indexed to its own BASELINE window = 100 ' +
      '(they are on different units -- ms, bpm, a 0-1 index -- so a shared raw-value axis would be a dual-axis anti-pattern; indexing to a common base makes them comparable on one axis).',
    series,
    xLabels,
    yAxisLabel: '% of baseline',
    favicon: '📈',
  });
}

// --- Chart 2: bar -------------------------------------------------------------
async function loadScoreByLevel(db, studyId) {
  return query(db, `
    SELECT L.ORDER_NUM, L.NAME AS LEVEL_NAME, AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY L.ORDER_NUM, L.NAME
    ORDER BY L.ORDER_NUM`, [studyId]);
}

function sampleScoreByLevelRows() {
  return [
    { ORDER_NUM: 2, LEVEL_NAME: 'Vital/Etheric Body', AVG_SCORE: 3.41, N: 846 },
    { ORDER_NUM: 3, LEVEL_NAME: 'Astral Body', AVG_SCORE: 3.78, N: 1692 },
    { ORDER_NUM: 4, LEVEL_NAME: 'Lower Mental Body', AVG_SCORE: 3.95, N: 1269 },
    { ORDER_NUM: 5, LEVEL_NAME: 'Higher Mental Body', AVG_SCORE: 3.62, N: 1692 },
    { ORDER_NUM: 6, LEVEL_NAME: 'Buddhic Body', AVG_SCORE: 3.29, N: 1269 },
    { ORDER_NUM: 7, LEVEL_NAME: 'Atmic Body/Spirit', AVG_SCORE: 4.03, N: 423 },
  ];
}

function buildBarChartHtml(rows) {
  if (rows.length === 0) return null;
  const bars = rows.map((r) => ({ label: r.LEVEL_NAME, value: round2(r.AVG_SCORE), n: r.N }));
  return renderBarChart({
    title: 'Average Psychometric Score by Septenary Level',
    description: 'Mean <code>DW_FACT_PSY_VARIABLE_RESULT.RAW_SCORE</code> (1-5 scale) across all participants, grouped by the ' +
      '<code>DW_DIM_SEPTENARY_LEVEL</code> each variable resolves to. Level 1 (Physical Body) has no bar: no psychometric ' +
      'variable in this dataset maps to it (see GoDataX_Human_7_DW.md).',
    bars,
    yAxisLabel: 'Average raw score (1-5)',
    favicon: '📊',
  });
}

// --- Shared instrument-heatmap pivot ------------------------------------------
// Every heatmap (3-6) is "average score per (instrument, column) cell"; only
// the query producing the rows, and the fixed column list, differ.
function buildInstrumentHeatmapHtml({ rows, cols, title, description, favicon }) {
  if (rows.length === 0) return null;
  const instruments = [...new Set(rows.map((r) => r.INSTRUMENT_NAME))].sort();
  const cellMap = new Map(rows.map((r) => [`${r.INSTRUMENT_NAME}::${r.COL_KEY}`, r]));
  const cells = instruments.map((inst) =>
    cols.map((c) => {
      const r = cellMap.get(`${inst}::${c.key}`);
      return r ? { value: round2(r.AVG_SCORE), n: r.N } : { value: null, n: 0 };
    }));
  return renderHeatmap({ title, description, rows: instruments, cols: cols.map((c) => c.label), cells, favicon });
}

// --- Chart 3: Instrument x Septenary Level -----------------------------------
async function loadInstrumentByLevel(db, studyId) {
  const rows = await query(db, `
    SELECT I.NAME AS INSTRUMENT_NAME, L.ORDER_NUM, L.NAME AS LEVEL_NAME,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_INSTRUMENT I ON I.ID_INSTRUMENT = V.ID_INSTRUMENT
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY I.NAME, L.ORDER_NUM, L.NAME
    ORDER BY I.NAME, L.ORDER_NUM`, [studyId]);
  return rows.map((r) => ({ ...r, COL_KEY: r.ORDER_NUM }));
}

const LEVEL_COLS = [
  { key: 1, label: 'Physical' }, { key: 2, label: 'Vital/Etheric' }, { key: 3, label: 'Astral' },
  { key: 4, label: 'Lower Mental' }, { key: 5, label: 'Higher Mental' }, { key: 6, label: 'Buddhic' },
  { key: 7, label: 'Atmic/Spirit' },
];

function sampleInstrumentByLevelRows() {
  const data = [
    ['Hardiness', 4, 3.9, 423], ['Hardiness', 5, 3.5, 423], ['Hardiness', 6, 3.1, 423],
    ['Student Engagement Scale', 2, 3.4, 423], ['Student Engagement Scale', 5, 3.7, 423], ['Student Engagement Scale', 6, 3.3, 423],
    ['Career Adapt-Abilities Scale', 4, 4.1, 423], ['Career Adapt-Abilities Scale', 5, 3.9, 846], ['Career Adapt-Abilities Scale', 6, 3.8, 423],
    ['Satisfaction With Life Scale', 3, 3.6, 423],
    ['Job Satisfaction Scale', 3, 3.5, 423],
    ['Positivity Ratio Scale', 2, 2.8, 423], ['Positivity Ratio Scale', 3, 2.6, 423],
    ['Personal Satisfaction', 3, 3.9, 423],
    ['Perceived Control of Life', 4, 3.7, 423],
    ['Undocumented Organizational Block (hypothesis - an1-an11)', 7, 4.03, 423],
  ];
  return data.map(([INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N]) => ({ INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N }));
}

function buildLevelHeatmapHtml(rows) {
  return buildInstrumentHeatmapHtml({
    rows, cols: LEVEL_COLS,
    title: 'Instrument x Septenary Level: Average Score',
    description: 'Where each instrument\'s variables land across the 7 levels, colored by average <code>RAW_SCORE</code>. ' +
      'Reveals which instruments concentrate their measurement at a single level (e.g. Satisfaction scales, purely Astral) ' +
      'versus spreading across several (e.g. Hardiness, Career Adapt-Abilities).',
    favicon: '🔥',
  });
}

// --- Chart 4: Instrument x Cardiac Coherence (STRESS_CLASS) ------------------
// No direct fact links an instrument to a cardiac session -- the join runs
// through the shared DW_DIM_PERSON: for each instrument, the average score of
// whichever people have at least one HRV window carrying that STRESS_CLASS.
async function loadInstrumentByCoherence(db, studyId) {
  const rows = await query(db, `
    SELECT I.NAME AS INSTRUMENT_NAME, H.STRESS_CLASS,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_INSTRUMENT I ON I.ID_INSTRUMENT = V.ID_INSTRUMENT
    JOIN DW_FACT_CC_HRV_WINDOW H ON H.ID_PERSON = VR.ID_PERSON
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE H.STRESS_CLASS IS NOT NULL AND P.ID_STUDY = ?
    GROUP BY I.NAME, H.STRESS_CLASS
    ORDER BY I.NAME, H.STRESS_CLASS`, [studyId]);
  return rows.map((r) => ({ ...r, COL_KEY: r.STRESS_CLASS }));
}

// Same fixed order as the CHECK constraint in gdx_coerencia_cardiaca_fb25_ddl.sql,
// low-arousal -> high-arousal with INCONCLUSIVE (not on that spectrum) last.
const STRESS_CLASS_COLS = [
  { key: 'RELAXED', label: 'Relaxed' }, { key: 'BASELINE', label: 'Baseline' },
  { key: 'ACTIVATED', label: 'Activated' }, { key: 'STRESSED', label: 'Stressed' },
  { key: 'INCONCLUSIVE', label: 'Inconclusive' },
];

function sampleInstrumentByCoherenceRows() {
  const data = [
    ['Hardiness', 'RELAXED', 3.8, 423], ['Hardiness', 'BASELINE', 3.7, 423], ['Hardiness', 'ACTIVATED', 3.6, 423],
    ['Hardiness', 'STRESSED', 3.5, 423], ['Hardiness', 'INCONCLUSIVE', 3.65, 423],
    ['Student Engagement Scale', 'RELAXED', 3.5, 423], ['Student Engagement Scale', 'STRESSED', 3.1, 423],
    ['Positivity Ratio Scale', 'RELAXED', 3.2, 423], ['Positivity Ratio Scale', 'STRESSED', 2.4, 423],
  ];
  return data.map(([INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N]) => ({ INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N }));
}

function buildCoherenceHeatmapHtml(rows) {
  return buildInstrumentHeatmapHtml({
    rows, cols: STRESS_CLASS_COLS,
    title: 'Instrument x Cardiac Coherence: Average Score',
    description: 'Average <code>RAW_SCORE</code> per instrument, among people who have at least one <code>DW_FACT_CC_HRV_WINDOW</code> ' +
      'session window classified with that <code>STRESS_CLASS</code>. There is no direct fact linking instruments to sessions -- this ' +
      'joins through the shared <code>DW_DIM_PERSON</code>, so it only has data for people who did both the psychometric battery and a ' +
      'cardiac-coherence session (see GoDataX_Human_7_DW.md section 6 for how sparse that is today).',
    favicon: '❤️',
  });
}

// --- Chart 5: Instrument x Kundalini Chakra ----------------------------------
// Each chakra maps 1:1 to a septenary level, so this re-reads chart 3's join
// through DW_DIM_CHAKRA instead of DW_DIM_SEPTENARY_LEVEL directly.
async function loadInstrumentByChakra(db, studyId) {
  const rows = await query(db, `
    SELECT I.NAME AS INSTRUMENT_NAME, C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_INSTRUMENT I ON I.ID_INSTRUMENT = V.ID_INSTRUMENT
    JOIN DW_DIM_CHAKRA C ON C.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY I.NAME, C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME
    ORDER BY I.NAME, C.ORDER_NUM`, [studyId]);
  return rows.map((r) => ({ ...r, COL_KEY: r.ORDER_NUM }));
}

const CHAKRA_COLS = [
  { key: 1, label: 'Muladhara (Root)' }, { key: 2, label: 'Svadhisthana (Sacral)' },
  { key: 3, label: 'Manipura (Solar Plexus)' }, { key: 4, label: 'Anahata (Heart)' },
  { key: 5, label: 'Vishuddha (Throat)' }, { key: 6, label: 'Ajna (Third Eye)' },
  { key: 7, label: 'Sahasrara (Crown)' },
];

function sampleInstrumentByChakraRows() {
  // Mirrors sampleInstrumentByLevelRows() 1:1 (chakra:level is 1:1 by design).
  return sampleInstrumentByLevelRows();
}

function buildChakraHeatmapHtml(rows) {
  return buildInstrumentHeatmapHtml({
    rows, cols: CHAKRA_COLS,
    title: 'Instrument x Kundalini Chakra: Average Score',
    description: 'The same (instrument, level) averages as chart 3, relabeled through <code>DW_DIM_CHAKRA</code> ' +
      '(each chakra maps 1:1 to a septenary level, see <code>chakras_model_firebird25.sql</code>) -- reads the identical ' +
      'pattern through the energetic/chakra lens instead of the abstract "level" lens.',
    favicon: '🌀',
  });
}

// --- Chart 6: Instrument x Five Ways of Aquinas ------------------------------
// Ways map N:1 to a level (several ways can share one), so a level's score is
// repeated across every way that shares it; levels with no way at all (1, 2,
// 3, 7) are empty here even where chart 3/5 have data.
async function loadInstrumentByFiveWay(db, studyId) {
  const rows = await query(db, `
    SELECT I.NAME AS INSTRUMENT_NAME, W.ORDER_NUM, W.LATIN_NAME,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_INSTRUMENT I ON I.ID_INSTRUMENT = V.ID_INSTRUMENT
    JOIN DW_DIM_FIVE_WAY W ON W.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY I.NAME, W.ORDER_NUM, W.LATIN_NAME
    ORDER BY I.NAME, W.ORDER_NUM`, [studyId]);
  return rows.map((r) => ({ ...r, COL_KEY: r.ORDER_NUM }));
}

const FIVE_WAY_COLS = [
  { key: 1, label: 'Prima Via' }, { key: 2, label: 'Secunda Via' }, { key: 3, label: 'Tertia Via' },
  { key: 4, label: 'Quarta Via' }, { key: 5, label: 'Quinta Via' },
];

function sampleInstrumentByFiveWayRows() {
  const data = [
    ['Hardiness', 1, 3.9, 423], ['Hardiness', 2, 3.9, 423], ['Hardiness', 3, 3.5, 423], ['Hardiness', 4, 3.5, 423],
    ['Career Adapt-Abilities Scale', 1, 4.1, 423], ['Career Adapt-Abilities Scale', 2, 4.1, 423],
    ['Career Adapt-Abilities Scale', 3, 3.9, 846], ['Career Adapt-Abilities Scale', 4, 3.9, 846], ['Career Adapt-Abilities Scale', 5, 3.8, 423],
    ['Student Engagement Scale', 3, 3.7, 423], ['Student Engagement Scale', 4, 3.7, 423], ['Student Engagement Scale', 5, 3.3, 423],
  ];
  return data.map(([INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N]) => ({ INSTRUMENT_NAME, COL_KEY, AVG_SCORE, N }));
}

function buildFiveWayHeatmapHtml(rows) {
  return buildInstrumentHeatmapHtml({
    rows, cols: FIVE_WAY_COLS,
    title: 'Instrument x Five Ways of Aquinas: Average Score',
    description: 'Average <code>RAW_SCORE</code> per instrument, joined through <code>DW_DIM_FIVE_WAY.ID_SEPTENARY_LEVEL</code>. ' +
      'Ways map many-to-one to a level (Prima/Secunda Via share Lower Mental, Tertia/Quarta share Higher Mental), so a level\'s ' +
      'score repeats across every way built on it. Levels with no way at all (Physical, Vital/Etheric, Astral, Atmic/Spirit) are ' +
      'empty here even when chart 3/5 have data for them -- see <code>five_ways_septenary_map_firebird25.sql</code>.',
    favicon: '⛪',
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..');
  fs.mkdirSync(outDir, { recursive: true });

  const intake = loadIntake(args);
  let studyTitle;
  if (intake && intake.study && intake.study.title) {
    studyTitle = intake.study.title;
  } else if (args.sample) {
    studyTitle = 'Sample Study';
    console.log(`No intake.json found for study slug "${args.study}" -- using a generic title in --sample filenames.`);
  } else {
    throw new Error(
      `intake.json not found for study slug "${args.study}". Run GDX_SKILL_NEW_STUDY (and ` +
      `GDX_SKILL_RECORD_NEW_STUDY / GDX_SKILL_LOAD_NEW_STUDY_DW) for this study first, or pass ` +
      `--intake-dir if it lives somewhere else, or --sample to try the chart pipeline without a study.`
    );
  }
  const timestamp = timestampForFilename(new Date());
  console.log(`Study: "${studyTitle}" (slug "${args.study}"). Generation timestamp: ${timestamp}.`);

  let db = null;
  let physiologicalRows, scoreByLevelRows, instrumentByLevelRows,
    instrumentByCoherenceRows, instrumentByChakraRows, instrumentByFiveWayRows;

  if (args.sample) {
    console.log('Using embedded --sample data (no database connection).');
    physiologicalRows = samplePhysiologicalRows();
    scoreByLevelRows = sampleScoreByLevelRows();
    instrumentByLevelRows = sampleInstrumentByLevelRows();
    instrumentByCoherenceRows = sampleInstrumentByCoherenceRows();
    instrumentByChakraRows = sampleInstrumentByChakraRows();
    instrumentByFiveWayRows = sampleInstrumentByFiveWayRows();
  } else {
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
    db = await connect(options);
    const studyId = await resolveStudyId(db, studyTitle, args.study);
    console.log(`Resolved ID_STUDY=${studyId}. Every chart below is scoped to this study's people only.`);
    physiologicalRows = await loadPhysiologicalSeries(db, studyId);
    scoreByLevelRows = await loadScoreByLevel(db, studyId);
    instrumentByLevelRows = await loadInstrumentByLevel(db, studyId);
    instrumentByCoherenceRows = await loadInstrumentByCoherence(db, studyId);
    instrumentByChakraRows = await loadInstrumentByChakra(db, studyId);
    instrumentByFiveWayRows = await loadInstrumentByFiveWay(db, studyId);
  }

  if (db) db.detach();

  const outputs = [
    [buildFilename('dashboard_01_physiological_response', args.study, studyTitle, timestamp), buildLineChartHtml(physiologicalRows)],
    [buildFilename('dashboard_02_score_by_septenary_level', args.study, studyTitle, timestamp), buildBarChartHtml(scoreByLevelRows)],
    [buildFilename('dashboard_03_instrument_by_level_heatmap', args.study, studyTitle, timestamp), buildLevelHeatmapHtml(instrumentByLevelRows)],
    [buildFilename('dashboard_04_instrument_by_cardiac_coherence_heatmap', args.study, studyTitle, timestamp), buildCoherenceHeatmapHtml(instrumentByCoherenceRows)],
    [buildFilename('dashboard_05_instrument_by_kundalini_chakra_heatmap', args.study, studyTitle, timestamp), buildChakraHeatmapHtml(instrumentByChakraRows)],
    [buildFilename('dashboard_06_instrument_by_five_ways_heatmap', args.study, studyTitle, timestamp), buildFiveWayHeatmapHtml(instrumentByFiveWayRows)],
  ];

  for (const [filename, html] of outputs) {
    if (html === null) {
      console.log(`SKIPPED ${filename}: no data returned for this chart (see GoDataX_Human_7_DW.md for why a table might be empty, or whether this study simply has no rows for it).`);
      continue;
    }
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
