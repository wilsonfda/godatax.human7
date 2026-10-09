#!/usr/bin/env node
/**
 * GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT
 *
 * Model 2 from 10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md:
 * runs unsupervised community detection (Neo4j GDS Louvain, primary; Label Propagation as a
 * cross-check) over the same catalog subgraph Model 1 uses, then compares the structural
 * communities found against the existing septenary-level / chakra / Five-Ways labels --
 * "do variables/instruments naturally group the way the philosophical framework says they
 * should?" No training, no labels used as input; nothing here writes anything back to the
 * graph or to Firebird.
 *
 * Reads ONLY from Neo4j -- never connects to Firebird. The graph must already have been
 * populated by GDX_SKILL_GODATAX_HUMAN7_BY_SPU for the study passed via --study.
 *
 * Usage:
 *   node community_detect.js --study <slug> [--intake-dir <path>] [--dry-run]
 *
 *   --study <slug>   REQUIRED. Same slug the other GDX_HUMAN --study skills use. Verifies a
 *                    GDX_PSY_STUDY node for this study already exists in the graph before
 *                    doing anything else. This model's own subgraph (variables/constructs/
 *                    instruments/levels/chakras/ways) is shared catalog data, not filtered
 *                    by study -- see SKILL.md.
 *   --intake-dir     override the default new_study_intake/<slug>/ location.
 *   --dry-run        run everything, print the report, write no file.
 *
 * Connection: NEO4J_* environment variables only (see ../.env.example). Never hardcode
 * credentials here.
 */

const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');

const OUT_DIR = path.join(__dirname, '..', '..', '..', '..'); // .claude/skills/<name>/scripts -> 10.gdx.machine.learning
const GRAPH_NAME = 'gdx-community-detect';

const NODE_LABELS = ['GDX_PSY_VARIABLE', 'GDX_PSY_CONSTRUCT', 'GDX_PSY_INSTRUMENT', 'GDX_PSY_SEPTENARY_LEVEL',
  'GDX_PSY_CHAKRA', 'GDX_TA_WAY', 'GDX_PSY_SEPT_LEVEL_PSY_MAP', 'GDX_TA_WAY_SEPT_MAP', 'GDX_PSY_INSTRUMENT_CONSTRUCT'];
const REL_TYPES = ['FK_GDX_PSY_VARIABLE_CONSTRUCT', 'FK_GDX_PSY_IC_CONSTRUCT', 'FK_GDX_PSY_IC_INSTRUMENT',
  'FK_GDX_PSY_CHAKRA_LEVEL', 'FK_GDX_PSY_CONSTRUCT_PARENT', 'FK_GDX_PSY_SLPM_INSTRUMENT',
  'FK_GDX_PSY_SLPM_LEVEL', 'FK_GDX_PSY_SLPM_VARIABLE', 'FK_GDX_TA_WSM_LEVEL', 'FK_GDX_TA_WSM_WAY'];
// Note: no MAPS_TO_LEVEL here (unlike Model 1) -- this model deliberately runs on the raw FK
// structure alone, with no label-derived shortcut edge, since the whole point is asking
// whether the *unlabeled* graph structure agrees with the labels, not handing it the answer.

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error('--study <slug> is required. Pass the same slug used to run GDX_SKILL_GODATAX_HUMAN7_BY_SPU for this study.');
  }
  return args;
}

