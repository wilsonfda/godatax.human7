#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_NEW_STUDY_DW
 *
 * Loads ONE study's data from the five OLTP schemas under GDX_HUMAN into the
 * star schema in this folder (godatax_human_dw_model_firebird25.sql):
 *   2.relational.model.psychometrics  -> GDX_PSY_*
 *   3.septenary.constitution          -> GDX_PSY_SEPTENARY_LEVEL / GDX_PSY_SEPT_LEVEL_PSY_MAP
 *   4.kundalini.chakras               -> GDX_PSY_CHAKRA
 *   5.five.ways.tomas.aquino          -> GDX_TA_WAY / GDX_TA_WAY_SEPT_MAP
 *   6.cardiac.coherence               -> GDX_CC_*
 *
 * This is NOT the same thing as godatax_human_dw_etl_firebird25.sql (this
 * folder). That script is a one-shot, whole-database, non-idempotent build
 * ("truncate the DW_* tables first if you need to reload" -- see
 * GoDataX_Human_7_DW.md section 7, item 4). This skill is the opposite shape,
 * matching every other skill in the "onboard a new study" family
 * (GDX_SKILL_LOAD_SEPT_MAPS_DB, GDX_SKILL_LOAD_CC_MAPS_DB,
 * GDX_SKILL_LOAD_NEW_STUDY_ANSWERS): scoped to ONE study passed via --study,
 * insert-if-missing everywhere, safe to run again later for the same study
 * (e.g. after more participants have answered) without truncating anything
 * or duplicating rows.
 *
 * Scope resolution: like GDX_SKILL_LOAD_SEPT_MAPS_DB and
 * GDX_SKILL_EXPORT_NEW_STUDY, this reads new_study_intake/<slug>/intake.json
 * to know exactly which instruments/constructs/variables belong to this
 * study (GDX_PSY_INSTRUMENT/CONSTRUCT/VARIABLE are global catalogs with no
 * ID_STUDY column), then resolves each one's real id in Firebird by name.
 * GDX_PSY_APPLICATION does carry ID_STUDY directly, so the two fact tables
 * sourced from it are scoped with a plain WHERE. Cardiac-coherence sessions
 * are scoped through GDX_PSY_STUDY_PARTICIPANT (populated by
 * GDX_SKILL_LOAD_CC_MAPS_DB), since GDX_CC_SESSION itself has no ID_STUDY
 * column either.
 *
 * What is NOT scoped by study (bootstrapped once, shared by every study):
 *   DW_DIM_DATE, DW_DIM_SEPTENARY_LEVEL, DW_DIM_CHAKRA, DW_DIM_FIVE_WAY --
 *   these are global reference dimensions (a calendar, the 7 levels, the 7
 *   chakras, the 5 ways), not study-specific. Bootstrapped once (insert-if-
 *   missing per row) and left untouched on later runs for other studies.
 *
 * Usage:
 *   node load_new_study_dw.js --study <slug> [--dry-run] [--intake-dir <path>]
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, dryRun: false };
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
      'new_study_intake/<slug>/intake.json -- this skill only loads that one study\'s ' +
      'dimensions/facts into the DW, never a full rebuild.'
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

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (7.multidimensional.database/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/scripts). */
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

/** Same .sav-column / variable-name key rule as GDX_SKILL_LOAD_SEPT_MAPS_DB's
 * resolveMappingKey(): a variable loaded from a historical .sav file has
 * "'.sav column: <col> (...)" as its OPERATIONAL_DEFINITION; a variable
 * onboarded via GDX_SKILL_NEW_STUDY never does, and GDX_SKILL_LOAD_SEPT_MAPS_DB
 * keys its GDX_PSY_SEPT_LEVEL_PSY_MAP.VARIABLE_LABEL by the variable's own
 * NAME in that case. This must match exactly or the DW's level reconciliation
 * would silently fail to resolve a new study's variables. */
function parseSavColumn(operationalDefinition) {
  if (!operationalDefinition) return null;
  const marker = '.sav column: ';
  const start = operationalDefinition.indexOf(marker);
  if (start !== 0) return null;
  const tail = operationalDefinition.slice(marker.length);
  const parenPos = tail.indexOf(' (');
  return (parenPos === -1 ? tail : tail.slice(0, parenPos)).trim();
}

async function exists(db, table, whereSql, params) {
  const rows = await query(db, `SELECT 1 FROM ${table} WHERE ${whereSql}`, params);
  return rows.length > 0;
}

/** Generic insert-if-missing: checks a single-column key, inserts only if
 * absent, and files the outcome under summary.inserted/reused. */
