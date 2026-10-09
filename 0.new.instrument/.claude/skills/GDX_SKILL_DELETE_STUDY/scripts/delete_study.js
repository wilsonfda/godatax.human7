#!/usr/bin/env node
/**
 * GDX_SKILL_DELETE_STUDY
 *
 * Permanently deletes ONE GDX_PSY_STUDY and everything EXCLUSIVELY tied to it
 * -- relational OLTP (2.relational.model.psychometrics), the DW
 * (7.multidimensional.database), cardiac coherence (6.cardiac.coherence), and
 * the matching Neo4j nodes -- while never touching catalog data (instruments,
 * constructs, phenomena, items, people) that another study also depends on.
 * See SKILL.md for the full exclusivity model; this header only summarizes
 * the mechanics.
 *
 * ALWAYS a dry run unless BOTH --execute and --confirm-title "<exact TITLE>"
 * are passed. Never skip that confirmation, regardless of what an earlier run
 * approved -- this is irreversible.
 *
 * Usage:
 *   node delete_study.js --study <ID_STUDY> [--dry-run]
 *   node delete_study.js --study <ID_STUDY> --execute --confirm-title "<exact TITLE>" [--skip-neo4j]
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
let neo4j = null;
try { neo4j = require('neo4j-driver'); } catch (e) { /* only required if not --skip-neo4j */ }

