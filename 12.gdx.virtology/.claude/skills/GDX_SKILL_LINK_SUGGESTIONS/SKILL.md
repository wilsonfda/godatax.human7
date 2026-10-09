---
name: GDX_SKILL_LINK_SUGGESTIONS
description: Ranks the lowest-scoring psychometric indicators of ONE study (via --study <slug>) in GDX_HUMAN (7.multidimensional.database) and suggests, from the 33 Virtology virtues (12.gdx.virtology/Virtology_Knowledge_Base.md), which one addresses each one as a treatment suggestion. Writes a timestamped Markdown report to 12.gdx.virtology/. Use when the user asks for virtue/treatment suggestions based on a specific GDX_HUMAN study's psychometric data.
---

# GDX_SKILL_LINK_SUGGESTIONS

Reads the real, live average score of every psychometric variable that has a
septenary-level mapping, **for one study**, ranks them from lowest to
highest (the lowest scores are read as the neediest indicators), and for
each one suggests one of the **33 Virtology virtues**
(`Virtology_Knowledge_Base.md`) as a treatment target, with a short
justification. Output is a single timestamped Markdown file in
`12.gdx.virtology/`.

## Scoped to one study

Every run requires `--study <slug>` — the same slug `GDX_SKILL_NEW_STUDY` /
`GDX_SKILL_MAKE_DASHBOARS_DW` / `GDX_SKILL_LOAD_NEW_STUDY_DW` use for
`new_study_intake/<slug>/intake.json`. The slug resolves to the study's
title (from its `intake.json`), the title resolves to `GDX_PSY_STUDY.ID_STUDY`,
and the ranking query joins `DW_DIM_PERSON` on `ID_STUDY = ?` so the "lowest
scores" are always this one study's own participants — never blended with
another study's people the way an unscoped average across the whole DW would
be. Running the skill again for a different study produces a completely
separate report; it never mixes two studies' scores into one ranking.

## What it reads

`7.multidimensional.database`'s `DW_FACT_PSY_VARIABLE_RESULT` joined to
`DW_DIM_VARIABLE`, `DW_DIM_SEPTENARY_LEVEL`, and `DW_DIM_PERSON` (for the
`ID_STUDY` filter) — the same DW built by the scripts in that folder and
already consumed by `8.gdx.dashboards`. This skill is **read-only**: it
never writes to Firebird or Neo4j.

## What it will never do

- **Never guesses a virtue.** Which of the 33 virtues addresses a given
  psychometric variable, and why, is a fixed interpretive judgment call in
  `scripts/virtue_knowledge.js`, keyed by the variable's `.sav` column
  (`DW_DIM_VARIABLE.SAV_COLUMN`) — same pattern as
  `GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/knowledge.js`. A variable with no
  entry there is reported in the output as **"no suggestion (review)"**,
  not silently skipped and not auto-assigned.
- **Never claims clinical validity.** Every generated report repeats, near
  the top, the same methodological caveat already used in
  `SPSS_Septenary_Constitution_Mapping.md`: this is a qualitative,
  interpretive correspondence, not a statistical or clinical finding.

## Running it

```
cd 12.gdx.virtology/.claude/skills/GDX_SKILL_LINK_SUGGESTIONS/scripts
npm install                          # once, installs node-firebird
node generate_suggestions.js --study <slug> --sample --dry-run   # sanity check: embedded sample data, prints only, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_suggestions.js --study <slug> --top 10             # real run against the live DW, top 10 lowest indicators for that study
node generate_suggestions.js --study <slug>                      # real run, default top 8
```

`--study <slug>` is **required** — the same slug `GDX_SKILL_NEW_STUDY` used
for `new_study_intake/<slug>/intake.json` (resolved automatically from this
script's location; pass `--intake-dir <path>` if that intake lives somewhere
else). In real mode, the slug's `intake.json` must already exist and its
`study.title` must already be a row in `GDX_PSY_STUDY` — the skill errors
out with a clear message otherwise. In `--sample` mode, a missing
`intake.json` is not an error: the report just falls back to a generic
"Sample Study" title.

Output: `12.gdx.virtology/Link_Suggestions_<study-slug>_<YYYYMMDD_HHMMSS>.md`
(one file per run — old runs are never overwritten, so a history of
analyses accumulates naturally in the folder, one thread per study).

## Extending it

To add a suggestion for a variable the report currently lists as "no
suggestion", add an entry to `VARIABLE_VIRTUE_MAP` in
`scripts/virtue_knowledge.js` (keyed by the exact `.sav` column name),
with `behavior` (what the variable measures), `virtue` (the exact `pt` name
from the `VIRTUES` list in the same file), and `justification` (why that
virtue addresses it) — then re-run the skill.

## Files in this skill

- `scripts/virtue_knowledge.js` — the 33-virtue catalog plus the fixed
  variable → virtue judgment-call map (edit this when a new psychometric
  variable needs a treatment-suggestion decision)
- `scripts/generate_suggestions.js` — reads the DW, ranks, looks up
  suggestions, writes the timestamped report (Node.js + `node-firebird`, no
  native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
