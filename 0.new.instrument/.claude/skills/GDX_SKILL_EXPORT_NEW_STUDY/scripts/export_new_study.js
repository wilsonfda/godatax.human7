#!/usr/bin/env node
/**
 * GDX_SKILL_EXPORT_NEW_STUDY
 *
 * Third stage of the "onboard a new instrument" pipeline (see the sibling
 * skills' SKILL.md files):
 *
 *   GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
 *           |
 *           v
 *   GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_* rows exist
 *           |
 *           v
 *   GDX_SKILL_EXPORT_NEW_STUDY   (this skill) -- reads those SAME rows back out of
 *                                    Firebird and writes a blank .xlsx questionnaire
 *                                    to send to participants
 *           |
 *           v
 *   GDX_SKILL_LOAD_NEW_STUDY_ANSWERS -- loads a FILLED copy of that .xlsx back in
 *
 * This script reads (never writes) GDX_PSY_INSTRUMENT / GDX_PSY_INSTRUMENT_ITEM /
 * GDX_PSY_ITEM_ALTERNATIVE for the study named by --study, and produces one
 * .xlsx workbook with:
 *   - a "Participant" sheet (identifying fields the respondent/administrator fills in)
 *   - one sheet per instrument (one row per item, an "Answer" column to fill in,
 *     a dropdown of the item's response alternatives when it has any)
 *   - a hidden "META" sheet carrying the exact GDX_PSY_* ids resolved at export
 *     time (ID_STUDY, ID_INSTRUMENT, ID_ITEM, ID_ALTERNATIVE, ...). This is what
 *     makes the workbook self-contained: GDX_SKILL_LOAD_NEW_STUDY_ANSWERS reads
 *     ids back from META rather than re-resolving names against the database,
 *     so a renamed/emailed/reopened copy of the file still loads correctly, and
 *     never risks matching an item/alternative to the wrong database row.
 *
 * Output filename: GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx
 * (skill name + human-readable study title + the study's slug/code), written
 * next to the intake.json unless --out-dir is given.
 *
 * Usage:
 *   node export_new_study.js --study <slug> [--intake-dir <path>] [--out-dir <dir>]
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const ExcelJS = require('exceljs');

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, outDir: null, excludeItemOrders: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--exclude-item-orders') {
      for (const tok of argv[++i].split(',')) {
        const n = parseInt(tok.trim(), 10);
        if (!Number.isNaN(n)) args.excludeItemOrders.add(n);
      }
    }
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json.'
    );
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env, ` +
      `fill it in, and export the vars before running this script. Never hardcode ` +
      `credentials in this file or anywhere in the repo.`
    );
  }
  return v;
}

/** GDX_HUMAN/0.new.instrument/ itself, resolved relative to this script
 * (0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts) -- the
 * default place the .xlsx is written, so every study's questionnaire lands in
 * one flat, easy-to-find folder instead of buried under its own
 * new_study_intake/<slug>/ subfolder. The output filename already carries the
 * study's title and slug (see outputFileName()), so this stays unambiguous
 * even with many studies' files sitting side by side. --out-dir overrides. */
function resolveDefaultOutDir() {
  return path.join(__dirname, '..', '..', '..', '..');
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts). */
function resolveIntakeDir(args) {
  if (args.intakeDir) return args.intakeDir;
  return path.join(__dirname, '..', '..', '..', '..', 'new_study_intake', args.study);
}

