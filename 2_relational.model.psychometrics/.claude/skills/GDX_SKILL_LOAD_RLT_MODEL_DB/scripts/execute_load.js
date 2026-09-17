#!/usr/bin/env node
/**
 * GDX_SKILL_LOAD_RLT_MODEL_DB - step 2: execute the generated load scripts
 * against a live Firebird database, over the wire protocol (node-firebird),
 * no native Firebird client library required.
 *
 * Connection is read ENTIRELY from environment variables -- nothing is
 * hardcoded here on purpose (see CLAUDE.md: don't hardcode Firebird
 * credentials as defaults). Copy .env.example to .env (gitignored) and fill
 * it in, or export the vars in your shell before running.
 *
 * Required env vars:
 *   GDX_HUMAN_FB_HOST
 *   GDX_HUMAN_FB_PORT
 *   GDX_HUMAN_FB_DATABASE
 *   GDX_HUMAN_FB_USER
 *   GDX_HUMAN_FB_PASSWORD
 *
 * Usage:
 *   node execute_load.js [--dir <folder>] [--only N] [--dry-run] [--force]
 *
 *   --dir      folder containing 01_load_study.sql .. 08_adjust_sequences.sql
 *              (default: GDX_HUMAN/2_relational.model.psychometrics relative to repo root)
 *   --only N   run only file number N (1-8) -- for resuming a partial/failed load
 *   --dry-run  parse and count statements per file, connect and run the
 *              preflight checks, but do not execute any INSERT/ALTER statement
 *   --force    skip the "already loaded" guard (still will NOT delete/truncate
 *              anything -- a second full load will simply fail on the PK/UNIQUE
 *              constraints of whichever file it re-reaches)
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

const REQUIRED_TABLES = [
  'GDX_PSY_STUDY', 'GDX_PSY_INSTRUMENT', 'GDX_PSY_CONSTRUCT', 'GDX_PSY_VARIABLE',
  'GDX_PSY_INSTRUMENT_ITEM', 'GDX_PSY_PERSON', 'GDX_PSY_STUDY_PARTICIPANT',
  'GDX_PSY_APPLICATION', 'GDX_PSY_ITEM_RESPONSE', 'GDX_PSY_VARIABLE_RESULT',
];

const FILES = [
  '01_load_study.sql',
  '02_load_instrument_catalog.sql',
  '03_load_instrument_items.sql',
  '04_load_persons_participants.sql',
  '05_load_applications.sql',
  '06_load_item_responses.sql',
  '07_load_variable_results.sql',
  '08_adjust_sequences.sql',
];

const BATCH_SIZE = 2000; // statements committed per transaction, for the two bulk files

function parseArgs(argv) {
  const args = { dir: null, only: null, dryRun: false, force: false, skip: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--only') args.only = parseInt(argv[++i], 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--skip') args.skip = parseInt(argv[++i], 10);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy ` +
      `.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/.env.example to .env, fill it in, ` +
      `and export the vars (or use a dotenv loader) before running this script. ` +
      `Never hardcode credentials in this file or in git.`
    );
  }
  return v;
}

/** Statement/comment splitting that tracks single-quoted-string state so it
 * is not fooled by ';' or '--' appearing inside item text or author lists
 * (e.g. "Bartone, Ursano, Wright & Ingraham, 1989; adapt. ..."). This is
 * intentionally NOT a general-purpose SQL parser -- it only needs to
 * understand the flat INSERT/ALTER SEQUENCE statements produced by
 * generate_load_scripts.py (no double-quoted identifiers, no multi-statement
 * PSQL blocks). */
function stripLineComments(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      inString = !inString;
      out += ch;
      continue;
    }
    if (!inString && ch === '-' && text[i + 1] === '-') {
      let j = text.indexOf('\n', i);
      if (j === -1) j = text.length;
      i = j - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function splitStatements(text) {
  const statements = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") inString = !inString;
    if (ch === ';' && !inString) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    } else {
      current += ch;
    }
  }
  const rest = current.trim();
  if (rest) {
    throw new Error(`Trailing content without terminating ';': ${rest.slice(0, 120)}`);
  }
  return statements;
}

