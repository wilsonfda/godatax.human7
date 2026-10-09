# GDX_HUMAN — Data Dictionary (All Firebird Tables)

> Generated 2026-10-03. Location: `GDX_HUMAN/2.relational.model.psychometrics/`
>
> Scope: every table that is actually **persisted in Firebird** across the folders
> `0.new.instrument`, `2.relational.model.psychometrics`, `3.septenary.constitution`,
> `4.kundalini.chakras`, `5.five.ways.tomas.aquino`, `6.cardiac.coherence`,
> `7.multidimensional.database`, `8.gdx.dashboards`, `9.knowledge.graph`,
> `10.gdx.machine.learning`, `12.gdx.virtology` and `14.metaphysical.measuring.instrument`.
>
> Each table is tagged **[RELATIONAL]** (OLTP, transactional schema, one of the five
> source schemas) or **[ANALYTICAL / DW]** (the star-schema Data Warehouse in
> `7.multidimensional.database`, derived from the relational schemas, read-mostly).
>
> Source DDL files read to build this dictionary:
> - `2.relational.model.psychometrics/psychometrics_model_firebird25.sql`
> - `3.septenary.constitution/septenary_constitution_model_firebird25.sql`
> - `4.kundalini.chakras/chakras_model_firebird25.sql`
> - `5.five.ways.tomas.aquino/five_ways_model_firebird25.sql`
> - `5.five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql`
> - `6.cardiac.coherence/gdx_coerencia_cardiaca_fb25_ddl.sql`
> - `7.multidimensional.database/godatax_human_dw_model_firebird25.sql`
> - `7.multidimensional.database/godatax_human_dw_fk_gdx_cc_person_firebird25.sql` (adds one cross-schema FK, no new table)
>
> **55 tables total**: 41 relational (OLTP) + 14 analytical (DW). This matches the "55
> relational tables as nodes" figure used elsewhere in the project (Knowledge Graph,
> Chapter 07) — every persisted table catalogued here has a corresponding node label
> in Neo4j.
>
> Folders with **no Firebird tables of their own** — see §3 for why: `0.new.instrument`,
> `8.gdx.dashboards`, `9.knowledge.graph`, `10.gdx.machine.learning`,
> `12.gdx.virtology`, `14.metaphysical.measuring.instrument`.

---

## 1. Relational Model (OLTP)

### 1.1 Psychometrics Core — `2.relational.model.psychometrics/psychometrics_model_firebird25.sql`

The foundational schema: people, studies, the measurement hierarchy (phenomenon →
construct → variable → indicator), instruments/items/alternatives, and every result
table that stores a computed score. All other relational schemas (septenary,
chakras, five ways) extend this one via foreign keys into `GDX_PSY_INSTRUMENT` /
`GDX_PSY_VARIABLE` / `GDX_PSY_SEPTENARY_LEVEL`.

#### `GDX_PSY_PERSON` — [RELATIONAL]
Master registry of every individual known to the system — one row per real,
de-identifiable person. Every other person-like table (`GDX_PSY_EVALUATOR`,
`GDX_CC_PERSON` indirectly, `DW_DIM_PERSON`) ultimately resolves back to this table's
`ID_PERSON` key.

| Column | Type | Description |
|---|---|---|
| `ID_PERSON` | BIGINT, **PK** | Surrogate key, auto-assigned by `SEQ_GDX_PSY_PERSON` via trigger. |
| `NAME` | VARCHAR(150), NOT NULL | Person's name, or a synthetic/placeholder label when the source data is already anonymized. |
| `EXTERNAL_IDENTIFIER` | VARCHAR(60), UNIQUE | Optional external/source-system code (e.g. a legacy `.sav` participant ID) used to reconcile this person across imports. |
| `BIRTH_DATE` | DATE | Date of birth, if known. |
| `GENDER` | VARCHAR(30) | Self-reported or recorded gender. |
| `EDUCATION_LEVEL` | VARCHAR(80) | Highest education level recorded. |
| `REGISTRATION_DATE` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | When this person record was created. |

#### `GDX_PSY_TEAM` — [RELATIONAL]
Optional grouping of people into a team/cohort (e.g. a squad, a research group),
with a designated leader.

| Column | Type | Description |
|---|---|---|
| `ID_TEAM` | BIGINT, **PK** | Surrogate key. |
| `NAME` | VARCHAR(120), NOT NULL | Team name. |
| `DESCRIPTION` | VARCHAR(500) | Free-text description. |
| `ID_LEADER` | BIGINT, FK → `GDX_PSY_PERSON` | The person who leads this team (nullable). |

#### `GDX_PSY_TEAM_MEMBER` — [RELATIONAL]
Many-to-many membership of people within teams, with a role and a validity period.

| Column | Type | Description |
|---|---|---|
| `ID_TEAM` | BIGINT, **PK** (composite), FK → `GDX_PSY_TEAM` | Team. |
| `ID_PERSON` | BIGINT, **PK** (composite), FK → `GDX_PSY_PERSON` | Member. |
| `ROLE` | VARCHAR(60) | The member's role within the team. |
| `START_DATE` / `END_DATE` | DATE | Membership validity window. |

#### `GDX_PSY_OCCUPATION` — [RELATIONAL]
Catalog of occupations/roles a person can hold outside the study context (e.g.
"cadet", "officer").

| Column | Type | Description |
|---|---|---|
| `ID_OCCUPATION` | BIGINT, **PK** | Surrogate key. |
| `NAME` | VARCHAR(120), UNIQUE, NOT NULL | Occupation name. |
| `DESCRIPTION` | VARCHAR(500) | Free-text description. |

#### `GDX_PSY_PERSON_OCCUPATION` — [RELATIONAL]
History of occupations held by a person over time.

| Column | Type | Description |
|---|---|---|
| `ID_PERSON` | BIGINT, **PK** (composite), FK → `GDX_PSY_PERSON` | Person. |
| `ID_OCCUPATION` | BIGINT, **PK** (composite), FK → `GDX_PSY_OCCUPATION` | Occupation. |
| `START_DATE` | DATE, **PK** (composite) | When this occupation began — part of the key so the same person/occupation pair can recur over non-overlapping periods. |
| `END_DATE` | DATE | When it ended, if applicable. |

#### `GDX_PSY_STUDY` — [RELATIONAL]
One row per psychometric research study (e.g. "Predictors of Adaptability to
Military Higher Education", the 2019 UFRJ study reanalyzed throughout this
project).

| Column | Type | Description |
|---|---|---|
| `ID_STUDY` | BIGINT, **PK** | Surrogate key. |
| `TITLE` | VARCHAR(200), NOT NULL | Study title. |
| `OBJECTIVE` | VARCHAR(1000) | Study objective. |
| `METHOD` | VARCHAR(1000) | Method summary. |
| `START_DATE` / `END_DATE` | DATE | Study period. |
| `STATUS` | VARCHAR(30), NOT NULL, default `'PLANNED'` | Lifecycle status, e.g. `PLANNED`, `IN_PROGRESS`, `COMPLETED`. |

#### `GDX_PSY_STUDY_PARTICIPANT` — [RELATIONAL]
The **only** place a person's membership in a given study is recorded — no other
table in the system infers study membership implicitly.

