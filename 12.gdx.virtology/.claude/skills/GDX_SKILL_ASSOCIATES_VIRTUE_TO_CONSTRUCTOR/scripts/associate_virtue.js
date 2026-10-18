#!/usr/bin/env node
/**
 * GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR
 *
 * Writes ONE interpretive correspondence at a time between a variable already
 * in GDX_PSY_VARIABLE (2.relational.model.psychometrics -- any VARIABLE_TYPE,
 * psychometric or metaphysical) and ONE of the 33 Virtology virtues
 * (GDX_VT_VIRTUE), as a row in GDX_VT_VARIABLE_VIRTUE_MAP
 * (12.gdx.virtology/virtology_model_firebird25.sql).
 *
 * Same interactive, never-invent-the-judgment-call shape as
 * 14.metaphysical.measuring.instrument's GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS
 * (which does the same thing for Septenary level / Way of Aquinas / Chakra) --
 * this is its Virtology-specific sibling, kept separate because
 * GDX_VT_VARIABLE_VIRTUE_MAP's shape genuinely differs from the other three
 * "_MAP" tables: no ID_INSTRUMENT/INSTRUMENT_LABEL, a NOT NULL SAV_COLUMN
 * instead, and TWO justification columns (JUSTIFICATION_DEFICIT /
 * JUSTIFICATION_STRENGTH) instead of one CORRESPONDENCE_JUSTIFICATION.
 *
 * Usage:
 *   node associate_virtue.js --variable "<name or partial name>" --virtue <1-33> \
 *     --behavior "<text>" --justification-deficit "<text>" --justification-strength "<text>" \
 *     --scale-polarity POSITIVE|NEGATIVE --confirmed-by "<name>" --institution "<name>" \
 *     [--confidence HIGH|MEDIUM|LOW|SPECULATIVE] [--sav-column <override>] [--dry-run]
 *
 *   node associate_virtue.js --update <id_mapping> \
 *     [--behavior "<text>"] [--justification-deficit "<text>"] [--justification-strength "<text>"] \
 *     [--confidence ...] [--scale-polarity POSITIVE|NEGATIVE] [--dry-run]
 *
 *   node associate_virtue.js --confirm <id_mapping> \
 *     --confirmed-by "<name>" --institution "<name>" [--dry-run]
 *
 * Flags:
 *   --variable <text>          Searches GDX_PSY_VARIABLE.NAME (CONTAINING, case-insensitive).
 *                               Must resolve to exactly one row, or pass --variable-id instead.
 *   --variable-id <id>         Exact GDX_PSY_VARIABLE.ID_VARIABLE, skips the search.
 *   --virtue <1-33>            Required for a new row. GDX_VT_VIRTUE.ORDER_NUM.
 *   --behavior <text>          RECORDED_BEHAVIOR. Required for a new row.
 *   --justification-deficit <text>   JUSTIFICATION_DEFICIT (low score -> antidote framing,
 *                               the one GDX_SKILL_LINK_SUGGESTIONS reads). Required for a new row.
 *   --justification-strength <text>  JUSTIFICATION_STRENGTH (high score -> already-present
 *                               framing, the one GDX_SKILL_IDENTIFY_VIRTUES reads). Required
 *                               for a new row. Both justifications are asked -- never one
 *                               inferred from the other.
 *   --scale-polarity <POSITIVE|NEGATIVE>   SCALE_POLARITY. Required for a new row -- never
 *                               defaulted by this script even though the column itself defaults
 *                               to POSITIVE at the schema level (variable_virtue_map_polarity_
 *                               firebird25.sql). POSITIVE: a high RAW_SCORE on this variable is
 *                               desirable (the common case). NEGATIVE: a high RAW_SCORE is
 *                               undesirable (e.g. Negative Emotions) -- GDX_SKILL_LINK_SUGGESTIONS
 *                               then reads a HIGH score as the deficit and GDX_SKILL_IDENTIFY_VIRTUES
 *                               reads a LOW score as the strength for this variable, inverted
 *                               from the POSITIVE case. This is a judgment call about what the
 *                               variable itself measures, same as --behavior -- never guessed
 *                               from the variable's name.
 *   --confidence <level>       CONFIDENCE_LEVEL, one of HIGH/MEDIUM/LOW/SPECULATIVE.
 *                               Default: SPECULATIVE (same default as the schema).
 *   --confirmed-by <name>      CONFIRMATION_BY. Required to insert a new row (the creator's
 *                               own confirmation) and required with --confirm. Never invented.
 *   --institution <name>       NAME_INSTITUTION. Required alongside --confirmed-by, same rule.
 *   --sav-column <text>        Override SAV_COLUMN (default: resolved live from
 *                               DW_DIM_VARIABLE.SAV_COLUMN for this variable). SAV_COLUMN is
 *                               NOT NULL on this table -- required when the variable has no
 *                               DW_DIM_VARIABLE row yet (e.g. a brand-new metaphysical
 *                               variable never loaded into the DW).
 *   --variable-label <text>    Override VARIABLE_LABEL (default: the variable's own NAME).
 *   --update <id_mapping>      Update an existing row's content instead of inserting a new
 *                               one. Only the fields passed are changed. Does NOT touch
 *                               NUMBER_CONFIRMATIONS -- that is what --confirm is for.
 *   --confirm <id_mapping>     Records a new, independent corroboration of an EXISTING row:
 *                               increments NUMBER_CONFIRMATIONS by exactly +1 and sets
 *                               CONFIRMATION_BY/NAME_INSTITUTION to this confirmer (the most
 *                               recent one). Does not touch RECORDED_BEHAVIOR/
 *                               JUSTIFICATION_DEFICIT/JUSTIFICATION_STRENGTH/CONFIDENCE_LEVEL --
 *                               use --update for that. Mutually exclusive with --update.
 *   --allow-duplicate           Required to insert a second row for a variable that already
 *                               has ANY row in GDX_VT_VARIABLE_VIRTUE_MAP. Without it, an
 *                               existing row blocks the insert (shown, nothing written).
 *   --dry-run                  Prints exactly what would be written/changed. Writes nothing.
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const Firebird = require('node-firebird');

const VALID_CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW', 'SPECULATIVE'];
const VALID_POLARITY = ['POSITIVE', 'NEGATIVE'];
const VIRTUE_RANGE = [1, 33];

function parseArgs(argv) {
  const args = {
    variable: null,
    variableId: null,
    virtue: null,
    behavior: null,
    justificationDeficit: null,
    justificationStrength: null,
    scalePolarity: null,
    // null (not 'SPECULATIVE') until the user actually passes --confidence -- doUpdate's
    // "only SET columns the caller actually asked to change" logic needs to tell "explicitly
    // SPECULATIVE" apart from "not mentioned at all". The schema's own SPECULATIVE default is
    // applied in doInsert instead, where it belongs (every new row needs a value either way).
    confidence: null,
    confirmedBy: null,
    institution: null,
    savColumn: null,
    variableLabel: null,
    update: null,
    confirm: null,
    allowDuplicate: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--variable') args.variable = argv[++i];
    else if (a === '--variable-id') args.variableId = parseInt(argv[++i], 10);
    else if (a === '--virtue') args.virtue = parseInt(argv[++i], 10);
    else if (a === '--behavior') args.behavior = argv[++i];
    else if (a === '--justification-deficit') args.justificationDeficit = argv[++i];
    else if (a === '--justification-strength') args.justificationStrength = argv[++i];
    else if (a === '--scale-polarity') args.scalePolarity = argv[++i];
    else if (a === '--confidence') args.confidence = argv[++i];
    else if (a === '--confirmed-by') args.confirmedBy = argv[++i];
    else if (a === '--institution') args.institution = argv[++i];
    else if (a === '--sav-column') args.savColumn = argv[++i];
    else if (a === '--variable-label') args.variableLabel = argv[++i];
    else if (a === '--update') args.update = parseInt(argv[++i], 10);
    else if (a === '--confirm') args.confirm = parseInt(argv[++i], 10);
    else if (a === '--allow-duplicate') args.allowDuplicate = true;
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }

  if (args.confidence !== null && !VALID_CONFIDENCE.includes(args.confidence)) {
    throw new Error(`--confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);
  }
  if (args.scalePolarity !== null && !VALID_POLARITY.includes(args.scalePolarity)) {
    throw new Error(`--scale-polarity must be one of: ${VALID_POLARITY.join(', ')}`);
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
    if (!args.virtue) {
      throw new Error(`--virtue <${VIRTUE_RANGE[0]}-${VIRTUE_RANGE[1]}> is required to insert a new association.`);
    }
    if (!args.behavior || !args.justificationDeficit || !args.justificationStrength) {
      throw new Error('--behavior, --justification-deficit, and --justification-strength are all required ' +
        'to insert a new association -- this skill never invents the recorded behavior or either ' +
        'justification framing.');
    }
    if (!args.scalePolarity) {
      throw new Error(`--scale-polarity <${VALID_POLARITY.join('|')}> is required to insert a new ` +
        'association -- this skill never defaults it silently, even though the column itself ' +
        'defaults to POSITIVE at the schema level. Whether a high score on this variable is ' +
        'desirable or not is a judgment call about what it measures, same as --behavior.');
    }
    if (!args.confirmedBy || !args.institution) {
      throw new Error('--confirmed-by "<name>" and --institution "<name>" are required to insert a new ' +
        'association -- creating it counts as its first confirmation, and this skill never invents ' +
        'who made it.');
    }
  } else {
    if (!args.behavior && !args.justificationDeficit && !args.justificationStrength &&
        !args.scalePolarity && !args.confidence) {
      throw new Error('--update requires at least one of --behavior/--justification-deficit/' +
        '--justification-strength/--scale-polarity/--confidence to change.');
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
 * JUSTIFICATION_DEFICIT / JUSTIFICATION_STRENGTH (BLOB SUB_TYPE TEXT
 * columns): node-firebird's `?` parameter binding is unreliable for BLOB
 * TEXT columns -- the driver's callback can report success while the row
 * never actually persists. Same finding and same workaround as
 * GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/scripts/associate_variable.js's
 * esc() comment. Every value in this script's INSERT/UPDATE statements is
 * inlined through esc() for this reason, not just the BLOB columns. */
