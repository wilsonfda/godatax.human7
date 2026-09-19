---
name: GDX_SKILL_GODATAX_HUMAN7_BY_SPU
description: Exports one study's slice of the GDX_HUMAN relational schema (2.relational.model.psychometrics, 3.septenary.constitution, 4.kundalini.chakras, 5.five.ways.tomas.aquino, 6.cardiac.coherence, 7.multidimensional.database), scoped via --study <slug>, into a Neo4j knowledge graph -- one node label per table, one relationship type per foreign key, driven entirely by live Firebird schema introspection. Use when the user asks to build, refresh, or query the GDX_HUMAN knowledge graph in Neo4j for a specific study.
---

# GDX_SKILL_GODATAX_HUMAN7_BY_SPU

Turns one study's slice of the `GDX_HUMAN` relational schema into a Neo4j property graph, the same way `GDX_SPU_LAYER/*NEO4J Export.py` turns the SPU tables into a knowledge graph elsewhere in this repo -- except nothing here is hand-mapped table by table. Structure (which tables, which columns, which foreign keys) is discovered live from Firebird's `RDB$` system catalog (`scripts/introspect.js`), so any table added under one of the 5 prefixes below is picked up automatically the next time this skill runs. See `9.knowledge.graph/GoDataX_Human_7_Knowledge_Graph.md` for the full design rationale, including why this graph exists (the training substrate for the ML models `10.gdx.machine.learning` builds).

## Scope

All tables in the `godatax.human` Firebird database matching:

