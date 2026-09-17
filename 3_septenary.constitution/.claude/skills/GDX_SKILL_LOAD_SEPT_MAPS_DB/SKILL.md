---
name: GDX_SKILL_LOAD_SEPT_MAPS_DB
description: Given a study slug produced by GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY (new_study_intake/<slug>/intake.json), resolves that study's instruments/variables in GDX_PSY_INSTRUMENT and GDX_PSY_VARIABLE (psychometrics_model_firebird25.sql) and loads only their relation into GDX_PSY_SEPT_LEVEL_PSY_MAP (septenary_constitution_model_firebird25.sql), with correspondence justifications, without ever touching GDX_PSY_SEPTENARY_LEVEL or any other study's mappings. Use right after GDX_SKILL_RECORD_NEW_STUDY has loaded a new study/instrument, to create its septenary-level mapping.
---

# GDX_SKILL_LOAD_SEPT_MAPS_DB

Keeps `GDX_PSY_SEPT_LEVEL_PSY_MAP` (the relation between psychometric variables and septenary levels — see `3_septenary.constitution/`) in sync with **one study at a time**, identified by the same slug `GDX_SKILL_NEW_STUDY` used for its intake file. Third skill in the onboarding pipeline:

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_STUDY/INSTRUMENT/VARIABLE/... rows exist
        |
        v
GDX_SKILL_LOAD_SEPT_MAPS_DB  (this skill) -- reads that SAME intake.json, resolves its
                                 instruments/variables to their real DB ids, and creates
                                 ONLY their GDX_PSY_SEPT_LEVEL_PSY_MAP rows
```

## What it will never do

- **Never scans the whole database.** It only ever resolves and maps the instruments/variables
  listed in `new_study_intake/<slug>/intake.json` for the `--study` slug it was given — variables
  belonging to any other study already in Firebird are never read or written.
- **Never writes to `GDX_PSY_SEPTENARY_LEVEL`** — the 7-level catalog is out of scope for this skill
  by design (there is no `INSERT`/`UPDATE`/`DELETE` against that table anywhere in `load_sept_maps.js`).
- **Never guesses a septenary level or justification.** Which level a variable belongs to, and why,
  is an interpretive judgment call — it lives in `scripts/knowledge.js`, keyed by `.sav` column name
  or, for variables with no `.sav` file at all, by the variable's own name (see below), and nowhere
  else. A variable with no entry there is reported as `UNKNOWN` and left alone.

## What it does

Given `--study <slug>`:

1. Reads `GDX_HUMAN/0_new_instrument/new_study_intake/<slug>/intake.json` (the same file
   `GDX_SKILL_NEW_STUDY` wrote and `GDX_SKILL_RECORD_NEW_STUDY` consumed) to get the exact list of
   instruments, constructs and variables that study introduced.
2. Confirms the study (`GDX_PSY_STUDY.TITLE`), each instrument (`GDX_PSY_INSTRUMENT.NAME`+`VERSION`),
   construct (`GDX_PSY_CONSTRUCT.NAME`) and variable (`GDX_PSY_VARIABLE.NAME` scoped to its construct)
   already exist in Firebird — if any of them is missing, it stops with an error telling you to run
   `GDX_SKILL_RECORD_NEW_STUDY` first, rather than silently skipping part of the study.
3. For each of that study's variables:
   - Resolves its knowledge-catalog key (see `scripts/knowledge.js`):
     - If `OPERATIONAL_DEFINITION` starts with `.sav column: <col> (...)` (a variable that came from a
       historical `.sav` file, loaded by `GDX_SKILL_LOAD_RLT_MODEL_DB`), the key is `<col>`.
     - Otherwise (the normal case for a study onboarded through `GDX_SKILL_NEW_STUDY`, which has no
       `.sav` file behind it), the key is the variable's own `GDX_PSY_VARIABLE.NAME`.
   - **Not found in `knowledge.js`** → reported as `UNKNOWN`, nothing written. Add a real entry (a
     `{ level, confidence, behavior, justification }`, or `{ excluded: true, reason }` for a variable
     that deliberately doesn't map to a consciousness level — same pattern as `AnoOrg`/`SucProfFin`/
     `CondSocie`/`RedTap` today) and re-run.
   - **`excluded: true`** → reported, nothing written (by design, not a gap).
   - **Known, no existing `GDX_PSY_SEPT_LEVEL_PSY_MAP` row** (checked via `VARIABLE_LABEL CONTAINING`
     the key/marker, same technique as the DW ETL's reconciliation step) → **inserts a new row**,
     populated with a real `ID_VARIABLE`/`ID_INSTRUMENT`.
   - **Known, existing row with `ID_VARIABLE`/`ID_INSTRUMENT` still `NULL`** → **backfills just those
     FK columns** via `UPDATE`; text columns (`RECORDED_BEHAVIOR`, `CORRESPONDENCE_JUSTIFICATION`,
     etc.) are left untouched.
   - **Known, already fully linked** → skipped.

## Running it

```
cd 3_septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node load_sept_maps.js --study <slug> --dry-run     # see exactly what would change, writes nothing
node load_sept_maps.js --study <slug>               # apply it
```

`<slug>` is the same one `GDX_SKILL_NEW_STUDY` picked for
`GDX_HUMAN/0_new_instrument/new_study_intake/<slug>/intake.json`. If that intake file lives somewhere
non-standard, pass `--intake-dir <path>` (a folder containing `intake.json`) instead of relying on the
default path resolution.

Read the `UNKNOWN` list in the output before trusting a `--dry-run` (or a real run) is complete — those
variables were **not** loaded, on purpose, because no one has made the level/justification call for
them yet.

## Files in this skill

- `scripts/knowledge.js` — the fixed judgment-call catalog (edit this when a new variable needs a
  septenary-level decision)
- `scripts/load_sept_maps.js` — reads `--study <slug>`'s intake.json, resolves it against the live
  database, and runs the scoped insert/backfill logic (Node.js + `node-firebird`, no native client
  library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
