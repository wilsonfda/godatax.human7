#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_SEPT_MAPS_DB
 *
 * Scoped to ONE study: reads the intake.json that GDX_SKILL_NEW_STUDY wrote
 * (and GDX_SKILL_RECORD_NEW_STUDY already loaded into Firebird) for a given
 * study slug, resolves exactly the GDX_PSY_INSTRUMENT/GDX_PSY_VARIABLE rows
 * that study introduced (2_relational.model.psychometrics), and loads their
 * relation into GDX_PSY_SEPT_LEVEL_PSY_MAP (3_septenary.constitution),
 * backed by the fixed judgment calls in scripts/knowledge.js.
 *
 * This script NEVER writes to GDX_PSY_SEPTENARY_LEVEL (the 7-level catalog is
 * out of scope by design) and NEVER guesses a level/justification for a
 * variable knowledge.js doesn't know about -- those are reported as UNKNOWN
 * so a human can add a real judgment call to knowledge.js first.
 *
 * Scope: only the study named by --study is touched. Its instruments and
 * variables are read from new_study_intake/<slug>/intake.json (the same
 * contract GDX_SKILL_NEW_STUDY writes and GDX_SKILL_RECORD_NEW_STUDY
 * consumes), then each one is looked up BY NAME in the live database to get
 * its real ID_INSTRUMENT/ID_VARIABLE -- variables belonging to any other
 * study already in the database are never read or written.
 *
 * For each variable in that scope (identified by its .sav column, parsed out
 * of OPERATIONAL_DEFINITION, when there is one -- see resolveMappingKey()):
 *   - UNKNOWN to knowledge.js       -> reported, nothing written
 *   - excluded in knowledge.js      -> reported, nothing written (by design)
 *   - known, no existing map row    -> INSERT a new GDX_PSY_SEPT_LEVEL_PSY_MAP
 *                                      row (with a real ID_VARIABLE/ID_INSTRUMENT,
 *                                      not the NULL-FK/label-only pattern the
 *                                      original 18 rows were seeded with)
 *   - known, existing row w/ NULL   -> UPDATE just the missing ID_VARIABLE/
 *     ID_VARIABLE or ID_INSTRUMENT     ID_INSTRUMENT FK (text columns untouched)
 *   - known, existing row complete  -> skipped, already linked
 *
 * Usage:
 *   node load_sept_maps.js --study <slug> [--dry-run] [--intake-dir <path>]
 *
 *   --study <slug>       required. The same slug GDX_SKILL_NEW_STUDY used for
 *                         new_study_intake/<slug>/intake.json. Only that
 *                         study's instruments/variables are mapped.
 *   --intake-dir <path>  override the default location of intake.json
 *                         (normally resolved relative to this script, at
 *                         GDX_HUMAN/0_new_instrument/new_study_intake/<slug>/).
 *   --dry-run             see exactly what would change, writes nothing.
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as GDX_SKILL_LOAD_RLT_MODEL_DB).
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const knowledge = require('./knowledge');

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
      'new_study_intake/<slug>/intake.json -- this skill only creates mappings for that ' +
      "one study's instruments/variables, never a full-database scan."
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
 * this script (GDX_HUMAN/3_septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts)
 * up to GDX_HUMAN and back down into the sibling 0_new_instrument skill's output folder. */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0_new_instrument', 'new_study_intake', args.study, 'intake.json');
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

/** Escapes a value for literal inclusion in a SQL string (doubles single
 * quotes). Used ONLY for the INSERT into GDX_PSY_SEPT_LEVEL_PSY_MAP, because
 * node-firebird's parameter binding (`?`) is unreliable for BLOB SUB_TYPE
 * TEXT columns (RECORDED_BEHAVIOR / CORRESPONDENCE_JUSTIFICATION): the
 * driver's callback can report success while corrupting the connection state
 * for the next query, and the row silently never persists. Verified during
 * development -- a parameterized insert into those two columns returned no
 * error yet left the table row count unchanged. Every other query in this
 * file (SELECT/UPDATE, no BLOB columns) uses normal `?` parameter binding. */
