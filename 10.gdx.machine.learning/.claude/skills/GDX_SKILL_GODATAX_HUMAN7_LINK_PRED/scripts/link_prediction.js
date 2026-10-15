#!/usr/bin/env node
/**
 * GDX_SKILL_GODATAX_HUMAN7_LINK_PRED
 *
 * Model 1 from 10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md:
 * suggests which GDX_PSY_SEPTENARY_LEVEL a psychometric GDX_PSY_VARIABLE with no existing
 * mapping most likely belongs to, using Neo4j GDS (Aura Graph Analytics) FastRP node
 * embeddings over the knowledge graph GDX_SKILL_GODATAX_HUMAN7_BY_SPU (9.knowledge.graph)
 * writes.
 *
 * Reads ONLY from Neo4j -- never connects to Firebird. The graph must already have been
 * populated by GDX_SKILL_GODATAX_HUMAN7_BY_SPU for the study passed via --study.
 *
 * Two-track design (see "Why a custom classifier" below):
 *   Track A -- gds.beta.pipeline.linkPrediction (the full GDS pipeline: FastRP + a
 *     cross-validated logistic-regression classifier) is run ONLY to obtain an
 *     independently-computed AUCPR metric for the report -- a real quality signal for the
 *     embeddings/positives, unrelated to how predictions are ultimately ranked.
 *   Track B -- the actual per-candidate ranking is computed by a small logistic regression
 *     trained in this script, in plain JS, on FastRP embeddings pulled back via
 *     gds.graph.nodeProperty.stream (Hadamard-product features, same recipe the design doc
 *     specifies). This is what actually produces the ranked suggestions in the report.
 *
 * Why a custom classifier for Track B: this Aura Graph Analytics build has a real,
 * reproducible bug where gds.beta.pipeline.linkPrediction.predict.{stream,mutate+write}
 * mis-resolves relationship endpoints back to the wrong Neo4j nodes on a graph projection
 * with more than one node label (verified during development: predict.mutate reports the
 * exact right *count* of candidate pairs, but gds.graph.relationship.write persists them
 * onto arbitrary same-label node pairs instead, e.g. GDX_PSY_CHAKRA -> GDX_PSY_CHAKRA).
 * gds.graph.nodeProperty.stream (a single-node property read, no relationship-endpoint
 * mapping involved) does not exhibit this bug, so embeddings are pulled that way and scored
 * with an in-process classifier instead of trusting the pipeline's own predict step.
 *
 * Usage:
 *   node link_prediction.js --study <slug> [--intake-dir <path>] [--top 3] [--dry-run]
 *
 *   --study <slug>   REQUIRED. Same slug the other GDX_HUMAN --study skills use. Verifies
 *                    a GDX_PSY_STUDY node for this study already exists in the graph (i.e.
 *                    GDX_SKILL_GODATAX_HUMAN7_BY_SPU has run for it) before doing anything
 *                    else -- this model's own subgraph (variables/constructs/instruments/
 *                    levels/chakras/ways) is global catalog data, not study-scoped, so
 *                    --study does not filter it (see SKILL.md); it is the run's identity
 *                    check and appears in the report header.
 *   --intake-dir     override the default new_study_intake/<slug>/ location.
 *   --top N          how many candidate levels to report per unmapped variable (default 3,
 *                    matching the design doc's "ranked top-3 list").
 *   --dry-run        run everything, print the report, write no file -- AND skip the one real
 *                    graph write this script makes (MERGE-materializing MAPS_TO_LEVEL). In
 *                    dry-run, that step is replaced by a read-only count of whatever
 *                    MAPS_TO_LEVEL edges a previous real run already materialized; if there
 *                    are none yet, the console warns that the ranking will be meaningless
 *                    (no positive examples to train on) until a real run has happened once.
 *
 * Connection: NEO4J_* environment variables only (see ../.env.example). Never hardcode
 * credentials here. Never connects to Firebird -- this reads the graph, nothing else.
 */

const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');

const OUT_DIR = path.join(__dirname, '..', '..', '..', '..'); // .claude/skills/<name>/scripts -> 10.gdx.machine.learning
const GRAPH_NAME = 'gdx-link-pred';
const PIPELINE_NAME = 'gdx-link-pred-pipeline';
const EMBEDDING_DIM = 32;
const EMBEDDING_DIM_INT = neo4j.int(EMBEDDING_DIM); // neo4j-driver params: a plain JS number
// marshals as a Neo4j Float over Bolt, but GDS's embeddingDimension config requires an
// Integer -- inline Cypher literals don't have this problem (Cypher parses them as integers),
// only values passed via $params do.

