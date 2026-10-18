# Plan: Study #3 — "Humility in Metaphysics"

Status: planning only — nothing in this plan has been executed yet.
Planned study: `ID_STUDY=3` (confirmed live against `GDX_PSY_STUDY`: today
only `1` and `2` exist; `burnout-test-2` is a draft `intake.json` that was
never executed — it doesn't count).
Base instrument: `Comprehensive Intellectual Humility Scale`
(Krumrei-Mancuso & Rouse, 2016), PT-BR adaptation at
`12.gdx.virtology/Intellectual_Humility_Scale_PT_Adaptation.md`.
Target virtue: `GDX_VT_VIRTUE` #1 — Humility.
**Out of scope:** no cardiac-coherence instrument/session
(`6.cardiac.coherence`) for this study — dashboards 01 and 04 (which depend
on that) come out empty/skipped for `ID_STUDY=3`.

Two corrections found during research, before any execution:
- The filename cited in the original request
  (`dashboard_08_means_psychometric_responses_11__...`) doesn't match
  anything real. The real pattern is
  `dashboard_NN_<name>__<slug>__<title-slug>__<timestamp>.html`, `NN` from
  `00` to `08`; "means_psychometric_responses" is `dashboard_00`, not `08`.
- None of the 9 existing dashboards shows an individual participant — all
  of them are aggregate averages across the whole study. The per-respondent
  panel requested (Phase 7) is new development.

---

## Phase 1 — Design the construct and the variables (conversation, no writes)

Construct: **Intellectual Humility**, 4 dimensions (variables), same
scoring direction across all of them (higher score = more humble, after
reverse-scored items are inverted):

| Variable (proposed) | Original subscale | Items | Proposed septenary level |
|---|---|---|---|
| `HIindepEgo` | Independence of Intellect and Ego | 16,17,18,21,22 (all reverse-scored) | #3 Astral Body |
| `HIabertura` | Openness to Revising One's Viewpoint | 6–10 | #5 Higher Mental Body |
| `HIrespeito` | Respect for Others' Viewpoints | 11,13,14,15,19,20 | #6 Buddhic Body |
| `HInaoconfi` | Lack of Intellectual Overconfidence | 1,2,3,4,5,12 (all reverse-scored) | #4 Lower Mental Body |

Instrument: 22 items, 1–5 Likert, full text (EN + PT draft) already in
`Intellectual_Humility_Scale_PT_Adaptation.md`.

## Phase 2 — Register the study (`0.new.instrument`)

```
# 1) Conversational interview -- GDX_SKILL_NEW_STUDY
#    writes new_study_intake/humildade-na-metafisica/intake.json
python 0.new.instrument/.claude/skills/GDX_SKILL_NEW_STUDY/scripts/validate_intake.py \
  0.new.instrument/new_study_intake/humildade-na-metafisica/intake.json

# 2) Generate + execute the load scripts -- GDX_SKILL_RECORD_NEW_STUDY
python 0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts/generate_new_study_scripts.py \
  0.new.instrument/new_study_intake/humildade-na-metafisica/intake.json
cd 0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts
node execute_new_study.js --dir ../../../../new_study_intake/humildade-na-metafisica --dry-run
node execute_new_study.js --dir ../../../../new_study_intake/humildade-na-metafisica
```
Writes: `GDX_PSY_STUDY` (ID_STUDY=3), `PHENOMENON`, `CONSTRUCT`, `VARIABLE`
(the 4 from Phase 1), `INDICATOR`, `INSTRUMENT`, `INSTRUMENT_ITEM` (22),
`ITEM_ALTERNATIVE` (1–5), `INDICATOR_ITEM`.

(Note: `new_study_intake/humildade-na-metafisica` keeps its Portuguese slug
— it is a folder name / Firebird slug value, not prose, so it was left
untranslated, same as every other study slug in this project.)

## Phase 3 — Generate the Excel and collect responses (`0.new.instrument`)

```
# Generates the blank workbook -- GDX_SKILL_EXPORT_NEW_STUDY
cd 0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts
node export_new_study.js --study humildade-na-metafisica
# -> GDX_SKILL_EXPORT_NEW_STUDY_Humildade_na_Metafisica__humildade-na-metafisica.xlsx
```
**Human gate:** someone needs to actually fill in this workbook (at least 1
respondent) before Phase 4 — this cannot be simulated.

```
# Loads the filled-in responses -- GDX_SKILL_LOAD_NEW_STUDY_ANSWERS
cd 0.new.instrument/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_ANSWERS/scripts
node load_new_study_answers.js --file <filled_workbook.xlsx> --dry-run
node load_new_study_answers.js --file <filled_workbook.xlsx>
```
Writes: `GDX_PSY_PERSON`, `STUDY_PARTICIPANT`, `APPLICATION`,
`ITEM_RESPONSE`. **Note:** `GDX_PSY_VARIABLE_RESULT` (the per-dimension
score) is only written automatically if the formula is registered in
`SCORE_FORMULAS` — today only MBI-SS has one. We will need to add the
Intellectual Humility formula (reverse-score the reverse items + sum per
subscale) to that catalog before this step, or compute the 4 scores
manually.

## Phase 4 — Factor analyses and internal consistency (`2.relational.model.psychometrics`)

**Prerequisite:** real responses already loaded (Phase 3) — alpha is
computed from participants' responses, not from the item text; with no
real respondents in the database yet, there is nothing to compute.

```
cd 2.relational.model.psychometrics/.claude/skills/GDX_SKILL_MAKE_ANALYSES_CFA_EFA/scripts
node run_study_analyses.js --study humildade-na-metafisica
```
Routes the instrument to Track B (multi-item instrument):
`analyze_instrument.js` → `run_efa_generic.py` → `run_cfa_generic.py`. One
single command already covers the four things below — none of this is a
separate step:

### 4a. EFA + sampling adequacy (KMO, Bartlett)

`run_efa_generic.py` runs the exploratory factor analysis and, in the same
output, the KMO (sampling adequacy) and Bartlett's test of sphericity for
the whole 22-item scale — no dedicated flag, they come out together.

### 4b. CFA + correlation among the 4 dimensions

`run_cfa_generic.py` confirms the 4-factor structure (`HIindepEgo`,
`HIabertura`, `HIrespeito`, `HInaoconfi`) and computes the Pearson
correlation among them. Cross-referencing this with `ACconfianc`
(Confidence, from the CAAS) is a manual read of that output, not a
parameter of the skill.

### 4c. Internal consistency (Cronbach's alpha) — from the responses, not the questions

Computed over the real response matrix (one row per participant, one
column per item, the 1–5 value that person marked) — it is **not** a fixed
property of the item text; the same instrument can give a different alpha
in a different sample. Standard practice in both of the skill's tracks,
not specific to the student study:
- Track A (CAAS / `run_cfa_from_db.py`, hardcoded) computes a separate
  alpha for Concern/Control/Curiosity/Confidence — that's just the CAAS
  case, it doesn't generalize.
- **Track B (the track Intellectual Humility uses)** computes:
  - a **whole-scale** alpha (all 22 items together) in
    `run_efa_generic.py` — a crude number, computed before confirming
    which factor each item belongs to, so it's not the number that
    actually matters for evaluating the instrument (the CIHS is not
    unidimensional by theory — it's 4 correlated facets, not one thing);
  - **one alpha per subscale** in `run_cfa_generic.py` — one value for
    `HIindepEgo`, one for `HIabertura`, one for `HIrespeito`, one for
    `HInaoconfi` — **this is the number that actually evaluates each
    dimension**;
  - plus one combined alpha across all items included in the 4 factors.

All of them written automatically to `GDX_PSY_PSYCHOMETRIC_PROPERTY` (one
row per value, labeled "Internal consistency reliability (Cronbach
alpha)") when the command above runs — no extra flag or step needed.

## Phase 5 — Evaluate and list possible associations (DRAFT — to confirm)

Everything below is my own proposal, not validated — it needs your
confirmation (name + institution) before any real `INSERT`. No
cardiac-coherence variable is involved.

### 5a. Septenary Constitution (`GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS --target septenary`)

| Variable | Level | Confidence | Justification (draft) |
|---|---|---|---|
| `HIindepEgo` | #3 Astral Body | SPECULATIVE | This subscale's items are literally about an affective/ego reaction to being contradicted ("it feels like a personal attack") — emotional/affective domain, same level as `EmocNeg`/`EmocPos`. |
| `HInaoconfi` | #4 Lower Mental Body | SPECULATIVE | Concrete calibration of judgment about one's own knowledge vs. turning to others — same level as `HARDcontrole`/`ACcontrole`. |
| `HIabertura` | #5 Higher Mental Body | SPECULATIVE | Revising important beliefs is abstract value judgment, not a concrete reaction — same level as `ACcuriosid`. |
| `HIrespeito` | #6 Buddhic Body | SPECULATIVE | Recognizing validity in another person's viewpoint is an intuitive leap beyond discursive reasoning — same level as `ENGAGabsorc`/`HARDdesafio`. |

Commands (dry-run; `<id_var>` comes from Phase 2 once the variables exist):
```
node associate_variable.js --variable "HIindepEgo" --target septenary --level 3 \
  --behavior "Affective reaction of ego-threat/attack when one's own ideas are challenged" \
  --justification "This subscale's items describe a direct emotional reaction to disagreement -- affective domain, same level as EmocNeg/EmocPos" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run

node associate_variable.js --variable "HInaoconfi" --target septenary --level 4 \
  --behavior "Degree to which the person recognizes the limits of their own knowledge and turns to others" \
  --justification "Concrete calibration of one's own judgment -- same level as HARDcontrole/ACcontrole" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run

node associate_variable.js --variable "HIabertura" --target septenary --level 5 \
  --behavior "Willingness to revise important beliefs in light of new reasons" \
  --justification "Abstract value judgment about beliefs -- same level as ACcuriosid" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run

node associate_variable.js --variable "HIrespeito" --target septenary --level 6 \
  --behavior "Intuitive recognition of validity in the viewpoint of someone who disagrees" \
  --justification "Intuitive leap beyond discursive reasoning -- same level as ENGAGabsorc/HARDdesafio" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run
```

### 5b. Chakras (`--target chakra`)

Follows the ascending correspondence already established (chakra N ↔
septenary level N), so the chakras follow directly from the table above:
`HIindepEgo`→Manipura(3), `HInaoconfi`→Anahata(4), `HIabertura`→Vishuddha(5),
`HIrespeito`→Ajna(6).

```
node associate_variable.js --variable "HIindepEgo" --target chakra --chakra 3 \
  --behavior "..." --justification "Manipura governs personal power/ego -- the subscale's central theme" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run
# (repeat for HInaoconfi->chakra 4, HIabertura->chakra 5, HIrespeito->chakra 6)
```

### 5c. Thomas Aquinas's Five Ways (`--target way`) — only 2 of the 4, for honesty

A Way only exists at levels 4, 5, and 6 (level 7 was deliberately left
without one). Of `HIabertura`(5) and `HIrespeito`(6), only the latter has
a defensible thematic fit; `HInaoconfi`(4) I would leave **without** a
Way — forcing a weak fit would go against the project's own standard (see
the note on level 7 in `five_ways_septenary_map_firebird25.sql`).

| Variable | Way | Confidence | Justification |
|---|---|---|---|
| `HIrespeito` | Fifth Way (level 6) | MEDIUM | Same pattern as OT-7: recognizing order/validity in another's viewpoint mirrors recognizing order/finality in nature. |
| `HIabertura` | Fourth Way (level 5) | SPECULATIVE | Judging between "better/worse" beliefs echoes the Fourth Way's judgment of degrees of truth/goodness -- a weaker fit, flagged as speculative. |

```
node associate_variable.js --variable "HIrespeito" --target way --way 5 \
  --behavior "..." --justification "Mirrors OT-7: recognizing order/validity in another's viewpoint" \
  --confidence MEDIUM --confirmed-by "<your name>" --institution "<institution>" --dry-run

node associate_variable.js --variable "HIabertura" --target way --way 4 \
  --behavior "..." --justification "Judging degrees between beliefs echoes the Fourth Way -- speculative fit" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run
```

### 5d. Link to the Humility virtue (`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`)

Closes the loop: the 4 variables also become a row in
`GDX_VT_VARIABLE_VIRTUE_MAP`, pointing at `GDX_VT_VIRTUE` #1.

```
node associate_virtue.js --variable "HIindepEgo" --virtue 1 \
  --behavior "..." \
  --justification-deficit "Low score = reacts with ego-threat when challenged -- a lack of Humility" \
  --justification-strength "High score = no longer reacts with ego-threat -- Humility in exercise" \
  --confidence SPECULATIVE --confirmed-by "<your name>" --institution "<institution>" --dry-run
# (repeat for the other 3 variables)
```

## Phase 6 — Export to the Data Warehouse (`7.multidimensional.database`)

```
cd 7.multidimensional.database/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/scripts
node load_new_study_dw.js --study humildade-na-metafisica --dry-run
node load_new_study_dw.js --study humildade-na-metafisica
```

## Phase 7 — Dashboards (`8.gdx.dashboards`)

### 7a. The 9 existing ones (run as normal; 01 and 04 come out empty -- no cardiac coherence)

```
cd 8.gdx.dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts
node make_dashboards.js --study humildade-na-metafisica
```
Generates `dashboard_00_...` through `dashboard_08_...`, real filename:
`dashboard_NN_<name>__humildade-na-metafisica__humildade-na-metafisica__<timestamp>.html`.

### 7b. `dashboard_09_virtue_respondent_profile` — ✅ built and run (2026-10-16)

Built as `make_dashboard_09_respondent.js` in the same skill folder (not a
separate skill -- reuses `chart_lib.js`). Takes `--study <slug> [--person
<id-or-name>]` (omit `--person` to generate one file per participant in
one run); shows study name, the associated virtue (Humildade/Humility),
the respondent's name, their item-by-item answers, and their subscale
scores plotted against the study group's own mean/range (an honest
substitute for an individual EFA/CFA factor score, which does not exist
yet at n=4 -- see Phase 4).

