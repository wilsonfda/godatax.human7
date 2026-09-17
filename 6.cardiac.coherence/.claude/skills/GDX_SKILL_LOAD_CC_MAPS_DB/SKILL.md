---
name: GDX_SKILL_LOAD_CC_MAPS_DB
description: Given a study slug produced by GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY (new_study_intake/<slug>/intake.json), finds cardiac-coherence participants (GDX_CC_PERSON/GDX_CC_SESSION, 6.cardiac.coherence) that have no study yet and inserts the GDX_PSY_STUDY_PARTICIPANT rows (2.relational.model.psychometrics) that associate them with that new study. Use after GDX_SKILL_RECORD_NEW_STUDY has loaded a new study and its participants have cardiac-coherence sessions recorded.
---

# GDX_SKILL_LOAD_CC_MAPS_DB

Links cardiac-coherence data collection (`6.cardiac.coherence/`) to a psychometric study
(`2.relational.model.psychometrics/`), for **one study at a time**, identified by the same slug
`GDX_SKILL_NEW_STUDY` used for its intake file. Fits into the same onboarding pipeline as
`GDX_SKILL_LOAD_SEPT_MAPS_DB` (see `3.septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/`),
run independently and in any order after `GDX_SKILL_RECORD_NEW_STUDY`:

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_STUDY row exists
        |
        v
GDX_SKILL_LOAD_CC_MAPS_DB    (this skill) -- reads that SAME intake.json for the study's
                                 ID_STUDY, finds cardiac-coherence participants with no study
                                 yet, and inserts their GDX_PSY_STUDY_PARTICIPANT association
```

## Why this associates `GDX_PSY_STUDY_PARTICIPANT`, not `GDX_PSY_PERSON`

`GDX_CC_PERSON.ID_PERSON` already carries a real `FOREIGN KEY` straight to `DW_DIM_PERSON`, a 1:1
copy of `GDX_PSY_PERSON.ID_PERSON` (see
`7.multidimensional.database/godatax_human_dw_fk_gdx_cc_person_firebird25.sql`). That means a
`GDX_CC_PERSON` row can only exist if a `GDX_PSY_PERSON` with the **same id** already exists — the
two are already the same person, by construction, with nothing left to bridge. What the schema does
**not** record anywhere is that a given person belongs to a given *study* — `GDX_CC_PERSON` and
`GDX_CC_SESSION` have no `ID_STUDY` column at all, they are shared across every study. That
study-level fact lives in `GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ...)`, which is exactly
the row this skill creates.

## Scope rule (read this before running)

Because `GDX_CC_PERSON`/`GDX_CC_SESSION` carry no `ID_STUDY`, "belongs to this new study" cannot be
read directly off the schema. This skill uses one explicit, documented rule instead of guessing per
run: a cardiac-coherence person is treated as belonging to the study passed via `--study` when
**both**:

1. It has at least one row in `GDX_CC_SESSION` (real captured data, not just a registered-but-unused
   `GDX_CC_PERSON` row), and
2. It has **no `GDX_PSY_STUDY_PARTICIPANT` row for any study yet** — i.e. it is a brand-new
   participant that no earlier study has already claimed.

If your cardiac-coherence data collection can produce participants for a study who **already**
participated in an earlier study, this rule will skip them (by design — it never reassigns or
duplicates an existing study association). Handle that case by hand (a manual
`GDX_PSY_STUDY_PARTICIPANT` insert with the right `ID_STUDY`), not by loosening this skill's rule.

## What it will never do

- **Never writes to `GDX_CC_PERSON`, `GDX_CC_SESSION`, or `GDX_PSY_PERSON`.** The only table this
  skill inserts into is `GDX_PSY_STUDY_PARTICIPANT`.
- **Never invents `CONSENT`.** The cardiac-coherence schema has no consent field, so every row this
  skill inserts gets `CONSENT = 0` (not confirmed) — a human must update it once real consent is
  confirmed for that participant.
- **Never reassigns or duplicates a study association.** A person already present in
  `GDX_PSY_STUDY_PARTICIPANT` for any study is left untouched, not moved or re-linked.

## What it does

Given `--study <slug>`:

1. Reads `GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json` (the same file
   `GDX_SKILL_NEW_STUDY` wrote and `GDX_SKILL_RECORD_NEW_STUDY` consumed) to get the study's `title`.
2. Resolves `GDX_PSY_STUDY.ID_STUDY` by that title — if it isn't found, stops with an error telling
   you to run `GDX_SKILL_RECORD_NEW_STUDY` first.
3. Selects every `GDX_CC_PERSON` with an active flag, at least one `GDX_CC_SESSION` row, and no
   existing `GDX_PSY_STUDY_PARTICIPANT` row (see the scope rule above).
4. For each candidate, defensively re-checks that a `GDX_PSY_PERSON` row with the same id exists
   (this is already guaranteed by `FK_GDX_CC_PERSON_DW_PERSON` when that constraint is applied, but
   the skill verifies it explicitly rather than assuming every target database has it) — a gap here
   is reported, not silently skipped or "fixed" by inventing a `GDX_PSY_PERSON` row.
5. Inserts `GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, CONSENT)` for every
   verified candidate, using `GDX_CC_PERSON.EXTERNAL_CODE` as `ANONYMOUS_CODE` and `CONSENT = 0`.

## Running it

```
cd 6.cardiac.coherence/.claude/skills/GDX_SKILL_LOAD_CC_MAPS_DB/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node load_cc_maps.js --study <slug> --dry-run     # see exactly what would change, writes nothing
node load_cc_maps.js --study <slug>               # apply it
```

`<slug>` is the same one `GDX_SKILL_NEW_STUDY` picked for
`GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json`. If that intake file lives somewhere
non-standard, pass `--intake-dir <path>` (a folder containing `intake.json`) instead of relying on the
default path resolution.

Read the summary before trusting a `--dry-run` (or a real run) is complete: `missing GDX_PSY_PERSON`
entries are a data-integrity gap that stops that one person from being associated (investigate before
running again), and every `associated` row is inserted with unconfirmed consent that a human still
needs to follow up on.

## Files in this skill

- `scripts/load_cc_maps.js` — reads `--study <slug>`'s intake.json, resolves its `ID_STUDY`, and runs
  the scoped association logic (Node.js + `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)

See `GDX_HUMAN/6.cardiac.coherence/GDX_CC_Psychometrics_Person_Mapping.md` for the broader design
rationale (why `ID_PERSON` is shared, why the scope rule is what it is).
