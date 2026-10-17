---
name: GDX_SKILL_LIST_ASSOCIATIONS
description: Lists every conceptual/interpretive association currently claimed in GDX_HUMAN between its different perspectives -- e.g. "chakra N corresponds to septenary level N", "the Five Ways of Aquinas run from septenary level 4 to 6", "psychometric variable X sits at septenary level Y", "variable X's high score reads as virtue Z (Virtology)". NOT scoped to a study -- these are catalog/reference correspondences, the same for the whole framework. Every source is a real Firebird row, most with a CONFIDENCE_LEVEL and a NUMBER_CONFIRMATIONS column; the one exception is GDX_PSY_CHAKRA, a 7-row catalog with neither. Use when the user asks what correspondences the framework has already made between its philosophical/esoteric models (Septenary Constitution, Kundalini Chakras, Five Ways, Virtology) and each other or behavior/psychometric variables, or wants an inventory/audit of those judgment calls.
---

# GDX_SKILL_LIST_ASSOCIATIONS

Answers a different question than every other `--study`-scoped skill in this
repo: not "what does this study's data show", but **"what correspondences
has the framework itself already decided on, between its different
perspectives?"** — e.g. is chakra 4 related to septenary level 4? Is the
Third Way (Aquinas) related to a septenary level, or to a behavior? Does
psychometric variable `ACconfianc` correspond to a virtue?

## Not scoped to a study, on purpose

Every other `GDX_SKILL_*` that reads `7.multidimensional.database` requires
`--study <slug>` because it scores one study's participants. This skill
takes **no `--study` flag at all** — every table it reads is a catalog /
reference table (`GDX_PSY_CHAKRA`, `GDX_PSY_CHAKRA_VAR_MAP`,
`GDX_TA_WAY_SEPT_MAP`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_VT_VARIABLE_VIRTUE_MAP`,
`GDX_PSY_SEPTENARY_LEVEL`), populated once for the whole framework,
identical regardless of which study you're looking at. The one exception,
`DW_DIM_VARIABLE`, is only joined in to recover each variable's real `.sav`
column name (`SAV_COLUMN`) — never its per-study scores.

## Five Firebird tables, one epistemic standard

Every association this skill reports is a real row in Firebird:

- `GDX_PSY_CHAKRA` (4.kundalini.chakras) → `GDX_PSY_SEPTENARY_LEVEL` —
  7 rows, ascending-order correspondence, **no `CONFIDENCE_LEVEL` column
  at all** (the load script's header calls the whole table symbolic/
  interpretive, not graded row by row). Also **no `NUMBER_CONFIRMATIONS`**
  — the one table without either column (see below).
- `GDX_PSY_CHAKRA_VAR_MAP` (14.metaphysical.measuring.instrument) →
  concrete instrument/variable ↔ chakra correspondences — graded with
  `CONFIDENCE_LEVEL` + `RECORDED_BEHAVIOR` + `CORRESPONDENCE_JUSTIFICATION`
  + `NUMBER_CONFIRMATIONS`.
- `GDX_TA_WAY_SEPT_MAP` (5.five.ways.tomas.aquino) → `GDX_PSY_SEPTENARY_LEVEL`
  — 5 rows, **has** `CONFIDENCE_LEVEL` (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`)
  and a `CORRESPONDENCE_JUSTIFICATION` per row, plus `NUMBER_CONFIRMATIONS`.
- `GDX_PSY_SEPT_LEVEL_PSY_MAP` (3.septenary.constitution) →
  `GDX_PSY_SEPTENARY_LEVEL` / psychometric variables — ~19 rows, also
  graded with `CONFIDENCE_LEVEL` + `RECORDED_BEHAVIOR` +
  `CORRESPONDENCE_JUSTIFICATION` + `NUMBER_CONFIRMATIONS`.
- `GDX_VT_VARIABLE_VIRTUE_MAP` × `GDX_VT_VIRTUE` (12.gdx.virtology) →
  psychometric variable → one of the 33 Virtology virtues — graded with
  `CONFIDENCE_LEVEL` + `NUMBER_CONFIRMATIONS` like the others, but with
  **two** justification columns instead of one:
  `JUSTIFICATION_DEFICIT` (low score → antidote, the framing
  `GDX_SKILL_LINK_SUGGESTIONS` reads) and `JUSTIFICATION_STRENGTH` (high
  score → already present, the framing `GDX_SKILL_IDENTIFY_VIRTUES` reads)
  — the same virtue, two framings, not two competing claims. **2026-10-15:**
  this table replaced a pair of hand-written `virtue_knowledge.js` copies
  that lived only in code and never had a confidence field at all; those
  two files still exist but nothing reads them anymore.

`NUMBER_CONFIRMATIONS` (added to the first three by
`confirmation_fields_association_maps_firebird25.sql`, native to
`GDX_VT_VARIABLE_VIRTUE_MAP` since its own creation, plus
`CONFIRMATION_BY`/`NAME_INSTITUTION` which this skill does not print) is a
separate concept from `CONFIDENCE_LEVEL`: it counts how many times a
correspondence has been **independently corroborated**, not how confident
the original author was. It exists on every table above except
`GDX_PSY_CHAKRA`. Every table/section that has the column shows a per-row
count plus a summed total for that section, and the Summary table sums it
again across all sections.

Where a variable appears in **both** Section 3 and Section 4 (e.g.
`ENGAGvigor`, `RealizPess`), the report shows the septenary level next to
the virtue on the same row — the one place in the framework where
Septenary Constitution, Psychometrics, and Virtology all meet.

## What it will never do

- **Never invents an association.** Every row printed already exists as a
  Firebird row. A variable with no virtue row is shown as such, not guessed.
- **Never writes to Firebird or Neo4j.** Read-only against the DB; its only
  side effect is the Markdown report.
- **Never claims empirical/statistical validity for any correspondence** —
  every section repeats that these are recorded interpretive judgment
  calls, the same methodological caveat as
  `SPSS_Septenary_Constitution_Mapping.md`, `five_ways_septenary_map_firebird25.sql`,
  and `chakras_model_firebird25.sql`.

## Running it

```
cd 14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_LIST_ASSOCIATIONS/scripts
npm install                          # once, installs node-firebird
node list_associations.js --sample   # sanity check: embedded sample data for every section, no DB connection
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node list_associations.js            # real run against the live catalog tables
node list_associations.js --out <path>   # write the report somewhere other than the default location
```

No `--study` flag exists on purpose — passing one is an error (unknown
argument). Output: a Markdown report is written to
`14.metaphysical.measuring.instrument/Framework_Associations_<timestamp>.md`
and the same content is printed to the console.

## Keeping this in sync with the sources it reads

This skill has **no knowledge file of its own** — everything it reports is
read live from Firebird, across all five tables. When a new correspondence
is added anywhere in the framework (a new chakra/way/variable/virtue
mapping row), this skill picks it up automatically on the next run —
nothing here needs manual updating, and (since 2026-10-15) there is no
code-vs-database drift to track for Virtology either, now that
`GDX_SKILL_LINK_SUGGESTIONS` and `GDX_SKILL_IDENTIFY_VIRTUES` read the same
table this skill does.

## Files in this skill

- `scripts/list_associations.js` — connects to Firebird (or uses `--sample`
  data), reads all five correspondence tables (including
  `GDX_PSY_CHAKRA_VAR_MAP`, `GDX_VT_VARIABLE_VIRTUE_MAP` × `GDX_VT_VIRTUE`,
  and each table's `NUMBER_CONFIRMATIONS`), cross-references Section 4 by
  `.sav` column against Section 3, and writes/prints the consolidated
  report (Node.js + `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