function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}
function loadIntake(args) {
  const p = resolveIntakePath(args);
  if (!fs.existsSync(p)) throw new Error(`intake.json not found at ${p}. Pass --intake-dir if it lives somewhere else.`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export the vars first.`);
  return v;
}
function toNum(v) { return v && typeof v.toNumber === 'function' ? v.toNumber() : v; }

async function main() {
  const args = parseArgs(process.argv);
  const intake = loadIntake(args);
  const studyTitle = intake.study && intake.study.title;
  if (!studyTitle) throw new Error(`intake.json for study slug "${args.study}" has no study.title.`);

  const driver = neo4j.driver(
    requireEnv('NEO4J_URI'),
    neo4j.auth.basic(requireEnv('NEO4J_USERNAME'), requireEnv('NEO4J_PASSWORD'))
  );
  const database = requireEnv('NEO4J_DATABASE');
  const session = driver.session({ database });

  try {
    console.log(`Connecting to Neo4j ${requireEnv('NEO4J_URI')} (database ${database}) ...`);

    const studyCheck = await session.run('MATCH (s:GDX_PSY_STUDY {TITLE: $t}) RETURN s.ID_STUDY AS id', { t: studyTitle });
    if (studyCheck.records.length === 0) {
      throw new Error(
        `No GDX_PSY_STUDY node found in the graph for "${studyTitle}" (slug "${args.study}"). ` +
        `Run GDX_SKILL_GODATAX_HUMAN7_BY_SPU --study ${args.study} first.`
      );
    }
    const studyId = toNum(studyCheck.records[0].get('id'));
    console.log(`Confirmed study "${studyTitle}" (slug "${args.study}", ID_STUDY=${studyId}) exists in the graph.`);
    console.log('Note: this model\'s own subgraph is shared catalog data, not scoped by study -- see SKILL.md.');

    try { await session.run(`CALL gds.graph.drop($g, false)`, { g: GRAPH_NAME }); } catch (e) {}
    const proj = await session.run(`
      CALL gds.graph.project($g, $labels, $rels, {memory: '2GB', undirectedRelationshipTypes: ['*']})
      YIELD nodeCount, relationshipCount`, { g: GRAPH_NAME, labels: NODE_LABELS, rels: REL_TYPES });
    console.log(`Projected graph: ${toNum(proj.records[0].get('nodeCount'))} nodes, ${toNum(proj.records[0].get('relationshipCount'))} relationships.`);

    const louvainRes = await session.run(`CALL gds.louvain.stream($g) YIELD nodeId, communityId RETURN nodeId, communityId`, { g: GRAPH_NAME });
    const lpaRes = await session.run(`CALL gds.labelPropagation.stream($g) YIELD nodeId, communityId RETURN nodeId, communityId`, { g: GRAPH_NAME });

    const ids = louvainRes.records.map((r) => toNum(r.get('nodeId')));
    const namesRes = await session.run(`
      MATCH (n) WHERE id(n) IN $ids
      RETURN id(n) AS id, labels(n) AS labels, coalesce(n.NAME, n.SANSKRIT_NAME) AS name`, { ids });
    const nodeInfo = {};
    namesRes.records.forEach((r) => { nodeInfo[toNum(r.get('id'))] = { label: r.get('labels')[0], name: r.get('name') }; });

    const louvainCommunity = {}; louvainRes.records.forEach((r) => { louvainCommunity[toNum(r.get('nodeId'))] = toNum(r.get('communityId')); });
    const lpaCommunity = {}; lpaRes.records.forEach((r) => { lpaCommunity[toNum(r.get('nodeId'))] = toNum(r.get('communityId')); });

    // Group by Louvain community; for each, tally which septenary levels / chakras appear.
    const byCommunity = {};
    for (const id of ids) {
      const cid = louvainCommunity[id];
      if (!byCommunity[cid]) byCommunity[cid] = [];
      byCommunity[cid].push({ id, ...nodeInfo[id] });
    }
    const communities = Object.entries(byCommunity)
      .map(([cid, members]) => {
        const levels = [...new Set(members.filter((m) => m.label === 'GDX_PSY_SEPTENARY_LEVEL').map((m) => m.name))];
        const chakras = [...new Set(members.filter((m) => m.label === 'GDX_PSY_CHAKRA').map((m) => m.name))];
        const variables = members.filter((m) => m.label === 'GDX_PSY_VARIABLE').map((m) => m.name);
        const instruments = [...new Set(members.filter((m) => m.label === 'GDX_PSY_INSTRUMENT').map((m) => m.name))];
        // agreement with labelPropagation: do the members of this Louvain community also
        // mostly share one LPA community? (a simple stability cross-check, not a metric GDS computes itself)
        const lpaIds = members.map((m) => lpaCommunity[m.id]);
        const lpaMode = lpaIds.length ? lpaIds.sort((a, b) =>
          lpaIds.filter((v) => v === b).length - lpaIds.filter((v) => v === a).length)[0] : null;
        const lpaAgreement = lpaIds.length ? lpaIds.filter((v) => v === lpaMode).length / lpaIds.length : 0;
        return { cid, size: members.length, levels, chakras, variables, instruments, lpaAgreement };
      })
      .filter((c) => c.size > 1)
      .sort((a, b) => b.size - a.size);

    // --- report ---
    const now = new Date();
    const lines = [];
    lines.push('# GDX_HUMAN Knowledge Graph — Community Detection');
    lines.push('');
    lines.push(`> Generated ${now.toISOString()} by \`GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT\`.`);
    lines.push(`> Study: **${studyTitle}** (slug \`${args.study}\`, \`ID_STUDY=${studyId}\`) — the graph itself is shared catalog data (not study-scoped); this confirms the study's export exists.`);
    lines.push('> Source: Neo4j only (`9.knowledge.graph`\'s knowledge graph) — this run never connected to Firebird.');
    lines.push('> Design spec: `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` (Model 2).');
    lines.push('>');
    lines.push('> **Structural, not causal.** These communities reflect how densely nodes are connected in');
    lines.push('> *this* graph — itself a product of how the relational schema was built — not a psychological');
    lines.push('> or clinical claim. A community spanning two levels is a prompt to investigate, not proof the');
    lines.push('> septenary framework is wrong; the investigation goes back to the actual construct definitions.');
    lines.push('');
    lines.push('## Method');
    lines.push('');
    lines.push(`- **Algorithm:** Neo4j GDS Louvain (primary, modularity-based), over the same catalog subgraph as Model 1 — variables, constructs, instruments, septenary levels, chakras, Five Ways, and their real mapping edges (no synthetic shortcut edge this time — see this file's header for why).`);
    lines.push(`- **Cross-check:** Label Propagation run independently over the identical projection; for each Louvain community, the fraction of its members that also share one common Label Propagation community is reported as \`lpaAgreement\` — high agreement (near 1.0) means both unsupervised methods found the same structure, not just Louvain's own artifact.`);
    lines.push(`- **${ids.length} nodes total, ${communities.length} non-trivial communities found** (size > 1; singleton communities omitted below — nodes with too few connections to cluster with anything are not a finding).`);
    lines.push('');
    lines.push('## Communities, read against the septenary/chakra labels');
    lines.push('');
    for (const c of communities) {
      const levelRead = c.levels.length === 0 ? '*(no septenary level in this community)*'
        : c.levels.length === 1 ? `**matches ${c.levels[0]}**${c.chakras.length ? ` / ${c.chakras[0]}` : ''}`
        : `**spans ${c.levels.length} levels:** ${c.levels.join(', ')}`;
      lines.push(`### Community ${c.cid} (${c.size} members) — ${levelRead}`);
      lines.push('');
      lines.push(`- LPA agreement: ${(c.lpaAgreement * 100).toFixed(0)}%`);
      if (c.instruments.length) lines.push(`- Instrument(s): ${c.instruments.join(', ')}`);
      if (c.variables.length) lines.push(`- Variable(s): ${c.variables.join(', ')}`);
      lines.push('');
    }

    const pureCount = communities.filter((c) => c.levels.length === 1).length;
    const spanCount = communities.filter((c) => c.levels.length > 1).length;
    const noLevelCount = communities.filter((c) => c.levels.length === 0).length;
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **${pureCount} community(ies) match exactly one septenary level** — structural evidence the septenary mapping and the graph's own connectivity agree there.`);
    lines.push(`- **${spanCount} community(ies) span multiple levels** — worth a closer look at whether those levels are more related than the septenary model treats them as being, or whether the shared instrument/construct is entangling them structurally.`);
    lines.push(`- **${noLevelCount} community(ies) have no septenary level at all** — instruments/variables whose constructs were never mapped (by design or not yet), grouped by their own instrument/construct structure alone.`);

    const report = lines.join('\n');
    console.log('\n' + report);

    if (!args.dryRun) {
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `Community_Detection_${args.study}_${ts}.md`;
      fs.writeFileSync(path.join(OUT_DIR, fileName), report, 'utf8');
      console.log(`Written: ${path.join(OUT_DIR, fileName)}`);
    } else {
      console.log('[DRY RUN] report printed above, no file written.');
    }

  } finally {
    try { await session.run(`CALL gds.graph.drop($g, false)`, { g: GRAPH_NAME }); } catch (e) {}
    try { await session.run(`CALL gds.session.delete($g)`, { g: GRAPH_NAME }); console.log('GDS session released.'); } catch (e) {}
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
