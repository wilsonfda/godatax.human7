#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS
 *
 * Alternative fourth stage of the "onboard a new instrument" pipeline, parallel to
 * (and fully independent of) GDX_SKILL_LOAD_NEW_STUDY_ANSWERS -- see this skill's
 * SKILL.md and GDX_HUMAN/0.new.instrument/Google_Forms_Integration_Plan.md:
 *
 *   GDX_SKILL_GENERATE_GOOGLE_FORM --study <slug>   -- creates the Form, writes
 *                                                       google_form_map.json
 *           |
 *           v
 *   GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS (this skill) -- pulls every response via
 *                                                       the Forms API, resolves
 *                                                       each answer through
 *                                                       google_form_map.json,
 *                                                       writes GDX_PSY_PERSON /
 *                                                       GDX_PSY_STUDY_PARTICIPANT /
 *                                                       GDX_PSY_APPLICATION /
 *                                                       GDX_PSY_ITEM_RESPONSE
 *
 * Source of truth for ids: new_study_intake/<slug>/google_form_map.json, NOT the
 * Form's visible question text and NOT re-resolving names against the current
 * database -- same trust model GDX_SKILL_LOAD_NEW_STUDY_ANSWERS has for the
 * hidden META sheet, just stored as a side-car JSON file instead of embedded in
 * a workbook (Forms has no equivalent of a hidden sheet -- see the Plan doc).
 *
 * Deliberately independent of GDX_SKILL_LOAD_NEW_STUDY_ANSWERS: this script does
 * not import or call into that skill's code -- it re-implements the same
 * participant/application/item-response insert logic against this skill's own
 * input shape (Forms API responses instead of an xlsx workbook).
 *
 * Out of scope on purpose, same boundary GDX_SKILL_LOAD_NEW_STUDY_ANSWERS already
 * draws: this skill loads what the respondent actually answered -- it does not
 * compute GDX_PSY_VARIABLE_RESULT / GDX_PSY_CONSTRUCT_RESULT / GDX_PSY_INDICATOR_RESULT.
 *
 * Usage:
 *   node load_google_form_answers.js --study <slug> [--intake-dir <path>] [--dry-run]
 *
 * Connection: Firebird vars + Google OAuth vars, entirely from environment
 * variables (see ../.env.example). Never hardcode credentials here.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { google } = require('googleapis');
const { getAuthorizedClient, requireEnv } = require('./google_auth');

const RESPONSES_SCOPES = ['https://www.googleapis.com/auth/forms.responses.readonly'];

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
      '--study <slug> is required. Pass the same slug GDX_SKILL_GENERATE_GOOGLE_FORM used -- ' +
      'this skill reads new_study_intake/<slug>/google_form_map.json.'
    );
  }
  return args;
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/, resolved relative to this
 * script (0.new.instrument/.claude/skills/GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS/scripts). */
function resolveIntakeDir(args) {
  if (args.intakeDir) return args.intakeDir;
  return path.join(__dirname, '..', '..', '..', '..', 'new_study_intake', args.study);
}

