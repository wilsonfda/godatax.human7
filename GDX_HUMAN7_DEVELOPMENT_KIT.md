# GDX_HUMAN 7 — Developer Kit

> Generated 2026-09-22, from a direct read of every `.md` document, `SKILL.md` file, and
> `*.sql` DDL/DML script in this repository, plus slides 84–90 of
> `GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataXHuman7-Br2.odp`. Updated 2026-11-06, from a fresh
> direct read of every `SKILL.md` across all 15 numbered folders (24 skills in total today) plus
> the new material added since September — `13.onboarding.env/` (local Firebird bootstrap +
> web-sync), `14.metaphysical.measuring.instrument/` (OT-7 instrument + generic association
> skills), the DW's new virtue/chakra/way bridge tables, the dashboard skill's growth to 11
> chart types, and the as-yet-skill-less `15.environmental.anomalous.phenomena/` schema. Updated
> again 2026-11-07, from a repo-wide sweep of every `*.sql` file against the ER diagrams already
> in this document, to catch schema extensions that were applied to the database but never
> reflected back into a diagram: `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO`, the
> `NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` trio on all four `"_MAP"`
> association tables, the brand-new `GDX_PSY_CHAKRA_VAR_MAP` table, `GDX_TA_WAY_SEPT_MAP`'s
> instrument/variable/behavior columns, `GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY` (now with its
> own ER diagram, previously missing one unlike every other interpretive bridge), and the
> `study1_indicator_backfill_partial_firebird25.sql` partial backfill. Updated again 2026-11-16,
> for the brand-new `16.hypotheses.non.fingo/` module: a from-scratch, project-authored
> multidimensional feature-space mathematical model, implemented one function at a time, starting
> with `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE` (MFS; F1 — feature-space assembly and normalization) and its
> `GDX_HNF_*` schema. This is the single entry point for a developer joining the project: what it
> is, how the pieces fit together, how to run every automation, and what each relational schema
> looks like.

## Repository

```
https://github.com/wilsonfda/godatax.human7.git
```