function loadIntake(intakeDir, slug) {
  const intakePath = path.join(intakeDir, 'intake.json');
  if (!fs.existsSync(intakePath)) {
    throw new Error(
      `intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug ` +
      `"${slug}" first (it writes new_study_intake/${slug}/intake.json), or pass ` +
      `--intake-dir if it lives somewhere else.`
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

async function findInstrument(db, name, version) {
  const rows = await query(db, 'SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, INSTRUCTIONS FROM GDX_PSY_INSTRUMENT WHERE NAME = ?', [name]);
  const wanted = version || null;
  return rows.find((r) => (r.VERSION || null) === wanted) || null;
}

/** Sanitizes free text into a safe filename/sheet-name fragment: letters,
 * digits and underscores only, collapsed and trimmed. Never uses hyphens, so
 * it can never be confused with the slug (GDX_SKILL_NEW_STUDY slugs are
 * always lowercase and hyphen-separated) when a human reads the filename. */
function safeNameFragment(text, maxLen) {
  const cleaned = String(text).trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (cleaned || 'study').slice(0, maxLen);
}

/** Output filename: skill name + human-readable study title + the study's
 * slug/code, separated by a double underscore so GDX_SKILL_LOAD_NEW_STUDY_ANSWERS
 * can unambiguously recover the slug even though it treats the internal META
 * sheet, not the filename, as the source of truth for actual database ids. */
function outputFileName(studyTitle, slug) {
  return `GDX_SKILL_EXPORT_NEW_STUDY_${safeNameFragment(studyTitle, 80)}__${slug}.xlsx`;
}

/** Excel sheet names: <=31 chars, no \ / ? * [ ] : , must be unique. Trailing
 * whitespace is trimmed off the truncated result (not just the raw input) --
 * the 31-char cutoff can easily land right after a space, and a sheet name
 * that differs from its own trimmed self broke GDX_SKILL_LOAD_NEW_STUDY_ANSWERS's
 * META-driven lookup (workbook.getWorksheet(name) after cellText()'s trim()
 * no longer matched the untrimmed tab name) -- always keep the actual
 * worksheet name and the one recorded in META byte-for-byte identical. */
function excelSheetName(rawName, index, used) {
  let base = String(rawName).replace(/[\\/?*[\]:]/g, ' ').trim();
  const prefix = `${String(index).padStart(2, '0')} - `;
  let name = (prefix + base).slice(0, 31).trimEnd();
  let suffix = 1;
  while (used.has(name)) {
    const tag = ` (${++suffix})`;
    name = (prefix + base).slice(0, 31 - tag.length).trimEnd() + tag;
  }
  used.add(name);
  return name;
}

async function loadInstrumentItems(db, instrumentId) {
  const items = await query(db,
    'SELECT ID_ITEM, ITEM_ORDER, STATEMENT_TEXT, RESPONSE_TYPE, REQUIRED FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ? ORDER BY ITEM_ORDER',
    [instrumentId]);
  for (const item of items) {
    item.alternatives = await query(db,
      'SELECT ID_ALTERNATIVE, ALTERNATIVE_ORDER, LABEL, NUMERIC_VALUE FROM GDX_PSY_ITEM_ALTERNATIVE WHERE ID_ITEM = ? ORDER BY ALTERNATIVE_ORDER',
      [item.ID_ITEM]);
    const variableRows = await query(db, `
      SELECT v.NAME AS VARIABLE_NAME
      FROM GDX_PSY_INDICATOR_ITEM ii
      JOIN GDX_PSY_INDICATOR i ON i.ID_INDICATOR = ii.ID_INDICATOR
      JOIN GDX_PSY_VARIABLE v ON v.ID_VARIABLE = i.ID_VARIABLE
      WHERE ii.ID_ITEM = ?`, [item.ID_ITEM]);
    item.variableNames = variableRows.map((r) => r.VARIABLE_NAME);
  }
  return items;
}

function buildParticipantSheet(workbook) {
  const ws = workbook.addWorksheet('Participant');
  ws.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value (fill in)', key: 'value', width: 50 },
  ];
  ws.getRow(1).font = { bold: true };
  const rows = [
    ['Full Name', ''],
    ['External Identifier / Code', ''],
    ['Birth Date (YYYY-MM-DD)', ''],
    ['Gender', ''],
    ['Education Level', ''],
    ['Application Date (YYYY-MM-DD, blank = today)', ''],
    ['Consent Given (Y/N)', ''],
  ];
  rows.forEach((r) => ws.addRow(r));
  ws.getColumn('field').font = { bold: true };
  ws.addRow([]);
  ws.addRow(['Notes:', 'External Identifier / Code must be unique per participant. It is used to ' +
    'find or create this person and to record which study they belong to.']);
  return ws;
}

function buildInstrumentSheet(workbook, sheetName, instrument, items) {
  const ws = workbook.addWorksheet(sheetName);
  ws.columns = [
    { header: 'ID_ITEM', key: 'id_item', width: 10 },
    { header: 'Order', key: 'order', width: 8 },
    { header: 'Statement', key: 'statement', width: 80 },
    { header: 'Response Type', key: 'response_type', width: 18 },
    { header: 'Answer (fill in)', key: 'answer', width: 40 },
  ];
  ws.getColumn('id_item').hidden = true;
  ws.getRow(1).font = { bold: true };

  if (instrument.DESCRIPTION || instrument.INSTRUCTIONS) {
    ws.spliceRows(1, 0, []);
    const noteParts = [instrument.DESCRIPTION, instrument.INSTRUCTIONS].filter(Boolean);
    ws.getCell('A1').value = noteParts.join(' -- ');
    ws.mergeCells('A1:E1');
    ws.getRow(1).font = { italic: true };
    ws.getRow(2).font = { bold: true };
  }

  for (const item of items) {
    const row = ws.addRow({
      id_item: item.ID_ITEM,
      order: item.ITEM_ORDER,
      statement: item.STATEMENT_TEXT,
      response_type: item.RESPONSE_TYPE,
      answer: null,
    });
    row.alignment = { wrapText: true, vertical: 'top' };

    if (item.alternatives.length > 0) {
      const labels = item.alternatives.map((a) => a.LABEL);
      const joined = labels.join(',');
      const answerCell = row.getCell('answer');
      if (joined.length <= 250 && !labels.some((l) => l.includes(','))) {
        answerCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${joined}"`],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid answer',
          error: 'Please choose one of the listed options.',
        };
      } else {
        // Too long (or a label contains a comma) for an inline Excel list
        // formula (~255 char limit) -- fall back to a comment listing the
        // valid choices instead of silently dropping validation.
        answerCell.note = `Valid answers: ${joined}`;
      }
    }
  }
  return ws;
}

function buildMetaSheet(workbook, meta) {
  const ws = workbook.addWorksheet('META', { state: 'hidden' });
  ws.addRow(['KEY', 'VALUE']).font = { bold: true };
  ws.addRow(['STUDY_TITLE', meta.studyTitle]);
  ws.addRow(['STUDY_SLUG', meta.slug]);
  ws.addRow(['ID_STUDY', meta.studyId]);
  ws.addRow(['EXPORTED_AT', new Date().toISOString()]);
  if (meta.excludedItemOrders && meta.excludedItemOrders.size > 0) {
    ws.addRow(['EXCLUDED_ITEM_ORDERS', [...meta.excludedItemOrders].sort((a, b) => a - b).join(', ')]);
    ws.addRow(['EXCLUDED_REASON', '--exclude-item-orders was passed at export time (e.g. unresolved/unknown item wording) -- deliberately omitted, not missing data.']);
  }
  ws.addRow([]);

  ws.addRow(['ITEMS']).font = { bold: true };
  const itemsHeader = ['SHEET_NAME', 'ID_INSTRUMENT', 'INSTRUMENT_NAME', 'INSTRUMENT_VERSION',
    'ID_ITEM', 'ITEM_ORDER', 'RESPONSE_TYPE', 'REQUIRED', 'VARIABLE_NAMES'];
  ws.addRow(itemsHeader).font = { bold: true };
  for (const row of meta.itemRows) ws.addRow(row);
  ws.addRow([]);

  ws.addRow(['ALTERNATIVES']).font = { bold: true };
  const altHeader = ['ID_ITEM', 'ALTERNATIVE_ORDER', 'LABEL', 'NUMERIC_VALUE', 'ID_ALTERNATIVE'];
  ws.addRow(altHeader).font = { bold: true };
  for (const row of meta.alternativeRows) ws.addRow(row);
  return ws;
}

async function main() {
  const args = parseArgs(process.argv);
  const intakeDir = resolveIntakeDir(args);
  const intake = loadIntake(intakeDir, args.study);
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
    blobAsText: true, // STATEMENT_TEXT/DESCRIPTION/INSTRUCTIONS are BLOB SUB_TYPE TEXT -- without
    // this, node-firebird returns a blob-fetcher callback instead of a string, and exceljs's own
    // cell-value assignment (and the buildInstrumentSheet note concatenation) throws deep inside
    // its own code ("Cannot read properties of undefined (reading 'richText')") when handed that.
  };

  console.log(`Connecting to ${options.host}:${options.port}${options.database} as ${options.user} ...`);
  const db = await connect(options);
  try {
    const studyRows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
    if (studyRows.length === 0) {
      throw new Error(
        `Study "${studyTitle}" (slug "${args.study}") not found in GDX_PSY_STUDY. Run ` +
        `GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
      );
    }
    const studyId = studyRows[0].ID_STUDY;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GDX_SKILL_EXPORT_NEW_STUDY';
    workbook.created = new Date();

    buildParticipantSheet(workbook);

    const usedSheetNames = new Set(['Participant', 'META']);
    const itemRows = [];
    const alternativeRows = [];
    let index = 0;

    for (const instrumentIntake of intake.instruments) {
      const instRow = await findInstrument(db, instrumentIntake.name, instrumentIntake.version);
      if (!instRow) {
        throw new Error(
          `Instrument "${instrumentIntake.name}"${instrumentIntake.version ? ` (version ${instrumentIntake.version})` : ''} ` +
          `not found in GDX_PSY_INSTRUMENT. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
        );
      }
      let items = await loadInstrumentItems(db, instRow.ID_INSTRUMENT);
      if (args.excludeItemOrders.size > 0) {
        const excluded = items.filter((it) => args.excludeItemOrders.has(it.ITEM_ORDER));
        if (excluded.length > 0) {
          console.log(`Excluding ${excluded.length} item(s) from "${instRow.NAME}" by --exclude-item-orders: ` +
            excluded.map((it) => `order ${it.ITEM_ORDER} (ID_ITEM=${it.ID_ITEM})`).join(', '));
        }
        items = items.filter((it) => !args.excludeItemOrders.has(it.ITEM_ORDER));
      }
      if (items.length === 0) {
        console.log(`WARNING: instrument "${instRow.NAME}" (ID_INSTRUMENT=${instRow.ID_INSTRUMENT}) has no items yet -- skipped.`);
        continue;
      }

      index += 1;
      const sheetName = excelSheetName(instRow.NAME, index, usedSheetNames);
      buildInstrumentSheet(workbook, sheetName, instRow, items);

      for (const item of items) {
        itemRows.push([sheetName, instRow.ID_INSTRUMENT, instRow.NAME, instRow.VERSION || '',
          item.ID_ITEM, item.ITEM_ORDER, item.RESPONSE_TYPE, item.REQUIRED, item.variableNames.join('; ')]);
        for (const alt of item.alternatives) {
          alternativeRows.push([item.ID_ITEM, alt.ALTERNATIVE_ORDER, alt.LABEL, alt.NUMERIC_VALUE, alt.ID_ALTERNATIVE]);
        }
      }
    }

    if (itemRows.length === 0) {
      throw new Error('No instrument had any items -- nothing to export. Run GDX_SKILL_RECORD_NEW_STUDY first.');
    }

    buildMetaSheet(workbook, { studyTitle, slug: args.study, studyId, itemRows, alternativeRows, excludedItemOrders: args.excludeItemOrders });

    const outDir = args.outDir || resolveDefaultOutDir();
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, outputFileName(studyTitle, args.study));
    await workbook.xlsx.writeFile(outPath);

    console.log(`\nWrote ${outPath}`);
    console.log(`  study: "${studyTitle}" (ID_STUDY=${studyId})`);
    console.log(`  instruments exported: ${index}`);
    console.log(`  total items: ${itemRows.length}`);
    console.log('\nDuplicate this file once per participant before sending it out (each participant ' +
      'fills in their own "Participant" sheet and answers), then load each filled copy separately ' +
      'with GDX_SKILL_LOAD_NEW_STUDY_ANSWERS.');
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
