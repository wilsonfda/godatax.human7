---
name: GDX_SKILL_GODATAX_HUMAN7_BY_SPU
description: Exports the entire GDX_HUMAN relational schema (2_relational.model.psychometrics, 3_septenary.constitution, 4_kundalini.chakras, 5_five.ways.tomas.aquino, 6_cardiac.coherence, 7_multidimensional.database) into a Neo4j knowledge graph -- one node label per table, one relationship type per foreign key, driven entirely by live Firebird schema introspection. Use when the user asks to build, refresh, or query the GDX_HUMAN knowledge graph in Neo4j.
---

# GDX_SKILL_GODATAX_HUMAN7_BY_SPU

Turns the whole `GDX_HUMAN` relational schema into a Neo4j property graph, the same way `GDX_SPU_LAYER/*NEO4J Export.py` turns the SPU tables into a knowledge graph elsewhere in this repo -- except nothing here is hand-mapped table by table. Everything is discovered live from Firebird's `RDB$` system catalog (`scripts/introspect.js`), so any table added under one of the 5 prefixes below is picked up automatically the next time this skill runs.

## Scope

All tables in the `godatax.human` Firebird database matching:

`GDX_PSY_*` (folder 2, psychometrics), `GDX_TA_*` (folder 5, Aquinas's Five Ways), `GDX_CC_*` (folder 6, cardiac coherence), `DW_DIM_*` / `DW_FACT_*` (folder 7, the data warehouse). Folders 3 (septenary constitution) and 4 (kundalini/chakras) are included too -- their tables (`GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_CHAKRA`) already carry the `GDX_PSY_` prefix, so no separate prefix is needed for them.

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
cd 9_knowledge.graph/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts
npm install                          # once: installs neo4j-driver + node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD + the
# NEO4J_* values from Neo4j-7d0a3815-Created-2026-09-10.txt, or export the
# vars directly -- never commit the filled-in .env

node export_graph.js --dry-run                          # introspect + count rows only, writes nothing to Neo4j
node export_graph.js --tables GDX_PSY_SEPTENARY_LEVEL,GDX_PSY_CHAKRA,GDX_TA_WAY,GDX_TA_WAY_SEPT_MAP,GDX_PSY_SEPT_LEVEL_PSY_MAP,GDX_PSY_INSTRUMENT,GDX_PSY_CONSTRUCT,GDX_PSY_VARIABLE
                                                          # small-scale real run: just the catalog/mapping tables (a few hundred rows total) -- do this before a full run
node export_graph.js --limit 50                          # real run, capped at 50 rows per table -- a fast full-breadth smoke test
node export_graph.js                                     # full export, every row of every in-scope table
```

## Scale warning -- read before a full run

As of the 2026-09-10 introspection, this schema has **55 in-scope tables and 70 FK relationships**. Two tables dominate the row count: `GDX_PSY_ITEM_RESPONSE` and its DW mirror `DW_FACT_PSY_ITEM_RESPONSE` (~58k rows each). A full, unfiltered `node export_graph.js` run against all 55 tables is therefore on the order of **100,000+ nodes** and a large number of relationships -- a slow, resource-heavy write against a live cloud database. Always run `--dry-run` first to see the real current counts, and prefer `--tables` or `--limit` for an initial pass before committing to the full export.

## Files in this skill

- `scripts/introspect.js` -- generic `RDB$`-catalog schema reader: table discovery (by prefix), per-table columns (with BLOB detection), per-table primary key, and every foreign key (including composite) among in-scope tables
- `scripts/export_graph.js` -- connects to Firebird (`blobAsText: true`) and Neo4j, runs `introspectSchema()`, writes nodes then relationships in batched `UNWIND`/`MERGE` Cypher; supports `--dry-run`, `--tables T1,T2,...`, `--limit N`
- `scripts/package.json`
- `.env.example` -- connection variable template for both databases (no secrets)
