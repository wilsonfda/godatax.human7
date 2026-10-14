# Plan: GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS

Status: planning only, nothing implemented yet.
Target location: `14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/`

## Goal

Let the user associate, conversationally and one association at a time, a
psychometric or metaphysicometric variable (`GDX_PSY_VARIABLE`, any
`VARIABLE_TYPE`) to:

1. a **Septenary Constitution** level (`GDX_PSY_SEPT_LEVEL_PSY_MAP`),
2. a **Way of Thomas Aquinas** (`GDX_TA_WAY_SEPT_MAP`), or
3. a **Kundalini Chakra** (new mapping table — see "Schema gap" below).

Today this association only exists if someone writes the `INSERT` by hand
(that is how the 7 OT-7 items were linked to Way 5 in
`ot7_way_map_dml_firebird25.sql`). This skill is the interactive interface
that is missing to do this without hand-writing SQL.

## What already exists in the project (context gathered before this plan)

- **`GDX_PSY_SEPT_LEVEL_PSY_MAP`** (`3.septenary.constitution/septenary_constitution_model_firebird25.sql`)
  — Variable ↔ Septenary Level association table. Relevant columns:
  `ID_MAPPING` (PK), `ID_SEPTENARY_LEVEL` (FK, NOT NULL), `ID_INSTRUMENT` (FK,
  nullable), `INSTRUMENT_LABEL` (NOT NULL), `ID_VARIABLE` (FK, nullable),
  `VARIABLE_LABEL` (NOT NULL), `RECORDED_BEHAVIOR` (NOT NULL),
  `CORRESPONDENCE_JUSTIFICATION` (NOT NULL), `CONFIDENCE_LEVEL` (default
  `'SPECULATIVE'`, CHECK IN `HIGH/MEDIUM/LOW/SPECULATIVE`). No UNIQUE on
  `ID_VARIABLE` — nothing in the database itself prevents a duplicate; the
  skill has to check on its own.

- **`GDX_TA_WAY_SEPT_MAP`** (`5.five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql`,
  extended by `14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql`
  on 2026-10-09) — originally just `ID_WAY` + `ID_SEPTENARY_LEVEL` +
  justification (the conceptual Way↔Level correspondence, 5 fixed rows). The
  extension added `ID_INSTRUMENT`, `INSTRUMENT_LABEL`, `ID_VARIABLE`,
  `VARIABLE_LABEL`, `RECORDED_BEHAVIOR` — all nullable, precisely to allow
  attaching a variable to a Way without breaking the 5 original conceptual
  rows. The UNIQUE constraint was redefined from
  `(ID_WAY, ID_SEPTENARY_LEVEL)` to `(ID_WAY, ID_SEPTENARY_LEVEL, VARIABLE_LABEL)`
  — i.e. `VARIABLE_LABEL` needs to be a specific value per variable to avoid
  a collision.

- **`GDX_PSY_CHAKRA`** (`4.kundalini.chakras/chakras_model_firebird25.sql`) —
  a pure 7-row catalog (one row per chakra, `ID_SEPTENARY_LEVEL` FK, ascending
  correspondence), with **no variable/instrument mapping columns at all**
  today. Unlike `GDX_TA_WAY_SEPT_MAP`, there is no separate
  chakra↔variable association table yet — see "Schema gap" below.

- Metaphysical variables (e.g. the 7 from OT-7) are **not a new table** —
  they are ordinary rows in `GDX_PSY_VARIABLE` with
  `VARIABLE_TYPE = 'METAPHYSICS'` (a free `VARCHAR(40)` column, no CHECK
  constraint). The skill needs no special logic to tell psychometric and
  metaphysical variables apart beyond reading that field.

- **`GDX_SKILL_LIST_ASSOCIATIONS`** (same folder, already exists) — only
  **reads** and reports every association already made in the framework
  (septenary, ways, chakras, virtology). Writes nothing.