async function upsertRow(db, dryRun, summary, label, table, keyCol, keyVal, insertSql, insertParams) {
  const already = await exists(db, table, `${keyCol} = ?`, [keyVal]);
  if (already) { summary.reused.push(label); return false; }
  summary.inserted.push(label);
  if (!dryRun) await query(db, insertSql, insertParams);
  return true;
}

async function findInstrument(db, name, version) {
  const rows = await query(db,
    'SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE FROM GDX_PSY_INSTRUMENT WHERE NAME = ?', [name]);
  const wanted = version || null;
  return rows.find((r) => (r.VERSION || null) === wanted) || null;
}
async function findConstruct(db, name) {
  const rows = await query(db, 'SELECT FIRST 1 ID_CONSTRUCT, NAME, DOMAIN FROM GDX_PSY_CONSTRUCT WHERE NAME = ?', [name]);
  return rows[0] || null;
}
async function findVariable(db, constructId, name) {
  const rows = await query(db,
    'SELECT FIRST 1 ID_VARIABLE, NAME, OPERATIONAL_DEFINITION, ID_CONSTRUCT FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = ? AND NAME = ?',
    [constructId, name]);
  return rows[0] || null;
}

/** Fallback scope resolution for a study with no new_study_intake/<slug>/
 * intake.json "instruments" section -- i.e. a study that predates the
 * GDX_SKILL_NEW_STUDY interview pipeline entirely (loaded the older way, via
 * GDX_SKILL_LOAD_RLT_MODEL_DB's .sav import). There is nothing to read the
 * scope FROM in that case, so this derives it from what is actually applied
 * for this study in the OLTP instead: every GDX_PSY_VARIABLE that has at
 * least one real GDX_PSY_VARIABLE_RESULT row through this study's
 * applications. This is deliberately narrower than "every variable that
 * exists" -- it picks up exactly the variables this study has real computed
 * results for (including ones added after the study's original load, e.g. a
 * variable backfilled from raw item responses later), nothing hypothetical
 * and nothing borrowed from another study. */
async function resolveScopeFromDatabase(db, studyId) {
  const varRows = await query(db, `
    SELECT DISTINCT V.ID_VARIABLE, V.NAME, V.OPERATIONAL_DEFINITION, V.ID_CONSTRUCT
    FROM GDX_PSY_VARIABLE V
    JOIN GDX_PSY_VARIABLE_RESULT VR ON VR.ID_VARIABLE = V.ID_VARIABLE
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`, [studyId]);

  const constructs = new Map(); // ID_CONSTRUCT -> row
  const instrumentIds = new Set();
  const variables = [];
  for (const v of varRows) {
    if (!constructs.has(v.ID_CONSTRUCT)) {
      const cRows = await query(db, 'SELECT ID_CONSTRUCT, NAME, DOMAIN FROM GDX_PSY_CONSTRUCT WHERE ID_CONSTRUCT = ?', [v.ID_CONSTRUCT]);
      if (cRows[0]) constructs.set(v.ID_CONSTRUCT, cRows[0]);
    }
    // Same FIRST-1 instrument resolution godatax_human_dw_etl_firebird25.sql
    // uses for DW_DIM_VARIABLE.ID_INSTRUMENT (1:1 in this dataset today).
    const instRows = await query(db,
      'SELECT FIRST 1 ID_INSTRUMENT FROM GDX_PSY_INSTRUMENT_CONSTRUCT WHERE ID_CONSTRUCT = ?', [v.ID_CONSTRUCT]);
    const instrumentId = instRows[0] ? instRows[0].ID_INSTRUMENT : null;
    if (instrumentId !== null) instrumentIds.add(instrumentId);
    variables.push({ ...v, ID_INSTRUMENT: instrumentId });
  }

  const instruments = [];
  for (const id of instrumentIds) {
    const rows = await query(db, 'SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ?', [id]);
    if (rows[0]) instruments.push(rows[0]);
  }

  const items = [];
  for (const inst of instruments) {
    const rows = await query(db,
      'SELECT ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, RESPONSE_TYPE FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ?',
      [inst.ID_INSTRUMENT]);
    items.push(...rows);
  }

  return { instruments, constructs: [...constructs.values()], variables, items, derivedFromDatabase: true };
}

/** Resolves the intake's instruments/constructs/variables/items against the
 * real Firebird rows GDX_SKILL_RECORD_NEW_STUDY already created. Throws
 * (rather than skipping) if something the intake describes isn't in the
 * database yet -- same discipline as GDX_SKILL_LOAD_SEPT_MAPS_DB. Falls back
 * to resolveScopeFromDatabase() for a study whose intake.json has no
 * "instruments" section at all (see that function's own comment). */
