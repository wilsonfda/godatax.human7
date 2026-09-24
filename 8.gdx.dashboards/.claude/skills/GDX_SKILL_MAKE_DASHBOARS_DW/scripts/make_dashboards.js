#!/usr/bin/env node
/**
 * GDX_SKILL_MAKE_DASHBOARS_DW
 *
 * Reads GDX_HUMAN's DW (7.multidimensional.database, see GoDataX_Human_7_DW.md)
 * and generates 9 self-contained HTML charts:
 *
 *   0. Line (small multiples, 2 panels) - dashboard_00_means_psychometric_responses.html
 *      Pure-psychometric perspective (cardiac coherence excluded on purpose --
 *      see the user request this chart was built for). One instrument per
 *      x-axis position; top panel is the mean response score actually given
 *      by participants (DW_FACT_PSY_VARIABLE_RESULT.RAW_SCORE, via the DW,
 *      scoped to this study); bottom panel is the mean |factor loading| from
 *      GDX_PSY_PSYCHOMETRIC_PROPERTY, one line for EFA_FACTOR_LOADING
 *      (exploratory) and one for STD_FACTOR_LOADING (confirmatory/CFA) --
 *      that table has no ID_STUDY column (a loading shown here reflects
 *      whatever population last had CFA/EFA run for that instrument, not
 *      necessarily THIS study's own -- see GDX_SKILL_MAKE_ANALYSES_CFA_EFA's
 *      --study flag). The x-axis instrument list itself IS study-scoped
 *      (via GDX_PSY_APPLICATION), so an instrument this study never
 *      administered never appears here even if some other study's
 *      population has loadings for it. Two panels instead of one shared
 *      axis: response scores and factor loadings are fundamentally
 *      different quantities (a 1-5-ish Likert mean vs a -1..1 loading), so one
 *      shared y-axis would be the dual-axis anti-pattern, and there is no
 *      natural "instrument zero" to index to the way chart 1 has a BASELINE
 *      phase. Which of this study's own instruments actually has an EFA/CFA
 *      row varies -- absent means no dot, not zero, and the chart's own
 *      caption says exactly which ones (computed from the data, not hardcoded).
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
 *   7. Chakra gradient portrait - dashboard_07_chakra_gradient_portrait.html
 *      The traditional 7-chakra meditating-figure illustration (folder 4),
 *      but with each chakra's circle colored by a computed single-hue
 *      gradient (dataviz-skill sequential ramp, continuously interpolated)
 *      instead of its fixed rainbow color -- driven by chart 5's join
 *      collapsed to one average RAW_SCORE per chakra. Muladhara renders with
 *      no ring when no variable maps to it, same convention the heatmaps use
 *      for an empty cell.
 *
 *   8. Septenary Constitution gradient portrait -
 *      dashboard_08_septenary_constitution_gradient_portrait.html
 *      The Septenary Constitution diagram (folder 3, septenaria.webp): an
 *      Individuality triangle (Atma/Buddhi/Manas) over a Personality stack
 *      (Kama-manas/Kama Rupa/Vital-Etheric/Physical), each band colored by
 *      the same computed gradient method as chart 7 -- driven by chart 2's
 *      exact data (average RAW_SCORE per septenary level), replotted as this
 *      figure instead of a bar. Physical Body renders with no fill when no
 *      variable maps to it.
 *
 * Usage:
 *   node make_dashboards.js --study <slug> [--chart <code>] [--out-dir <path>] [--sample] [--intake-dir <path>]
 *
 *   --study <slug>    REQUIRED. Same slug GDX_SKILL_NEW_STUDY used for
 *                      new_study_intake/<slug>/intake.json. Every chart that
 *                      touches study-scoped data is scoped to this one
 *                      study's people only (joined through DW_DIM_PERSON.
 *                      ID_STUDY, resolved from the intake's study.title via
 *                      GDX_PSY_STUDY), and every output filename carries this
 *                      slug, the study's title, and the generation timestamp
 *                      -- see buildFilename().
 *
 *   --chart <code>    optional. One of '00'-'08' (see the chart list above).
 *                      Generates ONLY that one chart -- e.g. --chart 00 writes
 *                      just dashboard_00_means_psychometric_responses.html,
 *                      loading only the data that chart needs. Omit to
 *                      generate all 9 charts, same as before this flag
 *                      existed.
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
const {
  renderLineChart, renderMultiPanelLineChart, renderBarChart, renderHeatmap, renderChakraPortrait, renderSeptenaryConstitutionPortrait,
} = require('./chart_lib');

const CHART_CODES = ['00', '01', '02', '03', '04', '05', '06', '07', '08'];

function parseArgs(argv) {
  const args = { outDir: null, sample: false, study: null, intakeDir: null, chart: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out-dir') args.outDir = argv[++i];
    else if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else if (argv[i] === '--chart') args.chart = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json -- every chart is scoped to that one study.'
    );
  }
  if (args.chart && !CHART_CODES.includes(args.chart)) {
    throw new Error(`Unknown --chart "${args.chart}". Valid codes: ${CHART_CODES.join(', ')}.`);
  }
  return args;
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (8.gdx.dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts) --
 * same depth/pattern as GDX_SKILL_LOAD_NEW_STUDY_DW's resolveIntakePath(). */
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