- **`GDX_SKILL_LOAD_SEPT_MAPS_DB`** (`3.septenary.constitution`, already
  exists) — **writes** to `GDX_PSY_SEPT_LEVEL_PSY_MAP`, but only in batch,
  per `--study <slug>`, using a `knowledge.js` catalog hand-edited *before*
  running (never asks the user anything during execution). Does not touch
  `GDX_TA_WAY_SEPT_MAP` or chakras.

The skill planned here is the missing counterpart: write **one association at
a time**, conversationally, for **any** variable already in the database
(from any study/instrument), against **any of the three** targets (Septenary,
Way of Aquinas, or Chakra) — without editing `knowledge.js` or running the
whole new-study pipeline.

## Schema gap: chakras need a new mapping table

`GDX_PSY_CHAKRA` is a catalog table (like `GDX_PSY_SEPTENARY_LEVEL` and
`GDX_TA_WAY` were before their mapping tables existed) — it is not itself a
relation table, so it cannot be extended in place the way `GDX_TA_WAY_SEPT_MAP`
was (that table was already a relation, one row per Way, so adding nullable
columns to it was safe; `GDX_PSY_CHAKRA` is one fixed row per chakra, with
`UNIQUE` constraints on `ORDER_NUM`/`SANSKRIT_NAME` — extending it in place
would break that).

The consistent move is a **new table**, mirroring `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s
shape exactly:

```sql
CREATE TABLE GDX_PSY_CHAKRA_VAR_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_CHAKRA BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT,
  INSTRUMENT_LABEL VARCHAR(160) NOT NULL,
  ID_VARIABLE BIGINT,
  VARIABLE_LABEL VARCHAR(150) NOT NULL,
  RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT NOT NULL,
  CORRESPONDENCE_JUSTIFICATION BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  CONSTRAINT PK_GDX_PSY_CHAKRA_VM PRIMARY KEY (ID_MAPPING),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_CHAKRA FOREIGN KEY (ID_CHAKRA)
    REFERENCES GDX_PSY_CHAKRA(ID_CHAKRA),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES GDX_PSY_INSTRUMENT(ID_INSTRUMENT),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_VARIABLE FOREIGN KEY (ID_VARIABLE)
    REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE),
  CONSTRAINT CK_GDX_PSY_CHAKRA_VM_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);
```

This needs its own DDL script, following the same convention as
`metaphysical_variable_way_map_firebird25.sql` (which lives in
`14.metaphysical.measuring.instrument/` even though it alters a table defined
in `5.five.ways.tomas.aquino/`, because this folder is where the
OT-7-driven, cross-cutting schema extensions already live). Proposed name:
`metaphysical_variable_chakra_map_firebird25.sql`, same folder. This script
is a **prerequisite** — it must be applied to the database before the skill
can write any chakra association; the skill itself never runs DDL.

## Scope

Included: associating a variable to a septenary level, to a Way of Aquinas,
or to a chakra.

## Conversational flow

1. **Resolve the variable** — the user describes the variable by name (or
   partial name, or by instrument — e.g. "the OT-7 purpose variable"). The
   skill queries `GDX_PSY_VARIABLE` live against Firebird (+
   `GDX_PSY_CONSTRUCT`/`GDX_PSY_INSTRUMENT` for context), shows
   `VARIABLE_TYPE` (psychological vs. metaphysical), and asks for
   confirmation if more than one match is possible.

2. **Choose the target** — asks: Septenary Constitution, Way of Aquinas, or
   Chakra?
   - Septenary → shows the 7 levels read live from `GDX_PSY_SEPTENARY_LEVEL`
     (never hardcoded in the script).
   - Way of Aquinas → shows the 5 ways read live from `GDX_TA_WAY`; the
     septenary level for that way is **not** asked again — it is resolved
     automatically from the existing conceptual row in `GDX_TA_WAY_SEPT_MAP`
     (each way already has exactly one fixed level).
   - Chakra → shows the 7 chakras read live from `GDX_PSY_CHAKRA`; writes to
     the new `GDX_PSY_CHAKRA_VAR_MAP` table (see "Schema gap" above).

3. **Check for a duplicate** — looks for an existing association for that
   variable in the chosen target; if one exists, shows it and asks whether to
   **update** it (never silently overwrites, since none of the three tables
   has a UNIQUE constraint on `ID_VARIABLE`).

4. **Collect the interpretive judgment call** — asks, never invents: recorded
   behavior (`RECORDED_BEHAVIOR`), correspondence justification
   (`CORRESPONDENCE_JUSTIFICATION`), and confidence level
   (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`, default `SPECULATIVE`).