| Column | Type | Description |
|---|---|---|
| `ID_STUDY` | BIGINT, **PK** (composite), FK → `GDX_PSY_STUDY` | Study. |
| `ID_PERSON` | BIGINT, **PK** (composite), FK → `GDX_PSY_PERSON` | Person. |
| `ANONYMOUS_CODE` | VARCHAR(60), UNIQUE per study | Pseudonymous code used within this specific study. |
| `EXPERIMENTAL_GROUP` | VARCHAR(80) | Cohort/group label (e.g. curricular year). |
| `ENTRY_DATE` | DATE | Enrollment date. |
| `CONSENT` | SMALLINT (0/1), NOT NULL, default `0` | Informed-consent flag — **never assumed true by default**. |

#### `GDX_PSY_PHENOMENON` — [RELATIONAL]
Top-level catalog of the broad psychological phenomena under study (e.g.
"burnout", "career adaptability") — the highest rung of the measurement
hierarchy, above constructs.

| Column | Type | Description |
|---|---|---|
| `ID_PHENOMENON` | BIGINT, **PK** | Surrogate key. |
| `NAME` | VARCHAR(120), UNIQUE, NOT NULL | Phenomenon name. |
| `DESCRIPTION` | VARCHAR(1000) | Free-text description. |

#### `GDX_PSY_CONSTRUCT` — [RELATIONAL]
A specific psychological construct/dimension (e.g. "Commitment" within
Hardiness), optionally nested under a parent construct.

| Column | Type | Description |
|---|---|---|
| `ID_CONSTRUCT` | BIGINT, **PK** | Surrogate key. |
| `ID_PARENT_CONSTRUCT` | BIGINT, FK → self (nullable) | Enables hierarchical constructs (a sub-dimension of a broader one). |
| `NAME` | VARCHAR(120), UNIQUE, NOT NULL | Construct name. |
| `DOMAIN` | VARCHAR(60) | Free-text grouping/domain tag. |
| `DEFINITION` | VARCHAR(1000), NOT NULL | Conceptual definition. |

#### `GDX_PSY_VARIABLE` — [RELATIONAL]
A measurable variable that operationalizes a construct — what is actually scored
and computed (e.g. "Vigor" under the "Engagement" construct). This is the table
most heavily cross-referenced by the metaphysical layers (septenary, five ways)
and by the Data Warehouse.

| Column | Type | Description |
|---|---|---|
| `ID_VARIABLE` | BIGINT, **PK** | Surrogate key. |
| `ID_CONSTRUCT` | BIGINT, NOT NULL, FK → `GDX_PSY_CONSTRUCT` | Parent construct. |
| `NAME` | VARCHAR(150), UNIQUE per construct | Variable name. |
| `DESCRIPTION` | VARCHAR(1000) | Free-text description. |
| `OPERATIONAL_DEFINITION` | VARCHAR(1000) | How it is concretely measured/computed. |
| `VARIABLE_TYPE` | VARCHAR(40), NOT NULL, default `'PSYCHOLOGICAL'` | e.g. `PSYCHOLOGICAL`, `PHYSIOLOGICAL`, `ENVIRONMENTAL`. |
| `MEASUREMENT_LEVEL` | VARCHAR(30) | Nominal / ordinal / interval / ratio. |

#### `GDX_PSY_INDICATOR` — [RELATIONAL]
A specific indicator under a variable, with a valid numeric range and polarity —
used for single-item/low-confidence blocks and derived composite indicators.

| Column | Type | Description |
|---|---|---|
| `ID_INDICATOR` | BIGINT, **PK** | Surrogate key. |
| `ID_VARIABLE` | BIGINT, NOT NULL, FK → `GDX_PSY_VARIABLE` | Parent variable. |
| `NAME` | VARCHAR(150), UNIQUE per variable | Indicator name. |
| `DESCRIPTION` / `OPERATIONAL_DEFINITION` | VARCHAR(1000) | Free text. |
| `INDICATOR_TYPE` | VARCHAR(30) | Classification of the indicator. |
| `MEASUREMENT_UNIT` | VARCHAR(40) | Unit of measurement, if any. |
| `DIRECTION` | VARCHAR(15) | Polarity relative to the construct (e.g. positive/negative). |
| `MIN_VALUE` / `MAX_VALUE` | NUMERIC(14,4) | Valid value range (`CHECK` enforces `MIN ≤ MAX`). |

#### `GDX_PSY_PHENOMENON_CONSTRUCT` — [RELATIONAL]
Many-to-many link tying a construct to the broader phenomenon/phenomena it
belongs to.

| Column | Type | Description |
|---|---|---|
| `ID_PHENOMENON` | BIGINT, **PK** (composite), FK → `GDX_PSY_PHENOMENON` | Phenomenon. |
| `ID_CONSTRUCT` | BIGINT, **PK** (composite), FK → `GDX_PSY_CONSTRUCT` | Construct. |
| `RELATION_TYPE` | VARCHAR(60) | Label describing the nature of the relation. |

#### `GDX_PSY_INSTRUMENT` — [RELATIONAL]
Catalog of measurement instruments/scales (e.g. "Career Adapt-Abilities Scale",
"Hardiness").

| Column | Type | Description |
|---|---|---|
| `ID_INSTRUMENT` | BIGINT, **PK** | Surrogate key. |
| `NAME` | VARCHAR(160), NOT NULL, UNIQUE with `VERSION` | Instrument name. |
| `VERSION` | VARCHAR(30) | Version label. |
| `TYPE` | VARCHAR(50), NOT NULL | e.g. `QUESTIONNAIRE`, `SCALE`. |
| `DESCRIPTION` | VARCHAR(1000) | Free-text description. |
| `INSTRUCTIONS` | BLOB SUB_TYPE TEXT | Full instructions text shown to respondents. |
| `ACTIVE` | SMALLINT (0/1), NOT NULL, default `1` | Whether the instrument is currently in active use. |

#### `GDX_PSY_INSTRUMENT_CONSTRUCT` — [RELATIONAL]
Which constructs a given instrument measures, with a weight for composite
scoring.

| Column | Type | Description |
|---|---|---|
| `ID_INSTRUMENT` | BIGINT, **PK** (composite), FK → `GDX_PSY_INSTRUMENT` | Instrument. |
| `ID_CONSTRUCT` | BIGINT, **PK** (composite), FK → `GDX_PSY_CONSTRUCT` | Construct. |
| `WEIGHT` | NUMERIC(9,4), NOT NULL, default `1` | Contribution weight. |

#### `GDX_PSY_INSTRUMENT_ITEM` — [RELATIONAL]
Each individual question/statement belonging to an instrument.

| Column | Type | Description |
|---|---|---|
| `ID_ITEM` | BIGINT, **PK** | Surrogate key. |
| `ID_INSTRUMENT` | BIGINT, NOT NULL, FK → `GDX_PSY_INSTRUMENT` | Parent instrument. |
| `ITEM_ORDER` | INTEGER, NOT NULL, UNIQUE per instrument | Position of the item in the instrument. |
| `STATEMENT_TEXT` | BLOB SUB_TYPE TEXT, NOT NULL | The literal wording of the item. |
| `RESPONSE_TYPE` | VARCHAR(30), NOT NULL | e.g. `LIKERT_5`. |
| `REQUIRED` | SMALLINT (0/1), NOT NULL, default `1` | Whether a response is mandatory. |
| `WEIGHT` | NUMERIC(9,4), NOT NULL, default `1` | Contribution weight of this item. |

#### `GDX_PSY_INDICATOR_ITEM` — [RELATIONAL]
Many-to-many link from items to the indicator(s) they feed, with weight and a
reverse-scoring flag.

