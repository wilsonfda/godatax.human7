# GDX_HUMAN 7 — Introductory Documentation

> Generated on 2026-09-19, from reading all the main `.md` documents, SQL/DDL scripts, and
> automation `SKILL.md` files present in each of this repository's numbered folders. Updated
> 2026-11-06 to cover all **15** numbered folders and all **24** skills now in the repository —
> the three folders added since September (`13.onboarding.env/`, a local Firebird bootstrap;
> `14.metaphysical.measuring.instrument/`, the OT-7 instrument plus generic association skills;
> `15.environmental.anomalous.phenomena/`, a `GDX_PH_*` schema, DDL only, no skill yet), plus new
> skills added to already-documented folders. Updated again 2026-11-07 for several schema
> extensions that had landed in `*.sql` files but not yet in either document's own description of
> a folder's tables: `GDX_PSY_CHAKRA_VAR_MAP` (a brand-new table, §4.5), confirmation-tracking
> columns on every `"_MAP"` table (§4.4/§4.13), `GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY` and a
> partial `GDX_PSY_INDICATOR`/`INDICATOR_ITEM` backfill for Study 1 (§4.3/§4.11). Updated again
> 2026-11-16 to cover **16** numbered folders and **25** skills: the brand-new
> `16.hypotheses.non.fingo/`, a mathematical-model layer over this project's existing data
> (feature spaces, and later latent representations/distances/the CDI/trajectories/knowledge-graph
> relations/the Virtology layer), starting with its first skill,
> `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE` (MFS). This
> document is the entry point for anyone arriving at the project for the first time — each section points to
> the most detailed document(s) on the subject (chiefly `GDX_HUMAN7_DEVELOPMENT_KIT.md`, the full
> reference, which now carries full ER diagrams for every table named here).

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
  13.onboarding.env/             <- local Firebird bootstrap (GDS32.DLL direct) + web-sync skill
  14.metaphysical.measuring.instrument/  <- OT-7 instrument + generic cross-framework association skills
  15.environmental.anomalous.phenomena/  <- GDX_PH_* schema for environmental/anomalous sensing (DDL only, no skill yet)
  16.hypotheses.non.fingo/        <- mathematical-model layer (feature space, F1-F8) over folders 2-9
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

Two more skills round out this folder: `GDX_SKILL_GENERATE_GOOGLE_FORM` /
`GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` are an alternative collection path to the `.xlsx` flow
above — they create a real Google Form via the Forms API and later pull answers back through
it, resolving each one against a saved `google_form_map.json`. `GDX_SKILL_DELETE_STUDY` is the
reverse of the whole pipeline — it permanently removes one study and everything exclusive to it
(participants, responses, results, cardiac-coherence sessions, DW rows, graph nodes, dashboard
files) while always keeping shared catalog data (instruments, items, constructs) intact for
reuse by other studies; always run with `--dry-run` first.

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

Two later, narrower scripts extend this base: `google_form_instrument_field_firebird25.sql` adds
a `GOOGLE_FORM_INFO` column to `GDX_PSY_INSTRUMENT` (a permanent home for the Google Forms skill's
output, §4.1), and `study1_indicator_backfill_partial_firebird25.sql` fills in
`GDX_PSY_INDICATOR`/`GDX_PSY_INDICATOR_ITEM` for the 5 single-index/already-documented instruments
where no item-to-dimension judgment call needed to be invented — the other 6 instruments
(Hardiness, Engagement, CAAS, two low-confidence blocks, Red Tape) are deliberately left
unbackfilled, their split still genuinely unknown.

### 4.4 `3.septenary.constitution/`, `4.kundalini.chakras/`, `5.five.ways.tomas.aquino/` — Interpretive bridges

Three documents with the same structure and the same explicit methodological warning at the
top: **this is a qualitative/conceptual reading, not a statistical finding or a scientific
validation.**