Main branch: `master`. There is no CI pipeline and no build step — this is a documentation +
SQL + Node.js/Python automation repository, not a compiled application. Every numbered
top-level folder is close to self-contained (its own `.claude/skills/`, its own `.md` docs,
its own `.sql`), which is why the folders are numbered in dependency order rather than grouped
by language or layer.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Getting Started](#2-getting-started)
3. [Repository Map](#3-repository-map)
4. [The Pipeline, Step by Step (0–15)](#4-the-pipeline-step-by-step-015)
5. [Skills Catalog — Full Reference](#5-skills-catalog--full-reference)
6. [Deep Dive — The Data Warehouse](#6-deep-dive--the-data-warehouse-step-7)
7. [Deep Dive — The Knowledge Graph](#7-deep-dive--the-knowledge-graph-step-9)
8. [Deep Dive — Machine Learning Models](#8-deep-dive--machine-learning-models-step-10)
9. [Deep Dive — The LLM Knowledge-Graph Agent](#9-deep-dive--the-llm-knowledge-graph-agent-step-11)
10. [Deep Dive — Virtology & Link Suggestions](#10-deep-dive--virtology--link-suggestions-step-12)
11. [Cross-Cutting Design Principles](#11-cross-cutting-design-principles)
12. [Proposed Architecture Extension — Environmental, Energetic & Anomalous Phenomena Sensing](#12-proposed-architecture-extension--environmental-energetic--anomalous-phenomena-sensing)
13. [Logical Architecture Diagram](#13-logical-architecture-diagram)
14. [Appendix — Where to Go Next](#14-appendix--where-to-go-next)

---

## 1. Project Overview

**GDX_HUMAN 7** (GoDataX Human) is a data-engineering and research project that starts from one
real psychometric study — *"Predictors of Adaptability to Military Higher Education,"* applied
to 423 cadets at the Military Academy — and expands it in several directions:

1. **A rigorous relational model** of the raw psychometric data (item-level responses,
   dimension scores, instruments, constructs) in a Firebird 2.5 database.
2. **Interpretive/qualitative bridges** between that scientific base and four distinct
   philosophical/esoteric traditions — the theosophical Septenary Constitution, the 7 Kundalini
   chakras, Thomas Aquinas's Five Ways, and *Virtology* (a 33-virtue neuro-philosophical
   system) — always kept explicit as **conceptual readings, not statistical findings**.
3. **Physiological data** (cardiac coherence / HRV device) linked to the same person
   identity as the psychometric study.
4. **An analytical layer** (a star-schema data warehouse) unifying all these perspectives for
   cross-cutting queries.
5. **A knowledge graph** (Neo4j) mirroring the entire relational schema, feeding two
   graph-machine-learning models (link prediction, community detection) and an LLM assistant.
6. **A repeatable pipeline** for onboarding **new** studies/instruments from scratch — the
   original 423-cadet study was loaded once, by hand; any future study goes through a generic
   skill assembly line (interview → SQL generation → load → questionnaire export → answer load).

Nearly all automation in the project is implemented as **Claude Code skills**
(`.claude/skills/` inside each folder), each with its own `SKILL.md`. The general pattern is
**"generate, then execute"**: a Python or Node.js script reads the data source and generates
SQL; a second script executes that SQL against Firebird (`--dry-run` always available before a
real write).

### The source data, in one sentence

An IBM SPSS `.sav` file with **no embedded metadata** (no variable labels, no value labels) —
every column's meaning (`AC1`, `Ha7`, `ENGAGvigor`, …) had to be reverse-engineered from
external support documents (`.pptx`/`.docx`, no longer present in the repo) and is documented in
`2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` and
`1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md`. **423
respondents, 159 columns** — 137 raw items across 9 instruments, 1 context variable (`ano`,
curricular year) and 20 pre-computed dimension scores.

### One person, one identity, everywhere

A design decision cuts across folders 2, 6, 7 and 9: **there is exactly one person identity in
the whole project**, `GDX_PSY_PERSON.ID_PERSON`. `DW_DIM_PERSON` is a faithful copy of it;
`GDX_CC_PERSON.ID_PERSON` is a direct FK into it (not a parallel catalog); the Neo4j graph
inherits the same id as `gdx_key`. Today only one person (`SPSS-784`) has both psychometric and
cardiac-coherence data — which limits what the dashboards/ML can show about the intersection of
the two sources, but the architecture is already built for more.

---

## 2. Getting Started

### 2.1 Technology stack

| Concern | Technology | Notes |
|---|---|---|
| Relational database | **Firebird 2.5** | All OLTP schemas (`GDX_PSY_*`, `GDX_TA_*`, `GDX_CC_*`) and the DW (`DW_DIM_*`/`DW_FACT_*`) live in one database, `godatax.human` |
| DB connectivity (Node.js) | [`node-firebird`](https://www.npmjs.com/package/node-firebird) | Pure wire-protocol driver — no native client library needed on the machine running a skill |
| Graph database | **Neo4j AuraDB** (with Graph Data Science / Aura Graph Analytics) | Free tier is sufficient for this project's graph size |
| Graph connectivity (Node.js) | [`neo4j-driver`](https://www.npmjs.com/package/neo4j-driver) | |
| Generation scripts | **Python** (`pyreadstat`, `pandas`, `numpy`, `semopy`, `scikit-learn`, `openpyxl`) and **Node.js** | Python for `.sav` reading and statistical analysis (CFA/EFA); Node.js for every database read/write |
| Dashboards | Self-contained **HTML/CSS/JS** files | No server, no external CDN — open directly in a browser |
| Automation framework | **Claude Code skills** (`.claude/skills/<NAME>/SKILL.md`) | Each skill folder has its own `scripts/`, `package.json`, and `.env.example` |

Every skill that touches Firebird or Neo4j is a small, independent Node.js (or Python) project:
`cd` into its `scripts/` folder, `npm install` once, copy `.env.example` to `.env`, run.

### 2.2 Credentials & environment variables

Every skill reads connection settings from environment variables — **never hardcoded** (this is
an explicit, repo-wide rule, called out in nearly every `SKILL.md` and `.env.example`). The two
conventions used throughout the repository:

```bash
# Firebird (godatax.human) — used by every skill that reads/writes GDX_PSY_*/GDX_TA_*/GDX_CC_*/DW_*
GDX_HUMAN_FB_HOST=127.0.0.1
GDX_HUMAN_FB_PORT=3050
GDX_HUMAN_FB_DATABASE=/firebird/godatax.gdb
GDX_HUMAN_FB_USER=godatax1
GDX_HUMAN_FB_PASSWORD=

# Neo4j (AuraDB) — used only by the knowledge-graph export and the two ML skills
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=
```

`.env` files are gitignored everywhere (`.gitignore` explicitly keeps `.env.example` while
excluding `.env`); only `.env.example` (no secrets) is committed.

### 2.3 Running a skill — the general pattern

Almost every database-writing skill follows the same shape:

```bash
cd <folder>/.claude/skills/<SKILL_NAME>/scripts
npm install                        # once
# copy ../.env.example to ../.env and fill in the password, or export the vars directly
node <script>.js --dry-run [--study <slug>]   # see what would happen, writes nothing
node <script>.js [--study <slug>]             # apply it — confirm with a human first
```

- `--dry-run` is supported by essentially every write-capable skill.
- `--study <slug>` scopes a run to one study (see §4.0 and §11) and is required by every skill
  built or updated since 2026-09-17/18 (dashboards, DW loader, knowledge-graph export, link
  suggestions).
- Read-only analysis skills (the two `10.gdx.machine.learning` ML skills) never touch Firebird —
  only Neo4j.

### 2.4 Sharing the skills with a team

These are **Claude Code skills**, not a claude.ai (web/desktop chat) feature. claude.ai's own
"Skills" run in an isolated cloud sandbox with no outbound network access to a private host and
no access to a local `.env` — a skill that needs to reach `127.0.0.1` or a Neo4j
AuraDB instance with real credentials **cannot** run there. Every skill in this repository is
designed to run **locally**, inside Claude Code, on a machine that has network access to the
database and its own `.env`. Two different audiences need two different kinds of access:

#### 2.4.1 Teammates who will run the skills themselves

1. **Repository access.** The repo is hosted at
   `https://github.com/wilsonfda/godatax.human7.git`. If it is private, add each teammate as a
   collaborator (or invite them to the GitHub org/team that owns it).
2. **Local setup**, per teammate: install Claude Code, `git clone` the repository, then for every
   skill they will actually use, `cd` into its `scripts/` folder and `npm install` once (§2.1).
3. **Skill discovery is not recursive.** Claude Code discovers project-level skills by searching
   `.claude/skills/` **upward** from the current working directory toward the repository root —
   it does **not** scan downward into every subdirectory. Because each numbered folder has its
   own `.claude/skills/` (§3), opening Claude Code at the repository root does **not**
   automatically surface the skills nested inside `0.new.instrument/`,
   `2.relational.model.psychometrics/`, `9.knowledge.graph/`, etc. In practice this is already
   how the repo is meant to be used (§2.3's own `cd <folder>/.claude/skills/<SKILL_NAME>/scripts`
   pattern), but it is worth being explicit about for anyone unfamiliar with Claude Code:
   - **Default, no extra setup:** `cd` into the specific numbered folder before invoking that
     folder's skill. This matches the pattern already used throughout §2.3 and §5.
   - **One Claude Code session across several folders:** run `/add-dir <folder>` (Claude Code
     v2.1.257+) for each numbered folder whose skills are needed in that session, instead of
     restarting Claude Code every time the working folder changes.
   - **Team-wide, install-once alternative:** package the skills as a **Claude Code plugin** and
     publish it to a **plugin marketplace** (a git repository can serve as one). A teammate then
     runs `/plugin marketplace add <repo>` once and `/plugin install <skill>@<marketplace>` per
     skill (or the marketplace's default set), and the skills become available in every project
     without depending on the working directory. Plugin skills and project-level `.claude/skills/`
     skills can coexist; a marketplace/plugin pairing can be declared in `.claude/settings.json`,
     e.g.:
     ```json
     {
       "extraKnownMarketplaces": {
         "gdx-human7-skills": {
           "source": { "source": "github", "repo": "wilsonfda/godatax.human7" }
         }
       },
       "enabledPlugins": { "gdx-human7@gdx-human7-skills": true }
     }
     ```
     This is the recommended path once more than a couple of people need the full skill set
     regularly — it removes the "which folder am I in" question entirely.
4. **Credentials, per teammate.** Every skill reads Firebird/Neo4j connection settings from
   `.env` (§2.2), never hardcoded. Prefer creating a **separate Firebird user and a separate
   Neo4j AuraDB user per teammate** (scoped to read-only where write access isn't needed) over
   sharing one password — this keeps `--dry-run`/write-guard mistakes attributable and makes
   revoking one person's access trivial.

#### 2.4.2 People who only need to see results, no install

Several outputs of this pipeline need **no** Claude Code, no `.env`, and no database access at
all, because they are pre-rendered, self-contained artifacts:

- **The 8 dashboards** (`8.gdx.dashboards/`, §5 of the Skills Catalog) are standalone
  `.html` files with inline SVG and no external dependency — open directly in a browser, or send
  the file. They are also published live on the GoDataX website
  (`gdx-source-development-kit.html`, embedded as iframes), so pointing a non-technical
  stakeholder at that page is usually the fastest option.
- **The written deep-dive docs** (`Dashboards_DW_Explanation.md`,
  `GoDataX_Human_7_Knowledge_Graph.md`, `Septenary_Link_Prediction_and_Community_Detection.md`,
  this file, and others) are plain Markdown — readable on GitHub or any Markdown viewer.

#### 2.4.3 Conversational access without Claude Code (advanced)

To let someone ask natural-language questions grounded in the Neo4j graph (§9, the
`11.gdx.llm.agent.mcp/prompt.instruction.txt` system prompt) **without** installing Claude Code,
claude.ai's sandboxed Skills feature is the wrong tool (see the warning above), but claude.ai's
**Connectors** (remote MCP servers, available on Team/Enterprise plans) are not sandboxed the
same way — a Connector is explicitly meant to reach a service you host. The path is:

1. Stand up an MCP server that exposes the Neo4j graph (a small wrapper around `neo4j-driver`,
   hosted anywhere reachable over HTTPS — this does not exist in the repo yet and would need to
   be built).
2. Register its URL as a custom Connector in the claude.ai Team/Enterprise admin settings, and
   load `prompt.instruction.txt` as that Connector-enabled chat's system prompt/Project
   instructions.
3. Teammates with access to that Connector can then query the graph conversationally from
   ordinary claude.ai chat, with the same rigor rules the prompt enforces (§9): always
   distinguish empirical data from interpretation, never diagnose, always show the graph path.

This is meaningfully more infrastructure work than §2.4.1–2.4.2 (a server to host and secure) and
is not required for the pipeline to function — it only matters if conversational, install-free
access to the graph is a real requirement.

---

## 3. Repository Map

```
GDX_HUMAN7/
  0.new.instrument/               <- generic pipeline to onboard a NEW study from scratch
  1.output.ibm.spss.statistics/   <- the original .sav file + its full data documentation
  2.relational.model.psychometrics/  <- the GDX_PSY_* schema (core of everything) + the loaded study
  3.septenary.constitution/       <- interpretive bridge: instruments × 7 theosophical bodies/levels
  4.kundalini.chakras/            <- interpretive bridge: 7 chakras × septenary levels
  5.five.ways.tomas.aquino/       <- interpretive bridge: Aquinas's 5 ways × septenary levels
  6.cardiac.coherence/            <- physiological data (ECG/HRV device), same person identity
  7.multidimensional.database/    <- the Data Warehouse (star schema) unifying folders 2–6
  8.gdx.dashboards/               <- 8 self-contained HTML dashboards reading the DW
  9.knowledge.graph/              <- export of the whole relational schema into Neo4j
  10.gdx.machine.learning/        <- 2 graph ML models (link prediction, community detection)
  11.gdx.llm.agent.mcp/           <- system prompt for an LLM assistant over the knowledge graph
  12.gdx.virtology/                <- knowledge base of 33 virtues + link-suggestion/identify skills
  13.onboarding.env/               <- local Firebird bootstrap (GDS32.DLL direct) + web-catalog sync
  14.metaphysical.measuring.instrument/  <- OT-7 instrument + generic variable<->framework linker
  15.environmental.anomalous.phenomena/  <- GDX_PH_* schema for environmental/anomalous sensing (DDL only, no skill yet)
  16.hypotheses.non.fingo/        <- mathematical-model layer (feature space, F1-F8) over folders 2-9
```

The numbering reflects, broadly, dependency order: every folder consumes data from lower-numbered
folders (the DW in folder 7 reads folders 2–6; the dashboards in folder 8 read folder 7; the
graph in folder 9 reads folders 2–7; the ML in folder 10 reads folder 9 only). Folders 13–15 are
later additions that sit slightly outside that linear chain: `13.onboarding.env/` is a parallel,
standalone path to stand up a *local* Firebird file without a server, plus the one skill that
pushes the catalog from that local file to the shared `firebird.godatax.com` database; `14` adds a
generic, interactive alternative to the batch mapping skills already in folders 3 and 12; `15` is
a DDL-only schema extension with no loader skill and no DW/graph integration yet (see §12/§13); `16`
is a different kind of later addition — not a new data-collection domain, but a mathematical-model
layer that *reads* folders 2–9 (relational, BI, and optionally the knowledge graph) for one study
at a time and writes its own derived results (feature spaces today; latent representations,
distances, the CDI, trajectories and more in later skills) into its own `GDX_HNF_*` schema, never
back into any source table.

---

## 4. The Pipeline, Step by Step (0–16)

### Step 0 — `0.new.instrument/` — Onboarding a brand-new study

Four chained skills, documented in full in `New_Instrument_Onboarding_Process.md`:

```
GDX_SKILL_NEW_STUDY            conversational interview -> new_study_intake/<slug>/intake.json
        |
GDX_SKILL_RECORD_NEW_STUDY     generates SQL from intake.json + executes it against Firebird
        |
GDX_SKILL_EXPORT_NEW_STUDY     reads Firebird -> generates a blank .xlsx questionnaire
        |
   (send one copy per participant, wait for it to come back filled in)
        |
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS   reads ONE filled .xlsx -> writes responses into Firebird
```

Unlike the historical study (loaded once, by hand, via `GDX_SKILL_LOAD_RLT_MODEL_DB`), this
assembly line is **generic**: it never hardcodes an id (it relies on Firebird `BEFORE INSERT`
triggers), never invents a field the user doesn't know the answer to, and never duplicates an
already-onboarded study. **Filled** `.xlsx` files (real participant data) must never be
committed — only `intake.json` and the generated SQL are meant to be committed.

Three more skills live in this folder, outside the straight-line chain above:

- `GDX_SKILL_GENERATE_GOOGLE_FORM` / `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` — a fully
  self-contained **alternative** third/fourth stage, collecting answers through a real Google
  Form (Forms API) instead of (or alongside) the `.xlsx` export/import pair. Independent
  implementation, same end state in `GDX_PSY_*`.
- `GDX_SKILL_DELETE_STUDY` — the mirror image of the whole onboarding chain: permanently removes
  one study's data from the OLTP schema, the DW, Neo4j, and its dashboard HTML files, while
  **never** touching the reusable catalog (instruments/items/constructs/variables) or a person/
  instrument shared with another study. The single most destructive skill in the repository —
  always `--dry-run` first, and `--execute` additionally requires `--confirm-title` to match the
  study's exact title.

See §5 for the full per-skill reference.

### Step 1 — `1.output.ibm.spss.statistics/` — The source data

The historical study's `.sav` file (423 cadets) and its complete documentation. No skill lives
here — it is a raw data source, read by `GDX_SKILL_LOAD_RLT_MODEL_DB` (folder 2).

**Instruments identified with high confidence** (from `PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md`):

| Instrument | Raw columns | Computed dimensions |
|---|---|---|
| Hardiness | `Ha1`–`Ha30` (30) | Commitment, Control, Challenge |
| Student Engagement Scale | `En1`–`En14` (14) | Vigor, Dedication, Absorption |
| Career Adapt-Abilities Scale (CAAS) | `AC1`–`AC28` (28) | Concern, Control, Curiosity, Confidence |
| Satisfaction With Life Scale (SWLS) | `SV1`–`SV5` (5) | Single index |
| Job Satisfaction Scale | `ST1`–`ST5` (5) | Single index |
| Positivity Ratio Scale | `RP1`–`RP20` (20) | Positive / Negative Emotions |
| Personal Satisfaction | 1 item | Single index |
| Perceived Control of Life | 1 item | Single index |

Three additional blocks (`ef1`–`ef18`, `an1`–`an11`, `red1`–`red5`) are **medium/low-confidence
hypotheses** (Maslach Burnout Inventory, an unidentified "organizational anomie" block, and
"Red Tape") — no supporting document confirms their authorship or exact item wording. This gap
is documented, not guessed at.

### Step 2 — `2.relational.model.psychometrics/` — The core: `GDX_PSY_*` schema

The heart of the project: `psychometrics_model_firebird25.sql` defines the full relational model
(study → instrument → construct → variable/indicator → item → response alternative →
application → response → computed result). See §4.2's ER diagram below.

**Skills:** `GDX_SKILL_LOAD_RLT_MODEL_DB` (loads the historical `.sav` study),
`GDX_SKILL_MAKE_ANALYSES_CFA_EFA` (re-runs the CAAS factor analyses from the database instead of
the `.sav`, as a cross-check).

**Key docs:** `SPSS_to_Firebird_Mapping.md` (the full reasoning behind the mapping),
`RLT_Model_Load_and_CFA_EFA_Analyses.md`.

#### ER Diagram — `GDX_PSY_*`

```mermaid
erDiagram
    GDX_PSY_PERSON ||--o{ GDX_PSY_TEAM : "leads"
    GDX_PSY_TEAM ||--o{ GDX_PSY_TEAM_MEMBER : has
    GDX_PSY_PERSON ||--o{ GDX_PSY_TEAM_MEMBER : "is member"
    GDX_PSY_PERSON ||--o{ GDX_PSY_PERSON_OCCUPATION : has
    GDX_PSY_OCCUPATION ||--o{ GDX_PSY_PERSON_OCCUPATION : classifies
    GDX_PSY_STUDY ||--o{ GDX_PSY_STUDY_PARTICIPANT : enrolls
    GDX_PSY_PERSON ||--o{ GDX_PSY_STUDY_PARTICIPANT : participates
    GDX_PSY_PHENOMENON ||--o{ GDX_PSY_PHENOMENON_CONSTRUCT : "explained by"
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_PHENOMENON_CONSTRUCT : explains
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_CONSTRUCT : "parent of"
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_VARIABLE : decomposes
    GDX_PSY_VARIABLE ||--o{ GDX_PSY_INDICATOR : decomposes
    GDX_PSY_INSTRUMENT ||--o{ GDX_PSY_INSTRUMENT_CONSTRUCT : measures
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_INSTRUMENT_CONSTRUCT : "measured by"
    GDX_PSY_INSTRUMENT ||--o{ GDX_PSY_INSTRUMENT_ITEM : contains
    GDX_PSY_INDICATOR ||--o{ GDX_PSY_INDICATOR_ITEM : "computed from"
    GDX_PSY_INSTRUMENT_ITEM ||--o{ GDX_PSY_INDICATOR_ITEM : feeds
    GDX_PSY_INSTRUMENT_ITEM ||--o{ GDX_PSY_ITEM_ALTERNATIVE : offers
    GDX_PSY_PERSON ||--o| GDX_PSY_EVALUATOR : "is"
    GDX_PSY_STUDY_PARTICIPANT ||--o{ GDX_PSY_APPLICATION : undergoes
    GDX_PSY_INSTRUMENT ||--o{ GDX_PSY_APPLICATION : "applied in"
    GDX_PSY_EVALUATOR ||--o{ GDX_PSY_APPLICATION : conducts
    GDX_PSY_APPLICATION ||--o{ GDX_PSY_ITEM_RESPONSE : records
    GDX_PSY_INSTRUMENT_ITEM ||--o{ GDX_PSY_ITEM_RESPONSE : "answered via"
    GDX_PSY_ITEM_ALTERNATIVE ||--o{ GDX_PSY_ITEM_RESPONSE : chosen
    GDX_PSY_APPLICATION ||--o{ GDX_PSY_CONSTRUCT_RESULT : yields
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_CONSTRUCT_RESULT : scored
    GDX_PSY_APPLICATION ||--o{ GDX_PSY_VARIABLE_RESULT : yields
    GDX_PSY_VARIABLE ||--o{ GDX_PSY_VARIABLE_RESULT : scored
    GDX_PSY_APPLICATION ||--o{ GDX_PSY_INDICATOR_RESULT : yields
    GDX_PSY_INDICATOR ||--o{ GDX_PSY_INDICATOR_RESULT : scored
    GDX_PSY_INSTRUMENT ||--o{ GDX_PSY_PSYCHOMETRIC_PROPERTY : "has property"
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_PSYCHOMETRIC_PROPERTY : "has property"
    GDX_PSY_STUDY_PARTICIPANT ||--o{ GDX_PSY_OBSERVATION : "observed in"
    GDX_PSY_EVALUATOR ||--o{ GDX_PSY_OBSERVATION : records
    GDX_PSY_CONSTRUCT ||--o{ GDX_PSY_OBSERVATION : "about"
    GDX_PSY_STUDY_PARTICIPANT ||--o{ GDX_PSY_EVALUATION : "evaluated in"
    GDX_PSY_EVALUATOR ||--o{ GDX_PSY_EVALUATION : conducts
    GDX_PSY_EVALUATION ||--o{ GDX_PSY_EVALUATION_ACTION : recommends
    GDX_PSY_ACTION ||--o{ GDX_PSY_EVALUATION_ACTION : "recommended as"

    GDX_PSY_PERSON {
        bigint ID_PERSON PK
        varchar NAME
        varchar EXTERNAL_IDENTIFIER UK
        date BIRTH_DATE
        varchar GENDER
    }
    GDX_PSY_TEAM {
        bigint ID_TEAM PK
        varchar NAME
        bigint ID_LEADER FK
    }
    GDX_PSY_STUDY {
        bigint ID_STUDY PK
        varchar TITLE
        varchar STATUS
    }
    GDX_PSY_STUDY_PARTICIPANT {
        bigint ID_STUDY PK, FK
        bigint ID_PERSON PK, FK
        varchar ANONYMOUS_CODE UK
        smallint CONSENT
    }
    GDX_PSY_PHENOMENON {
        bigint ID_PHENOMENON PK
        varchar NAME
    }
    GDX_PSY_CONSTRUCT {
        bigint ID_CONSTRUCT PK
        bigint ID_PARENT_CONSTRUCT FK
        varchar NAME UK
        varchar DOMAIN
    }
    GDX_PSY_VARIABLE {
        bigint ID_VARIABLE PK
        bigint ID_CONSTRUCT FK
        varchar NAME
        varchar VARIABLE_TYPE
    }
    GDX_PSY_INDICATOR {
        bigint ID_INDICATOR PK
        bigint ID_VARIABLE FK
        varchar NAME
        numeric MIN_VALUE
        numeric MAX_VALUE
    }
    GDX_PSY_INSTRUMENT {
        bigint ID_INSTRUMENT PK
        varchar NAME
        varchar VERSION
        varchar TYPE
        smallint ACTIVE
        text GOOGLE_FORM_INFO "nullable, added by google_form_instrument_field_firebird25.sql"
    }
    GDX_PSY_INSTRUMENT_ITEM {
        bigint ID_ITEM PK
        bigint ID_INSTRUMENT FK
        integer ITEM_ORDER
        text STATEMENT_TEXT
        varchar RESPONSE_TYPE
    }
    GDX_PSY_ITEM_ALTERNATIVE {
        bigint ID_ALTERNATIVE PK
        bigint ID_ITEM FK
        integer ALTERNATIVE_ORDER
        varchar LABEL
        numeric NUMERIC_VALUE
    }
    GDX_PSY_EVALUATOR {
        bigint ID_EVALUATOR PK
        bigint ID_PERSON FK
        varchar PROFESSIONAL_LICENSE
    }
    GDX_PSY_APPLICATION {
        bigint ID_APPLICATION PK
        bigint ID_STUDY FK
        bigint ID_PERSON FK
        bigint ID_INSTRUMENT FK
        bigint ID_EVALUATOR FK
        varchar STATUS
    }
    GDX_PSY_ITEM_RESPONSE {
        bigint ID_RESPONSE PK
        bigint ID_APPLICATION FK
        bigint ID_ITEM FK
        bigint ID_ALTERNATIVE FK
        numeric NUMERIC_VALUE
        text TEXT_VALUE
    }
    GDX_PSY_CONSTRUCT_RESULT {
        bigint ID_RESULT PK
        bigint ID_APPLICATION FK
        bigint ID_CONSTRUCT FK
        numeric RAW_SCORE
        numeric PERCENTILE
    }
    GDX_PSY_VARIABLE_RESULT {
        bigint ID_VARIABLE_RESULT PK
        bigint ID_APPLICATION FK
        bigint ID_VARIABLE FK
        numeric RAW_SCORE
        numeric PERCENTILE
    }
    GDX_PSY_INDICATOR_RESULT {
        bigint ID_INDICATOR_RESULT PK
        bigint ID_APPLICATION FK
        bigint ID_INDICATOR FK
        numeric CALCULATED_VALUE
    }
    GDX_PSY_PSYCHOMETRIC_PROPERTY {
        bigint ID_PROPERTY PK
        bigint ID_INSTRUMENT FK
        bigint ID_CONSTRUCT FK
        varchar TYPE
        varchar METHOD
        numeric VALUE
        integer SAMPLE_SIZE
    }
    GDX_PSY_OBSERVATION {
        bigint ID_OBSERVATION PK
        bigint ID_STUDY FK
        bigint ID_PERSON FK
        bigint ID_EVALUATOR FK
        bigint ID_CONSTRUCT FK
        text BEHAVIOR
    }
    GDX_PSY_EVALUATION {
        bigint ID_EVALUATION PK
        bigint ID_STUDY FK
        bigint ID_PERSON FK
        bigint ID_EVALUATOR FK
        varchar TYPE
        varchar CONCLUSION
    }
    GDX_PSY_ACTION {
        bigint ID_ACTION PK
        varchar NAME
        varchar TYPE
    }
    GDX_PSY_EVALUATION_ACTION {
        bigint ID_EVALUATION PK, FK
        bigint ID_ACTION PK, FK
        smallint PRIORITY
        varchar STATUS
    }
```

28 tables in total (`GDX_PSY_OCCUPATION`/`PERSON_OCCUPATION` omitted from the diagram above for
space — a simple person↔occupation history table). Every surrogate key is a `BIGINT` populated by
a Firebird `BEFORE INSERT` trigger reading from a matching `SEQ_GDX_PSY_*` sequence — no id is
ever hardcoded by application code except in the frozen, one-time historical load scripts.

**Two later extensions to this base schema, both standalone single-purpose scripts in this
folder:**
- `google_form_instrument_field_firebird25.sql` adds `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO`
  (`BLOB SUB_TYPE TEXT`, nullable) — a permanent home for `GDX_SKILL_GENERATE_GOOGLE_FORM`'s
  (§5, `0.new.instrument/`) post-creation printout (edit/share links, `google_form_map.json`
  path, next-step instructions), one instrument row at a time instead of living only in a shell
  scrollback.
- `study1_indicator_backfill_partial_firebird25.sql` partially closes a gap `SPSS_to_Firebird_Mapping.md`
  already documented and `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` (§5) still describes as "empty in this
  database": it inserts `GDX_PSY_INDICATOR`/`GDX_PSY_INDICATOR_ITEM` rows for the **5 instruments**
  whose item-to-dimension split needs no invented judgment call (single-index instruments —
  Satisfaction With Life, Job Satisfaction, Personal Satisfaction, Perceived Control of Life — plus
  Positivity Ratio, whose split is already documented in `SPSS_to_Firebird_Mapping.md`), each with
  `REVERSED=0` justified by that published instrument's own literature, never by guessing against
  this dataset. The other 6 instruments (Hardiness, Student Engagement, CAAS, the two
  undocumented/low-confidence blocks, Red Tape) are deliberately **not** backfilled — their
  item-to-dimension split and/or reverse-keying is still genuinely unknown, so
  `GDX_PSY_INDICATOR_ITEM` remains empty for those, and Track B of
  `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` (§5) still discovers their structure computationally rather
  than reading it from this table.

**Key rules baked into the DDL:**
- `GDX_PSY_PERSON.EXTERNAL_IDENTIFIER` and `GDX_PSY_STUDY_PARTICIPANT(ID_STUDY, ANONYMOUS_CODE)`
  are unique — one physical person, one row, reusable across studies.
- `GDX_PSY_ITEM_RESPONSE` is unique per `(ID_APPLICATION, ID_ITEM)`; every `*_RESULT` table is
  unique per `(ID_APPLICATION, ID_CONSTRUCT|ID_VARIABLE|ID_INDICATOR)` — one answer, one computed
  score, per application.
- `PERCENTILE` columns are check-constrained to `[0, 100]`; boolean-like flags (`CONSENT`,
  `ACTIVE`, `REVERSED`) are check-constrained to `(0,1)`.
- `GDX_PSY_APPLICATION`/`OBSERVATION`/`EVALUATION` all FK to the **composite** key
  `(ID_STUDY, ID_PERSON)` of `GDX_PSY_STUDY_PARTICIPANT`, not to `GDX_PSY_PERSON` directly — a
  person must be enrolled in the study before anything can reference them there.

### Step 3 — `3.septenary.constitution/` — Interpretive bridge: instruments × 7 bodies

**Skill:** `GDX_SKILL_LOAD_SEPT_MAPS_DB`. **Doc:** `SPSS_Septenary_Constitution_Mapping.md`.

Catalogs the 7 levels of the theosophical Septenary Constitution (Physical → Vital/Etheric →
Astral → Lower Mental → Higher Mental → Buddhic → Atmic/Spirit) and relates psychometric
variables to them, each row carrying a written justification and a `CONFIDENCE_LEVEL`
(`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`).

```mermaid
erDiagram
    GDX_PSY_SEPTENARY_LEVEL ||--o{ GDX_PSY_SEPT_LEVEL_PSY_MAP : classifies
    GDX_PSY_INSTRUMENT |o--o{ GDX_PSY_SEPT_LEVEL_PSY_MAP : "optionally resolves to"
    GDX_PSY_VARIABLE |o--o{ GDX_PSY_SEPT_LEVEL_PSY_MAP : "optionally resolves to"

    GDX_PSY_SEPTENARY_LEVEL {
        bigint ID_SEPTENARY_LEVEL PK
        smallint ORDER_NUM UK "1..7"
        varchar NAME
        varchar TECHNICAL_NAME
        varchar NATURE
        varchar CONSCIOUSNESS_FUNCTION
    }
    GDX_PSY_SEPT_LEVEL_PSY_MAP {
        bigint ID_MAPPING PK
        bigint ID_SEPTENARY_LEVEL FK
        bigint ID_INSTRUMENT FK "nullable"
        varchar INSTRUMENT_LABEL
        bigint ID_VARIABLE FK "nullable"
        varchar VARIABLE_LABEL
        text RECORDED_BEHAVIOR
        text CORRESPONDENCE_JUSTIFICATION
        varchar CONFIDENCE_LEVEL
        integer NUMBER_CONFIRMATIONS "added by confirmation_fields_association_maps_firebird25.sql"
        varchar CONFIRMATION_BY "nullable"
        varchar NAME_INSTITUTION "nullable"
    }
    GDX_PSY_INSTRUMENT {
        bigint ID_INSTRUMENT PK
    }
    GDX_PSY_VARIABLE {
        bigint ID_VARIABLE PK
    }
```

`ID_INSTRUMENT`/`ID_VARIABLE` are nullable by design: this mapping was populated by free-text
label (`INSTRUMENT_LABEL`/`VARIABLE_LABEL`) before the formal `GDX_PSY_INSTRUMENT`/
`GDX_PSY_VARIABLE` catalog existed, and is reconciled to real ids afterward (by
`GDX_SKILL_LOAD_SEPT_MAPS_DB` or the DW ETL). `ORDER_NUM` is check-constrained to `1..7` and
unique — exactly 7 levels, ordered; `CONFIDENCE_LEVEL` is check-constrained to
`HIGH/MEDIUM/LOW/SPECULATIVE`. No uniqueness constraint exists on `(ID_SEPTENARY_LEVEL,
ID_VARIABLE)` — a level can (and does) receive multiple variable mappings.
`NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` (`14.metaphysical.measuring.instrument/
confirmation_fields_association_maps_firebird25.sql`, DEFAULT 0/NULL/NULL) are a later addition —
see §4 Step 14 and §5's `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS`/`GDX_SKILL_LIST_ASSOCIATIONS` —
distinct from `CONFIDENCE_LEVEL`: they count independent human corroborations of a correspondence
already recorded, not how confident the first author was. Every row that pre-dated these columns
was backfilled once to `NUMBER_CONFIRMATIONS=1` by the companion
`confirmation_fields_association_maps_dml_firebird25.sql`.

### Step 4 — `4.kundalini.chakras/` — Interpretive bridge: 7 chakras

No skill (static DDL/DML) — `chakras_model_firebird25.sql` creates one catalog table, a strict
**1:1 ascending correspondence** to `GDX_PSY_SEPTENARY_LEVEL` (chakra of order *N* ↔ septenary
level of order *N*, a common yoga-theosophy syncretism, explicitly framed as symbolic, not
empirical).

```mermaid
erDiagram
    GDX_PSY_SEPTENARY_LEVEL ||--|| GDX_PSY_CHAKRA : "corresponds to (1:1, ascending order)"
    GDX_PSY_CHAKRA ||--o{ GDX_PSY_CHAKRA_VAR_MAP : classifies
    GDX_PSY_INSTRUMENT |o--o{ GDX_PSY_CHAKRA_VAR_MAP : "optionally resolves to"
    GDX_PSY_VARIABLE |o--o{ GDX_PSY_CHAKRA_VAR_MAP : "optionally resolves to"

    GDX_PSY_CHAKRA {
        bigint ID_CHAKRA PK
        smallint ORDER_NUM UK "1..7"
        varchar SANSKRIT_NAME UK
        varchar COMMON_NAME
        varchar LOCATION
        varchar SYMBOLIC_COLOR
        varchar SYMBOLIC_ELEMENT
        varchar SEED_MANTRA
        varchar SYMBOLIC_FUNCTION
        bigint ID_SEPTENARY_LEVEL FK "NOT NULL"
        varchar SEPTENARY_LEVEL_JUSTIFICATION
    }
    GDX_PSY_CHAKRA_VAR_MAP {
        bigint ID_MAPPING PK
        bigint ID_CHAKRA FK
        bigint ID_INSTRUMENT FK "nullable"
        varchar INSTRUMENT_LABEL
        bigint ID_VARIABLE FK "nullable"
        varchar VARIABLE_LABEL
        text RECORDED_BEHAVIOR
        text CORRESPONDENCE_JUSTIFICATION
        varchar CONFIDENCE_LEVEL
        integer NUMBER_CONFIRMATIONS
        varchar CONFIRMATION_BY "nullable"
        varchar NAME_INSTITUTION "nullable"
    }
    GDX_PSY_INSTRUMENT {
        bigint ID_INSTRUMENT PK
    }
    GDX_PSY_VARIABLE {
        bigint ID_VARIABLE PK
    }
```

Unlike the septenary mapping table (§4.3), `ID_SEPTENARY_LEVEL` on `GDX_PSY_CHAKRA` itself is
`NOT NULL` — every chakra always resolves to exactly one level, and that correspondence is fixed
DDL/DML (no loader skill ever touches the catalog row itself).

**`GDX_PSY_CHAKRA_VAR_MAP`** (`14.metaphysical.measuring.instrument/
metaphysical_variable_chakra_map_firebird25.sql`) is a later addition, written in support of
`GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` (§4 Step 14): because `GDX_PSY_CHAKRA` is a pure 7-row
catalog (unlike `GDX_TA_WAY_SEPT_MAP`, it was never itself a relation table), it cannot be
extended in place with nullable instrument/variable columns — so this script adds a brand-new
association table instead, mirroring `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s column shape (§4.3) exactly,
including the same later-added `NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` trio
(`confirmation_fields_association_maps_firebird25.sql`), unique on `(ID_CHAKRA, VARIABLE_LABEL)`
so one chakra can receive more than one variable mapping.

### Step 5 — `5.five.ways.tomas.aquino/` — Interpretive bridge: the Five Ways

No skill (static DDL/DML). `five_ways_model_firebird25.sql` catalogs Thomas Aquinas's five
cosmological/teleological arguments for God's existence (*Summa Theologica* I, Q.2, Art.3).
`five_ways_septenary_map_firebird25.sql` relates each way to the septenary level that best
matches the *faculty of reasoning* it exercises — deliberately **N:1** (levels 4/4/5/5/6), never
trivially mapping all five to level 7 (their shared conclusion).

```mermaid
erDiagram
    GDX_TA_WAY ||--o{ GDX_TA_WAY_SEPT_MAP : "reasons at level"
    GDX_PSY_SEPTENARY_LEVEL ||--o{ GDX_TA_WAY_SEPT_MAP : receives
    GDX_PSY_INSTRUMENT |o--o{ GDX_TA_WAY_SEPT_MAP : "optionally resolves to"
    GDX_PSY_VARIABLE |o--o{ GDX_TA_WAY_SEPT_MAP : "optionally resolves to"

    GDX_TA_WAY {
        bigint ID_WAY PK
        smallint ORDER_NUM UK "1..5"
        varchar LATIN_NAME UK
        varchar ENGLISH_NAME
        varchar ARGUMENT_TYPE
        varchar PREMISE
        varchar METAPHYSICAL_PRINCIPLE
        text REASONING
        varchar CONCLUSION
    }
    GDX_TA_WAY_SEPT_MAP {
        bigint ID_MAPPING PK
        bigint ID_WAY FK
        bigint ID_SEPTENARY_LEVEL FK
        bigint ID_INSTRUMENT FK "nullable, added by metaphysical_variable_way_map_firebird25.sql"
        varchar INSTRUMENT_LABEL "nullable"
        bigint ID_VARIABLE FK "nullable"
        varchar VARIABLE_LABEL "nullable"
        text RECORDED_BEHAVIOR "nullable"
        text CORRESPONDENCE_JUSTIFICATION
        varchar CONFIDENCE_LEVEL
        integer NUMBER_CONFIRMATIONS
        varchar CONFIRMATION_BY "nullable"
        varchar NAME_INSTITUTION "nullable"
    }
    GDX_PSY_INSTRUMENT {
        bigint ID_INSTRUMENT PK
    }
    GDX_PSY_VARIABLE {
        bigint ID_VARIABLE PK
    }
```

The original 5 rows are unique on `(ID_WAY, ID_SEPTENARY_LEVEL)` and carry mixed confidence by
design: way 4 → Higher Mental is rated `HIGH` (an explicit textual match to "values/judgment"),
way 5 → Buddhic is `SPECULATIVE`, the rest `MEDIUM` — the table does not claim uniform certainty
across all five ways.

**`ID_INSTRUMENT`/`INSTRUMENT_LABEL`/`ID_VARIABLE`/`VARIABLE_LABEL`/`RECORDED_BEHAVIOR`** were
added later by `14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql`
so a Way↔Level pair can also carry one or more concrete instrument/variable correspondences
(reusing `GDX_PSY_INSTRUMENT`/`GDX_PSY_VARIABLE` tagged `VARIABLE_TYPE='METAPHYSICS'`, not a new
table), the same free-text-label pattern `GDX_PSY_SEPT_LEVEL_PSY_MAP` already uses — nullable here
(unlike that table) since the original 5 conceptual rows have no instrument/variable context to
fill in. This also **redefined the unique constraint** to `(ID_WAY, ID_SEPTENARY_LEVEL,
VARIABLE_LABEL)` (Firebird treats `NULL` as distinct in a unique index, so the original 5 rows
keep working unchanged), because the old `(ID_WAY, ID_SEPTENARY_LEVEL)` constraint would otherwise
block attaching more than one variable to the same Way. All 7 OT-7 variables (§4 Step 14) are
linked this way to Way 5 / Buddhic via `ot7_way_map_dml_firebird25.sql`, with the Portuguese
source text later translated to English in place by `ot7_translate_association_text.sql`.
`NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` are the same later addition described
in §4 Step 3 (`confirmation_fields_association_maps_firebird25.sql`).

### Step 6 — `6.cardiac.coherence/` — Physiological data (ECG/HRV)

No dedicated onboarding skill for the schema itself (static DDL/DML + a simulation dataset), but
`GDX_SKILL_LOAD_CC_MAPS_DB` links its participants to a study. Schema `GDX_CC_*` for capturing
cardiac coherence with the medical ECG/HRV device.

**Key doc:** `GDX_CC_Psychometrics_Person_Mapping.md` — central point: **`GDX_CC_PERSON` is not
a parallel person catalog**; its `ID_PERSON` is a direct FK into `DW_DIM_PERSON`/
`GDX_PSY_PERSON`, the same identity used on the psychometric side (enforced at the database
level since step 7's cross-schema FK was added). What is still missing per new participant is
their **study** association (`GDX_PSY_STUDY_PARTICIPANT`), which is exactly
`GDX_SKILL_LOAD_CC_MAPS_DB`'s job.

```mermaid
erDiagram
    GDX_CC_PERSON ||--o{ GDX_CC_SESSION : "has"
    GDX_CC_DEVICE ||--o{ GDX_CC_SESSION : "used in"
    GDX_CC_SESSION ||--o{ GDX_CC_RR_INTERVAL : records
    GDX_CC_SESSION ||--o{ GDX_CC_ECG_SAMPLE : records
    GDX_CC_SESSION ||--o{ GDX_CC_MOTION : records
    GDX_CC_SESSION ||--o{ GDX_CC_HRV_WINDOW : "aggregates into"
    GDX_CC_SESSION ||--o{ GDX_CC_DEVICE_EVENT : logs
    DW_DIM_PERSON ||--|| GDX_CC_PERSON : "FK_GDX_CC_PERSON_DW_PERSON"

    GDX_CC_PERSON {
        bigint ID_PERSON PK "FK to DW_DIM_PERSON"
        varchar EXTERNAL_CODE UK
        smallint ACTIVE_FLAG
        timestamp CREATED_AT
    }
    GDX_CC_DEVICE {
        bigint DEVICE_ID PK
        varchar MANUFACTURER
        varchar MODEL_NAME
        varchar SERIAL_NUMBER
        varchar DEVICE_TYPE
        varchar MEDICAL_CLASS
        smallint ECG_CHANNELS
        smallint ECG_RESOLUTION_BITS
    }
    GDX_CC_SESSION {
        bigint SESSION_ID PK
        bigint ID_PERSON FK
        bigint DEVICE_ID FK
        timestamp STARTED_AT
        timestamp ENDED_AT
        varchar SIGNAL_TYPE
        integer ECG_SAMPLE_RATE_HZ
        varchar PROTOCOL_NAME
        varchar BODY_POSITION
    }
    GDX_CC_RR_INTERVAL {
        bigint RR_INTERVAL_ID PK
        bigint SESSION_ID FK
        bigint BEAT_NUMBER
        numeric RR_INTERVAL_MS
        numeric HEART_RATE_BPM
        varchar QUALITY_FLAG
    }
    GDX_CC_ECG_SAMPLE {
        bigint ECG_SAMPLE_ID PK
        bigint SESSION_ID FK
        bigint SAMPLE_NUMBER
        numeric ECG_VALUE_UV
        varchar QUALITY_FLAG
    }
    GDX_CC_MOTION {
        bigint MOTION_ID PK
        bigint SESSION_ID FK
        bigint SAMPLE_NUMBER
        numeric ACC_X_MS2
        numeric ACC_Y_MS2
        numeric ACC_Z_MS2
        numeric DEVICE_TEMP_C
    }
    GDX_CC_HRV_WINDOW {
        bigint HRV_WINDOW_ID PK
        bigint SESSION_ID FK
        timestamp WINDOW_STARTED_AT
        timestamp WINDOW_ENDED_AT
        numeric MEAN_RR_MS
        numeric RMSSD_MS
        numeric SDNN_MS
        numeric COHERENCE_INDEX
        varchar PROTOCOL_PHASE
        varchar STRESS_CLASS
    }
    GDX_CC_DEVICE_EVENT {
        bigint DEVICE_EVENT_ID PK
        bigint SESSION_ID FK
        timestamp EVENT_AT
        varchar EVENT_TYPE
        varchar SEVERITY_LEVEL
        numeric BATTERY_PERCENTAGE
    }
    DW_DIM_PERSON {
        bigint ID_PERSON PK
    }
```

Device specs baked into check constraints: `ECG_SAMPLE_RATE_HZ IN
(125,128,200,250,256,500,512)`, 15-bit resolution, `HEART_RATE_BPM BETWEEN 20 AND 240`,
`RR_INTERVAL_MS BETWEEN 250 AND 3000`. Every child table (`RR_INTERVAL`/`ECG_SAMPLE`/`MOTION`/
`HRV_WINDOW`/`DEVICE_EVENT`) cascades on `SESSION_ID` delete. `STRESS_CLASS` and `DEVICE_TEMP_C`
carry explicit column comments warning they are **not** a diagnosis / not body temperature —
algorithmic classification and internal-device temperature only.

### Step 7 — `7.multidimensional.database/` — The Data Warehouse

See the full deep dive in **§6**. Star schema (12 dimensions + 3 facts + 3 bridge tables)
unifying the 5 OLTP perspectives (steps 2–6, plus Virtology from step 12) into one queryable
point. Skills: none for the initial one-shot ETL (plain SQL); `GDX_SKILL_LOAD_NEW_STUDY_DW` for
incremental, per-study loading (now including the virtue/chakra/way bridge tables — see §5).

### Step 8 — `8.gdx.dashboards/` — Self-contained HTML charts

**Skill:** `GDX_SKILL_MAKE_DASHBOARS_DW`. Reads the DW (step 7), scoped by `--study <slug>`,
and writes standalone `.html` files (no server, no external CDN): the default run produces 9
charts 00–08 — a 2-panel line chart (mean response vs. EFA/CFA loadings), a physiological-response
line chart, a bar chart (score by septenary level), 4 heatmaps (instrument × level / cardiac
stress / chakra / Five Ways), and 2 "gradient portrait" figures (chakra silhouette, septenary
constitution diagram). Two further chart types exist as separate entry points: chart **09**
(`make_dashboard_09_respondent.js`) is a per-**respondent** profile — one file per participant,
not an aggregate — and chart **10** (`make_master_panel.js`, also reachable as `--chart 10`) is a
combined master panel assembling 00–09 plus a phase-by-phase pipeline retrospective (registration
→ data collection → factor analysis → metaphysical/virtue associations → DW load → knowledge-graph
export → link-prediction suggestions). See §5 for the full flag/output reference and
`Dashboards_DW_Explanation.md` for a chart-by-chart reading of the real numbers.

### Step 9 — `9.knowledge.graph/` — Export to Neo4j

See the full deep dive in **§7**. `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` turns the entire in-scope
Firebird schema (55 tables, 70 FKs) into a Neo4j property graph — one node label per table, one
relationship type per FK — discovered live via `RDB$` catalog introspection, not a hand-written
mapping. Scoped by `--study <slug>` since 2026-09-18. Two more skills live alongside it:
`GDX_SKILL_CREATE_SPU_AGENT` guides (it cannot fully automate — Neo4j Aura has no management API
for Agent configuration) setting up the project's Neo4j Aura Agent for step 11's LLM assistant;
`GDX_SKILL_UPDATE_WEB` is a one-way push of the catalog/mapping tables (never participant data)
from the local `13.onboarding.env/GODATAX7HPH.GDB` to the shared `firebird.godatax.com` database.

### Step 10 — `10.gdx.machine.learning/` — Two graph ML models

See the full deep dive in **§8**. Both implemented as skills, both read **only** Neo4j:

- **Model 1 — Link Prediction** (`GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`): FastRP embeddings +
  a classifier trained on the 18–19 existing variable→level mappings, suggests the top-3
  candidate levels for every unmapped variable. **Triage aid only — never auto-writes.**
- **Model 2 — Community Detection** (`GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT`): unsupervised
  Louvain (cross-checked with Label Propagation), compares structural clusters against the
  existing septenary/chakra labels.

### Step 11 — `11.gdx.llm.agent.mcp/` — LLM assistant over the graph

A single file, `prompt.instruction.txt`: the system prompt for an LLM assistant connected to the
Neo4j graph, with explicit rigor rules (never invent data, always distinguish empirical data /
computed indicator / psychological interpretation / philosophical-metaphysical interpretation /
traditional energetic model, never present a metaphysical correspondence as a scientifically
validated causal relationship, never diagnose). See §9.

### Step 12 — `12.gdx.virtology/` — The 33 virtues & link suggestions

`Virtology_Knowledge_Base.md` captures (via an automated, explicitly-flagged-as-unverified fetch)
Eduardo Casarotto's "Virtology" system — 33 ordered virtues, Humility declared as the
foundation, plus two hypothesized primitive neural systems (SNO/SNE) the virtues are claimed to
neutralize. `GDX_SKILL_LINK_SUGGESTIONS` uses this base, together with the database-backed
**variable→virtue** map `GDX_VT_VARIABLE_VIRTUE_MAP` (narrower than, and distinct from, the still-open
virtue→neural-system question), to rank a study's lowest-scoring psychometric indicators and
suggest which virtue addresses each — never inventing a suggestion for a variable with no map
entry (reported as *"no suggestion (review)"*).

```mermaid
erDiagram
    GDX_VT_VIRTUE ||--o{ GDX_VT_VARIABLE_VIRTUE_MAP : addresses
    GDX_PSY_VARIABLE |o--o{ GDX_VT_VARIABLE_VIRTUE_MAP : "optionally resolves to"

    GDX_VT_VIRTUE {
        bigint ID_VIRTUE PK
        smallint ORDER_NUM UK "1..33"
        varchar NAME_PT UK
        varchar NAME_EN
    }
    GDX_VT_VARIABLE_VIRTUE_MAP {
        bigint ID_MAPPING PK
        bigint ID_VIRTUE FK
        bigint ID_VARIABLE FK "nullable"
        varchar SAV_COLUMN UK "NOT NULL — unlike the other _MAP tables' free-text label"
        varchar VARIABLE_LABEL
        text RECORDED_BEHAVIOR
        text JUSTIFICATION_DEFICIT
        text JUSTIFICATION_STRENGTH
        varchar CONFIDENCE_LEVEL
        varchar SCALE_POLARITY "POSITIVE (default) | NEGATIVE"
        integer NUMBER_CONFIRMATIONS
        varchar CONFIRMATION_BY "nullable"
        varchar NAME_INSTITUTION "nullable"
    }
    GDX_PSY_VARIABLE {
        bigint ID_VARIABLE PK
    }
```

Both tables live in `12.gdx.virtology/virtology_model_firebird25.sql` — the database-backed
replacement for what used to be two hand-written, duplicate `virtue_knowledge.js` copies (one per
skill below), including its own copy of the `NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/
`NAME_INSTITUTION` trio for structural consistency with the other three `"_MAP"` tables (§4 Steps
3–5), even though the source code never recorded a confirmation count (every pre-existing row was
seeded to `NUMBER_CONFIRMATIONS=1`, the person who wrote `virtue_knowledge.js` counting as its
first confirmer). `JUSTIFICATION_DEFICIT` and `JUSTIFICATION_STRENGTH` are kept as two separate
columns, never collapsed to one, because `GDX_SKILL_LINK_SUGGESTIONS` and
`GDX_SKILL_IDENTIFY_VIRTUES` read different framings of the same correspondence. `SCALE_POLARITY`
is a later addition (`12.gdx.virtology/variable_virtue_map_polarity_firebird25.sql`): it lets a
negative-pole variable (e.g. `EmocNeg`/Negative Emotions, the one row explicitly flagged
`NEGATIVE`) invert which end of its scale counts as the deficit vs. the strength — see
`GDX_SKILL_IDENTIFY_VIRTUES` below.

Its mirror-image sibling,
`GDX_SKILL_IDENTIFY_VIRTUES`, reads the same table's *strength* framing to report a study's 3
strongest (polarity-aware) indicators as virtues already potentially present — screen-only, no
file written. A third skill, `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`
(`14.metaphysical.measuring.instrument/`'s sibling pattern, applied to virtues), is how a new row
is added to `GDX_VT_VARIABLE_VIRTUE_MAP` one variable at a time, interactively. See §10.

### Step 13 — `13.onboarding.env/` — Standalone local Firebird bootstrap

No Firebird Server/Guardian service, no `node-firebird`, no network wire protocol: this folder's
one skill, `GDX_SKILL_UP_FIREBIRD_DB`, builds a brand-new local database file
(`GODATAX7HPH.GDB`) by executing `godatax_human_full_ddl_no_gdx_ead_firebird25.sql` directly
against `GDS32.DLL` via P/Invoke (the Firebird C API) — Firebird's 2.5.3 x86 client/engine
library plus its runtime companions (`msvcr80.dll`, three ICU DLLs, `firebird.msg`) dropped
alongside it in this same folder. `on.bording.txt` is the human checklist this automates; its own
step "1.e" (creating the project's Neo4j Aura Agent) is what `GDX_SKILL_CREATE_SPU_AGENT` (step 9)
mirrors as a runnable script. The resulting local `.GDB` is also the source database
`GDX_SKILL_UPDATE_WEB` (step 9) pushes the catalog/mapping tables from, one-way, to the shared
`firebird.godatax.com` database.

### Step 14 — `14.metaphysical.measuring.instrument/` — OT-7 instrument + generic association skills

Two things live here. First, `OT7_Instrumento_Metafisico.md` documents the **OT-7** metaphysical
measuring instrument (its 7 variables already linked to Way 5 of Aquinas's Five Ways via
`ot7_way_map_dml_firebird25.sql`). Second — and this is the bulk of the folder — two generic
skills for recording **one interpretive correspondence at a time**, as an alternative to the
batch-oriented loaders in folders 3 and 12:

- `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS` — links one `GDX_PSY_VARIABLE` (psychometric or
  metaphysical) to a Septenary level, a Way of Aquinas, or a Kundalini Chakra, interactively,
  always asking for the recorded behavior, the justification, the confidence level, and
  (mandatory) a named confirmer + institution. Introduces `GDX_PSY_CHAKRA_VAR_MAP` — a brand-new
  table, since `GDX_PSY_CHAKRA` itself has no mapping columns of its own.
- `GDX_SKILL_LIST_ASSOCIATIONS` — the read-only, framework-wide inventory of every correspondence
  recorded anywhere (chakra↔level, Way↔level, variable↔level, variable↔chakra, variable↔virtue),
  cross-referencing a variable that appears in more than one framework. Takes no `--study` flag —
  these are catalog-level judgment calls, not per-study data.

Both skills share a `NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY`/`NAME_INSTITUTION` convention
(`confirmation_fields_association_maps_firebird25.sql`) distinct from `CONFIDENCE_LEVEL`: it
counts independent corroborations of a correspondence, not how confident the first author was.
`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` (step 12) is this pattern's Virtology-specific
sibling, kept as a separate skill because `GDX_VT_VARIABLE_VIRTUE_MAP`'s shape genuinely differs
(no instrument column, two justification columns, a `SCALE_POLARITY` column).

### Step 15 — `15.environmental.anomalous.phenomena/` — `GDX_PH_*` schema (DDL only, no skill yet)

`environmental_anomalous_phenomena_model_firebird25.sql` defines 15 new tables (`GDX_PH_LOCATION`,
`SENSOR_TYPE`, `SENSOR`, `ENVIRONMENT_CONDITION`, `SESSION`, `EVENT`, `MEDIA_FILE`, `EVENT_TAG`,
`OBSERVATION`, `ANALYSIS_RESULT`, `INTERPRETATION`, `SENSOR_CALIBRATION`, `USER`,
`REFERENCE_DATA`, `EVENT_VAR_MAP`) for an instrumented environmental/anomalous-phenomena
monitoring pipeline (locations → sensors → sessions → events/observations → analysis →
interpretation), derived from four reference images under `GDX_CTP_H7/.../ph/` and documented in
full in `GDXH7ph_Technical_Specification_for_Environmental_and_Anomalous_Phenomena.md`. This DDL
has been **written and is ready to apply**, following every naming/trigger/sequence convention
established elsewhere in the project (`GDX_PH_` prefix, `BIGINT` surrogate keys via `BEFORE
INSERT` triggers, `HIGH/MEDIUM/LOW/SPECULATIVE` confidence domain reused on
`GDX_PH_INTERPRETATION`) — but, as of this pass, **no onboarding/loader skill exists for it yet**,
and it is not yet wired into the DW (step 7) or the knowledge-graph export (step 9). Every table
carries a nullable `ID_PERSON` FK straight into `GDX_PSY_PERSON`, by explicit design decision, so
that whenever this module is loaded, its sensor timeline can be correlated against the same
person's psychometric/physiological/cardiac-coherence data (the stated purpose of the whole
module — see the source images' own timeline diagram). See §12/§13 for how this changes (and
doesn't change) the project's architecture diagram.

### Step 16 — `16.hypotheses.non.fingo/` — mathematical-model layer (feature space today)

This is a from-scratch, project-authored mathematical model defining eight functions F1–F8 over a
per-person feature space `x(t) = [Ψ, Φ, N, B, A, C, E, M]` — normalization/comparability (F1), latent
representations (F2), distance/similarity (F3), the Curvature Depth Index (F4, original and
latent), reference baselines (individual/population/normative), temporal trajectories (F6),
Knowledge Graph relations (F7), and the Virtology application layer (F8) — with an explicit,
repeated epistemological caveat throughout: a metaphysical category (chakra, Thomistic Way,
septenary level) never automatically becomes a numeric feature, and a statistical association is
never presented as a causal or ontological one.

Only F1 is implemented so far, by `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE` (MFS, §5), against a brand-new
`GDX_HNF_*` schema (`hypotheses_non_fingo_feature_space_model_firebird25.sql`, this folder):
`GDX_HNF_PERSPECTIVE` (the 8-symbol catalog), `GDX_HNF_FEATURE_DICTIONARY` (a cross-domain
pointer back to the real source of each characteristic — a `GDX_PSY_VARIABLE`, a
`GDX_CC_HRV_WINDOW` column, …), `GDX_HNF_FEATURE_SPACE_RUN`/`GDX_HNF_FEATURE_RUN_MEMBER`
(versioned run metadata) and `GDX_HNF_FEATURE_VALUE`/`GDX_HNF_NORMALIZATION_PARAM` (the assembled
`x(t)`/`z(t)` values and their frozen normalization parameters). Each run is immutable and
reproducible; only the two catalogs are insert-if-missing across runs/studies. F2–F8 are expected
to land as additional skills in this same folder, each adding its own tables on top of
`GDX_HNF_FEATURE_SPACE_RUN` rather than this skill being extended to cover them.

---

## 5. Skills Catalog — Full Reference

25 skills exist today, grouped by the folder that owns them.

### `0.new.instrument/`

#### `GDX_SKILL_NEW_STUDY`
**Purpose:** Interviews a human to register a brand-new study, instrument(s), constructs,
variables/indicators, items, response anchors and scoring weights, grounding every question in
the live `GDX_PSY_*` schema and catalog.
**Trigger:** the user wants to register a new study/questionnaire/scale before any data exists
for it.
**Inputs:** a live read-only connection to Firebird (`scripts/check_catalog.js`), a conversation
with the user.
**Outputs:** `new_study_intake/<slug>/intake.json`, validated by `scripts/validate_intake.py`.
**How it works:**
1. Runs `check_catalog.js` (read-only `SELECT`s) so the interview can say "there is already a
   phenomenon called *Hardiness* — is this the same thing?" instead of risking a near-duplicate.
2. Walks the same FK chain as the DDL, parent before child: study → instrument → phenomenon →
   construct(s) → variable(s)/indicator(s) → response anchor sets → items (statement, anchor
   set, dimension, weight, reverse-scoring).
3. Writes `intake.json` and validates it structurally (`VARCHAR` length limits copied from the
   DDL) and cross-referentially (every reference resolves, no duplicate orders).
**Key rules:** never guesses an unanswered field (records it as `null`, flags it back); reuses
an existing phenomenon/construct by name instead of creating a near-duplicate.

#### `GDX_SKILL_RECORD_NEW_STUDY`
**Purpose:** Reads a validated `intake.json` and both generates and (optionally) executes the
Firebird load scripts that persist it.
**Trigger:** right after `GDX_SKILL_NEW_STUDY` has written a validated intake file.
**Inputs:** `new_study_intake/<slug>/intake.json`.
**Outputs:** `01_new_study.sql`, `02_new_instrument_NN_*.sql` (each a single Firebird `EXECUTE
BLOCK`), written next to `intake.json`; then `GDX_PSY_STUDY`/`PHENOMENON`/`CONSTRUCT`/
`VARIABLE`/`INDICATOR`/`INSTRUMENT`/`INSTRUMENT_ITEM`/`ITEM_ALTERNATIVE`/`INDICATOR_ITEM` rows.
**How it works:**
1. `generate_new_study_scripts.py` re-validates `intake.json`, then emits SQL that never
   hardcodes an id — every insert leaves the id column `NULL` and lets the schema's `BEFORE
   INSERT` triggers assign it from the matching sequence.
2. Each `02_new_instrument_*.sql` is one `EXECUTE BLOCK` capturing each new id via `RETURNING ...
   INTO :V_ID_X` so a child row (e.g. an item) can reference the id its parent row just got in
   the same transaction.
3. `execute_new_study.js --dir <intake-dir> --dry-run`, then for real.
**Key rules:** `01_new_study.sql` looks the study up by `TITLE` first, inserts only if missing
(so re-registering a second instrument for an already-onboarded study never duplicates the
study row); `GDX_PSY_INSTRUMENT` itself always inserts fresh — a genuine name+version duplicate
is left to fail loudly on the schema's own `UNIQUE` constraint, not silently skipped.

#### `GDX_SKILL_EXPORT_NEW_STUDY`
**Purpose:** Reads a newly-onboarded study's instruments/items/alternatives back out of Firebird
and writes a blank `.xlsx` questionnaire to send to participants.
**Trigger:** right after `GDX_SKILL_RECORD_NEW_STUDY` has loaded the study.
**Inputs:** `--study <slug>` (resolved via `intake.json`).
**Outputs:** `GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx` next to `intake.json` — a
**Participant** sheet, one sheet per instrument (item text, response type, a blank **Answer**
column with an Excel dropdown when alternatives exist), and a hidden **META** sheet recording
every resolved id (`ID_STUDY`, `ID_INSTRUMENT`, `ID_ITEM`, `ID_ALTERNATIVE`, …).
**Key rules:** read-only against Firebird (writes only the `.xlsx`); the META sheet is what lets
a renamed/reopened/resaved copy still load correctly downstream — never re-resolves names.

#### `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`
**Purpose:** Reads one filled `.xlsx` (from the skill above) and inserts the participant's real
answers into Firebird.
**Trigger:** after a participant returns a filled workbook.
**Inputs:** `--file <path-to-filled.xlsx>`.
**Outputs:** `GDX_PSY_PERSON` (found-or-inserted by `EXTERNAL_IDENTIFIER`), `GDX_PSY_STUDY_PARTICIPANT`
(found-or-inserted), one `GDX_PSY_APPLICATION` per answered instrument sheet, one
`GDX_PSY_ITEM_RESPONSE` per answered item.
**Key rules:** trusts the workbook's own META sheet for every id, never re-resolves by name (a
filename mismatch is logged as a harmless note, never an error); an answer matching no
alternative label is reported under "UNMATCHED", never coerced to the nearest option; a required
item left blank is reported under "MISSING", never silently completed; every inserted
`GDX_PSY_APPLICATION` is tagged in `CONTEXT` with the source filename so **re-running on the
same file is safe** (it skips the instrument instead of duplicating responses); deliberately
does **not** compute `GDX_PSY_VARIABLE_RESULT`/`CONSTRUCT_RESULT`/`INDICATOR_RESULT` — scoring
raw responses is future work.

#### `GDX_SKILL_GENERATE_GOOGLE_FORM`
**Purpose:** Reads a study's instruments/items/alternatives back out of Firebird and creates a
real Google Form (Forms API) — one section per instrument, one question per item — as a
self-contained alternative to the `.xlsx` export above.
**Trigger:** the user wants to collect a study's answers through a Google Form link instead of
(or alongside) the `.xlsx` workflow.
**Inputs:** `--study <slug>` (resolved via `intake.json`); a one-time Google OAuth consent
(Desktop-app client; cached token after the first run — the Forms API has no service-account
support for creating/reading Forms).
**Outputs:** a real Google Form; `new_study_intake/<slug>/google_form_map.json` (every
`questionId` mapped to the exact `GDX_PSY_*` ids it represents — the Forms-pipeline equivalent of
the `.xlsx` pipeline's hidden META sheet); the form's edit/share links and instructions written
into `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO` for every instrument the form covers.
**How it works:** resolves each instrument's `(NAME, VERSION)`, walks its items in order
(`RADIO` question when alternatives exist, paragraph text otherwise), captures each question's
Google-assigned `questionId`, writes the map file and the DB column.
**Key rules:** a `RADIO` choice has no stable id of its own in the Forms API (only the question
does) — `google_form_map.json`'s `alternativeMap` is what lets the sibling loader skill match an
answer's literal text safely, within one already-identified item's small option list, never
against the whole database; `--dry-run` touches neither Google nor Firebird.

#### `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`
**Purpose:** Pulls every response from the Google Form the skill above created and inserts them
into Firebird — the Forms-pipeline mirror of `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`.
**Trigger:** after `GDX_SKILL_GENERATE_GOOGLE_FORM` has created the Form and participants have
started answering it.
**Inputs:** `--study <slug>` → `new_study_intake/<slug>/google_form_map.json` (never re-resolves
by the question's visible text); the same cached Google OAuth token.
**Outputs:** `GDX_PSY_PERSON` (found-or-inserted), `GDX_PSY_STUDY_PARTICIPANT`,
`GDX_PSY_APPLICATION` (one per instrument with any answered question in a response),
`GDX_PSY_ITEM_RESPONSE`.
**How it works:** each item question is already uniquely identified by `questionId`; a `RADIO`
answer's literal text is matched case-insensitively against that item's own exact-verbatim
option list in `alternativeMap` — no match is reported under "UNMATCHED", not guessed.
**Key rules:** a response missing Full Name or External Identifier is skipped entirely, never
invented; does not compute `*_RESULT` scores (same boundary as its `.xlsx` counterpart); every
inserted `GDX_PSY_APPLICATION` is tagged `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS:<formId>:<responseId>`
in `CONTEXT`, so re-running only picks up new responses, never duplicates.

#### `GDX_SKILL_DELETE_STUDY`
**Purpose:** Permanently deletes one study and everything exclusively tied to it, across
Firebird (OLTP), the DW, and Neo4j, in one pass — the mirror image of the whole onboarding chain.
**Trigger:** the user explicitly asks to delete/remove/purge a study and its data. **The single
most destructive skill in the repository.**
**Inputs:** `--study <ID_STUDY>` (the numeric id, not a slug).
**Outputs:** none written — only deletions (plus a printed per-table deletion/preservation report).
**How it works:**
1. Computes a full exclusivity analysis first: a person, or an instrument's
   `GDX_PSY_PSYCHOMETRIC_PROPERTY` rows, is only deleted if no *other* study has any tie to it —
   checked live against the database, never assumed (a documented past bug used
   `GDX_PSY_APPLICATION.ID_INSTRUMENT` for this and got it wrong for the historical study's
   "umbrella" applications; the fix joins through `GDX_PSY_ITEM_RESPONSE → GDX_PSY_INSTRUMENT_ITEM`
   instead).
2. Deletes genuinely study-owned rows outright (`GDX_PSY_STUDY`, `STUDY_PARTICIPANT`,
   `APPLICATION`, responses/results filtered by this study's applications, matching `DW_FACT_*`).
3. Deletes the matching Neo4j nodes (`DETACH DELETE`, same `gdx_key` rule
   `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` used to write them) and this study's `8.gdx.dashboards`
   HTML files (resolved by matching `intake.json`'s `study.title` to the slug in the filename —
   never a filename-substring guess).
**Key rules:** **never** deletes catalog data (instruments, items, alternatives, indicators,
variables, constructs, phenomena) — reusable knowledge base by deliberate design, regardless of
sharing; always runs as a dry run by default — real deletion additionally requires `--execute`
**and** `--confirm-title "<exact TITLE>"`, a deliberate extra step so a wrong id or a habitual
`--execute` cannot delete the wrong study; `--skip-neo4j`/`--skip-dashboards` opt out of those
phases.

### `2.relational.model.psychometrics/`

#### `GDX_SKILL_LOAD_RLT_MODEL_DB`
**Purpose:** Regenerates and (optionally) runs the load scripts for the one historical `.sav`
study.
**Trigger:** the user wants to regenerate the psychometrics load scripts or refresh/sync the
`GDX_PSY_*` load from the `.sav`.
**Inputs:** `1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav`, the fixed catalog
`scripts/catalog.py` (instrument/dimension/item metadata hand-extracted from support documents —
this cannot be derived from the `.sav` itself, which carries no labels).
**Outputs:** `01_load_study.sql` … `08_adjust_sequences.sql` in
`2.relational.model.psychometrics/`, then the corresponding `GDX_PSY_*` rows in Firebird.
**How it works:**
1. `generate_load_scripts.py` re-reads the `.sav` fresh every run and cross-checks its actual
   columns against `catalog.py`, **printing a warning instead of guessing** on any mismatch.
2. `execute_load.js --dry-run` then for real — batches commits every 2000 statements on the two
   bulk files (~58k and ~8.9k statements).
**Key rules:** refuses to run if any `GDX_PSY_*` table is missing (does not apply DDL itself);
refuses to re-run if `GDX_PSY_STUDY.ID_STUDY = 1` already exists (idempotency guard, `--force`
skips it but nothing is ever deleted); `--only <1-8>` re-runs a single failed step.

#### `GDX_SKILL_MAKE_ANALYSES_CFA_EFA`
**Purpose:** Runs CFA/EFA psychometric analyses sourced from the live database instead of the
`.sav`, for all 11 instruments. Track A: re-runs the Career Adapt-Abilities Scale's CFA/EFA as an
independent cross-check. Track B: runs both EFA and CFA for every other multi-item instrument,
discovering item structure computationally since `GDX_PSY_INDICATOR_ITEM` was empty in this
database at the time this skill was built — since partially backfilled for 5 single-index/
already-documented instruments by `study1_indicator_backfill_partial_firebird25.sql` (§4 Step 2),
but Track B's own correlation-based discovery logic is unchanged and still runs independently of
that table's contents. Track C: descriptive statistics only for the two single-item instruments
(no factor analysis is mathematically possible with 1 item).
**Trigger:** the user wants to (re)verify the `.sav`-sourced CAAS psychometric properties, or run
factor analysis for instruments beyond CAAS ("all variables"/"all instruments").
**Inputs:** Track A: `GDX_PSY_ITEM_RESPONSE`/`GDX_PSY_VARIABLE_RESULT` for `ID_INSTRUMENT=3`. Track
B: same tables for `--instrument` in `{1,2,4,5,6,9,10,11}`. Track C: same tables for `{7,8}`.
**Outputs:** Track A: `output/09-11_..._from_db.sql`. Track B: `output/efa_instrument_<ID>_*.sql` +
`output/cfa_instrument_<ID>_*.sql`. Track C: `output/describe_instrument_<ID>_*.sql`. (Same
`GDX_PSY_PSYCHOMETRIC_PROPERTY` insert shape across all tracks; `data/instrument_<ID>_structure.json`
documents what Track B discovered per variable, confirmed or not.)
**How it works:**
1. Track A: `fetch_career_adaptability_items.js` pivots `AC1..AC28` into a CSV (plus the 4
   pre-computed dimension scores) -> `run_cfa_from_db.py` (semopy, 4-factor correlated CFA, ML) ->
   `run_efa_from_db.py` (`sklearn.decomposition.FactorAnalysis` + hand-rolled Varimax — the
   `factor_analyzer` package is broken against modern scikit-learn). AC1-7/8-14/15-21/22-28 is
   hardcoded because it's independently confirmed to reproduce `GDX_PSY_VARIABLE_RESULT` exactly
   (max discrepancy ~4e-5 across all 423 applications).
2. Track B: `analyze_instrument.js` ranks each instrument's raw items by correlation against each
   of its named variables' real `GDX_PSY_VARIABLE_RESULT` score, then exhaustively searches
   reversal-flip combinations over ranked-prefix subsets for one whose unweighted mean reproduces
   that ground truth exactly (same validation method that confirmed CAAS's own grouping, applied
   here to discover instead of assume) -> `run_efa_generic.py` (*k* factors = *k* named variables,
   factor<->variable labels are best-effort correlation matches written to the DB as their own
   `TYPE=FACTOR_MATCH_CORRELATION` row, e.g. Positivity Ratio's r=0.09-0.50 vs. Satisfaction With
   Life's r=0.74-0.80) and `run_cfa_generic.py` (CFA on that same discovered grouping, one factor
   per variable with >=3 discovered items; every row's METHOD/REFERENCE spells out "DISCOVERED
   grouping (not exactly confirmed)" — fit varies honestly by instrument, e.g. Red Tape CFI=0.99 vs.
   Positivity Ratio CFI=0.64). Neither script runs on a variable/instrument that came back
   `confirmed: true` (that belongs in Track A's proven-grouping approach instead).
3. Track C: `describe_single_item_instrument.js` writes only item/dimension mean+SD (they're
   numerically identical for a 1-item "dimension") — no KMO/Bartlett/loading/fit-index row, ever.
**Key rules:** Track A's Python scripts assert their raw-item-derived dimension means match the
DB's own precomputed scores within `1e-3`, aborting instead of silently disagreeing; Track B never
*claims* a confirmed a priori model (every row says "discovered") even though it still fits and
reports the CFA; `data/`/`output/` are gitignored (regenerable); loading results back uses
`load_property_file.js` (Tracks B/C, generic per-instrument preflight) or the sibling skill's
`execute_afc_property_load.js` (Track A, hardcoded to instrument 3) and is confirmed with the user
first.

### `3.septenary.constitution/`

#### `GDX_SKILL_LOAD_SEPT_MAPS_DB`
**Purpose:** Keeps `GDX_PSY_SEPT_LEVEL_PSY_MAP` in sync with **one study at a time**.
**Trigger:** right after `GDX_SKILL_RECORD_NEW_STUDY` has loaded a new study/instrument.
**Inputs:** `--study <slug>` → `new_study_intake/<slug>/intake.json`; the fixed judgment-call
catalog `scripts/knowledge.js`.
**Outputs:** new or backfilled `GDX_PSY_SEPT_LEVEL_PSY_MAP` rows for that study's variables only.
**How it works:** for each of the study's variables, resolves a knowledge-catalog key (the
`.sav` column if the variable came from a historical load, otherwise the variable's own name),
then inserts/backfills/skips depending on whether a mapping already exists.
**Key rules:** never scans the whole database (only this study's own instruments/variables);
never writes to `GDX_PSY_SEPTENARY_LEVEL` (the 7-level catalog is out of scope); never guesses a
level or justification — an unmapped variable is reported `UNKNOWN` and left alone until a human
adds a real entry to `knowledge.js`.

### `6.cardiac.coherence/`

#### `GDX_SKILL_LOAD_CC_MAPS_DB`
**Purpose:** Associates cardiac-coherence participants with a psychometric study.
**Trigger:** after a new study is loaded and its participants have cardiac-coherence sessions.
**Inputs:** `--study <slug>`.
**Outputs:** `GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, CONSENT=0)` rows.
**How it works:** selects every active `GDX_CC_PERSON` with ≥1 `GDX_CC_SESSION` row and **no**
existing study association (a scope rule, not a schema fact — `GDX_CC_PERSON`/`SESSION` have no
`ID_STUDY` column at all), defensively re-verifies a matching `GDX_PSY_PERSON` exists, then
inserts the association.
**Key rules:** never writes to `GDX_CC_PERSON`/`SESSION`/`GDX_PSY_PERSON`; never invents
consent (always `CONSENT=0`, a human must confirm it later); never reassigns/duplicates an
existing study association — a person already claimed by an earlier study is left untouched.

### `7.multidimensional.database/`

#### `GDX_SKILL_LOAD_NEW_STUDY_DW`
**Purpose:** Incremental, per-study, insert-if-missing loading of the DW.
**Trigger:** once a study's instruments/participants/answers (and optionally septenary/cardiac
mappings) already exist, to make it queryable in the DW.
**Inputs:** `--study <slug>`.
**Outputs:** rows in every `DW_DIM_*`/`DW_FACT_*` table scoped to that study; global reference
dimensions (`DW_DIM_DATE`/`SEPTENARY_LEVEL`/`CHAKRA`/`FIVE_WAY`) bootstrapped once,
insert-if-missing.
**How it works:** resolves scope from `intake.json` (or, for a legacy study with no intake file,
directly from what the OLTP already shows applied — see the skill's own fallback logic);
resolves the septenary level the same two-key way `GDX_SKILL_LOAD_SEPT_MAPS_DB` does (`.sav`
column match, or exact variable-name match).
**Key rules:** never truncates/deletes anything (unlike the whole-database, one-shot
`godatax_human_dw_etl_firebird25.sql`); never loads another study's rows; never computes
`GDX_PSY_VARIABLE_RESULT`; a fact-grain collision `(person, item)`/`(person, variable)` against a
*different* application is reported, never silently overwritten. Since the addition of
`dw_virtue_chakra_way_bridges_firebird25.sql` (this folder), it also bootstraps `DW_DIM_VIRTUE`
and mirrors every matching row of `GDX_VT_VARIABLE_VIRTUE_MAP`/`GDX_PSY_CHAKRA_VAR_MAP`/
`GDX_TA_WAY_SEPT_MAP`'s variable extension into three new **bridge tables**
(`DW_BRIDGE_VARIABLE_VIRTUE`/`_CHAKRA`/`_WAY`) — genuinely many-to-many junction tables (a
variable can map to several virtues at once), not single FK columns, global/bootstrap-once like
the other reference dimensions, never study-scoped.

### `8.gdx.dashboards/`

#### `GDX_SKILL_MAKE_DASHBOARS_DW`
**Purpose:** Generates self-contained HTML charts from the DW, scoped to one study — 9 aggregate
charts by default, plus two further chart types reachable separately (see below).
**Trigger:** the user asks for dashboards/charts/visualizations of a specific study.
**Inputs:** `--study <slug>` (required); `--chart <code>` (optional, one of `00`-`08` — generates
only that one chart, loading only its own queries, instead of all 9 — or `10` for the master
panel, see below).
**Outputs:** up to 9 `.html` files named
`dashboard_0N_<chart>__<slug>__<title-slug>__<YYYYMMDD-HHMMSS>.html` (never overwrites an
earlier run) from the default run.
**How it works:** resolves the slug to `ID_STUDY`, then for each selected chart code runs its own
query — charts 0 (top panel)/1–6/8 against `DW_FACT_*`/`DW_DIM_*` filtered on
`DW_DIM_PERSON.ID_STUDY`; chart 0's bottom panel (and only that) against
`GDX_PSY_PSYCHOMETRIC_PROPERTY` directly (no `ID_STUDY` column, never study-scoped) — and renders
via `chart_lib.js` (line, small-multiples line, bar, heatmap ×4, two "gradient portrait" figures
over the project's own chakra/septenary illustrations).
**Key rules:** `--sample` mode uses embedded data, no DB connection; a chart with zero rows for
this study is skipped (not written), reported in console output; follows the `dataviz` skill's
method (indexed baselines or small multiples instead of dual axes, sequential single-hue heatmaps
instead of radar charts). Chart 0 (`means_psychometric_responses`) compares, per instrument, the
mean response score participants actually gave against the mean EFA/CFA `\|`factor loading`\|` from
`GDX_PSY_PSYCHOMETRIC_PROPERTY` — two panels, not one shared axis, since the two quantities are on
unrelated scales; only the Career Adapt-Abilities Scale has any EFA/CFA rows today, so every other
instrument's bottom panel is empty by design, not a bug.

**Two more chart types, separate entry points:**
- **Chart 09 — per-respondent profile** (`make_dashboard_09_respondent.js`): one file **per
  participant** (not an aggregate) — their own item-by-item answers, their subscale scores
  plotted against the study's own mean/range, the Virtology virtue each variable is associated
  with, and an explicit "no individual factor score exists yet" note rather than a fabricated
  one. `--person <id-or-substring>` scopes to one participant; omitted, it writes one file for
  every participant the study has. Reads `STATEMENT_TEXT` BLOBs one at a time, sequentially —
  `node-firebird`'s `blobAsText` convenience option was found to hang past a few dozen blob rows
  in one result set, a verified driver concurrency bug, not a SQL problem.
- **Chart 10 — master panel** (`make_master_panel.js`, also reachable as `--chart 10` on the main
  script): combines every chart 00–09 plus a phase-by-phase retrospective of the whole pipeline
  for one study (registration → data collection → factor analysis → metaphysical/virtue
  associations → DW load → Neo4j export, queried live → latest link-prediction suggestions, read
  from its most recent report). Fully read-only; `--sample` is not supported here (it always
  reads live Firebird/Neo4j/disk).

### `9.knowledge.graph/`

#### `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`
**Purpose:** Exports one study's slice of the entire `GDX_HUMAN` relational schema into a Neo4j
knowledge graph.
**Trigger:** the user asks to build, refresh, or query the knowledge graph for a specific study.
**Inputs:** `--study <slug>` (required); live Firebird `RDB$` catalog introspection (no hand
mapping).
**Outputs:** Neo4j nodes (one label per table, `MERGE`d on the table's own PK as `gdx_key`) and
relationships (one type per FK constraint, named after the constraint).
**How it works:**
1. `introspect.js` discovers every table matching `GDX_PSY_*`/`GDX_TA_*`/`GDX_CC_*`/`DW_DIM_*`/
   `DW_FACT_*`, its columns, PK, and every FK among in-scope tables.
2. `export_graph.js` resolves `--study` to `ID_STUDY`, applies `studyScopeRules(studyId)` (23
   study-scoped tables filtered by `ID_STUDY`/`ID_PERSON`/`ID_APPLICATION`/`SESSION_ID`/
   `ID_EVALUATION`; 32 global/reference tables always exported in full), writes nodes then
   relationships (two-phase, so a relationship `MATCH` never misses an unwritten parent).
**Key rules:** never hardcodes a table/column/FK (a new table under an in-scope prefix appears
automatically); never hardcodes credentials; the graph **accumulates** across studies (`MERGE`,
not truncate) — unlike the DW loader or the dashboards skill, which are one-set-per-run.
**Scale:** 55 tables, 70 FKs in scope; a scoped run for the one existing study writes ~141,700
nodes / ~331,800 relationships — always `--dry-run` first, prefer `--tables`/`--limit` before a
full run.

#### `GDX_SKILL_CREATE_SPU_AGENT`
**Purpose:** Guides creating (or confirming) the Neo4j Aura Agent that backs step 11's LLM
assistant.
**Trigger:** the user asks to set up, verify, or recreate the project's Neo4j Aura Agent.
**Inputs:** live `NEO4J_*` connectivity; `11.gdx.llm.agent.mcp/prompt.instruction.txt` (read
live, never duplicated/hardcoded).
**Outputs:** none written to any database — only a connectivity check result and printed console
guidance.
**How it works:** Neo4j Aura has **no management API** to list, read, or create an Agent's
configuration (console-UI-only) — so this skill does only what it honestly can: (1) verifies the
underlying Aura *database* instance is reachable; (2) prints the exact Name/Description/Prompt/
sharing-scope values to use, sourced live from `prompt.instruction.txt`; (3) asks the user,
interactively, whether an Agent by that name already exists, and reflects that answer back —
never fabricating "created"/"already exists" on its own.
**Key rules:** never claims to have created or verified the Agent itself (the only Agent fact it
reports is the user's own typed answer); never hardcodes the prompt text or Neo4j credentials; a
failed connectivity check is a warning, not a hard stop — the console guidance still prints.

#### `GDX_SKILL_UPDATE_WEB`
**Purpose:** One-way push of the instrument/construct/variable/item catalog and every
interpretive mapping table from the local `13.onboarding.env/GODATAX7HPH.GDB` to the shared
`firebird.godatax.com` database.
**Trigger:** the user asks to publish/sync/update the local instrument catalog to the web
database.
**Inputs:** `--tables=T1,T2,...` (optional, scoped run — validated against a fixed allowlist, a
hard error if out of scope); both databases' connection settings.
**Outputs:** upserted rows on the web database, by primary key, across a fixed, explicit
allowlist (`CATALOG_TABLES` + `CONFIRMATION_TABLES` in `scripts/tables.js` — a prefix match would
be unsafe here, unlike the sibling export skill above).
**How it works:** for plain catalog tables, local content always overwrites web on a difference
(no confirmation bookkeeping). For the four interpretive mapping tables
(`GDX_PSY_SEPT_LEVEL_PSY_MAP`/`GDX_PSY_CHAKRA_VAR_MAP`/`GDX_TA_WAY_SEPT_MAP`/
`GDX_VT_VARIABLE_VIRTUE_MAP`), content still syncs unconditionally, but `NUMBER_CONFIRMATIONS`
only increments when the push's origin IP (auto-detected, or `GDX_SYNC_ORIGIN_IP` override)
differs from the IP already on record — the same origin re-confirming never inflates the count.
**Key rules:** **never** pushes anything that identifies or carries participant data
(`GDX_PSY_STUDY*`, `GDX_PSY_PERSON`, every `GDX_PSY_*_RESULT`/`ITEM_RESPONSE`, all `GDX_CC_*`,
`DW_DIM_PERSON`/`SESSION`, every `DW_FACT_*`) — enforced by an explicit denylist checked on every
read/write, independent of the allowlist; never pulls web back to local (one-way only); never
hardcodes credentials.

### `10.gdx.machine.learning/`

#### `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`
**Purpose:** Model 1 — suggests candidate septenary levels for every psychometric variable with
no existing mapping.
**Trigger:** the user asks which level an unmapped variable most likely belongs to, or wants
refreshed suggestions after the graph changes.
**Inputs:** `--study <slug>` (identity check only — the model's own subgraph is shared catalog
data across every study, not filtered by it); the Neo4j graph from step 9.
**Outputs:** `10.gdx.machine.learning/Link_Prediction_<slug>_<timestamp>.md`, a ranked top-N
(default 3) candidate-level list per unmapped variable.
**How it works:** materializes a `MAPS_TO_LEVEL` edge from the existing mapping table; projects
the catalog subgraph; computes FastRP embeddings (32-dim); **Track A** runs the real GDS
link-prediction pipeline purely to report an independent cross-validated AUCPR; **Track B**
pulls the same embeddings via a plain node-property read and trains a small in-script logistic
regression (Hadamard-product features) to actually rank candidates — a deliberate workaround for
a verified Aura Graph Analytics bug where `predict.*` mis-resolves relationship endpoints on a
multi-label projection.
**Key rules:** never auto-writes to `GDX_PSY_SEPT_LEVEL_PSY_MAP` (a human still adds the accepted
suggestion to `knowledge.js` by hand); never connects to Firebird; the report always states the
exact positive-example count (small-N caveat).

#### `GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT`
**Purpose:** Model 2 — unsupervised check of whether the graph's own structure supports the
septenary/chakra mapping.
**Trigger:** the user asks whether the philosophical framework's groupings agree with the
graph's own connectivity, or wants a fresh read after the graph changes.
**Inputs:** `--study <slug>` (identity check only, same reasoning as Model 1); the Neo4j graph.
**Outputs:** `10.gdx.machine.learning/Community_Detection_<slug>_<timestamp>.md`.
**How it works:** projects the same catalog subgraph **without** any label-derived shortcut edge
(unlike Model 1's `MAPS_TO_LEVEL`, which would defeat the point here); runs Louvain
(`gds.louvain.stream`); cross-checks with Label Propagation; for every non-trivial community,
reports which septenary levels/chakras appear inside it (exact match / spans several / none).
**Key rules:** fully read-only (writes nothing, anywhere); never treats a mismatch as a
refutation of the septenary framework — only as a prompt to investigate; never connects to
Firebird.

### `12.gdx.virtology/`

#### `GDX_SKILL_LINK_SUGGESTIONS`
**Purpose:** Ranks a study's lowest-scoring psychometric indicators and suggests, from the 33
Virtology virtues, which one addresses each.
**Trigger:** the user asks for virtue/link suggestions based on a specific study's data.
**Inputs:** `--study <slug>` (required); `DW_FACT_PSY_VARIABLE_RESULT` joined through
`DW_DIM_VARIABLE`/`DW_DIM_SEPTENARY_LEVEL`/`DW_DIM_PERSON`; the fixed
`scripts/virtue_knowledge.js` map (keyed by `.sav` column).
**Outputs:** `12.gdx.virtology/Link_Suggestions_<slug>_<timestamp>.md`.
**How it works:** reads the DW (read-only, never writes to Firebird/Neo4j), ranks variables
lowest-to-highest average score for that study only, looks up each in `virtue_knowledge.js`.
**Key rules:** never guesses a virtue — a variable with no map entry is reported
*"no suggestion (review)"*; every report repeats the same interpretive-not-clinical caveat used
throughout folders 3–5. Since 2026-10-15, both this skill and `GDX_SKILL_IDENTIFY_VIRTUES` read
the correspondence live from Firebird's `GDX_VT_VARIABLE_VIRTUE_MAP` (not a hand-written
`virtue_knowledge.js`, which is no longer read by either script) — a new row added anywhere is
visible to both immediately, with no cross-file sync problem.

#### `GDX_SKILL_IDENTIFY_VIRTUES`
**Purpose:** The mirror image of the skill above — ranks a study's 3 **strongest** psychometric
indicators and points to each one's virtue as a potential **strength already present**, not a
treatment target.
**Trigger:** the user asks which virtues a specific study's participants already show potential
for, based on their strongest scores.
**Inputs:** `--study <slug>` (required); the same `DW_FACT_PSY_VARIABLE_RESULT` join as the
sibling skill; `GDX_VT_VARIABLE_VIRTUE_MAP`'s `JUSTIFICATION_STRENGTH` and `SCALE_POLARITY`
columns.
**Outputs:** none — prints straight to the terminal, no `--out` flag on purpose (the deliberate
opposite of the sibling's file-writing behavior).
**How it works:** ranks indicators **polarity-aware** since 2026-10-18 — a `NEGATIVE`-polarity
variable's (e.g. Negative Emotions) *low* score, not its high one, counts as the strength;
polarity is read from `SCALE_POLARITY` (set once, by `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`,
never guessed here — defaults to `POSITIVE` only when no correspondence is recorded at all).
**Key rules:** never guesses a virtue (unmapped variable reported *"sem virtude identificada
(revisar)"*); never writes to Firebird/Neo4j or to a file; repeats the same interpretive-not-
clinical caveat as its sibling.

#### `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`
**Purpose:** Interactively associates one `GDX_PSY_VARIABLE` to one of the 33 Virtology virtues,
writing (or confirming, or correcting) a row in `GDX_VT_VARIABLE_VIRTUE_MAP` — one association at
a time, never a batch.
**Trigger:** the user wants to connect/map/link a specific variable to a virtue, or
confirm/corroborate/correct an existing association.
**Inputs:** `--variable`/`--variable-id`; `--virtue <1-33>`; `--behavior`;
`--justification-deficit` **and** `--justification-strength` (both always asked, never one
derived from the other); `--scale-polarity POSITIVE|NEGATIVE`; `--confidence` (default
`SPECULATIVE`); `--confirmed-by` and `--institution` (mandatory on every insert/confirm).
**Outputs:** one new, updated, or re-confirmed row in `GDX_VT_VARIABLE_VIRTUE_MAP`.
**How it works:** resolves the variable's `SAV_COLUMN` live from `DW_DIM_VARIABLE` (mandatory,
`NOT NULL`/`UNIQUE` on this table — refuses the insert rather than invent one if absent); checks
for an existing association first (`--confirm <id>` to corroborate — `NUMBER_CONFIRMATIONS += 1`,
content untouched; `--update <id>` to correct content without touching the confirmation count;
`--allow-duplicate` for a genuine second row); always a confirmed `--dry-run` before a real write.
**Key rules:** never invents the virtue, the behavior, either justification, the scale polarity,
or the confirmer/institution — every one is a question to the user, not a default (notably,
`--scale-polarity` has no accepted default from this script even though the column itself
defaults to `POSITIVE` at the schema level); never touches the 33-virtue catalog itself; never
runs DDL. The Virtology-specific sibling of `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS`
(§4 step 14), mirroring its interactive pattern exactly, kept separate because this table's shape
(no instrument column, two justifications, a polarity column) genuinely differs from the other
three `"_MAP"` tables.

### `13.onboarding.env/`

#### `GDX_SKILL_UP_FIREBIRD_DB`
**Purpose:** Creates a local Firebird database file (`GODATAX7HPH.GDB`) from the full DDL script,
with no Firebird Server/Guardian service and no wire protocol involved at all.
**Trigger:** the user asks to (re)build the local database from the DDL, or to stand up a fresh
onboarding database in this folder.
**Inputs:** `godatax_human_full_ddl_no_gdx_ead_firebird25.sql`; `GDS32.DLL` plus its runtime
companions (`msvcr80.dll`, `icuuc30.dll`/`icuin30.dll`/`icudt30.dll`, `firebird.msg`) in the same
folder (Windows resolves a DLL's own dependencies from the directory it was loaded from — none of
this works without all five sitting together).
**Outputs:** the `.gdb` file itself (deleted and rebuilt with `-Force`; the script refuses to run
against an existing file otherwise).
**How it works:** a PowerShell script P/Invokes the Firebird C API directly (`Add-Type`, all
`[DllImport]`s declared `StdCall` — declaring them `Cdecl` loads fine and even works for the
first several dozen calls before crashing with no managed exception, a real calling-convention
bug found during development), auto-relaunching itself under 32-bit PowerShell since `GDS32.DLL`
is x86-only. `-DryRun` parses and counts statements by kind without touching anything.
**Key rules:** on any failure mid-run, rolls back, detaches, and deletes the partially-created
file (its own just-created artifact, never pre-existing user data) rather than leaving a corrupt
database behind; no `.env` — every connection parameter (`-User`/`-Password`, default
`SYSDBA`/`masterkey`) is a safe, overridable default for a throwaway local file, not a shared
secret. Verified end-to-end against the 2026-10-19 DDL (427 statements: 55 sequences, 77 tables,
50 check constraints, 114 FKs, 66 indexes, 55 triggers).

### `14.metaphysical.measuring.instrument/`

#### `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS`
**Purpose:** Interactively associates one `GDX_PSY_VARIABLE` to a Septenary Constitution level, a
Way of Thomas Aquinas, or a Kundalini Chakra — one association at a time, as opposed to
`GDX_SKILL_LOAD_SEPT_MAPS_DB`'s whole-study batch.
**Trigger:** the user wants to connect/map/link one specific variable (e.g. an OT-7 metaphysical
variable, or any psychometric variable) to one of these three frameworks, or confirm/corroborate
one that already exists.
**Inputs:** `--variable`/`--variable-id`; `--target septenary|way|chakra` plus `--level <1-7>` /
`--way <1-5>` / `--chakra <1-7>`; `--behavior`; `--justification`; `--confidence` (default
`SPECULATIVE`); `--confirmed-by` and `--institution` (mandatory on every insert/confirm).
**Outputs:** one new/updated/re-confirmed row in `GDX_PSY_SEPT_LEVEL_PSY_MAP`,
`GDX_TA_WAY_SEPT_MAP`, or `GDX_PSY_CHAKRA_VAR_MAP` (a **new** table this skill's `--target
chakra` depends on — `GDX_PSY_CHAKRA` itself has no mapping columns of its own; must be applied
once before use).
**How it works:** resolves the variable and the target catalog row live, echoing the resolved
name back for confirmation; for `--target way`, never asks for a septenary level — it is read
from that Way's own existing conceptual row, so a variable's Way association can never
contradict the Way↔Level correspondence already on record; checks for an existing association
first (`--confirm`/`--update`/`--allow-duplicate`, same three-way branch as its Virtology
sibling); always a confirmed `--dry-run` before a real write.
**Key rules:** never invents the level/way/chakra, the behavior, the justification, or the
confirmer/institution; never touches the fixed catalogs themselves; never runs DDL. The general
pattern `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` (§5, `12.gdx.virtology/`) mirrors for the
virtue-specific case.

#### `GDX_SKILL_LIST_ASSOCIATIONS`
**Purpose:** Read-only, framework-wide inventory of every interpretive correspondence recorded
anywhere in the project — not scoped to a study.
**Trigger:** the user asks what correspondences the framework has already made between its
philosophical/esoteric models (or each other, or behavior/psychometric variables), or wants an
audit of those judgment calls.
**Inputs:** none beyond connection settings — no `--study` flag exists (passing one is a hard
error): every source is a catalog/reference table, identical regardless of which study is being
looked at.
**Outputs:** `14.metaphysical.measuring.instrument/Framework_Associations_<timestamp>.md`,
also printed to the console.
**How it works:** reads five Firebird tables — `GDX_PSY_CHAKRA` (chakra↔level, 7 rows, the one
table with neither `CONFIDENCE_LEVEL` nor `NUMBER_CONFIRMATIONS`), `GDX_PSY_CHAKRA_VAR_MAP`,
`GDX_TA_WAY_SEPT_MAP`, `GDX_PSY_SEPT_LEVEL_PSY_MAP`, and `GDX_VT_VARIABLE_VIRTUE_MAP` ×
`GDX_VT_VIRTUE` — cross-referencing by `.sav` column where a variable appears in more than one
section (e.g. `ENGAGvigor`), and summing `NUMBER_CONFIRMATIONS` per section and overall.
**Key rules:** never invents an association (every printed row is a real Firebird row); never
writes to Firebird/Neo4j (Markdown report only); repeats the same no-empirical-validity caveat
every correspondence table in the project already carries; has no knowledge file of its own — a
new correspondence added anywhere is picked up automatically on the next run.

### `16.hypotheses.non.fingo/`

#### `F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE` (MFS)
**Purpose:** Implements F1 of this project's multidimensional feature-space model — for one study,
assembles a per-person feature space `x(t)` from every perspective with real operationalized
data today (Ψ psychometrics, Φ physiology) and normalizes it into `z(t)` (z-score/min-max/robust).
**Trigger:** the user asks to build/generate the feature space for a study, as the first step of
this new mathematical model.
**Inputs:** `--study <slug>` (required); `--normalization zscore|minmax|robust` (default
`zscore`); `--include-graph` (also scans Neo4j, see below); `--intake-dir`; `--dry-run`.
**Outputs:** new rows in `GDX_HNF_FEATURE_SPACE_RUN`, `GDX_HNF_FEATURE_RUN_MEMBER`,
`GDX_HNF_FEATURE_VALUE` and `GDX_HNF_NORMALIZATION_PARAM` (one new, immutable run every
execution); insert-if-missing rows in the shared `GDX_HNF_PERSPECTIVE`/`GDX_HNF_FEATURE_DICTIONARY`
catalogs.
**How it works:** reads `GDX_PSY_VARIABLE_RESULT`/`GDX_PSY_APPLICATION` and
`GDX_CC_HRV_WINDOW`/`GDX_CC_SESSION`, preferring `DW_FACT_PSY_VARIABLE_RESULT`/
`DW_FACT_CC_HRV_WINDOW` (step 7) instead when that study is already loaded into the DW (checked
live); builds a dense per-(person, psychometric variable) matrix with explicit `IS_MISSING`
flags, and a sparse per-real-session matrix for physiology; computes and freezes this run's own
normalization parameters (`REFERENCE_SAMPLE='STUDY_SAMPLE'`); with `--include-graph`, also scans
each person's `GDX_PSY_PERSON` node in Neo4j for extra numeric properties, but only reports them
(never auto-catalogs a graph property into a perspective on its own).
**Key rules:** never computes a latent embedding, a distance, a CDI, a baseline, or anything from
F2–F8 (later skills in this folder); never turns a metaphysical category (M) into a feature;
never imputes/zero-fills a missing value; never updates a past run in place; never writes to
Neo4j.

---

## 6. Deep Dive — The Data Warehouse (Step 7)

**Location:** `7.multidimensional.database/`. **Scripts:** `godatax_human_dw_model_firebird25.sql`
(DDL), `godatax_human_dw_etl_firebird25.sql` (one-shot, whole-database ETL),
`godatax_human_dw_fk_gdx_cc_person_firebird25.sql` (the cross-schema FK below). **Doc:**
`GoDataX_Human_7_DW.md`.

### Purpose

A single star-schema layer relating the five separate OLTP perspectives (psychometric,
septenary, chakra, Five Ways, cardiac coherence) without replacing any of them — a read-oriented
reshaping that lets one query cross perspectives, e.g. *"for people whose Hardiness-Challenge
score is high, and whose corresponding septenary level is Buddhic, what chakra and which of
Aquinas's Five Ways share that level?"*

### The one rule that shapes the whole design

**`GDX_PSY_PERSON` is the single, central person table for the entire DW.** `DW_DIM_PERSON` is
sourced from it alone. `GDX_CC_PERSON` remains its own OLTP table, but is now **enforced at the
database level** to point into the same person space:

```sql
ALTER TABLE GDX_CC_PERSON
  ADD CONSTRAINT FK_GDX_CC_PERSON_DW_PERSON
  FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON (ID_PERSON);
```

From this point on, Firebird itself rejects a `GDX_CC_PERSON` row whose `ID_PERSON` doesn't
already exist in `DW_DIM_PERSON` — verified directly against the live database. One consequence:
`DW_DIM_PERSON` is no longer a purely read-only reporting copy — it must be loaded before any
`GDX_CC_PERSON` insert can succeed, and can no longer be freely truncated without first
considering `GDX_CC_PERSON`'s dependency on it.

### ER Diagram — the star schema

```mermaid
erDiagram
    DW_DIM_PERSON ||--o{ DW_FACT_PSY_ITEM_RESPONSE : ""
    DW_DIM_ITEM ||--o{ DW_FACT_PSY_ITEM_RESPONSE : ""
    DW_DIM_INSTRUMENT ||--o{ DW_FACT_PSY_ITEM_RESPONSE : ""
    DW_DIM_PERSON ||--o{ DW_FACT_PSY_VARIABLE_RESULT : ""
    DW_DIM_VARIABLE ||--o{ DW_FACT_PSY_VARIABLE_RESULT : ""
    DW_DIM_PERSON ||--o{ DW_FACT_CC_HRV_WINDOW : ""
    DW_DIM_SESSION ||--o{ DW_FACT_CC_HRV_WINDOW : ""
    DW_DIM_DATE ||--o{ DW_FACT_CC_HRV_WINDOW : ""
    DW_DIM_PERSON ||--o{ DW_DIM_SESSION : ""
    DW_DIM_DEVICE ||--o{ DW_DIM_SESSION : ""
    DW_DIM_CONSTRUCT ||--o{ DW_DIM_VARIABLE : ""
    DW_DIM_INSTRUMENT ||--o{ DW_DIM_VARIABLE : ""
    DW_DIM_SEPTENARY_LEVEL ||--o{ DW_DIM_VARIABLE : "optional — the hinge"
    DW_DIM_SEPTENARY_LEVEL ||--o{ DW_DIM_CHAKRA : "1:1"
    DW_DIM_SEPTENARY_LEVEL ||--o{ DW_DIM_FIVE_WAY : "N:1"
    DW_DIM_INSTRUMENT ||--o{ DW_DIM_ITEM : ""

    DW_DIM_PERSON {
        bigint ID_PERSON PK "= GDX_PSY_PERSON.ID_PERSON"
        varchar EXTERNAL_IDENTIFIER
        varchar ANONYMOUS_CODE
        bigint ID_STUDY
        varchar STUDY_TITLE
    }
    DW_DIM_INSTRUMENT {
        bigint ID_INSTRUMENT PK
        varchar NAME
        varchar VERSION
        varchar TYPE
    }
    DW_DIM_CONSTRUCT {
        bigint ID_CONSTRUCT PK
        varchar NAME
        varchar DOMAIN
    }
    DW_DIM_SEPTENARY_LEVEL {
        bigint ID_SEPTENARY_LEVEL PK
        smallint ORDER_NUM
        varchar NAME
        varchar NATURE
    }
    DW_DIM_CHAKRA {
        bigint ID_CHAKRA PK
        smallint ORDER_NUM
        varchar SANSKRIT_NAME
        varchar COMMON_NAME
        bigint ID_SEPTENARY_LEVEL FK
    }
    DW_DIM_FIVE_WAY {
        bigint ID_WAY PK
        smallint ORDER_NUM
        varchar LATIN_NAME
        varchar ENGLISH_NAME
        bigint ID_SEPTENARY_LEVEL FK
    }
    DW_DIM_VARIABLE {
        bigint ID_VARIABLE PK
        varchar NAME
        varchar SAV_COLUMN
        bigint ID_CONSTRUCT FK
        bigint ID_INSTRUMENT FK
        bigint ID_SEPTENARY_LEVEL FK "optional — reaches chakra/way"
        varchar SEPT_LEVEL_CONFIDENCE
    }
    DW_DIM_ITEM {
        bigint ID_ITEM PK
        bigint ID_INSTRUMENT FK
        integer ITEM_ORDER
        varchar RESPONSE_TYPE
    }
    DW_DIM_DEVICE {
        bigint DEVICE_ID PK
        varchar MANUFACTURER
        varchar MODEL_NAME
        varchar DEVICE_TYPE
    }
    DW_DIM_SESSION {
        bigint SESSION_ID PK
        bigint ID_PERSON FK
        bigint DEVICE_ID FK
        varchar SIGNAL_TYPE
        varchar PROTOCOL_NAME
        timestamp STARTED_AT
    }
    DW_DIM_DATE {
        integer DATE_KEY PK
        date FULL_DATE
        smallint YEAR_NUM
        smallint MONTH_NUM
    }
    DW_FACT_PSY_ITEM_RESPONSE {
        bigint FACT_ID PK
        bigint ID_PERSON FK
        bigint ID_ITEM FK
        bigint ID_INSTRUMENT FK
        numeric NUMERIC_VALUE
    }
    DW_FACT_PSY_VARIABLE_RESULT {
        bigint FACT_ID PK
        bigint ID_PERSON FK
        bigint ID_VARIABLE FK
        numeric RAW_SCORE
        numeric STANDARDIZED_SCORE
        numeric PERCENTILE
    }
    DW_FACT_CC_HRV_WINDOW {
        bigint FACT_ID PK
        bigint ID_PERSON FK
        bigint SESSION_ID FK
        integer DATE_KEY FK
        numeric RMSSD_MS
        numeric SDNN_MS
        numeric COHERENCE_INDEX
        varchar STRESS_CLASS
    }
```

**No dimension key is reinvented** where the source already has a clean `BIGINT` PK (e.g.
`DW_DIM_PERSON.ID_PERSON = GDX_PSY_PERSON.ID_PERSON`) — the only *generated* dimension is
`DW_DIM_DATE` (2020-01-01…2030-12-31), because no source has a natural date key; `DATE_KEY = -1`
is the reserved "no date" member used by every psychometric fact (the `.sav` carries no calendar
date).

**How a psychometric fact reaches the metaphysical/energetic perspectives:**
`DW_FACT_PSY_VARIABLE_RESULT → DW_DIM_VARIABLE.ID_SEPTENARY_LEVEL → DW_DIM_SEPTENARY_LEVEL →
(DW_DIM_CHAKRA / DW_DIM_FIVE_WAY)`. That single FK on `DW_DIM_VARIABLE` — not duplicated on the
fact — is what lets one query relate a score to "its" chakra and "its" way of Aquinas at once.

**Extension — the virtue/chakra/way bridges (`dw_virtue_chakra_way_bridges_firebird25.sql`,
this folder):** not shown in the ER diagram above (added after it). A 13th dimension,
`DW_DIM_VIRTUE` (mirroring `GDX_VT_VIRTUE`'s 33 rows), plus three pure junction tables —
`DW_BRIDGE_VARIABLE_VIRTUE`, `DW_BRIDGE_VARIABLE_CHAKRA`, `DW_BRIDGE_VARIABLE_WAY` — each a
composite-PK `(ID_VARIABLE, ID_<other>)` link with no surrogate key of its own, the same
plain-junction shape as `GDX_PSY_INSTRUMENT_CONSTRUCT` elsewhere in the project. Bridges, not
three more single FK columns on `DW_DIM_VARIABLE` (the way `ID_SEPTENARY_LEVEL` works), because
these three correspondences are genuinely many-to-many in the live data — e.g. the IPIP-VIA
"Forgiveness" variable already maps to three different virtues; a single FK column would
silently drop every mapping past the first. Loaded by `GDX_SKILL_LOAD_NEW_STUDY_DW` alongside
every other global/bootstrap-once dimension (never study-scoped), and picked up by
`GDX_SKILL_GODATAX_HUMAN7_BY_SPU`'s `DW_BRIDGE_*`-aware introspection with no further code change
there.

### Validated load (real numbers, `godatax.human`)

| Table | Rows |
|---|---|
| `DW_DIM_DATE` | 4,019 |
| `DW_DIM_PERSON` | 423 |
| `DW_DIM_INSTRUMENT` | 11 |
| `DW_DIM_VARIABLE` | 21 (16 with a resolved septenary level) |
| `DW_DIM_ITEM` | 138 |
| `DW_DIM_SESSION` | 5 |
| `DW_FACT_PSY_ITEM_RESPONSE` | 58,374 |
| `DW_FACT_PSY_VARIABLE_RESULT` | 8,882 |
| `DW_FACT_CC_HRV_WINDOW` | 5 |

### Two loading modes

| Script | Shape | When to use |
|---|---|---|
| `godatax_human_dw_etl_firebird25.sql` | Plain SQL, whole-database, **not idempotent** (truncate-then-reload) | Building the DW once, from empty, across every study already in the OLTP schemas |
| `GDX_SKILL_LOAD_NEW_STUDY_DW` | Node.js, per-study, **insert-if-missing** | The ongoing case — a newly onboarded study needs its data added without disturbing any other study already in the DW |

### Known gaps (from `GoDataX_Human_7_DW.md` §7)

- The whole-database ETL is not idempotent — re-running it means truncating `DW_*` first, and
  the new `FK_GDX_CC_PERSON_DW_PERSON` constraint now means `GDX_CC_PERSON`/`SESSION` must be
  cleared *before* `DW_DIM_PERSON` can be truncated.
- `GDX_CC_SESSION.SESSION_ID` deliberately has **no** FK to `DW_DIM_SESSION` (it would be
  circular — `DW_DIM_SESSION` is populated *from* `GDX_CC_SESSION`).
- `AnoOrg`, `SucProfFin`, `CondSocie`, `RedTap` are deliberately excluded from the septenary
  mapping — contextual/environmental variables, not consciousness levels.

---

## 7. Deep Dive — The Knowledge Graph (Step 9)

**Location:** `9.knowledge.graph/`. **Doc:** `GoDataX_Human_7_Knowledge_Graph.md`.

### Why a graph, not just the relational tables

Folders 2–8 store everything as relational tables — correct for OLTP writes and for the
SQL-shaped questions the dashboards ask. But the ML models in folder 10 need a **graph
embedding** — a numeric vector per node encoding not just its own columns but its position in
the *whole* network of relationships around it. A relational `JOIN` can *walk* from a variable to
its construct to its septenary level; an embedding *encodes* that walk as a single vector, which
is what a link-prediction or community-detection algorithm actually consumes.

### The mapping rule — generic, not hand-mapped

- **Node** = one table, label = the table name exactly as Firebird has it.
- **Node property** = one column (BLOB `SUB_TYPE TEXT` columns read as plain strings).
- **Node identity (`gdx_key`)** = the table's own PK (composite keys joined with `::`). Every
  write is a Cypher `MERGE` on this key — idempotent, re-runnable.
- **Relationship** = one FK constraint whose child *and* parent are both in scope; type = the
  constraint's own name, direction child → parent. A `NULL` FK produces no relationship.
- Discovered **live** every run via Firebird's `RDB$` system catalog (`scripts/introspect.js`) —
  a new table under an in-scope prefix (`GDX_PSY_*`, `GDX_TA_*`, `GDX_CC_*`, `DW_DIM_*`,
  `DW_FACT_*`) appears in the graph automatically, with no code change.

**A worked example** — one row of `GDX_PSY_VARIABLE_RESULT` (person 784's Emotional Exhaustion
score):

```
(:GDX_PSY_VARIABLE_RESULT {gdx_key:"...", RAW_SCORE:4.0})
  -[:FK_GDX_PSY_VR_APPLICATION]-> (:GDX_PSY_APPLICATION {gdx_key:"784", ID_STUDY:1})
  -[:FK_GDX_PSY_VR_VARIABLE]->    (:GDX_PSY_VARIABLE {gdx_key:"22", NAME:"Emotional Exhaustion"})
                                       -[:FK_GDX_PSY_VARIABLE_CONSTRUCT]-> (:GDX_PSY_CONSTRUCT {gdx_key:"9"})
```

### Scoping — `--study <slug>` (since 2026-09-18)

23 tables are filtered to one study's rows (via `ID_STUDY`/`ID_PERSON`/`ID_APPLICATION`/
`SESSION_ID`/`ID_EVALUATION`, whichever applies); 32 shared reference/catalog tables (septenary
levels, chakras, Five Ways, instrument/construct/variable/item definitions, devices) are always
exported in full, every run — they are small (tens of rows) next to the fact tables this matters
for (tens of thousands). Because the graph accumulates (`MERGE`, not truncate), running the skill
again for a *second* study adds that study's rows without touching the first study's — a
different model from the dashboards' or DW loader's one-set-per-run behavior.

### Real, validated numbers (2026-09-21, live query)

| | |
|---|---|
| Tables in scope | 55 (23 study-scoped, 32 global/reference) |
| FK relationships in scope | 70 |
| Nodes written | **141,706** |
| Relationships written | **331,771** |
| Largest tables | `GDX_PSY_ITEM_RESPONSE`/`DW_FACT_PSY_ITEM_RESPONSE`: 58,374 rows each |

### Known caveats

- `RAW_SCORE` is not on a uniform scale across variables (some 0–4, most 1–5) and the graph
  carries it through unchanged — fine for structure-only embeddings, but a future model that
  feeds `RAW_SCORE` itself as a node feature must normalize per variable first.
- Only one study exists today, so the accumulate-don't-mix scoping behavior is validated only in
  the trivial single-study case.
- Cardiac-coherence coverage is still one participant (`SPSS-784`) — the "cluster people by
  combined profile" ML extension has nothing meaningful to cluster yet.

---

## 8. Deep Dive — Machine Learning Models (Step 10)

**Location:** `10.gdx.machine.learning/`. **Docs:**
`Septenary_Link_Prediction_and_Community_Detection.md` (full design + real implementation
notes), `Data_Science_Workflow_Canvas.md` (one-page-per-model canvas, also published on the
GoDataX website). Both models run on **Neo4j Graph Data Science (GDS)** — no separate
Python/pandas ETL for the embedding step itself.

### Model 1 — Link Prediction

**Question:** which septenary level should a *new*, still-unmapped variable most likely belong
to? **Learning type:** supervised (18–19 labeled positive examples). **Method:** FastRP node
embeddings over the catalog subgraph (`GDX_PSY_VARIABLE`, `CONSTRUCT`, `INSTRUMENT`,
`SEPTENARY_LEVEL`, `CHAKRA`, `TA_WAY`, and the real mapping edges), then a classifier scoring
every `(unmapped variable, level)` candidate pair.

**The honest caveat, front and center:** 18–19 positive examples spread across 7 classes is a
small training set — some levels have only 1–3 supporting examples (Atmic/Spirit has exactly
1). Mitigations: k-fold cross-validation is mandatory (never trust one train/test split); a
confidence threshold turns a weak score into "no suggestion" rather than a manufactured guess;
the label set is expected to grow over time as `GDX_SKILL_LOAD_SEPT_MAPS_DB` records new
judgment calls. **The model is a triage aid, never a classifier trusted unsupervised** — its
output only ever feeds `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s human-reviewed `knowledge.js`.

**Real first run (2026-09-19):** 22 `GDX_PSY_VARIABLE` nodes, 18 mapped, 4 unmapped (all four are
the excluded-by-design Organizational Anomie block + Red Tape — correctly showing *no* strong
single winner). Independent GDS-pipeline AUCPR: **0.75 (test), ~0.78 (validation avg)**.

**A real platform bug, worked around:** Neo4j Aura Graph Analytics' link-prediction
`predict.stream`/`predict.mutate` mis-resolves relationship endpoints on a multi-label graph
projection (verified: `predict.mutate` reports the exactly correct candidate count, 136, but
`gds.graph.relationship.write` then persists them onto arbitrary same-label node pairs). The
skill works around this by pulling FastRP embeddings via a plain node-property read and training
a ~30-line in-script logistic regression instead of trusting `predict.*` — the real GDS pipeline
is still run purely to report its AUCPR as an independent quality signal.

### Model 2 — Community Detection

**Question:** do variables/instruments naturally group the way the septenary/chakra/Five-Ways
framework says they should? **Learning type:** unsupervised — no labels needed, sidesteps
Model 1's small-N problem entirely. **Method:** Louvain (primary) + Label Propagation
(cross-check) over the same catalog subgraph, **without** any label-derived shortcut edge (unlike
Model 1's materialized `MAPS_TO_LEVEL` — handing the algorithm a label-derived edge here would
defeat the point of testing whether the *unlabeled* structure agrees).

Three readable outcomes: a community matching one level/chakra almost exactly (external
validation), a community spanning several levels (a prompt to investigate, not proof the model
is wrong), or a level's variables split across multiple communities (a concrete, checkable
version of the project's own least-certain mappings).

**Real run:** Louvain found **9 non-trivial communities**. Most are clean structural
confirmations (the three satisfaction-family instruments cluster together on Astral/Manipura;
Hardiness's Control, CAAS's Control, and Perceived Control of Life cluster on Lower
Mental/Anahata). One community is the predicted "spans levels" case: the Engagement Scale's
`Dedication` and `Absorption` cluster with each other but span Higher Mental and Buddhic — a
correct structural detection that this one instrument's two variables belong together *and* that
no single level captures both. Label Propagation agreement was high (mostly 100%) — both
unsupervised methods found the same structure independently.

### Model comparison

| | Model 1 — Link Prediction | Model 2 — Community Detection |
|---|---|---|
| Question | "Which level for this new variable?" | "Do groupings match structurally?" |
| Learning | Supervised (small-N) | Unsupervised |
| Main risk | Overfitting / false confidence | Structural clusters mistaken for psychological meaning |
| Output | Ranked suggestions, human review | Cluster assignments, human interpretation |
| GDS algorithm | `fastRP` + link-prediction pipeline | `louvain` + `labelPropagation` |

**Suggested order:** Model 2 first (no labeled data needed, low risk, immediate); Model 1 second,
revisited as the labeled set grows.

---

## 9. Deep Dive — The LLM Knowledge-Graph Agent (Step 11)

**Location:** `11.gdx.llm.agent.mcp/prompt.instruction.txt` — a single system-prompt file for an
LLM assistant connected to the Neo4j knowledge graph (step 9). No dedicated skill; this is the
prompt used by an external agent/chat integration.

Core rules the prompt enforces:

1. Answer only from what the connected Neo4j graph actually contains — never invent a
   relationship, measurement, instrument, result, or interpretation.
2. If the graph doesn't have enough information, say so explicitly rather than filling the gap.
3. **Always distinguish** five categories in any answer: scientifically measurable data,
   calculated indicators, psychological interpretations, philosophical/metaphysical
   interpretations, and energetic/traditional models.
4. **Never** present a metaphysical/philosophical/energetic association as a scientifically
   validated causal relationship.
5. **Never** provide a medical or psychological diagnosis — the assistant is explicitly
   educational/analytical, not a substitute for a qualified professional.
6. Protect participant-identifying data; disclose it only to an explicitly authorized user.
7. When useful, show the actual graph path (entities and relationships) behind an answer.
8. Respond in the same language the user used; if asked to translate, translate the entire
   answer including retrieved values.

**Preferred response structure:** direct answer → evidence found in the graph → relevant
relationships/graph path → scientific-or-interpretive classification → limitations.

This is the same "empirical ≠ interpretive" discipline the rest of the project enforces at the
schema level (§11) — here enforced at the prompt level for a conversational interface.

---

## 10. Deep Dive — Virtology & Link Suggestions (Step 12)

**Location:** `12.gdx.virtology/`. **Doc:** `Virtology_Knowledge_Base.md`.

### What Virtology claims to be

A "clinical-philosophical" school founded by Eduardo Casarotto. Central reframing: a *virtue* is redefined away from a moral concept into a
neurological one — "a set of neural networks working in a specific configuration," trainable
through repetition until it operates without effort.

**Two hypothesized primitive neural systems** the virtues are claimed to counteract:

| System | Focus | Claimed manifestations |
|---|---|---|
| **SNO** — Neurofunctional Pride System | Reward circuit, self-referential thinking | Power-seeking, vanity, need for approval, controlling behavior, and (paradoxically) timidity |
| **SNE** — Neurofunctional Selfishness System | Prefrontal self/other cost-benefit calculation | Aggression, addiction, indifference, controlling behavior, corruption |

**The 33 virtues** are given as a complete, ordered list (Humility declared explicitly
foundational — *"without it none of the others can be sustained"*) — the ordering encodes
dependency, not flat categories, closer in spirit to the Five Ways' step-by-step structure than
to the chakras' 7 independent, parallel centers.

**Open gaps**, honestly documented: no full inventory of the claimed "Evolution Levels"; no
definition of the *Lei do Fluxo* formula's `LV` (Life Laws) term; no official virtue→SNO/SNE
mapping exists from the source at all.

### `GDX_SKILL_LINK_SUGGESTIONS` — applying this to real data

Despite the knowledge base itself having no official schema, a **project-authored, narrower**
mapping exists: `GDX_VT_VARIABLE_VIRTUE_MAP` (Firebird, `12.gdx.virtology/virtology_model_firebird25.sql`)
relates a psychometric variable directly to one of the 33 virtues (not virtue↔SNO/SNE, which
stays an open gap). Real validated run, `ID_STUDY=1`, top lowest indicators:

| Indicator (level) | Score | Suggested virtue |
|---|---|---|
| Vigor — Engagement (Vital/Etheric) | 2.71 | Perseverança (Perseverance) |
| Absorption — Engagement (Buddhic) | 2.75 | Tudo Somos Um (We Are All One) |
| Challenge — Hardiness (Buddhic) | 2.81 | Busca do Melhoramento (Pursuit of Improvement) |
| Positive Emotions (Vital/Etheric) | 3.00 | Gratidão (Gratitude) |
| **Emotional Exhaustion (Physical)** | 3.74 | **no suggestion (review)** |

The unresolved row is the "never guesses" rule working as intended: `Emotional Exhaustion` was
never in the original `.sav` at all (it was computed later from raw item responses), so it has
no `.sav` column for `virtue_knowledge.js`'s current lookup key to match.

---

## 11. Cross-Cutting Design Principles

Several documents repeat, in different words, the same rules — worth naming once:

- **Never invent missing data.** A gap is always documented as a gap (an `UNKNOWN` mapping, a
  *"no suggestion (review)"* row, an `UNMATCHED`/`MISSING` report line), never filled with a
  guess.
- **"Not zero, not missing, structurally absent."** The phrase used for a heatmap cell with no
  mapped instrument at a level — the same reasoning applies to any relationship that simply
  doesn't exist in the schema yet.
- **Empirical finding ≠ interpretive reading.** Folders 3, 4, 5 and 12 are explicit: relating a
  scientific instrument to a chakra or a virtue is a conceptual organizing tool inside GoDataX,
  never a scientific or doctrinal claim. The LLM agent prompt (§9) enforces the same distinction
  at the conversational layer.
- **Secrets are never committed.** Every skill that touches Firebird/Neo4j reads credentials from
  environment variables (`.env`, gitignored — only `.env.example` is committed).
- **Idempotency and reversibility.** Nearly every database-writing skill supports `--dry-run`, an
  "already loaded" guard, and never deletes data — even when "fixing" something (e.g. the
  Physical-level gap closed by computing a real score from existing raw responses, not by
  inserting an invented number).
- **One person, one identity** (see §1) — enforced first as a convention, then as an actual
  database `FOREIGN KEY` (`FK_GDX_CC_PERSON_DW_PERSON`).
- **`--study <slug>` scoping.** Every skill built or touched since 2026-09-17/18 (dashboards, DW
  incremental loader, knowledge-graph export, link suggestions) resolves the same
  `new_study_intake/<slug>/intake.json` → `GDX_PSY_STUDY.ID_STUDY` chain, so a second study never
  silently blends into a chart, a DW load, or a report meant for the first one.

---

## 12. Architecture Extension — Environmental, Energetic & Anomalous Phenomena Sensing

> Source: slides 84–90 of `GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataXHuman7-Br2.odp`
> ("Environmental, Energetic & Anomalous Phenomena Measurement"). **Status as of this pass: the
> relational schema has been written and is real** —
> `15.environmental.anomalous.phenomena/environmental_anomalous_phenomena_model_firebird25.sql`
> (15 tables, `GDX_PH_*` prefix) exists in this repository, following most of §12.6's own
> recommendations below. **What is still missing**: no onboarding/loader skill, no `--study`
> scoping column, and no wiring into the DW (step 7) or the knowledge-graph export (step 9) — so
> this schema can be applied to a database today, but nothing in the pipeline reads or writes it
> yet. The rest of this section (§12.1–§12.5) is kept as originally written, reconstructed from
> the slide deck's diagrams; §12.6 is updated to show which of its four recommendations the real
> DDL actually followed.

### 12.1 Concept

The framework proposes recording environmental/anomalous signals that are not perceptible to the
naked eye, on the **same unified timeline** as the psychometric, physiological (step 6) and
cardiac-coherence sensors already implemented — so simultaneities and temporal patterns between
a person's internal state and their surrounding environment can be observed (explicitly:
*"correlation, not proof of causation"*).

```mermaid
flowchart LR
    A["Luminosity & Vibration"] --> T((Unified Timeline))
    B["Motion"] --> T
    C["Audio"] --> T
    D["Electric & Magnetic Fields"] --> T
    E["Radiation & RF"] --> T
    F["Thermal Imaging"] --> T
    G["Air Ionization"] --> T
    H["Photonic Indicators"] --> T
    T --> X["Correlated with:<br/>Psychometric · Physiological · Cardiac-Coherence data"]
```

### 12.2 The 21 sensor dimensions

Every measurement is explicitly framed as **instrumental** (a physical, objective reading) —
interpretations such as "presence," "entity," or "communication" belong to a separate,
clearly-labeled analytical/hypothetical layer, never mixed into the raw measurement.

| # | Category | Dimension | Sensor / Equipment | What it objectively measures |
|---|---|---|---|---|
| 1 | Electric, Magnetic & EM | Ambient electric field | E-field meter / electrometer | Electric field variation |
| 2 | Electric, Magnetic & EM | Ambient magnetic field | Fluxgate magnetometer / OPM | Magnetic intensity/variation |
| 3 | Electric, Magnetic & EM | Geomagnetic | Triaxial magnetometer | Earth field X/Y/Z |
| 4 | Electric, Magnetic & EM | RF / Electromagnetic | SDR / spectrum analyzer | Frequency, power, modulation |
| 5 | Electric, Magnetic & EM | VLF / ULF | VLF/ULF receiver | Very-low-frequency phenomena |
| 6 | Acoustic & Vibration | Acoustic (audible) | Measurement microphone | Audible sound |
| 7 | Acoustic & Vibration | Infrasound | Infrasound microphone/sensor | Frequencies < 20 Hz |
| 8 | Acoustic & Vibration | Ultrasound | Ultrasonic microphone | Frequencies > 20 kHz |
| 9 | Acoustic & Vibration | Vibration | Accelerometer / geophone | Mechanical movement |
| 10 | Optical, Thermal & Photonic | Thermal | FLIR camera (A50/A70) | Temperature & thermal distribution |
| 11 | Optical, Thermal & Photonic | Infrared (optical) | IR/NIR camera | Infrared radiation |
| 12 | Optical, Thermal & Photonic | Visible (low light) | Low-light camera | Light & movement |
| 13 | Optical, Thermal & Photonic | Ultraviolet | UV camera/detector | UV radiation |
| 14 | Optical, Thermal & Photonic | Photonic | PMT / EMCCD | Photon counts (ultra-weak photon emission) |
| 15 | Environmental & Physico-chemical | Ionizing radiation | Geiger counter / dosimeter | Alpha, beta, gamma |
| 16 | Environmental & Physico-chemical | Electrostatic | Electrostatic field meter | Electrostatic field/charge |
| 17 | Environmental & Physico-chemical | Air ionization | Ion counter | Positive/negative ions |
| 18 | Environmental & Physico-chemical | Atmospheric | Temp./humidity/pressure station | Environmental conditions |
| 19 | Environmental & Physico-chemical | CO₂ / VOC / gases | Environmental sensors | Air composition |
| 20 | Integration & Time | Luminosity | Lux meter | Light intensity |
| 21 | Integration & Time | Temporal | GPS clock / NTP / PTP | Precise time, sensor sync |

### 12.3 Proposed relational database model (as designed in the slides)

The slide deck's own ER diagram ("Registration & Configuration" / "Acquisition & Events" /
"Analysis & Interpretation" / "Observations & Media" / "Support & References"), reconstructed
below in Mermaid. Table and column names are exactly as drawn on the slide (lowercase
`snake_case`) — §12.5 recommends renaming these to match this repo's existing convention before
implementation.

```mermaid
erDiagram
    locations ||--o{ sensors : hosts
    sensor_types ||--o{ sensors : classifies
    locations ||--o{ environment_conditions : "measured at"
    locations ||--o{ sessions : hosts
    sessions ||--o{ events : records
    sensors ||--o{ events : detects
    events ||--o{ media_files : "has attachment"
    sensors ||--o{ media_files : captured_by
    events ||--o{ event_tags : "tagged with"
    events ||--o{ observations : yields
    sensors ||--o{ observations : produces
    events ||--o{ analysis_results : "analyzed as"
    analysis_results ||--o{ interpretations : "interpreted as"
    sensors ||--o{ sensor_calibration : "calibrated via"

    locations {
        int location_id PK
        string name
        string type "indoor/outdoor"
        float latitude
        float longitude
        float altitude
    }
    sensor_types {
        int sensor_type_id PK
        string name
        string dimension
        string unit
    }
    sensors {
        int sensor_id PK
        int sensor_type_id FK
        int location_id FK
        string model
        string manufacturer
        string status
    }
    environment_conditions {
        int env_cond_id PK
        int location_id FK
        datetime timestamp
        float temperature
        float humidity
        float co2
        float voc
    }
    sessions {
        int session_id PK
        int location_id FK
        datetime start_time
        datetime end_time
        string type "baseline/experiment"
    }
    events {
        int event_id PK
        int session_id FK
        datetime event_time
        string event_type "question/stimulus/etc"
        string expected_response
    }
    media_files {
        int media_id PK
        int event_id FK
        int sensor_id FK
        string file_path
        string file_type
    }
    event_tags {
        int event_tag_id PK
        int event_id FK
        string tag
    }
    observations {
        int observation_id PK
        int event_id FK
        int sensor_id FK
        datetime timestamp
        float value_numeric
        string value_text
        string quality_flag
    }
    analysis_results {
        int analysis_id PK
        int event_id FK
        string algorithm
        float anomaly_score
        string result_summary
    }
    interpretations {
        int interpretation_id PK
        int analysis_id FK
        string category "environmental/paranormal/etc"
        string hypothesis
        string confidence_level
    }
    sensor_calibration {
        int calibration_id PK
        int sensor_id FK
        date calibration_date
        string parameters
        date valid_until
    }
```

Plus two standalone support tables: `users` (`user_id` PK, `role`, `email`) and `reference_data`
(`ref_id` PK, `dimension`, `parameter`, `normal_min`, `normal_max`, `unit`, `source`) — normal
operating ranges per sensor dimension, used by the analysis layer to flag a reading as anomalous.

### 12.4 Proposed hardware & data-flow architecture

**Two-tier acquisition, matching sensor bandwidth to compute needs:**

- **Raspberry Pi 5 — acquisition gateway.** Collects, pre-processes and time-synchronizes the
  lower-bandwidth sensors over I²C/SPI/UART: environmental (temperature/humidity/pressure/CO₂/
  VOC), luminosity, vibration/motion (accelerometer, geophone), audio (microphone, infrasound,
  ultrasound), electric/electrostatic field, magnetic field, radiation (Geiger), air ionization.
- **Mini PC — heavy processing / scientific instruments.** Handles USB/Ethernet-connected
  instruments needing more compute or bandwidth: RF/SDR (HackRF), thermal imaging (FLIR),
  photonics (photon counter/PMT), and optionally human physiological sensors (an
  ECG/HRV sensor, a respiration belt) for direct correlation with step 6's data.
- The two devices connect over **Ethernet**; every sensor stream carries a GPS/NTP/PTP timestamp
  so every reading across both devices can be aligned on one precise timeline.

```mermaid
flowchart LR
    Sensors["Sensors<br/>(21 dimensions)"] --> Gateway["Raspberry Pi 5 / Mini PC<br/>Acquisition, sync, pre-processing"]
    Gateway --> DB["Database<br/>Secure, structured storage"]
    DB --> Corr["Temporal Correlation<br/>Multisensor analysis"]
    Corr --> Anom["Anomaly Detection<br/>AI & algorithms"]
    Anom --> Interp["Interpretive Layer<br/>Visualization, reports, insights"]
```

### 12.5 Recommended interpretation pipeline (from the slides)

A 4-stage discipline for turning a raw signal into a labeled hypothesis, never skipping a stage:

1. **Raw capture** — sensors record observable signals per their own physical nature (audio, RF,
   infrasound, electric/magnetic/thermal/radiation/photon changes).
2. **Processing** — noise reduction → voice detection → voice/noise separation → frequency &
   origin analysis → automatic transcription (when intelligible) → precise timestamping.
3. **Multisensor correlation** — cross an event against every other channel at the same instant
   (e.g. an audio spike simultaneous with a magnetic shift, a thermal change, and a photon-count
   peak) — *"simultaneity makes an event relevant, it does not prove a common cause."*
4. **Interpretive layer** — classifies the probable origin (human speech identified /
   electronic-RF source / unidentified vocal pattern / ambiguous audio / noise / **possible
   communication — hypothesis**) while keeping *measured* and *interpreted* explicitly separate
   — the same **"Measured ≠ Interpreted"** rule already enforced project-wide (§11).

### 12.6 How this integrates with the existing `GDX_HUMAN` architecture — recommended then, checked now

The slide deck designed this as a standalone system. Four changes were originally recommended to
make it a first-class citizen of `GDX_HUMAN` rather than a parallel silo; the real DDL
(`15.environmental.anomalous.phenomena/environmental_anomalous_phenomena_model_firebird25.sql`)
now exists, so each recommendation below is checked against what was actually built:

1. **Rename to the project's schema convention.** ✅ *Followed, with a different prefix than
   recommended.* Every table uses `UPPER_SNAKE_CASE` with `BIGINT` surrogate keys assigned by a
   `SEQ_GDX_PH_*` sequence + `BEFORE INSERT` trigger — the same Firebird 2.5 pattern every other
   schema uses. The chosen prefix is **`GDX_PH_`** (Environmental/**Ph**enomena), not the
   `GDX_ENV_*` this section originally suggested — `GDX_PH_LOCATION`, `SENSOR_TYPE`, `SENSOR`,
   `ENVIRONMENT_CONDITION`, `SESSION`, `EVENT`, `MEDIA_FILE`, `EVENT_TAG`, `OBSERVATION`,
   `ANALYSIS_RESULT`, `INTERPRETATION`, `SENSOR_CALIBRATION`, `USER`, `REFERENCE_DATA`, plus one
   table not in the original slides at all, `GDX_PH_EVENT_VAR_MAP` (added per a later,
   separate instruction, keyed on `GDX_PH_EVENT`).
2. **Link back to the single central person.** ✅ *Followed, more broadly than recommended.* A
   nullable `ID_PERSON BIGINT` FK straight into `GDX_PSY_PERSON` was added not just to
   `GDX_PH_SESSION` as originally suggested, but to **all 15 tables** — including pure
   catalog/configuration ones (`GDX_PH_LOCATION`, `SENSOR_TYPE`, `SENSOR`, `USER`,
   `REFERENCE_DATA`) where it isn't strictly required by the data's own meaning, by explicit
   design decision, mirroring how `GDX_PSY_STUDY_PARTICIPANT`/`APPLICATION` link participant
   data to `GDX_PSY_PERSON` elsewhere — just extended here to the whole module. Nullable
   everywhere, never `NOT NULL` (a baseline/unattended session may have no single person).
3. **Add `ID_STUDY` for `--study` scoping.** ❌ **Not done.** `GDX_PH_SESSION` has no `ID_STUDY`
   column, and no skill exists yet to load data into this schema or scope it per study — this is
   the main remaining gap before this module can plug into the rest of the pipeline the way every
   other `--study`-scoped skill does (§11).
4. **Reuse the project's confidence/classification pattern instead of inventing a new one.**
   ✅ *Followed.* `GDX_PH_INTERPRETATION.CONFIDENCE_LEVEL` reuses the exact same
   `HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE` domain as `GDX_PSY_SEPT_LEVEL_PSY_MAP.CONFIDENCE_LEVEL`
   and `GDX_TA_WAY_SEPT_MAP.CONFIDENCE_LEVEL`.

**What is still needed before this plugs into Step 7/9**: an `ID_STUDY` column (or an equivalent
scoping path) on `GDX_PH_SESSION`; a loader/onboarding skill (there is none yet — see §4 Step
15); and, once that scoping exists, adding the `GDX_PH_*` prefix to
`GDX_SKILL_GODATAX_HUMAN7_BY_SPU`'s scope list (that skill's own `SKILL.md` already states it
"never hardcodes a table" — this would be the only code change needed there) and a new DW fact
grain (`DW_FACT_GDX_PH_EVENT`, say) analogous to the three that already exist.

---

## 13. Logical Architecture Diagram

Updated from `GDX_Human_Logical_Architecture-en.drawio` (2026-09-15) to reflect the current state
of the repository as of 2026-11-06 — step 0's skills (now 7, including the Google Forms
alternative pipeline and `GDX_SKILL_DELETE_STUDY`) are implemented, both ML models in step 10
are implemented and validated, folders 13 (standalone local-Firebird bootstrap + web sync) and 14
(generic, interactive variable↔framework association skills) are added as their own layer, and
step 15 moves from "proposed" to "schema implemented, not yet wired in" (see §12.6) — still a
dashed link into the DW, since no loader/`--study` scoping exists for it yet.

```mermaid
flowchart TB
    subgraph L1["ACQUISITION LAYER — Instrument & Raw Data"]
        S0["0 · New Instrument Onboarding<br/>7 skills, fully implemented"]
        S1["1 · SPSS Source Data<br/>423 respondents · 159 variables"]
        SENSOR["Medical Sensor<br/>ECG / RR / HRV wearable"]
    end

    subgraph L2["RELATIONAL MODELING LAYER — Firebird godatax.human"]
        S2["2 · Psychometrics<br/>GDX_PSY_*"]
        S3["3 · Septenary Constitution<br/>GDX_PSY_SEPTENARY_LEVEL"]
        S4["4 · Kundalini Chakras<br/>GDX_PSY_CHAKRA"]
        S5["5 · Five Ways of Aquinas<br/>GDX_TA_WAY"]
        S6["6 · Cardiac Coherence<br/>GDX_CC_*"]
        S14["14 · Metaphysical Measuring Instrument<br/>OT-7 + generic association skills"]
    end

    subgraph L3["INTEGRATION LAYER"]
        S7["7 · Data Warehouse<br/>12 dimensions + 3 facts + 3 bridges"]
        S9["9 · Knowledge Graph, Neo4j<br/>55 tables to nodes, 70 FKs to edges"]
    end

    subgraph L4["ANALYTICS & CONSUMPTION LAYER"]
        S8["8 · Dashboards<br/>11 chart types, self-contained HTML"]
        S10["10 · Machine Learning<br/>Link Prediction + Community Detection"]
        S11["11 · GDX Human Agent, LLM<br/>Neo4j-grounded chatbot"]
        S12["12 · Virtology<br/>33 virtues · suggestions · strengths"]
    end

    subgraph L0b["INFRASTRUCTURE — local bootstrap & publishing"]
        S13["13 · Onboarding Env<br/>local Firebird (GDS32.DLL) + web sync"]
    end

    subgraph L5["SCHEMA IMPLEMENTED, NOT YET WIRED IN — see Section 12.6"]
        S15["15 · Environmental & Anomalous<br/>Phenomena Sensing — GDX_PH_*, 15 tables"]
    end

    S0 -.->|catalog| S2
    S1 -->|GDX_SKILL_LOAD_RLT_MODEL_DB| S2
    SENSOR --> S6
    S2 -->|GDX_SKILL_LOAD_SEPT_MAPS_DB| S3
    S3 --> S4
    S3 --> S5
    S2 -->|GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS| S14
    S14 -.-> S3
    S14 -.-> S4
    S14 -.-> S5
    S2 --> S7
    S3 --> S7
    S4 --> S7
    S5 --> S7
    S6 --> S7
    S12 --> S7
    S2 -.-> S9
    S6 -.->|GDX_SKILL_GODATAX_HUMAN7_BY_SPU| S9
    S7 -->|DW to graph| S9
    S7 -->|GDX_SKILL_MAKE_DASHBOARS_DW| S8
    S7 -->|GDX_SKILL_LINK_SUGGESTIONS / IDENTIFY_VIRTUES| S12
    S9 -->|FastRP + Louvain| S10
    S9 -->|Cypher queries| S11
    S10 -.->|reviewed suggestions, human review| S3
    S13 -.->|GDX_SKILL_UP_FIREBIRD_DB| S2
    S13 -->|GDX_SKILL_UPDATE_WEB, one-way| S13W[("firebird.godatax.com<br/>(shared web DB)")]
    S9 -.->|GDX_SKILL_CREATE_SPU_AGENT, console-guided| S11
    S6 -.-> S15
    S15 -.->|no --study scoping, no loader skill yet| S7
```

**Legend:** solid arrow = implemented data flow; dashed arrow = schema introspection, human-review
feedback, console-guided (not API-automatable) setup, or a not-yet-wired-in link. Methodological
note (unchanged from the original diagram): the septenary/chakra/Five-Ways/virtology
correspondences are interpretive, qualitative readings — see §11 and the `*_Mapping.md` files in
each folder.

---

## 14. Appendix — Where to Go Next

| If you want to... | Read |
|---|---|
| Understand the historical study's raw data | `1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md` |
| Understand the core relational schema | `2.relational.model.psychometrics/psychometrics_model_firebird25.sql` + `SPSS_to_Firebird_Mapping.md` |
| Onboard a brand-new study | `0.new.instrument/New_Instrument_Onboarding_Process.md` |
| Understand the philosophical bridges | `3.septenary.constitution/SPSS_Septenary_Constitution_Mapping.md` (read first — the others reference it) |
| See the study's real numbers as charts | `8.gdx.dashboards/Dashboards_DW_Explanation.md` |
| Understand the graph and the ML models | `9.knowledge.graph/GoDataX_Human_7_Knowledge_Graph.md` + `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` |
| Stand up a local Firebird database with no server | `13.onboarding.env/on.bording.txt` + `GDX_SKILL_UP_FIREBIRD_DB/SKILL.md` |
| Understand the OT-7 metaphysical instrument / add one association at a time | `14.metaphysical.measuring.instrument/OT7_Instrumento_Metafisico.md` + `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS/SKILL.md` |
| Audit every interpretive correspondence the framework has made | `14.metaphysical.measuring.instrument/.claude/skills/GDX_SKILL_LIST_ASSOCIATIONS/SKILL.md` (writes `Framework_Associations_<timestamp>.md`) |
| Understand the environmental/anomalous-phenomena schema (not yet wired into the pipeline) | `15.environmental.anomalous.phenomena/GDXH7ph_Technical_Specification_for_Environmental_and_Anomalous_Phenomena.md` + `environmental_anomalous_phenomena_model_firebird25.sql` |
| Run any automation | the `SKILL.md` of the specific skill, inside `<folder>/.claude/skills/<name>/` |
| See the original (pre-update) architecture diagram | `GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GDX_Human_Logical_Architecture-en.drawio` |
