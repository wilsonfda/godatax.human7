---
name: GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR
description: Interactively associates ONE psychometric or metaphysical variable (GDX_PSY_VARIABLE, any VARIABLE_TYPE, from 2.relational.model.psychometrics) to ONE of the 33 Virtology virtues (GDX_VT_VIRTUE), writing a row to GDX_VT_VARIABLE_VIRTUE_MAP -- asking the user for the recorded behavior, BOTH justification framings (deficit/antidote and strength/already-present), the scale polarity (whether a high score on this variable is desirable or not), the confidence level, and (mandatory) who is confirming it and their institution, never inventing any of them. Also handles confirming an EXISTING association (adds a corroboration, +1 on NUMBER_CONFIRMATIONS, without touching its content) and correcting an existing one's content. Use when the user wants to connect/map/link a specific variable to a Virtology virtue, or confirm/corroborate/correct one that already exists -- one association at a time. The Virtology-specific sibling of GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS (14.metaphysical.measuring.instrument), which does the same thing for Septenary level / Way of Aquinas / Chakra instead.
---

# GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR

Writes **one interpretive correspondence at a time** between a variable
already in `GDX_PSY_VARIABLE` (psychometric or metaphysical -- see
`VARIABLE_TYPE`) and one of the **33 Virtology virtues** (`GDX_VT_VIRTUE`),
as a row in `GDX_VT_VARIABLE_VIRTUE_MAP`
(`12.gdx.virtology/virtology_model_firebird25.sql`).

## How this differs from its sibling, GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS

`GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS`
(`14.metaphysical.measuring.instrument/.claude/skills/`) does the exact same
kind of thing -- one interactive, dry-run-gated, confirmer-required
association at a time -- for three targets: Septenary level, Way of Aquinas,
Chakra. This skill is its Virtology-specific counterpart, kept as a
**separate skill** rather than a fourth target bolted onto that one, because
`GDX_VT_VARIABLE_VIRTUE_MAP`'s shape genuinely differs from the other three
`"_MAP"` tables:

- **No `ID_INSTRUMENT`/`INSTRUMENT_LABEL`.** The other three tables resolve
  and record an instrument; this one does not.
- **`SAV_COLUMN` is `NOT NULL`** (and `UNIQUE`) instead of being optional. It
  is resolved live from `DW_DIM_VARIABLE.SAV_COLUMN` by default; see
  "Step 1" below for what happens when a variable has none yet.
- **Two justification columns, not one.** `JUSTIFICATION_DEFICIT` (low score
  → antidote, the framing `GDX_SKILL_LINK_SUGGESTIONS` reads) and
  `JUSTIFICATION_STRENGTH` (high score → already present, the framing
  `GDX_SKILL_IDENTIFY_VIRTUES` reads) are both asked, every time, never one
  inferred from the other.
- **A `SCALE_POLARITY` column** (added by
  `12.gdx.virtology/variable_virtue_map_polarity_firebird25.sql`) the other
  three `"_MAP"` tables have no equivalent of: whether a HIGH raw score on
  this variable is desirable (`POSITIVE`, the common case) or undesirable
  (`NEGATIVE`, e.g. Negative Emotions). `GDX_SKILL_LINK_SUGGESTIONS` and
  `GDX_SKILL_IDENTIFY_VIRTUES` both read it to rank the right end of the
  score range as the deficit/strength — see Step 3.
- **Only one target** (the virtue) instead of three, so there is no
  `--target` flag and no per-target catalog-resolution branching.

Everything else -- the mandatory `--confirmed-by`/`--institution` on every
insert and on `--confirm`, the `--update` vs. `--confirm` separation,
the duplicate check, the `--dry-run` discipline -- mirrors
`GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` exactly, on purpose: a user who
already knows that skill should need nothing new to use this one.

## Step 0 — ground the conversation in the real schema

Before asking the user anything, read:

1. `2.relational.model.psychometrics/psychometrics_model_firebird25.sql` —
   `GDX_PSY_VARIABLE`, `GDX_PSY_CONSTRUCT`.
2. `7.multidimensional.database/godatax_human_dw_model_firebird25.sql` —
   `DW_DIM_VARIABLE` (source of the default `SAV_COLUMN`).
3. `12.gdx.virtology/virtology_model_firebird25.sql` — `GDX_VT_VIRTUE`
   (33-row catalog, `ORDER_NUM` 1–33) and `GDX_VT_VARIABLE_VIRTUE_MAP`.