| Column | Type | Description |
|---|---|---|
| `ID_INDICATOR` | BIGINT, **PK** (composite), FK → `GDX_PSY_INDICATOR` | Indicator. |
| `ID_ITEM` | BIGINT, **PK** (composite), FK → `GDX_PSY_INSTRUMENT_ITEM` | Item. |
| `WEIGHT` | NUMERIC(9,4), NOT NULL, default `1` | Contribution weight. |
| `REVERSED` | SMALLINT (0/1), NOT NULL, default `0` | Whether the item's raw score must be reverse-scored before aggregating. |

#### `GDX_PSY_ITEM_ALTERNATIVE` — [RELATIONAL]
The discrete response options (Likert anchors) available for a given item.

| Column | Type | Description |
|---|---|---|
| `ID_ALTERNATIVE` | BIGINT, **PK** | Surrogate key. |
| `ID_ITEM` | BIGINT, NOT NULL, FK → `GDX_PSY_INSTRUMENT_ITEM` | Parent item. |
| `ALTERNATIVE_ORDER` | INTEGER, NOT NULL, UNIQUE per item | Position of this option among the item's alternatives. |
| `LABEL` | VARCHAR(300), NOT NULL | Text shown for this option (e.g. "Agree"). |
| `NUMERIC_VALUE` | NUMERIC(12,4) | Scored numeric value of choosing this option. |

#### `GDX_PSY_EVALUATOR` — [RELATIONAL]
A person acting as a professional evaluator (psychologist/psychiatrist) within
the system.

| Column | Type | Description |
|---|---|---|
| `ID_EVALUATOR` | BIGINT, **PK** | Surrogate key. |
| `ID_PERSON` | BIGINT, UNIQUE, FK → `GDX_PSY_PERSON` | Which person holds this evaluator role. |
| `PROFESSIONAL_LICENSE` | VARCHAR(60) | License/registration number. |
| `SPECIALTY` | VARCHAR(100) | Professional specialty. |

#### `GDX_PSY_APPLICATION` — [RELATIONAL]
One administration of one instrument to one study participant — the central
"event" that responses, results and indicator values all hang off of.

| Column | Type | Description |
|---|---|---|
| `ID_APPLICATION` | BIGINT, **PK** | Surrogate key. |
| `ID_STUDY`, `ID_PERSON` | BIGINT, FK → `GDX_PSY_STUDY_PARTICIPANT` (composite) | The participant must already be enrolled in that study. |
| `ID_INSTRUMENT` | BIGINT, NOT NULL, FK → `GDX_PSY_INSTRUMENT` | Instrument applied. |
| `ID_EVALUATOR` | BIGINT, FK → `GDX_PSY_EVALUATOR` (nullable) | Who administered/supervised it, if any. |
| `START_TIMESTAMP` / `END_TIMESTAMP` | TIMESTAMP | Administration window. |
| `CONTEXT` | VARCHAR(500) | Free-text context notes. |
| `STATUS` | VARCHAR(30), NOT NULL, default `'STARTED'` | Lifecycle status. |

#### `GDX_PSY_ITEM_RESPONSE` — [RELATIONAL]
The raw answer a person gave to one item within one application — the finest
grain of psychometric data, and the source for `DW_FACT_PSY_ITEM_RESPONSE`.

| Column | Type | Description |
|---|---|---|
| `ID_RESPONSE` | BIGINT, **PK** | Surrogate key. |
| `ID_APPLICATION` | BIGINT, NOT NULL, FK → `GDX_PSY_APPLICATION`, UNIQUE with `ID_ITEM` | One response per item per application. |
| `ID_ITEM` | BIGINT, NOT NULL, FK → `GDX_PSY_INSTRUMENT_ITEM` | Item answered. |
| `ID_ALTERNATIVE` | BIGINT, FK → `GDX_PSY_ITEM_ALTERNATIVE` (nullable) | Which discrete alternative was chosen, if the item uses alternatives. |
| `NUMERIC_VALUE` | NUMERIC(12,4) | Scored numeric value of the response. |
| `TEXT_VALUE` | BLOB SUB_TYPE TEXT | Free-text answer, if applicable. |
| `RESPONDED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | When the response was recorded. |

#### `GDX_PSY_CONSTRUCT_RESULT` — [RELATIONAL]
The computed score for one construct from one application.

| Column | Type | Description |
|---|---|---|
| `ID_RESULT` | BIGINT, **PK** | Surrogate key. |
| `ID_APPLICATION` | BIGINT, FK → `GDX_PSY_APPLICATION`, UNIQUE with `ID_CONSTRUCT` | Application this result belongs to. |
| `ID_CONSTRUCT` | BIGINT, FK → `GDX_PSY_CONSTRUCT` | Construct scored. |
| `RAW_SCORE` / `STANDARDIZED_SCORE` | NUMERIC(14,4) | Computed scores. |
| `PERCENTILE` | NUMERIC(6,2), `CHECK` 0–100 | Percentile rank. |
| `CLASSIFICATION` | VARCHAR(80) | Qualitative band (e.g. "High"). |

#### `GDX_PSY_VARIABLE_RESULT` — [RELATIONAL]
The computed score for one variable from one application. **This is the row that
feeds `DW_FACT_PSY_VARIABLE_RESULT`** and, through `DW_DIM_VARIABLE`, every
cross-perspective (septenary / chakra / five-ways) reading used throughout the
project.

| Column | Type | Description |
|---|---|---|
| `ID_VARIABLE_RESULT` | BIGINT, **PK** | Surrogate key. |
| `ID_APPLICATION` | BIGINT, FK → `GDX_PSY_APPLICATION`, UNIQUE with `ID_VARIABLE` | Application this result belongs to. |
| `ID_VARIABLE` | BIGINT, FK → `GDX_PSY_VARIABLE` | Variable scored. |
| `RAW_SCORE` / `STANDARDIZED_SCORE` | NUMERIC(14,4) | Computed scores. |
| `PERCENTILE` | NUMERIC(6,2), `CHECK` 0–100 | Percentile rank. |
| `CLASSIFICATION` | VARCHAR(80) | Qualitative band. |

#### `GDX_PSY_INDICATOR_RESULT` — [RELATIONAL]
The computed value for one indicator from one application.

| Column | Type | Description |
|---|---|---|
| `ID_INDICATOR_RESULT` | BIGINT, **PK** | Surrogate key. |
| `ID_APPLICATION` | BIGINT, FK → `GDX_PSY_APPLICATION`, UNIQUE with `ID_INDICATOR` | Application this result belongs to. |
| `ID_INDICATOR` | BIGINT, FK → `GDX_PSY_INDICATOR` | Indicator calculated. |
| `CALCULATED_VALUE` / `STANDARDIZED_VALUE` | NUMERIC(14,4) | Computed values. |
| `CLASSIFICATION` | VARCHAR(80) | Qualitative band. |

#### `GDX_PSY_PSYCHOMETRIC_PROPERTY` — [RELATIONAL]
Statistical/psychometric properties computed for an instrument (and optionally
one of its constructs) — fit indices, factor loadings, Cronbach's alpha,
correlations. **This is where the book's CFA/EFA reanalysis results (154 rows)
are stored.**

| Column | Type | Description |
|---|---|---|
| `ID_PROPERTY` | BIGINT, **PK** | Surrogate key. |
| `ID_INSTRUMENT` | BIGINT, NOT NULL, FK → `GDX_PSY_INSTRUMENT` | Instrument the property refers to. |
| `ID_CONSTRUCT` | BIGINT, FK → `GDX_PSY_CONSTRUCT` (nullable) | Construct the property refers to, if specific to one. |
| `TYPE` | VARCHAR(50), NOT NULL | e.g. `CFI`, `RMSEA`, `CRONBACH_ALPHA`, `FACTOR_LOADING`, `PEARSON_R`. |
| `METHOD` | VARCHAR(120) | Statistical method/library used (e.g. `semopy`, `scikit-learn FactorAnalysis`). |
| `"VALUE"` | NUMERIC(14,6) | The statistic itself (column name quoted — reserved word in some dialects). |
| `SAMPLE_SIZE` | INTEGER | *n* used for the calculation. |
| `REFERENCE` | VARCHAR(500) | Free text citing the script/source that produced it. |
| `CALCULATED_AT` | TIMESTAMP | When it was calculated. |

#### `GDX_PSY_OBSERVATION` — [RELATIONAL]
A qualitative behavioral observation recorded about a person within a study.

| Column | Type | Description |
|---|---|---|
| `ID_OBSERVATION` | BIGINT, **PK** | Surrogate key. |
| `ID_STUDY`, `ID_PERSON` | BIGINT, FK → `GDX_PSY_STUDY_PARTICIPANT` (composite) | Participant observed. |
| `ID_EVALUATOR` | BIGINT, FK → `GDX_PSY_EVALUATOR` (nullable) | Who made the observation. |
| `ID_CONSTRUCT` | BIGINT, FK → `GDX_PSY_CONSTRUCT` (nullable) | Construct the observation relates to, if any. |
| `OBSERVED_AT` | TIMESTAMP, NOT NULL | When the behavior was observed. |
| `CONTEXT` | VARCHAR(500) | Free-text context. |
| `BEHAVIOR` | BLOB SUB_TYPE TEXT, NOT NULL | Narrative description of the observed behavior. |
| `INTENSITY` | NUMERIC(6,2) | Subjective intensity rating. |

#### `GDX_PSY_EVALUATION` — [RELATIONAL]
A formal clinical/professional evaluation or opinion issued about a person
within a study.

| Column | Type | Description |
|---|---|---|
| `ID_EVALUATION` | BIGINT, **PK** | Surrogate key. |
| `ID_STUDY`, `ID_PERSON` | BIGINT, FK → `GDX_PSY_STUDY_PARTICIPANT` (composite) | Participant evaluated. |
| `ID_EVALUATOR` | BIGINT, FK → `GDX_PSY_EVALUATOR` | Who issued the evaluation. |
| `TYPE` | VARCHAR(50), NOT NULL | Evaluation type. |
| `EVALUATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | When issued. |
| `OPINION` | BLOB SUB_TYPE TEXT | The evaluator's narrative opinion. |
| `CONCLUSION` | VARCHAR(500) | Summary conclusion. |

