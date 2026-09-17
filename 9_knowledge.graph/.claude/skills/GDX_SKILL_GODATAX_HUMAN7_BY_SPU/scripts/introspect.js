/**
 * Generic Firebird schema introspection -- reads the RDB$ system catalog so
 * the graph exporter never hardcodes a table list, a column list, or a
 * relationship. Anything added to psychometrics_model_firebird25.sql,
 * septenary_constitution_model_firebird25.sql, chakras_model_firebird25.sql,
 * five_ways_model_firebird25.sql(+_septenary_map), gdx_coerencia_cardiaca_
 * fb25_ddl.sql or godatax_human_dw_model_firebird25.sql is picked up on the
 * next run automatically, as long as its table name matches one of the
 * TABLE_PREFIXES below.
 */

const TABLE_PREFIXES = ['GDX_PSY_', 'GDX_TA_', 'GDX_CC_', 'DW_DIM_', 'DW_FACT_'];

const FB_BLOB_TYPE = 261; // RDB$FIELD_TYPE code for BLOB columns

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function listTables(db) {
  const rows = await query(db, `
    SELECT RDB$RELATION_NAME AS NAME
    FROM RDB$RELATIONS
    WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL
    ORDER BY 1`);
  const names = rows.map((r) => r.NAME.trim());
  return names.filter((n) => TABLE_PREFIXES.some((p) => n.startsWith(p)));
}

/** Columns for a table, in declared order, with a flag for BLOB fields
 * (which need special read handling -- see readRow in export_graph.js). */
async function getColumns(db, tableName) {
  const rows = await query(db, `
    SELECT RF.RDB$FIELD_NAME AS NAME, F.RDB$FIELD_TYPE AS TYPE_CODE
    FROM RDB$RELATION_FIELDS RF
    JOIN RDB$FIELDS F ON F.RDB$FIELD_NAME = RF.RDB$FIELD_SOURCE
    WHERE RF.RDB$RELATION_NAME = ?
    ORDER BY RF.RDB$FIELD_POSITION`, [tableName]);
  return rows.map((r) => ({ name: r.NAME.trim(), isBlob: r.TYPE_CODE === FB_BLOB_TYPE }));
}

async function getPrimaryKey(db, tableName) {
  const rows = await query(db, `
    SELECT ISG.RDB$FIELD_NAME AS NAME
    FROM RDB$RELATION_CONSTRAINTS RC
    JOIN RDB$INDEX_SEGMENTS ISG ON ISG.RDB$INDEX_NAME = RC.RDB$INDEX_NAME
    WHERE RC.RDB$RELATION_NAME = ? AND RC.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
    ORDER BY ISG.RDB$FIELD_POSITION`, [tableName]);
  return rows.map((r) => r.NAME.trim());
}

/** Every FK in the database in one query: child table/columns -> parent
 * table/columns, keyed by the FK constraint name (used as the Neo4j
 * relationship type, per the "use the foreign keys to identify the
 * bridges" instruction). Filtered afterward to our prefixed tables. */
async function getAllForeignKeys(db) {
  const rows = await query(db, `
    SELECT
      RC.RDB$RELATION_NAME AS CHILD_TABLE,
      RC.RDB$CONSTRAINT_NAME AS FK_NAME,
      ISG.RDB$FIELD_NAME AS CHILD_FIELD,
      ISG.RDB$FIELD_POSITION AS SEG_POS,
      RC2.RDB$RELATION_NAME AS PARENT_TABLE,
      ISG2.RDB$FIELD_NAME AS PARENT_FIELD
    FROM RDB$RELATION_CONSTRAINTS RC
    JOIN RDB$REF_CONSTRAINTS REFC ON REFC.RDB$CONSTRAINT_NAME = RC.RDB$CONSTRAINT_NAME
    JOIN RDB$RELATION_CONSTRAINTS RC2 ON RC2.RDB$CONSTRAINT_NAME = REFC.RDB$CONST_NAME_UQ
    JOIN RDB$INDEX_SEGMENTS ISG ON ISG.RDB$INDEX_NAME = RC.RDB$INDEX_NAME
    JOIN RDB$INDEX_SEGMENTS ISG2 ON ISG2.RDB$INDEX_NAME = RC2.RDB$INDEX_NAME
      AND ISG2.RDB$FIELD_POSITION = ISG.RDB$FIELD_POSITION
    WHERE RC.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
    ORDER BY RC.RDB$RELATION_NAME, RC.RDB$CONSTRAINT_NAME, ISG.RDB$FIELD_POSITION`);

  const byFk = new Map();
  for (const r of rows) {
    const fkName = r.FK_NAME.trim();
    if (!byFk.has(fkName)) {
      byFk.set(fkName, {
        fkName,
        childTable: r.CHILD_TABLE.trim(),
        parentTable: r.PARENT_TABLE.trim(),
        childFields: [],
        parentFields: [],
      });
    }
    const fk = byFk.get(fkName);
    fk.childFields.push(r.CHILD_FIELD.trim());
    fk.parentFields.push(r.PARENT_FIELD.trim());
  }
  return [...byFk.values()];
}

/** Full schema map for every table matching TABLE_PREFIXES: columns, PK,
 * and (child-side) foreign keys. */
async function introspectSchema(db) {
  const tables = await listTables(db);
  const allFks = await getAllForeignKeys(db);
  const tableSet = new Set(tables);

  // Firebird has no query pipelining on a single attachment, but node-firebird
  // queues concurrent db.query() calls internally -- running all per-table
  // lookups concurrently (instead of one at a time) is still much faster
  // than a strictly sequential loop over 50+ tables on a remote connection.
  const schema = {};
  await Promise.all(tables.map(async (t) => {
    const [columns, primaryKey] = await Promise.all([getColumns(db, t), getPrimaryKey(db, t)]);
    schema[t] = {
      name: t,
      columns,
      primaryKey,
      foreignKeys: allFks.filter((fk) => fk.childTable === t && tableSet.has(fk.parentTable)),
    };
  }));
  return schema;
}

module.exports = { TABLE_PREFIXES, listTables, getColumns, getPrimaryKey, getAllForeignKeys, introspectSchema };