Along the way, found and fixed a real `node-firebird` driver issue:
`blobAsText: true` hangs indefinitely once a result set has more than a
handful of BLOB rows (a concurrency bug in its own internal
`Promise.all`-based auto-resolution). Fixed by reading each
`STATEMENT_TEXT` blob manually and sequentially instead -- see the
skill's own `SKILL.md` for the pattern, kept for any future blob-touching
query here.

Run for all 4 current participants:
```
cd 8.gdx.dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts
node make_dashboard_09_respondent.js --study humildade-na-metafisica
```

### 7c. One single panel combining all 10 charts (0...9) — ✅ built and run (2026-10-16)

Built as `make_master_panel.js` (same skill folder). Combines every
dashboard (00-09, one `<iframe>` per panel, each labeled with the skill(s)
responsible) with a Phase 1-9 retrospective: registration, data
collection, factor analysis/alpha, metaphysical/virtue associations, the
DW load, the live Neo4j export state (queried fresh via `neo4j-driver`),
and the link-prediction model's latest suggestions (read from its most
recent report). Read-only -- never re-runs or rewrites anything it
reports on.
```
node make_master_panel.js --study humildade-na-metafisica
```

## Phase 8 — Export to the graph (`9.knowledge.graph`) — ✅ run for real (2026-10-16)

