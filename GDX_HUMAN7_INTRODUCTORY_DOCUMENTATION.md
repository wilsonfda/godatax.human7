# GDX_HUMAN 7 — Introductory Documentation

> Generated on 2026-09-19, from reading all the main `.md` documents, SQL/DDL scripts, and
> automation `SKILL.md` files present in each of this repository's 13 numbered folders. This
> document is the entry point for anyone arriving at the project for the first time — each
> section points to the most detailed document(s) on the subject.

## 1. What this project is

**GDX_HUMAN 7** (GoDataX Human) is a research and data-engineering project that starts from
**one real psychometric study** — *"Predictors of Adaptability to Military Higher Education,"*
applied to 423 cadets of the Military Academy — and expands it in several directions:

1. **Rigorous relational modeling** of the raw psychometric data (item-by-item responses,
   dimension scores, instruments, constructs) in a Firebird 2.5 database.
2. **Interpretive/qualitative bridges** between that scientific base and four distinct
   philosophical/esoteric traditions — the theosophical Septenary Constitution, the 7 Kundalini
   chakras, Aquinas's Five Ways, and "Virtology" (a neuro-philosophical system of 33 virtues) —
   always making it explicit that these bridges are **conceptual readings**, not statistical
   findings.
3. **Physiological data** (cardiac coherence / HRV) linked to the same person identity as the
   psychometric study.
4. **An analytical layer** (star-schema data warehouse) that unifies all these perspectives for
   cross-perspective querying.
5. **A knowledge graph** (Neo4j) mirroring the entire relational schema, serving as the
   substrate for two graph machine-learning models (link prediction, community detection) and
   for an LLM assistant.
6. **A repeatable pipeline** to onboard **new** studies/instruments from scratch — the original
   423-cadet study was loaded once, by hand; any future study goes through a generic skill
   pipeline (interview → SQL generation → load → questionnaire export → answer load).

Practically all of the project's automation is implemented as **Claude Code skills**
(`.claude/skills/` inside each folder), each with its own `SKILL.md`. The general pattern is
**"generate, then execute"**: a Python or Node.js script reads the data source and generates
SQL, a second script executes that SQL against Firebird (with `--dry-run` always available
before the real run).

## 2. The source data, in one sentence

An IBM SPSS file (`.sav`) with no embedded metadata at all (no variable labels, no value
labels) — the entire meaning of the columns (`AC1`, `Ha7`, `ENGAGvigor`...) had to be
reconstructed from supporting documents (`.pptx`/`.docx`, no longer present in the repository)
and is documented in `2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` and in
`1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md`. **423
respondents, 159 columns** — 137 raw items from 9 instruments, 1 context variable (`ano`), and
20 computed scores.

## 3. Folder map

```
GDX_HUMAN7/
  0.new.instrument/              <- generic pipeline to onboard a NEW study
  1.output.ibm.spss.statistics/  <- the original .sav + its data documentation
  2.relational.model.psychometrics/  <- the GDX_PSY_* schema (core of everything) + the already-loaded study
  3.septenary.constitution/      <- interpretive bridge: instruments × 7 theosophical bodies/principles
  4.kundalini.chakras/           <- interpretive bridge: 7 chakras × septenary constitution
  5.five.ways.tomas.aquino/      <- interpretive bridge: Aquinas's 5 ways × septenary constitution
  6.cardiac.coherence/           <- physiological data (ECG/HRV) linked to the same person
  7.multidimensional.database/   <- data warehouse (star schema) unifying folders 2-6
  8.gdx.dashboards/              <- 8 self-contained HTML dashboards reading the DW
  9.knowledge.graph/              <- export of the entire relational schema to Neo4j
  10.gdx.machine.learning/       <- 2 graph ML models (link prediction, community detection)
  11.gdx.llm.agent.mcp/          <- system prompt for the LLM assistant over the knowledge graph
  12.gdx.virtology/              <- knowledge base of the 33 virtues + treatment suggestions
```

