---
name: GDX_SKILL_LIST_ASSOCIATIONS
description: Lists every conceptual/interpretive association currently claimed in GDX_HUMAN between its different perspectives -- e.g. "chakra N corresponds to septenary level N", "the Five Ways of Aquinas run from septenary level 4 to 6", "psychometric variable X sits at septenary level Y", "variable X's high score reads as virtue Z (Virtology)". NOT scoped to a study -- these are catalog/reference correspondences (or, for Virtology, code), the same for the whole framework. Distinguishes DB-backed associations (a real Firebird row, most with a CONFIDENCE_LEVEL) from code-only ones (the Virtology virtue map, which never touches Firebird or Neo4j and has no confidence field). Use when the user asks what correspondences the framework has already made between its philosophical/esoteric models (Septenary Constitution, Kundalini Chakras, Five Ways, Virtology) and each other or behavior/psychometric variables, or wants an inventory/audit of those judgment calls.
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
reference table (`GDX_PSY_CHAKRA`, `GDX_TA_WAY_SEPT_MAP`,
`GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_SEPTENARY_LEVEL`), populated once for
the whole framework, identical regardless of which study you're looking at.
The one exception, `DW_DIM_VARIABLE`, is only joined in to recover each
variable's real `.sav` column name (`SAV_COLUMN`) — never its per-study
scores.

## Two sources, two different epistemic weights — never blurred

1. **DB-backed** (a real row in Firebird):
   - `GDX_PSY_CHAKRA` (4.kundalini.chakras) → `GDX_PSY_SEPTENARY_LEVEL` —
     7 rows, ascending-order correspondence, **no `CONFIDENCE_LEVEL` column
     at all** (the load script's header calls the whole table symbolic/
     interpretive, not graded row by row).
   - `GDX_TA_WAY_SEPT_MAP` (5.five.ways.tomas.aquino) → `GDX_PSY_SEPTENARY_LEVEL`
     — 5 rows, **has** `CONFIDENCE_LEVEL` (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`)
     and a `CORRESPONDENCE_JUSTIFICATION` per row.
   - `GDX_PSY_SEPT_LEVEL_PSY_MAP` (3.septenary.constitution) →
     `GDX_PSY_SEPTENARY_LEVEL` / psychometric variables — ~19 rows, also
     graded with `CONFIDENCE_LEVEL` + `RECORDED_BEHAVIOR` +
     `CORRESPONDENCE_JUSTIFICATION`.
2. **Code-only** (never written to Firebird or Neo4j):
   - `virtue_knowledge.js`'s `VARIABLE_VIRTUE_MAP`, duplicated by design in
     `12.gdx.virtology/.claude/skills/GDX_SKILL_LINK_SUGGESTIONS/scripts/`
     and `.../GDX_SKILL_IDENTIFY_VIRTUES/scripts/` — psychometric variable →
     one of the 33 Virtology virtues, **no confidence field of any kind**.
     This skill reads both copies and reports any drift between them (same
     `behavior`/`virtue` expected in both; only `justification` should
     differ, since one skill frames it as a deficit/antidote and the other
     as a strength already present).

Where a variable appears in **both** sources (e.g. `ENGAGvigor`,
`ACconfianc`, `RealizPess`), the report shows the septenary level next to
the virtue on the same row — the one place in the framework where
Septenary Constitution, Psychometrics, and Virtology all meet.

## What it will never do

- **Never invents an association.** Every row printed already exists,
  either as a Firebird row or as an entry in `virtue_knowledge.js`. A
  variable with no virtue entry is shown as such, not guessed.
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
node list_associations.js --sample   # sanity check: embedded sample data for the Firebird sections, no DB connection
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
read live, either from Firebird or by `require()`-ing the two
`virtue_knowledge.js` files directly. When a new correspondence is added
anywhere in the framework (a new chakra/way/variable mapping row in
Firebird, or a new entry in either `virtue_knowledge.js`), this skill picks
it up automatically on the next run — nothing here needs manual updating.
The one thing that *can* drift is the two `virtue_knowledge.js` copies
diverging from each other; that's exactly what the sync check in Section 4
of the report is for.

## Files in this skill

- `scripts/list_associations.js` — connects to Firebird (or uses `--sample`
  data), reads the three DB-backed correspondence tables, `require()`s both
  `virtue_knowledge.js` copies, cross-references by `.sav` column, and
  writes/prints the consolidated report (Node.js + `node-firebird`, no
  native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