const NODE_LABELS = ['GDX_PSY_VARIABLE', 'GDX_PSY_CONSTRUCT', 'GDX_PSY_INSTRUMENT', 'GDX_PSY_SEPTENARY_LEVEL',
  'GDX_PSY_CHAKRA', 'GDX_TA_WAY', 'GDX_PSY_SEPT_LEVEL_PSY_MAP', 'GDX_TA_WAY_SEPT_MAP', 'GDX_PSY_INSTRUMENT_CONSTRUCT'];
const REL_TYPES = ['FK_GDX_PSY_VARIABLE_CONSTRUCT', 'FK_GDX_PSY_IC_CONSTRUCT', 'FK_GDX_PSY_IC_INSTRUMENT',
  'FK_GDX_PSY_CHAKRA_LEVEL', 'FK_GDX_PSY_CONSTRUCT_PARENT', 'FK_GDX_PSY_SLPM_INSTRUMENT',
  'FK_GDX_PSY_SLPM_LEVEL', 'FK_GDX_PSY_SLPM_VARIABLE', 'FK_GDX_TA_WSM_LEVEL', 'FK_GDX_TA_WSM_WAY', 'MAPS_TO_LEVEL'];

function parseArgs(argv) {
  const args = { study: null, intakeDir: null, top: 3, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else if (argv[i] === '--top') args.top = parseInt(argv[++i], 10);
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
  if (!fs.existsSync(p)) {
    throw new Error(`intake.json not found at ${p}. Pass --intake-dir if it lives somewhere else.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export the vars first.`);
  return v;
}

function toNum(v) { return v && typeof v.toNumber === 'function' ? v.toNumber() : v; }

// --- tiny logistic regression (Hadamard features -> P(edge)), trained here so Track B
// never depends on the pipeline's buggy predict step -- see file header. ---
function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
function hadamard(a, b) { return a.map((x, i) => x * b[i]); }
function trainLogisticRegression(features, labels, { epochs = 400, lr = 0.1, l2 = 0.001 } = {}) {
  const dim = features[0].length;
  let w = new Array(dim).fill(0);
  let bias = 0;
  const n = features.length;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dim).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = features[i].reduce((s, x, j) => s + x * w[j], bias);
      const p = sigmoid(z);
      const err = p - labels[i];
      for (let j = 0; j < dim; j++) gradW[j] += err * features[i][j];
      gradB += err;
    }
    for (let j = 0; j < dim; j++) w[j] -= lr * (gradW[j] / n + l2 * w[j]);
    bias -= lr * (gradB / n);
  }
  return { w, bias, predict: (x) => sigmoid(x.reduce((s, v, j) => s + v * w[j], bias)) };
}
// Deterministic small PRNG (mulberry32) so repeated runs sample the same negatives.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    console.log('Note: this model\'s own subgraph (variables/constructs/instruments/levels/chakras/ways) is ' +
      'shared catalog data, not scoped by study -- see SKILL.md.');

    // Materialize the direct VARIABLE -> LEVEL relationship this model trains on, from the
    // (junction-table) mapping already in the graph. Idempotent (MERGE); owned by this skill.
    // This is a real write to the graph, so -- unlike the read-only steps below -- it must be
    // skipped in --dry-run (the one actual bug this gate fixes: every other write in this
    // script is already --dry-run-safe, this MERGE used to run unconditionally).
    if (!args.dryRun) {
      const materialized = await session.run(`
        MATCH (m:GDX_PSY_SEPT_LEVEL_PSY_MAP)-[:FK_GDX_PSY_SLPM_VARIABLE]->(v:GDX_PSY_VARIABLE)
        MATCH (m)-[:FK_GDX_PSY_SLPM_LEVEL]->(l:GDX_PSY_SEPTENARY_LEVEL)
        MERGE (v)-[:MAPS_TO_LEVEL]->(l)
        RETURN count(*) AS n`);
      console.log(`MAPS_TO_LEVEL materialized: ${toNum(materialized.records[0].get('n'))} edge(s).`);
    } else {
      const existing = await session.run(`MATCH (:GDX_PSY_VARIABLE)-[r:MAPS_TO_LEVEL]->(:GDX_PSY_SEPTENARY_LEVEL) RETURN count(r) AS n`);
      const existingCount = toNum(existing.records[0].get('n'));
      console.log(`[DRY RUN] Skipped MAPS_TO_LEVEL materialization (no write performed) -- ${existingCount} edge(s) already in the graph from a previous real run.`);
      if (existingCount === 0) {
        console.log('[DRY RUN] WARNING: MAPS_TO_LEVEL has never been materialized (0 edges) -- this dry-run has no positive examples to train on and its ranking will be meaningless. Run once without --dry-run first.');
      }
    }

    // --- graph projection + FastRP embeddings ---
    try { await session.run(`CALL gds.graph.drop($g, false)`, { g: GRAPH_NAME }); } catch (e) { /* didn't exist */ }
    const proj = await session.run(`
      CALL gds.graph.project($g, $labels, $rels, {memory: '2GB', undirectedRelationshipTypes: ['*']})
      YIELD nodeCount, relationshipCount`, { g: GRAPH_NAME, labels: NODE_LABELS, rels: REL_TYPES });
    console.log(`Projected graph: ${toNum(proj.records[0].get('nodeCount'))} nodes, ${toNum(proj.records[0].get('relationshipCount'))} relationships.`);

    await session.run(`
      CALL gds.fastRP.mutate($g, {embeddingDimension: $dim, randomSeed: 42, mutateProperty: 'embedding'})`,
      { g: GRAPH_NAME, dim: EMBEDDING_DIM_INT });

    // --- Track B: pull embeddings, train + score in-process ---
    // Deliberately runs BEFORE Track A: Track A's own pipeline computes its own internal
    // 'embedding' node property (same mutateProperty name) as one of its steps, and doing
    // that after this block was observed during development to leave the property this
    // block depends on unreadable afterward -- so Track B extracts everything it needs
    // first, and Track A (independent, best-effort, non-fatal) runs after.
    const varEmbRes = await session.run(`CALL gds.graph.nodeProperty.stream($g, 'embedding', ['GDX_PSY_VARIABLE']) YIELD nodeId, propertyValue RETURN nodeId, propertyValue`, { g: GRAPH_NAME });
    const levelEmbRes = await session.run(`CALL gds.graph.nodeProperty.stream($g, 'embedding', ['GDX_PSY_SEPTENARY_LEVEL']) YIELD nodeId, propertyValue RETURN nodeId, propertyValue`, { g: GRAPH_NAME });

    const varIds = varEmbRes.records.map((r) => toNum(r.get('nodeId')));
    const levelIds = levelEmbRes.records.map((r) => toNum(r.get('nodeId')));
    const varNamesRes = await session.run(`MATCH (n:GDX_PSY_VARIABLE) WHERE id(n) IN $ids RETURN id(n) AS id, n.NAME AS name`, { ids: varIds });
    const levelNamesRes = await session.run(`MATCH (n:GDX_PSY_SEPTENARY_LEVEL) WHERE id(n) IN $ids RETURN id(n) AS id, n.NAME AS name, n.ORDER_NUM AS orderNum`, { ids: levelIds });

    const varName = {}; varNamesRes.records.forEach((r) => { varName[toNum(r.get('id'))] = r.get('name'); });
    const levelName = {}; levelNamesRes.records.forEach((r) => { levelName[toNum(r.get('id'))] = { name: r.get('name'), order: toNum(r.get('orderNum')) }; });
    const varVec = {}; varEmbRes.records.forEach((r) => { varVec[toNum(r.get('nodeId'))] = r.get('propertyValue'); });
    const levelVec = {}; levelEmbRes.records.forEach((r) => { levelVec[toNum(r.get('nodeId'))] = r.get('propertyValue'); });

    const existingRes = await session.run(`MATCH (v:GDX_PSY_VARIABLE)-[:MAPS_TO_LEVEL]->(l:GDX_PSY_SEPTENARY_LEVEL) RETURN v.NAME AS variable, l.NAME AS level`);
    const positivePairs = new Set(existingRes.records.map((r) => `${r.get('variable')}::${r.get('level')}`));

    const varIdList = Object.keys(varVec).map(Number);
    const levelIdList = Object.keys(levelVec).map(Number);

    // Build (feature, label) training set: all existing positives + an equal number of
    // deterministically-sampled non-edges as negatives (same 1:1 ratio GDS's own pipeline
    // used for Track A's split).
    const positives = [];
    for (const vId of varIdList) {
      for (const lId of levelIdList) {
        const key = `${varName[vId]}::${levelName[lId].name}`;
        if (positivePairs.has(key)) positives.push({ f: hadamard(varVec[vId], levelVec[lId]), label: 1 });
      }
    }
    const allNonEdges = [];
    for (const vId of varIdList) {
      for (const lId of levelIdList) {
        const key = `${varName[vId]}::${levelName[lId].name}`;
        if (!positivePairs.has(key)) allNonEdges.push({ vId, lId });
      }
    }
    const rand = mulberry32(42);
    const shuffled = allNonEdges.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const negatives = shuffled.slice(0, positives.length).map(({ vId, lId }) => ({ f: hadamard(varVec[vId], levelVec[lId]), label: 0 }));

    const trainSet = [...positives, ...negatives];
    const model = trainLogisticRegression(trainSet.map((r) => r.f), trainSet.map((r) => r.label));
    console.log(`Trained in-process classifier on ${positives.length} positive + ${negatives.length} sampled-negative examples.`);

    // Score every (unmapped variable, level) candidate.
    const unmappedVarIds = varIdList.filter((vId) => ![...positivePairs].some((k) => k.startsWith(`${varName[vId]}::`)));
    const predictions = unmappedVarIds.map((vId) => {
      const scores = levelIdList.map((lId) => ({
        level: levelName[lId].name, order: levelName[lId].order,
        probability: model.predict(hadamard(varVec[vId], levelVec[lId])),
      })).sort((a, b) => b.probability - a.probability);
      return { variable: varName[vId], top: scores.slice(0, args.top) };
    });

    // --- Track A: GDS's own pipeline, only for an independent AUCPR metric (best-effort,
    // runs after Track B has already extracted everything it needs -- see that block's note).
    // Re-projects the graph fresh first: the pipeline's own fastRP step also mutates a
    // property named 'embedding' on the graph it's given, which collides with the one
    // Track B already added directly (gds.fastRP.mutate) and makes the pipeline's internal
    // step fail -- a clean projection sidesteps the name collision entirely. ---
    let aucpr = null;
    try {
      try { await session.run(`CALL gds.graph.drop($g, false)`, { g: GRAPH_NAME }); } catch (e) {}
      await session.run(`
        CALL gds.graph.project($g, $labels, $rels, {memory: '2GB', undirectedRelationshipTypes: ['*']})`,
        { g: GRAPH_NAME, labels: NODE_LABELS, rels: REL_TYPES });
      try { await session.run(`CALL gds.beta.pipeline.drop($g, $p, false)`, { g: GRAPH_NAME, p: PIPELINE_NAME }); } catch (e) {}
      await session.run(`CALL gds.beta.pipeline.linkPrediction.create($g, $p)`, { g: GRAPH_NAME, p: PIPELINE_NAME });
      await session.run(`
        CALL gds.beta.pipeline.linkPrediction.addNodeProperty($g, $p, 'fastRP', {embeddingDimension: $dim, randomSeed: 42, mutateProperty: 'embedding'})`,
        { g: GRAPH_NAME, p: PIPELINE_NAME, dim: EMBEDDING_DIM_INT });
      await session.run(`
        CALL gds.beta.pipeline.linkPrediction.addFeature($g, $p, 'HADAMARD', {nodeProperties: ['embedding']})`,
        { g: GRAPH_NAME, p: PIPELINE_NAME });
      await session.run(`CALL gds.beta.pipeline.linkPrediction.addLogisticRegression($g, $p)`, { g: GRAPH_NAME, p: PIPELINE_NAME });
      await session.run(`
        CALL gds.beta.pipeline.linkPrediction.configureSplit($g, $p, {testFraction: 0.2, trainFraction: 0.6, validationFolds: 2})`,
        { g: GRAPH_NAME, p: PIPELINE_NAME });
      const trainRes = await session.run(`
        CALL gds.beta.pipeline.linkPrediction.train($g, {
          pipeline: $p, modelName: $p,
          targetRelationshipType: 'MAPS_TO_LEVEL',
          sourceNodeLabel: 'GDX_PSY_VARIABLE', targetNodeLabel: 'GDX_PSY_SEPTENARY_LEVEL',
          metrics: ['AUCPR']
        }) YIELD modelInfo`, { g: GRAPH_NAME, p: PIPELINE_NAME });
      aucpr = trainRes.records[0].get('modelInfo').metrics.AUCPR;
      console.log('GDS pipeline AUCPR (independent validation metric):', JSON.stringify(aucpr));
    } catch (e) {
      console.log('WARNING: GDS pipeline training for the AUCPR metric failed (report will note this):', e.message.slice(0, 300));
    }

    // --- report ---
    const now = new Date();
    const lines = [];
    lines.push('# GDX_HUMAN Knowledge Graph — Link Prediction Suggestions');
    lines.push('');
    lines.push(`> Generated ${now.toISOString()} by \`GDX_SKILL_GODATAX_HUMAN7_LINK_PRED\`.`);
    lines.push(`> Study: **${studyTitle}** (slug \`${args.study}\`, \`ID_STUDY=${studyId}\`) — the graph itself is shared catalog data (not study-scoped); this confirms the study's export exists.`);
    lines.push('> Source: Neo4j only (`9.knowledge.graph`\'s knowledge graph) — this run never connected to Firebird.');
    lines.push('> Design spec: `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` (Model 1).');
    lines.push('>');
    lines.push('> **Triage aid, not an auto-write.** These are ranked suggestions for human review — the');
    lines.push('> accepted suggestion still needs to be added to `GDX_SKILL_LOAD_SEPT_MAPS_DB`\'s knowledge.js');
    lines.push('> with its own justification, the same as every existing mapping. Nothing here writes to');
    lines.push('> `GDX_PSY_SEPT_LEVEL_PSY_MAP` automatically.');
    lines.push('');
    lines.push('## Method');
    lines.push('');
    lines.push(`- **Embeddings:** Neo4j GDS FastRP, ${EMBEDDING_DIM} dimensions, over the catalog subgraph (variables, constructs, instruments, septenary levels, chakras, Five Ways, and their mapping edges) — ${varIdList.length} variable nodes, ${levelIdList.length} level nodes.`);
    lines.push(`- **Training set:** ${positives.length} real \`MAPS_TO_LEVEL\` positive edges (materialized from \`GDX_PSY_SEPT_LEVEL_PSY_MAP\`) + ${negatives.length} sampled non-edges, Hadamard-product features, a logistic regression trained in-process (see this file's header for why the classifier runs here instead of via \`gds.beta.pipeline.linkPrediction.predict\` — a real platform bug in that step's relationship-endpoint write-back was found and worked around, not a design preference).`);
  lines.push(aucpr
      ? `- **Independent validation (GDS's own pipeline, same features, different code path):** AUCPR test=${aucpr.test?.toFixed(4)}, validation avg=${aucpr.validation?.avg?.toFixed(4)}.`
      : '- **Independent validation:** GDS pipeline training did not complete this run (see console log) — only the in-process classifier\'s ranking is available.');
    lines.push(`- **Small-N caveat:** ${positives.length} positive examples across 7 levels is a small training set — several levels have only 1-3 supporting examples. Treat every score below as a triage rank, not a confident classification (same caveat the design doc raises for the original 19-example baseline).`);
    lines.push('');
    lines.push(`## Ranked suggestions for ${predictions.length} unmapped variable(s)`);
    lines.push('');
    for (const p of predictions) {
      lines.push(`### ${p.variable}`);
      lines.push('');
      lines.push('| Rank | Candidate level | Probability |');
      lines.push('|---|---|---|');
      p.top.forEach((t, i) => lines.push(`| ${i + 1} | ${t.level} (level ${t.order}) | ${t.probability.toFixed(4)} |`));
      lines.push('');
    }

    const report = lines.join('\n');
    console.log('\n' + report);

    if (!args.dryRun) {
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `Link_Prediction_${args.study}_${ts}.md`;
      fs.writeFileSync(path.join(OUT_DIR, fileName), report, 'utf8');
      console.log(`Written: ${path.join(OUT_DIR, fileName)}`);
    } else {
      console.log('[DRY RUN] report printed above, no file written.');
    }

  } finally {
    try { await session.run(`CALL gds.graph.drop($g, false)`, { g: GRAPH_NAME }); } catch (e) {}
    try { await session.run(`CALL gds.beta.pipeline.drop($g, $p, false)`, { g: GRAPH_NAME, p: PIPELINE_NAME }); } catch (e) {}
    try { await session.run(`CALL gds.session.delete($g)`, { g: GRAPH_NAME }); console.log('GDS session released.'); } catch (e) {}
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
