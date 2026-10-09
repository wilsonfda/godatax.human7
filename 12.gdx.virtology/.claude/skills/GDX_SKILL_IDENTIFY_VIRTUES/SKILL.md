---
name: GDX_SKILL_IDENTIFY_VIRTUES
description: Identifies the 3 highest-scoring psychometric indicators of ONE study (via --study <slug>) in GDX_HUMAN (7.multidimensional.database) and points, from the 33 Virtology virtues (12.gdx.virtology/Virtology_Knowledge_Base.md), which ones are potentially already present as strengths in that population. Prints the result to the screen only -- writes no file. Use when the user asks which virtues a specific GDX_HUMAN study's participants already show potential for, based on their strongest psychometric scores.
---

# GDX_SKILL_IDENTIFY_VIRTUES

The mirror image of [`GDX_SKILL_LINK_SUGGESTIONS`](../GDX_SKILL_LINK_SUGGESTIONS/SKILL.md):
instead of ranking the **lowest**-scoring psychometric indicators of a study
to suggest a virtue as a *treatment target* for a deficit, this skill ranks
the **3 highest**-scoring indicators and points to the virtue each one
corresponds to as a **potential strength already present** in that study's
population. Same 33-virtue catalog, same variable → virtue judgment call,
opposite direction, opposite output: a report suggests a treatment target
that gets written to a file; this skill's whole deliverable is what it
prints to the screen.

## Scoped to one study

Every run requires `--study <slug>` — the same slug `GDX_SKILL_NEW_STUDY` /
`GDX_SKILL_MAKE_DASHBOARS_DW` / `GDX_SKILL_LOAD_NEW_STUDY_DW` /
`GDX_SKILL_LINK_SUGGESTIONS` use for `new_study_intake/<slug>/intake.json`.
The slug resolves to the study's title (from its `intake.json`), the title
resolves to `GDX_PSY_STUDY.ID_STUDY`, and the ranking query joins
`DW_DIM_PERSON` on `ID_STUDY = ?` so the "highest scores" are always this
one study's own participants — never blended with another study's people.
Running the skill again for a different study produces a completely
separate console read; it never mixes two studies' scores into one ranking.

## What it reads

`7.multidimensional.database`'s `DW_FACT_PSY_VARIABLE_RESULT` joined to
`DW_DIM_VARIABLE`, `DW_DIM_SEPTENARY_LEVEL`, and `DW_DIM_PERSON` (for the
`ID_STUDY` filter) — the exact same source `GDX_SKILL_LINK_SUGGESTIONS`
reads, only sorted `DESC` instead of `ASC`. This skill is **read-only**: it
never writes to Firebird or Neo4j, and (unlike `GDX_SKILL_LINK_SUGGESTIONS`)
it never writes a Markdown report either — its output lives only in the
terminal.

## What it will never do

- **Never guesses a virtue.** Which of the 33 virtues corresponds to a given
  psychometric variable is the same fixed interpretive judgment call as
  `GDX_SKILL_LINK_SUGGESTIONS`, kept in this skill's own
  `scripts/virtue_knowledge.js` (same `.sav`-column keys, same 33 virtues —
  see "Keeping this in sync" below). A variable with no entry there is
  reported as **"sem virtude identificada (revisar)"**, not silently
  skipped and not auto-assigned.
- **Never claims clinical validity.** The console output repeats the same
  methodological caveat as `GDX_SKILL_LINK_SUGGESTIONS` and
  `SPSS_Septenary_Constitution_Mapping.md`: a high score is a real number
  from the DW, but "this virtue is already a strength" is a qualitative,
  interpretive correspondence — not a statistical or clinical finding.
- **Never writes a file.** The result is only printed to the screen. If a
  persistent record is ever needed, redirect the command's stdout yourself
  (e.g. `node identify_virtues.js --study <slug> > my_notes.md`) — the skill
  itself takes no `--out` flag on purpose, to stay the deliberate opposite
  of `GDX_SKILL_LINK_SUGGESTIONS`'s file-writing behavior.

## Running it

```
cd 12.gdx.virtology/.claude/skills/GDX_SKILL_IDENTIFY_VIRTUES/scripts
npm install                                # once, installs node-firebird
node identify_virtues.js --study <slug> --sample   # sanity check: embedded sample data, no DB connection
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node identify_virtues.js --study <slug>            # real run against the live DW, top 3 highest indicators
node identify_virtues.js --study <slug> --top 5    # override how many of the highest indicators to show
```

`--study <slug>` is **required** — the same slug `GDX_SKILL_NEW_STUDY` used
for `new_study_intake/<slug>/intake.json` (resolved automatically from this
script's location; pass `--intake-dir <path>` if that intake lives somewhere
else). In real mode, the slug's `intake.json` must already exist and its
`study.title` must already be a row in `GDX_PSY_STUDY` — the skill errors
out with a clear message otherwise. In `--sample` mode, a missing
`intake.json` is not an error: the report just falls back to a generic
"Sample Study" title.

Output: printed straight to the terminal — there is no `--dry-run` flag
because there is nothing to hold back; every run's only effect is what it
prints.

## Keeping this in sync

`scripts/virtue_knowledge.js` here is a **separate copy** of
`GDX_SKILL_LINK_SUGGESTIONS/scripts/virtue_knowledge.js`'s `VIRTUES` list
and `VARIABLE_VIRTUE_MAP` (which virtue a given `.sav` column corresponds
to) — same pattern the repo already uses for per-skill knowledge files
(e.g. `GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/knowledge.js`). When a new
psychometric variable gets a variable → virtue judgment call added to one
skill's map, add the identical `behavior`/`virtue` entry to the other's too
so both skills agree on which virtue a given variable points to; only the
`justification` prose may legitimately differ, since this skill always
frames it as a strength-in-potential ("score alto aqui..."), never as a
deficit-and-antidote the way `GDX_SKILL_LINK_SUGGESTIONS` does.

## Files in this skill

- `scripts/virtue_knowledge.js` — the 33-virtue catalog plus the fixed
  variable → virtue judgment-call map, framed for high scores (edit this
  when a new psychometric variable needs a potential-virtue judgment call,
  and mirror the `behavior`/`virtue` pairing into `GDX_SKILL_LINK_SUGGESTIONS`)
- `scripts/identify_virtues.js` — reads the DW, ranks the highest scores,
  looks up potential virtues, prints the result (Node.js + `node-firebird`,
  no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