`GDX_PSY_*` (folder 2, psychometrics), `GDX_TA_*` (folder 5, Aquinas's Five Ways), `GDX_CC_*` (folder 6, cardiac coherence), `DW_DIM_*` / `DW_FACT_*` (folder 7, the data warehouse). Folders 3 (septenary constitution) and 4 (kundalini/chakras) are included too -- their tables (`GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_CHAKRA`) already carry the `GDX_PSY_` prefix, so no separate prefix is needed for them.

## Scoped to one study

Every run now requires `--study <slug>` -- the same slug `GDX_SKILL_NEW_STUDY` / `GDX_SKILL_MAKE_DASHBOARS_DW` /
`GDX_SKILL_LOAD_NEW_STUDY_DW` use for `new_study_intake/<slug>/intake.json`. The slug resolves to the
study's title, the title resolves to `GDX_PSY_STUDY.ID_STUDY`, and every **study-scoped** table (below)
is filtered to only that one study's rows. Running the skill again for a different study writes that
study's rows into the *same* Neo4j graph (`MERGE`, not overwrite) -- unlike the two dashboard/DW skills,
this one is meant to accumulate: the graph is the shared cross-study substrate `10.gdx.machine.learning`
trains against, not a one-study-at-a-time artifact.

### Study-scoped tables vs. global reference tables

Not every table has an `ID_STUDY` column, so a table is filtered only if it can genuinely be tied to
one study; everything else is exported **in full, every run, regardless of `--study`** -- it is shared
reference/catalog data (septenary levels, chakras, the Five Ways, instrument/construct/variable/item
definitions, devices), the same "bootstrapped once, not scoped by study" philosophy
`GDX_SKILL_LOAD_NEW_STUDY_DW` already documents for its own global DW dimensions.

| Scoped by | Tables |
|---|---|
| `ID_STUDY` directly | `GDX_PSY_STUDY`, `GDX_PSY_STUDY_PARTICIPANT`, `GDX_PSY_APPLICATION`, `GDX_PSY_OBSERVATION`, `GDX_PSY_EVALUATION`, `DW_DIM_PERSON` |
| `ID_PERSON` in this study's roster | `GDX_PSY_PERSON`, `GDX_CC_PERSON`, `GDX_CC_SESSION`, `DW_DIM_SESSION`, `DW_FACT_PSY_ITEM_RESPONSE`, `DW_FACT_PSY_VARIABLE_RESULT`, `DW_FACT_CC_HRV_WINDOW` |
| `ID_APPLICATION` in this study's applications | `GDX_PSY_ITEM_RESPONSE`, `GDX_PSY_VARIABLE_RESULT`, `GDX_PSY_CONSTRUCT_RESULT`, `GDX_PSY_INDICATOR_RESULT` |
| `SESSION_ID` in this study's CC sessions | `GDX_CC_RR_INTERVAL`, `GDX_CC_ECG_SAMPLE`, `GDX_CC_MOTION`, `GDX_CC_HRV_WINDOW`, `GDX_CC_DEVICE_EVENT` |
| `ID_EVALUATION` in this study's evaluations | `GDX_PSY_EVALUATION_ACTION` |
| *(not scoped -- always full)* | everything else: `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`, `GDX_TA_WAY_SEPT_MAP`, `GDX_PSY_INSTRUMENT`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_VARIABLE`, `GDX_PSY_INSTRUMENT_ITEM`, `GDX_PSY_INSTRUMENT_CONSTRUCT`, `GDX_PSY_ITEM_ALTERNATIVE`, `GDX_PSY_INDICATOR`, `GDX_PSY_EVALUATOR`, `GDX_PSY_ACTION`, `GDX_PSY_PSYCHOMETRIC_PROPERTY`, `GDX_CC_DEVICE`, `DW_DIM_SEPTENARY_LEVEL`, `DW_DIM_CHAKRA`, `DW_DIM_FIVE_WAY`, `DW_DIM_DATE`, `DW_DIM_INSTRUMENT`, `DW_DIM_CONSTRUCT`, `DW_DIM_VARIABLE`, `DW_DIM_ITEM`, `DW_DIM_DEVICE`, and a handful of empty/unused catalogs (`GDX_PSY_TEAM*`, `GDX_PSY_OCCUPATION*`) |

`GDX_PSY_PERSON` and `GDX_CC_PERSON` are both filtered by `ID_PERSON` directly: cardiac-coherence and
psychometric person ids **share the same numbering by convention** in this dataset (see
`GoDataX_Human_7_DW.md` section 2) -- the same assumption `GDX_SKILL_LOAD_NEW_STUDY_DW`'s own
`loadDevicesAndSessions()` already makes, reused here rather than re-derived.

The exact WHERE fragment per table lives in `scripts/export_graph.js`'s `studyScopeRules(studyId)` --
read it before assuming a table's scoping if this list and the code ever drift.

## Mapping rule (fixed, not configurable per-run)

- **Node** = one table. Label = the table name exactly as it exists in Firebird (e.g. `:GDX_PSY_PERSON`, `:DW_FACT_CC_HRV_WINDOW`).
- **Node property** = one column. Every column becomes a property, using its own column name; BLOB `SUB_TYPE TEXT` columns (e.g. `RECORDED_BEHAVIOR`, `CORRESPONDENCE_JUSTIFICATION`) are read as plain strings via the `blobAsText` connection option.
- **Node identity (`gdx_key`)** = the table's primary key value(s), joined with `::` for composite keys (e.g. `GDX_PSY_APPLICATION`'s `(ID_STUDY, ID_PERSON)` PK becomes `"1::784"`). Every write is a Cypher `MERGE` on this key, so re-running the skill is idempotent -- it updates existing nodes, never duplicates them.
- **Relationship** = one `FOREIGN KEY` constraint whose child *and* parent table are both in scope. Relationship type = the FK constraint's own name (e.g. `:FK_GDX_PSY_APP_PARTICIPANT`), direction child → parent. A FK column that is `NULL` produces no relationship for that row (nothing to point at).
- Nodes are always written before relationships (two-phase load), so a relationship `MATCH` never misses a parent that hasn't been created yet.

## What it will never do

- **Never hardcodes a table, column, or relationship.** Add a table to any `*_firebird25.sql` script under one of the 5 prefixes and it appears in the graph on the next run with no code change here.
- **Never hardcodes Firebird or Neo4j credentials.** Both come from environment variables only (see `.env.example`) -- per `CLAUDE.md`, this applies even as an "overridable default."

## Running it

```
cd 9.knowledge.graph/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts
npm install                          # once: installs neo4j-driver + node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD + the
# NEO4J_* values from Neo4j-a6a03aab-Created-2026-09-18.txt, or export the
# vars directly -- never commit the filled-in .env

node export_graph.js --study <slug> --dry-run            # introspect + count rows only, writes nothing to Neo4j
node export_graph.js --study <slug> --tables GDX_PSY_SEPTENARY_LEVEL,GDX_PSY_CHAKRA,GDX_TA_WAY,GDX_TA_WAY_SEPT_MAP,GDX_PSY_SEPT_LEVEL_PSY_MAP,GDX_PSY_INSTRUMENT,GDX_PSY_CONSTRUCT,GDX_PSY_VARIABLE
                                                          # small-scale real run: just the catalog/mapping tables -- do this before a full run
node export_graph.js --study <slug> --limit 50           # real run, capped at 50 rows per table -- a fast full-breadth smoke test
node export_graph.js --study <slug>                      # full export, every row of every in-scope table for this one study
                                                          # (plus the always-full global reference tables)
```

`--study <slug>` is **required** -- same resolution as `GDX_SKILL_MAKE_DASHBOARS_DW`/`GDX_SKILL_LOAD_NEW_STUDY_DW`:
the slug's `new_study_intake/<slug>/intake.json` must exist and its `study.title` must already be a row
in `GDX_PSY_STUDY`. Pass `--intake-dir <path>` if that intake lives somewhere else (e.g. a legacy study
with no real intake -- see `GoDataX_Human_7_Knowledge_Graph.md` for how `ID_STUDY=1` is handled today).

## Scale warning -- read before a full run

As of the 2026-09-18 introspection, this schema has **55 in-scope tables and 70 FK relationships**, of
which **23 are study-scoped** and **32 are always exported in full** regardless of `--study` (see the
table above). For `ID_STUDY=1` -- currently the only study, so a scoped run captures everything anyone
has loaded so far -- `--dry-run` reports **~141,700 nodes**, dominated by `GDX_PSY_ITEM_RESPONSE` and its
DW mirror `DW_FACT_PSY_ITEM_RESPONSE` (~58k rows each) plus `DW_FACT_PSY_VARIABLE_RESULT`/`GDX_PSY_VARIABLE_RESULT`
(~9.3k rows each). That is still a large, resource-heavy write against a live cloud database. Always run
`--dry-run` first to see the real current counts for the study you're targeting, and prefer `--tables` or
`--limit` for an initial pass before committing to a full export. A *second* study's scoped run adds only
that study's rows (`MERGE`, not truncate) -- the graph accumulates across studies over time, unlike
`GDX_SKILL_MAKE_DASHBOARS_DW`'s one-file-set-per-study-per-run model.

## Files in this skill

- `scripts/introspect.js` -- generic `RDB$`-catalog schema reader: table discovery (by prefix), per-table columns (with BLOB detection), per-table primary key, and every foreign key (including composite) among in-scope tables
- `scripts/export_graph.js` -- resolves `--study <slug>` to `ID_STUDY` (same intake.json lookup as the sibling skills), connects to Firebird (`blobAsText: true`) and Neo4j, runs `introspectSchema()`, applies `studyScopeRules(studyId)` per table, writes nodes then relationships in batched `UNWIND`/`MERGE` Cypher; supports `--study <slug>` (required), `--intake-dir <path>`, `--dry-run`, `--tables T1,T2,...`, `--limit N`
- `scripts/package.json`
- `.env.example` -- connection variable template for both databases (no secrets)

See `9.knowledge.graph/GoDataX_Human_7_Knowledge_Graph.md` for what the resulting graph looks like, why
it exists, and how `10.gdx.machine.learning` is meant to consume it.
