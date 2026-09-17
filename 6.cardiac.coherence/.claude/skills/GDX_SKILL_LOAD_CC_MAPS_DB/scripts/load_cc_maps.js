#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_CC_MAPS_DB
 *
 * Scoped to ONE study: reads the intake.json that GDX_SKILL_NEW_STUDY wrote
 * (and GDX_SKILL_RECORD_NEW_STUDY already loaded into Firebird) for a given
 * study slug, resolves its GDX_PSY_STUDY.ID_STUDY, and links the cardiac-
 * coherence participants (6.cardiac.coherence) to that study by inserting
 * GDX_PSY_STUDY_PARTICIPANT rows (2.relational.model.psychometrics).
 *
 * Why GDX_PSY_STUDY_PARTICIPANT and not GDX_PSY_PERSON:
 * GDX_CC_PERSON.ID_PERSON already has a real FOREIGN KEY straight to
 * DW_DIM_PERSON (a 1:1 copy of GDX_PSY_PERSON.ID_PERSON -- see
 * 7.multidimensional.database/godatax_human_dw_fk_gdx_cc_person_firebird25.sql).
 * That means a GDX_CC_PERSON row can only exist if a GDX_PSY_PERSON with the
 * SAME id already exists -- there is no separate id space to bridge and
 * nothing to insert into GDX_PSY_PERSON itself. What IS missing is the
 * information that a given person belongs to a given STUDY, which is exactly
 * what GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ...) records.
 *
 * Scope rule (the cardiac-coherence tables have no ID_STUDY column at all --
 * they are shared across every study, so "belongs to this new study" cannot
 * be read off the schema directly): a GDX_CC_PERSON is treated as belonging
 * to the study passed via --study when (a) it has at least one row in
 * GDX_CC_SESSION (real captured data, not just a registered-but-unused
 * person) and (b) it has NO GDX_PSY_STUDY_PARTICIPANT row for ANY study yet
 * -- i.e. it is a brand-new participant, not already claimed by an earlier
 * study. This is a deliberate, documented assumption (see this skill's
 * SKILL.md and 6.cardiac.coherence/GDX_CC_Psychometrics_Person_Mapping.md),
 * not something inferred silently.
 *
 * This script NEVER writes to GDX_CC_* or GDX_PSY_PERSON, and NEVER invents
 * CONSENT: every GDX_PSY_STUDY_PARTICIPANT row it inserts gets CONSENT = 0
 * (not confirmed) because the cardiac-coherence schema has no consent field
 * to read a real value from -- a human must update CONSENT once it is
 * actually confirmed for that participant.
 *
 * Usage:
 *   node load_cc_maps.js --study <slug> [--dry-run] [--intake-dir <path>]
 *
 *   --study <slug>       required. The same slug GDX_SKILL_NEW_STUDY used for
 *                         new_study_intake/<slug>/intake.json.
 *   --intake-dir <path>  override the default location of intake.json
 *                         (normally resolved relative to this script, at
 *                         GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/).
 *   --dry-run             see exactly what would change, writes nothing.
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as the other GDX_HUMAN skills).
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { dryRun: false, study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json -- this skill only associates cardiac-coherence ' +
      "participants with that one study, never a full-database scan."
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

/** Default location of intake.json for a given slug, resolved relative to
 * this script (GDX_HUMAN/6.cardiac.coherence/.claude/skills/GDX_SKILL_LOAD_CC_MAPS_DB/scripts)
 * up to GDX_HUMAN and back down into the sibling 0.new.instrument skill's output folder. */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}

function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) {
    throw new Error(
      `intake.json not found at ${intakePath}. Run GDX_SKILL_NEW_STUDY for study slug ` +
      `"${args.study}" first (it writes new_study_intake/${args.study}/intake.json), or pass ` +
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
      throw new Error(
        `Study "${studyTitle}" (slug "${args.study}") not found in GDX_PSY_STUDY. Run ` +
        `GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
      );
    }
    const studyId = studyRows[0].ID_STUDY;

    // Candidates: cardiac-coherence persons with at least one real session,
    // not yet claimed by ANY study's GDX_PSY_STUDY_PARTICIPANT row. See the
    // header comment / SKILL.md for why this is the scoping rule.
    const candidates = await query(db, `
      SELECT DISTINCT p.ID_PERSON, p.EXTERNAL_CODE
      FROM GDX_CC_PERSON p
      JOIN GDX_CC_SESSION s ON s.ID_PERSON = p.ID_PERSON
      WHERE p.ACTIVE_FLAG = 1
        AND NOT EXISTS (
          SELECT 1 FROM GDX_PSY_STUDY_PARTICIPANT sp WHERE sp.ID_PERSON = p.ID_PERSON
        )
      ORDER BY p.ID_PERSON
    `);

    console.log(`Scope: study "${studyTitle}" (slug "${args.study}", ID_STUDY=${studyId}), ` +
      `${candidates.length} cardiac-coherence person(s) with session data and no prior study.`);

    const summary = { associated: [], missingPsyPerson: [] };

    for (const c of candidates) {
      // Defensive check: FK_GDX_CC_PERSON_DW_PERSON already guarantees this
      // person exists in GDX_PSY_PERSON (via DW_DIM_PERSON), but this skill
      // verifies it explicitly rather than assuming the FK is in place on
      // every target database.
      const person = await query(db, 'SELECT FIRST 1 ID_PERSON FROM GDX_PSY_PERSON WHERE ID_PERSON = ?', [c.ID_PERSON]);
      if (person.length === 0) {
        summary.missingPsyPerson.push(c.ID_PERSON);
        continue;
      }

      summary.associated.push(`ID_PERSON=${c.ID_PERSON} (EXTERNAL_CODE=${c.EXTERNAL_CODE || 'NULL'})`);
      if (!args.dryRun) {
        await query(db,
          `INSERT INTO GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, CONSENT)
           VALUES (?, ?, ?, 0)`,
          [studyId, c.ID_PERSON, c.EXTERNAL_CODE]);
      }
    }

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary:`);
    console.log(`  associated (new GDX_PSY_STUDY_PARTICIPANT rows): ${summary.associated.length}`);
    summary.associated.forEach((s) => console.log(`    + ${s}`));
    console.log(`  missing GDX_PSY_PERSON (data integrity gap):     ${summary.missingPsyPerson.length}`);
    summary.missingPsyPerson.forEach((id) => console.log(`    ? ID_PERSON=${id} exists in GDX_CC_PERSON but not in GDX_PSY_PERSON`));

    if (summary.associated.length > 0) {
      console.log('\nEvery inserted row has CONSENT = 0 (not confirmed) -- update it once real ' +
        'consent is confirmed for that participant. This skill never invents consent.');
    }
    if (summary.missingPsyPerson.length > 0) {
      console.log('\nThe rows above violate the FK_GDX_CC_PERSON_DW_PERSON invariant and were left ' +
        'untouched -- investigate before associating them with any study.');
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
