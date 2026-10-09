#!/usr/bin/env node
/**
 * Stage 1 (Node.js) of the generalized GDX_SKILL_MAKE_ANALYSES_CFA_EFA pipeline
 * -- runs fetch_career_adaptability_items.js's job for ANY instrument, not just
 * CAAS (ID_INSTRUMENT=3).
 *
 * For most instruments, GDX_PSY_INDICATOR_ITEM (the schema's own item -> indicator
 * -> variable mapping table) cannot be used to know which raw items feed which
 * variable: it is completely EMPTY in this database (0 rows), and
 * 1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md
 * admits some subscale item memberships are simply unknown even to the project's
 * original authors (e.g. the "Undocumented Organizational Block" an1-an11 items'
 * 4 subdimensions, or which of the 18 ef* items feed "Emotional Exhaustion").
 *
 * So this script DISCOVERS the grouping instead of assuming it: every one of
 * this database's 22 variables already has a computed RAW_SCORE in
 * GDX_PSY_VARIABLE_RESULT (n=423, or n=422 for Red Tape) -- ground truth that
 * exists independently of whether anyone documented how it was derived. For
 * each variable, items are ranked by |Pearson r| against that ground truth
 * (testing both raw and reverse-scored orientation per item), and increasing
 * prefixes of the ranked list are tested until one's mean reproduces the
 * ground-truth RAW_SCORE for EVERY application within tolerance -- the same
 * "must match GDX_PSY_VARIABLE_RESULT" sanity check the original CAAS-only
 * scripts already used defensively (see run_cfa_from_db.py), just used here
 * constructively, to find the grouping rather than merely confirm a hardcoded
 * one. Variables are processed most-confident-first (highest top-1 |r|) so an
 * item already claimed by one variable is never offered to another --
 * guarantees a true partition, not overlapping claims.
 *
 * A variable whose grouping cannot be confirmed this way (no prefix reproduces
 * it within tolerance) is marked "confirmed: false" in the structure JSON, with
 * its best partial match kept for an EFA-only, clearly-caveated reading --
 * downstream CFA scripts must refuse to build a confirmatory model on an
 * unconfirmed variable (that would be fabricating a measurement model with no
 * traceable basis, which this project's own conventions reject).
 *
 * Writes, into ../data/:
 *   instrument_<ID>_items.csv           ID_APPLICATION, <item columns>
 *   instrument_<ID>_variable_scores.csv ID_APPLICATION, <variable columns>
 *   instrument_<ID>_structure.json      discovered item->variable structure
 *
 * Usage:
 *   node analyze_instrument.js --instrument <ID> [--study <slug>] [--intake-dir <path>] [--out-dir <path>] [--tolerance <n>]
 *
 *   --study <slug>   optional. Same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_GODATAX_HUMAN7_BY_SPU use --
 *                     resolves to GDX_PSY_STUDY.ID_STUDY via new_study_intake/<slug>/intake.json's
 *                     study.title, and filters applications to that one study. Omit to discover
 *                     structure and fetch responses across every study that used this instrument
 *                     (the original, unscoped behavior).
 *   --intake-dir     override the default new_study_intake/<slug>/ location.
 *   --strict-items   when --study is given, still refuse on ANY application missing ANY of the
 *                     instrument's full GDX_PSY_INSTRUMENT_ITEM catalog items (the original,
 *                     unscoped-equivalent strictness). Without this flag, a --study run instead
 *                     auto-restricts to the item orders EVERY one of that study's fetched
 *                     applications actually has (e.g. a study whose questionnaire deliberately
 *                     omitted some catalog items at export time, per GDX_SKILL_EXPORT_NEW_STUDY's
 *                     --exclude-item-orders) -- every dropped item order is logged, never silently
 *                     hidden. Ignored (no effect) without --study: the unscoped, full-population
 *                     case always uses strict full-catalog completeness, since that is the
 *                     validated baseline population this skill's CAAS byte-for-byte reconstruction
 *                     and the other tracks were built against.
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

// Cosmetic only (column naming / SQL METHOD text) -- matches the original
// .sav column prefixes documented in
// 1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md
// section 6. Never used to determine structure -- that is always discovered.
const ITEM_PREFIX = {
  1: 'Ha', 2: 'En', 3: 'AC', 4: 'SV', 5: 'ST', 6: 'RP', 9: 'ef', 10: 'an', 11: 'red',
};

function parseArgs(argv) {
  const args = { instrument: null, outDir: path.join(__dirname, '..', 'data'), tolerance: 0.02, study: null, intakeDir: null, strictItems: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--instrument') args.instrument = parseInt(argv[++i], 10);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--tolerance') args.tolerance = parseFloat(argv[++i]);
    else if (a === '--study') args.study = argv[++i];
    else if (a === '--intake-dir') args.intakeDir = argv[++i];
    else if (a === '--strict-items') args.strictItems = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.instrument) throw new Error('--instrument <ID> is required.');
  return args;
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved relative to this
 * script -- same depth/pattern as GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts/export_graph.js. */
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
      `"${args.study}" first, or pass --intake-dir if it lives somewhere else.`
    );
  }
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