4. `12.gdx.virtology/Virtology_Knowledge_Base.md` section 5 — the 33 virtues
   in the manual's own order, for picking the right `--virtue <1-33>` by name
   rather than guessing a number.

## Step 1 — resolve the variable (and its SAV_COLUMN)

Ask the user which variable (by name, or by instrument/context if they don't
know the exact `GDX_PSY_VARIABLE.NAME`). Run the script with `--variable
"<text>"` first; if more than one match, the script lists every
`ID_VARIABLE` + name + `VARIABLE_TYPE` + construct + resolved `SAV_COLUMN`
and stops -- show that list, get a decision, re-run with `--variable-id`.

`SAV_COLUMN` is resolved automatically from `DW_DIM_VARIABLE` (left join --
absent for a variable never loaded into the DW yet). It is **mandatory** on
this table (`NOT NULL`, `UNIQUE`): if the resolved variable has none, the
script refuses the insert and asks for `--sav-column <text>` explicitly --
never invents one.

## Step 2 — choose the virtue and confirm the catalog row

Ask which of the 33 virtues (by name, cross-checked against
`Virtology_Knowledge_Base.md` section 5, or `12.gdx.virtology/.claude/skills/
GDX_SKILL_LIST_ASSOCIATIONS`'s report if the user wants to see which virtues
already have variables and which don't). The script resolves
`GDX_VT_VIRTUE` by `--virtue <1-33>` live and echoes the name (PT + EN) back
in the dry-run output -- confirm that name with the user before applying.

## Step 3 — collect the judgment call (never invent it)

Ask the user for all five, never filling any in with a guess:

- **Recorded behavior** (`--behavior`) — what is actually observed/measured.
- **Justification (deficit → antidote)** (`--justification-deficit`) — why a
  *low* score on this variable reads as needing this virtue. This is the
  framing `GDX_SKILL_LINK_SUGGESTIONS` reads.
- **Justification (strength → already present)** (`--justification-strength`)
  — why a *high* score on this variable reads as this virtue already being a
  potential strength. This is the framing `GDX_SKILL_IDENTIFY_VIRTUES` reads.
  It is common for these two to share the same underlying reasoning restated
  in each direction (see the existing rows for examples) -- but both must
  still be asked, not derived mechanically from one.
- **Scale polarity** (`--scale-polarity POSITIVE|NEGATIVE`) — ask plainly:
  "is a high score on this variable a good thing?" `POSITIVE` if yes (the
  common case — Vigor, Confidence, Satisfaction With Life, etc.). `NEGATIVE`
  if a high score is actually undesirable (e.g. Negative Emotions, where a
  high score means more negative emotion, not more of a resource). Get this
  wrong and both consuming skills rank the variable backwards -- treating
  its actual deficit as its strength, or vice versa — so ask explicitly,
  never infer it from the variable's name alone (a name can mislead: ask
  what the raw number itself means when it goes up).
- **Confidence level** (`--confidence`) — `HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`,
  default `SPECULATIVE`.
- **Who is confirming it** (`--confirmed-by`) and **their institution**
  (`--institution`) — mandatory for every new association. Ask for both by
  name; never reuse a name from a previous run without asking again.

If the user doesn't have an answer yet, stop and ask — do not proceed with a
placeholder.

## Step 4 — duplicate check, dry-run, confirm, commit

The script always checks first whether that variable already has **any**
row in `GDX_VT_VARIABLE_VIRTUE_MAP` (by `SAV_COLUMN` or `ID_VARIABLE` —
`SAV_COLUMN` carries the table's own `UNIQUE` constraint, so nothing in the
database itself would stop a duplicate otherwise):

- If one exists and `--allow-duplicate` was not passed, the script prints
  the existing row(s) (including current `CONFIDENCE_LEVEL` and
  `NUMBER_CONFIRMATIONS`) and writes nothing — tell the user, and ask
  whether they want to:
  - **`--confirm <id_mapping>`** — they're independently corroborating the
    row that's already there, no content changes. Ask for `--confirmed-by`
    and `--institution`, show the `--dry-run` (current → new
    `NUMBER_CONFIRMATIONS`), confirm, then re-run without `--dry-run`.
  - **`--update <id_mapping>`** — they want to correct the recorded
    behavior/justification(s)/confidence instead. This does not touch
    `NUMBER_CONFIRMATIONS`.
  - **`--allow-duplicate`** — they really want a second, independent row
    (unusual for this table, since `SAV_COLUMN` is unique — likely means a
    different `--sav-column` override is actually intended).
