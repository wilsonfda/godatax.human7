#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_NEW_STUDY_ANSWERS
 *
 * Fourth stage of the "onboard a new instrument" pipeline:
 *
 *   GDX_SKILL_NEW_STUDY / GDX_SKILL_RECORD_NEW_STUDY / GDX_SKILL_EXPORT_NEW_STUDY
 *           |
 *           v
 *   GDX_SKILL_LOAD_NEW_STUDY_ANSWERS  (this skill) -- loads ONE filled copy of the
 *                                        .xlsx GDX_SKILL_EXPORT_NEW_STUDY produced
 *                                        back into Firebird
 *
 * Reads --file <path>, a filled-in copy of
 * GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx (skill name + study title +
 * study slug/code in the filename, per that skill's naming convention), and writes:
 *
 *   GDX_PSY_PERSON             -- found by EXTERNAL_IDENTIFIER, inserted if new
 *   GDX_PSY_STUDY_PARTICIPANT  -- found by (ID_STUDY, ID_PERSON), inserted if new
 *   GDX_PSY_APPLICATION        -- one per instrument sheet that has any answer
 *   GDX_PSY_ITEM_RESPONSE      -- one per answered item
 *
 * This is the full FK chain GDX_PSY_ITEM_RESPONSE needs to be valid -- see
 * psychometrics_model_firebird25.sql. Computing GDX_PSY_VARIABLE_RESULT /
 * GDX_PSY_CONSTRUCT_RESULT / GDX_PSY_INDICATOR_RESULT (derived scores) is
 * deliberately OUT OF SCOPE: this skill loads what the participant actually
 * answered, it does not compute or invent a score.
 *
 * Source of truth for database ids: the workbook's own hidden "META" sheet
 * (written by GDX_SKILL_EXPORT_NEW_STUDY), NOT the filename and NOT re-resolving
 * names against the current database. The filename is only sanity-checked
 * against META (a participant may have renamed their copy) -- see
 * parseSlugFromFilename().
 *
 * Idempotency: re-running this skill on the SAME file is safe. Each
 * GDX_PSY_APPLICATION this skill inserts is tagged in its CONTEXT column with
 * `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS:<filename>`; if that tag is already present
 * for (ID_STUDY, ID_PERSON, ID_INSTRUMENT), that instrument's answers are
 * reported as already loaded and skipped, not re-inserted.
 *
 * Usage:
 *   node load_new_study_answers.js --file <path-to-xlsx> [--dry-run]
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const ExcelJS = require('exceljs');

function parseArgs(argv) {
  const args = { file: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.file) {
    throw new Error(
      '--file <path-to-xlsx> is required -- a filled copy of the workbook ' +
      'GDX_SKILL_EXPORT_NEW_STUDY produced (GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx).'
    );
  }
  if (!fs.existsSync(args.file)) {
    throw new Error(`File not found: ${args.file}`);
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

/** Best-effort cross-check only. GDX_SKILL_EXPORT_NEW_STUDY separates
 * <StudyTitle> and <slug> with a double underscore (slugs are always
 * lowercase/hyphen-separated, so they never collide with that marker). This
 * is NEVER the source of truth for database ids -- only META is -- because a
 * participant may rename their copy of the file. */
function parseSlugFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const marker = '__';
  const idx = base.lastIndexOf(marker);
  return idx === -1 ? null : (base.slice(idx + marker.length) || null);
}

function cellText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (value.text !== undefined) return String(value.text).trim() || null; // rich text
    if (value.result !== undefined) return String(value.result).trim() || null; // formula
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s === '' ? null : s;
}

function readMeta(workbook) {
  const ws = workbook.getWorksheet('META');
  if (!ws) {
    throw new Error(
      'This workbook has no hidden META sheet -- it was not produced by GDX_SKILL_EXPORT_NEW_STUDY ' +
      '(or that sheet was deleted). Cannot safely resolve database ids from it.'
    );
  }

  const meta = { studyTitle: null, slug: null, studyId: null, items: [], alternatives: [] };
  let section = null;
  let sawItemsHeader = false;
  let sawAltHeader = false;

  ws.eachRow((row) => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => cellText(row.getCell(i).value));
    const first = v[0];
    if (first === 'STUDY_TITLE') meta.studyTitle = v[1];
    else if (first === 'STUDY_SLUG') meta.slug = v[1];
    else if (first === 'ID_STUDY') meta.studyId = v[1] !== null ? Number(v[1]) : null;
    else if (first === 'ITEMS') { section = 'items'; sawItemsHeader = false; }
    else if (first === 'ALTERNATIVES') { section = 'alternatives'; sawAltHeader = false; }
    else if (section === 'items' && !sawItemsHeader && first === 'SHEET_NAME') { sawItemsHeader = true; }
    else if (section === 'items' && sawItemsHeader && first) {
      meta.items.push({
        SHEET_NAME: v[0], ID_INSTRUMENT: Number(v[1]), INSTRUMENT_NAME: v[2], INSTRUMENT_VERSION: v[3],
        ID_ITEM: Number(v[4]), ITEM_ORDER: Number(v[5]), RESPONSE_TYPE: v[6], REQUIRED: v[7],
      });
    } else if (section === 'alternatives' && !sawAltHeader && first === 'ID_ITEM') { sawAltHeader = true; }
    else if (section === 'alternatives' && sawAltHeader && first) {
      meta.alternatives.push({
        ID_ITEM: Number(v[0]), ALTERNATIVE_ORDER: Number(v[1]), LABEL: v[2],
        NUMERIC_VALUE: v[3] !== null ? Number(v[3]) : null, ID_ALTERNATIVE: Number(v[4]),
      });
    }
  });

  if (!meta.studyTitle || !meta.slug || meta.items.length === 0) {
    throw new Error(
      'META sheet is missing STUDY_TITLE/STUDY_SLUG or has no items -- this workbook looks ' +
      'corrupted, or was edited by hand in a way that broke the META sheet.'
    );
  }
  return meta;
}

