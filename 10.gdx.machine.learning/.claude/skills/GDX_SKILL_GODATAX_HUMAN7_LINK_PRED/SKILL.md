---
name: GDX_SKILL_GODATAX_HUMAN7_LINK_PRED
description: Runs Model 1 (link prediction) from 10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md against the GDX_HUMAN knowledge graph in Neo4j -- FastRP node embeddings + a trained classifier suggest, for every GDX_PSY_VARIABLE with no existing septenary-level mapping, a ranked top-3 list of candidate GDX_PSY_SEPTENARY_LEVEL targets. Reads only Neo4j, never Firebird. Writes a timestamped Markdown report to 10.gdx.machine.learning/. Use when the user asks which level an unmapped psychometric variable most likely belongs to, or to refresh those suggestions after the graph changes.
---

# GDX_SKILL_GODATAX_HUMAN7_LINK_PRED

Runs **Model 1** exactly as scoped in
`10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` and
`Data_Science_Workflow_Canvas.md`: for every `GDX_PSY_VARIABLE` node with no existing
`MAPS_TO_LEVEL` edge, rank the 7 `GDX_PSY_SEPTENARY_LEVEL` nodes by predicted probability of
being the right one, using FastRP graph embeddings as features. Output is a ranked
**triage aid for human review** — see "What this will never do" below.

## Reads only Neo4j — never Firebird

This skill connects **only** to the Neo4j graph `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`
(`9.knowledge.graph`) already populated. It has no `GDX_HUMAN_FB_*` environment variables and
never imports `node-firebird`. If the graph hasn't been populated for the study you're
targeting yet, this skill's own `GDX_PSY_STUDY` check fails with a clear message telling you
to run `GDX_SKILL_GODATAX_HUMAN7_BY_SPU --study <slug>` first.

## Scoped to one study — but only as an identity check

Every run requires `--study <slug>` (same slug/intake.json resolution as the other
`--study`-scoped `GDX_HUMAN` skills), and the run confirms a `GDX_PSY_STUDY` node for that
study exists in the graph before doing anything else. **This does not filter the model's own
subgraph** — `GDX_PSY_VARIABLE`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_INSTRUMENT`,
`GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY` and their mapping edges are shared
catalog data across every study (see `GDX_SKILL_GODATAX_HUMAN7_BY_SPU/SKILL.md`'s
scoped-vs-global table), so `--study` here is an identity/sanity check and a label on the
report, not a data filter.

## Method

1. **Materialize `MAPS_TO_LEVEL`** — a direct `(:GDX_PSY_VARIABLE)-[:MAPS_TO_LEVEL]->(:GDX_PSY_SEPTENARY_LEVEL)`
   edge, `MERGE`d from the existing `GDX_PSY_SEPT_LEVEL_PSY_MAP` junction-table mapping (idempotent,
   owned by this skill — `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` never creates it).
2. **Project a graph** (`gds.graph.project`, Aura Graph Analytics) over the catalog subgraph
   plus `MAPS_TO_LEVEL`, undirected.
3. **FastRP embeddings** (`gds.fastRP.mutate`, 32 dimensions) for every node.
4. **Two tracks from here** — see "Why a custom classifier" below for why both exist:
   - **Track A** (metric only): the real `gds.beta.pipeline.linkPrediction` pipeline —
     FastRP + a cross-validated logistic regression — trained on the existing
     `MAPS_TO_LEVEL` edges as positives, reported as an independent AUCPR figure in the report.
   - **Track B** (the actual ranking): embeddings pulled back via
     `gds.graph.nodeProperty.stream`, Hadamard-product features, a small logistic regression
     trained **in this script** (plain JS, ~30 lines, no dependency) on the same positive
     edges plus an equal number of deterministically-sampled non-edges. This is what scores
     every (unmapped variable, level) candidate and produces the report's ranking.
5. **Report** — ranked top-N (default 3) candidate levels per unmapped variable, with
   probabilities, the AUCPR figure, and the small-N caveat.

### Why a custom classifier (Track B) instead of trusting the pipeline's own predict step

This was not a design preference — it is a workaround for a real, reproducible bug found
while building this skill: `gds.beta.pipeline.linkPrediction.predict.stream` and
`.predict.mutate` + `gds.graph.relationship.write` **mis-resolve relationship endpoints** on
a graph projection with more than one node label. Verified symptoms:

- `predict.stream` returns `node1`/`node2` as `0` for every single row (a real Neo4j-driver
  Integer, always zero, regardless of which candidate pair was actually scored).
- `predict.mutate` reports the **exactly correct candidate count** (136 for this graph — the
  true number of non-existing `(GDX_PSY_VARIABLE, GDX_PSY_SEPTENARY_LEVEL)` pairs), proving
  the *scoring* is scoped correctly internally — but `gds.graph.relationship.write`
  (the only way to get `.mutate`'s results back into Neo4j as real relationships) then
  persists all of them onto arbitrary same-label node pairs instead (observed:
  `GDX_PSY_CHAKRA -> GDX_PSY_CHAKRA`, never touching the intended variable/level nodes).

`gds.graph.nodeProperty.stream` (a single-node property read, no relationship-endpoint
mapping involved) does **not** exhibit this bug — ids resolve correctly every time it was
tested — which is why Track B pulls embeddings that way and scores them itself rather than
trusting `predict.*`. Track A is kept anyway because its AUCPR metric (a genuine
cross-validated number from a completely different, GDS-native code path) is a real,
independent quality signal for the report even though its raw predictions can't be trusted.
If a future Aura Graph Analytics release fixes this, Track B could be retired in favor of
`predict.stream` directly — leave this note until that's verified.

## What this will never do

- **Never auto-writes to `GDX_PSY_SEPT_LEVEL_PSY_MAP`.** The output is a ranked suggestion
  list for a human to review — same discipline as `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s own
  `knowledge.js`: accepting a suggestion still means adding it there by hand, with its own
  written justification.
- **Never claims a confident classification.** The report states the exact positive-example
  count every run (18 as of 2026-09-18/19, one more than the design doc's original 19-vs-7-level
  baseline mentioned — see `GoDataX_Human_7_DW.md`/`Dashboards_DW_Explanation.md` §11 in
  `8.gdx.dashboards` for the variable that changed this) and repeats the design doc's small-N
  caveat: several levels have only 1-3 supporting examples, so every score is a triage rank,
  not a confident label.
- **Never connects to Firebird.**

## Running it

```
cd 10.gdx.machine.learning/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_LINK_PRED/scripts
npm install                          # once, installs neo4j-driver
# copy ../.env.example to ../.env and fill in the NEO4J_* values, or export the vars directly
node link_prediction.js --study <slug> --dry-run     # print the report, write no file
node link_prediction.js --study <slug>                # real run, writes the report
node link_prediction.js --study <slug> --top 5        # report top 5 candidates per variable instead of 3
```

Output: `10.gdx.machine.learning/Link_Prediction_<study-slug>_<YYYYMMDD_HHMMSS>.md` (one file
per run, old runs never overwritten).

## Files in this skill

- `scripts/link_prediction.js` — projects the graph, computes embeddings, runs both tracks,
  writes the report (Node.js + `neo4j-driver`, no native dependency, no Firebird driver)
- `scripts/package.json`
- `.env.example` — Neo4j connection variable template (no secrets)