function loadFormMap(intakeDir, slug) {
  const mapPath = path.join(intakeDir, 'google_form_map.json');
  if (!fs.existsSync(mapPath)) {
    throw new Error(
      `google_form_map.json not found at ${mapPath}. Run ` +
      `"node generate_google_form.js --study ${slug}" (GDX_SKILL_GENERATE_GOOGLE_FORM) first.`
    );
  }
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
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
 * `INSERT ... RETURNING col` as a plain object ({COL: value}), not a
 * one-element array -- normalizes either shape to the row object. Same helper
 * as GDX_SKILL_LOAD_NEW_STUDY_ANSWERS's load_new_study_answers.js (duplicated,
 * not imported, per this project's self-contained-skill convention). */
function returningRow(result) {
  return Array.isArray(result) ? result[0] : result;
}

async function listAllResponses(forms, formId) {
  let all = [];
  let pageToken;
  do {
    const res = await forms.forms.responses.list({ formId, pageToken });
    all = all.concat(res.data.responses || []);
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return all;
}

/** A Forms API answer (for both short-answer/paragraph questions and RADIO
 * choice questions alike) carries its value(s) as plain text under
 * textAnswers.answers[].value -- for a RADIO question that's the exact label
 * of the option the respondent picked, not an internal choice id (unlike the
 * question itself, choice options have no stable id in the Forms API -- see
 * GDX_SKILL_GENERATE_GOOGLE_FORM's SKILL.md "matching nuance" section). Joins
 * multiple values with "; " defensively (only relevant for a CHECKBOX-type
 * question, which this pipeline does not currently generate). */
function extractAnswerText(answer) {
  if (!answer || !answer.textAnswers || !Array.isArray(answer.textAnswers.answers)) return null;
  const vals = answer.textAnswers.answers.map((a) => a.value).filter((v) => v !== undefined && v !== null && v !== '');
  return vals.length > 0 ? vals.join('; ') : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const intakeDir = resolveIntakeDir(args);
  const map = loadFormMap(intakeDir, args.study);

  const fbOptions = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
  };

  console.log(`Connecting to ${fbOptions.host}:${fbOptions.port}${fbOptions.database} as ${fbOptions.user} ...`);
  const db = await connect(fbOptions);
  try {
    const studyRows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [map.studyTitle]);
    if (studyRows.length === 0) {
      throw new Error(`Study "${map.studyTitle}" (from google_form_map.json) not found in GDX_PSY_STUDY -- was it removed after the Form was created?`);
    }
    const studyId = studyRows[0].ID_STUDY;
    if (map.studyId && studyId !== map.studyId) {
      console.log(`NOTE: GDX_PSY_STUDY.ID_STUDY is now ${studyId}; google_form_map.json was written when it was ${map.studyId}. Continuing with the current id.`);
    }

    console.log(`Authorizing against the Forms API for form ${map.formId} ...`);
    const auth = await getAuthorizedClient(RESPONSES_SCOPES);
    const forms = google.forms({ version: 'v1', auth });

    console.log('Fetching responses...');
    const responses = await listAllResponses(forms, map.formId);
    console.log(`${responses.length} response(s) found for "${map.studyTitle}".\n`);

    // ID_INSTRUMENT -> { instrumentName, items: [{questionId, ID_ITEM, ITEM_ORDER, REQUIRED}] }
    const byInstrument = new Map();
    for (const [questionId, info] of Object.entries(map.itemMap)) {
      if (!byInstrument.has(info.ID_INSTRUMENT)) {
        byInstrument.set(info.ID_INSTRUMENT, { instrumentName: info.INSTRUMENT_NAME, items: [] });
      }
      byInstrument.get(info.ID_INSTRUMENT).items.push({ questionId, ...info });
    }

    const summary = {
      skippedNoIdentity: 0, personsCreated: 0, participantsCreated: 0,
      applicationsCreated: [], skippedApplications: [], responsesInserted: 0,
      unmatchedAlternatives: [], missingRequired: [],
    };

    for (const resp of responses) {
      const responseId = resp.responseId;
      const answers = resp.answers || {};

      const participantRaw = {};
      for (const [questionId, fieldKey] of Object.entries(map.participantFieldMap)) {
        participantRaw[fieldKey] = extractAnswerText(answers[questionId]);
      }
      const fullName = participantRaw.fullName;
      const externalId = participantRaw.externalId;
      if (!fullName || !externalId) {
        console.log(`Response ${responseId}: missing Full Name or External Identifier/Code -- skipped entirely (never invented).`);
        summary.skippedNoIdentity += 1;
        continue;
      }
      const consentRaw = (participantRaw.consent || '').trim();
      const consent = /^(y|yes|s|sim|1|true)$/i.test(consentRaw) ? 1 : 0;
      const respTimestamp = resp.createTime ? new Date(resp.createTime) : new Date();

      // --- GDX_PSY_PERSON ---
      const personRows = await query(db, 'SELECT ID_PERSON, NAME FROM GDX_PSY_PERSON WHERE EXTERNAL_IDENTIFIER = ?', [externalId]);
      let personId = null;
      if (personRows.length > 0) {
        personId = personRows[0].ID_PERSON;
        if (personRows[0].NAME !== fullName) {
          console.log(`  NOTE: existing GDX_PSY_PERSON ID_PERSON=${personId} has NAME "${personRows[0].NAME}", ` +
            `this response says "${fullName}" -- keeping the stored name (never overwritten).`);
        }
      } else {
        summary.personsCreated += 1;
        if (!args.dryRun) {
          const inserted = await query(db,
            `INSERT INTO GDX_PSY_PERSON (NAME, EXTERNAL_IDENTIFIER, BIRTH_DATE, GENDER, EDUCATION_LEVEL)
             VALUES (?, ?, ?, ?, ?) RETURNING ID_PERSON`,
            [fullName, externalId, participantRaw.birthDate || null, participantRaw.gender || null, participantRaw.educationLevel || null]);
          personId = returningRow(inserted).ID_PERSON;
        }
      }

      // --- GDX_PSY_STUDY_PARTICIPANT ---
      if (personId) {
        const spRows = await query(db, 'SELECT 1 FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ? AND ID_PERSON = ?', [studyId, personId]);
        if (spRows.length === 0) {
          summary.participantsCreated += 1;
          if (!args.dryRun) {
            await query(db,
              `INSERT INTO GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, ENTRY_DATE, CONSENT)
               VALUES (?, ?, ?, ?, ?)`,
              [studyId, personId, externalId, respTimestamp, consent]);
          }
        }
      } else {
        summary.participantsCreated += 1; // dry-run on a brand-new person implies a new participant too
      }

      // --- GDX_PSY_APPLICATION + GDX_PSY_ITEM_RESPONSE, one instrument at a time ---
      for (const [instrumentId, { instrumentName, items }] of byInstrument) {
        const anyAnswered = items.some((it) => extractAnswerText(answers[it.questionId]));
        if (!anyAnswered) continue;

        const contextTag = `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS:${map.formId}:${responseId}`;
        let alreadyLoaded = false;
        let applicationId = null;
        if (personId) {
          const existing = await query(db,
            'SELECT FIRST 1 ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ? AND ID_PERSON = ? AND ID_INSTRUMENT = ? AND CONTEXT = ?',
            [studyId, personId, instrumentId, contextTag]);
          alreadyLoaded = existing.length > 0;
          if (alreadyLoaded) applicationId = existing[0].ID_APPLICATION;
        }

        if (alreadyLoaded) {
          summary.skippedApplications.push(`${instrumentName} (response ${responseId}): already loaded`);
        } else {
          summary.applicationsCreated.push(`${instrumentName} (response ${responseId})`);
          if (!args.dryRun) {
            const appResult = await query(db,
              `INSERT INTO GDX_PSY_APPLICATION (ID_STUDY, ID_PERSON, ID_INSTRUMENT, START_TIMESTAMP, STATUS, CONTEXT)
               VALUES (?, ?, ?, ?, 'COMPLETED', ?) RETURNING ID_APPLICATION`,
              [studyId, personId, instrumentId, respTimestamp, contextTag]);
            applicationId = returningRow(appResult).ID_APPLICATION;
          }
        }

        for (const it of items) {
          const answerText = extractAnswerText(answers[it.questionId]);
          if (!answerText) {
            if (!alreadyLoaded && String(it.REQUIRED) === '1') {
              summary.missingRequired.push(`${instrumentName} / ID_ITEM=${it.ID_ITEM} (response ${responseId})`);
            }
            continue;
          }

          const alts = map.alternativeMap[it.questionId] || [];
          let idAlternative = null;
          let numericValue = null;
          let textValue = null;

          if (alts.length > 0) {
            const match = alts.find((a) => a.choiceText.trim().toLowerCase() === answerText.trim().toLowerCase());
            if (!match) {
              if (!alreadyLoaded) summary.unmatchedAlternatives.push(
                `${instrumentName} / ID_ITEM=${it.ID_ITEM} (response ${responseId}): answer "${answerText}" ` +
                `matches none of its recorded choices -- skipped, nothing written for this item.`);
              continue;
            }
            idAlternative = match.ID_ALTERNATIVE;
            numericValue = match.NUMERIC_VALUE;
          } else {
            textValue = answerText;
            const asNumber = Number(answerText);
            if (answerText.trim() !== '' && Number.isFinite(asNumber)) numericValue = asNumber;
          }

          if (!alreadyLoaded) {
            if (!args.dryRun) {
              await query(db,
                `INSERT INTO GDX_PSY_ITEM_RESPONSE (ID_APPLICATION, ID_ITEM, ID_ALTERNATIVE, NUMERIC_VALUE, TEXT_VALUE)
                 VALUES (?, ?, ?, ?, ?)`,
                [applicationId, it.ID_ITEM, idAlternative, numericValue, textValue]);
            }
            summary.responsesInserted += 1;
          }
        }
      }
    }

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary for "${map.studyTitle}" (form ${map.formId}):`);
    const createdWord = args.dryRun ? 'would be created' : 'created';
    console.log(`  Responses fetched:         ${responses.length} (${summary.skippedNoIdentity} skipped -- missing Full Name/External Identifier)`);
    console.log(`  GDX_PSY_PERSON:            ${summary.personsCreated} ${createdWord}`);
    console.log(`  GDX_PSY_STUDY_PARTICIPANT: ${summary.participantsCreated} ${createdWord}`);
    console.log(`  GDX_PSY_APPLICATION:       ${summary.applicationsCreated.length} new, ${summary.skippedApplications.length} already loaded`);
    summary.applicationsCreated.forEach((s) => console.log(`    + ${s}`));
    console.log(`  GDX_PSY_ITEM_RESPONSE:     ${summary.responsesInserted} ${args.dryRun ? 'would be inserted' : 'inserted'}`);
    if (summary.unmatchedAlternatives.length > 0) {
      console.log(`  UNMATCHED answers (needs a human): ${summary.unmatchedAlternatives.length}`);
      summary.unmatchedAlternatives.forEach((s) => console.log(`    ? ${s}`));
    }
    if (summary.missingRequired.length > 0) {
      console.log(`  MISSING required answers: ${summary.missingRequired.length}`);
      summary.missingRequired.forEach((s) => console.log(`    ! ${s}`));
    }
    console.log('\n  Not computed by this skill (out of scope): GDX_PSY_VARIABLE_RESULT / ' +
      'GDX_PSY_CONSTRUCT_RESULT / GDX_PSY_INDICATOR_RESULT -- same boundary GDX_SKILL_LOAD_NEW_STUDY_ANSWERS draws.');
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