function readParticipant(workbook) {
  const ws = workbook.getWorksheet('Participant');
  if (!ws) throw new Error('This workbook has no "Participant" sheet.');

  const fields = {};
  ws.eachRow((row) => {
    const label = cellText(row.getCell(1).value);
    const value = cellText(row.getCell(2).value);
    if (label) fields[label] = value;
  });

  const fullName = fields['Full Name'];
  const externalId = fields['External Identifier / Code'];
  if (!fullName || !externalId) {
    throw new Error(
      'The "Participant" sheet must have "Full Name" and "External Identifier / Code" filled in ' +
      '-- this skill never invents a participant identity.'
    );
  }

  const consentRaw = fields['Consent Given (Y/N)'] || '';
  return {
    fullName,
    externalId,
    birthDate: fields['Birth Date (YYYY-MM-DD)'] || null,
    gender: fields['Gender'] || null,
    educationLevel: fields['Education Level'] || null,
    applicationDate: fields['Application Date (YYYY-MM-DD, blank = today)'] || null,
    consent: /^(y|yes|s|sim|1|true)$/i.test(consentRaw.trim()) ? 1 : 0,
  };
}

/** Locates the header row (the row whose first cell reads "ID_ITEM") rather
 * than assuming a fixed row number, because GDX_SKILL_EXPORT_NEW_STUDY inserts
 * an extra note row above it when the instrument has a description/instructions. */
