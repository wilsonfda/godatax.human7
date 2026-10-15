#!/usr/bin/env node
/**
 * GDX_SKILL_LIST_ASSOCIATIONS
 *
 * Framework-wide, NOT study-scoped: lists every conceptual/interpretive
 * correspondence GDX_HUMAN currently claims between its different
 * perspectives -- e.g. "chakra N corresponds to septenary level N", "the
 * Five Ways run from septenary level 4 to 6", "psychometric variable X sits
 * at septenary level Y", "variable X's high score reads as virtue Z".
 *
 * These are NOT participant results -- they are catalog/reference rows
 * (or, for Virtology, code) that exist once for the whole framework,
 * independent of any --study. This is the deliberate difference from
 * GDX_SKILL_IDENTIFY_VIRTUES / GDX_SKILL_LINK_SUGGESTIONS, which score one
 * study's participants; this skill inventories the fixed judgment calls
 * those (and other) skills read from.
 *
 * Two source types, both surfaced explicitly because they carry different
 * epistemic weight:
 *   - DB-BACKED: a real row in Firebird, most with a CONFIDENCE_LEVEL
 *     column (HIGH/MEDIUM/LOW/SPECULATIVE) -- GDX_PSY_CHAKRA (no confidence
 *     column, see caveats), GDX_TA_WAY_SEPT_MAP, GDX_PSY_SEPT_LEVEL_PSY_MAP.
 *   - CODE-ONLY: never written to Firebird or Neo4j -- lives only in
 *     12.gdx.virtology's two virtue_knowledge.js copies
 *     (GDX_SKILL_LINK_SUGGESTIONS and GDX_SKILL_IDENTIFY_VIRTUES), with no
 *     confidence field at all.
 *
 * Read-only: never writes to Firebird or Neo4j. Writes one timestamped
 * Markdown report to 14.metaphysical.measuring.instrument/ AND prints it to
 * the screen.
 *
 * Usage:
 *   node list_associations.js [--sample] [--out <path>]
 *
 *   --sample  use embedded synthetic data for the Firebird-backed sections
 *             (no DB connection) -- the code-only virtue section always
 *             reads the real virtue_knowledge.js files, sample or not,
 *             since that source is a local file, not a DB round-trip.
 *   --out     override the default output path (14.metaphysical.measuring.instrument/
 *             Framework_Associations_<timestamp>.md)
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', '..');
const LINK_SUGGESTIONS_VK = path.join(REPO_ROOT, '12.gdx.virtology', '.claude', 'skills', 'GDX_SKILL_LINK_SUGGESTIONS', 'scripts', 'virtue_knowledge.js');
const IDENTIFY_VIRTUES_VK = path.join(REPO_ROOT, '12.gdx.virtology', '.claude', 'skills', 'GDX_SKILL_IDENTIFY_VIRTUES', 'scripts', 'virtue_knowledge.js');

function parseArgs(argv) {
  const args = { sample: false, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export the vars first.`);
  return v;
}

function fbConnect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function fbQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}

// ----------------------------------------------------------------------
// Embedded --sample data -- illustrative only, shaped like the real tables.
// ----------------------------------------------------------------------
const SAMPLE_CHAKRA_ROWS = [
  { ORDER_NUM: 1, SANSKRIT_NAME: 'Muladhara', COMMON_NAME: 'Root Chakra', LEVEL_ORDER: 1, LEVEL_NAME: 'Physical Body', SEPTENARY_LEVEL_JUSTIFICATION: 'Corresponds to the Physical Body (level 1) -- both govern the material/instinctive base of existence' },
  { ORDER_NUM: 7, SANSKRIT_NAME: 'Sahasrara', COMMON_NAME: 'Crown Chakra', LEVEL_ORDER: 7, LEVEL_NAME: 'Atmic Body/Spirit', SEPTENARY_LEVEL_JUSTIFICATION: 'Corresponds to the Atmic Body/Spirit (level 7) -- both represent the top of the ladder of consciousness' },
];
const SAMPLE_WAY_ROWS = [
  { ORDER_NUM: 1, LATIN_NAME: 'Prima Via', ENGLISH_NAME: 'Argument from Motion', LEVEL_ORDER: 4, LEVEL_NAME: 'Lower Mental Body', CORRESPONDENCE_JUSTIFICATION: 'Reasons about concrete, observable change -- practical, this-worldly causal reasoning', CONFIDENCE_LEVEL: 'MEDIUM', NUMBER_CONFIRMATIONS: 1 },
  { ORDER_NUM: 5, LATIN_NAME: 'Quinta Via', ENGLISH_NAME: 'Argument from the Governance of the World', LEVEL_ORDER: 6, LEVEL_NAME: 'Buddhic Body', CORRESPONDENCE_JUSTIFICATION: 'Recognizing purpose/design in nature is an act of grasping meaning beyond mechanical description', CONFIDENCE_LEVEL: 'SPECULATIVE', NUMBER_CONFIRMATIONS: 0 },
];
const SAMPLE_CHAKRA_VAR_ROWS = [
  { ORDER_NUM: 2, SANSKRIT_NAME: 'Svadhisthana', COMMON_NAME: 'Sacral Chakra', INSTRUMENT_LABEL: 'Engagement Scale', VARIABLE_LABEL: 'Vigor -> ENGAGvigor', RECORDED_BEHAVIOR: 'Vital energy invested in an activity', CORRESPONDENCE_JUSTIFICATION: 'Sacral chakra governs vital/creative energy, matching Vigor', CONFIDENCE_LEVEL: 'MEDIUM', NUMBER_CONFIRMATIONS: 1 },
];
const SAMPLE_PSY_SEPT_ROWS = [
  { LEVEL_ORDER: 2, LEVEL_NAME: 'Vital/Etheric Body', INSTRUMENT_LABEL: 'Engagement Scale', VARIABLE_LABEL: 'Vigor -> ENGAGvigor', SAV_COLUMN: 'ENGAGvigor', RECORDED_BEHAVIOR: 'Disposition, energy, willingness to invest effort in studying', CORRESPONDENCE_JUSTIFICATION: 'Vigor is by definition vital energy applied to an activity -- a direct mapping', CONFIDENCE_LEVEL: 'HIGH', NUMBER_CONFIRMATIONS: 1 },
  { LEVEL_ORDER: 7, LEVEL_NAME: 'Atmic Body/Spirit', INSTRUMENT_LABEL: 'Block an1-an11 (undocumented, hypothesis)', VARIABLE_LABEL: 'Personal Fulfillment -> RealizPess', SAV_COLUMN: 'RealizPess', RECORDED_BEHAVIOR: 'Sense of ultimate fulfillment, purpose achieved', CORRESPONDENCE_JUSTIFICATION: 'The name and semantics suggest the highest level of meaning, beyond the abstract mind', CONFIDENCE_LEVEL: 'SPECULATIVE', NUMBER_CONFIRMATIONS: 0 },
];

// ----------------------------------------------------------------------
// Code-only source: the two virtue_knowledge.js copies in 12.gdx.virtology
// ----------------------------------------------------------------------
function loadVirtueKnowledge() {
  const missingFiles = [];
  let linkMap = null;
  let identifyMap = null;

  let virtueByPt = null;
  if (fs.existsSync(LINK_SUGGESTIONS_VK)) {
    const mod = require(LINK_SUGGESTIONS_VK);
    linkMap = mod.VARIABLE_VIRTUE_MAP;
    virtueByPt = mod.virtueByPt;
  } else missingFiles.push(path.relative(REPO_ROOT, LINK_SUGGESTIONS_VK));

  if (fs.existsSync(IDENTIFY_VIRTUES_VK)) {
    const mod = require(IDENTIFY_VIRTUES_VK);
    identifyMap = mod.VARIABLE_VIRTUE_MAP;
    if (!virtueByPt) virtueByPt = mod.virtueByPt;
  } else missingFiles.push(path.relative(REPO_ROOT, IDENTIFY_VIRTUES_VK));

  const allKeys = Array.from(new Set([
    ...(linkMap ? Object.keys(linkMap) : []),
    ...(identifyMap ? Object.keys(identifyMap) : []),
  ])).sort();

  const rows = [];
  const syncIssues = [];

  for (const key of allKeys) {
    const a = linkMap && linkMap[key];   // deficit framing (LINK_SUGGESTIONS)
    const b = identifyMap && identifyMap[key]; // strength framing (IDENTIFY_VIRTUES)

    if (a && !b) syncIssues.push(`\`${key}\`: present in GDX_SKILL_LINK_SUGGESTIONS, missing in GDX_SKILL_IDENTIFY_VIRTUES`);
    if (b && !a) syncIssues.push(`\`${key}\`: present in GDX_SKILL_IDENTIFY_VIRTUES, missing in GDX_SKILL_LINK_SUGGESTIONS`);
    if (a && b) {
      if (a.behavior !== b.behavior) syncIssues.push(`\`${key}\`: "behavior" field diverges between the two copies`);
      if (a.virtue !== b.virtue) syncIssues.push(`\`${key}\`: "virtue" field diverges between the two copies ("${a.virtue}" vs "${b.virtue}")`);
    }

    const primary = a || b;
    const virtueInfo = virtueByPt ? virtueByPt(primary.virtue) : null;
    rows.push({
      savColumn: key,
      behavior: primary.behavior,
      virtue: virtueInfo ? `${virtueInfo.pt} (${virtueInfo.en})` : primary.virtue,
      justificationDeficit: a ? a.justification : null,
      justificationStrength: b ? b.justification : null,
    });
  }

  return { rows, syncIssues, missingFiles };
}

// ----------------------------------------------------------------------
// Firebird-backed sources
// ----------------------------------------------------------------------
async function fetchChakraLinks(fbDb) {
  const rows = await fbQuery(fbDb, `
    SELECT C.ORDER_NUM AS ORDER_NUM, C.SANSKRIT_NAME AS SANSKRIT_NAME, C.COMMON_NAME AS COMMON_NAME,
           L.ORDER_NUM AS LEVEL_ORDER, L.NAME AS LEVEL_NAME, C.SEPTENARY_LEVEL_JUSTIFICATION AS SEPTENARY_LEVEL_JUSTIFICATION
    FROM GDX_PSY_CHAKRA C
    JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = C.ID_SEPTENARY_LEVEL
    ORDER BY C.ORDER_NUM`);
  return rows;
}

async function fetchFiveWaysLinks(fbDb) {
  // Conceptual Way<->Level rows only (the original 5, ID_VARIABLE IS NULL).
  // Rows where a concrete instrument/variable was also attached live in
  // fetchFiveWaysVariableLinks instead (see GDX_SKILL_RECORD_NEW_STUDY-independent
  // ot7_way_map_dml_firebird25.sql, 14.metaphysical.measuring.instrument).
  const rows = await fbQuery(fbDb, `
    SELECT W.ORDER_NUM AS ORDER_NUM, W.LATIN_NAME AS LATIN_NAME, W.ENGLISH_NAME AS ENGLISH_NAME,
           L.ORDER_NUM AS LEVEL_ORDER, L.NAME AS LEVEL_NAME,
           M.CORRESPONDENCE_JUSTIFICATION AS CORRESPONDENCE_JUSTIFICATION, M.CONFIDENCE_LEVEL AS CONFIDENCE_LEVEL,
           M.NUMBER_CONFIRMATIONS AS NUMBER_CONFIRMATIONS
    FROM GDX_TA_WAY_SEPT_MAP M
    JOIN GDX_TA_WAY W ON W.ID_WAY = M.ID_WAY
    JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = M.ID_SEPTENARY_LEVEL
    WHERE M.ID_VARIABLE IS NULL
    ORDER BY W.ORDER_NUM`);
  return rows;
}

async function fetchFiveWaysVariableLinks(fbDb) {
  // Concrete instrument/variable rows attached to GDX_TA_WAY_SEPT_MAP
  // (metaphysical_variable_way_map_firebird25.sql extension) -- e.g. OT-7.
  const rows = await fbQuery(fbDb, `
    SELECT W.ORDER_NUM AS ORDER_NUM, W.LATIN_NAME AS LATIN_NAME, W.ENGLISH_NAME AS ENGLISH_NAME,
           L.ORDER_NUM AS LEVEL_ORDER, L.NAME AS LEVEL_NAME,
           M.INSTRUMENT_LABEL AS INSTRUMENT_LABEL, M.VARIABLE_LABEL AS VARIABLE_LABEL,
           M.RECORDED_BEHAVIOR AS RECORDED_BEHAVIOR, M.CORRESPONDENCE_JUSTIFICATION AS CORRESPONDENCE_JUSTIFICATION,
           M.CONFIDENCE_LEVEL AS CONFIDENCE_LEVEL, M.NUMBER_CONFIRMATIONS AS NUMBER_CONFIRMATIONS
    FROM GDX_TA_WAY_SEPT_MAP M
    JOIN GDX_TA_WAY W ON W.ID_WAY = M.ID_WAY
    JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = M.ID_SEPTENARY_LEVEL
    WHERE M.ID_VARIABLE IS NOT NULL
    ORDER BY W.ORDER_NUM, M.ID_MAPPING`);
  return rows;
}

async function fetchChakraVarLinks(fbDb) {
  // Concrete instrument/variable rows linking a Kundalini Chakra to a
  // psychometric/metaphysical variable (metaphysical_variable_chakra_map_firebird25.sql).
  // Distinct from fetchChakraLinks: that one is the conceptual
  // chakra<->septenary-level table (GDX_PSY_CHAKRA), which has no
  // NUMBER_CONFIRMATIONS column; this one does.
  const rows = await fbQuery(fbDb, `
    SELECT C.ORDER_NUM AS ORDER_NUM, C.SANSKRIT_NAME AS SANSKRIT_NAME, C.COMMON_NAME AS COMMON_NAME,
           M.INSTRUMENT_LABEL AS INSTRUMENT_LABEL, M.VARIABLE_LABEL AS VARIABLE_LABEL,
           M.RECORDED_BEHAVIOR AS RECORDED_BEHAVIOR, M.CORRESPONDENCE_JUSTIFICATION AS CORRESPONDENCE_JUSTIFICATION,
           M.CONFIDENCE_LEVEL AS CONFIDENCE_LEVEL, M.NUMBER_CONFIRMATIONS AS NUMBER_CONFIRMATIONS
    FROM GDX_PSY_CHAKRA_VAR_MAP M
    JOIN GDX_PSY_CHAKRA C ON C.ID_CHAKRA = M.ID_CHAKRA
    ORDER BY C.ORDER_NUM, M.ID_MAPPING`);
  return rows;
}

async function fetchPsySeptenaryLinks(fbDb) {
  const rows = await fbQuery(fbDb, `
    SELECT L.ORDER_NUM AS LEVEL_ORDER, L.NAME AS LEVEL_NAME,
           M.INSTRUMENT_LABEL AS INSTRUMENT_LABEL, M.VARIABLE_LABEL AS VARIABLE_LABEL,
           DV.SAV_COLUMN AS SAV_COLUMN, V.VARIABLE_TYPE AS VARIABLE_TYPE,
           M.RECORDED_BEHAVIOR AS RECORDED_BEHAVIOR, M.CORRESPONDENCE_JUSTIFICATION AS CORRESPONDENCE_JUSTIFICATION,
           M.CONFIDENCE_LEVEL AS CONFIDENCE_LEVEL, M.NUMBER_CONFIRMATIONS AS NUMBER_CONFIRMATIONS
    FROM GDX_PSY_SEPT_LEVEL_PSY_MAP M
    JOIN GDX_PSY_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = M.ID_SEPTENARY_LEVEL
    LEFT JOIN DW_DIM_VARIABLE DV ON DV.ID_VARIABLE = M.ID_VARIABLE
    LEFT JOIN GDX_PSY_VARIABLE V ON V.ID_VARIABLE = M.ID_VARIABLE
    ORDER BY L.ORDER_NUM, M.ID_MAPPING`);
  return rows;
}

// ----------------------------------------------------------------------
// Report
// ----------------------------------------------------------------------
function confidenceCounts(rows, field) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, SPECULATIVE: 0, '(sem campo)': 0 };
  for (const r of rows) {
    const c = r[field];
    if (c && counts[c] !== undefined) counts[c]++;
    else counts['(sem campo)']++;
  }
  return counts;
}

function sumConfirmations(rows) {
  return rows.reduce((total, r) => total + (Number(r.NUMBER_CONFIRMATIONS) || 0), 0);
}

function buildReport({ chakraRows, chakraVarRows, wayRows, wayVarRows, psyRows, virtue, sample, host, timestamp }) {
  const lines = [];

  lines.push('# GDX_HUMAN — Conceptual Associations Between Perspectives');
  lines.push('');
  lines.push(`> Generated ${timestamp} by \`GDX_SKILL_LIST_ASSOCIATIONS\`.`);
  lines.push('> Scope: the whole framework — **not** per study. Every row below is catalog/reference data (or code), the same for any study.');
  lines.push(`> Source: DDL from \`3.septenary.constitution\`, \`4.kundalini.chakras\`, \`5.five.ways.tomas.aquino\`, \`2.relational.model.psychometrics\`, \`7.multidimensional.database\`${sample ? ' — **SAMPLE DATA for the Firebird-backed sections, not a real read**' : ` — live read from ${host}`}, plus the two \`virtue_knowledge.js\` files in \`12.gdx.virtology\` (those never touch Firebird).`);
  lines.push('>');
  lines.push('> **Two kinds of association, by design, never silently mixed:**');
  lines.push('> - **DATABASE (Firebird):** exists as a real table row, most with a `CONFIDENCE_LEVEL` column (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`) filled in by whoever wrote the load.');
  lines.push('> - **CODE:** lives only in `.js` files inside `12.gdx.virtology`\'s skills, was never persisted to Firebird or Neo4j, and has no confidence field at all.');
  lines.push('> This command does not judge whether a correspondence is "correct" — it only lists what has already been decided somewhere in the framework, with the justification that already existed, and flags where the decision has no recorded confidence level.');
  lines.push('');

  // Section 1: Chakras
  lines.push('## 1. Kundalini Chakras ↔ Septenary Constitution');
  lines.push('');
  lines.push(`Source: \`GDX_PSY_CHAKRA\` (4.kundalini.chakras) × \`GDX_PSY_SEPTENARY_LEVEL\` (3.septenary.constitution) — **DATABASE**, ${chakraRows.length} of 7 chakras.`);
  lines.push('');
  lines.push('**Note:** this table has no `CONFIDENCE_LEVEL` column (unlike the following two) — the load script\'s header (`chakras_model_firebird25.sql`) treats the whole correspondence as "symbolic/interpretive, not an empirical finding," with no per-row grade.');
  lines.push('');
  lines.push('| Order | Chakra | Septenary Level | Justification |');
  lines.push('|---|---|---|---|');
  for (const r of chakraRows) {
    lines.push(`| ${r.ORDER_NUM} | ${r.SANSKRIT_NAME} (${r.COMMON_NAME}) | #${r.LEVEL_ORDER} ${r.LEVEL_NAME} | ${(r.SEPTENARY_LEVEL_JUSTIFICATION || '').trim()} |`);
  }
  lines.push('');

  // Section 1b: Metaphysical Variables <-> Chakras (GDX_PSY_CHAKRA_VAR_MAP)
  if (chakraVarRows.length > 0) {
    lines.push('## 1b. Metaphysical Variables ↔ Kundalini Chakras');
    lines.push('');
    lines.push(`Source: \`GDX_PSY_CHAKRA_VAR_MAP\` (14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql) — **DATABASE**, ${chakraVarRows.length} concrete instrument/variable↔chakra correspondence(s).`);
    lines.push('');
    lines.push('| Chakra | Instrument | Variable | What it measures | Confidence | Confirmations | Justification |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of chakraVarRows) {
      lines.push(`| ${r.SANSKRIT_NAME} (${r.COMMON_NAME}) | ${(r.INSTRUMENT_LABEL || '').trim()} | ${(r.VARIABLE_LABEL || '').trim()} | ${(r.RECORDED_BEHAVIOR || '').trim()} | ${r.CONFIDENCE_LEVEL} | ${r.NUMBER_CONFIRMATIONS} | ${(r.CORRESPONDENCE_JUSTIFICATION || '').trim()} |`);
    }
    lines.push('');
    lines.push(`Confirmations total: ${sumConfirmations(chakraVarRows)} (sum of \`NUMBER_CONFIRMATIONS\` across ${chakraVarRows.length} row(s)).`);
    lines.push('');
  }

  // Section 2: Five Ways
  lines.push('## 2. The Five Ways (Aquinas) ↔ Septenary Constitution');
  lines.push('');
  lines.push(`Source: \`GDX_TA_WAY_SEPT_MAP\` (5.five.ways.tomas.aquino) × \`GDX_PSY_SEPTENARY_LEVEL\` — **DATABASE**, ${wayRows.length} of 5 ways.`);
  lines.push('');
  lines.push('| Way | Septenary Level | Confidence | Confirmations | Justification |');
  lines.push('|---|---|---|---|---|');
  for (const r of wayRows) {
    lines.push(`| ${r.ORDER_NUM}. ${r.LATIN_NAME} (${r.ENGLISH_NAME}) | #${r.LEVEL_ORDER} ${r.LEVEL_NAME} | ${r.CONFIDENCE_LEVEL} | ${r.NUMBER_CONFIRMATIONS} | ${(r.CORRESPONDENCE_JUSTIFICATION || '').trim()} |`);
  }
  lines.push('');
  lines.push('**Note:** level 7 (Atmic Body/Spirit) was deliberately left without an associated way — the 5 ways converge on the same conclusion ("this all men call God"), so mapping any way to level 7 would make the relation trivial/uninformative (see the comment in `five_ways_septenary_map_firebird25.sql`).');
  lines.push('');

  const wayConf = confidenceCounts(wayRows, 'CONFIDENCE_LEVEL');
  lines.push(`Confidence distribution: HIGH=${wayConf.HIGH}, MEDIUM=${wayConf.MEDIUM}, LOW=${wayConf.LOW}, SPECULATIVE=${wayConf.SPECULATIVE}. Confirmations total: ${sumConfirmations(wayRows)} (sum of \`NUMBER_CONFIRMATIONS\` across ${wayRows.length} row(s)).`);
  lines.push('');

  // Section 2b: Five Ways <-> concrete metaphysical instrument/variable rows
  if (wayVarRows.length > 0) {
    lines.push('## 2b. Metaphysical Variables ↔ The Five Ways (Aquinas)');
    lines.push('');
    lines.push(`Source: \`GDX_TA_WAY_SEPT_MAP\` (same table as Section 2, extended by \`metaphysical_variable_way_map_firebird25.sql\`) — **DATABASE**, ${wayVarRows.length} concrete instrument/variable↔way correspondence(s), in addition to Section 2's 5 conceptual rows.`);
    lines.push('');
    lines.push('| Way | Septenary Level | Instrument | Variable | What it measures | Confidence | Confirmations | Justification |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const r of wayVarRows) {
      lines.push(`| ${r.ORDER_NUM}. ${r.LATIN_NAME} (${r.ENGLISH_NAME}) | #${r.LEVEL_ORDER} ${r.LEVEL_NAME} | ${(r.INSTRUMENT_LABEL || '').trim()} | ${(r.VARIABLE_LABEL || '').trim()} | ${(r.RECORDED_BEHAVIOR || '').trim()} | ${r.CONFIDENCE_LEVEL} | ${r.NUMBER_CONFIRMATIONS} | ${(r.CORRESPONDENCE_JUSTIFICATION || '').trim()} |`);
    }
    lines.push('');
    lines.push(`Confirmations total: ${sumConfirmations(wayVarRows)} (sum of \`NUMBER_CONFIRMATIONS\` across ${wayVarRows.length} row(s)).`);
    lines.push('');
  }

  // Section 3: Psychometrics <-> Septenary
  lines.push('## 3. Psychometric Variables ↔ Septenary Constitution');
  lines.push('');
  lines.push(`Source: \`GDX_PSY_SEPT_LEVEL_PSY_MAP\` (3.septenary.constitution) × \`GDX_PSY_SEPTENARY_LEVEL\`, cross-referenced with \`DW_DIM_VARIABLE\` (7.multidimensional.database) just to bring in the real \`SAV_COLUMN\` — **DATABASE**, ${psyRows.length} cataloged correspondences.`);
  lines.push('');
  lines.push('| Septenary Level | Instrument | Variable (.sav) | What it measures | Confidence | Confirmations | Justification |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of psyRows) {
    const sav = r.SAV_COLUMN
      ? `\`${r.SAV_COLUMN}\``
      : (r.VARIABLE_TYPE === 'METAPHYSICS' ? '— (metaphysical instrument, no .sav)' : '— (not yet reconciled with the catalog)');
    lines.push(`| #${r.LEVEL_ORDER} ${r.LEVEL_NAME} | ${(r.INSTRUMENT_LABEL || '').trim()} | ${sav} | ${(r.RECORDED_BEHAVIOR || '').trim()} | ${r.CONFIDENCE_LEVEL} | ${r.NUMBER_CONFIRMATIONS} | ${(r.CORRESPONDENCE_JUSTIFICATION || '').trim()} |`);
  }
  lines.push('');
  const psyConf = confidenceCounts(psyRows, 'CONFIDENCE_LEVEL');
  lines.push(`Confidence distribution: HIGH=${psyConf.HIGH}, MEDIUM=${psyConf.MEDIUM}, LOW=${psyConf.LOW}, SPECULATIVE=${psyConf.SPECULATIVE}. Confirmations total: ${sumConfirmations(psyRows)} (sum of \`NUMBER_CONFIRMATIONS\` across ${psyRows.length} row(s)).`);
  lines.push('');

  // Section 4: Psychometrics <-> Virtology (CODE-ONLY)
  lines.push('## 4. Psychometric Variables ↔ Virtues (Virtology) — CODE, not Database');
  lines.push('');
  lines.push('Source: `virtue_knowledge.js`, duplicated (by design) in `12.gdx.virtology/.claude/skills/GDX_SKILL_LINK_SUGGESTIONS/scripts/` and `.../GDX_SKILL_IDENTIFY_VIRTUES/scripts/` — **CODE, never written to Firebird or Neo4j**. No confidence column: `HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE` is implicit nowhere, unlike the three sections above.');
  lines.push('');
  lines.push('For each variable, the same virtue association is used in both skills — only the `justification` changes meaning: **deficit/antidote** (low score, `GDX_SKILL_LINK_SUGGESTIONS`) vs. **strength already present** (high score, `GDX_SKILL_IDENTIFY_VIRTUES`). When the same variable also appears in Section 3, its septenary level is shown — the only point in the framework where all three perspectives (Septenary, Psychometrics, Virtology) meet on the same row.');
  lines.push('');
  lines.push('| Variable (.sav) | What it measures | Septenary Level (Section 3) | Virtue | Justification (deficit → antidote) | Justification (strength → already present) |');
  lines.push('|---|---|---|---|---|---|');
  const psyBySav = new Map(psyRows.filter((r) => r.SAV_COLUMN).map((r) => [r.SAV_COLUMN, r]));
  for (const r of virtue.rows) {
    const linked = psyBySav.get(r.savColumn);
    const levelCell = linked ? `#${linked.LEVEL_ORDER} ${linked.LEVEL_NAME}` : '— (no matching row in Section 3)';
    lines.push(`| \`${r.savColumn}\` | ${r.behavior} | ${levelCell} | ${r.virtue} | ${r.justificationDeficit || '—'} | ${r.justificationStrength || '—'} |`);
  }
  lines.push('');

  if (virtue.missingFiles.length > 0) {
    lines.push(`**Warning:** could not read ${virtue.missingFiles.length} knowledge file(s): ${virtue.missingFiles.map((f) => `\`${f}\``).join(', ')}.`);
    lines.push('');
  }
  lines.push(virtue.syncIssues.length === 0
    ? '**Sync check:** the two `virtue_knowledge.js` copies agree on every variable (`behavior` and `virtue` identical) — only the justification prose differs, as intended by design.'
    : `**Sync check — ${virtue.syncIssues.length} divergence(s) found:**\n\n${virtue.syncIssues.map((s) => `- ${s}`).join('\n')}`);
  lines.push('');

  // Section 5: gaps
  lines.push('## 5. Perspectives With No Conceptual Association Recorded Yet');
  lines.push('');
  lines.push('- **6.cardiac.coherence:** no table or column links `GDX_CC_*` to `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`, or to the virtues. The only existing link (`GDX_CC_PERSON.ID_PERSON -> DW_DIM_PERSON.ID_PERSON`) is person identity across modules, not a conceptual correspondence between perspectives.');
  lines.push('- **Virtology (12.gdx.virtology) ↔ Septenary Constitution / Chakras / Five Ways:** there is no direct association between a virtue and a septenary level/chakra/way — the only bridge today runs through the psychometric variable (Section 4), and only when that same variable is also in Section 3.');
  lines.push('- **Psychometric variables with no virtue:** any `SAV_COLUMN` that appears in Section 3 but not in `virtue_knowledge.js` has no virtue associated — this is reported by `GDX_SKILL_IDENTIFY_VIRTUES`/`GDX_SKILL_LINK_SUGGESTIONS` as "no virtue identified (review)" when that variable\'s score lands in the top/bottom of the ranking, not listed here row by row.');
  lines.push('');

  // Summary
  const totalDb = chakraRows.length + chakraVarRows.length + wayRows.length + wayVarRows.length + psyRows.length;
  const totalConfirmations = sumConfirmations(chakraVarRows) + sumConfirmations(wayRows) + sumConfirmations(wayVarRows) + sumConfirmations(psyRows);
  lines.push('## Summary');
  lines.push('');
  lines.push('| Perspective pair | # of associations | Confirmations | Where it lives |');
  lines.push('|---|---|---|---|');
  lines.push(`| Chakras ↔ Septenary Constitution | ${chakraRows.length} | — (no \`NUMBER_CONFIRMATIONS\` column) | Firebird — \`GDX_PSY_CHAKRA\` |`);
  if (chakraVarRows.length > 0) {
    lines.push(`| Metaphysical Variables ↔ Chakras | ${chakraVarRows.length} | ${sumConfirmations(chakraVarRows)} | Firebird — \`GDX_PSY_CHAKRA_VAR_MAP\` |`);
  }
  lines.push(`| Five Ways ↔ Septenary Constitution | ${wayRows.length} | ${sumConfirmations(wayRows)} | Firebird — \`GDX_TA_WAY_SEPT_MAP\` |`);
  if (wayVarRows.length > 0) {
    lines.push(`| Metaphysical Variables ↔ Five Ways | ${wayVarRows.length} | ${sumConfirmations(wayVarRows)} | Firebird — \`GDX_TA_WAY_SEPT_MAP\` |`);
  }
  lines.push(`| Psychometrics ↔ Septenary Constitution | ${psyRows.length} | ${sumConfirmations(psyRows)} | Firebird — \`GDX_PSY_SEPT_LEVEL_PSY_MAP\` |`);
  lines.push(`| Psychometrics ↔ Virtues (Virtology) | ${virtue.rows.length} | — (code-only, no confirmations column) | Code — \`virtue_knowledge.js\` (×2 copies) |`);
  lines.push(`| **Total cataloged associations** | **${totalDb + virtue.rows.length}** | **${totalConfirmations}** | ${totalDb} in the database + ${virtue.rows.length} in code only |`);
  lines.push('');

  lines.push('## Caveats');
  lines.push('');
  lines.push('1. None of the associations here is a statistical or empirical finding — all are interpretive judgments recorded by whoever wrote the load (Firebird) or the file (code), with the same methodological honesty standard as `SPSS_Septenary_Constitution_Mapping.md`.');
  lines.push('2. The three Firebird tables don\'t share the same rigor: only `GDX_TA_WAY_SEPT_MAP` and `GDX_PSY_SEPT_LEVEL_PSY_MAP` have a per-row `CONFIDENCE_LEVEL`; `GDX_PSY_CHAKRA` has none.');
  lines.push('3. The Virtue association never went through a "capture knowledge → design schema → load into the database" step like the others — it remains code-only, manually duplicated across two skills.');
  lines.push('4. This command is read-only: it never writes to Firebird or Neo4j. The generated `.md` file is the only side effect.');
  lines.push('5. `NUMBER_CONFIRMATIONS` (added by `confirmation_fields_association_maps_firebird25.sql`) counts independent corroborations of a correspondence, separate from `CONFIDENCE_LEVEL` (a self-assessed label). It exists on `GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_CHAKRA_VAR_MAP`, and `GDX_TA_WAY_SEPT_MAP` only — not on `GDX_PSY_CHAKRA`.');

  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date();
  const timestamp = now.toISOString();

  let chakraRows;
  let chakraVarRows;
  let wayRows;
  let wayVarRows;
  let psyRows;
  let host = null;

  if (args.sample) {
    console.log('[SAMPLE] using embedded synthetic data for the Firebird-backed sections -- no DB connection.');
    chakraRows = SAMPLE_CHAKRA_ROWS;
    chakraVarRows = SAMPLE_CHAKRA_VAR_ROWS;
    wayRows = SAMPLE_WAY_ROWS;
    wayVarRows = [];
    psyRows = SAMPLE_PSY_SEPT_ROWS;
  } else {
    const fbOptions = {
      host: requireEnv('GDX_HUMAN_FB_HOST'),
      port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
      database: requireEnv('GDX_HUMAN_FB_DATABASE'),
      user: requireEnv('GDX_HUMAN_FB_USER'),
      password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
      lowercase_keys: false,
      blobAsText: true,
    };
    host = fbOptions.host;
    console.log(`Connecting to Firebird ${fbOptions.host}:${fbOptions.port}${fbOptions.database} ...`);
    const fbDb = await fbConnect(fbOptions);
    try {
      chakraRows = await fetchChakraLinks(fbDb);
      chakraVarRows = await fetchChakraVarLinks(fbDb);
      wayRows = await fetchFiveWaysLinks(fbDb);
      wayVarRows = await fetchFiveWaysVariableLinks(fbDb);
      psyRows = await fetchPsySeptenaryLinks(fbDb);
    } finally {
      fbDb.detach();
    }
  }

  const virtue = loadVirtueKnowledge();

  const report = buildReport({ chakraRows, chakraVarRows, wayRows, wayVarRows, psyRows, virtue, sample: args.sample, host, timestamp });

  const outPath = args.out
    ? path.resolve(args.out)
    : path.join(OUTPUT_DIR, `Framework_Associations_${timestamp.replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')}.md`);
  fs.writeFileSync(outPath, report, 'utf8');

  console.log('\n' + report);
  console.log(`\nReport written to ${outPath}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
