#!/usr/bin/env node
/**
 * GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS
 *
 * Writes ONE interpretive correspondence at a time between a variable
 * already in GDX_PSY_VARIABLE (2.relational.model.psychometrics -- any
 * VARIABLE_TYPE, psychometric or metaphysical) and one of:
 *   - a Septenary Constitution level -> GDX_PSY_SEPT_LEVEL_PSY_MAP
 *     (3.septenary.constitution)
 *   - a Way of Thomas Aquinas        -> GDX_TA_WAY_SEPT_MAP
 *     (5.five.ways.tomas.aquino, extended by
 *     14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql)
 *   - a Kundalini Chakra             -> GDX_PSY_CHAKRA_VAR_MAP
 *     (14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql
 *     -- apply that DDL once before using --target chakra, it is NOT run by
 *     this script)
 *
 * Unlike GDX_SKILL_LOAD_SEPT_MAPS_DB (batch, one whole study at a time,
 * backed by a hand-edited knowledge.js), this skill is interactive and
 * variable-at-a-time: the level/way/chakra, the recorded behavior and the
 * justification are always supplied by the caller (asked by Claude in
 * conversation, grounded in a live lookup of the variable and the target
 * catalog) -- this script never guesses any of them.
 *
 * Usage:
 *   node associate_variable.js --variable "<name or partial name>" --target septenary --level <1-7> \
 *     --behavior "<text>" --justification "<text>" --confirmed-by "<name>" --institution "<name>" \
 *     [--confidence HIGH|MEDIUM|LOW|SPECULATIVE] [--dry-run]
 *
 *   node associate_variable.js --variable-id <id> --target way --way <1-5> \
 *     --behavior "<text>" --justification "<text>" --confirmed-by "<name>" --institution "<name>" [--dry-run]
 *
 *   node associate_variable.js --variable-id <id> --target chakra --chakra <1-7> \
 *     --behavior "<text>" --justification "<text>" --confirmed-by "<name>" --institution "<name>" [--dry-run]
 *
 *   node associate_variable.js --update <id_mapping> --target <septenary|way|chakra> \
 *     [--behavior "<text>"] [--justification "<text>"] [--confidence ...] [--dry-run]
 *
 *   node associate_variable.js --confirm <id_mapping> --target <septenary|way|chakra> \
 *     --confirmed-by "<name>" --institution "<name>" [--dry-run]
 *
 * Flags:
 *   --variable <text>        Searches GDX_PSY_VARIABLE.NAME (CONTAINING, case-insensitive).
 *                             Must resolve to exactly one row, or pass --variable-id instead.
 *   --variable-id <id>       Exact GDX_PSY_VARIABLE.ID_VARIABLE, skips the search.
 *   --target <kind>          Required. One of: septenary | way | chakra.
 *   --level <1-7>            Required when --target septenary. GDX_PSY_SEPTENARY_LEVEL.ORDER_NUM.
 *   --way <1-5>               Required when --target way. GDX_TA_WAY.ORDER_NUM. The septenary
 *                             level is NOT asked -- it is read from that way's existing
 *                             conceptual row in GDX_TA_WAY_SEPT_MAP (VARIABLE_LABEL IS NULL).
 *   --chakra <1-7>            Required when --target chakra. GDX_PSY_CHAKRA.ORDER_NUM.
 *   --behavior <text>         RECORDED_BEHAVIOR. Required for a new row.
 *   --justification <text>    CORRESPONDENCE_JUSTIFICATION. Required for a new row.
 *   --confidence <level>      CONFIDENCE_LEVEL, one of HIGH/MEDIUM/LOW/SPECULATIVE.
 *                             Default: SPECULATIVE (same default as the schema).
 *   --confirmed-by <name>     CONFIRMATION_BY. Required to insert a new association (the
 *                             creator's own confirmation) and required with --confirm.
 *                             Never invented -- always asked.
 *   --institution <name>      NAME_INSTITUTION. Required alongside --confirmed-by, same rule.
 *   --variable-label <text>   Override VARIABLE_LABEL (default: the variable's own NAME).
 *   --instrument-label <text> Override INSTRUMENT_LABEL (default: resolved instrument NAME,
 *                             or the construct's NAME if the variable's construct isn't
 *                             linked to exactly one instrument).
 *   --instrument-id <id>      Disambiguates which GDX_PSY_INSTRUMENT to use when the
 *                             variable's construct is linked to more than one.
 *   --update <id_mapping>     Update an existing row's content instead of inserting a new one.
 *                             Requires --target (tables are not globally unique by id).
 *                             Only the fields passed (--behavior/--justification/--confidence)
 *                             are changed. Does NOT touch NUMBER_CONFIRMATIONS -- that is what
 *                             --confirm is for.
 *   --confirm <id_mapping>    Records a new, independent corroboration of an EXISTING row:
 *                             increments that row's NUMBER_CONFIRMATIONS by exactly +1 and sets
 *                             CONFIRMATION_BY/NAME_INSTITUTION to this confirmer (the most
 *                             recent one). Does not touch RECORDED_BEHAVIOR/
 *                             CORRESPONDENCE_JUSTIFICATION/CONFIDENCE_LEVEL -- use --update for
 *                             that. Mutually exclusive with --update.
 *   --allow-duplicate         Required to insert a second row for a variable that already
 *                             has ANY row in the chosen target table. Without it, an existing
 *                             row blocks the insert (shown, nothing written) so a duplicate is
 *                             never created by accident.
 *   --dry-run                 Prints exactly what would be written/changed. Writes nothing.
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const Firebird = require('node-firebird');

const VALID_TARGETS = ['septenary', 'way', 'chakra'];
const VALID_CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW', 'SPECULATIVE'];

const TARGET_CONFIG = {
  septenary: {
    table: 'GDX_PSY_SEPT_LEVEL_PSY_MAP',
    targetIdColumn: 'ID_SEPTENARY_LEVEL',
    orderFlag: 'level',
    catalogTable: 'GDX_PSY_SEPTENARY_LEVEL',
    catalogIdColumn: 'ID_SEPTENARY_LEVEL',
    catalogNameColumn: 'NAME',
    catalogRange: [1, 7],
  },
  way: {
    table: 'GDX_TA_WAY_SEPT_MAP',
    targetIdColumn: 'ID_WAY',
    orderFlag: 'way',
    catalogTable: 'GDX_TA_WAY',
    catalogIdColumn: 'ID_WAY',
    catalogNameColumn: 'ENGLISH_NAME',
    catalogRange: [1, 5],
  },
  chakra: {
    table: 'GDX_PSY_CHAKRA_VAR_MAP',
    targetIdColumn: 'ID_CHAKRA',
    orderFlag: 'chakra',
    catalogTable: 'GDX_PSY_CHAKRA',
    catalogIdColumn: 'ID_CHAKRA',
    catalogNameColumn: 'COMMON_NAME',
    catalogRange: [1, 7],
  },
};

function parseArgs(argv) {
  const args = {
    variable: null,
    variableId: null,
    target: null,
    level: null,
    way: null,
    chakra: null,
    behavior: null,
    justification: null,
    confidence: 'SPECULATIVE',
    confirmedBy: null,
    institution: null,
    variableLabel: null,
    instrumentLabel: null,
    instrumentId: null,
    update: null,
    confirm: null,
    allowDuplicate: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--variable') args.variable = argv[++i];
    else if (a === '--variable-id') args.variableId = parseInt(argv[++i], 10);
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--level') args.level = parseInt(argv[++i], 10);
    else if (a === '--way') args.way = parseInt(argv[++i], 10);
    else if (a === '--chakra') args.chakra = parseInt(argv[++i], 10);
    else if (a === '--behavior') args.behavior = argv[++i];
    else if (a === '--justification') args.justification = argv[++i];
    else if (a === '--confidence') args.confidence = argv[++i];
    else if (a === '--confirmed-by') args.confirmedBy = argv[++i];
    else if (a === '--institution') args.institution = argv[++i];
    else if (a === '--variable-label') args.variableLabel = argv[++i];
    else if (a === '--instrument-label') args.instrumentLabel = argv[++i];
    else if (a === '--instrument-id') args.instrumentId = parseInt(argv[++i], 10);
    else if (a === '--update') args.update = parseInt(argv[++i], 10);
    else if (a === '--confirm') args.confirm = parseInt(argv[++i], 10);
    else if (a === '--allow-duplicate') args.allowDuplicate = true;
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }

  if (!args.target || !VALID_TARGETS.includes(args.target)) {
    throw new Error(`--target is required and must be one of: ${VALID_TARGETS.join(', ')}`);
  }
  if (!VALID_CONFIDENCE.includes(args.confidence)) {
    throw new Error(`--confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);
  }
  if (args.update !== null && args.confirm !== null) {
    throw new Error('--update and --confirm are mutually exclusive -- pick one. ' +
      '--update changes the recorded content; --confirm only adds a corroboration.');
  }

  if (args.confirm !== null) {
    if (!args.confirmedBy || !args.institution) {
      throw new Error('--confirmed-by "<name>" and --institution "<name>" are required to confirm an ' +
        'existing association -- this skill never invents who is confirming it.');
    }
  } else if (args.update === null) {
    if (!args.variable && !args.variableId) {
      throw new Error('--variable "<text>" or --variable-id <id> is required to insert a new association.');
    }
    if (!args.behavior || !args.justification) {
      throw new Error('--behavior and --justification are required to insert a new association ' +
        '-- this skill never invents the recorded behavior or the correspondence justification.');
    }
    if (!args.confirmedBy || !args.institution) {
      throw new Error('--confirmed-by "<name>" and --institution "<name>" are required to insert a new ' +
        'association -- creating it counts as its first confirmation, and this skill never invents ' +
        'who made it.');
    }
    const cfg = TARGET_CONFIG[args.target];
    const orderValue = args[cfg.orderFlag];
    if (!orderValue) {
      throw new Error(`--${cfg.orderFlag} <${cfg.catalogRange[0]}-${cfg.catalogRange[1]}> is required when --target ${args.target}.`);
    }
  } else {
    if (!args.behavior && !args.justification && args.confidence === 'SPECULATIVE') {
      throw new Error('--update requires at least one of --behavior/--justification/--confidence to change.');
    }
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

/** Escapes a value for literal inclusion in a SQL string (doubles single
 * quotes). Used for every INSERT/UPDATE touching RECORDED_BEHAVIOR /
 * CORRESPONDENCE_JUSTIFICATION (BLOB SUB_TYPE TEXT columns): node-firebird's
 * `?` parameter binding is unreliable for BLOB TEXT columns -- the driver's
 * callback can report success while the row never actually persists. Same
 * finding and same workaround as GDX_SKILL_LOAD_SEPT_MAPS_DB's
 * scripts/load_sept_maps.js (see its esc() comment). Every value in this
 * script's INSERT/UPDATE statements is inlined through esc() for this
 * reason, not just the two BLOB columns. */