function parseStatements(sqlText) {
  const withoutHeader = sqlText.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const withoutComments = stripLineComments(withoutHeader);
  return splitStatements(withoutComments);
}

function connect(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)));
  });
}

function query(db, sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function startTransaction(db) {
  return new Promise((resolve, reject) => {
    db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, tr) => (err ? reject(err) : resolve(tr)));
  });
}

function txQuery(tr, sql) {
  return new Promise((resolve, reject) => {
    tr.query(sql, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function commit(tr) {
  return new Promise((resolve, reject) => {
    tr.commit((err) => (err ? reject(err) : resolve()));
  });
}

function rollback(tr) {
  return new Promise((resolve) => {
    tr.rollback(() => resolve());
  });
}

async function tableExists(db, name) {
  const rows = await query(db, `SELECT 1 FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = '${name}'`);
  return rows.length > 0;
}

async function preflight(db, force) {
  const missing = [];
  for (const t of REQUIRED_TABLES) {
    if (!(await tableExists(db, t))) missing.push(t);
  }
  if (missing.length) {
    throw new Error(
      `Target database is missing required table(s): ${missing.join(', ')}.\n` +
      `Apply GDX_HUMAN/2_relational.model.psychometrics/psychometrics_model_firebird25.sql ` +
      `(the DDL) on this database first, then re-run this script.`
    );
  }

  const rows = await query(db, 'SELECT COUNT(*) AS CNT FROM GDX_PSY_STUDY WHERE ID_STUDY = 1');
  const alreadyLoaded = rows[0].CNT > 0;
  if (alreadyLoaded && !force) {
    throw new Error(
      `GDX_PSY_STUDY already has a row with ID_STUDY = 1 -- this dataset looks already loaded. ` +
      `Refusing to proceed to avoid duplicate/partial data (this script never deletes anything). ` +
      `If you specifically want to resume a partially failed load, re-run with --only <N> for ` +
      `just the file that failed, or pass --force to skip this guard.`
    );
  }
  return { alreadyLoaded };
}

async function runFile(db, filePath, dryRun, skip) {
  const allStatements = parseStatements(fs.readFileSync(filePath, 'utf8'));
  const statements = skip ? allStatements.slice(skip) : allStatements;
  console.log(`${path.basename(filePath)}: ${allStatements.length} statement(s)` +
    (skip ? ` (skipping first ${skip}, ${statements.length} remaining)` : ''));
  if (dryRun || statements.length === 0) return statements.length;

  let done = skip || 0;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE);
    const tr = await startTransaction(db);
    try {
      for (const stmt of batch) {
        await txQuery(tr, stmt);
      }
      await commit(tr);
      done += batch.length;
      if (allStatements.length > BATCH_SIZE) {
        console.log(`  ... ${done}/${allStatements.length} committed`);
      }
    } catch (err) {
      await rollback(tr);
      throw new Error(
        `Failed in ${path.basename(filePath)} at statement ${skip + i + 1}-${skip + i + batch.length} batch: ${err.message}`
      );
    }
  }
  return done;
}

async function main() {
  const args = parseArgs(process.argv);
  // scripts/ -> GDX_SKILL_LOAD_RLT_MODEL_DB -> skills -> .claude -> 2_relational.model.psychometrics
  const dir = args.dir || path.join(__dirname, '..', '..', '..', '..');

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
    const { alreadyLoaded } = await preflight(db, args.force);
    if (alreadyLoaded) console.log('WARNING: proceeding despite existing data (--force).');

    const targets = args.only ? [FILES[args.only - 1]] : FILES;
    if (args.only && !targets[0]) throw new Error(`--only must be between 1 and ${FILES.length}`);
    if (args.skip && targets.length !== 1) {
      throw new Error('--skip only makes sense together with --only <N> (a single file).');
    }

    let total = 0;
    for (const file of targets) {
      total += await runFile(db, path.join(dir, file), args.dryRun, args.skip);
    }
    console.log(args.dryRun
      ? `Dry run complete. ${total} statement(s) would be executed.`
      : `Done. ${total} statement(s) executed and committed.`);
  } finally {
    db.detach();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = { parseStatements };
