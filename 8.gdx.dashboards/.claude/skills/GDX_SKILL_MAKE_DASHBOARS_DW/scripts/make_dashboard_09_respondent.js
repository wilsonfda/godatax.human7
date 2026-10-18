#!/usr/bin/env node
/**
 * dashboard_09_virtue_respondent_profile -- GDX_H7ph_Plan_Study_Humility_in_Metaphysics.md Phase 7b.
 *
 * The 9 charts in make_dashboards.js are all AGGREGATE averages across a study's whole population.
 * This is the first PER-RESPONDENT dashboard: one page per participant, showing their own raw
 * answers (not just their contribution to a mean), their own subscale scores next to the study
 * group's mean/range for the same variable, the virtue this instrument is associated with
 * (GDX_VT_VARIABLE_VIRTUE_MAP), and an explicit, honest statement of whether an individual
 * EFA/CFA factor score exists for them yet (it does not for a study this small -- see
 * GDX_SKILL_MAKE_ANALYSES_CFA_EFA's n>=items+1 requirement -- so this never fabricates one).
 *
 * Usage:
 *   node make_dashboard_09_respondent.js --study <slug> [--person <id-or-name-substring>] [--out-dir <dir>]
 *
 *   --study <slug>   REQUIRED. Same slug used by every other Phase-7 skill.
 *   --person <...>   optional. A GDX_PSY_PERSON.ID_PERSON (numeric) or a case-insensitive substring
 *                     of NAME. Omit to generate ONE file per participant this study actually has
 *                     (GDX_PSY_STUDY_PARTICIPANT), in one run -- the common case right after loading
 *                     a batch of filled-in questionnaires.
 *
 * Output filename, same pattern as the other 9: dashboard_09_virtue_respondent_profile__<slug>__
 *   <study-title-slug>__<person-slug>__<timestamp>.html -- a person-slug segment is appended (the
 *   other 9 are aggregate, one file per study; this one is one file per PERSON, so the filename must
 *   disambiguate, or two participants' pages would collide).
 *
 * Connection: entirely from environment variables (see ../.env.example). Never hardcode credentials.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { pageShell, esc, niceTicks, PALETTE } = require('./chart_lib');

function parseArgs(argv) {
  const args = { study: null, person: null, outDir: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--person') args.person = argv[++i];
    else if (argv[i] === '--out-dir') args.outDir = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error('--study <slug> is required -- same slug GDX_SKILL_NEW_STUDY used for new_study_intake/<slug>/intake.json.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy ../.env.example to ../.env and fill it in.`);
  return v;
}

function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}

/** Resolves ONE BLOB SUB_TYPE TEXT field on an already-fetched row to a plain string, via
 * node-firebird's event-emitter blob API -- NOT `blobAsText: true` (deliberately never set on this
 * connection). Reproduced directly: blobAsText's own auto-resolution (connection.js's
 * fetch_blob_async_transaction, opening one extra implicit transaction per blob and resolving all
 * of them concurrently via Promise.all before the query callback fires) hangs indefinitely once
 * more than a handful of blob rows are involved -- a real concurrency bug in that code path, not a
 * SQL problem. Fetching each blob manually like this, one at a time (never with Promise.all across
 * rows), has been reliable across repeated runs where blobAsText was not. */
function fetchBlobText(row, field) {
  return new Promise((resolve, reject) => {
    const value = row[field];
    if (typeof value !== 'function') { resolve(value); return; } // already null or already a string
    value((err, name, emitter) => {
      if (err) return reject(err);
      let text = '';
      emitter.on('data', (chunk) => { text += chunk.toString('utf8'); });
      emitter.on('end', () => resolve(text));
      emitter.on('error', reject);
    });
  });
}

function slugifyForFilename(str) {
  return String(str).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}
function timestampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function round2(n) { return n === null || n === undefined ? null : Math.round(n * 100) / 100; }

function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..', '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
  const p = resolveIntakePath(args);
  if (!fs.existsSync(p)) throw new Error(`intake.json not found at ${p}. Run GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY first.`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  return rows[0].ID_STUDY;
}