function readAnswers(workbook, sheetName) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet "${sheetName}" (referenced in META) was not found in this workbook.`);

  let headerRow = null;
  const colIndex = {};
  ws.eachRow((row, rowNumber) => {
    if (headerRow) return;
    if (cellText(row.getCell(1).value) === 'ID_ITEM') {
      headerRow = rowNumber;
      row.eachCell((cell, colNumber) => {
        const h = cellText(cell.value);
        if (h) colIndex[h] = colNumber;
      });
    }
  });
  if (!headerRow) throw new Error(`Could not find the "ID_ITEM" header row in sheet "${sheetName}".`);
  if (!colIndex['ID_ITEM'] || !colIndex['Answer (fill in)']) {
    throw new Error(`Sheet "${sheetName}" is missing the "ID_ITEM" or "Answer (fill in)" column.`);
  }

  const answers = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const idItemRaw = row.getCell(colIndex['ID_ITEM']).value;
    if (idItemRaw === null || idItemRaw === undefined || idItemRaw === '') continue;
    answers.push({ ID_ITEM: Number(idItemRaw), answerText: cellText(row.getCell(colIndex['Answer (fill in)']).value) });
  }
  return answers;
}

async function main() {
  const args = parseArgs(process.argv);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(args.file);

  const meta = readMeta(workbook);
  const filenameSlug = parseSlugFromFilename(args.file);
  if (filenameSlug && filenameSlug !== meta.slug) {
    console.log(`NOTE: the filename suggests slug "${filenameSlug}" but the workbook's internal META ` +
      `sheet says "${meta.slug}" -- trusting META (the file may have been renamed). This is expected ` +
      `and harmless if a participant renamed their copy.`);
  }

  const participant = readParticipant(workbook);

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
    const studyRows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [meta.studyTitle]);
    if (studyRows.length === 0) {
      throw new Error(`Study "${meta.studyTitle}" (from META) not found in GDX_PSY_STUDY -- was it removed after this workbook was exported?`);
    }
    const studyId = studyRows[0].ID_STUDY;
    if (meta.studyId && studyId !== meta.studyId) {
      console.log(`NOTE: GDX_PSY_STUDY.ID_STUDY is now ${studyId}; this workbook was exported when it was ${meta.studyId}. Continuing with the current id.`);
    }

    const summary = {
      personCreated: false, personId: null, participantCreated: false,
      applications: [], skippedApplications: [], responsesInserted: 0,
      unmatchedAlternatives: [], missingRequired: [],
    };

    // --- GDX_PSY_PERSON ---
    const personRows = await query(db, 'SELECT ID_PERSON, NAME FROM GDX_PSY_PERSON WHERE EXTERNAL_IDENTIFIER = ?', [participant.externalId]);
    let personId = null;
    if (personRows.length > 0) {
      personId = personRows[0].ID_PERSON;
      if (personRows[0].NAME !== participant.fullName) {
        console.log(`NOTE: existing GDX_PSY_PERSON ID_PERSON=${personId} has NAME "${personRows[0].NAME}", ` +
          `workbook says "${participant.fullName}" -- keeping the stored name (never overwritten).`);
      }
    } else {
      summary.personCreated = true;
      if (!args.dryRun) {
        const inserted = await query(db,
          `INSERT INTO GDX_PSY_PERSON (NAME, EXTERNAL_IDENTIFIER, BIRTH_DATE, GENDER, EDUCATION_LEVEL)
           VALUES (?, ?, ?, ?, ?) RETURNING ID_PERSON`,
          [participant.fullName, participant.externalId, participant.birthDate, participant.gender, participant.educationLevel]);
        personId = inserted[0].ID_PERSON;
      }
    }
    summary.personId = personId;

    // --- GDX_PSY_STUDY_PARTICIPANT ---
    if (personId) {
      const spRows = await query(db, 'SELECT 1 FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ? AND ID_PERSON = ?', [studyId, personId]);
      if (spRows.length === 0) {
        summary.participantCreated = true;
        if (!args.dryRun) {
          const entryDate = participant.applicationDate ? new Date(participant.applicationDate) : new Date();
          await query(db,
            `INSERT INTO GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, ENTRY_DATE, CONSENT)
             VALUES (?, ?, ?, ?, ?)`,
            [studyId, personId, participant.externalId, entryDate, participant.consent]);
        }
      }
    } else {
      summary.participantCreated = true; // new person implies a new participant too (dry-run)
    }

    // --- GDX_PSY_APPLICATION + GDX_PSY_ITEM_RESPONSE, one instrument sheet at a time ---
    const itemsBySheet = new Map();
    for (const item of meta.items) {
      if (!itemsBySheet.has(item.SHEET_NAME)) itemsBySheet.set(item.SHEET_NAME, []);
      itemsBySheet.get(item.SHEET_NAME).push(item);
    }
    const altsByItem = new Map();
    for (const alt of meta.alternatives) {
      if (!altsByItem.has(alt.ID_ITEM)) altsByItem.set(alt.ID_ITEM, []);
      altsByItem.get(alt.ID_ITEM).push(alt);
    }

    const contextTag = `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS:${path.basename(args.file)}`;

    for (const [sheetName, items] of itemsBySheet) {
      const instrumentId = items[0].ID_INSTRUMENT;
      const instrumentName = items[0].INSTRUMENT_NAME;
      const answers = readAnswers(workbook, sheetName);
      const answerByItem = new Map(answers.map((a) => [a.ID_ITEM, a.answerText]));

      if (![...answerByItem.values()].some((v) => v)) {
        console.log(`Sheet "${sheetName}" (${instrumentName}): no answers filled in -- skipped.`);
        continue;
      }

      let alreadyLoaded = false;
      if (personId) {
        const existing = await query(db,
          'SELECT FIRST 1 ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ? AND ID_PERSON = ? AND ID_INSTRUMENT = ? AND CONTEXT = ?',
          [studyId, personId, instrumentId, contextTag]);
        alreadyLoaded = existing.length > 0;
      }
      if (alreadyLoaded) {
        summary.skippedApplications.push(`${instrumentName}: already loaded from this exact file`);
        continue;
      }

      summary.applications.push(instrumentName);
      if (args.dryRun) continue;

      const appDate = participant.applicationDate ? new Date(participant.applicationDate) : new Date();
      const appResult = await query(db,
        `INSERT INTO GDX_PSY_APPLICATION (ID_STUDY, ID_PERSON, ID_INSTRUMENT, START_TIMESTAMP, STATUS, CONTEXT)
         VALUES (?, ?, ?, ?, 'COMPLETED', ?) RETURNING ID_APPLICATION`,
        [studyId, personId, instrumentId, appDate, contextTag]);
      const applicationId = appResult[0].ID_APPLICATION;

      for (const item of items) {
        const answerText = answerByItem.get(item.ID_ITEM);
        if (!answerText) {
          if (String(item.REQUIRED) === '1') summary.missingRequired.push(`${instrumentName} / ID_ITEM=${item.ID_ITEM}`);
          continue;
        }

        const alts = altsByItem.get(item.ID_ITEM) || [];
        let idAlternative = null;
        let numericValue = null;
        let textValue = null;

        if (alts.length > 0) {
          const match = alts.find((a) => a.LABEL.trim().toLowerCase() === answerText.trim().toLowerCase());
          if (!match) {
            summary.unmatchedAlternatives.push(
              `${instrumentName} / ID_ITEM=${item.ID_ITEM}: answer "${answerText}" matches none of its ` +
              `alternatives -- skipped, nothing written for this item.`);
            continue;
          }
          idAlternative = match.ID_ALTERNATIVE;
          numericValue = match.NUMERIC_VALUE;
        } else {
          textValue = answerText;
          const asNumber = Number(answerText);
          if (answerText.trim() !== '' && Number.isFinite(asNumber)) numericValue = asNumber;
        }

        await query(db,
          `INSERT INTO GDX_PSY_ITEM_RESPONSE (ID_APPLICATION, ID_ITEM, ID_ALTERNATIVE, NUMERIC_VALUE, TEXT_VALUE)
           VALUES (?, ?, ?, ?, ?)`,
          [applicationId, item.ID_ITEM, idAlternative, numericValue, textValue]);
        summary.responsesInserted += 1;
      }
    }

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary for "${participant.fullName}" (${participant.externalId}), study "${meta.studyTitle}":`);
    const createdWord = args.dryRun ? 'would be created' : 'created';
    console.log(`  GDX_PSY_PERSON:            ${summary.personCreated ? createdWord : `reused (ID_PERSON=${summary.personId})`}`);
    console.log(`  GDX_PSY_STUDY_PARTICIPANT: ${summary.participantCreated ? createdWord : 'already existed'}`);
    console.log(`  GDX_PSY_APPLICATION:       ${summary.applications.length} new, ${summary.skippedApplications.length} already loaded`);
    summary.applications.forEach((s) => console.log(`    + ${s}`));
    summary.skippedApplications.forEach((s) => console.log(`    = ${s}`));
    console.log(`  GDX_PSY_ITEM_RESPONSE:     ${summary.responsesInserted} inserted`);
    if (summary.unmatchedAlternatives.length > 0) {
      console.log(`  UNMATCHED answers (needs a human): ${summary.unmatchedAlternatives.length}`);
      summary.unmatchedAlternatives.forEach((s) => console.log(`    ? ${s}`));
    }
    if (summary.missingRequired.length > 0) {
      console.log(`  MISSING required answers: ${summary.missingRequired.length}`);
      summary.missingRequired.forEach((s) => console.log(`    ! ${s}`));
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