- Otherwise (a genuinely new association), always run with `--dry-run`
  first, show the user the exact `INSERT` it would run (variable, resolved
  `SAV_COLUMN`, virtue, both justifications, confidence, confirmer,
  institution, starting `NUMBER_CONFIRMATIONS = 1`), and only re-run without
  `--dry-run` after they confirm.

## What it will never do

- **Never invents the virtue, the recorded behavior, either justification,
  the scale polarity, the confirmer's name, or their institution.** Every
  one of these is a question to the user, never a model guess -- including
  `--scale-polarity`, which has no default accepted from this script even
  though the column itself defaults to `POSITIVE` at the schema level.
- **Never invents a `SAV_COLUMN`.** Resolved live from `DW_DIM_VARIABLE`, or
  explicitly supplied by the user via `--sav-column` — never guessed.
- **Never inserts or confirms an association without `--confirmed-by` and
  `--institution`.** Both are mandatory for `--confirm` and for every new
  insert — there is no default, no reuse of a stale value.
- **Never writes without a confirmed `--dry-run` first.**
- **Never silently overwrites an existing association.** A variable that
  already has a row blocks a plain insert; only `--update <id_mapping>`,
  `--confirm <id_mapping>`, or `--allow-duplicate` (all explicit) proceeds.
- **Never bumps `NUMBER_CONFIRMATIONS` from `--update`.** Correcting content
  and corroborating an association are different actions; only a new insert
  (`= 1`) or `--confirm` (`+= 1`) changes that column.
- **Never touches `GDX_VT_VIRTUE`** (the fixed 33-virtue catalog) or any
  other catalog table — only writes to `GDX_VT_VARIABLE_VIRTUE_MAP`.
- **Never runs DDL.** `GDX_VT_VARIABLE_VIRTUE_MAP`/`GDX_VT_VIRTUE` must
  already exist (`virtology_model_firebird25.sql` applied once, manually).
- **Never hardcodes Firebird credentials.** Same `.env`/`.env.example`
  pattern as every sibling skill.

## Running it

```
cd 12.gdx.virtology/.claude/skills/GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# new association
node associate_virtue.js --variable-id <id> --virtue <1-33> \
  --behavior "<text>" \
  --justification-deficit "<text>" --justification-strength "<text>" \
  --scale-polarity POSITIVE|NEGATIVE \
  --confirmed-by "<name>" --institution "<name>" \
  [--confidence HIGH|MEDIUM|LOW|SPECULATIVE] [--sav-column <override>] \
  --dry-run

# drop --dry-run once confirmed, to actually write the row

# correcting an existing association's content (does NOT touch NUMBER_CONFIRMATIONS)
node associate_virtue.js --update <id_mapping> \
  --justification-deficit "<text>" --dry-run

# confirming/corroborating an existing association (NUMBER_CONFIRMATIONS += 1, content untouched)
node associate_virtue.js --confirm <id_mapping> \
  --confirmed-by "<name>" --institution "<name>" --dry-run
```

## Files in this skill

- `scripts/associate_virtue.js` — resolves the variable (+ its
  `DW_DIM_VARIABLE.SAV_COLUMN`) and the target virtue catalog row live,
  checks for a duplicate, and inserts / updates / confirms the
  correspondence row (Node.js + `node-firebird`, no native client library
  required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)

## Related files outside this skill folder

- `12.gdx.virtology/virtology_model_firebird25.sql` — the DDL for
  `GDX_VT_VIRTUE` and `GDX_VT_VARIABLE_VIRTUE_MAP` (already applied).
- `12.gdx.virtology/variable_virtue_map_polarity_firebird25.sql` — adds
  `SCALE_POLARITY` to `GDX_VT_VARIABLE_VIRTUE_MAP` (already applied); run it
  once against any database created before this column existed.
- `14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/`
  — the sibling skill this one mirrors the interactive pattern from.
- `12.gdx.virtology/.claude/skills/GDX_SKILL_LINK_SUGGESTIONS/` and
  `.../GDX_SKILL_IDENTIFY_VIRTUES/` — the two read-only skills that consume
  `GDX_VT_VARIABLE_VIRTUE_MAP` (deficit and strength framings respectively)
  to generate their reports.
- `14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_LIST_ASSOCIATIONS/`
  — the framework-wide read-only inventory; its Section 4 lists every row
  this skill writes, alongside every other association in the project.