async function resolveScope(db, intake, studyId) {
  if (!intake.instruments || intake.instruments.length === 0) {
    return resolveScopeFromDatabase(db, studyId);
  }
  const instruments = [];
  const constructs = new Map(); // NAME -> row
  const variables = []; // { ...row, ID_INSTRUMENT }

  for (const instrumentIntake of intake.instruments) {
    const instRow = await findInstrument(db, instrumentIntake.name, instrumentIntake.version);
    if (!instRow) {
      throw new Error(
        `Instrument "${instrumentIntake.name}"${instrumentIntake.version ? ` (version ${instrumentIntake.version})` : ''} ` +
        `not found in GDX_PSY_INSTRUMENT. Run GDX_SKILL_RECORD_NEW_STUDY for this intake before this skill.`
      );
    }
    instruments.push(instRow);

    if (!instrumentIntake.constructs || instrumentIntake.constructs.length === 0) {
      // Minimal intake entry: this instrument was reused verbatim, not onboarded through the full
      // interview (no new GDX_PSY_CONSTRUCT/GDX_PSY_VARIABLE rows were ever created for it -- see
      // e.g. new_study_intake/burnout-test-2/intake.json's own comment). There is nothing to read
      // constructs/variables FROM here, so derive them from what this study's applications actually
      // have real GDX_PSY_VARIABLE_RESULT rows for -- same "nothing hypothetical, nothing borrowed
      // from another study" discipline as resolveScopeFromDatabase() above, just scoped to this one
      // instrument instead of the whole study (a study can mix a fully-onboarded instrument with a
      // reused one, so this can't just fall back to the whole-study function).
      const varRows = await query(db, `
        SELECT DISTINCT V.ID_VARIABLE, V.NAME, V.OPERATIONAL_DEFINITION, V.ID_CONSTRUCT
        FROM GDX_PSY_VARIABLE V
        JOIN GDX_PSY_INSTRUMENT_CONSTRUCT IC ON IC.ID_CONSTRUCT = V.ID_CONSTRUCT
        JOIN GDX_PSY_VARIABLE_RESULT VR ON VR.ID_VARIABLE = V.ID_VARIABLE
        JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
        WHERE IC.ID_INSTRUMENT = ? AND A.ID_STUDY = ?`, [instRow.ID_INSTRUMENT, studyId]);
      for (const v of varRows) {
        const cRows = await query(db, 'SELECT ID_CONSTRUCT, NAME, DOMAIN FROM GDX_PSY_CONSTRUCT WHERE ID_CONSTRUCT = ?', [v.ID_CONSTRUCT]);
        const constructRow = cRows[0];
        if (constructRow && !constructs.has(constructRow.NAME)) constructs.set(constructRow.NAME, constructRow);
        variables.push({
          ID_VARIABLE: v.ID_VARIABLE, NAME: v.NAME, OPERATIONAL_DEFINITION: v.OPERATIONAL_DEFINITION,
          ID_CONSTRUCT: v.ID_CONSTRUCT, ID_INSTRUMENT: instRow.ID_INSTRUMENT,
        });
      }
      continue;
    }

    for (const c of instrumentIntake.constructs) {
      if (constructs.has(c.name)) continue;
      const constructRow = await findConstruct(db, c.name);
      if (!constructRow) {
        throw new Error(`Construct "${c.name}" not found in GDX_PSY_CONSTRUCT. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
      }
      constructs.set(c.name, constructRow);
    }

    for (const v of instrumentIntake.variables) {
      const constructRow = constructs.get(v.construct_name);
      if (!constructRow) {
        throw new Error(`Variable "${v.name}" references construct "${v.construct_name}", which was not declared in this instrument's constructs[].`);
      }
      const varRow = await findVariable(db, constructRow.ID_CONSTRUCT, v.name);
      if (!varRow) {
        throw new Error(`Variable "${v.name}" (construct "${v.construct_name}") not found in GDX_PSY_VARIABLE. Run GDX_SKILL_RECORD_NEW_STUDY first.`);
      }
      variables.push({ ...varRow, ID_INSTRUMENT: instRow.ID_INSTRUMENT });
    }
  }

  const items = [];
  for (const inst of instruments) {
    const rows = await query(db,
      'SELECT ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, RESPONSE_TYPE FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ?',
      [inst.ID_INSTRUMENT]);
    items.push(...rows);
  }

  return { instruments, constructs: [...constructs.values()], variables, items };
}

/* ----------------------------------------------------------------------------
 * Global reference dimensions -- bootstrapped once, shared by every study.
 * -------------------------------------------------------------------------- */

async function bootstrapDate(db, dryRun, summary) {
  const count = await query(db, 'SELECT COUNT(*) AS CNT FROM DW_DIM_DATE');
  if (Number(count[0].CNT) > 0) { summary.reused.push('DW_DIM_DATE (already populated)'); return; }
  summary.inserted.push('DW_DIM_DATE (2020-01-01..2030-12-31 + DATE_KEY=-1 sentinel)');
  if (dryRun) return;
  await query(db,
    'INSERT INTO DW_DIM_DATE (DATE_KEY, FULL_DATE, YEAR_NUM, MONTH_NUM, DAY_NUM, WEEKDAY_NUM) VALUES (-1, NULL, NULL, NULL, NULL, NULL)');
  await query(db, `
    EXECUTE BLOCK AS
    DECLARE VARIABLE D DATE;
    BEGIN
      D = DATE '2020-01-01';
      WHILE (D <= DATE '2030-12-31') DO
      BEGIN
        INSERT INTO DW_DIM_DATE (DATE_KEY, FULL_DATE, YEAR_NUM, MONTH_NUM, DAY_NUM, WEEKDAY_NUM)
        VALUES (EXTRACT(YEAR FROM :D) * 10000 + EXTRACT(MONTH FROM :D) * 100 + EXTRACT(DAY FROM :D),
                :D, EXTRACT(YEAR FROM :D), EXTRACT(MONTH FROM :D), EXTRACT(DAY FROM :D), EXTRACT(WEEKDAY FROM :D));
        D = D + 1;
      END
    END`);
}

async function bootstrapSeptenaryLevels(db, dryRun, summary) {
  const rows = await query(db,
    'SELECT ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION FROM GDX_PSY_SEPTENARY_LEVEL');
  for (const r of rows) {
    await upsertRow(db, dryRun, summary, `DW_DIM_SEPTENARY_LEVEL: ${r.NAME}`,
      'DW_DIM_SEPTENARY_LEVEL', 'ID_SEPTENARY_LEVEL', r.ID_SEPTENARY_LEVEL,
      `INSERT INTO DW_DIM_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION) VALUES (?, ?, ?, ?, ?, ?)`,
      [r.ID_SEPTENARY_LEVEL, r.ORDER_NUM, r.NAME, r.TECHNICAL_NAME, r.NATURE, r.CONSCIOUSNESS_FUNCTION]);
  }
}

async function bootstrapChakras(db, dryRun, summary) {
  const rows = await query(db,
    'SELECT ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT, ID_SEPTENARY_LEVEL FROM GDX_PSY_CHAKRA');
  for (const r of rows) {
    await upsertRow(db, dryRun, summary, `DW_DIM_CHAKRA: ${r.SANSKRIT_NAME}`,
      'DW_DIM_CHAKRA', 'ID_CHAKRA', r.ID_CHAKRA,
      `INSERT INTO DW_DIM_CHAKRA (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT, ID_SEPTENARY_LEVEL) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.ID_CHAKRA, r.ORDER_NUM, r.SANSKRIT_NAME, r.COMMON_NAME, r.SYMBOLIC_COLOR, r.SYMBOLIC_ELEMENT, r.ID_SEPTENARY_LEVEL]);
  }
}

async function bootstrapFiveWays(db, dryRun, summary) {
  const rows = await query(db, 'SELECT ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, CONCLUSION FROM GDX_TA_WAY');
  for (const r of rows) {
    const levelRows = await query(db, 'SELECT FIRST 1 ID_SEPTENARY_LEVEL FROM GDX_TA_WAY_SEPT_MAP WHERE ID_WAY = ?', [r.ID_WAY]);
    const levelId = levelRows[0] ? levelRows[0].ID_SEPTENARY_LEVEL : null;
    await upsertRow(db, dryRun, summary, `DW_DIM_FIVE_WAY: ${r.LATIN_NAME}`,
      'DW_DIM_FIVE_WAY', 'ID_WAY', r.ID_WAY,
      `INSERT INTO DW_DIM_FIVE_WAY (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, CONCLUSION, ID_SEPTENARY_LEVEL) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.ID_WAY, r.ORDER_NUM, r.LATIN_NAME, r.ENGLISH_NAME, r.ARGUMENT_TYPE, r.CONCLUSION, levelId]);
  }
}