function esc(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function escNum(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

async function resolveVariable(db, args) {
  if (args.variableId) {
    const rows = await query(db,
      `SELECT V.ID_VARIABLE, V.NAME, V.VARIABLE_TYPE, V.ID_CONSTRUCT, C.NAME AS CONSTRUCT_NAME
       FROM GDX_PSY_VARIABLE V JOIN GDX_PSY_CONSTRUCT C ON C.ID_CONSTRUCT = V.ID_CONSTRUCT
       WHERE V.ID_VARIABLE = ?`, [args.variableId]);
    if (rows.length === 0) throw new Error(`No GDX_PSY_VARIABLE with ID_VARIABLE = ${args.variableId}.`);
    return rows[0];
  }
  const rows = await query(db,
    `SELECT V.ID_VARIABLE, V.NAME, V.VARIABLE_TYPE, V.ID_CONSTRUCT, C.NAME AS CONSTRUCT_NAME
     FROM GDX_PSY_VARIABLE V JOIN GDX_PSY_CONSTRUCT C ON C.ID_CONSTRUCT = V.ID_CONSTRUCT
     WHERE V.NAME CONTAINING ?
     ORDER BY V.NAME`, [args.variable]);
  if (rows.length === 0) {
    throw new Error(`No GDX_PSY_VARIABLE.NAME contains "${args.variable}". Check spelling, or search more broadly.`);
  }
  if (rows.length > 1) {
    const list = rows.map((r) => `  ID_VARIABLE=${r.ID_VARIABLE}  ${r.NAME}  (${r.VARIABLE_TYPE}, construct "${r.CONSTRUCT_NAME}")`).join('\n');
    throw new Error(`"${args.variable}" matches ${rows.length} variables, pick one with --variable-id:\n${list}`);
  }
  return rows[0];
}

/** Resolves ID_INSTRUMENT/INSTRUMENT_LABEL for a variable via its construct.
 * A construct can be linked to more than one instrument
 * (GDX_PSY_INSTRUMENT_CONSTRUCT is many-to-many) -- ambiguous cases require
 * --instrument-id. Zero links is not an error: ID_INSTRUMENT stays NULL and
 * INSTRUMENT_LABEL falls back to the construct's own name, same nullable-FK /
 * required-label pattern already used by all three association tables. */
async function resolveInstrument(db, variableRow, args) {
  if (args.instrumentLabel && !args.instrumentId) {
    return { id: null, label: args.instrumentLabel };
  }
  if (args.instrumentId) {
    const rows = await query(db, 'SELECT ID_INSTRUMENT, NAME FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ?', [args.instrumentId]);
    if (rows.length === 0) throw new Error(`No GDX_PSY_INSTRUMENT with ID_INSTRUMENT = ${args.instrumentId}.`);
    return { id: rows[0].ID_INSTRUMENT, label: args.instrumentLabel || rows[0].NAME };
  }
  const rows = await query(db,
    `SELECT I.ID_INSTRUMENT, I.NAME FROM GDX_PSY_INSTRUMENT_CONSTRUCT IC
     JOIN GDX_PSY_INSTRUMENT I ON I.ID_INSTRUMENT = IC.ID_INSTRUMENT
     WHERE IC.ID_CONSTRUCT = ?`, [variableRow.ID_CONSTRUCT]);
  if (rows.length === 1) {
    return { id: rows[0].ID_INSTRUMENT, label: rows[0].NAME };
  }
  if (rows.length > 1) {
    const list = rows.map((r) => `  ID_INSTRUMENT=${r.ID_INSTRUMENT}  ${r.NAME}`).join('\n');
    throw new Error(`Construct "${variableRow.CONSTRUCT_NAME}" is linked to ${rows.length} instruments, ` +
      `pick one with --instrument-id (or set --instrument-label to skip FK resolution):\n${list}`);
  }
  // No instrument link at all -- fall back to the construct's own name as the label.
  return { id: null, label: variableRow.CONSTRUCT_NAME };
}

async function resolveCatalogTarget(db, cfg, orderNum, target) {
  const rows = await query(db,
    `SELECT ${cfg.catalogIdColumn} AS ID, ${cfg.catalogNameColumn} AS NAME FROM ${cfg.catalogTable} WHERE ORDER_NUM = ?`,
    [orderNum]);
  if (rows.length === 0) {
    throw new Error(`No ${cfg.catalogTable} row with ORDER_NUM = ${orderNum} ` +
      `(expected ${cfg.catalogRange[0]}-${cfg.catalogRange[1]}).`);
  }
  return rows[0];
}

/** For --target way: the septenary level is never asked -- it is read from
 * that way's existing conceptual correspondence row (VARIABLE_LABEL IS NULL,
 * seeded by five_ways_septenary_map_firebird25.sql), so a variable's way
 * association can never silently contradict the Way<->Level mapping already
 * on record. */
async function resolveWaySeptenaryLevel(db, wayId) {
  const rows = await query(db,
    `SELECT ID_SEPTENARY_LEVEL FROM GDX_TA_WAY_SEPT_MAP WHERE ID_WAY = ? AND VARIABLE_LABEL IS NULL`,
    [wayId]);
  if (rows.length === 0) {
    throw new Error(`GDX_TA_WAY_SEPT_MAP has no conceptual (VARIABLE_LABEL IS NULL) row for ID_WAY = ${wayId}. ` +
      `This should have been seeded by five_ways_septenary_map_firebird25.sql -- check the table before continuing.`);
  }
  return rows[0].ID_SEPTENARY_LEVEL;
}

async function findExisting(db, cfg, variableId) {
  let rows;
  try {
    rows = await query(db, `SELECT * FROM ${cfg.table} WHERE ID_VARIABLE = ?`, [variableId]);
  } catch (err) {
    if (cfg.table === 'GDX_PSY_CHAKRA_VAR_MAP' && /unknown table|table unknown|not defined/i.test(err.message)) {
      throw new Error(
        `${cfg.table} does not exist yet. Apply ` +
        `14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql ` +
        `against the database once before using --target chakra.`
      );
    }
    throw err;
  }
  return rows;
}

async function doUpdate(db, args) {
  const cfg = TARGET_CONFIG[args.target];
  const existing = await query(db, `SELECT * FROM ${cfg.table} WHERE ID_MAPPING = ?`, [args.update]);
  if (existing.length === 0) {
    throw new Error(`No row in ${cfg.table} with ID_MAPPING = ${args.update}.`);
  }
  const row = existing[0];
  const sets = [];
  if (args.behavior) sets.push(`RECORDED_BEHAVIOR = ${esc(args.behavior)}`);
  if (args.justification) sets.push(`CORRESPONDENCE_JUSTIFICATION = ${esc(args.justification)}`);
  if (args.confidence) sets.push(`CONFIDENCE_LEVEL = ${esc(args.confidence)}`);

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE ID_MAPPING = ${args.update}`);
  console.log('Current row:', row);

  if (args.dryRun) return;

  await query(db, `UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE ID_MAPPING = ?`, [args.update]);
  console.log(`Updated ${cfg.table}.ID_MAPPING = ${args.update}.`);
}

async function doInsert(db, args) {
  const cfg = TARGET_CONFIG[args.target];
  const variableRow = await resolveVariable(db, args);
  const instrument = await resolveInstrument(db, variableRow, args);

  const orderNum = args[cfg.orderFlag];
  const catalogRow = await resolveCatalogTarget(db, cfg, orderNum, args.target);

  const variableLabel = args.variableLabel || variableRow.NAME;
  const instrumentLabel = args.instrumentLabel || instrument.label;

  const existing = await findExisting(db, cfg, variableRow.ID_VARIABLE);
  if (existing.length > 0 && !args.allowDuplicate) {
    const list = existing.map((r) => `  ID_MAPPING=${r.ID_MAPPING}  ${cfg.targetIdColumn}=${r[cfg.targetIdColumn]}  CONFIDENCE_LEVEL=${r.CONFIDENCE_LEVEL}  NUMBER_CONFIRMATIONS=${r.NUMBER_CONFIRMATIONS}`).join('\n');
    throw new Error(
      `Variable "${variableRow.NAME}" (ID_VARIABLE=${variableRow.ID_VARIABLE}) already has ${existing.length} ` +
      `row(s) in ${cfg.table}:\n${list}\n` +
      `Pass --update <id_mapping> to change one of these rows' content, --confirm <id_mapping> to add a ` +
      `corroboration without changing content, or --allow-duplicate to add another on purpose.`
    );
  }

  let targetIdValue;
  const columns = ['ID_INSTRUMENT', 'INSTRUMENT_LABEL', 'ID_VARIABLE', 'VARIABLE_LABEL',
    'RECORDED_BEHAVIOR', 'CORRESPONDENCE_JUSTIFICATION', 'CONFIDENCE_LEVEL',
    'NUMBER_CONFIRMATIONS', 'CONFIRMATION_BY', 'NAME_INSTITUTION'];
  const values = [escNum(instrument.id), esc(instrumentLabel), escNum(variableRow.ID_VARIABLE), esc(variableLabel),
    esc(args.behavior), esc(args.justification), esc(args.confidence),
    '1', esc(args.confirmedBy), esc(args.institution)];

  if (args.target === 'way') {
    targetIdValue = catalogRow.ID; // ID_WAY
    const levelId = await resolveWaySeptenaryLevel(db, targetIdValue);
    columns.unshift('ID_SEPTENARY_LEVEL');
    values.unshift(escNum(levelId));
    columns.unshift('ID_WAY');
    values.unshift(escNum(targetIdValue));
  } else {
    targetIdValue = catalogRow.ID;
    columns.unshift(cfg.targetIdColumn);
    values.unshift(escNum(targetIdValue));
  }

  const sql = `INSERT INTO ${cfg.table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}Resolved:`);
  console.log(`  Variable:   ID_VARIABLE=${variableRow.ID_VARIABLE}  "${variableRow.NAME}"  (${variableRow.VARIABLE_TYPE}, construct "${variableRow.CONSTRUCT_NAME}")`);
  console.log(`  Instrument: ID_INSTRUMENT=${instrument.id}  "${instrumentLabel}"`);
  console.log(`  Target:     ${args.target}  ${cfg.catalogTable}.ORDER_NUM=${orderNum}  -> "${catalogRow.NAME}"  (${cfg.targetIdColumn}=${targetIdValue})`);
  if (args.target === 'way') {
    console.log(`  Septenary level (from the way's conceptual row, not asked): ID_SEPTENARY_LEVEL=${values[1]}`);
  }
  console.log(`  Confidence: ${args.confidence}`);
  console.log(`  Confirmed by: "${args.confirmedBy}"  (${args.institution})  -- NUMBER_CONFIRMATIONS starts at 1`);
  console.log(`\n${sql}`);

  if (args.dryRun) return;

  await query(db, sql);

  const check = await query(db, `SELECT COUNT(*) AS CNT FROM ${cfg.table} WHERE ID_VARIABLE = ?`, [variableRow.ID_VARIABLE]);
  if (check[0].CNT === 0) {
    throw new Error(`INSERT reported no error but the row did not persist (ID_VARIABLE=${variableRow.ID_VARIABLE}).`);
  }
  console.log(`\nInserted into ${cfg.table}.`);
}

