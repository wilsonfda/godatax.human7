---
name: GDX_SKILL_LOAD_NEW_STUDY_DW
description: Given a study slug produced by GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY, loads that study's data from the five GDX_HUMAN OLTP schemas (2.relational.model.psychometrics, 3.septenary.constitution, 4.kundalini.chakras, 5.five.ways.tomas.aquino, 6.cardiac.coherence) into the star schema in 7.multidimensional.database (godatax_human_dw_model_firebird25.sql) -- dimensions and facts, insert-if-missing, safe to re-run. Use once a study's instruments/participants/answers (and optionally cardiac-coherence sessions) already exist, to make that study queryable in the DW.
---

# GDX_SKILL_LOAD_NEW_STUDY_DW

Loads **one study at a time** into the DW (`godatax_human_dw_model_firebird25.sql`, this folder),
identified by the same slug the rest of the "onboard a new study" family uses. It sits after every
other skill that can feed the DW:

```
GDX_SKILL_NEW_STUDY / GDX_SKILL_RECORD_NEW_STUDY        -- instrument metadata exists
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS                        -- participant responses exist
GDX_SKILL_LOAD_SEPT_MAPS_DB      (optional)             -- septenary-level mapping exists
GDX_SKILL_LOAD_CC_MAPS_DB        (optional)             -- cardiac-coherence participants linked
        |
        v
GDX_SKILL_LOAD_NEW_STUDY_DW  (this skill) -- reads all of the above for ONE study and
                                 loads it into the DW star schema
```

Run it any time after `GDX_SKILL_RECORD_NEW_STUDY`; running it again later (after more participants
have answered, or after `GDX_SKILL_LOAD_SEPT_MAPS_DB`/`GDX_SKILL_LOAD_CC_MAPS_DB` have added more
data for the same study) picks up only what is new.

## Why this is a different shape from `godatax_human_dw_etl_firebird25.sql`

This folder already has a whole-database ETL (`godatax_human_dw_etl_firebird25.sql`) that loads
every study at once. It is explicitly a **one-shot, non-idempotent build** — see
`GoDataX_Human_7_DW.md` section 7, item 4: "reloading means truncating the `DW_*` tables first."
That is fine for building the DW from scratch once, but wrong for a pipeline where new studies show
up over time.

This skill is the opposite shape, matching every other skill in the "onboard a new study" family
(`GDX_SKILL_LOAD_SEPT_MAPS_DB`, `GDX_SKILL_LOAD_CC_MAPS_DB`, `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`):
scoped to **one study**, **insert-if-missing** everywhere, safe to run again for the same study
without truncating anything or duplicating rows. It never touches another study's rows and it never
truncates a `DW_*` table.

## Scope resolution

`GDX_PSY_INSTRUMENT` / `GDX_PSY_CONSTRUCT` / `GDX_PSY_VARIABLE` are global catalogs with no
`ID_STUDY` column, so — like `GDX_SKILL_LOAD_SEPT_MAPS_DB` and `GDX_SKILL_EXPORT_NEW_STUDY` — this
skill reads `new_study_intake/<slug>/intake.json` to know exactly which instruments/constructs/
variables belong to this study, then resolves each one's real id in Firebird by name. From there:

- `GDX_PSY_APPLICATION` carries `ID_STUDY` directly, so `DW_FACT_PSY_ITEM_RESPONSE` and
  `DW_FACT_PSY_VARIABLE_RESULT` are scoped with a plain `WHERE A.ID_STUDY = ?`.
- Cardiac-coherence sessions have no `ID_STUDY` at all (see
  `6.cardiac.coherence/GDX_CC_Psychometrics_Person_Mapping.md`); they are scoped through
  `GDX_PSY_STUDY_PARTICIPANT` (the same table `GDX_SKILL_LOAD_CC_MAPS_DB` populates) — only sessions
  belonging to a person enrolled in **this** study are loaded.

### Fallback for a study with no `instruments[]` in its intake.json

A study that predates the `GDX_SKILL_NEW_STUDY` interview pipeline entirely (loaded the older way, via
`GDX_SKILL_LOAD_RLT_MODEL_DB`'s `.sav` import — e.g. `ID_STUDY=1`, see `8.gdx.dashboards/Dashboards_DW_Explanation.md`
§9.1/§11) has no `intake.json` with an `instruments[]` section to read scope from. `resolveScope()`
detects this (`!intake.instruments || intake.instruments.length === 0`) and calls
`resolveScopeFromDatabase(db, studyId)` instead: it derives scope directly from what the OLTP already
shows applied for this study — every `GDX_PSY_VARIABLE` with at least one real `GDX_PSY_VARIABLE_RESULT`
row through this study's applications, each variable's instrument resolved the same `FIRST 1` way
`godatax_human_dw_etl_firebird25.sql` does. This is narrower than "every variable that exists" — it's
exactly the variables this study has real computed results for, including one added to the OLTP after
the study's original load (e.g. a variable backfilled from raw item responses that were always there
but never aggregated — see the §11 case). Nothing hypothetical, nothing borrowed from another study.