```
cd 9.knowledge.graph/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_BY_SPU/scripts
node export_graph.js --study humildade-na-metafisica --dry-run
node export_graph.js --study humildade-na-metafisica
```
`introspect.js` already gained the `GDX_VT_*` prefix in its scoped-table
list (it used to cover only `GDX_PSY_*`, `GDX_TA_*`, `GDX_CC_*`,
`DW_DIM_*`/`DW_FACT_*`). Validated with a real `--dry-run`: `GDX_VT_VIRTUE`
(33 rows) and `GDX_VT_VARIABLE_VIRTUE_MAP` (17 rows, 2 FKs) already show up
as `[global]` tables (catalog, not per-study) — 58 tables and 77 FK
relationships in scope now in total, with no extra code beyond the prefix
list, because the exporter was already schema-introspection-driven.

## Phase 9 — Update the link-prediction model (`10.gdx.machine.learning`) — ✅ run for real (2026-10-16)

Decision made: **Model 1 itself was extended** (no separate Model 2 was
created) — `link_prediction.js` now trains and predicts **two**
independent targets over the same graph projection/embeddings:
`MAPS_TO_LEVEL` (variable↔septenary level, as before) and `MAPS_TO_VIRTUE`
(variable↔virtue, new). Each target has its own classifier (its own
positives/negatives — a variable can be mapped on one target and not the
other), but they share embeddings, the two-track design (A = AUCPR metric,
B = in-process classifier), and the same `--dry-run` gate (no real write
in simulation mode, for either target).