/* ----------------------------------------------------------------------------
 * Study-scoped dimensions and facts.
 * -------------------------------------------------------------------------- */

async function loadPersons(db, studyId, dryRun, summary) {
  const rows = await query(db, `
    SELECT P.ID_PERSON, P.EXTERNAL_IDENTIFIER, SP.ANONYMOUS_CODE, SP.EXPERIMENTAL_GROUP, SP.ID_STUDY, ST.TITLE
    FROM GDX_PSY_PERSON P
    JOIN GDX_PSY_STUDY_PARTICIPANT SP ON SP.ID_PERSON = P.ID_PERSON AND SP.ID_STUDY = ?
    JOIN GDX_PSY_STUDY ST ON ST.ID_STUDY = SP.ID_STUDY`, [studyId]);
  for (const r of rows) {
    await upsertRow(db, dryRun, summary, `DW_DIM_PERSON: ID_PERSON=${r.ID_PERSON}`,
      'DW_DIM_PERSON', 'ID_PERSON', r.ID_PERSON,
      `INSERT INTO DW_DIM_PERSON (ID_PERSON, EXTERNAL_IDENTIFIER, ANONYMOUS_CODE, CURRICULAR_GROUP, ID_STUDY, STUDY_TITLE) VALUES (?, ?, ?, ?, ?, ?)`,
      [r.ID_PERSON, r.EXTERNAL_IDENTIFIER, r.ANONYMOUS_CODE, r.EXPERIMENTAL_GROUP, r.ID_STUDY, r.TITLE]);
  }
  return rows.map((r) => r.ID_PERSON);
}

