#!/usr/bin/env node
/**
 * GDX_SKILL_GENERATE_GOOGLE_FORM
 *
 * Alternative third stage of the "onboard a new instrument" pipeline, parallel to
 * (and fully independent of) GDX_SKILL_EXPORT_NEW_STUDY -- see this skill's
 * SKILL.md and GDX_HUMAN/0.new.instrument/Google_Forms_Integration_Plan.md:
 *
 *   GDX_SKILL_NEW_STUDY -> GDX_SKILL_RECORD_NEW_STUDY -> GDX_PSY_* rows exist
 *           |
 *           +-- GDX_SKILL_EXPORT_NEW_STUDY            (xlsx path, untouched)
 *           |
 *           +-- GDX_SKILL_GENERATE_GOOGLE_FORM (this skill) -- creates a real
 *                Google Form via the Forms API, one question per registered
 *                item, and writes google_form_map.json (the Forms-API
 *                equivalent of the xlsx pipeline's hidden META sheet) so
 *                GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS can resolve responses back
 *                to exact GDX_PSY_* ids without ever matching by visible text.
 *
 * This script reads (never writes to) GDX_PSY_STUDY / GDX_PSY_INSTRUMENT /
 * GDX_PSY_INSTRUMENT_ITEM / GDX_PSY_ITEM_ALTERNATIVE for the study named by
 * --study. It WRITES to Google (creates a Form) and to local disk
 * (new_study_intake/<slug>/google_form_map.json) -- it never writes to Firebird.
 *
 * Deliberately independent of GDX_SKILL_EXPORT_NEW_STUDY: this script
 * re-implements its own copy of the same read queries rather than importing
 * that skill's code, so the two skills can be run, reviewed, and changed
 * without affecting each other (same convention as every other skill pair in
 * this pipeline, e.g. GDX_SKILL_NEW_STUDY / GDX_SKILL_RECORD_NEW_STUDY).
 *
 * Usage:
 *   node generate_google_form.js --study <slug> [--intake-dir <path>] [--dry-run]
 *
 * Connection: Firebird vars + Google OAuth vars, entirely from environment
 * variables (see ../.env.example). Never hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { google } = require('googleapis');
const { getAuthorizedClient, requireEnv } = require('./google_auth');

const FORMS_SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly', // requested up front so a
  // token generated here also works unmodified for GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS,
  // if you choose to point both skills' GOOGLE_OAUTH_TOKEN_PATH at the same file.
];

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
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

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/, resolved relative to this
 * script (0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM/scripts). */
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

async function findStudy(db, title) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [title]);
  return rows.length > 0 ? rows[0].ID_STUDY : null;
}

async function findInstrument(db, name, version) {
  const rows = await query(db,
    'SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, INSTRUCTIONS FROM GDX_PSY_INSTRUMENT WHERE NAME = ?',
    [name]);
  const wanted = version || null;
  return rows.find((r) => (r.VERSION || null) === wanted) || null;
}

async function loadInstrumentItems(db, instrumentId) {
  const items = await query(db,
    'SELECT ID_ITEM, ITEM_ORDER, STATEMENT_TEXT, RESPONSE_TYPE, REQUIRED FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ? ORDER BY ITEM_ORDER',
    [instrumentId]);
  for (const item of items) {
    item.alternatives = await query(db,
      'SELECT ID_ALTERNATIVE, ALTERNATIVE_ORDER, LABEL, NUMERIC_VALUE FROM GDX_PSY_ITEM_ALTERNATIVE WHERE ID_ITEM = ? ORDER BY ALTERNATIVE_ORDER',
      [item.ID_ITEM]);
  }
  return items;
}

/** Google Forms questions cap titles at 300 chars; long statement text (rare,
 * but POMS-style multi-word items are nowhere close) is truncated defensively
 * rather than left to fail the API call outright. */
function clampTitle(text) {
  const s = String(text);
  return s.length > 300 ? s.slice(0, 297) + '...' : s;
}

const PARTICIPANT_FIELDS = [
  { key: 'fullName', title: 'Full Name', required: true },
  { key: 'externalId', title: 'External Identifier / Code', required: true,
    description: 'Must be unique per participant. Used to find or create this person and to record which study they belong to.' },
  { key: 'birthDate', title: 'Birth Date (YYYY-MM-DD)', required: false },
  { key: 'gender', title: 'Gender', required: false },
  { key: 'educationLevel', title: 'Education Level', required: false },
  { key: 'consent', title: 'Consent Given (Y/N)', required: false },
];

