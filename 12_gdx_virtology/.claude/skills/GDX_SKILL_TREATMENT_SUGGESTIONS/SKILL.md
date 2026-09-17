---
name: GDX_SKILL_TREATMENT_SUGGESTIONS
description: Ranks the lowest-scoring GDX_HUMAN psychometric indicators (7_multidimensional.database) and suggests, from the 33 Virtology virtues (12_gdx_virtology/Virtology_Knowledge_Base.md), which one addresses each one as a treatment suggestion. Writes a timestamped Markdown report to 12_gdx_virtology/. Use when the user asks for virtue/treatment suggestions based on the psychometric data.
---

# GDX_SKILL_TREATMENT_SUGGESTIONS

Reads the real, live average score of every psychometric variable that has a
septenary-level mapping, ranks them from lowest to highest (the lowest
scores are read as the neediest indicators), and for each one suggests one
of the **33 Virtology virtues** (`Virtology_Knowledge_Base.md`) as a
treatment target, with a short justification. Output is a single timestamped
Markdown file in `12_gdx_virtology/`.

## What it reads

`7_multidimensional.database`'s `DW_FACT_PSY_VARIABLE_RESULT` joined to
`DW_DIM_VARIABLE` and `DW_DIM_SEPTENARY_LEVEL` — the same DW built by the
scripts in that folder and already consumed by `8_gdx_dashboards`. This
skill is **read-only**: it never writes to Firebird or Neo4j.

## What it will never do

- **Never guesses a virtue.** Which of the 33 virtues addresses a given
  psychometric variable, and why, is a fixed interpretive judgment call in
  `scripts/virtue_knowledge.js`, keyed by the variable's `.sav` column
  (`DW_DIM_VARIABLE.SAV_COLUMN`) — same pattern as
  `GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/knowledge.js`. A variable with no
  entry there is reported in the output as **"sem sugestão (revisar)"**,
  not silently skipped and not auto-assigned.
- **Never claims clinical validity.** Every generated report repeats, near
  the top, the same methodological caveat already used in
  `SPSS_Septenary_Constitution_Mapping.md`: this is a qualitative,
  interpretive correspondence, not a statistical or clinical finding.

## Running it

```
cd 12_gdx_virtology/.claude/skills/GDX_SKILL_TREATMENT_SUGGESTIONS/scripts
npm install                          # once, installs node-firebird
node generate_suggestions.js --sample --dry-run   # sanity check: embedded sample data, prints only, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_suggestions.js --top 10             # real run against the live DW, top 10 lowest indicators
node generate_suggestions.js                      # real run, default top 8
```

Output: `12_gdx_virtology/Treatment_Suggestions_<YYYYMMDD_HHMMSS>.md` (one
file per run — old runs are never overwritten, so a history of analyses
accumulates naturally in the folder).

## Extending it

To add a suggestion for a variable the report currently lists as "sem
sugestão", add an entry to `VARIABLE_VIRTUE_MAP` in
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