/** Resolves --study's slug to GDX_PSY_STUDY.ID_STUDY via the intake's study.title -- same
 * lookup the other --study-scoped skills use. */
async function resolveStudyId(db, studyTitle, studySlug) {
  const rows = await query(db, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(`Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY.`);
  }
  return rows[0].ID_STUDY;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env in this ` +
      `folder, fill it in, and export the vars before running this script.`
    );
  }
  return v;
}

function loadDotEnvIfPresent(envPath) {
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx2 += a * a; dy2 += b * b;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/** Discovers, for one variable, the item subset + exact per-item reversal
 * pattern whose UNWEIGHTED mean reproduces groundTruth[app] for every app
 * within `tolerance`. Items already in `claimed` are never considered
 * (guarantees a partition across variables when called most-confident-first).
 *
 * Two-phase, not a single greedy pass: membership is ranked by
 * max(|corr_raw|, |corr_reversed|) (which orientation to USE is deferred),
 * then for each candidate subset size s the reversal pattern is found by
 * EXHAUSTIVE search over all 2^s flip combinations (trying fewer flips first,
 * since a scale with mostly-non-reversed items is the more natural
 * explanation) -- picking a single item's orientation independently by
 * correlation (the first version of this function did that) is noisy near
 * ties and produced false negatives on CAAS's own already-known grouping
 * during development; exhaustive flip search over a small ranked subset does
 * not have that failure mode. Bounded by MAX_SUBSET so this stays fast --
 * every subscale actually seen in this dataset (<=11 items) is well under it.
 * Returns { confirmed, items: [{itemOrder, reversed, corr}], maxDiscrepancy, sizeTried } */
function discoverVariableStructure(itemOrders, itemValuesByOrder, scaleMin, scaleMax, groundTruth, claimed, tolerance) {
  const MAX_SUBSET = 14;
  const candidates = [];
  for (const order of itemOrders) {
    if (claimed.has(order)) continue;
    const raw = itemValuesByOrder.get(order);
    const reversed = raw.map((v) => scaleMin + scaleMax - v);
    const corrRaw = pearson(raw, groundTruth);
    const corrRev = pearson(reversed, groundTruth);
    candidates.push({ order, raw, reversed, corrRaw, corrRev, rank: Math.max(Math.abs(corrRaw), Math.abs(corrRev)) });
  }
  candidates.sort((a, b) => b.rank - a.rank);

  const n = groundTruth.length;
  let best = null;
  const cap = Math.min(candidates.length, MAX_SUBSET);
  for (let s = 1; s <= cap; s++) {
    const subset = candidates.slice(0, s);
    // Try flip patterns ordered by popcount ascending (fewest reversals first
    // = the simplest explanation), 0 .. 2^s-1.
    const combosByPopcount = Array.from({ length: 1 << s }, (_, mask) => mask)
      .sort((a, b) => popcount(a) - popcount(b));
    for (const mask of combosByPopcount) {
      let maxDiff = 0;
      for (let i = 0; i < n && maxDiff < 1e9; i++) {
        let sum = 0;
        for (let j = 0; j < s; j++) sum += (mask & (1 << j)) ? subset[j].reversed[i] : subset[j].raw[i];
        maxDiff = Math.max(maxDiff, Math.abs(sum / s - groundTruth[i]));
      }
      if (best === null || maxDiff < best.maxDiscrepancy) {
        best = {
          items: subset.map((c, j) => {
            const rev = !!(mask & (1 << j));
            return { itemOrder: c.order, reversed: rev, corr: round(rev ? c.corrRev : c.corrRaw) };
          }),
          maxDiscrepancy: round(maxDiff), sizeTried: s,
        };
      }
      if (maxDiff < tolerance) return { confirmed: true, ...best };
    }
  }
  if (best === null) return { confirmed: false, items: [], maxDiscrepancy: null, sizeTried: 0 }; // every item already claimed by an earlier (higher-confidence) variable
  return { confirmed: false, ...best };
}

function popcount(x) {
  let c = 0;
  while (x) { c += x & 1; x >>= 1; }
  return c;
}

function round(x) { return Math.round(x * 1e6) / 1e6; }

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));

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
    const instRows = await query(db, 'SELECT ID_INSTRUMENT, NAME FROM GDX_PSY_INSTRUMENT WHERE ID_INSTRUMENT = ?', [args.instrument]);
    if (instRows.length === 0) throw new Error(`No GDX_PSY_INSTRUMENT row for ID_INSTRUMENT=${args.instrument}.`);
    const instrumentName = instRows[0].NAME;
    const prefix = ITEM_PREFIX[args.instrument] || `I${args.instrument}_`;

    const itemRows = await query(db, 'SELECT ID_ITEM, ITEM_ORDER FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = ? ORDER BY ITEM_ORDER', [args.instrument]);
    if (itemRows.length < 2) throw new Error(`Instrument ${args.instrument} ("${instrumentName}") has ${itemRows.length} item(s) -- factor analysis needs multiple items to find shared variance. Skipping.`);
    const itemOrders = itemRows.map((r) => r.ITEM_ORDER);
    const itemIdByOrder = new Map(itemRows.map((r) => [r.ITEM_ORDER, r.ID_ITEM]));
    let nItems = itemOrders.length;

    const varRows = await query(db, `
      SELECT V.ID_VARIABLE, V.NAME, V.ID_CONSTRUCT
      FROM GDX_PSY_VARIABLE V
      JOIN GDX_PSY_INSTRUMENT_CONSTRUCT IC ON IC.ID_CONSTRUCT = V.ID_CONSTRUCT
      WHERE IC.ID_INSTRUMENT = ?
      ORDER BY V.ID_VARIABLE`, [args.instrument]);
    if (varRows.length === 0) throw new Error(`No GDX_PSY_VARIABLE rows found for instrument ${args.instrument} via GDX_PSY_INSTRUMENT_CONSTRUCT.`);
    const idConstruct = varRows[0].ID_CONSTRUCT; // one construct per instrument in this schema (verified 1:1 via GDX_PSY_INSTRUMENT_CONSTRUCT)

    let studyId = null;
    if (args.study) {
      const intake = loadIntake(args);
      const studyTitle = intake.study && intake.study.title;
      if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);
      studyId = await resolveStudyId(db, studyTitle, args.study);
      console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);
    }
    const studyFilter = studyId !== null
      ? ` AND ir.ID_APPLICATION IN (SELECT ID_APPLICATION FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ${studyId})`
      : '';

    // --- Raw item responses, one row per application ---
    const itemResponseRows = await query(db, `
      SELECT ir.ID_APPLICATION, ii.ITEM_ORDER, ir.NUMERIC_VALUE
      FROM GDX_PSY_ITEM_RESPONSE ir
      JOIN GDX_PSY_INSTRUMENT_ITEM ii ON ii.ID_ITEM = ir.ID_ITEM
      WHERE ii.ID_INSTRUMENT = ?${studyFilter}
      ORDER BY ir.ID_APPLICATION, ii.ITEM_ORDER`, [args.instrument]);

    const byApp = new Map();
    for (const r of itemResponseRows) {
      if (!byApp.has(r.ID_APPLICATION)) byApp.set(r.ID_APPLICATION, {});
      byApp.get(r.ID_APPLICATION)[r.ITEM_ORDER] = r.NUMERIC_VALUE;
    }
    const nAppsFetched = byApp.size;

    // --study runs (without --strict-items) auto-restrict to the item orders EVERY fetched
    // application actually has, instead of the full GDX_PSY_INSTRUMENT_ITEM catalog -- a study's
    // questionnaire may deliberately omit some catalog items (e.g. GDX_SKILL_EXPORT_NEW_STUDY's
    // --exclude-item-orders, used when an item's wording was never confirmed). Every dropped item
    // is logged with exactly how many of this study's applications lack it -- narrowed, not hidden.
    if (studyId !== null && !args.strictItems && nAppsFetched > 0) {
      const dropped = [];
      const universal = itemOrders.filter((o) => {
        let missingCount = 0;
        for (const items of byApp.values()) if (items[o] === undefined || items[o] === null) missingCount++;
        if (missingCount > 0) { dropped.push({ order: o, missingCount, of: nAppsFetched }); return false; }
        return true;
      });
      if (dropped.length) {
        console.log(`Study "${args.study}": ${dropped.length}/${itemOrders.length} catalog item(s) are not answered by every ` +
          `fetched application -- restricting this run to the ${universal.length} item(s) every application has ` +
          `(pass --strict-items to instead refuse, the unscoped behavior):`);
        for (const d of dropped) console.log(`  ${prefix}${d.order}: missing for ${d.missingCount}/${d.of} application(s) -- dropped`);
        if (universal.length < 2) {
          throw new Error(`After dropping non-universal items, only ${universal.length} item(s) remain for instrument ` +
            `${args.instrument} in study "${args.study}" -- factor analysis needs multiple items to find shared variance.`);
        }
        itemOrders.length = 0;
        itemOrders.push(...universal);
        nItems = itemOrders.length;
      }
    }

    const incomplete = [];
    for (const [appId, items] of byApp) {
      const missing = itemOrders.filter((o) => items[o] === undefined || items[o] === null);
      if (missing.length) incomplete.push({ appId, missing });
    }
    if (incomplete.length) {
      console.error(`ERROR: ${incomplete.length} application(s) have missing items for instrument ${args.instrument}:`);
      for (const { appId, missing } of incomplete.slice(0, 10)) console.error(`  ID_APPLICATION=${appId} missing item order(s) ${missing.join(', ')}`);
      throw new Error('Refusing to write an incomplete items CSV.');
    }
    const appIds = [...byApp.keys()].sort((a, b) => a - b);

    // --- Precomputed variable scores (ground truth for discovery + CFA/EFA cross-validation) ---
    const varIds = varRows.map((r) => r.ID_VARIABLE);
    const varScoreRows = await query(db, `
      SELECT ID_APPLICATION, ID_VARIABLE, RAW_SCORE
      FROM GDX_PSY_VARIABLE_RESULT
      WHERE ID_VARIABLE IN (${varIds.join(',')})`, []);
    const varById = new Map(varRows.map((r) => [r.ID_VARIABLE, r.NAME]));
    const scoreByApp = new Map(); // appId -> { varName: score }
    for (const r of varScoreRows) {
      if (!scoreByApp.has(r.ID_APPLICATION)) scoreByApp.set(r.ID_APPLICATION, {});
      scoreByApp.get(r.ID_APPLICATION)[varById.get(r.ID_VARIABLE)] = r.RAW_SCORE;
    }
    const varNames = varRows.map((r) => r.NAME);
    const appIdsWithScores = appIds.filter((id) => {
      const s = scoreByApp.get(id);
      return s && varNames.every((name) => s[name] !== undefined && s[name] !== null);
    });
    if (appIdsWithScores.length < appIds.length) {
      console.log(`Note: ${appIds.length - appIdsWithScores.length} application(s) have item responses but no (or partial) ` +
        `GDX_PSY_VARIABLE_RESULT row for this instrument's variable(s) -- excluded from structure discovery and from the ` +
        `variable-scores CSV, but still written to the items CSV.`);
    }

    // --- Instrument-wide scale bounds (for reverse-scoring), from observed responses ---
    const allVals = itemResponseRows.map((r) => r.NUMERIC_VALUE);
    const scaleMin = Math.min(...allVals), scaleMax = Math.max(...allVals);

    // --- Discovery: process variables most-confident-first, claiming items as we go ---
    const itemValuesByOrder = new Map();
    for (const order of itemOrders) itemValuesByOrder.set(order, appIdsWithScores.map((id) => byApp.get(id)[order]));

    const claimed = new Set();
    const structure = { instrument: { id: args.instrument, name: instrumentName, prefix }, construct: { id: idConstruct }, nItems, scaleMin, scaleMax, n: appIdsWithScores.length, variables: [] };

    // Rank variables by their own best single-item |corr| first (most identifiable first).
    const varRank = varNames.map((name) => {
      const gt = appIdsWithScores.map((id) => scoreByApp.get(id)[name]);
      let bestAbs = 0;
      for (const order of itemOrders) {
        const raw = itemValuesByOrder.get(order);
        bestAbs = Math.max(bestAbs, Math.abs(pearson(raw, gt)));
      }
      return { name, gt, bestAbs };
    }).sort((a, b) => b.bestAbs - a.bestAbs);

    for (const { name, gt } of varRank) {
      const result = discoverVariableStructure(itemOrders, itemValuesByOrder, scaleMin, scaleMax, gt, claimed, args.tolerance);
      for (const it of result.items) claimed.add(it.itemOrder);
      structure.variables.push({ id: varRows.find((r) => r.NAME === name).ID_VARIABLE, name, ...result });
    }
    structure.variables.sort((a, b) => a.id - b.id);
    structure.unclaimedItems = itemOrders.filter((o) => !claimed.has(o));

    const confirmedCount = structure.variables.filter((v) => v.confirmed).length;
    console.log(`\nInstrument ${args.instrument} ("${instrumentName}"): ${nItems} items, ${varRows.length} variable(s), n=${appIdsWithScores.length}.`);
    for (const v of structure.variables) {
      const tag = v.confirmed ? 'CONFIRMED' : 'UNCONFIRMED (best-effort)';
      console.log(`  [${tag}] ${v.name}: ${v.items.length} item(s) [${prefix}${v.items.map((it) => it.itemOrder).join(', ' + prefix)}], max discrepancy ${v.maxDiscrepancy}`);
    }
    if (structure.unclaimedItems.length) console.log(`  Unclaimed items (no variable's discovered set includes them): ${prefix}${structure.unclaimedItems.join(', ' + prefix)}`);

    // --- Write outputs ---
    const itemHeader = ['ID_APPLICATION', ...itemOrders.map((o) => `${prefix}${o}`)];
    const itemCsvRows = appIds.map((id) => [id, ...itemOrders.map((o) => byApp.get(id)[o])]);
    const itemsCsvPath = path.join(args.outDir, `instrument_${args.instrument}_items.csv`);
    writeCsv(itemsCsvPath, itemHeader, itemCsvRows);
    console.log(`\nWrote ${itemsCsvPath} (${appIds.length} applications x ${nItems} items).`);

    const varHeader = ['ID_APPLICATION', ...varNames];
    const varCsvRows = appIdsWithScores.map((id) => [id, ...varNames.map((name) => scoreByApp.get(id)[name])]);
    const varCsvPath = path.join(args.outDir, `instrument_${args.instrument}_variable_scores.csv`);
    writeCsv(varCsvPath, varHeader, varCsvRows);
    console.log(`Wrote ${varCsvPath} (${appIdsWithScores.length} applications x ${varNames.length} variable(s)).`);

    const structPath = path.join(args.outDir, `instrument_${args.instrument}_structure.json`);
    fs.mkdirSync(path.dirname(structPath), { recursive: true });
    fs.writeFileSync(structPath, JSON.stringify(structure, null, 2), 'utf8');
    console.log(`Wrote ${structPath} (${confirmedCount}/${structure.variables.length} variable(s) confirmed).`);
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

module.exports = { main };