**Performance note for a large legacy study:** this fallback fixes *scope resolution* for such a study,
but `loadItemResponseFacts()`/`loadVariableResultFacts()` still re-check every fact row for the whole
study one existence-query at a time (pre-existing behavior, unrelated to this fallback) — for a study
with hundreds of people and dozens of instruments already fully loaded, a full run re-validates
thousands of already-present rows just to pick up a handful of new ones, and can take well over an hour
against a remote DB. For a narrow addition (one new variable's results, say), loading just that
variable's rows directly with the same insert-if-missing shape this skill uses is far faster — see
`8.gdx.dashboards/Dashboards_DW_Explanation.md` §11's real example of doing exactly that instead of
running this skill end-to-end for `ID_STUDY=1`.

## What is bootstrapped once, not scoped by study

`DW_DIM_DATE`, `DW_DIM_SEPTENARY_LEVEL`, `DW_DIM_CHAKRA`, `DW_DIM_FIVE_WAY` are global reference
dimensions (a calendar, the 7 levels, the 7 chakras, the 5 ways) — not study-specific by nature. This
skill inserts any row missing from them (insert-if-missing per row, same discipline as everything
else) and leaves them untouched on every later run, for any study.

## Septenary-level reconciliation — reuses `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s exact key rule

`DW_DIM_VARIABLE.ID_SEPTENARY_LEVEL` is resolved the same way `GDX_SKILL_LOAD_SEPT_MAPS_DB` keys
`GDX_PSY_SEPT_LEVEL_PSY_MAP.VARIABLE_LABEL`:

- a variable with `.sav column: <col> (...)` in its `OPERATIONAL_DEFINITION` (a historical `.sav`
  load) is matched with `VARIABLE_LABEL CONTAINING ('-> ' || <col>)`;
- a variable onboarded via `GDX_SKILL_NEW_STUDY` (no `.sav` file, so no `.sav` column) is matched by
  an **exact** `VARIABLE_LABEL = <variable name>`.

If neither matches (no one has run `GDX_SKILL_LOAD_SEPT_MAPS_DB` for this study yet, or a variable
was deliberately excluded there), `DW_DIM_VARIABLE.ID_SEPTENARY_LEVEL` stays `NULL` and the variable
is reported under "variables with no septenary level yet" — not guessed, not left silently wrong.

## What this skill will never do

- **Never truncates or deletes** any `DW_*` table, or any OLTP source table.
- **Never loads another study's rows.** Everything is scoped to the `ID_STUDY` resolved from
  `--study <slug>`.
- **Never computes `GDX_PSY_VARIABLE_RESULT`.** If a study has no computed variable results yet
  (the normal case right after `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`, which deliberately doesn't compute
  them), `DW_FACT_PSY_VARIABLE_RESULT` simply gets 0 new rows for that study, reported as a note, not
  an error.
- **Never silently overwrites a fact that belongs to a different application.** `DW_FACT_PSY_ITEM_RESPONSE`
  and `DW_FACT_PSY_VARIABLE_RESULT` are keyed `(ID_PERSON, ID_ITEM)` / `(ID_PERSON, ID_VARIABLE)` in
  the DW model (not `(..., ID_APPLICATION)`) — if a person already has a DW fact for that item/variable
  from a *different* `GDX_PSY_APPLICATION` (e.g. the same person took the same instrument under an
  earlier study), this study's row is skipped and reported under "fact grain collisions" for a human
  to look at, rather than silently replacing existing analytical data.

## Running it

```
cd 7.multidimensional.database/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node load_new_study_dw.js --study <slug> --dry-run     # see exactly what would change, writes nothing
node load_new_study_dw.js --study <slug>               # apply it
```

`--intake-dir <path>` overrides the default `new_study_intake/<slug>/` location.

Read the summary before trusting a run is complete: "variables with no septenary level yet" and
"fact grain collisions" both need a human decision, not something this skill resolves on its own.

## Files in this skill

- `scripts/load_new_study_dw.js` — resolves `--study <slug>`'s scope against the OLTP schemas and
  loads it into the DW star schema (Node.js + `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)

See `GoDataX_Human_7_DW.md` for the DW's own design rationale (why `GDX_PSY_PERSON` is the single
central person table, the star schema shape, the whole-database ETL this skill deliberately does not
replace).
