# GoDataX Human 7 Knowledge Graph — What `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` Builds and Why

> Written 2026-09-18. Location: `GDX_HUMAN/9.knowledge.graph/`
>
> This folder had no explanation document before this one — the skill existed
> (`.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/SKILL.md`) but nothing here
> described, in one place, what it produces, why it exists, or how it's meant
> to be used downstream. This document is that missing piece, written
> alongside the skill gaining `--study <slug>` scoping (§4) — read the
> skill's own `SKILL.md` for exact usage/flags; read this file for the
> design rationale and the real, validated numbers.

## 1. Purpose

Every other folder in `GDX_HUMAN` (2 through 8) stores GDX_HUMAN's data as
**relational tables** — correct for OLTP writes and for the SQL-shaped
questions `8.gdx.dashboards`'s charts ask ("average score by level," "which
instrument concentrates where"). But `10.gdx.machine.learning`'s two planned
models (`Septenary_Link_Prediction_and_Community_Detection.md`) need a
different shape entirely: a **graph embedding** — a numeric vector per node
that encodes not just that node's own columns, but its position in the
*whole* network of relationships around it. A relational `JOIN` can walk
from a variable to its construct to its septenary level; an embedding
**encodes** that walk as a single vector, which is what a link-prediction or
community-detection algorithm actually consumes as input. That encoding only
makes sense on top of an actual graph — hence this folder.

`GDX_SKILL_GODATAX_HUMAN7_BY_SPU` is the bridge: it turns GDX_HUMAN's live
Firebird schema into a Neo4j property graph, one node label per table, one
relationship type per foreign key, so `10.gdx.machine.learning` has a graph
to run Neo4j Graph Data Science (GDS) algorithms against without a separate
ETL step of its own.

## 2. Source and target

