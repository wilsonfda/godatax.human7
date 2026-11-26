/**
 * Shared account-registration gate for every skill in this repo (folders
 * 0.new.instrument .. 16.hypotheses.non.fingo). Before a skill does its real
 * work, it calls assertAccountRegistered() here to confirm the email of the
 * Claude Code account logged in on this machine has a row in
 * GDX_EAD_USERS.EMAIL on the shared firebird.godatax.com database.
 *
 * Centralized here instead of duplicated per skill -- see
 * GDX_HUMAN7_DEVELOPMENT_KIT.md, "Account registration gate", for why.
 *
 * Three outcomes:
 *  - email found in GDX_EAD_USERS      -> resolves, caller proceeds.
 *  - email not found in GDX_EAD_USERS  -> throws AccountNotRegisteredError
 *    (register at the GoDataX.Com portal).
 *  - firebird.godatax.com unreachable  -> throws NoInternetConnectionError.
 *  - local Claude account email can't be determined (missing/unparseable
 *    ~/.claude.json, or not logged in) -> throws AccountEmailUnknownError.
 *
 * Reuses the same GDX_WEB_FB_* credential that
 * 9.knowledge.graph/.claude/skills/GDX_SKILL_UPDATE_WEB/scripts/sync_web.js
 * already uses to reach firebird.godatax.com -- export those as real
 * environment variables before running any skill (see .env.example here),
 * same as that skill already requires.
 *
 * Node-only, by design -- Python/PowerShell entry scripts in this repo
 * shell out to this file (`node check_account_registration.js`) rather than
 * reimplementing the Firebird lookup in a second language. CLI exit codes:
 *   0 registered / 2 not registered / 3 no connection / 4 email unknown / 1 other error.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Firebird = require('node-firebird');

class AccountNotRegisteredError extends Error {}
class NoInternetConnectionError extends Error {}
class AccountEmailUnknownError extends Error {}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required environment variable ${name} -- see _shared/account_gate/.env.example ` +
      `(same GDX_WEB_FB_* credential GDX_SKILL_UPDATE_WEB already uses; export it as a real environment variable)`
    );
  }
  return v;
}

function connectionOptions() {
  return {
    host: requireEnv('GDX_WEB_FB_HOST'),
    port: Number(requireEnv('GDX_WEB_FB_PORT')),
    database: requireEnv('GDX_WEB_FB_DATABASE'),
    user: requireEnv('GDX_WEB_FB_USER'),
    password: requireEnv('GDX_WEB_FB_PASSWORD'),
    // firebird.godatax.com (firebird45-farm1.kinghost.net) only offers Legacy_Auth for this
    // account -- without pinning this, node-firebird's default SRP/SRP256 auto-negotiation
    // stalls past connect (the TCP socket opens, the wire-protocol handshake never completes)
    // instead of failing fast, which this module's own withTimeout() then misreports as
    // NoInternetConnectionError. Pinning it here (instead of auto-negotiating) is what makes
    // that distinction correct for this specific server.
    pluginName: Firebird.AUTH_PLUGIN_LEGACY,
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsText: true,
  };
}

function readLocalAccountEmail() {
  const configPath = path.join(os.homedir(), '.claude.json');
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    throw new AccountEmailUnknownError(
      `Nao foi possivel ler ${configPath} para determinar o email da conta Claude logada (${err.code || err.message}).`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AccountEmailUnknownError(`Nao foi possivel interpretar ${configPath} como JSON: ${err.message}`);
  }
  const email = parsed && parsed.oauthAccount && parsed.oauthAccount.emailAddress;
  if (!email || !String(email).trim()) {
    throw new AccountEmailUnknownError(
      `${configPath} nao tem oauthAccount.emailAddress -- faca login no Claude Code ("claude /login") antes de rodar esta skill.`
    );
  }
  return String(email).trim();
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

const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

function isNetworkError(err) {
  return NETWORK_ERROR_CODES.has(err.code) || /network|timeout|unreachable/i.test(err.message || '');
}

const CONNECT_TIMEOUT_MS = 10000;

function withTimeout(promise, ms) {
  let timer;
  promise.catch(() => {}); // avoid an unhandled rejection if the timeout wins the race below
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('connect timed out'), { code: 'ETIMEDOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function assertAccountRegistered() {
  const email = readLocalAccountEmail();

  let db;
  try {
    db = await withTimeout(attach(connectionOptions()), CONNECT_TIMEOUT_MS);
  } catch (err) {
    if (isNetworkError(err)) {
      throw new NoInternetConnectionError(
        `Sem conexao com a internet (ou com firebird.godatax.com) -- nao foi possivel verificar o cadastro ` +
        `de "${email}" em GDX_EAD_USERS. Verifique sua conexao e tente novamente.`
      );
    }
    throw err;
  }

  try {
    const rows = await query(db, 'SELECT FIRST 1 EMAIL FROM GDX_EAD_USERS WHERE UPPER(EMAIL) = UPPER(?)', [email]);
    if (!rows || rows.length === 0) {
      throw new AccountNotRegisteredError(
        `O email "${email}" (conta Claude logada nesta maquina) nao possui cadastro em GDX_EAD_USERS. ` +
        `Faca o registro no portal GoDataX.Com antes de rodar esta skill.`
      );
    }
  } finally {
    await detach(db);
  }
}

if (require.main === module) {
  assertAccountRegistered()
    .then(() => process.exit(0))
    .catch((err) => {
      process.stderr.write(`${err.message}\n`);
      if (err instanceof AccountNotRegisteredError) process.exit(2);
      if (err instanceof NoInternetConnectionError) process.exit(3);
      if (err instanceof AccountEmailUnknownError) process.exit(4);
      process.exit(1);
    });
}

module.exports = {
  assertAccountRegistered,
  AccountNotRegisteredError,
  NoInternetConnectionError,
  AccountEmailUnknownError,
};