// --- Chart 0: line, small multiples (response score vs. EFA/CFA loadings) ---
// One row of data per instrument THIS STUDY ACTUALLY ADMINISTERS (via
// GDX_PSY_APPLICATION -- an instrument this study never gave its participants
// never appears, even if some OTHER study's population has loadings for it).
// RESPONSE_SCORE comes from the DW (study-scoped, like every other chart
// here); EFA_LOADING/CFA_LOADING come straight from GDX_PSY_PSYCHOMETRIC_PROPERTY
// (OLTP, no ID_STUDY column -- whatever population last had CFA/EFA run for
// that instrument, which may not be THIS study's own population if the same
// instrument is shared across studies; see GDX_SKILL_MAKE_ANALYSES_CFA_EFA's
// own --study flag for computing a study-specific value instead of reusing
// whatever's already loaded). Restricting the instrument list to this study's
// own administered instruments is the only study-scoping possible on this
// table's data, but it is real and matters: without it, a study using only
// one instrument (e.g. burnout-test-2's MBI-SS) would show every OTHER
// instrument in the whole database (Hardiness, CAAS, ...) it never gave,
// misleadingly, on its own dashboard.
async function loadMeansPsychometricData(db, studyId) {
  // Deliberately NOT "JOIN GDX_PSY_APPLICATION ON A.ID_INSTRUMENT = I.ID_INSTRUMENT": a study loaded
  // the legacy way (GDX_SKILL_LOAD_RLT_MODEL_DB's .sav import, e.g. ID_STUDY=1) gives every person ONE
  // "umbrella" GDX_PSY_APPLICATION row covering the whole battery, with ID_INSTRUMENT hardcoded to 1
  // (Hardiness) as a placeholder -- see samples.SQL/05_load_applications.sql -- so trusting that column
  // would make every such study look like it only ever administered instrument 1. GDX_PSY_ITEM_RESPONSE
  // is the reliable source of "which instrument(s) this study's applications actually have answers
  // for", true for both the legacy umbrella shape and the one-application-per-instrument shape
  // GDX_SKILL_LOAD_NEW_STUDY_ANSWERS uses.
  const instruments = await query(db, `
    SELECT DISTINCT I.ID_INSTRUMENT, I.NAME
    FROM GDX_PSY_INSTRUMENT I
    JOIN GDX_PSY_INSTRUMENT_ITEM II ON II.ID_INSTRUMENT = I.ID_INSTRUMENT
    JOIN GDX_PSY_ITEM_RESPONSE IR ON IR.ID_ITEM = II.ID_ITEM
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = IR.ID_APPLICATION
    WHERE A.ID_STUDY = ?
    ORDER BY I.ID_INSTRUMENT`, [studyId]);
  const responseRows = await query(db, `
    SELECT I.ID_INSTRUMENT, AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_INSTRUMENT I ON I.ID_INSTRUMENT = V.ID_INSTRUMENT
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY I.ID_INSTRUMENT`, [studyId]);
  const efaRows = await query(db, `
    SELECT ID_INSTRUMENT, AVG(ABS("VALUE")) AS AVG_LOADING, COUNT(*) AS N
    FROM GDX_PSY_PSYCHOMETRIC_PROPERTY
    WHERE TYPE = 'EFA_FACTOR_LOADING'
    GROUP BY ID_INSTRUMENT`, []);
  const cfaRows = await query(db, `
    SELECT ID_INSTRUMENT, AVG(ABS("VALUE")) AS AVG_LOADING, COUNT(*) AS N
    FROM GDX_PSY_PSYCHOMETRIC_PROPERTY
    WHERE TYPE = 'STD_FACTOR_LOADING'
    GROUP BY ID_INSTRUMENT`, []);

  const byInstrument = (rows) => new Map(rows.map((r) => [r.ID_INSTRUMENT, r]));
  const respMap = byInstrument(responseRows), efaMap = byInstrument(efaRows), cfaMap = byInstrument(cfaRows);

  return instruments.map((inst) => {
    const r = respMap.get(inst.ID_INSTRUMENT), e = efaMap.get(inst.ID_INSTRUMENT), c = cfaMap.get(inst.ID_INSTRUMENT);
    return {
      ID_INSTRUMENT: inst.ID_INSTRUMENT,
      INSTRUMENT_NAME: inst.NAME,
      RESPONSE_SCORE: r ? r.AVG_SCORE : null,
      RESPONSE_N: r ? r.N : 0,
      EFA_LOADING: e ? e.AVG_LOADING : null,
      EFA_N: e ? e.N : 0,
      CFA_LOADING: c ? c.AVG_LOADING : null,
      CFA_N: c ? c.N : 0,
    };
  });
}