| Folder | What it relates | Schema table |
|---|---|---|
| `3.septenary.constitution` | The .sav's 21 instruments/dimensions × the 7 "bodies" of the theosophical Septenary Constitution (Physical → Vital → Astral → Concrete Mental → Abstract Mental → Buddhic → Atmic) | `GDX_PSY_SEPT_LEVEL_PSY_MAP` |
| `4.kundalini.chakras` | The 7 chakras × the same 7 septenary levels (1:1 ordinal correspondence), plus instruments/variables × chakra directly | `GDX_PSY_CHAKRA`, `GDX_PSY_CHAKRA_VAR_MAP` |
| `5.five.ways.tomas.aquino` | Aquinas's 5 cosmological ways (*Summa Theologica* I, Q.2, Art.3) × the same 7 levels (only 3 levels have a corresponding way) | `GDX_TA_WAY`, `GDX_TA_WAY_SEPT_MAP` |

Each correspondence carries a textual justification and, in the case of the Five Ways, a
confidence level (`HIGH`/`MEDIUM`/`SPECULATIVE`). `GDX_SKILL_LOAD_SEPT_MAPS_DB` keeps the
mapping in sync as new studies are onboarded (keyed by variable name when there is no `.sav`
column, by `.sav` column name when there is). `GDX_PSY_CHAKRA_VAR_MAP` is a later addition
(`14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql`), written
for `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` (§4.13) since the 7-row `GDX_PSY_CHAKRA` catalog had
no mapping columns of its own to extend in place. All four of these `"_MAP"`/association tables
also carry a `NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` trio (added by
`confirmation_fields_association_maps_firebird25.sql`), tracking independent human corroboration
of a correspondence separately from its self-assessed `CONFIDENCE_LEVEL` — see
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §4 for the full ER diagrams.

### 4.5 `6.cardiac.coherence/` — Physiological data (ECG/HRV)

`GDX_CC_*` schema for capturing cardiac coherence with the ECG/HRV device (PDF manuals
included). Central point documented in `GDX_CC_Psychometrics_Person_Mapping.md`:
**`GDX_CC_PERSON` is not a parallel person catalog** — its `ID_PERSON` is a direct FK to
`DW_DIM_PERSON`/`GDX_PSY_PERSON`, the same identity used on the psychometric side. What remains
to be associated is not the person, it's the **study** (`GDX_PSY_STUDY_PARTICIPANT`), the role
of `GDX_SKILL_LOAD_CC_MAPS_DB`.

### 4.6 `7.multidimensional.database/` — The Data Warehouse

Star schema (12 dimensions + 3 facts, plus 3 virtue/chakra/way bridge tables added since
September) unifying the 5 OLTP perspectives (psychometrics, septenary, chakras, five ways,
cardiac coherence) into a single cross-querying point. Documented in `GoDataX_Human_7_DW.md`.
Central design rule: **`GDX_PSY_PERSON` is the only person table** — `DW_DIM_PERSON` is derived
solely from it, and a database FK (`FK_GDX_CC_PERSON_DW_PERSON`) now physically prevents an
"orphan" cardiac-coherence person.

Two load modes:
- `godatax_human_dw_etl_firebird25.sql` — full ETL, from scratch (used once).
- `GDX_SKILL_LOAD_NEW_STUDY_DW` — incremental per-study load, *insert-if-missing*, never
  truncates data from another already-loaded study.

### 4.7 `8.gdx.dashboards/` — Self-contained HTML charts

Generated by `GDX_SKILL_MAKE_DASHBOARS_DW` reading the DW, scoped by `--study <slug>`. Grown
from the original 8 to **9 aggregate chart types (00–08)** plus two added since September:
chart **09**, a per-respondent virtue profile (one file per participant), and chart **10**, a
combined master panel delegated to `make_master_panel.js`. `--chart <code>` generates just one
chart instead of all of them. Documented in detail (including the reading of every real number)
in `Dashboards_DW_Explanation.md`:

00. Means of psychometric responses (small multiples, incl. factor-analysis properties)
01. Physiological response (line, 4 series indexed to baseline)
02. Average score per septenary level (bars)
03–06. Heatmaps (instrument × septenary level / cardiac coherence / chakra / five ways)
07. Gradient portrait of the 7 chakras
08. Gradient portrait of the septenary constitution
09. Virtue respondent profile (one file per participant)
10. Master panel (all charts combined, via `--chart 10`)

Each file opens directly in the browser, no server needed. Naming convention includes the study
slug and a timestamp, so a previous run is never overwritten.

### 4.8 `9.knowledge.graph/` — Export to Neo4j

`GDX_SKILL_GODATAX_HUMAN7_BY_SPU` turns the entire Firebird schema (55 tables in scope, 70 FKs)
into a Neo4j property graph — **one node per table, one edge per FK**, discovered dynamically
via introspection of Firebird's `RDB$` catalog (not a manual table-by-table mapping). Scoped by
`--study <slug>` since 2026-09-18; shared catalog/reference tables are always exported in full.
Documented in `GoDataX_Human_7_Knowledge_Graph.md`.

Two more skills live here: `GDX_SKILL_CREATE_SPU_AGENT` guides setting up (or confirming) the
Neo4j Aura Agent for this graph — since Aura has no management API for an Agent's config
(console-UI only), it checks instance connectivity and then walks a human through the console
steps, never fabricating a "created" result it cannot verify. `GDX_SKILL_UPDATE_WEB` pushes the
instrument/construct/variable/item catalog and every cross-framework mapping table (septenary,
chakra, Five Ways, virtue, DW bridges) from the local onboarding database (`13.onboarding.env/`)
to the shared `firebird.godatax.com` database — participant data is never touched.

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
an open gap), to generate reports ranking a study's lowest (needier) psychometric indicators and
suggesting which virtue addresses them — never inventing a suggestion for a variable with no
entry in the map (reported as *"no suggestion (review)"*). `GDX_SKILL_IDENTIFY_VIRTUES` is its
polarity-aware mirror: it looks at a study's **strongest** indicators instead and prints (never
writes a file) which virtues are potentially already present as strengths.
`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` records one new variable→virtue association at a
time (or corroborates/corrects an existing one), always asking for both justification framings,
the scale polarity, a confidence level, and who is confirming it — never inventing any of them.

The two tables behind all three skills, `GDX_VT_VIRTUE` (the 33-virtue catalog) and
`GDX_VT_VARIABLE_VIRTUE_MAP` (`12.gdx.virtology/virtology_model_firebird25.sql`), are the
database-backed replacement for what used to be two hand-written, duplicate `virtue_knowledge.js`
copies. `GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY` (`POSITIVE`/`NEGATIVE`, added by
`12.gdx.virtology/variable_virtue_map_polarity_firebird25.sql`) is what lets
`GDX_SKILL_IDENTIFY_VIRTUES` read a negative-pole variable's *low* score — not its high one — as
the strength (today, only `EmocNeg`/Negative Emotions is flagged `NEGATIVE`). See
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §4 Step 12 for the full ER diagram.

### 4.12 `13.onboarding.env/` — Local Firebird bootstrap

A standalone path with no Firebird Server/wire protocol: `GDX_SKILL_UP_FIREBIRD_DB` builds
`GODATAX7HPH.GDB` directly via `GDS32.DLL` (P/Invoke against the Firebird C API) from
`godatax_human_full_ddl_no_gdx_ead_firebird25.sql`, driven by `OnBoard_GDXH7ph.ps1`/`.bat`, and
documented step-by-step in `on.bording.txt`. This is also where `GDX_SKILL_UPDATE_WEB` (§4.8)
reads from when pushing the catalog to the shared web database.

### 4.13 `14.metaphysical.measuring.instrument/` — The OT-7 instrument + generic associations

