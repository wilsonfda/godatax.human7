---
name: GDX_SKILL_LOAD_NEW_STUDY_ANSWERS
description: Reads a filled-in copy of the .xlsx GDX_SKILL_EXPORT_NEW_STUDY produced (filename carries the study's title and slug/code) and inserts the participant's answers into the GDX_PSY_RELATIONAL_MODEL tables (GDX_PSY_PERSON, GDX_PSY_STUDY_PARTICIPANT, GDX_PSY_APPLICATION, GDX_PSY_ITEM_RESPONSE), safe to re-run on the same file. Use after a participant has returned a filled GDX_SKILL_EXPORT_NEW_STUDY workbook.
---

# GDX_SKILL_LOAD_NEW_STUDY_ANSWERS

Fourth and final stage of the "onboard a new instrument" pipeline:

```
GDX_SKILL_NEW_STUDY / GDX_SKILL_RECORD_NEW_STUDY / GDX_SKILL_EXPORT_NEW_STUDY
        |
        v
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS  (this skill) -- loads ONE filled copy of the .xlsx back in
```

## What it writes — and what it deliberately does not

Given `--file <path-to-xlsx>` (a filled copy of
`GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx`), this skill inserts the full FK chain
`GDX_PSY_ITEM_RESPONSE` needs to be valid (`2.relational.model.psychometrics/psychometrics_model_firebird25.sql`):

| Table | When |
|---|---|
| `GDX_PSY_PERSON` | Found by `EXTERNAL_IDENTIFIER` (the "Participant" sheet's code); inserted only if not found. An existing person's `NAME` is never overwritten, even if the sheet disagrees. |
| `GDX_PSY_STUDY_PARTICIPANT` | Found by `(ID_STUDY, ID_PERSON)`; inserted only if not found. `CONSENT` comes from the sheet's "Consent Given (Y/N)" field — never invented — and defaults to `0` (not confirmed) if left blank. |
| `GDX_PSY_APPLICATION` | One per instrument sheet that has any answer filled in. |
| `GDX_PSY_ITEM_RESPONSE` | One per answered item, matched to its `GDX_PSY_ITEM_ALTERNATIVE` when the item has alternatives. |

**Out of scope on purpose:** this skill loads what the participant actually answered — it does not
compute or write `GDX_PSY_VARIABLE_RESULT` / `GDX_PSY_CONSTRUCT_RESULT` / `GDX_PSY_INDICATOR_RESULT`
(derived scores). Scoring an instrument's raw responses into a construct/variable score is a separate
concern (indicator formulas, reverse-scoring, norms) that belongs in its own skill, not bundled here.

## Source of truth: the workbook's own META sheet, not the filename

`GDX_SKILL_EXPORT_NEW_STUDY` embeds a hidden **META** sheet in every workbook it writes, carrying the
exact ids it resolved at export time (`ID_STUDY`, `ID_INSTRUMENT`, `ID_ITEM`, `ID_ALTERNATIVE`, ...).
This skill reads those ids back from META — it does **not** re-resolve instrument/item names against
the current database, and it does **not** rely on the filename to find the study. The filename is
only sanity-checked against META's `STUDY_SLUG` (a participant may rename their copy); a mismatch is
logged as a harmless `NOTE`, never an error, and META always wins.

## Answer matching rules (never guesses)

- An item **with** response alternatives: the "Answer" cell is matched against that item's
  alternative `LABEL`s (case-insensitive, trimmed). No match → the response is **skipped** and
  reported under "UNMATCHED answers (needs a human)" — nothing is guessed or coerced into the nearest
  option.
- An item **without** alternatives (open text): the answer is stored as `TEXT_VALUE`; if it happens to
  parse cleanly as a number, `NUMERIC_VALUE` is also populated (a mechanical parse, not an inference).
- A required item (`GDX_PSY_INSTRUMENT_ITEM.REQUIRED = 1`) left blank is reported under "MISSING
  required answers" — the application is still created with whatever was answered; nothing is
  invented for the gap.

## Idempotency — safe to re-run

Every `GDX_PSY_APPLICATION` this skill inserts is tagged in its `CONTEXT` column with
`GDX_SKILL_LOAD_NEW_STUDY_ANSWERS:<filename>`. Re-running the skill on the exact same file finds that
tag and reports the instrument as "already loaded", skipping it — it never re-inserts or duplicates
responses. Loading two participants' files (or the same participant across two different instrument
rounds) works normally, since each gets its own `GDX_PSY_APPLICATION` row.

## Running it

```
cd 0.new.instrument/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_ANSWERS/scripts
npm install                 # once, installs node-firebird + exceljs
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node load_new_study_answers.js --file <path-to-filled.xlsx> --dry-run   # see what would happen
node load_new_study_answers.js --file <path-to-filled.xlsx>             # apply it
```

Read the summary before trusting a run is complete: `UNMATCHED answers` and `MISSING required
answers` are gaps that need a human to look at the source file, not something this skill resolves on
its own.

## Files in this skill

- `scripts/load_new_study_answers.js` — reads a filled `.xlsx`, resolves it via its own META sheet,
  and runs the insert logic (Node.js + `node-firebird` + `exceljs`, no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