function sampleMeansPsychometricRows() {
  const data = [
    [1, 'Hardiness', 3.95, 12690, null, 0, null, 0],
    [2, 'Student Engagement Scale', 3.87, 5922, null, 0, null, 0],
    [3, 'Career Adapt-Abilities Scale', 4.08, 11844, 0.36, 28, 0.62, 28],
    [4, 'Satisfaction With Life Scale', 3.55, 2115, null, 0, null, 0],
    [5, 'Job Satisfaction Scale', 3.62, 2115, null, 0, null, 0],
    [6, 'Positivity Ratio Scale', 2.71, 8460, null, 0, null, 0],
    [7, 'Personal Satisfaction', 3.90, 423, null, 0, null, 0],
    [8, 'Perceived Control of Life', 3.70, 423, null, 0, null, 0],
    [9, 'Maslach Burnout Inventory - Student Survey (hypothesis)', 2.40, 7614, null, 0, null, 0],
    [10, 'Undocumented Organizational Block (hypothesis - an1-an11)', 3.10, 4653, null, 0, null, 0],
    [11, 'Red Tape / Perceived Bureaucracy (hypothesis - rt1-rt5)', 2.90, 2115, null, 0, null, 0],
  ];
  return data.map(([ID_INSTRUMENT, INSTRUMENT_NAME, RESPONSE_SCORE, RESPONSE_N, EFA_LOADING, EFA_N, CFA_LOADING, CFA_N]) =>
    ({ ID_INSTRUMENT, INSTRUMENT_NAME, RESPONSE_SCORE, RESPONSE_N, EFA_LOADING, EFA_N, CFA_LOADING, CFA_N }));
}

