---
name: GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS
description: Interactively associates ONE psychometric or metaphysical variable (GDX_PSY_VARIABLE, any VARIABLE_TYPE, from 2.relational.model.psychometrics) to a Septenary Constitution level (GDX_PSY_SEPT_LEVEL_PSY_MAP), a Way of Thomas Aquinas (GDX_TA_WAY_SEPT_MAP), or a Kundalini Chakra (GDX_PSY_CHAKRA_VAR_MAP) -- asking the user for the recorded behavior, the correspondence justification and the confidence level, never inventing them. Use when the user wants to connect/map/link a specific variable (e.g. an OT-7 metaphysical variable, or any existing psychometric variable) to one of these three frameworks, one association at a time -- not for onboarding a whole new study's variables in batch (that is GDX_SKILL_LOAD_SEPT_MAPS_DB's job).
---

# GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS

Writes **one interpretive correspondence at a time** between a variable
already in `GDX_PSY_VARIABLE` (psychometric or metaphysical -- see
`VARIABLE_TYPE`) and one of:

1. a **Septenary Constitution** level → `GDX_PSY_SEPT_LEVEL_PSY_MAP`
   (`3.septenary.constitution`)
2. a **Way of Thomas Aquinas** → `GDX_TA_WAY_SEPT_MAP`
   (`5.five.ways.tomas.aquino`, extended by
   `14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql`)
3. a **Kundalini Chakra** → `GDX_PSY_CHAKRA_VAR_MAP`
   (`14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql`
   — a **new table**; see "Prerequisite" below)

Until this skill existed, this kind of association could only be made by
hand-writing an `INSERT` (that is how the 7 OT-7 variables were linked to Way
5 in `ot7_way_map_dml_firebird25.sql`). This skill is the conversational
interface for doing the same thing safely, one variable at a time.

## How this differs from its two siblings in this project

- **`GDX_SKILL_LIST_ASSOCIATIONS`** (same folder) only **reads** and reports
  every association already made in the framework. This skill is its write
  counterpart.
- **`GDX_SKILL_LOAD_SEPT_MAPS_DB`** (`3.septenary.constitution`) writes too,
  but only in **batch**, scoped to one whole `--study <slug>` at a time, and
  only against `GDX_PSY_SEPT_LEVEL_PSY_MAP` — driven by a `knowledge.js`
  catalog that must be hand-edited *before* running (it never asks anything
  during execution). This skill is the opposite shape: **one variable, one
  target, asked interactively**, against any of the three target tables, for
  a variable from any study (or none, e.g. OT-7) already in the database.

Use this skill when the user wants to connect/map/link one specific variable
to the Septenary Constitution, a Way of Aquinas, or a Chakra. Use
`GDX_SKILL_LOAD_SEPT_MAPS_DB` instead when onboarding a brand-new study's
whole variable set to the Septenary Constitution in one pass.

## Prerequisite for `--target chakra`