`OT7_Instrumento_Metafisico.md` documents a new metaphysical measuring instrument (OT-7). Two
skills here are **generic**, cutting across every interpretive bridge in the project rather than
being tied to one: `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` records one variable's association
to a Septenary level, a Way of Aquinas, or a Kundalini chakra (the non-Virtology sibling of
`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` in §4.11), and `GDX_SKILL_LIST_ASSOCIATIONS` lists
every conceptual/interpretive association the whole framework currently claims — chakra↔level,
Five Ways↔level, variable↔level, variable↔virtue — as a catalog-wide audit, not scoped to any
one study.

### 4.14 `15.environmental.anomalous.phenomena/` — `GDX_PH_*` schema (DDL only, no skill yet)

`environmental_anomalous_phenomena_model_firebird25.sql` defines 15 new tables (`GDX_PH_LOCATION`,
`SENSOR_TYPE`, `SENSOR`, `SESSION`, `EVENT`, `INTERPRETATION`, …) for environmental
and anomalous-phenomena sensing, documented in
`GDXH7ph_Technical_Specification_for_Environmental_and_Anomalous_Phenomena.md`. Each `GDX_PH_*`
table has a nullable FK to `GDX_PSY_PERSON`, following the project's one-person-identity rule
(§5). As of this pass there is **no onboarding/loader skill yet** and `GDX_PH_SESSION` has no
`ID_STUDY` column, so this schema is not yet wired into the Data Warehouse or the knowledge
graph — see `GDX_HUMAN7_DEVELOPMENT_KIT.md` §12 for the full gap analysis.

### 4.15 `16.hypotheses.non.fingo/` — Mathematical-model layer (feature space today)

This is a from-scratch, project-authored mathematical model defining eight functions F1–F8 over a
per-person feature space `x(t) = [Ψ, Φ, N, B, A, C, E, M]` — this folder is a different kind of addition than 13–15:
not a new data-collection domain, but a layer that *reads* folders 2–9 for one study at a time and
writes its own derived results into its own schema, never back into any source table. Only F1
("Normalização e comparabilidade") is implemented so far, by
`F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE` (MFS), against
`hypotheses_non_fingo_feature_space_model_firebird25.sql` (`GDX_HNF_PERSPECTIVE`,
`GDX_HNF_FEATURE_DICTIONARY`, `GDX_HNF_FEATURE_SPACE_RUN`/`GDX_HNF_FEATURE_RUN_MEMBER`,
`GDX_HNF_FEATURE_VALUE`/`GDX_HNF_NORMALIZATION_PARAM`). It assembles a per-person vector from
every perspective with real operationalized data today (Ψ psychometrics, Φ physiology),
normalizes it (z-score/min-max/robust) against that one run's own frozen parameters, and flags
missing data explicitly rather than inventing it — **it never turns a metaphysical category (M)
into a feature**, matching the source document's own repeated epistemological caveat. Every run
is an immutable, versioned snapshot; later skills in this folder (F2–F8: latent representations,
distance/similarity, the Curvature Depth Index, reference baselines, temporal trajectories,
Knowledge Graph relations, the Virtology layer) will add their own tables on top of it, not
reopen this one. See `GDX_HUMAN7_DEVELOPMENT_KIT.md` §4 Step 16 / §5 for the full detail.

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
| Bootstrap a local Firebird database from scratch | `13.onboarding.env/on.bording.txt` |
| Understand the OT-7 instrument and cross-framework associations | `14.metaphysical.measuring.instrument/OT7_Instrumento_Metafisico.md` |
| Understand the proposed/implemented environmental & anomalous phenomena schema | `15.environmental.anomalous.phenomena/GDXH7ph_Technical_Specification_for_Environmental_and_Anomalous_Phenomena.md` |
| Understand the mathematical-model layer (feature space, and later F2-F8) | `16.hypotheses.non.fingo/.claude/skills/F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE/SKILL.md` |
| Run any automation | the specific skill's `SKILL.md`, inside `<folder>/.claude/skills/<name>/` |
| Get the full engineering reference (every skill, every schema) | `GDX_HUMAN7_DEVELOPMENT_KIT.md` |