async function resolveParticipants(db, studyId, personArg) {
  const rows = await query(db, `
    SELECT P.ID_PERSON, P.NAME
    FROM GDX_PSY_STUDY_PARTICIPANT SP
    JOIN GDX_PSY_PERSON P ON P.ID_PERSON = SP.ID_PERSON
    WHERE SP.ID_STUDY = ?
    ORDER BY P.ID_PERSON`, [studyId]);
  if (!personArg) return rows;
  const asId = parseInt(personArg, 10);
  if (!Number.isNaN(asId) && String(asId) === personArg.trim()) {
    const match = rows.find((r) => r.ID_PERSON === asId);
    if (!match) throw new Error(`ID_PERSON=${asId} is not a participant of this study (ID_STUDY=${studyId}).`);
    return [match];
  }
  const needle = personArg.trim().toLowerCase();
  const matches = rows.filter((r) => r.NAME.toLowerCase().includes(needle));
  if (matches.length === 0) throw new Error(`No participant of this study has a NAME containing "${personArg}". Participants: ${rows.map((r) => `${r.ID_PERSON}:${r.NAME}`).join(', ')}`);
  if (matches.length > 1) throw new Error(`"${personArg}" matches ${matches.length} participants, pick one by --person <ID_PERSON>: ${matches.map((r) => `${r.ID_PERSON}:${r.NAME}`).join(', ')}`);
  return matches;
}

/** This study's instrument(s), via GDX_PSY_ITEM_RESPONSE (reliable even for a legacy "umbrella
 * application" study -- see make_dashboards.js's loadMeansPsychometricData() for why). */
async function resolveInstruments(db, studyId) {
  return query(db, `
    SELECT DISTINCT I.ID_INSTRUMENT, I.NAME
    FROM GDX_PSY_INSTRUMENT I
    JOIN GDX_PSY_INSTRUMENT_ITEM II ON II.ID_INSTRUMENT = I.ID_INSTRUMENT
    JOIN GDX_PSY_ITEM_RESPONSE IR ON IR.ID_ITEM = II.ID_ITEM
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = IR.ID_APPLICATION
    WHERE A.ID_STUDY = ?
    ORDER BY I.ID_INSTRUMENT`, [studyId]);
}

async function resolveVariables(db, instrumentIds) {
  if (instrumentIds.length === 0) return [];
  const placeholders = instrumentIds.map(() => '?').join(',');
  return query(db, `
    SELECT DISTINCT V.ID_VARIABLE, V.NAME, L.ORDER_NUM AS SEPT_LEVEL_ORDER, L.NAME AS SEPT_LEVEL_NAME
    FROM GDX_PSY_VARIABLE V
    JOIN GDX_PSY_INDICATOR IND ON IND.ID_VARIABLE = V.ID_VARIABLE
    JOIN GDX_PSY_INDICATOR_ITEM II2 ON II2.ID_INDICATOR = IND.ID_INDICATOR
    JOIN GDX_PSY_INSTRUMENT_ITEM IT ON IT.ID_ITEM = II2.ID_ITEM
    LEFT JOIN GDX_PSY_SEPT_LEVEL_PSY_MAP SLPM ON SLPM.ID_VARIABLE = V.ID_VARIABLE
    LEFT JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = SLPM.ID_SEPTENARY_LEVEL
    WHERE IT.ID_INSTRUMENT IN (${placeholders})
    ORDER BY V.ID_VARIABLE`, instrumentIds);
}

async function resolveVirtues(db, variableIds) {
  if (variableIds.length === 0) return [];
  const placeholders = variableIds.map(() => '?').join(',');
  return query(db, `
    SELECT DISTINCT VT.ID_VIRTUE, VT.NAME_PT, VT.NAME_EN
    FROM GDX_VT_VARIABLE_VIRTUE_MAP M
    JOIN GDX_VT_VIRTUE VT ON VT.ID_VIRTUE = M.ID_VIRTUE
    WHERE M.ID_VARIABLE IN (${placeholders})`, variableIds);
}

async function loadGroupStats(db, studyId) {
  const rows = await query(db, `
    SELECT VR.ID_VARIABLE, AVG(VR.RAW_SCORE) AS AVG_SCORE, MIN(VR.RAW_SCORE) AS MIN_SCORE, MAX(VR.RAW_SCORE) AS MAX_SCORE, COUNT(*) AS N
    FROM GDX_PSY_VARIABLE_RESULT VR
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ?
    GROUP BY VR.ID_VARIABLE`, [studyId]);
  return new Map(rows.map((r) => [r.ID_VARIABLE, r]));
}