function buildMeansPsychometricChartHtml(rows) {
  if (rows.length === 0) return null;
  const xLabels = rows.map((r) => r.INSTRUMENT_NAME);
  const round2OrNull = (v) => (v === null || v === undefined ? null : round2(v));
  const responseValues = rows.map((r) => round2OrNull(r.RESPONSE_SCORE));
  const efaValues = rows.map((r) => round2OrNull(r.EFA_LOADING));
  const cfaValues = rows.map((r) => round2OrNull(r.CFA_LOADING));

  // Which of THIS chart's own instruments (this study's, not the whole database's) actually have
  // an EFA/CFA point -- computed from `rows`, not hardcoded, so this stays true as more instruments
  // earn loadings over time (GDX_PSY_PSYCHOMETRIC_PROPERTY has no ID_STUDY column, so a loading
  // shown here reflects whatever population last had CFA/EFA run for that instrument, not
  // necessarily this study's own -- see GDX_SKILL_MAKE_ANALYSES_CFA_EFA's --study flag).
  const withLoadings = rows.filter((r) => r.EFA_LOADING !== null || r.CFA_LOADING !== null);
  const loadingCoverageNote = withLoadings.length === rows.length
    ? 'Every instrument in this study has at least one EFA/CFA row.'
    : withLoadings.length === 0
      ? 'None of this study\'s instrument(s) has any EFA/CFA row yet -- every bottom-panel point is absent, not zero.'
      : `Only ${withLoadings.map((r) => r.INSTRUMENT_NAME).join(', ')} has EFA/CFA rows among this study's instruments -- ` +
        `every other bottom-panel point here is absent, not zero.`;

  const panels = [
    {
      heading: 'Response score -- mean RAW_SCORE from actual participant answers (each instrument\'s own scale)',
      yAxisLabel: 'Average raw score',
      series: [{ name: 'Response score', values: responseValues }],
    },
    {
      heading: 'Factor-analysis loadings -- mean |loading| across items (-1 to 1 scale, a different quantity from the panel above)',
      yAxisLabel: 'Average |factor loading|',
      series: [
        { name: 'EFA (exploratory)', values: efaValues },
        { name: 'CFA (confirmatory)', values: cfaValues },
      ],
    },
  ];

  const tableColumns = [
    { label: 'Response score', get: (i) => (rows[i].RESPONSE_SCORE === null ? '—' : String(round2(rows[i].RESPONSE_SCORE))) },
    { label: 'Response N', get: (i) => String(rows[i].RESPONSE_N) },
    { label: 'EFA loading (avg |value|)', get: (i) => (rows[i].EFA_LOADING === null ? '—' : String(round2(rows[i].EFA_LOADING))) },
    { label: 'CFA loading (avg |value|)', get: (i) => (rows[i].CFA_LOADING === null ? '—' : String(round2(rows[i].CFA_LOADING))) },
  ];

  return renderMultiPanelLineChart({
    title: 'Psychometric Instruments: Response Scores vs. Factor-Analysis Loadings',
    description: 'Pure-psychometric perspective (cardiac coherence deliberately excluded): one instrument per x-axis position, ' +
      'two panels on separate y-scales. The top panel\'s <code>RAW_SCORE</code> (mostly 1-5 Likert, but not a uniform scale across ' +
      'instruments -- e.g. Positivity Ratio Scale runs 0-4) is a fundamentally different quantity from the bottom panel\'s factor ' +
      'loadings (-1 to 1, from <code>GDX_PSY_PSYCHOMETRIC_PROPERTY</code>), so each gets its own panel rather than one shared axis ' +
      '(the dual-axis anti-pattern) or an arbitrary indexed baseline (there is no natural "instrument zero" the way chart 1 has a ' +
      'BASELINE phase). ' + loadingCoverageNote,
    xLabels,
    panels,
    tableColumns,
    favicon: '📐',
  });
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
      'empty here even when chart 3/5 have data. See five_ways_septenary_map_firebird25.sql.',
    favicon: '⛪',
  });
}

// --- Chart 7: Chakra gradient portrait ---------------------------------------
// Same join as chart 5, collapsed to one row per chakra (not per instrument):
// the average score across every instrument whose variables map to that
// chakra's septenary level. Colors the traditional 7-chakra illustration's
// circles with a computed single-hue gradient instead of the fixed rainbow.
async function loadChakraPortrait(db, studyId) {
  return query(db, `
    SELECT C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME, L.NAME AS LEVEL_NAME,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_CHAKRA C ON C.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = C.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME, L.NAME
    ORDER BY C.ORDER_NUM`, [studyId]);
}

