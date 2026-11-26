/**
 * Minimal Firebird RDB$ catalog reader -- only what sync_web.js needs:
 * a table's columns (in declared order, with BLOB detection) and its
 * primary key. Unlike GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts/introspect.js,
 * this does NOT discover tables by prefix -- the table list here is the
 * fixed, explicit allowlist in tables.js, on purpose: this skill pushes to
 * a shared web database and the exclusion of every participant-data table
 * must stay a deliberate list, never something a future table naming choice
 * could accidentally widen.
 */

const FB_BLOB_TYPE = 261; // RDB$FIELD_TYPE code for BLOB columns

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

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

/** Columns + primary key for one table, read from whichever connection is
 * passed in -- call once against the LOCAL db; the web db is assumed to
 * share the same schema (both are built from the same DDL script). */
async function describeTable(db, tableName) {
  const [columns, primaryKey] = await Promise.all([getColumns(db, tableName), getPrimaryKey(db, tableName)]);
  if (columns.length === 0) throw new Error(`Table ${tableName} not found (or has no columns) on this connection`);
  if (primaryKey.length === 0) throw new Error(`Table ${tableName} has no primary key -- cannot upsert safely`);
  return { name: tableName, columns, primaryKey };
}

module.exports = { query, describeTable };