The numbering broadly reflects dependency order: each folder consumes data from lower-numbered
folders (folder 7's DW reads folders 2–6; folder 8's dashboards read folder 7; folder 9's graph
reads folders 2–7; folder 10's ML reads folder 9).

## 4. Folder by folder

### 4.1 `0.new.instrument/` — Onboarding a new study from scratch

Four chained skills, documented in detail in `New_Instrument_Onboarding_Process.md`:

```
GDX_SKILL_NEW_STUDY            conversational interview -> new_study_intake/<slug>/intake.json
        |
GDX_SKILL_RECORD_NEW_STUDY     generates SQL from intake.json + executes it against Firebird
        |
GDX_SKILL_EXPORT_NEW_STUDY     reads Firebird -> generates a blank .xlsx questionnaire
        |
   (send one copy per participant, wait for the filled-in return)
        |
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS   reads ONE filled-in .xlsx -> writes answers into Firebird
```

Unlike the historical study (loaded once, by hand, via `GDX_SKILL_LOAD_RLT_MODEL_DB`), this
pipeline is **generic**: it never hardcodes IDs (it uses Firebird `BEFORE INSERT` triggers),
never invents a field the user doesn't know how to answer, and never duplicates an already
registered study. **Filled-in** `.xlsx` files (real participant data) must never be committed —
only `intake.json` and the generated SQL.

### 4.2 `1.output.ibm.spss.statistics/` — The source data

The `.sav` file of the historical study (423 cadets) and its complete documentation
(identified instruments, descriptive statistics per variable, known gaps) — see §2 above.

### 4.3 `2.relational.model.psychometrics/` — The core: `GDX_PSY_*` schema

The heart of the project: `psychometrics_model_firebird25.sql` defines the complete relational
schema (study → instrument → construct → variable/indicator → item → response alternative →
application → response → calculated result). Two central documents:

- `SPSS_to_Firebird_Mapping.md` — the full reasoning behind how the `.sav` was mapped to this
  schema, including the high-confidence instruments (Hardiness, CAAS, Engagement, SWLS...) and
  the blocks still not identified with certainty (`ef1-18`, `an1-11`, `red1-5`).
- `RLT_Model_Load_and_CFA_EFA_Analyses.md` — documents `GDX_SKILL_LOAD_RLT_MODEL_DB` (loads the
  `.sav` into Firebird) and `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` (runs the same confirmatory/
  exploratory factor analyses of the Career Adapt-Abilities Scale, but from the database instead
  of the `.sav`, as proof that the two agree).

`analyses.CFA/` and `analyses.EFA/` hold the original analyses (`.sav`-sourced);
`samples.SQL/` holds the 11 SQL scripts that actually loaded the study and its factor-analysis
results into the database.

### 4.4 `3.septenary.constitution/`, `4.kundalini.chakras/`, `5.five.ways.tomas.aquino/` — Interpretive bridges

Three documents with the same structure and the same explicit methodological warning at the
top: **this is a qualitative/conceptual reading, not a statistical finding or a scientific
validation.**

| Folder | What it relates | Schema table |
|---|---|---|
| `3.septenary.constitution` | The .sav's 21 instruments/dimensions × the 7 "bodies" of the theosophical Septenary Constitution (Physical → Vital → Astral → Concrete Mental → Abstract Mental → Buddhic → Atmic) | `GDX_PSY_SEPT_LEVEL_PSY_MAP` |
| `4.kundalini.chakras` | The 7 chakras × the same 7 septenary levels (1:1 ordinal correspondence) | `GDX_PSY_CHAKRA` |
| `5.five.ways.tomas.aquino` | Aquinas's 5 cosmological ways (*Summa Theologica* I, Q.2, Art.3) × the same 7 levels (only 3 levels have a corresponding way) | `GDX_TA_WAY`, `GDX_TA_WAY_SEPT_MAP` |

Each correspondence carries a textual justification and, in the case of the Five Ways, a
confidence level (`HIGH`/`MEDIUM`/`SPECULATIVE`). `GDX_SKILL_LOAD_SEPT_MAPS_DB` keeps the
mapping in sync as new studies are onboarded (keyed by variable name when there is no `.sav`
column, by `.sav` column name when there is).

### 4.5 `6.cardiac.coherence/` — Physiological data (ECG/HRV)

`GDX_CC_*` schema for capturing cardiac coherence with the ECG/HRV device (PDF manuals
included). Central point documented in `GDX_CC_Psychometrics_Person_Mapping.md`:
**`GDX_CC_PERSON` is not a parallel person catalog** — its `ID_PERSON` is a direct FK to
`DW_DIM_PERSON`/`GDX_PSY_PERSON`, the same identity used on the psychometric side. What remains
to be associated is not the person, it's the **study** (`GDX_PSY_STUDY_PARTICIPANT`), the role
of `GDX_SKILL_LOAD_CC_MAPS_DB`.

### 4.6 `7.multidimensional.database/` — The Data Warehouse

Star schema (11 dimensions + 3 facts) unifying the 5 OLTP perspectives (psychometrics,
septenary, chakras, five ways, cardiac coherence) into a single cross-querying point.
Documented in `GoDataX_Human_7_DW.md`. Central design rule: **`GDX_PSY_PERSON` is the only
person table** — `DW_DIM_PERSON` is derived solely from it, and a database FK
(`FK_GDX_CC_PERSON_DW_PERSON`) now physically prevents an "orphan" cardiac-coherence person.

Two load modes:
- `godatax_human_dw_etl_firebird25.sql` — full ETL, from scratch (used once).
- `GDX_SKILL_LOAD_NEW_STUDY_DW` — incremental per-study load, *insert-if-missing*, never
  truncates data from another already-loaded study.

### 4.7 `8.gdx.dashboards/` — 8 self-contained HTML charts

Generated by `GDX_SKILL_MAKE_DASHBOARS_DW` reading the DW, scoped by `--study <slug>`.
Documented in detail (including the reading of every real number) in
`Dashboards_DW_Explanation.md`:

1. Physiological response (line, 4 series indexed to baseline)
2. Average score per septenary level (bars)
3–6. Heatmaps (instrument × septenary level / cardiac coherence / chakra / five ways)
7. Gradient portrait of the 7 chakras
8. Gradient portrait of the septenary constitution

Each file opens directly in the browser, no server needed. Naming convention includes the study
slug and a timestamp, so a previous run is never overwritten.

### 4.8 `9.knowledge.graph/` — Export to Neo4j

`GDX_SKILL_GODATAX_HUMAN7_BY_SPU` turns the entire Firebird schema (55 tables in scope, 70 FKs)
into a Neo4j property graph — **one node per table, one edge per FK**, discovered dynamically
via introspection of Firebird's `RDB$` catalog (not a manual table-by-table mapping). Scoped by
`--study <slug>` since 2026-09-18; shared catalog/reference tables are always exported in full.
Documented in `GoDataX_Human_7_Knowledge_Graph.md`.

### 4.9 `10.gdx.machine.learning/` — Two graph ML models

Documented in `Septenary_Link_Prediction_and_Community_Detection.md` (full design) and
`Data_Science_Workflow_Canvas.md` (canvas summary):

- **Model 1 — Link prediction** (`GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`): FastRP embeddings +
  a classifier trained on the 18–19 already-existing variable→level mappings, suggests the 3
  most likely candidate levels for each still-unmapped variable. **Triage for human review
  only, never writes automatically.** Explicitly assumed central risk: small training set
  (N≈19).
- **Model 2 — Community detection** (`GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT`): Louvain
  (unsupervised) + cross-check with Label Propagation, comparing structural clusters against
  the already-assigned septenary/chakra labels. Already run for real (9 communities), with real
  structural confirmations of several existing mappings.

Both read **only Neo4j**, never Firebird directly.

### 4.10 `11.gdx.llm.agent.mcp/` — LLM assistant over the graph

A single file, `prompt.instruction.txt`: the system prompt of an assistant connected to the
Neo4j graph, with explicit rigor rules (never invent data, clearly distinguish between empirical
data/calculated indicator/psychological interpretation/philosophical-metaphysical
interpretation/traditional-energetic model, never present a metaphysical correspondence as a
scientifically validated causal relation, never diagnose).

### 4.11 `12.gdx.virtology/` — The 33 virtues and treatment suggestions

`Virtology_Knowledge_Base.md` captures Eduardo Casarotto's "Virtology" system — 33 ordered virtues, with Humility as the declared foundation,
plus two hypothetical primitive neural systems (SNO/SNE) the virtues are claimed to neutralize.
`GDX_SKILL_LINK_SUGGESTIONS` uses this base, together with a project-authored
**variable→virtue** map (distinct from, and narrower than, virtue→neural-system, which remains
an open gap), to generate reports ranking a study's lowest psychometric indicators and
suggesting which virtue addresses them — never inventing a suggestion for a variable with no
entry in the map (reported as *"no suggestion (review)"*).

## 5. Common thread: a single person identity

A design decision cuts across folders 2, 6, 7, and 9: **there is a single person identity
across the whole project**, `GDX_PSY_PERSON.ID_PERSON`. `DW_DIM_PERSON` is a faithful copy of
it; `GDX_CC_PERSON.ID_PERSON` is a direct FK to it (not a parallel catalog); the Neo4j graph
inherits the same id as `gdx_key`. Today only one person (`SPSS-784`) has both psychometric and
cardiac-coherence data — which limits what the dashboards/ML can show about the intersection of
the two sources, but the architecture is already ready for more.

## 6. Methodological discipline common to the whole project

Several documents repeat, in different ways, the same principles — worth naming once:

- **Never invent missing data.** A gap is always documented as a gap (see §3 of
  `SPSS_to_Firebird_Mapping.md`, or the *"no suggestion (review)"* mark in `12.gdx.virtology`),
  never filled in with a guess.
- **"Not zero, not absent, structurally non-existent."** A phrase repeated in
  `Dashboards_DW_Explanation.md` for heatmap cells with no mapped instrument — the same
  reasoning applies to any relation that simply does not exist in the schema.
- **Empirical finding ≠ interpretive reading.** Folders 3–5 and 12 are explicit: relating a
  scientific instrument to a chakra or to a virtue is a conceptual organizing tool within
  GoDataX, not a scientific or doctrinal claim.
- **Secrets are never committed.** Every skill that accesses Firebird/Neo4j uses environment
  variables (`.env`, never committed — only `.env.example`).
- **Idempotency and reversibility.** Almost every skill that writes to the database has
  `--dry-run`, an "already loaded" guard (to avoid duplication), and never deletes data — even
  when "fixing" something (see the Physical-level gap case in `Dashboards_DW_Explanation.md`
  §11, resolved by reading already-existing real responses, not by inserting a made-up number).

## 7. Where to go next

| If you want to... | Read |
|---|---|
| Understand the historical study's raw data | `1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md` |
| Understand the central relational schema | `2.relational.model.psychometrics/psychometrics_model_firebird25.sql` + `SPSS_to_Firebird_Mapping.md` |
| Onboard a new study | `0.new.instrument/New_Instrument_Onboarding_Process.md` |
| Understand the philosophical bridges | `3.septenary.constitution/SPSS_Septenary_Constitution_Mapping.md` (read first — the other two reference it) |
| See the study's real numbers as charts | `8.gdx.dashboards/Dashboards_DW_Explanation.md` |
| Understand the knowledge graph and the ML | `9.knowledge.graph/GoDataX_Human_7_Knowledge_Graph.md` + `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` |
| Run any automation | the specific skill's `SKILL.md`, inside `<folder>/.claude/skills/<name>/` |