#### `GDX_PSY_ACTION` — [RELATIONAL]
Catalog of possible recommended actions/interventions (e.g. "refer to
psychologist").

| Column | Type | Description |
|---|---|---|
| `ID_ACTION` | BIGINT, **PK** | Surrogate key. |
| `NAME` | VARCHAR(140), UNIQUE, NOT NULL | Action name. |
| `TYPE` | VARCHAR(50) | Action category. |
| `DESCRIPTION` | VARCHAR(1000) | Free-text description. |

#### `GDX_PSY_EVALUATION_ACTION` — [RELATIONAL]
Which actions were recommended as a result of a given evaluation.

| Column | Type | Description |
|---|---|---|
| `ID_EVALUATION` | BIGINT, **PK** (composite), FK → `GDX_PSY_EVALUATION` | Evaluation. |
| `ID_ACTION` | BIGINT, **PK** (composite), FK → `GDX_PSY_ACTION` | Recommended action. |
| `PRIORITY` | SMALLINT | Priority ranking. |
| `JUSTIFICATION` | VARCHAR(1000) | Why this action was recommended. |
| `STATUS` | VARCHAR(30), NOT NULL, default `'RECOMMENDED'` | Lifecycle status. |

---

### 1.2 Septenary Constitution — `3.septenary.constitution/septenary_constitution_model_firebird25.sql`

Extends the psychometrics core with the philosophical "seven bodies of
consciousness" model and its mapping to real instruments/variables.

#### `GDX_PSY_SEPTENARY_LEVEL` — [RELATIONAL]
Fixed catalog of the 7 levels/bodies of the Septenary Constitution model
(Physical through Atmic/Spirit). Populated once, shared by every study.

| Column | Type | Description |
|---|---|---|
| `ID_SEPTENARY_LEVEL` | BIGINT, **PK** | Surrogate key (1–7 in practice). |
| `ORDER_NUM` | SMALLINT, NOT NULL, UNIQUE, `CHECK` 1–7 | Position in the ladder. |
| `NAME` | VARCHAR(60), UNIQUE, NOT NULL | e.g. "Physical Body". |
| `TECHNICAL_NAME` | VARCHAR(80) | Sanskrit/Theosophical term, e.g. "Sthula Sharira". |
| `NATURE` | VARCHAR(40) | One-phrase nature of the level, e.g. "Dense, material". |
| `CONSCIOUSNESS_FUNCTION` | VARCHAR(500) | What this level governs in consciousness. |

#### `GDX_PSY_SEPT_LEVEL_PSY_MAP` — [RELATIONAL]
Interpretive bridge table: links a psychometric instrument/variable to one of
the 7 septenary levels, with justification and a confidence rating. `ID_INSTRUMENT`
/ `ID_VARIABLE` are nullable because this mapping was first recorded before the
formal catalog load — the `*_LABEL` columns preserve the original text
permanently, even after reconciliation.

| Column | Type | Description |
|---|---|---|
| `ID_MAPPING` | BIGINT, **PK** | Surrogate key. |
| `ID_SEPTENARY_LEVEL` | BIGINT, NOT NULL, FK → `GDX_PSY_SEPTENARY_LEVEL` | Target level. |
| `ID_INSTRUMENT` | BIGINT, FK → `GDX_PSY_INSTRUMENT` (nullable) | Resolved catalog link, once available. |
| `INSTRUMENT_LABEL` | VARCHAR(160), NOT NULL | Original free-text instrument name (kept permanently). |
| `ID_VARIABLE` | BIGINT, FK → `GDX_PSY_VARIABLE` (nullable) | Resolved catalog link, once available. |
| `VARIABLE_LABEL` | VARCHAR(150), NOT NULL | Original free-text variable name (kept permanently). |
| `RECORDED_BEHAVIOR` | BLOB SUB_TYPE TEXT, NOT NULL | What behavior/response pattern is actually being read. |
| `CORRESPONDENCE_JUSTIFICATION` | BLOB SUB_TYPE TEXT, NOT NULL | Why this mapping was made. |
| `CONFIDENCE_LEVEL` | VARCHAR(20), NOT NULL, default `'SPECULATIVE'`, `CHECK IN ('HIGH','MEDIUM','LOW','SPECULATIVE')` | How confident the mapping is. |

---

### 1.3 Kundalini Chakras — `4.kundalini.chakras/chakras_model_firebird25.sql`

#### `GDX_PSY_CHAKRA` — [RELATIONAL]
Fixed catalog of the 7 kundalini chakras, each linked 1:1 (by ascending order) to
a Septenary Constitution level — a symbolic/interpretive correspondence, not an
empirical finding.

| Column | Type | Description |
|---|---|---|
| `ID_CHAKRA` | BIGINT, **PK** | Surrogate key. |
| `ORDER_NUM` | SMALLINT, NOT NULL, UNIQUE, `CHECK` 1–7 | Position from base of spine (1) to crown (7). |
| `SANSKRIT_NAME` | VARCHAR(60), UNIQUE, NOT NULL | e.g. "Muladhara". |
| `COMMON_NAME` | VARCHAR(60), NOT NULL | e.g. "Root Chakra". |
| `LOCATION` | VARCHAR(120) | Body location. |
| `SYMBOLIC_COLOR` / `SYMBOLIC_ELEMENT` / `SEED_MANTRA` | VARCHAR | Traditional symbolic attributes. |
| `SYMBOLIC_FUNCTION` | VARCHAR(500), NOT NULL | What this chakra is said to govern. |
| `ID_SEPTENARY_LEVEL` | BIGINT, NOT NULL, FK → `GDX_PSY_SEPTENARY_LEVEL` | Corresponding septenary level. |
| `SEPTENARY_LEVEL_JUSTIFICATION` | VARCHAR(500) | Why that correspondence was chosen. |

---

### 1.4 The Five Ways of Aquinas — `5.five.ways.tomas.aquino/`

#### `GDX_TA_WAY` — [RELATIONAL]  (`five_ways_model_firebird25.sql`)
Fixed catalog of Thomas Aquinas's Five Ways (*Quinque Viae*) — the arguments for
God's existence from the *Summa Theologica*, I, Q.2, A.3.

| Column | Type | Description |
|---|---|---|
| `ID_WAY` | BIGINT, **PK** | Surrogate key. |
| `ORDER_NUM` | SMALLINT, NOT NULL, UNIQUE, `CHECK` 1–5 | Order Aquinas presents them in. |
| `LATIN_NAME` | VARCHAR(60), UNIQUE, NOT NULL | e.g. "Prima Via". |
| `ENGLISH_NAME` | VARCHAR(100), NOT NULL | e.g. "Argument from Motion". |
| `ARGUMENT_TYPE` | VARCHAR(60), NOT NULL | e.g. `COSMOLOGICAL`, `TELEOLOGICAL`. |
| `PREMISE` | VARCHAR(1000), NOT NULL | The starting observation of the argument. |
| `METAPHYSICAL_PRINCIPLE` | VARCHAR(1000), NOT NULL | The metaphysical rule invoked. |
| `REASONING` | BLOB SUB_TYPE TEXT, NOT NULL | Full step-by-step reasoning chain. |
| `CONCLUSION` | VARCHAR(500), NOT NULL | What the argument concludes. |
| `SOURCE_REFERENCE` | VARCHAR(300), NOT NULL | Citation back to the *Summa Theologica*. |

#### `GDX_TA_WAY_SEPT_MAP` — [RELATIONAL]  (`five_ways_septenary_map_firebird25.sql`)
Maps each of the Five Ways to a Septenary Constitution level, by the reasoning
faculty it exercises (not by its conclusion — all five converge on the same
conclusion, which would make a conclusion-based mapping uninformative). Level 7
is deliberately left unmapped to any individual way.

| Column | Type | Description |
|---|---|---|
| `ID_MAPPING` | BIGINT, **PK** | Surrogate key. |
| `ID_WAY` | BIGINT, NOT NULL, FK → `GDX_TA_WAY`, UNIQUE with `ID_SEPTENARY_LEVEL` | Way. |
| `ID_SEPTENARY_LEVEL` | BIGINT, NOT NULL, FK → `GDX_PSY_SEPTENARY_LEVEL` | Corresponding level. |
| `CORRESPONDENCE_JUSTIFICATION` | BLOB SUB_TYPE TEXT, NOT NULL | Why this mapping was made. |
| `CONFIDENCE_LEVEL` | VARCHAR(20), NOT NULL, default `'SPECULATIVE'`, `CHECK IN ('HIGH','MEDIUM','LOW','SPECULATIVE')` | How confident the mapping is. |

---

### 1.5 Cardiac Coherence — `6.cardiac.coherence/gdx_coerencia_cardiaca_fb25_ddl.sql`

The physiological/HRV layer: device, person, session and four levels of signal
granularity (raw ECG → RR intervals → motion → aggregated HRV windows), plus
device event logging.

#### `GDX_CC_PERSON` — [RELATIONAL]
Pseudonymized participant record for the cardiac-coherence side of the project.
Shares the same person-identity space as `GDX_PSY_PERSON` (enforced by a later
cross-schema FK into `DW_DIM_PERSON` — see §2) but is **not itself** the central
person table.

| Column | Type | Description |
|---|---|---|
| `ID_PERSON` | BIGINT, **PK** | Must also exist in `DW_DIM_PERSON` once `FK_GDX_CC_PERSON_DW_PERSON` is applied (§2.2 note). |
| `EXTERNAL_CODE` | VARCHAR(80), UNIQUE | Pseudonymous external code. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |
| `ACTIVE_FLAG` | SMALLINT (0/1), NOT NULL, default `1` | Whether the record is active. |

#### `GDX_CC_DEVICE` — [RELATIONAL]
Catalog of physical sensor devices (e.g. Movesense Medical ECG strap) used for
capture.

| Column | Type | Description |
|---|---|---|
| `DEVICE_ID` | BIGINT, **PK** | Surrogate key. |
| `MANUFACTURER` / `MODEL_NAME` | VARCHAR(80), NOT NULL | Device identity. |
| `SERIAL_NUMBER` | VARCHAR(100), UNIQUE | Serial number. |
| `DEVICE_TYPE` | VARCHAR(20), NOT NULL, `CHECK IN ('ECG','CHEST_STRAP','OPTICAL','SMARTWATCH','OTHER')` | Device category. |
| `FIRMWARE_VERSION` | VARCHAR(40) | Firmware version. |
| `MEDICAL_CLASS` | VARCHAR(30) | Regulatory class, e.g. "EU MDR CLASS IIA". |
| `ECG_CHANNELS` / `ECG_RESOLUTION_BITS` | SMALLINT | ECG channel count and ADC resolution. |
| `ACTIVE_FLAG` | SMALLINT (0/1), NOT NULL, default `1` | Whether the device is active. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_SESSION` — [RELATIONAL]
One capture session — a person wearing a device for a period, under a given
protocol (e.g. the 5-phase coherence protocol).

| Column | Type | Description |
|---|---|---|
| `SESSION_ID` | BIGINT, **PK** | Surrogate key. |
| `ID_PERSON` | BIGINT, NOT NULL, FK → `GDX_CC_PERSON` | Participant. |
| `DEVICE_ID` | BIGINT, NOT NULL, FK → `GDX_CC_DEVICE` | Device used. |
| `STARTED_AT` / `ENDED_AT` | TIMESTAMP | Session window (`CHECK` ensures end ≥ start). |
| `SIGNAL_TYPE` | VARCHAR(10), NOT NULL, `CHECK IN ('ECG','PPG')` | Underlying signal source. |
| `ECG_SAMPLE_RATE_HZ` | INTEGER, `CHECK IN` allowed device rates | Sampling rate (125/128/200/250/256/500/512 Hz). |
| `RR_RESOLUTION_MS` | SMALLINT, `CHECK IN (1,8)` | RR-interval timing resolution. |
| `MOTION_RATE_HZ` | NUMERIC(6,1), `CHECK IN` allowed rates | Motion-sensor sampling rate. |
| `ACC_RANGE_G` / `GYRO_RANGE_DPS` | SMALLINT, `CHECK IN` allowed ranges | Accelerometer/gyroscope sensor range settings. |
| `TIMEZONE_OFFSET_MIN` | SMALLINT | Timezone offset at capture time. |
| `PROTOCOL_NAME` | VARCHAR(100) | e.g. "BASELINE 5 MINUTES". |
| `BODY_POSITION` | VARCHAR(20), `CHECK IN ('SUPINE','SITTING','STANDING','MOVING','OTHER')` | Participant's position. |
| `ALGORITHM_NAME` / `ALGORITHM_VERSION` | VARCHAR | Beat-detection algorithm used (e.g. "Modified Pan-Tompkins"). |
| `NOTES` | VARCHAR(1000) | Free-text notes. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_RR_INTERVAL` — [RELATIONAL]
One row per detected heartbeat: the RR interval and instantaneous heart rate.

| Column | Type | Description |
|---|---|---|
| `RR_INTERVAL_ID` | BIGINT, **PK** | Surrogate key. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `GDX_CC_SESSION` (cascade delete) | Parent session. |
| `BEAT_NUMBER` | BIGINT, UNIQUE per session | Sequential beat index. |
| `MEASURED_AT` / `DEVICE_TIME_US` | TIMESTAMP / BIGINT | Timestamps (wall-clock and device-internal). |
| `RR_INTERVAL_MS` | NUMERIC(10,3), NOT NULL, `CHECK` 250–3000 | Time between this beat and the previous one. |
| `HEART_RATE_BPM` | NUMERIC(8,3), `CHECK` 20–240 | Instantaneous heart rate. |
| `NORMAL_BEAT_FLAG` | SMALLINT (0/1), NOT NULL, default `1` | Whether this is a normal sinus beat (vs. ectopic). |
| `QUALITY_FLAG` | VARCHAR(15), NOT NULL, default `'VALID'`, `CHECK IN ('VALID','SUSPECT','ARTIFACT','EXCLUDED')` | Signal quality flag. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_ECG_SAMPLE` — [RELATIONAL]
Raw ECG waveform, one row per sample point.

| Column | Type | Description |
|---|---|---|
| `ECG_SAMPLE_ID` | BIGINT, **PK** | Surrogate key. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `GDX_CC_SESSION` (cascade delete) | Parent session. |
| `SAMPLE_NUMBER` | BIGINT, UNIQUE per session | Sequential sample index. |
| `MEASURED_AT` / `DEVICE_TIME_US` | TIMESTAMP / BIGINT | Timestamps. |
| `ECG_VALUE_UV` | NUMERIC(12,3) | Raw ECG amplitude, in microvolts. |
| `ADC_VALUE` | SMALLINT | Raw analog-to-digital converter reading. |
| `QUALITY_FLAG` | VARCHAR(15), NOT NULL, default `'VALID'`, `CHECK IN ('VALID','SUSPECT','ARTIFACT','EXCLUDED')` | Signal quality flag. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_MOTION` — [RELATIONAL]
Accelerometer/gyroscope/magnetometer/temperature samples — used to separate
physical movement from physiological stress.

| Column | Type | Description |
|---|---|---|
| `MOTION_ID` | BIGINT, **PK** | Surrogate key. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `GDX_CC_SESSION` (cascade delete) | Parent session. |
| `SAMPLE_NUMBER` | BIGINT, UNIQUE per session | Sequential sample index. |
| `MEASURED_AT` / `DEVICE_TIME_US` | TIMESTAMP / BIGINT | Timestamps. |
| `ACC_X_MS2` / `ACC_Y_MS2` / `ACC_Z_MS2` | NUMERIC(12,6) | Triaxial acceleration. |
| `GYRO_X_DPS` / `GYRO_Y_DPS` / `GYRO_Z_DPS` | NUMERIC(12,5) | Triaxial rotation rate. |
| `MAG_X_MGAUSS` / `MAG_Y_MGAUSS` / `MAG_Z_MGAUSS` | NUMERIC(12,5) | Triaxial magnetic field. |
| `DEVICE_TEMP_C` | NUMERIC(6,2), `CHECK` 0–65 | **Device's own internal temperature — not body temperature.** |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_HRV_WINDOW` — [RELATIONAL]
Aggregated HRV/coherence metrics computed over a time window within a session —
the analysis-ready output, and the source for `DW_FACT_CC_HRV_WINDOW`.

| Column | Type | Description |
|---|---|---|
| `HRV_WINDOW_ID` | BIGINT, **PK** | Surrogate key. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `GDX_CC_SESSION` (cascade delete) | Parent session. |
| `WINDOW_STARTED_AT` / `WINDOW_ENDED_AT` | TIMESTAMP, NOT NULL | Window bounds (`CHECK` ensures end > start). |
| `WINDOW_SECONDS` | INTEGER, NOT NULL, `CHECK` > 0 | Window length. |
| `VALID_BEAT_COUNT` | INTEGER | Number of valid beats in the window. |
| `MEAN_RR_MS` / `MEAN_HEART_RATE_BPM` | NUMERIC | Window averages. |
| `RMSSD_MS` | NUMERIC(10,3), `CHECK` ≥ 0 | Root Mean Square of Successive Differences — core time-domain HRV index. |
| `SDNN_MS` | NUMERIC(10,3), `CHECK` ≥ 0 | Standard Deviation of NN intervals — global HRV index. |
| `RESPIRATORY_RATE` | NUMERIC(7,3) | Estimated breathing rate. |
| `COHERENCE_INDEX` | NUMERIC(12,5) | Composite coherence score. |
| `ARTIFACT_PERCENTAGE` | NUMERIC(6,3), `CHECK` 0–100 | Proportion of the window flagged as artifact. |
| `PROTOCOL_PHASE` | VARCHAR(20), NOT NULL, `CHECK IN ('BASELINE','STIMULUS','INTERACTION','RECOVERY','OTHER')` | Which phase of the protocol this window belongs to. |
| `STRESS_CLASS` | VARCHAR(20), `CHECK IN ('RELAXED','BASELINE','ACTIVATED','STRESSED','INCONCLUSIVE')` | **Algorithmic classification — explicitly not a clinical diagnosis.** |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

#### `GDX_CC_DEVICE_EVENT` — [RELATIONAL]
Technical/quality events logged by the device during a session (battery,
contact loss, Bluetooth, resets, errors).

| Column | Type | Description |
|---|---|---|
| `DEVICE_EVENT_ID` | BIGINT, **PK** | Surrogate key. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `GDX_CC_SESSION` (cascade delete) | Parent session. |
| `EVENT_AT` | TIMESTAMP, NOT NULL | When the event occurred. |
| `DEVICE_TIME_US` | BIGINT | Device-internal timestamp. |
| `EVENT_TYPE` | VARCHAR(25), NOT NULL, `CHECK IN ('BATTERY','CONTACT_LOSS','BLUETOOTH','ECG_RESET','DATA_GAP','CLOCK_SYNC','START','STOP','OTHER')` | Event category. |
| `SEVERITY_LEVEL` | VARCHAR(10), NOT NULL, default `'INFO'`, `CHECK IN ('INFO','WARNING','ERROR')` | Severity. |
| `BATTERY_PERCENTAGE` | NUMERIC(5,2), `CHECK` 0–100 | Battery level at the time of the event, if relevant. |
| `EVENT_CODE` / `EVENT_DESCRIPTION` | VARCHAR | Free-text event detail. |
| `CREATED_AT` | TIMESTAMP, NOT NULL, default `CURRENT_TIMESTAMP` | Record creation time. |

---

## 2. Analytical Model (Data Warehouse) — `7.multidimensional.database/godatax_human_dw_model_firebird25.sql`

A single star-schema analytical layer unifying all five relational schemas above
(psychometrics, septenary, chakras, five ways, cardiac coherence) for
cross-perspective querying. **Design rule**: dimension keys reuse the source
system's own BIGINT primary key wherever one already exists — no parallel
surrogate ID space is invented. `GDX_PSY_PERSON` is the single, central person
table for the whole DW; `DW_DIM_PERSON` is sourced from it alone.

### 2.1 Dimensions (11)

#### `DW_DIM_PERSON` — [ANALYTICAL / DW]
Central, single person dimension for the entire warehouse — sourced only from
`GDX_PSY_PERSON` + `GDX_PSY_STUDY_PARTICIPANT`. There is no second/redundant
person dimension for the cardiac-coherence side.

| Column | Type | Description |
|---|---|---|
| `ID_PERSON` | BIGINT, **PK** | Reused directly from `GDX_PSY_PERSON.ID_PERSON`. |
| `EXTERNAL_IDENTIFIER` | VARCHAR(60) | From `GDX_PSY_PERSON`. |
| `ANONYMOUS_CODE` | VARCHAR(60) | From `GDX_PSY_STUDY_PARTICIPANT`. |
| `CURRICULAR_GROUP` | VARCHAR(80) | From `GDX_PSY_STUDY_PARTICIPANT.EXPERIMENTAL_GROUP`. |
| `ID_STUDY` | BIGINT | Denormalized study reference. |
| `STUDY_TITLE` | VARCHAR(200) | Denormalized study title. |

#### `DW_DIM_INSTRUMENT` — [ANALYTICAL / DW]
Instrument dimension, mirroring `GDX_PSY_INSTRUMENT`'s descriptive attributes.

| Column | Type | Description |
|---|---|---|
| `ID_INSTRUMENT` | BIGINT, **PK** | Reused from `GDX_PSY_INSTRUMENT.ID_INSTRUMENT`. |
| `NAME` | VARCHAR(160), NOT NULL | Instrument name. |
| `VERSION` | VARCHAR(30) | Version label. |
| `TYPE` | VARCHAR(50) | Instrument type. |
| `ACTIVE` | SMALLINT | Active flag. |

#### `DW_DIM_CONSTRUCT` — [ANALYTICAL / DW]
Construct dimension, mirroring `GDX_PSY_CONSTRUCT`.

| Column | Type | Description |
|---|---|---|
| `ID_CONSTRUCT` | BIGINT, **PK** | Reused from `GDX_PSY_CONSTRUCT.ID_CONSTRUCT`. |
| `NAME` | VARCHAR(120), NOT NULL | Construct name. |
| `DOMAIN` | VARCHAR(60) | Domain tag. |

#### `DW_DIM_SEPTENARY_LEVEL` — [ANALYTICAL / DW]
Metaphysical dimension, mirroring `GDX_PSY_SEPTENARY_LEVEL`.

| Column | Type | Description |
|---|---|---|
| `ID_SEPTENARY_LEVEL` | BIGINT, **PK** | Reused. |
| `ORDER_NUM` | SMALLINT, NOT NULL | Position 1–7. |
| `NAME` | VARCHAR(60), NOT NULL | Level name. |
| `TECHNICAL_NAME` | VARCHAR(80) | Technical/Sanskrit name. |
| `NATURE` | VARCHAR(40) | Nature of the level. |
| `CONSCIOUSNESS_FUNCTION` | VARCHAR(500) | Function in consciousness. |

#### `DW_DIM_CHAKRA` — [ANALYTICAL / DW]
Energetic dimension, mirroring `GDX_PSY_CHAKRA`, with a direct FK into the
metaphysical dimension so a query can relate "chakra" and "septenary level" for
free.

| Column | Type | Description |
|---|---|---|
| `ID_CHAKRA` | BIGINT, **PK** | Reused. |
| `ORDER_NUM` | SMALLINT, NOT NULL | Position 1–7. |
| `SANSKRIT_NAME` / `COMMON_NAME` | VARCHAR(60), NOT NULL | Chakra names. |
| `SYMBOLIC_COLOR` / `SYMBOLIC_ELEMENT` | VARCHAR(40) | Symbolic attributes. |
| `ID_SEPTENARY_LEVEL` | BIGINT, NOT NULL, FK → `DW_DIM_SEPTENARY_LEVEL` | Corresponding level. |

#### `DW_DIM_FIVE_WAY` — [ANALYTICAL / DW]
Metaphysical dimension, mirroring `GDX_TA_WAY`, with an FK into the same
septenary level dimension (several ways may share one level).

| Column | Type | Description |
|---|---|---|
| `ID_WAY` | BIGINT, **PK** | Reused. |
| `ORDER_NUM` | SMALLINT, NOT NULL | Order 1–5. |
| `LATIN_NAME` / `ENGLISH_NAME` | VARCHAR | Way names. |
| `ARGUMENT_TYPE` | VARCHAR(60) | Argument category. |
| `CONCLUSION` | VARCHAR(500) | What the way concludes. |
| `ID_SEPTENARY_LEVEL` | BIGINT, FK → `DW_DIM_SEPTENARY_LEVEL` (nullable) | Corresponding level — nullable because level 7 is deliberately left unmapped. |

#### `DW_DIM_VARIABLE` — [ANALYTICAL / DW]
The hinge dimension of the whole warehouse: every psychometric variable,
carrying its own optional link into the metaphysical dimension — this is how the
psychometric fact reaches chakras/ways/levels through **one** dimension, with no
extra FK duplicated on the fact table.

| Column | Type | Description |
|---|---|---|
| `ID_VARIABLE` | BIGINT, **PK** | Reused from `GDX_PSY_VARIABLE.ID_VARIABLE`. |
| `NAME` | VARCHAR(150), NOT NULL | Variable name. |
| `SAV_COLUMN` | VARCHAR(60) | Original `.sav` column code, kept for traceability. |
| `ID_CONSTRUCT` | BIGINT, NOT NULL, FK → `DW_DIM_CONSTRUCT` | Parent construct. |
| `ID_INSTRUMENT` | BIGINT, FK → `DW_DIM_INSTRUMENT` | Owning instrument. |
| `ID_SEPTENARY_LEVEL` | BIGINT, FK → `DW_DIM_SEPTENARY_LEVEL` (nullable) | Resolved septenary mapping, denormalized from `GDX_PSY_SEPT_LEVEL_PSY_MAP`. |
| `SEPT_LEVEL_CONFIDENCE` | VARCHAR(20) | Confidence of that mapping. |

#### `DW_DIM_ITEM` — [ANALYTICAL / DW]
Item dimension, mirroring `GDX_PSY_INSTRUMENT_ITEM`'s descriptive attributes.

| Column | Type | Description |
|---|---|---|
| `ID_ITEM` | BIGINT, **PK** | Reused. |
| `ID_INSTRUMENT` | BIGINT, NOT NULL, FK → `DW_DIM_INSTRUMENT` | Owning instrument. |
| `ITEM_ORDER` | INTEGER | Position within instrument. |
| `RESPONSE_TYPE` | VARCHAR(30) | Response type. |

#### `DW_DIM_DEVICE` — [ANALYTICAL / DW]
Device dimension, mirroring `GDX_CC_DEVICE`.

| Column | Type | Description |
|---|---|---|
| `DEVICE_ID` | BIGINT, **PK** | Reused. |
| `MANUFACTURER` / `MODEL_NAME` | VARCHAR(80) | Device identity. |
| `DEVICE_TYPE` | VARCHAR(20) | Device category. |
| `FIRMWARE_VERSION` | VARCHAR(40) | Firmware version. |

#### `DW_DIM_SESSION` — [ANALYTICAL / DW]
Cardiac-coherence session dimension. Carries `ID_PERSON` pointing directly into
the central `DW_DIM_PERSON` — this is how the physiological perspective enters
the "single person table" rule, with no separate cardiac person dimension.

| Column | Type | Description |
|---|---|---|
| `SESSION_ID` | BIGINT, **PK** | Reused from `GDX_CC_SESSION.SESSION_ID`. |
| `ID_PERSON` | BIGINT, NOT NULL, FK → `DW_DIM_PERSON` | Participant (same key space as `GDX_PSY_PERSON`). |
| `DEVICE_ID` | BIGINT, NOT NULL, FK → `DW_DIM_DEVICE` | Device used. |
| `SIGNAL_TYPE` / `PROTOCOL_NAME` / `BODY_POSITION` / `ALGORITHM_NAME` | VARCHAR | Session descriptors. |
| `STARTED_AT` / `ENDED_AT` | TIMESTAMP | Session window. |

#### `DW_DIM_DATE` — [ANALYTICAL / DW]
The only **generated** (non-reused) dimension — a standard calendar dimension.
`DATE_KEY = -1` is the reserved "no date" member, used by every psychometric
fact row (the `.sav` data carries no timestamps, only person + study).

| Column | Type | Description |
|---|---|---|
| `DATE_KEY` | INTEGER, **PK** | Generated key; `-1` reserved for "no date". |
| `FULL_DATE` | DATE | Calendar date. |
| `YEAR_NUM` / `MONTH_NUM` / `DAY_NUM` / `WEEKDAY_NUM` | SMALLINT | Calendar parts. |

### 2.2 Facts (3)

#### `DW_FACT_PSY_ITEM_RESPONSE` — [ANALYTICAL / DW]
Grain: one row per (person, item) raw questionnaire response.

| Column | Type | Description |
|---|---|---|
| `FACT_ID` | BIGINT, **PK** | Surrogate fact key (sequence-generated — facts are the exception to "reuse the source key", since no single source row grain matches 1:1). |
| `ID_PERSON` | BIGINT, NOT NULL, FK → `DW_DIM_PERSON`, UNIQUE with `ID_ITEM` | Respondent. |
| `ID_ITEM` | BIGINT, NOT NULL, FK → `DW_DIM_ITEM` | Item answered. |
| `ID_INSTRUMENT` | BIGINT, NOT NULL, FK → `DW_DIM_INSTRUMENT` | Owning instrument (denormalized for convenient filtering). |
| `ID_APPLICATION` | BIGINT, NOT NULL | Originating `GDX_PSY_APPLICATION` id (kept for traceability, not a dimension FK here). |
| `NUMERIC_VALUE` | NUMERIC(12,4) | The measure: scored response value. |

#### `DW_FACT_PSY_VARIABLE_RESULT` — [ANALYTICAL / DW]
Grain: one row per (person, variable) computed score. **The fact that reaches
every other perspective**, via `DW_DIM_VARIABLE`'s own link to
`DW_DIM_SEPTENARY_LEVEL` (→ `DW_DIM_CHAKRA`, `DW_DIM_FIVE_WAY`).

| Column | Type | Description |
|---|---|---|
| `FACT_ID` | BIGINT, **PK** | Surrogate fact key. |
| `ID_PERSON` | BIGINT, NOT NULL, FK → `DW_DIM_PERSON`, UNIQUE with `ID_VARIABLE` | Person scored. |
| `ID_VARIABLE` | BIGINT, NOT NULL, FK → `DW_DIM_VARIABLE` | Variable scored. |
| `ID_APPLICATION` | BIGINT, NOT NULL | Originating application id. |
| `RAW_SCORE` / `STANDARDIZED_SCORE` | NUMERIC(14,4) | The measures. |
| `PERCENTILE` | NUMERIC(6,2) | Percentile rank. |

#### `DW_FACT_CC_HRV_WINDOW` — [ANALYTICAL / DW]
Grain: one row per HRV/coherence window inside a cardiac-coherence session.

| Column | Type | Description |
|---|---|---|
| `FACT_ID` | BIGINT, **PK** | Surrogate fact key. |
| `ID_PERSON` | BIGINT, NOT NULL, FK → `DW_DIM_PERSON` | Participant. |
| `SESSION_ID` | BIGINT, NOT NULL, FK → `DW_DIM_SESSION` | Parent session. |
| `DATE_KEY` | INTEGER, NOT NULL, FK → `DW_DIM_DATE` | Calendar date of the window (or `-1`). |
| `WINDOW_SECONDS` / `VALID_BEAT_COUNT` | INTEGER | Window size and beat count. |
| `MEAN_RR_MS` / `MEAN_HEART_RATE_BPM` | NUMERIC | Window averages. |
| `RMSSD_MS` / `SDNN_MS` | NUMERIC(10,3) | Core HRV measures. |
| `RESPIRATORY_RATE` | NUMERIC(7,3) | Estimated breathing rate. |
| `COHERENCE_INDEX` | NUMERIC(12,5) | Composite coherence score. |
| `ARTIFACT_PERCENTAGE` | NUMERIC(6,3) | Artifact proportion. |
| `PROTOCOL_PHASE` / `STRESS_CLASS` | VARCHAR(20) | Denormalized descriptive attributes, carried onto the fact for convenient filtering. |

### Cross-schema constraint (no new table)

`7.multidimensional.database/godatax_human_dw_fk_gdx_cc_person_firebird25.sql`
adds one FK, `FK_GDX_CC_PERSON_DW_PERSON`, from `GDX_CC_PERSON.ID_PERSON` to
`DW_DIM_PERSON.ID_PERSON` — enforcing at the schema level (not just at ETL time)
that a cardiac-coherence person can only exist if the same `ID_PERSON` already
exists in the central person dimension.

---

## 3. Folders with no Firebird tables of their own

| Folder | Why it defines no table |
|---|---|
| `0.new.instrument` | Hosts the onboarding **skills** (`GDX_SKILL_NEW_STUDY`, `GDX_SKILL_RECORD_NEW_STUDY`, `GDX_SKILL_EXPORT_NEW_STUDY`, `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`, `GDX_SKILL_DELETE_STUDY`) that **write into** the tables already defined in §1.1 (`GDX_PSY_STUDY`, `GDX_PSY_INSTRUMENT`, etc.) — it is a process/pipeline layer, not a schema of its own. |
| `8.gdx.dashboards` | Generates self-contained HTML charts by **reading** the Data Warehouse (§2) and the psychometric-properties catalog (§1.1); it persists nothing back to Firebird. |
| `9.knowledge.graph` | Projects the 55 tables catalogued here into **Neo4j** (one node label per table, one relationship type per FK) — a graph database, not Firebird. |
| `10.gdx.machine.learning` | Runs link-prediction and community-detection **on the Neo4j graph**; reads only Neo4j, writes only timestamped Markdown reports. |
| `12.gdx.virtology` | The 33-virtue catalog and its variable↔virtue mapping live only in code (`virtue_knowledge.js`), never in Firebird — see `Virtology_Knowledge_Base.md`. |
| `14.metaphysical.measuring.instrument` | Documentation and a read-only audit skill (`GDX_SKILL_LIST_ASSOCIATIONS`) over the tables/code already catalogued above; the OT7 prototype instrument itself is not yet implemented as a schema. |