function esc(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function escNum(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

/** Resolves the variable plus its DW_DIM_VARIABLE.SAV_COLUMN (left join --
 * absent for a variable never loaded into the DW, e.g. a brand-new
 * metaphysical variable; --sav-column then becomes required). */
async function resolveVariable(db, args) {
  const baseSelect = `
    SELECT V.ID_VARIABLE AS ID_VARIABLE, V.NAME AS NAME, V.VARIABLE_TYPE AS VARIABLE_TYPE,
           V.ID_CONSTRUCT AS ID_CONSTRUCT, C.NAME AS CONSTRUCT_NAME, DV.SAV_COLUMN AS SAV_COLUMN
    FROM GDX_PSY_VARIABLE V
    JOIN GDX_PSY_CONSTRUCT C ON C.ID_CONSTRUCT = V.ID_CONSTRUCT
    LEFT JOIN DW_DIM_VARIABLE DV ON DV.ID_VARIABLE = V.ID_VARIABLE`;

  if (args.variableId) {
    const rows = await query(db, `${baseSelect} WHERE V.ID_VARIABLE = ?`, [args.variableId]);
    if (rows.length === 0) throw new Error(`No GDX_PSY_VARIABLE with ID_VARIABLE = ${args.variableId}.`);
    return rows[0];
  }
  const rows = await query(db, `${baseSelect} WHERE V.NAME CONTAINING ? ORDER BY V.NAME`, [args.variable]);
  if (rows.length === 0) {
    throw new Error(`No GDX_PSY_VARIABLE.NAME contains "${args.variable}". Check spelling, or search more broadly.`);
  }
  if (rows.length > 1) {
    const list = rows.map((r) => `  ID_VARIABLE=${r.ID_VARIABLE}  ${r.NAME}  (${r.VARIABLE_TYPE}, construct "${r.CONSTRUCT_NAME}", SAV_COLUMN=${r.SAV_COLUMN || 'NULL'})`).join('\n');
    throw new Error(`"${args.variable}" matches ${rows.length} variables, pick one with --variable-id:\n${list}`);
  }
  return rows[0];
}

async function resolveVirtue(db, orderNum) {
  const rows = await query(db, `SELECT ID_VIRTUE AS ID, NAME_PT AS NAME_PT, NAME_EN AS NAME_EN FROM GDX_VT_VIRTUE WHERE ORDER_NUM = ?`, [orderNum]);
  if (rows.length === 0) {
    throw new Error(`No GDX_VT_VIRTUE row with ORDER_NUM = ${orderNum} (expected ${VIRTUE_RANGE[0]}-${VIRTUE_RANGE[1]}).`);
  }
  return rows[0];
}

/** Checks for an existing row for this variable, by SAV_COLUMN (the
 * table's UNIQUE constraint) and/or by ID_VARIABLE, since a variable
 * without a resolvable SAV_COLUMN could otherwise slip past a SAV_COLUMN-
 * only check. */
async function findExisting(db, savColumn, variableId) {
  const rows = await query(db,
    `SELECT * FROM GDX_VT_VARIABLE_VIRTUE_MAP WHERE SAV_COLUMN = ? OR (ID_VARIABLE IS NOT NULL AND ID_VARIABLE = ?)`,
    [savColumn, variableId]);
  return rows;
}

async function doUpdate(db, args) {
  const existing = await query(db, `SELECT * FROM GDX_VT_VARIABLE_VIRTUE_MAP WHERE ID_MAPPING = ?`, [args.update]);
  if (existing.length === 0) {
    throw new Error(`No row in GDX_VT_VARIABLE_VIRTUE_MAP with ID_MAPPING = ${args.update}.`);
  }
  const row = existing[0];
  const sets = [];
  if (args.behavior) sets.push(`RECORDED_BEHAVIOR = ${esc(args.behavior)}`);
  if (args.justificationDeficit) sets.push(`JUSTIFICATION_DEFICIT = ${esc(args.justificationDeficit)}`);
  if (args.justificationStrength) sets.push(`JUSTIFICATION_STRENGTH = ${esc(args.justificationStrength)}`);
  if (args.scalePolarity) sets.push(`SCALE_POLARITY = ${esc(args.scalePolarity)}`);
  if (args.confidence) sets.push(`CONFIDENCE_LEVEL = ${esc(args.confidence)}`);

  const sql = `UPDATE GDX_VT_VARIABLE_VIRTUE_MAP SET ${sets.join(', ')} WHERE ID_MAPPING = ${escNum(args.update)}`;

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}${sql}`);
  console.log('Current row:', row);

  if (args.dryRun) return;

  await query(db, sql);
  console.log(`Updated GDX_VT_VARIABLE_VIRTUE_MAP.ID_MAPPING = ${args.update}.`);
}

/** Records a new, independent corroboration of an EXISTING row: increments
 * NUMBER_CONFIRMATIONS by exactly +1 and overwrites CONFIRMATION_BY/
 * NAME_INSTITUTION with this confirmer (the column only tracks the most
 * recent confirmer). Never touches RECORDED_BEHAVIOR/JUSTIFICATION_DEFICIT/
 * JUSTIFICATION_STRENGTH/CONFIDENCE_LEVEL -- that is doUpdate's job. */
async function doConfirm(db, args) {
  const existing = await query(db, `SELECT * FROM GDX_VT_VARIABLE_VIRTUE_MAP WHERE ID_MAPPING = ?`, [args.confirm]);
  if (existing.length === 0) {
    throw new Error(`No row in GDX_VT_VARIABLE_VIRTUE_MAP with ID_MAPPING = ${args.confirm}.`);
  }
  const row = existing[0];
  const newCount = (row.NUMBER_CONFIRMATIONS || 0) + 1;

  const sql = `UPDATE GDX_VT_VARIABLE_VIRTUE_MAP SET NUMBER_CONFIRMATIONS = ${escNum(newCount)}, ` +
    `CONFIRMATION_BY = ${esc(args.confirmedBy)}, NAME_INSTITUTION = ${esc(args.institution)} ` +
    `WHERE ID_MAPPING = ${escNum(args.confirm)}`;

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}Confirming GDX_VT_VARIABLE_VIRTUE_MAP.ID_MAPPING = ${args.confirm}`);
  console.log(`  NUMBER_CONFIRMATIONS: ${row.NUMBER_CONFIRMATIONS} -> ${newCount}`);
  console.log(`  Confirmed by: "${args.confirmedBy}"  (${args.institution})`);
  console.log('Current row:', row);
  console.log(`\n${sql}`);

  if (args.dryRun) return;

  await query(db, sql);
  console.log(`\nConfirmed. GDX_VT_VARIABLE_VIRTUE_MAP.ID_MAPPING = ${args.confirm}, NUMBER_CONFIRMATIONS now ${newCount}.`);
}