async function loadPersonScores(db, studyId, personId) {
  const rows = await query(db, `
    SELECT VR.ID_VARIABLE, VR.RAW_SCORE
    FROM GDX_PSY_VARIABLE_RESULT VR
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ? AND A.ID_PERSON = ?`, [studyId, personId]);
  return new Map(rows.map((r) => [r.ID_VARIABLE, r.RAW_SCORE]));
}

/** Item statement text (STATEMENT_TEXT is a BLOB SUB_TYPE TEXT column), filtered to just this
 * study's own instrument(s), resolved one row at a time via fetchBlobText -- see that function's
 * comment for why. Keyed by the globally-unique ID_ITEM (not ITEM_ORDER, which only disambiguates
 * within one instrument). */
async function resolveItemStatements(db, instrumentIds) {
  const placeholders = instrumentIds.map(() => '?').join(',');
  const rows = await query(db, `
    SELECT ID_ITEM, STATEMENT_TEXT FROM GDX_PSY_INSTRUMENT_ITEM
    WHERE ID_INSTRUMENT IN (${placeholders})`, instrumentIds);
  const map = new Map();
  for (const r of rows) {
    map.set(r.ID_ITEM, await fetchBlobText(r, 'STATEMENT_TEXT'));
  }
  return map;
}

async function loadPersonAnswers(db, studyId, personId) {
  // TEXT_VALUE is deliberately not selected here -- also a BLOB SUB_TYPE TEXT column (see
  // resolveItemStatements' comment), and always NULL for this instrument anyway (every item here
  // has response alternatives, so GDX_SKILL_LOAD_NEW_STUDY_ANSWERS only ever sets NUMERIC_VALUE +
  // ID_ALTERNATIVE for it, never TEXT_VALUE -- that column is for free-text items without
  // alternatives, which this instrument has none of).
  return query(db, `
    SELECT II.ID_ITEM, II.ITEM_ORDER, II.RESPONSE_TYPE,
           ALT.LABEL AS ALT_LABEL, IR.NUMERIC_VALUE,
           V.ID_VARIABLE, V.NAME AS VARIABLE_NAME, INDI.REVERSED
    FROM GDX_PSY_ITEM_RESPONSE IR
    JOIN GDX_PSY_INSTRUMENT_ITEM II ON II.ID_ITEM = IR.ID_ITEM
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = IR.ID_APPLICATION
    LEFT JOIN GDX_PSY_ITEM_ALTERNATIVE ALT ON ALT.ID_ALTERNATIVE = IR.ID_ALTERNATIVE
    LEFT JOIN GDX_PSY_INDICATOR_ITEM INDI ON INDI.ID_ITEM = II.ID_ITEM
    LEFT JOIN GDX_PSY_INDICATOR IND ON IND.ID_INDICATOR = INDI.ID_INDICATOR
    LEFT JOIN GDX_PSY_VARIABLE V ON V.ID_VARIABLE = IND.ID_VARIABLE
    WHERE A.ID_STUDY = ? AND A.ID_PERSON = ?
    ORDER BY II.ITEM_ORDER`, [studyId, personId]);
}

/** Bars for this person's own scores, with a secondary tick mark at the group mean and a thin
 * whisker spanning the group's [min,max] for the same variable -- the honest stand-in for "how
 * they sit relative to Phase 4's EFA/CFA result" when no EFA/CFA factor score exists yet (see
 * efaCaveat in main()): a real factor score needs a fitted model; a group-relative raw-score
 * comparison needs only the scores already in hand. */
