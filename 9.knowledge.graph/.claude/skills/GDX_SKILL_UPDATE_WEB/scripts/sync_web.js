/**
 * GDX_SKILL_UPDATE_WEB -- pushes the instrument/construct/variable catalog,
 * the septenary/chakra/Five-Ways/virtue reference tables, and the mapping
 * tables between them from the LOCAL GODATAX7HPH.GDB to the shared
 * firebird.godatax.com database. Never touches any table that identifies or
 * carries data about a real participant -- see tables.js for the exact,
 * explicit scope and what is deliberately excluded.
 *
 * Two upsert modes, per table (tables.js):
 *  - CATALOG_TABLES: plain upsert. Local always wins on content; insert if
 *    the row doesn't exist on the web yet, update any column that differs.
 *  - CONFIRMATION_TABLES: same content upsert, PLUS the confirmation pair
 *    (NUMBER_CONFIRMATIONS, CONFIRMATION_BY) follows a separate rule --
 *    see syncConfirmationRow(). NUMBER_CONFIRMATIONS only increments when
 *    this run's origin IP differs from the IP already recorded in
 *    CONFIRMATION_BY; the same origin confirming again leaves the count
 *    untouched (it still gets any content changes, just not +1).
 */

const Firebird = require('node-firebird');
const { describeTable } = require('./introspect');
const { CATALOG_TABLES, CONFIRMATION_TABLES, ALL_TABLES, assertNotParticipantTable } = require('./tables');
const { resolveOriginIp } = require('./origin');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable ${name} -- copy .env.example to .env and fill it in`);
  }
  return v;
}

function connectionOptions(prefix) {
  return {
    host: requireEnv(`${prefix}_HOST`),
    port: Number(requireEnv(`${prefix}_PORT`)),
    database: requireEnv(`${prefix}_DATABASE`),
    user: requireEnv(`${prefix}_USER`),
    password: requireEnv(`${prefix}_PASSWORD`),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsText: true,
  };
}

function attach(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)));
  });
}

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function detach(db) {
  return new Promise((resolve) => db.detach(() => resolve()));
}

function looseEqual(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a === 'string' || typeof b === 'string') return String(a).trim() === String(b).trim();
  return a === b;
}

function quoteIdentList(names) {
  return names.join(', ');
}

async function selectAll(db, table, columns) {
  return query(db, `SELECT ${quoteIdentList(columns.map((c) => c.name))} FROM ${table}`);
}

async function selectByPk(db, table, columns, primaryKey, pkValues) {
  const where = primaryKey.map((c) => `${c} = ?`).join(' AND ');
  const rows = await query(
    db,
    `SELECT ${quoteIdentList(columns.map((c) => c.name))} FROM ${table} WHERE ${where}`,
    primaryKey.map((c) => pkValues[c]),
  );
  return rows[0] || null;
}

async function insertRow(db, table, row, columnNames) {
  const cols = columnNames.filter((c) => row[c] !== undefined);
  const placeholders = cols.map(() => '?').join(', ');
  await query(
    db,
    `INSERT INTO ${table} (${quoteIdentList(cols)}) VALUES (${placeholders})`,
    cols.map((c) => row[c]),
  );
}

async function updateRow(db, table, setValues, primaryKey, pkValues) {
  const setCols = Object.keys(setValues);
  if (setCols.length === 0) return;
  const setClause = setCols.map((c) => `${c} = ?`).join(', ');
  const whereClause = primaryKey.map((c) => `${c} = ?`).join(' AND ');
  await query(
    db,
    `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
    [...setCols.map((c) => setValues[c]), ...primaryKey.map((c) => pkValues[c])],
  );
}

function pkValuesOf(row, primaryKey) {
  const out = {};
  for (const c of primaryKey) out[c] = row[c];
  return out;
}

/** Plain catalog upsert: local wins on every non-PK column. */
async function syncCatalogRow(webDb, table, columns, primaryKey, localRow, dryRun, counters) {
  const pk = pkValuesOf(localRow, primaryKey);
  const webRow = await selectByPk(webDb, table, columns, primaryKey, pk);
  const contentCols = columns.map((c) => c.name).filter((n) => !primaryKey.includes(n));

  if (!webRow) {
    counters.inserted++;
    if (!dryRun) await insertRow(webDb, table, localRow, columns.map((c) => c.name));
    return;
  }

  const setValues = {};
  for (const c of contentCols) {
    if (!looseEqual(localRow[c], webRow[c])) setValues[c] = localRow[c];
  }
  if (Object.keys(setValues).length === 0) {
    counters.unchanged++;
    return;
  }
  counters.updated++;
  if (!dryRun) await updateRow(webDb, table, setValues, primaryKey, pk);
}

/** Mapping-table upsert: content columns sync like a catalog table, but
 * NUMBER_CONFIRMATIONS/CONFIRMATION_BY follow the IP-diff rule. */