- **Source:** the same `godatax.human` Firebird 2.5 database every other
  `GDX_HUMAN` skill reads/writes — specifically every table matching
  `GDX_PSY_*` (folders 2/3/4, psychometrics + septenary constitution +
  chakras — all three share the `GDX_PSY_` prefix), `GDX_TA_*` (folder 5,
  Aquinas's Five Ways), `GDX_CC_*` (folder 6, cardiac coherence), and
  `DW_DIM_*`/`DW_FACT_*` (folder 7, the data warehouse). One connection,
  five source folders, because they all already live in one Firebird
  database — see `GoDataX_Human_7_DW.md` §1 for why the DW itself is built
  the same way (same-database star schema, not a cross-database migration).
- **Target:** a Neo4j AuraDB instance (credentials in a local, not-committed
  `Neo4j-*.txt` drop — see `.env.example`).

## 3. The mapping rule — generic, not hand-mapped table by table

Unlike `GDX_SPU_LAYER/*NEO4J Export.py` elsewhere in the broader GoDataX
repo (a hand-written table-by-table mapping for a different project), this
skill discovers its mapping **live** from Firebird's own `RDB$` system
catalog (`scripts/introspect.js`) every time it runs:

- **Node** = one table. Label = the table name exactly as Firebird has it
  (e.g. `:GDX_PSY_PERSON`, `:DW_FACT_CC_HRV_WINDOW`).
- **Node property** = one column, using its own column name. `BLOB SUB_TYPE
  TEXT` columns (`RECORDED_BEHAVIOR`, `CORRESPONDENCE_JUSTIFICATION`, ...)
  are read as plain strings via the `blobAsText` connection option, not left
  as blob handles.
- **Node identity (`gdx_key`)** = the table's own primary key, joined with
  `::` for composite keys. Every write is a Cypher `MERGE` on this key, so
  re-running the skill is idempotent — it updates existing nodes rather than
  duplicating them, the same discipline `GDX_SKILL_LOAD_NEW_STUDY_DW` uses
  for the DW.
- **Relationship** = one `FOREIGN KEY` constraint whose child *and* parent
  table are both in scope. Relationship type = the constraint's own name
  (e.g. `:FK_GDX_PSY_APP_PARTICIPANT`), direction child → parent. A `NULL`
  FK column produces no relationship for that row.
- Nodes are always written before relationships (two-phase load), so a
  relationship `MATCH` never misses a parent that hasn't been created yet.

**A worked example**, since "one node per table, one edge per FK" is easier
to see than to state abstractly. Take one row of `GDX_PSY_VARIABLE_RESULT`
(person 784's "Emotional Exhaustion" score, `RAW_SCORE=4.0`):

```
(:GDX_PSY_VARIABLE_RESULT {gdx_key:"...", RAW_SCORE:4.0, ...})
    -[:FK_GDX_PSY_VR_APPLICATION]->  (:GDX_PSY_APPLICATION {gdx_key:"784", ID_STUDY:1, ...})
    -[:FK_GDX_PSY_VR_VARIABLE]->     (:GDX_PSY_VARIABLE {gdx_key:"22", NAME:"Emotional Exhaustion", ...})
                                          -[:FK_GDX_PSY_VARIABLE_CONSTRUCT]-> (:GDX_PSY_CONSTRUCT {gdx_key:"9", NAME:"Academic Burnout (hypothesis)"})
```

And separately, the same `GDX_PSY_VARIABLE` node also carries the DW's own
resolution of *which septenary level it belongs to* — not as a graph edge
from `GDX_PSY_VARIABLE` itself (the OLTP table has no such FK; the level
link lives in `GDX_PSY_SEPT_LEVEL_PSY_MAP`, reconciled by matching text, not
a FK — see `GoDataX_Human_7_DW.md` §4), but reachable in the graph via:

```
(:GDX_PSY_VARIABLE {gdx_key:"22"})  <-... GDX_PSY_SEPT_LEVEL_PSY_MAP.ID_VARIABLE (once populated)
(:GDX_PSY_SEPT_LEVEL_PSY_MAP)  -[:FK_GDX_PSY_SLPM_LEVEL]->  (:GDX_PSY_SEPTENARY_LEVEL {gdx_key:"1", NAME:"Physical Body"})
```

This is exactly the path Model 1 (link prediction, `10.gdx.machine.learning`)
walks as its training signal: `GDX_PSY_VARIABLE` sits between
`GDX_PSY_CONSTRUCT`, `GDX_PSY_SEPTENARY_LEVEL` (via the mapping table), and
`GDX_PSY_VARIABLE_RESULT` all at once — a relational query can join across
that, but the graph makes it a set of edges a GDS embedding algorithm can
walk directly.

## 4. 2026-09-18: scoped to one study — `--study <slug>`

Before this date, the skill had no study-scoping at all: every run exported
**every row of every in-scope table**, mixing every study's people into one
graph write with no way to ask "just this one study." That was fine when
`ID_STUDY=1` was the only study in the database, but it doesn't hold once a
second study is onboarded — a full unfiltered run would blend two studies'
participants, applications, and results into the graph with nothing marking
which rows came from which study (beyond an unindexed property buried in
whichever node happens to carry `ID_STUDY`).

`export_graph.js` now requires `--study <slug>` (same slug/intake.json
resolution as `GDX_SKILL_MAKE_DASHBOARS_DW` and `GDX_SKILL_LOAD_NEW_STUDY_DW`
— see either skill's `SKILL.md` for the exact lookup). Every table that can
genuinely be tied to one study is filtered to that study's rows only; every
table that can't (shared reference/catalog data — septenary levels, chakras,
the Five Ways, instrument/construct/variable/item definitions, devices) is
still exported **in full, every run** — filtering catalog data would risk
starving a relationship of its parent node for no real benefit, since these
tables are small (tens of rows) next to the fact tables this actually
matters for (tens of thousands). See `SKILL.md`'s scoping table for the
complete list of which table falls in which bucket, and
`scripts/export_graph.js`'s `studyScopeRules(studyId)` for the exact SQL.

**This is a genuine behavior change from before**, not just an added flag:
previously the only two dials on row count were `--tables` and `--limit`,
neither of which could express "this one study's real data, nothing more,
nothing less." `--study` is that missing dial. Because the graph `MERGE`s
rather than replaces, running
this skill again later for a *second* study adds that study's rows into the
same graph without touching the first study's already-written nodes — the
graph is meant to accumulate across studies over time, which is a different
model from `GDX_SKILL_MAKE_DASHBOARS_DW`'s one-timestamped-file-set-per-run
or `GDX_SKILL_LOAD_NEW_STUDY_DW`'s single always-current DW.

## 5. Real, validated run — `ID_STUDY=1`, 2026-09-18

`node export_graph.js --study 1 --dry-run` against the live database (no
write, introspection + `SELECT`/`COUNT` only):

| | |
|---|---|
| Tables in scope | 55 (23 study-scoped, 32 global/reference) |
| FK relationships in scope | 70 |
| Nodes this run would write | **141,706** |
| Largest study-scoped tables | `GDX_PSY_ITEM_RESPONSE` / `DW_FACT_PSY_ITEM_RESPONSE`: 58,374 rows each; `GDX_PSY_VARIABLE_RESULT` / `DW_FACT_PSY_VARIABLE_RESULT`: 9,305 rows each |
| Cardiac-coherence rows | `GDX_CC_PERSON`: 1, `GDX_CC_SESSION`: 5, `GDX_CC_HRV_WINDOW`: 5, `GDX_CC_RR_INTERVAL`/`GDX_CC_ECG_SAMPLE`/`GDX_CC_MOTION`/`GDX_CC_DEVICE_EVENT`: 0 (raw waveform capture was never loaded for the one CC participant, only derived HRV windows — see `GoDataX_Human_7_DW.md` §6) |
| Largest global/reference tables | `DW_DIM_DATE`: 4,019 (the 2020–2030 calendar bootstrap); `DW_DIM_ITEM`/`GDX_PSY_INSTRUMENT_ITEM`: 138 each |

Because `ID_STUDY=1` is still the only study in the database (as of this
writing), this scoped run's numbers happen to equal what an unfiltered run
would have produced before `--study` existed — the scoping doesn't change
today's totals, only what happens once a second study is onboarded.

**Update, 2026-09-21: this has now been written for real.** The current
target instance (`a6a03aab.databases.neo4j.io`, `Neo4j-a6a03aab-Created-2026-09-18.txt`)
was queried directly (`MATCH (n) RETURN count(n)` / `MATCH ()-->() RETURN
count(*)`) and holds **141,706 nodes / 331,771 relationships** across all 37
expected labels, with every per-label count matching this table exactly
(`GDX_PSY_ITEM_RESPONSE`/`DW_FACT_PSY_ITEM_RESPONSE`: 58,374 each;
`GDX_PSY_VARIABLE_RESULT`/`DW_FACT_PSY_VARIABLE_RESULT`: 9,305 each;
`GDX_PSY_PERSON`/`GDX_PSY_STUDY_PARTICIPANT`/`GDX_PSY_APPLICATION`: 423
each). Note there's an earlier, *separate* `scripts/full_export.log`
(2026-09-17, 140,704 nodes / 329,612 rels) that was written to a now-retired
Neo4j instance (`7d0a3815...`, predating the one in the current `.env`) —
that log does **not** describe the graph the current credentials point at;
the live-query numbers above are what's actually there today. §8's caveats
below (RAW_SCORE scale, single-study/single-CC-participant limits) still
hold — only the "has this been written" question is resolved.

## 6. How this feeds `10.gdx.machine.learning`

Full design in `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` —
summarized here so this folder's own document says *why* the graph is built
the way it is, not just *how*:

- **Model 1 (link prediction)** trains on the 19 existing
  `GDX_PSY_VARIABLE —[FK_GDX_PSY_SLPM_LEVEL]→ GDX_PSY_SEPTENARY_LEVEL` edges
  (via `GDX_PSY_SEPT_LEVEL_PSY_MAP`) as positive examples, embeds every
  `GDX_PSY_VARIABLE`/`GDX_PSY_CONSTRUCT`/`GDX_PSY_INSTRUMENT` node (GDS
  `fastRP`), and ranks candidate levels for every variable that has **no**
  mapping yet — a triage aid for `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s manual
  judgment calls, not an auto-write. With `ID_VARIABLE=22` (Emotional
  Exhaustion) now resolved (`GoDataX_Human_7_DW.md`/`Dashboards_DW_Explanation.md`
  §11 in `8.gdx.dashboards`), the positive-example count for this model just
  grew from 19 to 20 the same day this scoping work landed.
- **Model 2 (community detection)** runs unsupervised (GDS `louvain` /
  `labelPropagation`) over the same subgraph and compares the structural
  clusters it finds against the septenary/chakra/five-ways labels — no
  training data needed, so it sidesteps Model 1's small-N risk entirely, and
  is the recommended first model to actually build.

Both models need the graph populated **before** they can run at all — that
is this skill's entire job. Study-scoping (§4) matters here specifically
because Model 2's people-clustering extension ("cluster people by combined
psychometric + physiological profile") only becomes meaningful once more
than one cardiac-coherence-linked participant exists, and that will arrive
as new studies are onboarded — each needing its own scoped export into the
same accumulating graph, not a blended, unscoped re-export every time.

## 7. Scale and cost — read before a real (non-dry-run) run

A scoped run for `ID_STUDY=1` is still **~141,700 nodes** and a large number
of relationships — a slow, resource-heavy write against a live cloud Neo4j
instance, not something to run casually. Always `--dry-run` first (read the
per-table counts it prints), and prefer `--tables` (just the catalog/mapping
tables) or `--limit` (a capped smoke test across every table) before
committing to a full scoped export. See `SKILL.md`'s own scale-warning
section for the exact flags.

## 8. Known gaps / honest caveats

- **This graph has been written to Neo4j and validated by live query** (see
  the 2026-09-21 update in §5) — 141,706 nodes / 331,771 relationships,
  matching the dry-run's per-table predictions exactly. Both ML models in
  `10.gdx.machine.learning` can run against it now.
- **`RAW_SCORE` isn't on a uniform scale across variables**, and the graph
  carries it through unchanged. `Dashboards_DW_Explanation.md` (in
  `8.gdx.dashboards`) documents a real example: `Positive Emotions` (from
  the Positivity Ratio Scale) is answered on a 0–4 scale while most other
  variables are 1–5, and nothing in this export — or in the DW it mirrors —
  normalizes that. An embedding algorithm doesn't care (it only sees graph
  structure, not property values), but any future model that also feeds
  `RAW_SCORE` itself as a node feature should normalize per variable first,
  not trust it as a comparable number across the graph as-is.
- **Only one study exists today**, so §4's scoping logic is validated
  against the single case where scoping changes nothing observable. It
  needs a real second study onboarded to confirm the accumulate-don't-mix
  behavior actually holds in practice, not just in the code's intent.
- **Cardiac-coherence coverage is still one participant** (`SPSS-784`,
  `GDX_CC_PERSON` ID matching `GDX_PSY_PERSON` ID by the shared-numbering
  convention `GoDataX_Human_7_DW.md` §2 documents) — Model 2's
  people-clustering extension (§6) has nothing meaningful to cluster yet.

## 9. Files in this folder

- `.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/` — the skill itself; see
  its own `SKILL.md` for flags, the full scoped/global table list, and
  connection setup.
- `GoDataX_Human_7_Knowledge_Graph.md` — this file.
- `bloom-visualisation.svg` — a Neo4j Bloom rendering of the graph (from an
  earlier exploratory pass; regenerate after a real write to reflect the
  current, study-scoped data).