function buildScoreComparisonSvg({ variables, personScores, groupStats }) {
  const W = 900, H = 420, marginL = 70, marginR = 24, marginT = 20, marginB = 80;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const color = PALETTE.categorical.light[0];
  const groupColor = PALETTE.categorical.light[1];

  const allVals = [];
  variables.forEach((v) => {
    const own = personScores.get(v.ID_VARIABLE);
    const g = groupStats.get(v.ID_VARIABLE);
    if (own !== undefined && own !== null) allVals.push(own);
    if (g) { allVals.push(g.MIN_SCORE); allVals.push(g.MAX_SCORE); }
  });
  const ticks = niceTicks(Math.min(0, ...allVals), Math.max(...allVals), 5);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const yAt = (v) => marginT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const gap = 0.35;
  const bandW = plotW / variables.length;
  const barW = bandW * (1 - gap);

  const gridSvg = ticks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t)}" y2="${yAt(t)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${yAt(t) + 4}" text-anchor="end">${t}</text>`).join('\n');

  let barsSvg = '';
  variables.forEach((v, i) => {
    const x = marginL + i * bandW + (bandW - barW) / 2;
    const own = personScores.get(v.ID_VARIABLE);
    const g = groupStats.get(v.ID_VARIABLE);
    const labelX = x + barW / 2;
    if (own !== undefined && own !== null) {
      const y = yAt(Math.max(0, own));
      const h = Math.abs(yAt(0) - yAt(own));
      barsSvg += `<rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${color}"
          data-tip="<strong>${esc(v.NAME)}</strong><br>this respondent: ${round2(own)}${g ? `<br>group mean: ${round2(g.AVG_SCORE)} (n=${g.N})<br>group range: ${round2(g.MIN_SCORE)}&ndash;${round2(g.MAX_SCORE)}` : ''}"></rect>
        <text class="axis-label" x="${labelX}" y="${y - 8}" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">${round2(own)}</text>`;
    }
    if (g) {
      const yMean = yAt(g.AVG_SCORE);
      barsSvg += `<line x1="${x - 6}" x2="${x + barW + 6}" y1="${yMean}" y2="${yMean}" stroke="${groupColor}" stroke-width="2" stroke-dasharray="4,2"/>`;
      if (g.MIN_SCORE !== g.MAX_SCORE) {
        const yLo = yAt(g.MIN_SCORE), yHi = yAt(g.MAX_SCORE);
        barsSvg += `<line x1="${labelX}" x2="${labelX}" y1="${yHi}" y2="${yLo}" stroke="${groupColor}" stroke-width="1.5"/>`;
      }
    }
    barsSvg += `<text class="axis-label" x="${labelX}" y="${H - marginB + 20}" text-anchor="middle">${esc(v.NAME.replace(/ \(.*\)$/, ''))}</text>`;
  });

  const legend = `<div class="legend">
    <div class="legend-item"><span class="legend-swatch" style="background:${color}"></span>This respondent's raw score</div>
    <div class="legend-item"><span class="legend-swatch" style="background:${groupColor}"></span>Study group mean (dashed) and min&ndash;max range (vertical bar)</div>
  </div>`;

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score comparison">
      ${gridSvg}
      <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${yAt(0)}" y2="${yAt(0)}"/>
      ${barsSvg}
      <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">Raw score (sum of subscale items)</text>
    </svg>
    ${legend}`;
}

function buildAnswersTable(answers, itemStatements) {
  const rows = answers.map((a) => {
    const answerText = a.ALT_LABEL || '—';
    const numeric = a.NUMERIC_VALUE === null || a.NUMERIC_VALUE === undefined ? '—' : a.NUMERIC_VALUE;
    const reversed = a.REVERSED === 1 || a.REVERSED === '1' ? 'Yes' : 'No';
    const statementText = itemStatements.get(a.ID_ITEM) || '—';
    return `<tr>
      <td>${a.ITEM_ORDER}</td>
      <td>${esc(statementText)}</td>
      <td>${esc(a.VARIABLE_NAME ? a.VARIABLE_NAME.replace(/ \(.*\)$/, '') : '—')}</td>
      <td>${reversed}</td>
      <td>${esc(String(answerText))}</td>
      <td>${esc(String(numeric))}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table visible" style="margin-top:20px">
    <thead><tr><th>#</th><th>Statement</th><th>Subscale</th><th>Reversed?</th><th>Answer</th><th>Numeric value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPersonPage({ studyTitle, instrumentNames, virtues, person, variables, personScores, groupStats, answers, itemStatements, sampleSize }) {
  const virtueText = virtues.length > 0
    ? virtues.map((v) => `${esc(v.NAME_PT)}${v.NAME_EN ? ` (${esc(v.NAME_EN)})` : ''}`).join(', ')
    : 'no virtue associated with this instrument yet';

  const efaCaveat = sampleSize < 23
    ? `<p style="background:var(--grid);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--ink-secondary);">
        <strong>No individual factor score is shown.</strong> This study has n=${sampleSize} respondent(s) for a
        22-item instrument -- EFA/CFA need at least 23 to fit a non-singular covariance matrix
        (see <code>GDX_SKILL_MAKE_ANALYSES_CFA_EFA</code>'s own refusal message). The chart below compares this
        respondent's raw subscale scores against the study group's own mean/range instead -- a real
        comparison that needs no fitted model, not a substitute for one.</p>`
    : `<p style="font-size:13px;color:var(--ink-secondary);">An individual factor score may be available once ` +
      `<code>GDX_SKILL_MAKE_ANALYSES_CFA_EFA</code> has been re-run for this study (n=${sampleSize}) -- check its ` +
      `latest output before trusting a figure that is not shown here yet.</p>`;

  const scoreTableRows = variables.map((v) => {
    const own = personScores.get(v.ID_VARIABLE);
    const g = groupStats.get(v.ID_VARIABLE);
    return `<tr>
      <td>${esc(v.NAME)}</td>
      <td>${esc(v.SEPT_LEVEL_NAME || '—')}</td>
      <td>${own === undefined || own === null ? '—' : round2(own)}</td>
      <td>${g ? round2(g.AVG_SCORE) : '—'}</td>
      <td>${g ? `${round2(g.MIN_SCORE)}&ndash;${round2(g.MAX_SCORE)}` : '—'}</td>
      <td>${g ? g.N : 0}</td>
    </tr>`;
  }).join('');

  const bodyHtml = `
    <p style="font-size:14px;"><strong>Study:</strong> ${esc(studyTitle)} &nbsp;|&nbsp;
      <strong>Instrument(s):</strong> ${esc(instrumentNames.join(', '))} &nbsp;|&nbsp;
      <strong>Virtue:</strong> ${virtueText}</p>
    <h2 style="font-size:16px;margin:4px 0 12px;">Respondent: ${esc(person.NAME)} (ID_PERSON=${person.ID_PERSON})</h2>
    ${buildScoreComparisonSvg({ variables, personScores, groupStats })}
    <table class="data-table visible" style="margin-top:16px">
      <thead><tr><th>Subscale</th><th>Septenary level</th><th>This respondent</th><th>Group mean</th><th>Group range</th><th>Group N</th></tr></thead>
      <tbody>${scoreTableRows}</tbody>
    </table>
    ${efaCaveat}
    <h3 style="font-size:14px;margin:20px 0 4px;">Item-by-item answers (${answers.length} items)</h3>
    ${buildAnswersTable(answers, itemStatements)}
  `;

  return pageShell({
    title: `Virtue Respondent Profile: ${person.NAME}`,
    description: `Individual answers and subscale scores for ${esc(person.NAME)} in study "${esc(studyTitle)}" -- ` +
      `generated by <code>GDX_SKILL_MAKE_DASHBOARD_VIRTUE_RESPONDENT</code> (dashboard 09). Every other dashboard ` +
      `in this set (00-08) shows population averages; this is the per-respondent counterpart.`,
    favicon: '🙇',
    bodyHtml,
  });
}