async function syncConfirmationRow(webDb, table, columns, primaryKey, localRow, originIp, dryRun, counters) {
  const pk = pkValuesOf(localRow, primaryKey);
  const webRow = await selectByPk(webDb, table, columns, primaryKey, pk);
  const allNames = columns.map((c) => c.name);
  const contentCols = allNames.filter(
    (n) => !primaryKey.includes(n) && n !== 'NUMBER_CONFIRMATIONS' && n !== 'CONFIRMATION_BY',
  );

  if (!webRow) {
    // First time this association reaches the web db: it counts as this
    // origin's first confirmation.
    const row = { ...localRow, NUMBER_CONFIRMATIONS: 1, CONFIRMATION_BY: originIp };
    counters.inserted++;
    counters.confirmed++;
    if (!dryRun) await insertRow(webDb, table, row, allNames);
    return;
  }

  const setValues = {};
  for (const c of contentCols) {
    if (!looseEqual(localRow[c], webRow[c])) setValues[c] = localRow[c];
  }

  const sameOrigin = webRow.CONFIRMATION_BY != null && String(webRow.CONFIRMATION_BY).trim() === String(originIp).trim();
  if (!sameOrigin) {
    setValues.NUMBER_CONFIRMATIONS = (webRow.NUMBER_CONFIRMATIONS || 0) + 1;
    setValues.CONFIRMATION_BY = originIp;
    counters.confirmed++;
  } else {
    counters.sameOrigin++;
  }

  if (Object.keys(setValues).length === 0) {
    counters.unchanged++;
    return;
  }
  counters.updated++;
  if (!dryRun) await updateRow(webDb, table, setValues, primaryKey, pk);
}

async function syncTable(localDb, webDb, table, isConfirmation, originIp, dryRun) {
  const { columns, primaryKey } = await describeTable(localDb, table);
  const localRows = await selectAll(localDb, table, columns);

  const counters = { table, rows: localRows.length, inserted: 0, updated: 0, unchanged: 0, confirmed: 0, sameOrigin: 0 };
  for (const localRow of localRows) {
    if (isConfirmation) {
      await syncConfirmationRow(webDb, table, columns, primaryKey, localRow, originIp, dryRun, counters);
    } else {
      await syncCatalogRow(webDb, table, columns, primaryKey, localRow, dryRun, counters);
    }
  }
  return counters;
}

function parseArgs(argv) {
  const args = { dryRun: false, tables: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--tables=')) args.tables = a.slice('--tables='.length).split(',').map((s) => s.trim());
    else if (a === '--tables') throw new Error('Use --tables=T1,T2 (with =), not a separate argument');
  }
  return args;
}

async function main() {
  try {
    await assertAccountRegistered();
  } catch (err) {
    console.error(err.message);
    process.exit(
      err instanceof AccountNotRegisteredError ? 2 :
      err instanceof NoInternetConnectionError ? 3 :
      err instanceof AccountEmailUnknownError ? 4 : 1
    );
  }

  const args = parseArgs(process.argv.slice(2));
  const targetTables = args.tables || ALL_TABLES;
  for (const t of targetTables) {
    if (!ALL_TABLES.includes(t)) {
      throw new Error(`${t} is not in this skill's table allowlist (see tables.js) -- refusing to touch it`);
    }
    // Belt-and-suspenders: never trust the allowlist alone to keep participant
    // data out of scope -- re-check every table against the explicit denylist
    // right before anything is read or written, even though ALL_TABLES should
    // never contain one of these.
    assertNotParticipantTable(t);
  }

  const originIp = await resolveOriginIp();
  console.log(`Origin IP for this run: ${originIp}${args.dryRun ? '  (dry-run -- no writes will be made)' : ''}`);

  const localDb = await attach(connectionOptions('GDX_LOCAL_FB'));
  const webDb = await attach(connectionOptions('GDX_WEB_FB'));
  console.log('Connected to local and web Firebird databases.');

  try {
    const results = [];
    for (const table of targetTables) {
      const isConfirmation = CONFIRMATION_TABLES.includes(table);
      const counters = await syncTable(localDb, webDb, table, isConfirmation, originIp, args.dryRun);
      results.push(counters);
      const extra = isConfirmation ? `, +1 confirmation=${counters.confirmed}, same-origin-skip=${counters.sameOrigin}` : '';
      console.log(
        `${table}: ${counters.rows} local rows -> inserted=${counters.inserted} updated=${counters.updated} `
        + `unchanged=${counters.unchanged}${extra}`,
      );
    }

    const totals = results.reduce((acc, r) => {
      acc.rows += r.rows; acc.inserted += r.inserted; acc.updated += r.updated;
      acc.unchanged += r.unchanged; acc.confirmed += r.confirmed; acc.sameOrigin += r.sameOrigin;
      return acc;
    }, { rows: 0, inserted: 0, updated: 0, unchanged: 0, confirmed: 0, sameOrigin: 0 });
    console.log('---');
    console.log(
      `TOTAL across ${results.length} tables: ${totals.rows} rows -> inserted=${totals.inserted} `
      + `updated=${totals.updated} unchanged=${totals.unchanged} confirmed(+1)=${totals.confirmed} `
      + `same-origin-skipped=${totals.sameOrigin}`,
    );
    if (!args.dryRun) console.log('Web database updated.');
  } finally {
    await detach(localDb);
    await detach(webDb);
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});
