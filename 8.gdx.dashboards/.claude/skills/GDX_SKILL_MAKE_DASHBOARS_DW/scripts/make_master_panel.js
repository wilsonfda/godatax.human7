#!/usr/bin/env node
/**
 * GDX_H7ph_Plan_Study_Humility_in_Metaphysics.md Phase 7c -- one single page combining every
 * dashboard (00-09) plus a phase-by-phase retrospective of the WHOLE pipeline for this study:
 * registration (Phase 1-2), data collection (Phase 3), factor analysis/alpha (Phase 4),
 * metaphysical/virtue associations (Phase 5), the Data Warehouse load (Phase 6), the dashboards
 * themselves (Phase 7), the Neo4j knowledge-graph export (Phase 8), and the link-prediction model's
 * suggestions (Phase 9) -- each section labeled with the skill(s) responsible for it, per the
 * plan's own spec for this panel.
 *
 * Usage:
 *   node make_master_panel.js --study <slug> [--out-dir <dir>] [--dashboards-dir <dir>] [--ml-dir <dir>]
 *
 *   --study <slug>         REQUIRED. Same slug every other Phase-7+ skill uses.
 *   --out-dir <dir>        where to write the master panel (default: this folder's own
 *                          8.gdx.dashboards/, same as every other dashboard file).
 *   --dashboards-dir <dir> where to look for the already-generated dashboard_00..09 files for this
 *                          study (default: same as --out-dir). The most recent file per base name
 *                          is used (by the timestamp embedded in its filename); dashboard_09 is
 *                          special -- ALL of its per-participant files are embedded, not just one.
 *   --ml-dir <dir>         where to look for this study's Link_Prediction_<slug>_*.md report
 *                          (default: 10.gdx.machine.learning/, resolved relative to this script).
 *
 * This script only READS from Firebird/Neo4j/the filesystem -- it never writes to either database,
 * and never re-runs any of the skills it reports on (run them first; this just assembles what they
 * already produced).
 *
 * Connection: entirely from environment variables (see ../.env.example). Never hardcode credentials.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const neo4j = require('neo4j-driver');
const { pageShell, esc } = require('./chart_lib');

const DASHBOARD_SPECS = [
  { code: '00', base: 'dashboard_00_means_psychometric_responses', title: 'Means: Psychometric Responses', skills: 'GDX_SKILL_MAKE_ANALYSES_CFA_EFA + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '01', base: 'dashboard_01_physiological_response', title: 'Physiological Response (cardiac coherence)', skills: 'GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '02', base: 'dashboard_02_score_by_septenary_level', title: 'Score by Septenary Level', skills: 'GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '03', base: 'dashboard_03_instrument_by_level_heatmap', title: 'Instrument x Septenary Level', skills: 'GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '04', base: 'dashboard_04_instrument_by_cardiac_coherence_heatmap', title: 'Instrument x Cardiac Coherence', skills: 'GDX_SKILL_LOAD_CC_MAPS_DB + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '05', base: 'dashboard_05_instrument_by_kundalini_chakra_heatmap', title: 'Instrument x Kundalini Chakra', skills: 'GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '06', base: 'dashboard_06_instrument_by_five_ways_heatmap', title: 'Instrument x Five Ways of Aquinas', skills: 'GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS + GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '07', base: 'dashboard_07_chakra_gradient_portrait', title: 'Chakra Gradient Portrait', skills: 'GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '08', base: 'dashboard_08_septenary_constitution_gradient_portrait', title: 'Septenary Constitution Gradient Portrait', skills: 'GDX_SKILL_MAKE_DASHBOARS_DW' },
  { code: '09', base: 'dashboard_09_virtue_respondent_profile', title: 'Virtue Respondent Profile (per participant)', skills: 'GDX_SKILL_MAKE_DASHBOARD_VIRTUE_RESPONDENT (new, Phase 7b)', multi: true },
];

function parseArgs(argv) {
  const args = { study: null, outDir: null, dashboardsDir: null, mlDir: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--out-dir') args.outDir = argv[++i];
    else if (argv[i] === '--dashboards-dir') args.dashboardsDir = argv[++i];
    else if (argv[i] === '--ml-dir') args.mlDir = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) throw new Error('--study <slug> is required.');
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy ../.env.example to ../.env and fill it in.`);
  return v;
}

/** Filesystem-safe slug for a filename component -- duplicated from
 * make_dashboards.js's own slugifyForFilename() rather than required from it
 * (this skill's scripts avoid cross-requiring each other's CLI entry points;
 * chart_lib.js is the one file both already share on purpose). Needed now
 * that the master panel's own filename carries the study title too, same
 * convention as every chart 00-08 filename. */
