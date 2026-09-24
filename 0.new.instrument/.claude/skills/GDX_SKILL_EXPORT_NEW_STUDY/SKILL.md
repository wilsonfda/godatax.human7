---
name: GDX_SKILL_EXPORT_NEW_STUDY
description: Reads a new study's instruments, behavioral variables and items back out of Firebird (after GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY have loaded it) and writes a blank .xlsx questionnaire, named after the skill plus the study's title and slug/code, to send to participants. Use right after GDX_SKILL_RECORD_NEW_STUDY has loaded a new study, to produce the actual form participants fill in.
---

# GDX_SKILL_EXPORT_NEW_STUDY

Third stage of the "onboard a new instrument" pipeline (see `GDX_SKILL_NEW_STUDY`'s and
`GDX_SKILL_RECORD_NEW_STUDY`'s `SKILL.md` for the first two):

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_* rows exist
        |
        v
GDX_SKILL_EXPORT_NEW_STUDY   (this skill) -- reads those SAME rows back out of Firebird
                                 and writes a blank .xlsx questionnaire
        |
        v
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS -- loads a FILLED copy of that .xlsx back in
```

## What it does

Given `--study <slug>`:

1. Reads `new_study_intake/<slug>/intake.json` to know which instruments belong to this study, and
   resolves each one's `GDX_PSY_INSTRUMENT` row by `(NAME, VERSION)` — erroring out if it isn't found
   (run `GDX_SKILL_RECORD_NEW_STUDY` first).
2. For each instrument, reads its `GDX_PSY_INSTRUMENT_ITEM` rows (in `ITEM_ORDER`) and each item's
   `GDX_PSY_ITEM_ALTERNATIVE` rows.
3. Writes one `.xlsx` workbook with:
   - a **Participant** sheet — Full Name, External Identifier/Code, Birth Date, Gender, Education
     Level, Application Date, Consent — filled in once per participant, not per instrument;
   - **one sheet per instrument** — one row per item (Order, Statement, Response Type, and a blank
     **Answer** column with a dropdown of the item's response alternatives when it has any);
   - a hidden **META** sheet carrying the exact ids resolved at export time (`ID_STUDY`,
     `ID_INSTRUMENT`, `ID_ITEM`, `ID_ALTERNATIVE`, ...).

The **META** sheet is what makes the workbook self-contained: `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`
reads ids back from it instead of re-resolving instrument/item/alternative *names* against the
database at load time — so a renamed, emailed, or reopened-and-resaved copy of the file still loads
correctly, and an answer can never be silently matched to the wrong item or alternative.

This skill never writes to the database — it only reads.

## Output filename

```
GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx
```

Skill name, then the study's human-readable title (sanitized to underscores), then a double
underscore, then the study's slug/code — e.g.
`GDX_SKILL_EXPORT_NEW_STUDY_Pilot_Study_of_Workplace_Resilience_in_Remote_Teams__workplace-resilience-pilot.xlsx`.
The double-underscore separator is deliberate: slugs are always lowercase and hyphen-separated (see
`GDX_SKILL_NEW_STUDY`'s slug rule), so they can never contain `__`, which keeps the boundary
unambiguous for anyone reading the filename. It is written straight into `0.new.instrument/` (one
flat folder for every study's questionnaire, easy to find -- not buried under that study's own
`new_study_intake/<slug>/` subfolder) unless `--out-dir` is given.

## Running it

```
cd 0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts
npm install                 # once, installs node-firebird + exceljs
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node export_new_study.js --study <slug>
```

`--intake-dir <path>` overrides the default `new_study_intake/<slug>/` location it reads `intake.json`
from; `--out-dir <dir>` writes the `.xlsx` somewhere other than the default `0.new.instrument/`;
`--exclude-item-orders <n,n,...>` drops
specific items (by `ITEM_ORDER`, comma-separated) from every instrument sheet they'd otherwise
appear on -- for items whose `STATEMENT_TEXT` is a placeholder like
`[STATEMENT NOT IDENTIFIED - ...]` (see `SPSS_to_Firebird_Mapping.md` §3/6) rather than real wording.
**Never invent wording to fill a gap like that instead** -- a copyrighted, validated instrument's
missing item text is not something to guess at, especially once real answers will be collected
against it. Dropping the item and noting the omission (this flag records it on the hidden META
sheet, `EXCLUDED_ITEM_ORDERS`/`EXCLUDED_REASON`) is the honest option; the other is tracking down
the real source (original pptx/manual, or the instrument's copyright holder) and fixing
`GDX_PSY_INSTRUMENT_ITEM.STATEMENT_TEXT` at the source once confirmed.

## Sending it to participants

The exported file is a **blank template for the whole study**, not one participant's copy. Duplicate
it once per participant before sending it out; each participant (or whoever administers the
instrument) fills in the "Participant" sheet once and answers on each instrument sheet. Then load
each filled copy separately with `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`.

## Files in this skill

- `scripts/export_new_study.js` — reads `--study <slug>`'s instruments/items/alternatives from
  Firebird and writes the `.xlsx` (Node.js + `node-firebird` + `exceljs`, no native client library
  required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