async function loadInstrumentsAndConstructs(db, scope, dryRun, summary) {
  for (const inst of scope.instruments) {
    await upsertRow(db, dryRun, summary, `DW_DIM_INSTRUMENT: ${inst.NAME}`,
      'DW_DIM_INSTRUMENT', 'ID_INSTRUMENT', inst.ID_INSTRUMENT,
      `INSERT INTO DW_DIM_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE) VALUES (?, ?, ?, ?, ?)`,
      [inst.ID_INSTRUMENT, inst.NAME, inst.VERSION, inst.TYPE, inst.ACTIVE]);
  }
  for (const c of scope.constructs) {
    await upsertRow(db, dryRun, summary, `DW_DIM_CONSTRUCT: ${c.NAME}`,
      'DW_DIM_CONSTRUCT', 'ID_CONSTRUCT', c.ID_CONSTRUCT,
      `INSERT INTO DW_DIM_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN) VALUES (?, ?, ?)`,
      [c.ID_CONSTRUCT, c.NAME, c.DOMAIN]);
  }
}

async function loadVariables(db, scope, dryRun, summary) {
  for (const v of scope.variables) {
    const savColumn = parseSavColumn(v.OPERATIONAL_DEFINITION);
    const inserted = await upsertRow(db, dryRun, summary, `DW_DIM_VARIABLE: ${v.NAME}`,
      'DW_DIM_VARIABLE', 'ID_VARIABLE', v.ID_VARIABLE,
      `INSERT INTO DW_DIM_VARIABLE (ID_VARIABLE, NAME, SAV_COLUMN, ID_CONSTRUCT, ID_INSTRUMENT) VALUES (?, ?, ?, ?, ?)`,
      [v.ID_VARIABLE, v.NAME, savColumn, v.ID_CONSTRUCT, v.ID_INSTRUMENT]);

    // Septenary-level reconciliation -- same dual key rule as
    // GDX_SKILL_LOAD_SEPT_MAPS_DB's resolveMappingKey(): a .sav column match
    // when there is one, otherwise an exact match on the variable's own name.
    const current = await query(db, 'SELECT ID_SEPTENARY_LEVEL FROM DW_DIM_VARIABLE WHERE ID_VARIABLE = ?', [v.ID_VARIABLE]);
    const alreadyResolved = !inserted && current.length > 0 && current[0].ID_SEPTENARY_LEVEL !== null;
    if (alreadyResolved) { summary.reused.push(`DW_DIM_VARIABLE level: ${v.NAME} already resolved`); continue; }

    let levelRows;
    if (savColumn) {
      levelRows = await query(db,
        `SELECT FIRST 1 ID_SEPTENARY_LEVEL, CONFIDENCE_LEVEL FROM GDX_PSY_SEPT_LEVEL_PSY_MAP WHERE VARIABLE_LABEL CONTAINING (?)`,
        [`-> ${savColumn}`]);
    } else {
      levelRows = await query(db,
        `SELECT FIRST 1 ID_SEPTENARY_LEVEL, CONFIDENCE_LEVEL FROM GDX_PSY_SEPT_LEVEL_PSY_MAP WHERE VARIABLE_LABEL = ?`,
        [v.NAME]);
    }
    if (levelRows.length === 0) {
      summary.unresolvedLevel.push(`${v.NAME}: no GDX_PSY_SEPT_LEVEL_PSY_MAP row yet (run GDX_SKILL_LOAD_SEPT_MAPS_DB --study <slug> first if a septenary mapping is wanted)`);
      continue;
    }
    summary.inserted.push(`DW_DIM_VARIABLE level: ${v.NAME} -> level ${levelRows[0].ID_SEPTENARY_LEVEL}`);
    if (!dryRun) {
      await query(db, 'UPDATE DW_DIM_VARIABLE SET ID_SEPTENARY_LEVEL = ?, SEPT_LEVEL_CONFIDENCE = ? WHERE ID_VARIABLE = ?',
        [levelRows[0].ID_SEPTENARY_LEVEL, levelRows[0].CONFIDENCE_LEVEL, v.ID_VARIABLE]);
    }
  }
}

