/**
 * The explicit, hand-picked set of tables this skill is allowed to touch on
 * the web database. Deliberately NOT prefix-based (contrast
 * GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts/introspect.js's TABLE_PREFIXES) --
 * this skill pushes to a *shared* database, so which tables are in scope
 * must be a conscious list, never something a new table could join just by
 * matching a naming pattern.
 *
 * Scope: measurement instruments, constructs, variables, items; the
 * septenary-constitution levels, chakras, Thomas Aquinas's Five Ways, and
 * the 33 virtues; and every mapping/bridge table that records a
 * correspondence between those catalogs. Explicitly OUT of scope, and never
 * added here: GDX_PSY_STUDY*, GDX_PSY_PERSON, GDX_PSY_APPLICATION,
 * GDX_PSY_OBSERVATION, GDX_PSY_EVALUATION*, GDX_PSY_*_RESULT,
 * GDX_PSY_ITEM_RESPONSE, GDX_CC_* (cardiac-coherence sessions/samples are
 * per-person), DW_DIM_PERSON, DW_DIM_SESSION, DW_FACT_* -- anything that
 * identifies or carries data about a real participant.
 */

// Plain catalog/reference tables: upsert by primary key, local always wins
// on content. No confirmation bookkeeping -- these have no
// NUMBER_CONFIRMATIONS/CONFIRMATION_BY columns.
const CATALOG_TABLES = [
  'GDX_PSY_INSTRUMENT',
  'GDX_PSY_CONSTRUCT',
  'GDX_PSY_VARIABLE',
  'GDX_PSY_INSTRUMENT_ITEM',
  'GDX_PSY_INSTRUMENT_CONSTRUCT',
  'GDX_PSY_ITEM_ALTERNATIVE',
  'GDX_PSY_INDICATOR',
  'GDX_PSY_EVALUATOR',
  'GDX_PSY_ACTION',
  'GDX_PSY_PSYCHOMETRIC_PROPERTY',
  'GDX_PSY_SEPTENARY_LEVEL',
  'GDX_PSY_CHAKRA',
  'GDX_TA_WAY',
  'GDX_VT_VIRTUE',
  'DW_DIM_SEPTENARY_LEVEL',
  'DW_DIM_CHAKRA',
  'DW_DIM_FIVE_WAY',
  'DW_DIM_VIRTUE',
  'DW_DIM_INSTRUMENT',
  'DW_DIM_CONSTRUCT',
  'DW_DIM_VARIABLE',
  'DW_DIM_ITEM',
  'DW_BRIDGE_VARIABLE_VIRTUE',
  'DW_BRIDGE_VARIABLE_CHAKRA',
  'DW_BRIDGE_VARIABLE_WAY',
];

// Interpretation/mapping tables: every one of these carries
// NUMBER_CONFIRMATIONS (INTEGER DEFAULT 0) and CONFIRMATION_BY VARCHAR(160)
// -- see godatax_human_full_ddl_no_gdx_ead_firebird25.sql. Content columns
// still sync local -> web unconditionally; only the confirmation pair
// follows the IP-based increment rule (see sync_web.js syncConfirmationRow).
const CONFIRMATION_TABLES = [
  'GDX_PSY_SEPT_LEVEL_PSY_MAP',
  'GDX_PSY_CHAKRA_VAR_MAP',
  'GDX_TA_WAY_SEPT_MAP',
  'GDX_VT_VARIABLE_VIRTUE_MAP',
];

const ALL_TABLES = [...CATALOG_TABLES, ...CONFIRMATION_TABLES];

// Defense in depth: even if a future edit to CATALOG_TABLES/CONFIRMATION_TABLES
// above ever added one of these by mistake, sync_web.js's startup guard
// (assertNoParticipantTables) refuses to run rather than silently push
// participant data. Exact names for tables whose name alone doesn't carry a
// shared prefix; prefixes for the two families where every table under them
// is per-person (GDX_CC_ cardiac-coherence raw/session data, DW_FACT_ grain
// is always one fact row per person/session/response).
const FORBIDDEN_TABLES = [
  'GDX_PSY_STUDY',
  'GDX_PSY_STUDY_PARTICIPANT',
  'GDX_PSY_PERSON',
  'GDX_PSY_APPLICATION',
  'GDX_PSY_OBSERVATION',
  'GDX_PSY_EVALUATION',
  'GDX_PSY_EVALUATION_ACTION',
  'GDX_PSY_ITEM_RESPONSE',
  'GDX_PSY_VARIABLE_RESULT',
  'GDX_PSY_CONSTRUCT_RESULT',
  'GDX_PSY_INDICATOR_RESULT',
  'DW_DIM_PERSON',
  'DW_DIM_SESSION',
];
const FORBIDDEN_PREFIXES = ['GDX_CC_', 'DW_FACT_'];

/** Throws if `table` identifies or carries participant data, by exact name
 * or by prefix. Call this on every table name before it is ever read from
 * or written to -- see sync_web.js main(). */
function assertNotParticipantTable(table) {
  if (FORBIDDEN_TABLES.includes(table) || FORBIDDEN_PREFIXES.some((p) => table.startsWith(p))) {
    throw new Error(
      `${table} identifies or carries participant data and must never be synced to the web `
      + 'database by this skill -- refusing to run.',
    );
  }
}

module.exports = {
  CATALOG_TABLES, CONFIRMATION_TABLES, ALL_TABLES, FORBIDDEN_TABLES, FORBIDDEN_PREFIXES, assertNotParticipantTable,
};