`GDX_PSY_CHAKRA` (`4.kundalini.chakras/chakras_model_firebird25.sql`) is a
fixed 7-row catalog with no variable-mapping columns of its own — unlike the
Way table, it was never a relation table, so it cannot safely be extended in
place. `GDX_PSY_CHAKRA_VAR_MAP` is a **new** table (DDL in
`14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql`,
mirroring `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s column shape) that must be applied
to the database **once**, manually, before `--target chakra` can be used.
This skill never runs DDL itself — if the table doesn't exist yet,
`associate_variable.js` fails with a clear message pointing at that script
rather than trying to create it.

## Step 0 — ground the conversation in the real schema

Before asking the user anything, read:

1. `2.relational.model.psychometrics/psychometrics_model_firebird25.sql` —
   `GDX_PSY_VARIABLE`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_INSTRUMENT`,
   `GDX_PSY_INSTRUMENT_CONSTRUCT`.
2. `3.septenary.constitution/septenary_constitution_model_firebird25.sql` —
   `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`.
3. `5.five.ways.tomas.aquino/five_ways_model_firebird25.sql` and
   `five_ways_septenary_map_firebird25.sql` — `GDX_TA_WAY`,
   `GDX_TA_WAY_SEPT_MAP`.
4. `4.kundalini.chakras/chakras_model_firebird25.sql` and this folder's
   `metaphysical_variable_chakra_map_firebird25.sql` — `GDX_PSY_CHAKRA`,
   `GDX_PSY_CHAKRA_VAR_MAP`.

## Step 1 — resolve the variable

Ask the user which variable (by name, or by instrument/context if they don't
know the exact `GDX_PSY_VARIABLE.NAME`). Run the script with `--variable
"<text>"` (substring match against `NAME`) first:

```
cd 14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node associate_variable.js --variable "purpose" --target septenary --level 6 --dry-run \
  --behavior x --justification x   # placeholder values just to get past validation and see the match list
```

If more than one variable matches, the script lists every `ID_VARIABLE` +
name + `VARIABLE_TYPE` + construct and stops — show that list to the user,
get a decision, then re-run with `--variable-id <id>` instead of `--variable`.

## Step 2 — choose the target and confirm the catalog row

Ask: Septenary Constitution, Way of Aquinas, or Chakra? Then which one
(1–7, or 1–5 for Ways) — the script resolves the catalog row live
(`GDX_PSY_SEPTENARY_LEVEL`, `GDX_TA_WAY`, or `GDX_PSY_CHAKRA`) and echoes its
name back in the dry-run output; confirm that name with the user before
applying.

For `--target way`, **do not ask for a septenary level** — the script reads
it from that Way's existing conceptual row in `GDX_TA_WAY_SEPT_MAP`
(`VARIABLE_LABEL IS NULL`), so a variable's Way association can never
silently contradict the Way↔Level correspondence already on record.

## Step 3 — collect the judgment call (never invent it)

Ask the user for:

- **Recorded behavior** (`--behavior`) — what is actually observed/measured.
- **Correspondence justification** (`--justification`) — why this
  variable belongs at this level/way/chakra.
- **Confidence level** (`--confidence`) — `HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`,
  default `SPECULATIVE`. Same scale and same default as every other
  correspondence table in this framework.

Never fill these in with a guess. If the user doesn't have an answer yet,
stop and ask — do not proceed with a placeholder.

## Step 4 — duplicate check, dry-run, confirm, commit

The script always checks first whether that variable already has **any** row
in the chosen target table (none of the three tables has a `UNIQUE` on
`ID_VARIABLE`, so nothing in the database itself would stop a duplicate):

- If one exists and `--allow-duplicate` was not passed, the script prints the
  existing row(s) and writes nothing — tell the user, and ask whether they
  want to `--update` the existing row instead, or really add a second one
  (`--allow-duplicate`).
- Otherwise, always run with `--dry-run` first, show the user the exact
  `INSERT` it would run (variable, instrument, target, confidence), and only
  re-run without `--dry-run` after they confirm.

## What it will never do

- **Never invents the level/way/chakra, the recorded behavior, or the
  justification.** Every one of these is a question to the user, never a
  model guess.
- **Never writes without a confirmed `--dry-run` first.**
- **Never silently overwrites an existing association.** A variable that
  already has a row in the target table blocks a plain insert; only
  `--update <id_mapping>` (explicit) or `--allow-duplicate` (explicit)
  proceeds.
- **Never touches the fixed catalogs** (`GDX_PSY_SEPTENARY_LEVEL`,
  `GDX_TA_WAY`, `GDX_PSY_CHAKRA`) — only the three association tables.
- **Never runs DDL.** `GDX_PSY_CHAKRA_VAR_MAP` must already exist for
  `--target chakra` to work; the script fails with a clear message (pointing
  at `metaphysical_variable_chakra_map_firebird25.sql`) if it doesn't.
- **Never hardcodes Firebird credentials.** Same `.env`/`.env.example`
  pattern as every sibling skill.

## Running it

```
cd 14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/scripts
npm install
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# Septenary Constitution
node associate_variable.js --variable-id <id> --target septenary --level <1-7> \
  --behavior "<text>" --justification "<text>" [--confidence HIGH|MEDIUM|LOW|SPECULATIVE] --dry-run

# Way of Aquinas (septenary level resolved automatically, not asked)
node associate_variable.js --variable-id <id> --target way --way <1-5> \
  --behavior "<text>" --justification "<text>" --dry-run

# Chakra (requires metaphysical_variable_chakra_map_firebird25.sql applied first)
node associate_variable.js --variable-id <id> --target chakra --chakra <1-7> \
  --behavior "<text>" --justification "<text>" --dry-run

# drop --dry-run once confirmed, to actually write the row

# correcting an existing association
node associate_variable.js --update <id_mapping> --target <septenary|way|chakra> \
  --behavior "<text>" --justification "<text>" --confidence <level> --dry-run
```

## Files in this skill

- `scripts/associate_variable.js` — resolves the variable + instrument +
  target catalog row live, checks for a duplicate, and inserts/updates the
  correspondence row (Node.js + `node-firebird`, no native client library
  required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)

## Related files outside this skill folder

- `14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql`
  — the DDL that extended `GDX_TA_WAY_SEPT_MAP` to accept a variable (already
  applied).
- `14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql`
  — the DDL for the new `GDX_PSY_CHAKRA_VAR_MAP` table (apply once before
  using `--target chakra`).
- `14.metaphysical.measuring.instrument/plan_to_GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS.md`
  — the design plan this skill was built from.