async function loadItems(db, scope, dryRun, summary) {
  for (const item of scope.items) {
    await upsertRow(db, dryRun, summary, `DW_DIM_ITEM: ID_ITEM=${item.ID_ITEM} (order ${item.ITEM_ORDER})`,
      'DW_DIM_ITEM', 'ID_ITEM', item.ID_ITEM,
      `INSERT INTO DW_DIM_ITEM (ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, RESPONSE_TYPE) VALUES (?, ?, ?, ?)`,
      [item.ID_ITEM, item.ID_INSTRUMENT, item.ITEM_ORDER, item.RESPONSE_TYPE]);
  }
}

async function loadDevicesAndSessions(db, personIds, dryRun, summary) {
  if (personIds.length === 0) return [];
  const placeholders = personIds.map(() => '?').join(',');
  const sessions = await query(db, `
    SELECT S.SESSION_ID, S.ID_PERSON, S.DEVICE_ID, S.SIGNAL_TYPE, S.PROTOCOL_NAME, S.BODY_POSITION,
           S.ALGORITHM_NAME, S.STARTED_AT, S.ENDED_AT
    FROM GDX_CC_SESSION S
    WHERE S.ID_PERSON IN (${placeholders})`, personIds);

  const deviceIds = [...new Set(sessions.map((s) => s.DEVICE_ID))];
  for (const deviceId of deviceIds) {
    const deviceRows = await query(db,
      'SELECT DEVICE_ID, MANUFACTURER, MODEL_NAME, DEVICE_TYPE, FIRMWARE_VERSION FROM GDX_CC_DEVICE WHERE DEVICE_ID = ?',
      [deviceId]);
    const d = deviceRows[0];
    if (!d) continue;
    await upsertRow(db, dryRun, summary, `DW_DIM_DEVICE: ${d.MANUFACTURER} ${d.MODEL_NAME}`,
      'DW_DIM_DEVICE', 'DEVICE_ID', d.DEVICE_ID,
      `INSERT INTO DW_DIM_DEVICE (DEVICE_ID, MANUFACTURER, MODEL_NAME, DEVICE_TYPE, FIRMWARE_VERSION) VALUES (?, ?, ?, ?, ?)`,
      [d.DEVICE_ID, d.MANUFACTURER, d.MODEL_NAME, d.DEVICE_TYPE, d.FIRMWARE_VERSION]);
  }

  const loadedSessionIds = [];
  for (const s of sessions) {
    const inserted = await upsertRow(db, dryRun, summary, `DW_DIM_SESSION: SESSION_ID=${s.SESSION_ID}`,
      'DW_DIM_SESSION', 'SESSION_ID', s.SESSION_ID,
      `INSERT INTO DW_DIM_SESSION (SESSION_ID, ID_PERSON, DEVICE_ID, SIGNAL_TYPE, PROTOCOL_NAME, BODY_POSITION, ALGORITHM_NAME, STARTED_AT, ENDED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.SESSION_ID, s.ID_PERSON, s.DEVICE_ID, s.SIGNAL_TYPE, s.PROTOCOL_NAME, s.BODY_POSITION, s.ALGORITHM_NAME, s.STARTED_AT, s.ENDED_AT]);
    loadedSessionIds.push(s.SESSION_ID);
    void inserted;
  }
  return loadedSessionIds;
}

async function loadItemResponseFacts(db, studyId, dryRun, summary) {
  const rows = await query(db, `
    SELECT A.ID_PERSON, R.ID_ITEM, I.ID_INSTRUMENT, R.ID_APPLICATION, R.NUMERIC_VALUE
    FROM GDX_PSY_ITEM_RESPONSE R
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = R.ID_APPLICATION
    JOIN GDX_PSY_INSTRUMENT_ITEM I ON I.ID_ITEM = R.ID_ITEM
    WHERE A.ID_STUDY = ?`, [studyId]);

  for (const r of rows) {
    const existing = await query(db,
      'SELECT ID_APPLICATION FROM DW_FACT_PSY_ITEM_RESPONSE WHERE ID_PERSON = ? AND ID_ITEM = ?',
      [r.ID_PERSON, r.ID_ITEM]);
    if (existing.length > 0) {
      if (existing[0].ID_APPLICATION !== r.ID_APPLICATION) {
        summary.factGrainCollisions.push(
          `DW_FACT_PSY_ITEM_RESPONSE: (ID_PERSON=${r.ID_PERSON}, ID_ITEM=${r.ID_ITEM}) already has a fact ` +
          `from ID_APPLICATION=${existing[0].ID_APPLICATION}; this study's ID_APPLICATION=${r.ID_APPLICATION} ` +
          `was NOT loaded (the fact's grain is person+item, not person+item+application).`);
      } else {
        summary.reused.push(`DW_FACT_PSY_ITEM_RESPONSE: (ID_PERSON=${r.ID_PERSON}, ID_ITEM=${r.ID_ITEM})`);
      }
      continue;
    }
    summary.inserted.push(`DW_FACT_PSY_ITEM_RESPONSE: (ID_PERSON=${r.ID_PERSON}, ID_ITEM=${r.ID_ITEM})`);
    if (!dryRun) {
      await query(db,
        `INSERT INTO DW_FACT_PSY_ITEM_RESPONSE (ID_PERSON, ID_ITEM, ID_INSTRUMENT, ID_APPLICATION, NUMERIC_VALUE) VALUES (?, ?, ?, ?, ?)`,
        [r.ID_PERSON, r.ID_ITEM, r.ID_INSTRUMENT, r.ID_APPLICATION, r.NUMERIC_VALUE]);
    }
  }
}