function sampleChakraPortraitRows() {
  // Mirrors sampleScoreByLevelRows() 1:1 (chakra:level is 1:1 by design),
  // relabeled through DW_DIM_CHAKRA -- no row for ORDER_NUM 1 (Muladhara /
  // Physical Body), same absence sampleScoreByLevelRows() already has.
  const data = [
    [2, 'Svadhisthana', 'Sacral Chakra', 'Vital/Etheric Body', 3.41, 846],
    [3, 'Manipura', 'Solar Plexus Chakra', 'Astral Body', 3.78, 1692],
    [4, 'Anahata', 'Heart Chakra', 'Lower Mental Body', 3.95, 1269],
    [5, 'Vishuddha', 'Throat Chakra', 'Higher Mental Body', 3.62, 1692],
    [6, 'Ajna', 'Third Eye Chakra', 'Buddhic Body', 3.29, 1269],
    [7, 'Sahasrara', 'Crown Chakra', 'Atmic Body/Spirit', 4.03, 423],
  ];
  return data.map(([ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LEVEL_NAME, AVG_SCORE, N]) =>
    ({ ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LEVEL_NAME, AVG_SCORE, N }));
}

function buildChakraPortraitHtml(rows) {
  if (rows.length === 0) return null;
  const cleaned = rows.map((r) => ({ ...r, AVG_SCORE: r.AVG_SCORE === null ? null : round2(r.AVG_SCORE) }));
  return renderChakraPortrait({
    title: 'Chakra Gradient Portrait: Average Score by Chakra',
    description: 'The traditional 7-chakra meditating-figure illustration, with each circle colored by a single-hue gradient ' +
      '(light = lower, dark = higher) instead of the fixed rainbow -- driven by the real average <code>RAW_SCORE</code> across every ' +
      'instrument whose variables map to that chakra\'s septenary level (same join as chart 5, collapsed to one row per chakra). ' +
      'Muladhara (Physical Body) has no ring: no variable in this dataset maps to it -- see GoDataX_Human_7_DW.md. The ' +
      'chakra&harr;level correspondence itself is a symbolic/interpretive mapping (see chakras_model_firebird25.sql), not an empirical finding.',
    rows: cleaned,
    favicon: '🧘',
  });
}

// --- Chart 8: Septenary Constitution gradient portrait -----------------------
// Same data as chart 2 (average RAW_SCORE by septenary level), with
// TECHNICAL_NAME added for the figure's labels, replotted as the
// Individuality-triangle-over-Personality-stack diagram
// (3.septenary.constitution/septenaria.webp) instead of a bar chart.
async function loadSeptenaryConstitutionPortrait(db, studyId) {
  return query(db, `
    SELECT L.ORDER_NUM, L.NAME AS LEVEL_NAME, L.TECHNICAL_NAME,
           AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT VR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
    WHERE P.ID_STUDY = ?
    GROUP BY L.ORDER_NUM, L.NAME, L.TECHNICAL_NAME
    ORDER BY L.ORDER_NUM`, [studyId]);
}

function sampleSeptenaryConstitutionPortraitRows() {
  // Mirrors sampleScoreByLevelRows() 1:1, with TECHNICAL_NAME added (same
  // values as GDX_PSY_SEPTENARY_LEVEL's DML) -- no row for ORDER_NUM 1
  // (Physical Body / Sthula Sharira), same absence sampleScoreByLevelRows()
  // already has.
  const data = [
    [2, 'Vital/Etheric Body', 'Prana/Linga Sharira', 3.41, 846],
    [3, 'Astral Body', 'Kama Rupa', 3.78, 1692],
    [4, 'Lower Mental Body', 'Concrete Manas', 3.95, 1269],
    [5, 'Higher Mental Body', 'Abstract Manas', 3.62, 1692],
    [6, 'Buddhic Body', 'Buddhi', 3.29, 1269],
    [7, 'Atmic Body/Spirit', 'Atma', 4.03, 423],
  ];
  return data.map(([ORDER_NUM, LEVEL_NAME, TECHNICAL_NAME, AVG_SCORE, N]) =>
    ({ ORDER_NUM, LEVEL_NAME, TECHNICAL_NAME, AVG_SCORE, N }));
}