/** Builds the full ordered list of Forms API `Request` objects (one createItem
 * per form item) plus a parallel list describing what each one IS, so the
 * response's `replies[i]` can be matched back to the right GDX_PSY_* row by
 * array position once the batchUpdate call returns. */
function buildCreateRequests(instrumentRows) {
  const requests = [];
  const plan = []; // parallel to requests: { kind: 'participant'|'item', ... }
  let index = 0;

  const pushItem = (item) => {
    requests.push({ createItem: { item, location: { index } } });
    index += 1;
  };

  pushItem({
    title: 'Participant Information',
    description: 'Filled in once by whoever is answering this form.',
    textItem: {},
  });
  plan.push({ kind: 'note' });

  for (const field of PARTICIPANT_FIELDS) {
    pushItem({
      title: clampTitle(field.title),
      description: field.description,
      questionItem: { question: { required: field.required, textQuestion: { paragraph: false } } },
    });
    plan.push({ kind: 'participant', fieldKey: field.key });
  }

  for (const { instRow, items } of instrumentRows) {
    const noteParts = [instRow.DESCRIPTION, instRow.INSTRUCTIONS].filter(Boolean);
    pushItem({
      title: clampTitle(instRow.NAME),
      description: noteParts.join(' -- ') || undefined,
      pageBreakItem: {},
    });
    plan.push({ kind: 'note' });

    for (const item of items) {
      const hasAlternatives = item.alternatives.length > 0;
      const question = { required: String(item.REQUIRED) === '1' };
      if (hasAlternatives) {
        question.choiceQuestion = {
          type: 'RADIO',
          options: item.alternatives.map((a) => ({ value: a.LABEL })),
          shuffle: false,
        };
      } else {
        question.textQuestion = { paragraph: true };
      }
      pushItem({
        title: clampTitle(item.STATEMENT_TEXT),
        questionItem: { question },
      });
      plan.push({ kind: 'item', instRow, item, hasAlternatives });
    }
  }

  return { requests, plan };
}

/** Forms API batchUpdate accepts many requests per call, but this stays
 * conservative and chunks defensively (undocumented internal limits are
 * exactly the kind of thing worth not finding out about mid-run on a large
 * instrument -- see the POMS statement-size lesson from the Firebird side of
 * this project). Each chunk's `location.index` values were computed up front
 * against the WHOLE final sequence, which stays correct chunk to chunk since
 * every request in every chunk targets a brand-new, still-empty-at-that-point
 * form (we never insert past the current end). */