function esc(value) {
  return String(value).replace(/'/g, "''");
}

/** Extract the .sav column name out of OPERATIONAL_DEFINITION
 * (format: ".sav column: <col> (mean of the dimension's items, 0-5)").
 * Only variables loaded from a historical .sav file (GDX_SKILL_LOAD_RLT_MODEL_DB)
 * carry this format; variables onboarded via GDX_SKILL_NEW_STUDY have free-text
 * operational definitions and no .sav file behind them at all. */
function parseSavColumn(operationalDefinition) {
  if (!operationalDefinition) return null;
  const marker = '.sav column: ';
  const start = operationalDefinition.indexOf(marker);
  if (start !== 0) return null; // must be at the very start, per the generator's format
  const tail = operationalDefinition.slice(marker.length);
  const parenPos = tail.indexOf(' (');
  return (parenPos === -1 ? tail : tail.slice(0, parenPos)).trim();
}

/** knowledge.js is keyed either by the .sav column (variables loaded from a
 * historical .sav file) or, when there is none, by the variable's own
 * GDX_PSY_VARIABLE.NAME (variables onboarded via GDX_SKILL_NEW_STUDY /
 * GDX_SKILL_RECORD_NEW_STUDY, which never have a .sav file). `marker` is what
 * GDX_PSY_SEPT_LEVEL_PSY_MAP.VARIABLE_LABEL is searched/written with to detect
 * an already-existing row for this variable. */
function resolveMappingKey(v) {
  const savColumn = parseSavColumn(v.OPERATIONAL_DEFINITION);
  if (savColumn) {
    return { key: savColumn, label: `${v.NAME} -> ${savColumn}`, marker: `-> ${savColumn}` };
  }
  return { key: v.NAME, label: v.NAME, marker: v.NAME };
}

/** Looks up GDX_PSY_INSTRUMENT by (NAME, VERSION) -- VERSION may be null on
 * both sides, so the match is done in JS rather than in SQL. */
async function findInstrument(db, name, version) {
  const rows = await query(db, 'SELECT ID_INSTRUMENT, NAME, VERSION FROM GDX_PSY_INSTRUMENT WHERE NAME = ?', [name]);
  const wanted = version || null;
  return rows.find((r) => (r.VERSION || null) === wanted) || null;
}

async function findConstruct(db, name) {
  const rows = await query(db, 'SELECT FIRST 1 ID_CONSTRUCT FROM GDX_PSY_CONSTRUCT WHERE NAME = ?', [name]);
  return rows[0] || null;
}

async function findVariable(db, constructId, name) {
  const rows = await query(db,
    'SELECT FIRST 1 ID_VARIABLE, NAME, OPERATIONAL_DEFINITION FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = ? AND NAME = ?',
    [constructId, name]);
  return rows[0] || null;
}

/** Resolves the intake's instruments/variables to the real rows already
 * persisted in Firebird by GDX_SKILL_RECORD_NEW_STUDY. Throws (rather than
 * skipping) if something the intake describes isn't in the database yet --
 * that means GDX_SKILL_RECORD_NEW_STUDY hasn't been run (or failed partway)
 * for this study, which this skill must not paper over. */
async function resolveScopedVariables(db, intake) {
  const scoped = [];
  for (const instrument of intake.instruments) {
    const instRow = await findInstrument(db, instrument.name, instrument.version);
    if (!instRow) {
      throw new Error(
        `Instrument "${instrument.name}"${instrument.version ? ` (version ${instrument.version})` : ''} ` +
        `not found in GDX_PSY_INSTRUMENT. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
      );
    }
    for (const v of instrument.variables) {
      const constructRow = await findConstruct(db, v.construct_name);
      if (!constructRow) {
        throw new Error(
          `Construct "${v.construct_name}" (from instrument "${instrument.name}") not found in ` +
          `GDX_PSY_CONSTRUCT. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
        );
      }
      const varRow = await findVariable(db, constructRow.ID_CONSTRUCT, v.name);
      if (!varRow) {
        throw new Error(
          `Variable "${v.name}" (construct "${v.construct_name}", instrument "${instrument.name}") not ` +
          `found in GDX_PSY_VARIABLE. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
        );
      }
      scoped.push({
        ID_VARIABLE: varRow.ID_VARIABLE,
        NAME: varRow.NAME,
        OPERATIONAL_DEFINITION: varRow.OPERATIONAL_DEFINITION,
        ID_INSTRUMENT: instRow.ID_INSTRUMENT,
        INSTRUMENT_NAME: instRow.NAME,
      });
    }
  }
  return scoped;
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

    const variables = await resolveScopedVariables(db, intake);
    console.log(`Scope: study "${studyTitle}" (slug "${args.study}"), ` +
      `${intake.instruments.length} instrument(s), ${variables.length} variable(s).`);

    const summary = { inserted: [], backfilled: [], alreadyLinked: [], excluded: [], unknown: [] };

    for (const v of variables) {
      const { key, label: variableLabel, marker } = resolveMappingKey(v);

      const entry = knowledge[key];
      if (!entry) {
        summary.unknown.push(`${key} (${v.NAME}, ID_VARIABLE=${v.ID_VARIABLE}): no entry in knowledge.js`);
        continue;
      }
      if (entry.excluded) {
        summary.excluded.push(`${key}: ${entry.reason}`);
        continue;
      }

      const instrumentId = v.ID_INSTRUMENT;
      const instrumentLabel = v.INSTRUMENT_NAME;

      const existing = await query(db,
        'SELECT FIRST 1 ID_MAPPING, ID_VARIABLE, ID_INSTRUMENT FROM GDX_PSY_SEPT_LEVEL_PSY_MAP WHERE VARIABLE_LABEL CONTAINING (?)',
        [marker]);

      if (existing.length === 0) {
        summary.inserted.push(`${key} -> level ${entry.level} (${entry.confidence})`);
        if (!args.dryRun) {
          // Literal SQL (see esc() comment): parameterized BLOB TEXT binding
          // is unreliable in node-firebird for RECORDED_BEHAVIOR/CORRESPONDENCE_JUSTIFICATION.
          await query(db,
            `INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
               (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
                RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
             VALUES (${entry.level}, ${instrumentId}, '${esc(instrumentLabel)}', ${v.ID_VARIABLE}, '${esc(variableLabel)}',
                     '${esc(entry.behavior)}', '${esc(entry.justification)}', '${esc(entry.confidence)}')`);

          // Verify the row actually persisted (defensive: the same driver
          // quirk that motivated literal SQL here has, in other contexts,
          // reported success without writing anything).
          const check = await query(db,
            'SELECT COUNT(*) AS CNT FROM GDX_PSY_SEPT_LEVEL_PSY_MAP WHERE ID_VARIABLE = ?', [v.ID_VARIABLE]);
          if (check[0].CNT === 0) {
            throw new Error(`INSERT for ${key} (ID_VARIABLE=${v.ID_VARIABLE}) reported no error but did not persist.`);
          }
        }
        continue;
      }

      const row = existing[0];
      const needsVariable = row.ID_VARIABLE === null && v.ID_VARIABLE !== null;
      const needsInstrument = row.ID_INSTRUMENT === null && instrumentId !== null;
      if (needsVariable || needsInstrument) {
        summary.backfilled.push(`${key}: ID_MAPPING=${row.ID_MAPPING}` +
          (needsVariable ? ` ID_VARIABLE->${v.ID_VARIABLE}` : '') +
          (needsInstrument ? ` ID_INSTRUMENT->${instrumentId}` : ''));
        if (!args.dryRun) {
          const sets = [];
          const params = [];
          if (needsVariable) { sets.push('ID_VARIABLE = ?'); params.push(v.ID_VARIABLE); }
          if (needsInstrument) { sets.push('ID_INSTRUMENT = ?'); params.push(instrumentId); }
          params.push(row.ID_MAPPING);
          await query(db, `UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET ${sets.join(', ')} WHERE ID_MAPPING = ?`, params);
        }
      } else {
        summary.alreadyLinked.push(key);
      }
    }

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary:`);
    console.log(`  inserted (new rows):      ${summary.inserted.length}`);
    summary.inserted.forEach((s) => console.log(`    + ${s}`));
    console.log(`  backfilled (FK filled):   ${summary.backfilled.length}`);
    summary.backfilled.forEach((s) => console.log(`    ~ ${s}`));
    console.log(`  already linked:           ${summary.alreadyLinked.length}${summary.alreadyLinked.length ? ' (' + summary.alreadyLinked.join(', ') + ')' : ''}`);
    console.log(`  excluded by design:       ${summary.excluded.length}`);
    summary.excluded.forEach((s) => console.log(`    - ${s}`));
    console.log(`  UNKNOWN (needs a human):  ${summary.unknown.length}`);
    summary.unknown.forEach((s) => console.log(`    ? ${s}`));

    if (summary.unknown.length > 0) {
      console.log('\nAdd the columns above to knowledge.js (a level + justification, or an ' +
        '{ excluded: true, reason } entry) and re-run to load them.');
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