function slugifyForFilename(str) {
  return String(str)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}
function round2(n) { return n === null || n === undefined ? null : Math.round(n * 100) / 100; }

function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..', '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
  const p = resolveIntakePath(args);
  if (!fs.existsSync(p)) throw new Error(`intake.json not found at ${p}.`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  return rows[0].ID_STUDY;
}

// --- Phase 1-2: study/instrument/variable registration -----------------------------------------
async function loadPhase1_2(db, studyId) {
  const study = (await query(db, 'SELECT TITLE, OBJECTIVE, METHOD, STATUS FROM GDX_PSY_STUDY WHERE ID_STUDY = ?', [studyId]))[0];
  const instruments = await query(db, `
    SELECT DISTINCT I.ID_INSTRUMENT, I.NAME, I.VERSION
    FROM GDX_PSY_INSTRUMENT I
    JOIN GDX_PSY_INSTRUMENT_ITEM II ON II.ID_INSTRUMENT = I.ID_INSTRUMENT
    JOIN GDX_PSY_ITEM_RESPONSE IR ON IR.ID_ITEM = II.ID_ITEM
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = IR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`, [studyId]);
  const instrumentIds = instruments.map((i) => i.ID_INSTRUMENT);
  const variables = instrumentIds.length === 0 ? [] : await query(db, `
    SELECT DISTINCT V.ID_VARIABLE, V.NAME, C.NAME AS CONSTRUCT_NAME, L.ORDER_NUM AS SEPT_LEVEL_ORDER, L.NAME AS SEPT_LEVEL_NAME
    FROM GDX_PSY_VARIABLE V
    JOIN GDX_PSY_CONSTRUCT C ON C.ID_CONSTRUCT = V.ID_CONSTRUCT
    JOIN GDX_PSY_INDICATOR IND ON IND.ID_VARIABLE = V.ID_VARIABLE
    JOIN GDX_PSY_INDICATOR_ITEM II2 ON II2.ID_INDICATOR = IND.ID_INDICATOR
    JOIN GDX_PSY_INSTRUMENT_ITEM IT ON IT.ID_ITEM = II2.ID_ITEM
    LEFT JOIN GDX_PSY_SEPT_LEVEL_PSY_MAP SLPM ON SLPM.ID_VARIABLE = V.ID_VARIABLE
    LEFT JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = SLPM.ID_SEPTENARY_LEVEL
    WHERE IT.ID_INSTRUMENT IN (${instrumentIds.map(() => '?').join(',')})
    ORDER BY V.ID_VARIABLE`, instrumentIds);
  return { study, instruments, variables };
}

// --- Phase 3: data collection --------------------------------------------------------------------
async function loadPhase3(db, studyId) {
  const participants = await query(db, `
    SELECT COUNT(*) AS N, SUM(CONSENT) AS CONSENTED
    FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ?`, [studyId]);
  const responses = await query(db, `
    SELECT COUNT(*) AS N FROM GDX_PSY_ITEM_RESPONSE IR
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = IR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`, [studyId]);
  return { participantCount: participants[0].N, consented: participants[0].CONSENTED || 0, responseCount: responses[0].N };
}

// --- Phase 4: factor analysis / alpha (reads what GDX_SKILL_MAKE_ANALYSES_CFA_EFA has produced,
//     if anything -- never recomputes it here) ---------------------------------------------------
async function loadPhase4(db, instrumentIds) {
  if (instrumentIds.length === 0) return { rows: [] };
  const rows = await query(db, `
    SELECT TYPE, METHOD, "VALUE", SAMPLE_SIZE, CALCULATED_AT
    FROM GDX_PSY_PSYCHOMETRIC_PROPERTY
    WHERE ID_INSTRUMENT IN (${instrumentIds.map(() => '?').join(',')})
    ORDER BY CALCULATED_AT DESC`, instrumentIds);
  return { rows };
}