function buildSeptenaryConstitutionPortraitHtml(rows) {
  if (rows.length === 0) return null;
  const cleaned = rows.map((r) => ({ ...r, AVG_SCORE: r.AVG_SCORE === null ? null : round2(r.AVG_SCORE) }));
  return renderSeptenaryConstitutionPortrait({
    title: 'Septenary Constitution Gradient Portrait: Average Score by Level',
    description: 'The Septenary Constitution diagram (Individuality triangle -- Atma/Buddhi/Manas -- over the Personality ' +
      'stack -- Kama-manas/Kama Rupa/Vital-Etheric/Physical), each band colored by the same single-hue gradient as chart 7 ' +
      '(light = lower, dark = higher) -- driven by the real average <code>RAW_SCORE</code> across every construct/variable ' +
      'mapped to that level (<code>GDX_PSY_SEPT_LEVEL_PSY_MAP</code> via <code>DW_DIM_VARIABLE.ID_SEPTENARY_LEVEL</code>), ' +
      'the exact data chart 2 already plots as a bar. Physical Body has no band color: no variable in this dataset maps to ' +
      'it -- see GoDataX_Human_7_DW.md.',
    rows: cleaned,
    favicon: '🔺',
  });
}

// Registry: one entry per chart code, in output order. `load` returns the
// real-mode rows (db, studyId); `sample` returns the --sample-mode rows;
// `build` turns rows into HTML (or null if there's nothing to draw). Only the
// codes in `selectedCodes` (main()) are ever loaded/built -- so --chart 00
// issues none of the other 8 charts' queries.
const CHART_REGISTRY = {
  '00': { baseName: 'dashboard_00_means_psychometric_responses', load: loadMeansPsychometricData, sample: sampleMeansPsychometricRows, build: buildMeansPsychometricChartHtml },
  '01': { baseName: 'dashboard_01_physiological_response', load: loadPhysiologicalSeries, sample: samplePhysiologicalRows, build: buildLineChartHtml },
  '02': { baseName: 'dashboard_02_score_by_septenary_level', load: loadScoreByLevel, sample: sampleScoreByLevelRows, build: buildBarChartHtml },
  '03': { baseName: 'dashboard_03_instrument_by_level_heatmap', load: loadInstrumentByLevel, sample: sampleInstrumentByLevelRows, build: buildLevelHeatmapHtml },
  '04': { baseName: 'dashboard_04_instrument_by_cardiac_coherence_heatmap', load: loadInstrumentByCoherence, sample: sampleInstrumentByCoherenceRows, build: buildCoherenceHeatmapHtml },
  '05': { baseName: 'dashboard_05_instrument_by_kundalini_chakra_heatmap', load: loadInstrumentByChakra, sample: sampleInstrumentByChakraRows, build: buildChakraHeatmapHtml },
  '06': { baseName: 'dashboard_06_instrument_by_five_ways_heatmap', load: loadInstrumentByFiveWay, sample: sampleInstrumentByFiveWayRows, build: buildFiveWayHeatmapHtml },
  '07': { baseName: 'dashboard_07_chakra_gradient_portrait', load: loadChakraPortrait, sample: sampleChakraPortraitRows, build: buildChakraPortraitHtml },
  '08': { baseName: 'dashboard_08_septenary_constitution_gradient_portrait', load: loadSeptenaryConstitutionPortrait, sample: sampleSeptenaryConstitutionPortraitRows, build: buildSeptenaryConstitutionPortraitHtml },
};

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..');
  fs.mkdirSync(outDir, { recursive: true });

  const selectedCodes = args.chart ? [args.chart] : CHART_CODES;

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
  console.log(`Study: "${studyTitle}" (slug "${args.study}"). Generation timestamp: ${timestamp}. ` +
    `Chart(s): ${selectedCodes.join(', ')}.`);

  let db = null;
  let studyId = null;
  if (!args.sample) {
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
    studyId = await resolveStudyId(db, studyTitle, args.study);
    console.log(`Resolved ID_STUDY=${studyId}. Every study-scoped chart below is scoped to this study's people only.`);
  } else {
    console.log('Using embedded --sample data (no database connection).');
  }

  const outputs = [];
  for (const code of selectedCodes) {
    const chart = CHART_REGISTRY[code];
    const rows = args.sample ? chart.sample() : await chart.load(db, studyId);
    outputs.push([buildFilename(chart.baseName, args.study, studyTitle, timestamp), chart.build(rows)]);
  }

  if (db) db.detach();

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