function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const intakeDir = resolveIntakeDir(args);
  const intake = loadIntake(intakeDir, args.study);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) {
    throw new Error(`intake.json for study slug "${args.study}" has no study.title -- is this a valid intake file?`);
  }

  const fbOptions = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsText: true, // STATEMENT_TEXT/DESCRIPTION/INSTRUCTIONS are BLOB SUB_TYPE TEXT -- see the
    // same gotcha noted in GDX_SKILL_EXPORT_NEW_STUDY/scripts/export_new_study.js.
  };

  console.log(`Connecting to ${fbOptions.host}:${fbOptions.port}${fbOptions.database} as ${fbOptions.user} ...`);
  const db = await connect(fbOptions);
  let instrumentRows;
  let studyId;
  try {
    studyId = await findStudy(db, studyTitle);
    if (!studyId) {
      throw new Error(
        `Study "${studyTitle}" (slug "${args.study}") not found in GDX_PSY_STUDY. Run ` +
        `GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
      );
    }

    instrumentRows = [];
    for (const instrumentIntake of intake.instruments) {
      const instRow = await findInstrument(db, instrumentIntake.name, instrumentIntake.version);
      if (!instRow) {
        throw new Error(
          `Instrument "${instrumentIntake.name}"${instrumentIntake.version ? ` (version ${instrumentIntake.version})` : ''} ` +
          `not found in GDX_PSY_INSTRUMENT. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
        );
      }
      const items = await loadInstrumentItems(db, instRow.ID_INSTRUMENT);
      if (items.length === 0) {
        console.log(`WARNING: instrument "${instRow.NAME}" (ID_INSTRUMENT=${instRow.ID_INSTRUMENT}) has no items yet -- skipped.`);
        continue;
      }
      instrumentRows.push({ instRow, items });
    }
  } finally {
    db.detach();
  }

  if (instrumentRows.length === 0) {
    throw new Error('No instrument had any items -- nothing to generate. Run GDX_SKILL_RECORD_NEW_STUDY first.');
  }

  const totalItems = instrumentRows.reduce((n, r) => n + r.items.length, 0);
  console.log(`Study "${studyTitle}" (ID_STUDY=${studyId}): ${instrumentRows.length} instrument(s), ${totalItems} item(s) total.`);

  if (args.dryRun) {
    for (const { instRow, items } of instrumentRows) {
      const withAlts = items.filter((it) => it.alternatives.length > 0).length;
      console.log(`  "${instRow.NAME}": ${items.length} item(s), ${withAlts} with choice options, ${items.length - withAlts} open text.`);
    }
    console.log('\nDry run complete. No Google Form was created, no files were written.');
    return;
  }

  const auth = await getAuthorizedClient(FORMS_SCOPES);
  const forms = google.forms({ version: 'v1', auth });

  console.log('Creating the Google Form...');
  const createRes = await forms.forms.create({ requestBody: { info: { title: studyTitle } } });
  const formId = createRes.data.formId;

  const { requests, plan } = buildCreateRequests(instrumentRows);
  const replies = [];
  for (const batch of chunk(requests, 90)) {
    const res = await forms.forms.batchUpdate({ formId, requestBody: { requests: batch } });
    replies.push(...(res.data.replies || []));
  }

  const participantFieldMap = {};
  const itemMap = {};
  const alternativeMap = {};

  replies.forEach((reply, i) => {
    const step = plan[i];
    // CreateItemResponse.questionId is an array (a QuestionGroupItem can create several
    // questions from one item) -- every item created here is a single plain question, so
    // take its one and only element. note/section items (textItem/pageBreakItem) have no
    // question at all, so this is undefined for them -- nothing to map, skipped below.
    const questionIds = reply && reply.createItem ? reply.createItem.questionId : undefined;
    const questionId = Array.isArray(questionIds) ? questionIds[0] : undefined;
    if (!questionId) return;

    if (step.kind === 'participant') {
      participantFieldMap[questionId] = step.fieldKey;
    } else if (step.kind === 'item') {
      itemMap[questionId] = {
        ID_ITEM: step.item.ID_ITEM,
        ID_INSTRUMENT: step.instRow.ID_INSTRUMENT,
        INSTRUMENT_NAME: step.instRow.NAME,
        ITEM_ORDER: step.item.ITEM_ORDER,
        REQUIRED: step.item.REQUIRED,
      };
      if (step.hasAlternatives) {
        alternativeMap[questionId] = step.item.alternatives.map((a) => ({
          choiceText: a.LABEL, ID_ALTERNATIVE: a.ID_ALTERNATIVE, NUMERIC_VALUE: a.NUMERIC_VALUE,
        }));
      }
    }
  });

  const formEditUrl = `https://docs.google.com/forms/d/${formId}/edit`;
  const formResponderUrl = createRes.data.responderUri
    || `https://docs.google.com/forms/d/e/${formId}/viewform`;

  const map = {
    formId,
    formEditUrl,
    formResponderUrl,
    studyTitle,
    studySlug: args.study,
    studyId,
    generatedAt: new Date().toISOString(),
    participantFieldMap,
    itemMap,
    alternativeMap,
  };

  const mapPath = path.join(intakeDir, 'google_form_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));

  // Same text goes to the terminal and into GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO (added by
  // 0.new.instrument/google_form_instrument_field_firebird25.sql) -- one block, two destinations,
  // so the two can never drift apart.
  const infoText = [
    `Created Google Form for "${studyTitle}".`,
    `  Edit:   ${formEditUrl}`,
    `  Share:  ${formResponderUrl}`,
    `  Wrote:  ${mapPath}`,
    `  Questions mapped: ${Object.keys(itemMap).length} item(s), ${Object.keys(participantFieldMap).length} participant field(s).`,
    '',
    'Send the Share link to participants. Once you have responses, run ' +
      'GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS --study ' + args.study + ' to pull them into the database.',
    '',
    'google_form_map.json carries no secrets -- it is safe (and important) to commit ' +
      'alongside intake.json. Losing it means responses already collected can no longer be resolved.',
    '',
    `Generated at: ${map.generatedAt}`,
  ].join('\n');

  console.log('\n' + infoText);

  // Every instrument this form has a section for gets the same block -- one form, read by every
  // instrument it covers, not split or paraphrased per instrument.
  console.log('\nSaving this report to GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO ...');
  const dbWrite = await connect(fbOptions);
  try {
    for (const { instRow } of instrumentRows) {
      await query(dbWrite,
        'UPDATE GDX_PSY_INSTRUMENT SET GOOGLE_FORM_INFO = ? WHERE ID_INSTRUMENT = ?',
        [infoText, instRow.ID_INSTRUMENT]);
      console.log(`  Saved for "${instRow.NAME}" (ID_INSTRUMENT=${instRow.ID_INSTRUMENT}).`);
    }
  } finally {
    dbWrite.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