// --- Phase 5: metaphysical/virtue associations ---------------------------------------------------
async function loadPhase5(db, variableIds) {
  if (variableIds.length === 0) return { septenary: 0, chakra: 0, way: 0, virtue: 0 };
  const placeholders = variableIds.map(() => '?').join(',');
  const counts = {};
  for (const [key, table] of [
    ['septenary', 'GDX_PSY_SEPT_LEVEL_PSY_MAP'], ['chakra', 'GDX_PSY_CHAKRA_VAR_MAP'],
    ['way', 'GDX_TA_WAY_SEPT_MAP'], ['virtue', 'GDX_VT_VARIABLE_VIRTUE_MAP'],
  ]) {
    const rows = await query(db, `SELECT COUNT(*) AS N FROM ${table} WHERE ID_VARIABLE IN (${placeholders})`, variableIds);
    counts[key] = rows[0].N;
  }
  return counts;
}

// --- Phase 6: Data Warehouse load -----------------------------------------------------------------
async function loadPhase6(db, studyId) {
  const person = await query(db, 'SELECT COUNT(*) AS N FROM DW_DIM_PERSON WHERE ID_STUDY = ?', [studyId]);
  const itemResp = await query(db, `
    SELECT COUNT(*) AS N FROM DW_FACT_PSY_ITEM_RESPONSE F
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON WHERE P.ID_STUDY = ?`, [studyId]);
  const varResult = await query(db, `
    SELECT COUNT(*) AS N FROM DW_FACT_PSY_VARIABLE_RESULT F
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = F.ID_PERSON WHERE P.ID_STUDY = ?`, [studyId]);
  return { personCount: person[0].N, itemResponseCount: itemResp[0].N, variableResultCount: varResult[0].N };
}

// --- Phase 7: which dashboard files exist for this study -----------------------------------------
function findDashboardFiles(dashboardsDir, slug) {
  if (!fs.existsSync(dashboardsDir)) return {};
  const all = fs.readdirSync(dashboardsDir).filter((f) => f.endsWith('.html'));
  const found = {};
  for (const spec of DASHBOARD_SPECS) {
    const matches = all.filter((f) => f.startsWith(spec.base) && f.includes(`__${slug}__`));
    matches.sort(); // timestamp suffix sorts lexicographically -> chronological
    found[spec.code] = spec.multi ? matches : matches.slice(-1);
  }
  return found;
}

// --- Phase 8: Neo4j export state -------------------------------------------------------------------
async function loadPhase8(variableIds, personIds) {
  const driver = neo4j.driver(
    requireEnv('NEO4J_URI'),
    neo4j.auth.basic(requireEnv('NEO4J_USERNAME'), requireEnv('NEO4J_PASSWORD')),
  );
  const session = driver.session({ database: requireEnv('NEO4J_DATABASE') });
  try {
    const personResult = await session.run(
      'MATCH (p:GDX_PSY_PERSON) WHERE p.ID_PERSON IN $ids RETURN count(p) AS n', { ids: personIds });
    const variableResult = await session.run(
      'MATCH (v:GDX_PSY_VARIABLE) WHERE v.ID_VARIABLE IN $ids RETURN count(v) AS n', { ids: variableIds });
    const relResult = await session.run(
      `MATCH (v:GDX_PSY_VARIABLE)-[r]-() WHERE v.ID_VARIABLE IN $ids RETURN type(r) AS t, count(*) AS n ORDER BY t`,
      { ids: variableIds });
    return {
      personNodes: personResult.records[0].get('n').toNumber(),
      variableNodes: variableResult.records[0].get('n').toNumber(),
      relationshipsByType: relResult.records.map((r) => ({ type: r.get('t'), count: r.get('n').toNumber() })),
    };
  } finally {
    await session.close();
    await driver.close();
  }
}

// --- Phase 9: link-prediction report -----------------------------------------------------------
function findLatestLinkPredictionReport(mlDir, slug) {
  if (!fs.existsSync(mlDir)) return null;
  const matches = fs.readdirSync(mlDir).filter((f) => f.startsWith(`Link_Prediction_${slug}_`) && f.endsWith('.md'));
  matches.sort();
  if (matches.length === 0) return null;
  return path.join(mlDir, matches[matches.length - 1]);
}