/** Records a new, independent corroboration of an EXISTING row: increments
 * NUMBER_CONFIRMATIONS by exactly +1 and overwrites CONFIRMATION_BY/
 * NAME_INSTITUTION with this confirmer (the column only tracks the most
 * recent confirmer, per confirmation_fields_association_maps_firebird25.sql's
 * header). Never touches RECORDED_BEHAVIOR/CORRESPONDENCE_JUSTIFICATION/
 * CONFIDENCE_LEVEL -- that is doUpdate's job, a deliberately separate
 * action from confirming. */
async function doConfirm(db, args) {
  const cfg = TARGET_CONFIG[args.target];
  const existing = await query(db, `SELECT * FROM ${cfg.table} WHERE ID_MAPPING = ?`, [args.confirm]);
  if (existing.length === 0) {
    throw new Error(`No row in ${cfg.table} with ID_MAPPING = ${args.confirm}.`);
  }
  const row = existing[0];
  const newCount = (row.NUMBER_CONFIRMATIONS || 0) + 1;

  const sql = `UPDATE ${cfg.table} SET NUMBER_CONFIRMATIONS = ${escNum(newCount)}, ` +
    `CONFIRMATION_BY = ${esc(args.confirmedBy)}, NAME_INSTITUTION = ${esc(args.institution)} ` +
    `WHERE ID_MAPPING = ${escNum(args.confirm)}`;

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}Confirming ${cfg.table}.ID_MAPPING = ${args.confirm}`);
  console.log(`  NUMBER_CONFIRMATIONS: ${row.NUMBER_CONFIRMATIONS} -> ${newCount}`);
  console.log(`  Confirmed by: "${args.confirmedBy}"  (${args.institution})`);
  console.log('Current row:', row);
  console.log(`\n${sql}`);

  if (args.dryRun) return;

  await query(db, sql);
  console.log(`\nConfirmed. ${cfg.table}.ID_MAPPING = ${args.confirm}, NUMBER_CONFIRMATIONS now ${newCount}.`);
}

async function main() {
  const args = parseArgs(process.argv);

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
    if (args.confirm !== null) {
      await doConfirm(db, args);
    } else if (args.update !== null) {
      await doUpdate(db, args);
    } else {
      await doInsert(db, args);
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