function parseArgs(argv) {
  const args = { study: null, execute: false, confirmTitle: null, skipNeo4j: false, skipDashboards: false, dashboardsDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--study') args.study = parseInt(argv[++i], 10);
    else if (a === '--execute') args.execute = true;
    else if (a === '--confirm-title') args.confirmTitle = argv[++i];
    else if (a === '--skip-neo4j') args.skipNeo4j = true;
    else if (a === '--skip-dashboards') args.skipDashboards = true;
    else if (a === '--dashboards-dir') args.dashboardsDir = argv[++i];
    else if (a === '--dry-run') { /* default behavior anyway -- accepted for symmetry with other skills */ }
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.study || Number.isNaN(args.study)) {
    throw new Error('--study <ID_STUDY> is required -- the numeric GDX_PSY_STUDY.ID_STUDY, not a slug.');
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and export the vars first.`);
  return v;
}

function connect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function query(db, sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params || [], (err, result) => (err ? reject(err) : resolve(result))));
}
function startTransaction(db) {
  return new Promise((resolve, reject) => db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, tr) => (err ? reject(err) : resolve(tr))));
}
function txQuery(tr, sql, params) {
  return new Promise((resolve, reject) => tr.query(sql, params || [], (err, result) => (err ? reject(err) : resolve(result))));
}
function commit(tr) { return new Promise((resolve, reject) => tr.commit((err) => (err ? reject(err) : resolve()))); }
function rollback(tr) { return new Promise((resolve) => tr.rollback(() => resolve())); }

function stringifyKey(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** Comma-joined list of already-known-safe integers (our own prior query
 * results, never raw user input) for a SQL IN (...) clause. '-1' when empty
 * so "IN (-1)" matches nothing instead of producing invalid SQL. */
function inList(ids) {
  return ids.length ? ids.join(',') : '-1';
}

/** GDX_HUMAN/0.new.instrument/new_study_intake, resolved relative to this
 * script (0.new.instrument/.claude/skills/GDX_SKILL_DELETE_STUDY/scripts) --
 * same depth/pattern GDX_SKILL_MAKE_DASHBOARS_DW's resolveIntakePath() uses
 * in the other direction. */
function defaultIntakeDir() {
  return path.join(__dirname, '..', '..', '..', '..', '..', '0.new.instrument', 'new_study_intake');
}

/** GDX_HUMAN/8.gdx.dashboards, resolved relative to this script -- same
 * depth GDX_SKILL_MAKE_DASHBOARS_DW's own default --out-dir uses. */
function defaultDashboardsDir() {
  return path.join(__dirname, '..', '..', '..', '..', '..', '8.gdx.dashboards');
}

/** GDX_SKILL_MAKE_DASHBOARS_DW names every file
 * dashboard_0N_<chart>__<study-slug>__<study-title-slug>__<timestamp>.html --
 * the slug it uses is the literal --study code passed to it (the
 * new_study_intake/<slug> directory name), NOT GDX_PSY_STUDY.ID_STUDY. This
 * skill only knows the numeric ID_STUDY, so to find which dashboard files
 * belong to the study being deleted it has to go the other way: scan every
 * new_study_intake/<slug>/intake.json for the one whose study.title matches
 * this study's TITLE exactly (the same title GDX_SKILL_MAKE_DASHBOARS_DW's
 * resolveStudyId() looked up FROM that slug when the charts were generated).
 * Returns null if no intake directory has a matching title -- e.g. the study
 * was created directly in Firebird with no intake.json at all. */
function resolveStudySlug(intakeDir, studyTitle) {
  if (!fs.existsSync(intakeDir)) return null;
  for (const slug of fs.readdirSync(intakeDir)) {
    const intakePath = path.join(intakeDir, slug, 'intake.json');
    if (!fs.existsSync(intakePath)) continue;
    try {
      const intake = JSON.parse(fs.readFileSync(intakePath, 'utf8'));
      if (intake && intake.study && intake.study.title === studyTitle) return slug;
    } catch (e) { /* unreadable/invalid intake.json -- skip it, not this study's */ }
  }
  return null;
}

/** Dashboard filenames join their 4 components with '__' (baseName, slug,
 * title-slug, timestamp) -- splitting on that and comparing the slug field
 * exactly avoids a plain substring match wrongly catching e.g. slug "1"
 * inside another study's slug or timestamp. */
function findDashboardFiles(dashboardsDir, slug) {
  if (!fs.existsSync(dashboardsDir)) return [];
  return fs.readdirSync(dashboardsDir).filter((f) => {
    if (!f.toLowerCase().endsWith('.html')) return false;
    const parts = f.slice(0, -'.html'.length).split('__');
    return parts.length >= 4 && parts[1] === slug;
  });
}

/** Deletes (or, in dry-run, just measures) every row of `table` matching
 * `whereSql`, keyed by `pkCols` for both the row count and the Neo4j
 * gdx_key this row would carry (pkCols joined by '::' -- identical formula
 * to export_graph.js's gdxKeyOf(), so Neo4j cleanup always matches exactly
 * what was written). Runs inside the shared transaction when executing. */
async function deleteScoped(ctx, { table, pkCols, whereSql, note }) {
  if (whereSql === null) { // nothing to scope by (e.g. an empty id list) -- skip cleanly
    ctx.report.push({ table, count: 0, note: note || null });
    return [];
  }
  const rows = await query(ctx.db, `SELECT ${pkCols.join(', ')} FROM ${table} WHERE ${whereSql}`);
  const keys = rows.map((r) => pkCols.map((c) => stringifyKey(r[c])).join('::'));
  ctx.report.push({ table, count: rows.length, note: note || null });
  if (rows.length > 0) {
    ctx.neo4jDeletes.push({ table, keys });
    if (ctx.execute) {
      await txQuery(ctx.tr, `DELETE FROM ${table} WHERE ${whereSql}`);
    }
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  const willExecute = args.execute && !!args.confirmTitle;

  const fbOptions = {
    host: requireEnv('GDX_HUMAN_FB_HOST'),
    port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
    database: requireEnv('GDX_HUMAN_FB_DATABASE'),
    user: requireEnv('GDX_HUMAN_FB_USER'),
    password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsText: true,
  };

  console.log(`Connecting to ${fbOptions.host}:${fbOptions.port}${fbOptions.database} as ${fbOptions.user} ...`);
  const db = await connect(fbOptions);

  try {
    // --- Resolve the study -----------------------------------------------
    const studyRows = await query(db, 'SELECT ID_STUDY, TITLE, STATUS FROM GDX_PSY_STUDY WHERE ID_STUDY = ?', [args.study]);
    if (studyRows.length === 0) throw new Error(`No GDX_PSY_STUDY row for ID_STUDY=${args.study}.`);
    const study = studyRows[0];
    console.log(`\nStudy: ID_STUDY=${study.ID_STUDY} "${study.TITLE}" (${study.STATUS})`);

    if (args.execute && args.confirmTitle !== study.TITLE) {
      throw new Error(
        `--execute requires --confirm-title to match GDX_PSY_STUDY.TITLE EXACTLY. ` +
        `Got: ${args.confirmTitle === null ? '(not passed)' : JSON.stringify(args.confirmTitle)}. ` +
        `Expected: ${JSON.stringify(study.TITLE)}. Copy it verbatim from this line -- this check exists ` +
        `so a wrong --study number can never delete the wrong study.`
      );
    }
    if (!willExecute) console.log('[DRY RUN] Nothing will be written. Pass --execute --confirm-title "<exact TITLE>" to actually delete.');

    // --- Phase 0: gather this study's own scope ---------------------------
    const apps = await query(db, 'SELECT ID_APPLICATION, ID_PERSON FROM GDX_PSY_APPLICATION WHERE ID_STUDY = ?', [args.study]);
    const applicationIds = apps.map((a) => a.ID_APPLICATION);

    const participantRows = await query(db, 'SELECT ID_PERSON FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_STUDY = ?', [args.study]);
    const studyPeople = [...new Set(participantRows.map((r) => r.ID_PERSON))];

    // --- Exclusivity: people ------------------------------------------------
    const exclusivePeople = [];
    const sharedPeople = [];
    for (const personId of studyPeople) {
      const other = await query(db, `SELECT ID_STUDY FROM GDX_PSY_STUDY_PARTICIPANT WHERE ID_PERSON = ${personId} AND ID_STUDY <> ${args.study}`);
      if (other.length === 0) exclusivePeople.push(personId);
      else sharedPeople.push({ personId, otherStudies: other.map((r) => r.ID_STUDY) });
    }

    // --- Catalog data (instruments, items, alternatives, indicators,
    // variables, constructs, phenomena) is NEVER deleted by this skill, by
    // deliberate design choice, regardless of whether any other study also
    // uses it -- it stays as reusable knowledge base for future studies (a
    // catalog of instruments and their questions is exactly the kind of
    // thing you build once and reuse, not something tied to one study's
    // lifecycle).
    //
    // GDX_PSY_PSYCHOMETRIC_PROPERTY is different: it's CFA/EFA output
    // computed FROM a study's raw responses, not the instrument definition
    // itself, so it IS deleted along with the study's other response data --
    // but only for an instrument no OTHER study has any response data for
    // (otherwise those numbers may still be valid/needed for that other
    // study). "Which instrument(s) did this study actually touch" and "is
    // instrument X exclusive to this study" are both answered via
    // GDX_PSY_ITEM_RESPONSE -> GDX_PSY_INSTRUMENT_ITEM, NEVER via
    // GDX_PSY_APPLICATION.ID_INSTRUMENT -- proven unreliable while building
    // this skill: ID_STUDY=1 (the historical .sav-sourced load) uses ONE
    // "umbrella" GDX_PSY_APPLICATION per person, arbitrarily stamped
    // ID_INSTRUMENT=1 (Hardiness), covering that person's responses across
    // ALL 11 instruments -- trusting that column would have wrongly reported
    // the Maslach Burnout Inventory as exclusive to a brand-new study despite
    // study 1's 7,614 real responses against its items.
    const instrumentsTouchedRows = applicationIds.length
      ? await query(db, `
          SELECT DISTINCT ii.ID_INSTRUMENT
          FROM GDX_PSY_ITEM_RESPONSE r
          JOIN GDX_PSY_INSTRUMENT_ITEM ii ON ii.ID_ITEM = r.ID_ITEM
          WHERE r.ID_APPLICATION IN (${inList(applicationIds)})`)
      : [];
    const instrumentIdsUsed = instrumentsTouchedRows.map((r) => r.ID_INSTRUMENT);

    const exclusiveInstrumentsForProperties = [];
    const sharedInstrumentsForProperties = [];
    for (const instId of instrumentIdsUsed) {
      const other = await query(db, `
        SELECT DISTINCT a.ID_STUDY
        FROM GDX_PSY_ITEM_RESPONSE r
        JOIN GDX_PSY_INSTRUMENT_ITEM ii ON ii.ID_ITEM = r.ID_ITEM
        JOIN GDX_PSY_APPLICATION a ON a.ID_APPLICATION = r.ID_APPLICATION
        WHERE ii.ID_INSTRUMENT = ${instId} AND a.ID_STUDY <> ${args.study}`);
      if (other.length === 0) exclusiveInstrumentsForProperties.push(instId);
      else sharedInstrumentsForProperties.push({ instId, otherStudies: other.map((r) => r.ID_STUDY) });
    }

    console.log('\n=== Exclusivity analysis ===');
    console.log(`People: ${exclusivePeople.length} exclusive to this study, ${sharedPeople.length} shared (preserved)`);
    sharedPeople.forEach((p) => console.log(`  - ID_PERSON=${p.personId} also in ID_STUDY ${p.otherStudies.join(', ')}`));
    console.log(`Instrument(s) touched: ${instrumentIdsUsed.join(', ') || '(none)'} -- catalog rows (instrument/items/alternatives/indicators/variables/constructs/phenomena) are ALWAYS preserved, never deleted.`);
    console.log(`  GDX_PSY_PSYCHOMETRIC_PROPERTY (CFA/EFA results): ${exclusiveInstrumentsForProperties.length} instrument(s) exclusive (properties deleted), ${sharedInstrumentsForProperties.length} shared (properties preserved)`);
    sharedInstrumentsForProperties.forEach((i) => console.log(`    - ID_INSTRUMENT=${i.instId} also has response data in ID_STUDY ${i.otherStudies.join(', ')}`));

    // --- Phase 1: delete, in dependency order (children before parents) ----
    const ctx = { db, tr: null, execute: willExecute, report: [], neo4jDeletes: [] };
    if (willExecute) ctx.tr = await startTransaction(db);

    try {
      // DW facts (by ID_APPLICATION -- exact even for a shared person)
      await deleteScoped(ctx, { table: 'DW_FACT_PSY_VARIABLE_RESULT', pkCols: ['FACT_ID'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });
      await deleteScoped(ctx, { table: 'DW_FACT_PSY_ITEM_RESPONSE', pkCols: ['FACT_ID'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });
      // DW cardiac fact + session + person dimension -- exclusive people only
      await deleteScoped(ctx, { table: 'DW_FACT_CC_HRV_WINDOW', pkCols: ['FACT_ID'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });
      await deleteScoped(ctx, { table: 'DW_DIM_SESSION', pkCols: ['SESSION_ID'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });
      await deleteScoped(ctx, { table: 'DW_DIM_PERSON', pkCols: ['ID_PERSON'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });

      // Cardiac coherence -- exclusive people only. GDX_CC_SESSION's ON DELETE
      // CASCADE (see SKILL.md) takes RR_INTERVAL/ECG_SAMPLE/MOTION/HRV_WINDOW/
      // DEVICE_EVENT with it -- report them for visibility, but only GDX_CC_SESSION
      // itself needs an explicit DELETE.
      for (const t of ['GDX_CC_RR_INTERVAL', 'GDX_CC_ECG_SAMPLE', 'GDX_CC_MOTION', 'GDX_CC_HRV_WINDOW', 'GDX_CC_DEVICE_EVENT']) {
        const sessionFilter = exclusivePeople.length ? `SESSION_ID IN (SELECT SESSION_ID FROM GDX_CC_SESSION WHERE ID_PERSON IN (${inList(exclusivePeople)}))` : null;
        await deleteScoped(ctx, { table: t, pkCols: [t === 'GDX_CC_RR_INTERVAL' ? 'RR_INTERVAL_ID' : t === 'GDX_CC_ECG_SAMPLE' ? 'ECG_SAMPLE_ID' : t === 'GDX_CC_MOTION' ? 'MOTION_ID' : t === 'GDX_CC_HRV_WINDOW' ? 'HRV_WINDOW_ID' : 'DEVICE_EVENT_ID'], whereSql: sessionFilter, note: 'cascades from GDX_CC_SESSION -- counted here, not separately deleted' });
        if (ctx.report[ctx.report.length - 1]) ctx.report[ctx.report.length - 1].skipExplicitDelete = true;
      }
      await deleteScoped(ctx, { table: 'GDX_CC_SESSION', pkCols: ['SESSION_ID'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });
      await deleteScoped(ctx, { table: 'GDX_CC_PERSON', pkCols: ['ID_PERSON'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });

      // Psychometric results (by ID_APPLICATION)
      await deleteScoped(ctx, { table: 'GDX_PSY_INDICATOR_RESULT', pkCols: ['ID_INDICATOR_RESULT'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });
      await deleteScoped(ctx, { table: 'GDX_PSY_CONSTRUCT_RESULT', pkCols: ['ID_RESULT'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });
      await deleteScoped(ctx, { table: 'GDX_PSY_VARIABLE_RESULT', pkCols: ['ID_VARIABLE_RESULT'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });
      await deleteScoped(ctx, { table: 'GDX_PSY_ITEM_RESPONSE', pkCols: ['ID_RESPONSE'], whereSql: applicationIds.length ? `ID_APPLICATION IN (${inList(applicationIds)})` : null });

      // CFA/EFA results computed FROM this study's responses -- deleted only
      // for an instrument no OTHER study has response data for (the
      // instrument definition itself is never touched, see note above).
      await deleteScoped(ctx, { table: 'GDX_PSY_PSYCHOMETRIC_PROPERTY', pkCols: ['ID_PROPERTY'], whereSql: exclusiveInstrumentsForProperties.length ? `ID_INSTRUMENT IN (${inList(exclusiveInstrumentsForProperties)})` : null, note: "CFA/EFA output only -- instrument's own catalog rows are preserved" });

      // Evaluations/observations (by ID_STUDY directly)
      await deleteScoped(ctx, { table: 'GDX_PSY_EVALUATION_ACTION', pkCols: ['ID_EVALUATION', 'ID_ACTION'], whereSql: `ID_EVALUATION IN (SELECT ID_EVALUATION FROM GDX_PSY_EVALUATION WHERE ID_STUDY = ${args.study})` });
      await deleteScoped(ctx, { table: 'GDX_PSY_EVALUATION', pkCols: ['ID_EVALUATION'], whereSql: `ID_STUDY = ${args.study}` });
      await deleteScoped(ctx, { table: 'GDX_PSY_OBSERVATION', pkCols: ['ID_OBSERVATION'], whereSql: `ID_STUDY = ${args.study}` });

      // Applications, participation, people
      await deleteScoped(ctx, { table: 'GDX_PSY_APPLICATION', pkCols: ['ID_APPLICATION'], whereSql: `ID_STUDY = ${args.study}` });
      await deleteScoped(ctx, { table: 'GDX_PSY_STUDY_PARTICIPANT', pkCols: ['ID_STUDY', 'ID_PERSON'], whereSql: `ID_STUDY = ${args.study}` });
      await deleteScoped(ctx, { table: 'GDX_PSY_PERSON', pkCols: ['ID_PERSON'], whereSql: exclusivePeople.length ? `ID_PERSON IN (${inList(exclusivePeople)})` : null });

      // NOTE: no instrument/item/alternative/indicator/variable/construct/
      // phenomenon/GDX_PSY_PSYCHOMETRIC_PROPERTY deletion here, ever -- see
      // the "catalog data is never deleted" note above. Deleting a study
      // never touches the catalog, only that study's own participation in it.

      // The study itself, last.
      await deleteScoped(ctx, { table: 'GDX_PSY_STUDY', pkCols: ['ID_STUDY'], whereSql: `ID_STUDY = ${args.study}` });

      if (willExecute) {
        await commit(ctx.tr);
        console.log('\nRelational + DW transaction committed.');
      }
    } catch (err) {
      if (willExecute) { await rollback(ctx.tr); console.error('\nTransaction rolled back -- nothing was deleted.'); }
      throw err;
    }

    // --- Phase 2: Neo4j -----------------------------------------------------
    let neo4jTotal = 0;
    if (!args.skipNeo4j) {
      if (!neo4j) throw new Error('neo4j-driver is not installed (npm install) and --skip-neo4j was not passed.');
      const uri = requireEnv('NEO4J_URI'), user = requireEnv('NEO4J_USERNAME'), password = requireEnv('NEO4J_PASSWORD'), database = requireEnv('NEO4J_DATABASE');
      console.log(`\nConnecting to Neo4j ${uri} (database ${database}) ...`);
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      const session = driver.session({ database });
      try {
        for (const { table, keys } of ctx.neo4jDeletes) {
          const BATCH = 1000;
          for (let i = 0; i < keys.length; i += BATCH) {
            const batch = keys.slice(i, i + BATCH);
            const countRes = await session.executeRead((tx) => tx.run(`MATCH (n:\`${table}\`) WHERE n.gdx_key IN $keys RETURN count(n) AS c`, { keys: batch }));
            const c = countRes.records[0].get('c').toNumber();
            neo4jTotal += c;
            if (willExecute && c > 0) {
              await session.executeWrite((tx) => tx.run(`MATCH (n:\`${table}\`) WHERE n.gdx_key IN $keys DETACH DELETE n`, { keys: batch }));
            }
          }
        }
      } finally {
        await session.close();
        await driver.close();
      }
    } else {
      console.log('\n--skip-neo4j: Neo4j phase skipped.');
    }

    // --- Phase 3: dashboard HTML files in 8.gdx.dashboards ------------------
    // GDX_SKILL_MAKE_DASHBOARS_DW writes standalone .html files that embed
    // this study's own data (charts are generated once, not re-queried live),
    // so a deleted study's dashboards would otherwise keep showing its data
    // forever. These are plain files, not DB rows -- deleted directly with
    // fs.unlinkSync, no transaction, so this phase intentionally runs after
    // the relational/DW transaction has already committed.
    let dashboardFiles = [];
    let studySlug = null;
    const dashboardsDir = args.dashboardsDir || defaultDashboardsDir();
    if (!args.skipDashboards) {
      studySlug = resolveStudySlug(defaultIntakeDir(), study.TITLE);
      if (studySlug) {
        dashboardFiles = findDashboardFiles(dashboardsDir, studySlug);
        console.log(`\nDashboards: study slug "${studySlug}" (resolved via new_study_intake) -- ${dashboardFiles.length} file(s) in ${dashboardsDir} match.`);
        dashboardFiles.forEach((f) => console.log(`  ${f}`));
        if (willExecute) {
          for (const f of dashboardFiles) fs.unlinkSync(path.join(dashboardsDir, f));
        }
      } else {
        console.log(`\nDashboards: no new_study_intake/<slug>/intake.json has study.title === "${study.TITLE}" -- cannot resolve a slug, so no GDX_SKILL_MAKE_DASHBOARS_DW file can be matched. Check ${dashboardsDir} manually if any exist for this study.`);
      }
    } else {
      console.log('\n--skip-dashboards: dashboard file cleanup skipped.');
    }

    // --- Final report ---------------------------------------------------
    const verb = willExecute ? 'Deleted' : '[DRY RUN] would delete';
    console.log(`\n=== ${verb} from GDX_PSY_STUDY ${args.study} ("${study.TITLE}") ===`);
    for (const r of ctx.report) {
      const tag = r.skipExplicitDelete ? '  (cascades from GDX_CC_SESSION)' : '';
      console.log(`  ${r.table.padEnd(30)} ${String(r.count).padStart(6)}${tag}`);
    }
    if (!args.skipNeo4j) console.log(`  ${'Neo4j nodes'.padEnd(30)} ${String(neo4jTotal).padStart(6)}`);
    if (!args.skipDashboards) console.log(`  ${'Dashboard HTML files (8.gdx.dashboards)'.padEnd(30)} ${String(dashboardFiles.length).padStart(6)}`);

    console.log('\n=== Preserved (never deleted by this skill) ===');
    instrumentIdsUsed.forEach((id) => console.log(`  GDX_PSY_INSTRUMENT ID_INSTRUMENT=${id} and its catalog (items/alternatives/indicators/variables/constructs/phenomena) -- always kept as reusable knowledge base`));
    sharedPeople.forEach((p) => console.log(`  GDX_PSY_PERSON ID_PERSON=${p.personId} -- also enrolled in ID_STUDY ${p.otherStudies.join(', ')}, kept`));
    sharedInstrumentsForProperties.forEach((i) => console.log(`  GDX_PSY_PSYCHOMETRIC_PROPERTY for ID_INSTRUMENT=${i.instId} -- also has response data in ID_STUDY ${i.otherStudies.join(', ')}, kept`));

    if (!willExecute) {
      console.log('\nThis was a dry run -- nothing was written. Re-run with:');
      console.log(`  node delete_study.js --study ${args.study} --execute --confirm-title "${study.TITLE}"`);
    }
  } finally {
    db.detach();
  }
}

main().catch((err) => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