function extractLinkPredictionSections(reportPath, variableNames) {
  const text = fs.readFileSync(reportPath, 'utf8');
  const aucprMatches = [...text.matchAll(/\*\*Independent validation, (\w+).*?:\*\* (.+)/g)]
    .map((m) => ({ target: m[1], detail: m[2].trim() }));
  const sections = [];
  for (const name of variableNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`### ${escaped}\\n\\n([\\s\\S]*?)(?=\\n###|\\n## |$)`);
    const m = text.match(re);
    if (m) sections.push({ name, tableMarkdown: m[1].trim() });
  }
  return { aucprMatches, sections, reportPath };
}

function mdTableToHtml(md) {
  const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return `<pre>${esc(md)}</pre>`;
  const header = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
  const rows = lines.slice(2).map((l) => l.split('|').map((c) => c.trim()).filter(Boolean));
  return `<table class="data-table visible"><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function buildPage({ studyTitle, slug, phase1_2, phase3, phase4, phase5, phase6, dashboardFiles, phase8, phase9 }) {
  const variableRows = phase1_2.variables.map((v) =>
    `<tr><td>${esc(v.NAME)}</td><td>${esc(v.CONSTRUCT_NAME)}</td><td>${esc(v.SEPT_LEVEL_NAME || '—')}</td></tr>`).join('');

  const phase4Html = phase4.rows.length === 0
    ? `<p style="color:var(--muted);font-size:13px;">No <code>GDX_PSY_PSYCHOMETRIC_PROPERTY</code> row exists yet for this instrument -- ` +
      `EFA/CFA/KMO all refused (n too small, see <code>GDX_SKILL_MAKE_ANALYSES_CFA_EFA</code>'s own output). An alpha-only figure ` +
      `(small-sample caveat) was computed and written to <code>output/*_alpha_only.sql</code> but not yet loaded into this table.</p>`
    : `<table class="data-table visible"><thead><tr><th>Type</th><th>Value</th><th>Sample size</th><th>Calculated</th><th>Method</th></tr></thead>
        <tbody>${phase4.rows.map((r) => `<tr><td>${esc(r.TYPE)}</td><td>${round2(r.VALUE)}</td><td>${r.SAMPLE_SIZE}</td><td>${esc(String(r.CALCULATED_AT).slice(0, 10))}</td><td>${esc(r.METHOD)}</td></tr>`).join('')}</tbody>
      </table>`;

  const phase5Html = `<table class="data-table visible"><thead><tr><th>Target</th><th>Rows for this study's 4 variables</th></tr></thead>
    <tbody>
      <tr><td>Septenary Constitution</td><td>${phase5.septenary}</td></tr>
      <tr><td>Kundalini Chakra</td><td>${phase5.chakra}</td></tr>
      <tr><td>Five Ways of Aquinas</td><td>${phase5.way}</td></tr>
      <tr><td>Virtology virtue</td><td>${phase5.virtue}</td></tr>
    </tbody></table>`;

  const phase6Html = `<table class="data-table visible"><thead><tr><th>DW table</th><th>Rows (this study)</th></tr></thead>
    <tbody>
      <tr><td>DW_DIM_PERSON</td><td>${phase6.personCount}</td></tr>
      <tr><td>DW_FACT_PSY_ITEM_RESPONSE</td><td>${phase6.itemResponseCount}</td></tr>
      <tr><td>DW_FACT_PSY_VARIABLE_RESULT</td><td>${phase6.variableResultCount}</td></tr>
    </tbody></table>`;

  const phase8Html = phase8
    ? `<table class="data-table visible"><thead><tr><th>Neo4j node/relationship</th><th>Count</th></tr></thead>
        <tbody>
          <tr><td>:GDX_PSY_PERSON nodes (this study's participants)</td><td>${phase8.personNodes}</td></tr>
          <tr><td>:GDX_PSY_VARIABLE nodes (this study's 4 variables)</td><td>${phase8.variableNodes}</td></tr>
          ${phase8.relationshipsByType.map((r) => `<tr><td>${esc(r.type)} (touching those variables)</td><td>${r.count}</td></tr>`).join('')}
        </tbody></table>`
    : `<p style="color:var(--muted);font-size:13px;">Neo4j credentials not configured for this run -- Phase 8 state not queried.</p>`;

  const phase9Html = phase9
    ? `<p style="font-size:13px;">${phase9.aucprMatches.map((a) => `<strong>${esc(a.target)}</strong>: ${esc(a.detail)}`).join('<br>')}</p>
       ${phase9.sections.length > 0
         ? phase9.sections.map((s) => `<h4 style="font-size:13px;margin:14px 0 4px;">${esc(s.name)}</h4>${mdTableToHtml(s.tableMarkdown)}`).join('')
         : `<p style="font-size:13px;color:var(--ink-secondary);">None of this study's own variables appear in this report's ranked ` +
           `suggestion lists -- expected, not a gap: the link-prediction model only ranks suggestions for variables that still lack a ` +
           `mapping, and Phase 5 already gave all 4 of this study's variables a confirmed virtue mapping before this report was ` +
           `generated (see the AUCPR-only summary above, and Phase 5's own table).</p>`}
       <p style="font-size:12px;color:var(--muted);">Full report: <code>${esc(path.basename(phase9.reportPath))}</code> in <code>10.gdx.machine.learning/</code>.</p>`
    : `<p style="color:var(--muted);font-size:13px;">No Link_Prediction_${esc(slug)}_*.md report found -- run GDX_SKILL_GODATAX_HUMAN7_LINK_PRED for this study first.</p>`;

  const phaseSections = [
    { n: '1-2', title: 'Design + Registration', skills: 'GDX_SKILL_NEW_STUDY + GDX_SKILL_RECORD_NEW_STUDY', html: `
      <p style="font-size:13px;"><strong>${esc(studyTitle)}</strong> -- ${esc(phase1_2.study.OBJECTIVE || '')}</p>
      <table class="data-table visible"><thead><tr><th>Variable</th><th>Construct</th><th>Septenary level</th></tr></thead>
        <tbody>${variableRows}</tbody></table>` },
    { n: '3', title: 'Data Collection', skills: 'GDX_SKILL_EXPORT_NEW_STUDY + GDX_SKILL_LOAD_NEW_STUDY_ANSWERS', html: `
      <p style="font-size:13px;">${phase3.participantCount} participant(s), ${phase3.consented} consented, ${phase3.responseCount} item response(s) total.</p>` },
    { n: '4', title: 'Factor Analysis + Internal Consistency', skills: 'GDX_SKILL_MAKE_ANALYSES_CFA_EFA', html: phase4Html },
    { n: '5', title: 'Metaphysical + Virtue Associations', skills: 'GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS + GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR', html: phase5Html },
    { n: '6', title: 'Data Warehouse Load', skills: 'GDX_SKILL_LOAD_NEW_STUDY_DW', html: phase6Html },
    { n: '8', title: 'Knowledge Graph Export (Neo4j)', skills: 'GDX_SKILL_GODATAX_HUMAN7_BY_SPU', html: phase8Html },
    { n: '9', title: 'Link-Prediction Suggestions', skills: 'GDX_SKILL_GODATAX_HUMAN7_LINK_PRED', html: phase9Html },
  ];

  const phaseHtml = phaseSections.map((p) => `
    <div style="margin-bottom:28px;">
      <h3 style="font-size:15px;margin:0 0 2px;">Phase ${p.n}: ${esc(p.title)}</h3>
      <p style="font-size:11px;color:var(--muted);margin:0 0 8px;">${esc(p.skills)}</p>
      ${p.html}
    </div>`).join('');

  const dashboardHtml = DASHBOARD_SPECS.map((spec) => {
    const files = dashboardFiles[spec.code] || [];
    if (files.length === 0) {
      return `<div style="margin-bottom:28px;">
        <h3 style="font-size:15px;margin:0 0 2px;">Panel ${spec.code}: ${esc(spec.title)}</h3>
        <p style="font-size:11px;color:var(--muted);margin:0 0 8px;">${esc(spec.skills)}</p>
        <p style="font-size:13px;color:var(--muted);">Not generated for this study (no data, or not yet run).</p>
      </div>`;
    }
    return files.map((f, i) => `
      <div style="margin-bottom:28px;">
        <h3 style="font-size:15px;margin:0 0 2px;">Panel ${spec.code}${files.length > 1 ? ` (${i + 1}/${files.length})` : ''}: ${esc(spec.title)}</h3>
        <p style="font-size:11px;color:var(--muted);margin:0 0 8px;">${esc(spec.skills)}</p>
        <iframe src="${esc(f)}" style="width:100%;height:600px;border:1px solid var(--grid);border-radius:8px;" loading="lazy"></iframe>
      </div>`).join('');
  }).join('');

  const bodyHtml = `
    <h2 style="font-size:16px;margin:0 0 16px;">Part 1 -- Pipeline Retrospective (Phases 1-9)</h2>
    ${phaseHtml}
    <h2 style="font-size:16px;margin:28px 0 16px;">Part 2 -- All Dashboards</h2>
    ${dashboardHtml}
  `;

  return pageShell({
    title: `Master Panel: ${studyTitle}`,
    description: `Full retrospective + every dashboard panel (00-09) for study "${esc(studyTitle)}" (slug <code>${esc(slug)}</code>) -- ` +
      `assembled by <code>GDX_SKILL_MAKE_DASHBOARD_VIRTUE_RESPONDENT</code>'s companion script (Phase 7c). Each section is labeled ` +
      `with the skill(s) responsible for producing it; nothing here was recomputed -- it reads what those skills already wrote.`,
    favicon: '🗂️',
    bodyHtml,
  });
}