async function loadVariableResultFacts(db, studyId, dryRun, summary) {
  const rows = await query(db, `
    SELECT A.ID_PERSON, VR.ID_VARIABLE, VR.ID_APPLICATION, VR.RAW_SCORE, VR.STANDARDIZED_SCORE, VR.PERCENTILE
    FROM GDX_PSY_VARIABLE_RESULT VR
    JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION
    WHERE A.ID_STUDY = ?`, [studyId]);

  for (const r of rows) {
    const existing = await query(db,
      'SELECT ID_APPLICATION FROM DW_FACT_PSY_VARIABLE_RESULT WHERE ID_PERSON = ? AND ID_VARIABLE = ?',
      [r.ID_PERSON, r.ID_VARIABLE]);
    if (existing.length > 0) {
      if (existing[0].ID_APPLICATION !== r.ID_APPLICATION) {
        summary.factGrainCollisions.push(
          `DW_FACT_PSY_VARIABLE_RESULT: (ID_PERSON=${r.ID_PERSON}, ID_VARIABLE=${r.ID_VARIABLE}) already has a ` +
          `fact from a different ID_APPLICATION; this study's result was NOT loaded.`);
      } else {
        summary.reused.push(`DW_FACT_PSY_VARIABLE_RESULT: (ID_PERSON=${r.ID_PERSON}, ID_VARIABLE=${r.ID_VARIABLE})`);
      }
      continue;
    }
    summary.inserted.push(`DW_FACT_PSY_VARIABLE_RESULT: (ID_PERSON=${r.ID_PERSON}, ID_VARIABLE=${r.ID_VARIABLE})`);
    if (!dryRun) {
      await query(db,
        `INSERT INTO DW_FACT_PSY_VARIABLE_RESULT (ID_PERSON, ID_VARIABLE, ID_APPLICATION, RAW_SCORE, STANDARDIZED_SCORE, PERCENTILE) VALUES (?, ?, ?, ?, ?, ?)`,
        [r.ID_PERSON, r.ID_VARIABLE, r.ID_APPLICATION, r.RAW_SCORE, r.STANDARDIZED_SCORE, r.PERCENTILE]);
    }
  }
  if (rows.length === 0) {
    summary.notes.push('DW_FACT_PSY_VARIABLE_RESULT: no GDX_PSY_VARIABLE_RESULT rows for this study yet ' +
      '(expected until a scoring step computes them -- GDX_SKILL_LOAD_NEW_STUDY_ANSWERS deliberately does not).');
  }
}