5. **Dry-run → confirmation → commit** — same pattern as the sibling skills:
   shows exactly the row that would be written, only writes after explicit
   user confirmation.

## Files to create

```
14.metaphysical.measuring.instrument/
  metaphysical_variable_chakra_map_firebird25.sql   (prerequisite DDL -- new GDX_PSY_CHAKRA_VAR_MAP table)
  .claude/skills/GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/
    SKILL.md
    scripts/
      associate_variable.js   (Node + node-firebird, same stack as the sibling skills)
      package.json
    .env.example               (same standard project Firebird credentials; real .env stays gitignored)
```

One single script (no need for the 3-stage intake.json pattern of
`GDX_SKILL_NEW_STUDY` — this is one association at a time, not a whole
study), with flags resolved during the conversation:

```
node associate_variable.js --variable-id <id> --target septenary --level <1-7> \
  --behavior "..." --justification "..." --confidence SPECULATIVE --dry-run

node associate_variable.js --variable-id <id> --target way --way <1-5> \
  --behavior "..." --justification "..." --confidence MEDIUM --dry-run

node associate_variable.js --variable-id <id> --target chakra --chakra <1-7> \
  --behavior "..." --justification "..." --confidence SPECULATIVE --dry-run

# to correct an existing association:
node associate_variable.js --update <id_mapping> --behavior "..." --justification "..."
```

## Safety rules (what the skill will never do)

- Never invents the level/way/chakra or the justification — that is always a
  question to the user, never a model guess.
- Never writes to the database without `--dry-run` having been shown and
  confirmed first.
- Never overwrites an existing association without an explicit `--update`.
- Never touches `GDX_PSY_SEPTENARY_LEVEL`, `GDX_TA_WAY`, or `GDX_PSY_CHAKRA`
  (the fixed catalogs) — only writes to the three association tables.
- Never runs DDL itself — `GDX_PSY_CHAKRA_VAR_MAP` must already exist in the
  database (applied once, manually, like every other schema script in this
  project) before the skill's chakra path can be used.
- Fills in both the FK (`ID_VARIABLE`/`ID_INSTRUMENT`) and the text columns
  (`VARIABLE_LABEL`/`INSTRUMENT_LABEL`), the same dual pattern already used
  by all three tables.
- Never uses hardcoded Firebird credentials in the script — same rule as the
  sibling skills (`.env` gitignored, `.env.example` only as a template).

## Open points to confirm before implementation

- Final skill name: this document uses
  `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` (the name requested for the plan
  file); confirm whether this is the final name, or whether it was
  `GDX_SKILL_ASSOCIATE_VARIABLE` (the name used in the earlier conversation)
  with only the plan file itself named differently.
- Whether the association should really stay at the **variable** level
  (`GDX_PSY_VARIABLE`) as described above, or whether "CONSTRUCT_DIMENSIOS"
  signals that the association should happen at the **construct** level
  (`GDX_PSY_CONSTRUCT`) instead — today none of the three target tables has
  an `ID_CONSTRUCT` column; that would require an additional schema change
  beyond the one already noted for chakras.
- Confirm the proposed new table name (`GDX_PSY_CHAKRA_VAR_MAP`) and DDL
  script name (`metaphysical_variable_chakra_map_firebird25.sql`), or
  provide different ones.