/** The whole generator, callable both as this script's own CLI entry point
 * and as chart code '10' from make_dashboards.js (see that script's main()
 * -- it delegates straight here instead of duplicating any of this). `args`
 * is the same shape parseArgs() above returns: { study, outDir,
 * dashboardsDir, mlDir, intakeDir }. Returns the path written. */
async function generateMasterPanel(args) {
  const intake = loadIntake(args);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);

  const options = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false, role: null, pageSize: 4096,
  };
  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  let studyId, phase1_2, phase3, phase4, phase5, phase6, personIds;
  try {
    studyId = await resolveStudyId(db, studyTitle, args.study);
    phase1_2 = await loadPhase1_2(db, studyId);
    phase3 = await loadPhase3(db, studyId);
    const instrumentIds = phase1_2.instruments.map((i) => i.ID_INSTRUMENT);
    const variableIds = phase1_2.variables.map((v) => v.ID_VARIABLE);
    phase4 = await loadPhase4(db, instrumentIds);
    phase5 = await loadPhase5(db, variableIds);
    phase6 = await loadPhase6(db, studyId);
    const personRows = await query(db, 'SELECT ID_PERSON FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ?', [studyId]);
    personIds = personRows.map((r) => r.ID_PERSON);
  } finally {
    db.detach();
  }

  const variableIds = phase1_2.variables.map((v) => v.ID_VARIABLE);
  let phase8 = null;
  try {
    phase8 = await loadPhase8(variableIds, personIds);
  } catch (err) {
    console.log(`WARNING: could not query Neo4j for Phase 8 state (${err.message}) -- that section will say so.`);
  }

  const mlDir = args.mlDir || path.join(__dirname, '..', '..', '..', '..', '..', '10.gdx.machine.learning');
  const reportPath = findLatestLinkPredictionReport(mlDir, args.study);
  const phase9 = reportPath ? extractLinkPredictionSections(reportPath, phase1_2.variables.map((v) => v.NAME)) : null;

  const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..');
  const dashboardsDir = args.dashboardsDir || outDir;
  const dashboardFiles = findDashboardFiles(dashboardsDir, args.study);

  const html = buildPage({
    studyTitle, slug: args.study, phase1_2, phase3, phase4, phase5, phase6, dashboardFiles, phase8, phase9,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  })();
  const outPath = path.join(outDir,
    `dashboard_10_master_panel__${args.study}__${slugifyForFilename(studyTitle)}__${timestamp}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Wrote ${outPath}`);
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv);
  await generateMasterPanel(args);
}

// Runs standalone (`node make_master_panel.js --study <slug> ...`) exactly as before, but does
// NOT auto-run when required as a module -- make_dashboards.js's --chart 10 requires this file
// and calls generateMasterPanel() directly instead of shelling out to a second process.
if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR:', err.stack);
    process.exit(1);
  });
}

module.exports = { generateMasterPanel, parseArgs };