async function loadHrvWindowFacts(db, sessionIds, dryRun, summary) {
  for (const sessionId of sessionIds) {
    const already = await query(db, 'SELECT COUNT(*) AS CNT FROM DW_FACT_CC_HRV_WINDOW WHERE SESSION_ID = ?', [sessionId]);
    if (Number(already[0].CNT) > 0) {
      summary.reused.push(`DW_FACT_CC_HRV_WINDOW: SESSION_ID=${sessionId} (already loaded)`);
      continue;
    }

    const sessionPerson = await query(db, 'SELECT ID_PERSON FROM DW_DIM_SESSION WHERE SESSION_ID = ?', [sessionId]);
    const personId = sessionPerson[0].ID_PERSON;
    const windows = await query(db, `
      SELECT WINDOW_STARTED_AT, WINDOW_SECONDS, VALID_BEAT_COUNT, MEAN_RR_MS, MEAN_HEART_RATE_BPM,
             RMSSD_MS, SDNN_MS, RESPIRATORY_RATE, COHERENCE_INDEX, ARTIFACT_PERCENTAGE, PROTOCOL_PHASE, STRESS_CLASS
      FROM GDX_CC_HRV_WINDOW WHERE SESSION_ID = ?`, [sessionId]);

    for (const w of windows) {
      const d = new Date(w.WINDOW_STARTED_AT);
      const dateKey = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
      const dateExists = await query(db, 'SELECT 1 FROM DW_DIM_DATE WHERE DATE_KEY = ?', [dateKey]);
      const finalDateKey = dateExists.length > 0 ? dateKey : -1;
      if (dateExists.length === 0) {
        summary.notes.push(`DW_FACT_CC_HRV_WINDOW: window in SESSION_ID=${sessionId} started outside the ` +
          `2020-2030 calendar (${w.WINDOW_STARTED_AT}) -- used DATE_KEY=-1 instead of failing the FK.`);
      }

      summary.inserted.push(`DW_FACT_CC_HRV_WINDOW: SESSION_ID=${sessionId} @ ${w.WINDOW_STARTED_AT}`);
      if (!dryRun) {
        await query(db, `
          INSERT INTO DW_FACT_CC_HRV_WINDOW
            (ID_PERSON, SESSION_ID, DATE_KEY, WINDOW_SECONDS, VALID_BEAT_COUNT, MEAN_RR_MS, MEAN_HEART_RATE_BPM,
             RMSSD_MS, SDNN_MS, RESPIRATORY_RATE, COHERENCE_INDEX, ARTIFACT_PERCENTAGE, PROTOCOL_PHASE, STRESS_CLASS)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [personId, sessionId, finalDateKey, w.WINDOW_SECONDS, w.VALID_BEAT_COUNT, w.MEAN_RR_MS, w.MEAN_HEART_RATE_BPM,
            w.RMSSD_MS, w.SDNN_MS, w.RESPIRATORY_RATE, w.COHERENCE_INDEX, w.ARTIFACT_PERCENTAGE, w.PROTOCOL_PHASE, w.STRESS_CLASS]);
      }
    }
  }
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

    const scope = await resolveScope(db, intake, studyId);
    if (scope.derivedFromDatabase) {
      console.log(`No "instruments" section in this study's intake.json -- scope derived directly from ` +
        `GDX_PSY_VARIABLE_RESULT/GDX_PSY_APPLICATION for ID_STUDY=${studyId} instead.`);
    }
    console.log(`Scope: study "${studyTitle}" (slug "${args.study}", ID_STUDY=${studyId}), ` +
      `${scope.instruments.length} instrument(s), ${scope.variables.length} variable(s), ${scope.items.length} item(s).`);

    const summary = { inserted: [], reused: [], unresolvedLevel: [], factGrainCollisions: [], notes: [] };

    console.log('\n-- Global reference dimensions (bootstrap once, shared by every study) --');
    await bootstrapDate(db, args.dryRun, summary);
    await bootstrapSeptenaryLevels(db, args.dryRun, summary);
    await bootstrapChakras(db, args.dryRun, summary);
    await bootstrapFiveWays(db, args.dryRun, summary);

    console.log('-- Study-scoped dimensions --');
    const personIds = await loadPersons(db, studyId, args.dryRun, summary);
    await loadInstrumentsAndConstructs(db, scope, args.dryRun, summary);
    await loadVariables(db, scope, args.dryRun, summary);
    await loadItems(db, scope, args.dryRun, summary);
    const sessionIds = await loadDevicesAndSessions(db, personIds, args.dryRun, summary);

    console.log('-- Study-scoped facts --');
    await loadItemResponseFacts(db, studyId, args.dryRun, summary);
    await loadVariableResultFacts(db, studyId, args.dryRun, summary);
    await loadHrvWindowFacts(db, sessionIds, args.dryRun, summary);

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Summary:`);
    console.log(`  inserted (new rows): ${summary.inserted.length}`);
    summary.inserted.forEach((s) => console.log(`    + ${s}`));
    console.log(`  reused (already present): ${summary.reused.length}`);
    if (summary.unresolvedLevel.length > 0) {
      console.log(`  variables with no septenary level yet: ${summary.unresolvedLevel.length}`);
      summary.unresolvedLevel.forEach((s) => console.log(`    ? ${s}`));
    }
    if (summary.factGrainCollisions.length > 0) {
      console.log(`  fact grain collisions (needs a human): ${summary.factGrainCollisions.length}`);
      summary.factGrainCollisions.forEach((s) => console.log(`    ! ${s}`));
    }
    if (summary.notes.length > 0) {
      console.log(`  notes: ${summary.notes.length}`);
      summary.notes.forEach((s) => console.log(`    - ${s}`));
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