Already validated against the real Neo4j (`--study 1`): materialized 17
`MAPS_TO_VIRTUE` edges (one per `GDX_VT_VARIABLE_VIRTUE_MAP` row), trained
the virtue classifier (17 positives + 17 sampled negatives), AUCPR ≈0.75,
and produced virtue suggestions for the 15 psychometric variables that
still have no associated virtue. Along the way I also fixed a real bug:
with zero edges (the very first run, before any `MAPS_TO_VIRTUE` exists),
the classifier used to crash — it now detects that case and reports "not
available" instead of crashing.

```
cd 10.gdx.machine.learning/.claude/skills/GDX_SKILL_GODATAX_HUMAN7_LINK_PRED/scripts
node link_prediction.js --study humildade-na-metafisica --dry-run
node link_prediction.js --study humildade-na-metafisica
```
Prerequisite (same as Phase 8): `GDX_SKILL_GODATAX_HUMAN7_BY_SPU --study
humildade-na-metafisica` must have run first, so the new variables
(`HIindepEgo`, etc.) and their associations exist in the graph.

---

## Summary of what is "run an existing skill" vs. "develop before running"

| Phase | Skill | Status |
|---|---|---|
| 2 | `GDX_SKILL_NEW_STUDY` / `GDX_SKILL_RECORD_NEW_STUDY` | exists |
| 3 | `GDX_SKILL_EXPORT_NEW_STUDY` / `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` | exists (requires a human gate: filling in the workbook) |
| 4 | `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` | exists |
| 5 | `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` / `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` | exists |
| 6 | `GDX_SKILL_LOAD_NEW_STUDY_DW` | exists |
| 7a | `GDX_SKILL_MAKE_DASHBOARS_DW` | exists |
| 7b | per-respondent dashboard | **new** |
| 7c | single combined panel + per-step skill label | **new** |
| 8 | `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` | ✅ exists, scope extension (`GDX_VT_*`) already done and validated |
| 9 | `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED` | ✅ exists, extended to also predict virtue, validated against the real Neo4j |

## Next step

This document is the plan — nothing has been executed. I propose going
phase by phase, starting with Phase 2 (the `GDX_SKILL_NEW_STUDY`
interview) once you confirm the 4 variables and their `.sav` names from
Phase 1, and review Phase 5's draft associations before I run any real
`INSERT`.
