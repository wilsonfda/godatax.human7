---
name: GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT
description: Runs Model 2 (community detection) from 10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md against the GDX_HUMAN knowledge graph in Neo4j -- unsupervised Louvain clustering (cross-checked with Label Propagation) over the catalog subgraph, compared against the existing septenary-level/chakra labels to see which structural clusters match, span, or fall outside the philosophical mapping. Reads only Neo4j, never Firebird. Writes a timestamped Markdown report to 10.gdx.machine.learning/. Use when the user asks whether the graph's own structure supports the septenary/chakra mapping, or wants a fresh read after the graph changes.
---

# GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT

Runs **Model 2** exactly as scoped in
`10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` and
`Data_Science_Workflow_Canvas.md`: unsupervised community detection over the same catalog
subgraph Model 1 uses, with **no labels used as input** — then reads the resulting clusters
against the existing septenary-level/chakra labels to see whether the philosophical framework's
groupings agree with the graph's own connectivity, or diverge from it in a way worth a second
look.

## Reads only Neo4j — never Firebird

Same as `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`: no `GDX_HUMAN_FB_*` variables, no
`node-firebird` import, connects only to the Neo4j graph
`GDX_SKILL_GODATAX_HUMAN7_BY_SPU` already populated.

## Scoped to one study — but only as an identity check

Same treatment as `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`: `--study <slug>` is required, resolves
via `new_study_intake/<slug>/intake.json`, and the run confirms a `GDX_PSY_STUDY` node for that
study exists in the graph before proceeding. The model's own subgraph (variables, constructs,
instruments, levels, chakras, Five Ways, and their real mapping edges) is shared catalog data
across every study, so `--study` does not filter it — it is the run's identity check and a
label on the report.

## Method

1. **Project the graph** (`gds.graph.project`, Aura Graph Analytics) over the catalog subgraph
   — variables, constructs, instruments, septenary levels, chakras, Five Ways, and their real
   `GDX_PSY_SEPT_LEVEL_PSY_MAP`/`GDX_TA_WAY_SEPT_MAP` mapping edges, undirected. **Deliberately
   no synthetic shortcut edge** (unlike `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`'s materialized
   `MAPS_TO_LEVEL`) — handing the algorithm a label-derived edge would defeat the point of
   asking whether the *unlabeled* structure agrees with the labels.
2. **Louvain** (`gds.louvain.stream`) — modularity-based, unsupervised, no training data.
3. **Label Propagation** (`gds.labelPropagation.stream`) — run independently as a
   cross-check; for each Louvain community, the fraction of its members that also share one
   common Label Propagation community is reported as an agreement score.
4. **Read against the labels** — for each non-trivial Louvain community (size > 1;
   singletons carry no clustering signal and are omitted), which `GDX_PSY_SEPTENARY_LEVEL`
   and `GDX_PSY_CHAKRA` nodes appear in it: exactly one (**match** — structural evidence for
   that part of the mapping), several (**spans levels** — worth investigating whether those
   levels are more related than the model treats them as being, or the instrument/construct
   entangles them structurally), or none (an instrument/construct never mapped, grouped by
   its own structure alone).

Both `.stream()` calls here return real, directly-resolvable node ids (verified during
development) — unlike the link-prediction pipeline's `predict.*` procedures, this model hit no
platform bug worth working around; see `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED/SKILL.md` if
curious why that skill's method section reads very differently.

## What this will never do

- **Never treats a mismatch as a refutation.** Per the design doc's own caveat: a community
  spanning two levels is a prompt to investigate the actual construct definitions, not proof
  the septenary framework is wrong. The report states this every run.
- **Never writes anything** — to the graph, to `GDX_PSY_SEPT_LEVEL_PSY_MAP`, or to Firebird.
  Fully read-only, same as `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`.
- **Never connects to Firebird.**

## Running it

```
cd 10.gdx.machine.learning/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT/scripts
npm install                          # once, installs neo4j-driver
# copy ../.env.example to ../.env and fill in the NEO4J_* values, or export the vars directly
node community_detect.js --study <slug> --dry-run     # print the report, write no file
node community_detect.js --study <slug>                # real run, writes the report
```

Output: `10.gdx.machine.learning/Community_Detection_<study-slug>_<YYYYMMDD_HHMMSS>.md` (one
file per run, old runs never overwritten).

## Files in this skill

- `scripts/community_detect.js` — projects the graph, runs Louvain + Label Propagation, reads
  the result against the septenary/chakra labels, writes the report (Node.js +
  `neo4j-driver`, no native dependency, no Firebird driver)
- `scripts/package.json`
- `.env.example` — Neo4j connection variable template (no secrets)