async function main() {
  const args = parseArgs(process.argv);
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
    // blobAsText deliberately NOT set here -- see fetchBlobText's own comment.
  };
  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const studyId = await resolveStudyId(db, studyTitle, args.study);
    const participants = await resolveParticipants(db, studyId, args.person);
    const instruments = await resolveInstruments(db, studyId);
    const itemStatements = await resolveItemStatements(db, instruments.map((i) => i.ID_INSTRUMENT));
    const variables = await resolveVariables(db, instruments.map((i) => i.ID_INSTRUMENT));
    const virtues = await resolveVirtues(db, variables.map((v) => v.ID_VARIABLE));
    const groupStats = await loadGroupStats(db, studyId);
    const sampleSize = participants.length > 0 ? Math.max(...[...groupStats.values()].map((g) => g.N), 0) : 0;

    console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}): ${instruments.length} instrument(s), ${variables.length} variable(s), ` +
      `${participants.length} participant(s) to generate (${args.person ? 'filtered by --person' : 'all'}).`);

    const outDir = args.outDir || path.join(__dirname, '..', '..', '..', '..');
    fs.mkdirSync(outDir, { recursive: true });
    const timestamp = timestampForFilename(new Date());

    for (const person of participants) {
      const personScores = await loadPersonScores(db, studyId, person.ID_PERSON);
      const answers = await loadPersonAnswers(db, studyId, person.ID_PERSON);
      const html = buildPersonPage({
        studyTitle, instrumentNames: instruments.map((i) => i.NAME), virtues, person, variables, itemStatements,
        personScores, groupStats, answers, sampleSize,
      });
      const filename = `dashboard_09_virtue_respondent_profile__${args.study}__${slugifyForFilename(studyTitle)}__` +
        `${slugifyForFilename(person.NAME)}__${timestamp}.html`;
      const outPath = path.join(outDir, filename);
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`Wrote ${outPath}`);
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
