---
name: GDX_SKILL_DELETE_STUDY
description: Permanently deletes ONE study and everything exclusively tied to it -- GDX_PSY_STUDY, its participants/applications/responses/results, its cardiac-coherence sessions, the matching DW_* rows, the matching Neo4j nodes/relationships, and its GDX_SKILL_MAKE_DASHBOARS_DW HTML files in 8.gdx.dashboards. NEVER deletes catalog data (instruments, items, alternatives, indicators, variables, constructs, phenomena) -- that stays as reusable knowledge base for future studies, by design, regardless of whether another study also uses it. GDX_PSY_PSYCHOMETRIC_PROPERTY (CFA/EFA results computed from responses) is the one exception tied to response data rather than the catalog: deleted only for an instrument no OTHER study has any response data for. A person shared with another study is also kept. Use ONLY when the user explicitly asks to delete/remove/purge a study and its data, and always run --dry-run first.
---

# GDX_SKILL_DELETE_STUDY

The mirror image of the "onboard a new study" pipeline (`GDX_SKILL_NEW_STUDY` /
`GDX_SKILL_RECORD_NEW_STUDY` / `GDX_SKILL_EXPORT_NEW_STUDY` / `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`) and
of `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` (which *writes* a study's slice into Neo4j) -- this one reverses
both: it deletes a study's data from the relational OLTP schema, the DW
(`7.multidimensional.database`), and Neo4j, in one pass.

**This is the single most destructive skill in `GDX_HUMAN`.** It writes nothing back -- there is no
undo. Read this whole file, not just the "Running it" section, before pointing it at a real study.

## The one rule everything else follows: the catalog is forever, response data isn't

**Instruments, their items, response alternatives, indicators, variables, constructs and phenomena
are NEVER deleted by this skill -- by deliberate product decision, not merely because they might be
shared.** A study's questionnaire is a reusable asset: the next study that wants to measure Burnout
should find the Maslach Burnout Inventory already cataloged, not have to re-enter its 18 items from
scratch because an earlier study that happened to use it was deleted. So `GDX_PSY_INSTRUMENT`,
`GDX_PSY_INSTRUMENT_ITEM`, `GDX_PSY_ITEM_ALTERNATIVE`, `GDX_PSY_INDICATOR`, `GDX_PSY_INDICATOR_ITEM`,
`GDX_PSY_VARIABLE`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_INSTRUMENT_CONSTRUCT`, `GDX_PSY_PHENOMENON` and
`GDX_PSY_PHENOMENON_CONSTRUCT` are simply never deletion candidates, full stop -- this skill only
ever removes a study's *use* of the catalog, never the catalog itself. Likewise
`GDX_PSY_SEPT_LEVEL_PSY_MAP`, `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`,
`GDX_TA_WAY_SEPT_MAP`, `GDX_CC_DEVICE` are global reference tables with no study ownership at all
(same classification `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` already uses for its own "always exported in
full" bucket) -- also never touched.

`GDX_PSY_PSYCHOMETRIC_PROPERTY` is the one table that looks like catalog data (it hangs off
`ID_INSTRUMENT`/`ID_CONSTRUCT`, same as the catalog) but isn't -- it is CFA/EFA **output**, computed
from a specific set of participants' raw responses. Deleting the responses that produced a KMO or a
factor loading without deleting the number itself would leave a stale, unreproducible statistic
behind. So it follows the response data, not the catalog: deleted for an instrument only when **no
OTHER study has any response data for it** (checked directly against `GDX_PSY_ITEM_RESPONSE`, not
assumed) -- if another study's responses are still there, that instrument's properties might still
be valid for (or still needed by) that other study, so they're left alone.

The same "don't break another study" question applies to **people**: one person can participate in
more than one study. The script checks this directly, by querying the database (never assumed,
never cached):

| Row | "Exclusive to this study" means | If shared, this skill... |
|---|---|---|
| A person (`GDX_PSY_PERSON` / `GDX_CC_PERSON`) | No `GDX_PSY_STUDY_PARTICIPANT` row for them under any OTHER `ID_STUDY` | keeps the person, their `GDX_CC_*` sessions, and their `DW_DIM_PERSON` row untouched -- only removes their tie to *this* study (`GDX_PSY_STUDY_PARTICIPANT`, this study's `GDX_PSY_APPLICATION`/responses) |
| An instrument's `GDX_PSY_PSYCHOMETRIC_PROPERTY` rows (the instrument itself is never a candidate -- see above) | No `GDX_PSY_ITEM_RESPONSE` under any OTHER `ID_STUDY` references one of its items (**not** `GDX_PSY_APPLICATION.ID_INSTRUMENT` -- see caveat below) | keeps that instrument's CFA/EFA results |

### A real bug this exclusivity check had to survive

Before the current design (catalog never deleted), an earlier version of this skill checked
instrument exclusivity via `GDX_PSY_APPLICATION.ID_INSTRUMENT`. Testing that version's dry run
against real data (`ID_STUDY=2`) caught it reporting the Maslach Burnout Inventory
(`ID_INSTRUMENT=9`) as "exclusive" to a brand-new study -- when `ID_STUDY=1` (the historical
`.sav`-sourced load) actually has 7,614 real `GDX_PSY_ITEM_RESPONSE` rows against its items. The
reason: `ID_STUDY=1` uses ONE "umbrella" `GDX_PSY_APPLICATION` per person, arbitrarily stamped
`ID_INSTRUMENT=1` (Hardiness), covering that person's responses across all 11 instruments --
`GDX_PSY_APPLICATION.ID_INSTRUMENT` simply isn't a reliable signal for "which instrument was
actually answered here." The fix, still in place: always determine instrument usage by joining
`GDX_PSY_ITEM_RESPONSE -> GDX_PSY_INSTRUMENT_ITEM`, the ground truth of which item (and therefore
which instrument) a response actually belongs to, never the application's own label.

## What always gets deleted outright (genuinely study-owned, no exclusivity question)

- `GDX_PSY_STUDY` itself (the row being deleted)
- `GDX_PSY_STUDY_PARTICIPANT`, `GDX_PSY_APPLICATION`, `GDX_PSY_OBSERVATION`, `GDX_PSY_EVALUATION`
  (+ `GDX_PSY_EVALUATION_ACTION`) -- filtered by `ID_STUDY`
- `GDX_PSY_ITEM_RESPONSE`, `GDX_PSY_VARIABLE_RESULT`, `GDX_PSY_CONSTRUCT_RESULT`,
  `GDX_PSY_INDICATOR_RESULT` -- filtered by `ID_APPLICATION IN` this study's applications (so a
  shared person's responses from a DIFFERENT study's application are never touched, even though the
  person itself might be kept)
- `DW_FACT_PSY_ITEM_RESPONSE`, `DW_FACT_PSY_VARIABLE_RESULT` -- also filtered by `ID_APPLICATION`
  (both fact tables carry it explicitly, precisely so this kind of per-study cleanup can be exact
  even for a shared person)

## What gets deleted only for an instrument with no other study's response data

- `GDX_PSY_PSYCHOMETRIC_PROPERTY` -- see "the catalog is forever" above. The instrument row itself,
  and everything under it, is never touched either way.

## What gets deleted only for exclusive people

- `DW_FACT_CC_HRV_WINDOW`, `DW_DIM_SESSION`, `DW_DIM_PERSON` (`DW_DIM_PERSON`'s PK is `ID_PERSON`
  alone -- one row per person globally, not per person+study -- so it is only ever safe to delete
  for a person with no other study tie)
- `GDX_CC_SESSION` (`ON DELETE CASCADE` in the DDL takes `GDX_CC_RR_INTERVAL`, `GDX_CC_ECG_SAMPLE`,
  `GDX_CC_MOTION`, `GDX_CC_HRV_WINDOW`, `GDX_CC_DEVICE_EVENT` with it -- this skill does not need to
  delete those five tables itself)
- `GDX_CC_PERSON`, `GDX_PSY_PERSON`

## Neo4j

After the relational/DW deletes commit, the skill deletes the matching Neo4j nodes -- computing each
`gdx_key` exactly the way `GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts/export_graph.js` computed it when
writing them (same PK-columns-joined-by-`::` rule), so the Neo4j side always mirrors the relational
side node-for-node, never re-deriving its own notion of scope. `DETACH DELETE` removes each node's
relationships along with it. `--skip-neo4j` opts out (e.g. no Neo4j credentials configured yet).

## Dashboards (`8.gdx.dashboards`)

`GDX_SKILL_MAKE_DASHBOARS_DW` writes standalone `.html` chart files that embed a snapshot of a study's
data at generation time (they don't re-query the DW when opened), named
`dashboard_0N_<chart>__<study-slug>__<study-title-slug>__<timestamp>.html`. Left alone, deleting a
study would leave those files behind showing data that no longer exists anywhere else. So after the
Neo4j phase, this skill deletes them too -- but it only knows the study's numeric `ID_STUDY`, while the
dashboard filenames carry the `--study <slug>` code `GDX_SKILL_MAKE_DASHBOARS_DW` was run with (the
`new_study_intake/<slug>` directory name), not the id. To bridge that, it scans every
`0.new.instrument/new_study_intake/<slug>/intake.json` for the one whose `study.title` matches this
study's `GDX_PSY_STUDY.TITLE` exactly (the reverse of the slug -> title -> `ID_STUDY` lookup
`GDX_SKILL_MAKE_DASHBOARS_DW` itself does), then deletes every file in `8.gdx.dashboards` whose
`__<slug>__` filename field matches that slug -- across however many runs/timestamps exist for it, both
`--chart`-scoped single-file runs and full 9-chart runs.

If no `intake.json` has a matching `study.title` (e.g. the study was inserted straight into Firebird,
with no intake file ever written), the skill cannot resolve a slug and prints a warning instead of
guessing -- it never deletes by filename substring or by any heuristic weaker than an exact
`study.title` match, since a wrong guess here would delete another study's dashboards. Check
`8.gdx.dashboards` by hand in that case.

`--skip-dashboards` opts out of this phase entirely. `--dashboards-dir <path>` overrides the default
`8.gdx.dashboards` location (resolved relative to this script, same depth
`GDX_SKILL_MAKE_DASHBOARS_DW` uses for its own default `--out-dir`).

## Running it

```
cd 0.new.instrument/.claude/skills/GDX_SKILL_DELETE_STUDY/scripts
npm install                 # once, installs node-firebird + neo4j-driver
# copy ../.env.example to ../.env and fill in BOTH the Firebird (GDX_HUMAN_FB_*) and
# Neo4j (NEO4J_*) credentials, or export the vars directly

node delete_study.js --study <ID_STUDY>
```

**This always runs as a dry run** -- it connects, computes the full exclusivity analysis, prints
exactly what would be deleted and what would be preserved (and why), and writes nothing, unless you
also pass both of:

```
node delete_study.js --study <ID_STUDY> --execute --confirm-title "<the study's exact TITLE>"
```

`--confirm-title` must match `GDX_PSY_STUDY.TITLE` byte-for-byte (copy it from the dry run's own
output) -- a deliberate extra step so a wrong `--study` number, or a habitual `--execute` flag from
muscle memory, cannot delete the wrong study. **Read the dry-run's preserved/deleted breakdown
yourself and get the user's explicit go-ahead before ever passing `--execute`** -- this is
irreversible, and the assistant running this skill must treat it with the same "confirm before a
hard-to-reverse action" rule as any other destructive operation, every single time, regardless of
what was approved in an earlier run.

`--skip-neo4j` skips the Neo4j phase entirely (relational + DW only). `--skip-dashboards` skips the
`8.gdx.dashboards` cleanup phase. `--dashboards-dir <path>` overrides where that phase looks.

## Output: the deletion report

Both in dry-run and real mode, the final thing printed is a per-table count -- e.g.:

```
=== Deleted from GDX_PSY_STUDY 2 ("Análise de Estudo 2 — Teste de Burnout") ===
  GDX_PSY_ITEM_RESPONSE:              15
  GDX_PSY_PSYCHOMETRIC_PROPERTY:       0   (instrument shared with ID_STUDY=1 -- properties kept)
  GDX_PSY_APPLICATION:                 1
  GDX_PSY_STUDY_PARTICIPANT:           1
  GDX_PSY_PERSON:                      1
  DW_FACT_PSY_ITEM_RESPONSE:           0   (never loaded into the DW)
  GDX_PSY_STUDY:                       1
  Neo4j nodes:                        16
  Dashboard HTML files (8.gdx.dashboards):  4

=== Preserved (never deleted by this skill) ===
  GDX_PSY_INSTRUMENT ID_INSTRUMENT=9 and its catalog (items/alternatives/indicators/variables/
    constructs/phenomena) -- always kept as reusable knowledge base
  GDX_PSY_PSYCHOMETRIC_PROPERTY for ID_INSTRUMENT=9 -- also has response data in ID_STUDY 1, kept
```

In dry-run mode every count is prefixed `[DRY RUN] would delete`.

## Files in this skill

- `scripts/delete_study.js` -- the whole skill (Node.js + `node-firebird` + `neo4j-driver`); one
  file because every phase shares the same exclusivity analysis computed up front
- `scripts/package.json`
- `.env.example` -- connection variable template for BOTH databases (no secrets)