async function doInsert(db, args) {
  const variableRow = await resolveVariable(db, args);
  const virtueRow = await resolveVirtue(db, args.virtue);
  // Only doInsert applies the schema's own SPECULATIVE default -- doUpdate must tell "not
  // mentioned" apart from "explicitly SPECULATIVE", so args.confidence itself stays null there.
  const confidence = args.confidence || 'SPECULATIVE';

  const savColumn = args.savColumn || variableRow.SAV_COLUMN;
  if (!savColumn) {
    throw new Error(
      `Variable "${variableRow.NAME}" (ID_VARIABLE=${variableRow.ID_VARIABLE}) has no SAV_COLUMN in ` +
      `DW_DIM_VARIABLE. GDX_VT_VARIABLE_VIRTUE_MAP.SAV_COLUMN is NOT NULL -- pass --sav-column <text> ` +
      `explicitly (e.g. for a metaphysical variable never loaded into the DW yet).`
    );
  }
  const variableLabel = args.variableLabel || variableRow.NAME;

  const existing = await findExisting(db, savColumn, variableRow.ID_VARIABLE);
  if (existing.length > 0 && !args.allowDuplicate) {
    const list = existing.map((r) => `  ID_MAPPING=${r.ID_MAPPING}  ID_VIRTUE=${r.ID_VIRTUE}  SAV_COLUMN=${r.SAV_COLUMN}  CONFIDENCE_LEVEL=${r.CONFIDENCE_LEVEL}  NUMBER_CONFIRMATIONS=${r.NUMBER_CONFIRMATIONS}`).join('\n');
    throw new Error(
      `Variable "${variableRow.NAME}" (ID_VARIABLE=${variableRow.ID_VARIABLE}, SAV_COLUMN=${savColumn}) ` +
      `already has ${existing.length} row(s) in GDX_VT_VARIABLE_VIRTUE_MAP:\n${list}\n` +
      `Pass --update <id_mapping> to change one of these rows' content, --confirm <id_mapping> to add a ` +
      `corroboration without changing content, or --allow-duplicate to add another on purpose.`
    );
  }

  const columns = ['ID_VIRTUE', 'ID_VARIABLE', 'SAV_COLUMN', 'VARIABLE_LABEL', 'RECORDED_BEHAVIOR',
    'JUSTIFICATION_DEFICIT', 'JUSTIFICATION_STRENGTH', 'SCALE_POLARITY', 'CONFIDENCE_LEVEL',
    'NUMBER_CONFIRMATIONS', 'CONFIRMATION_BY', 'NAME_INSTITUTION'];
  const values = [escNum(virtueRow.ID), escNum(variableRow.ID_VARIABLE), esc(savColumn), esc(variableLabel),
    esc(args.behavior), esc(args.justificationDeficit), esc(args.justificationStrength), esc(args.scalePolarity),
    esc(confidence), '1', esc(args.confirmedBy), esc(args.institution)];

  const sql = `INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP (${columns.join(', ')}) VALUES (${values.join(', ')})`;

  console.log(`${args.dryRun ? '[DRY RUN] ' : ''}Resolved:`);
  console.log(`  Variable:   ID_VARIABLE=${variableRow.ID_VARIABLE}  "${variableRow.NAME}"  (${variableRow.VARIABLE_TYPE}, construct "${variableRow.CONSTRUCT_NAME}")`);
  console.log(`  SAV_COLUMN: ${savColumn}${args.savColumn ? ' (explicit override)' : ' (resolved from DW_DIM_VARIABLE)'}`);
  console.log(`  Virtue:     ID_VIRTUE=${virtueRow.ID}  ORDER_NUM=${args.virtue}  -> "${virtueRow.NAME_PT}" (${virtueRow.NAME_EN})`);
  console.log(`  Polarity:   ${args.scalePolarity}${args.scalePolarity === 'NEGATIVE' ? '  (a HIGH score on this variable is the deficit, a LOW score is the strength -- inverted from the usual case)' : ''}`);
  console.log(`  Confidence: ${confidence}`);
  console.log(`  Confirmed by: "${args.confirmedBy}"  (${args.institution})  -- NUMBER_CONFIRMATIONS starts at 1`);
  console.log(`\n${sql}`);

  if (args.dryRun) return;

  await query(db, sql);

  const check = await query(db, `SELECT COUNT(*) AS CNT FROM GDX_VT_VARIABLE_VIRTUE_MAP WHERE SAV_COLUMN = ?`, [savColumn]);
  if (check[0].CNT === 0) {
    throw new Error(`INSERT reported no error but the row did not persist (SAV_COLUMN=${savColumn}).`);
  }
  console.log(`\nInserted into GDX_VT_VARIABLE_VIRTUE_MAP.`);
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
