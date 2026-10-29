# GoDataX Human 7ph

## Inclusion of New Measurement Instruments for Virtology — Full Reuse of the Existing Relational Model

**FUNCTIONAL SPECIFICATION • METADATA MAPPING • FIREBIRD 2.5 • NEO4J**

Version 1.0 | Addendum and revision of the proposal for including new measurement instruments

> **Binding directive:** Reuse the `GDX_PSY_*` and `GDX_VT_*` tables shown in the diagrams, registering instruments, constructs, variables, indicators, items, responses, and applications. Column changes are likewise not assumed.

---

## 1. Architectural Decision and Scope

The current architecture already provides the psychometric catalogs, the application and result mechanisms, and the link between virtues and variables. Therefore, the inclusion of new instruments for Virtology must occur primarily through configuration records, semantic versioning, and new instruments/items — not through the creation of a parallel table domain. Neo4j remains an analytical projection, never a substitute source for the relational database.

The scope of this document is a mapping proposal for new measurement instruments; no DDLs with columns, FKs, sizes, or constraints were provided. For this reason, the metadata-discovery commands are executable in Firebird 2.5, while the `INSERT` statements are templates that must be parameterized after inspecting the schema.

## 2. Inventory Confirmed by the Psychometric Diagram

Note: the diagram is logical. It does not confirm column names or which tables implement versioning, response type, provenance, or duration. These properties must be verified before loading data.

| Family | Identified Existing Tables |
|---|---|
| Studies and People | `GDX_PSY_STUDY`; `GDX_PSY_PERSON`; `GDX_PSY_STUDY_PARTICIPANT`; `GDX_PSY_TEAM_MEMBER` |
| Instruments | `GDX_PSY_INSTRUMENT`; `GDX_PSY_INSTRUMENT_ITEM`; `GDX_PSY_ITEM_ALTERNATIVES`; `GDX_PSY_INSTRUMENT_CONSTRUCT` |
| Measures | `GDX_PSY_VARIABLE`; `GDX_PSY_INDICATOR`; `GDX_PSY_INDICATOR_ITEM`; `GDX_PSY_PSYCHOMETRIC_PROPERTY`; `GDX_PSY_CONSTRUCT` |
| Application and Results | `GDX_PSY_APPLICATION`; `GDX_PSY_ITEM_RESPONSE`; `GDX_PSY_INDICATOR_RESULT`; `GDX_PSY_CONSTRUCT_RESULT` |
| Context and Evaluation | `GDX_PSY_OBSERVATION`; `GDX_PSY_EVALUATOR`; `GDX_PSY_EVALUATION`; `GDX_PSY_EVALUATION_ACTION`; `GDX_PSY_ACTION` |
| General Concepts | `GDX_PSY_PHENOMENON`; `GDX_PSY_PHENOMENON_CONSTRUCT`; `GDX_PSY_OCCUPATION`; `GDX_PSY_PERSON_OCCUPATION` |
| Virtology | `GDX_VT_VIRTUE`; `GDX_VT_VARIABLE_VIRTUE_MAP` (linked to `GDX_PSY_VARIABLE`) |

## 3. Modeling Rule: No New Tables

Phenomenon → Construct → Variable → Indicator/Items → Instrument → Application → Responses/Results. The relationship of a variable to virtues continues to live in `GDX_VT_VARIABLE_VIRTUE_MAP`. New Virtology concepts enter as instruments, constructs, variables, indicators, and items; repeated events are successive collections over time, whenever the existing schema supports the necessary keys and dates.

## 4. Proposed Instruments and Constructs

| Logical Code | Instrument/Area | Suggested Modeling | Status |
|---|---|---|---|
| VIR-NEED-51 | 51 human needs | 5 groups as constructs; 51 needs as variables/indicators; items for satisfaction, excess, duration, and impact | New exploratory instrument |
| VIR-VIRT-33 | Competencies of the 33 virtues | Reuse `GDX_VT_VIRTUE`; link observable variables to the virtue via `GDX_VT_VARIABLE_VIRTUE_MAP` | Complements current associations |
| VIR-REAL | Real-world application, generalization, and autonomy | Indicators by opportunities, contexts, recovery time, self-report/observer, maintenance | New follow-up instrument |
| VIR-DIFF | Differential Management | Items/variables related to identity, temperament, defense, pleasure/relief, destination, recognition, and dating | Exploratory interview/formulation |
| VIR-FLOW | Law of Flow | Stimulus, intensity, personality, range, driver, Law of Life, perception, and reaction | Contextual record sheet, without an arithmetic product |
| VIR-LEARN-7 | Seven learning conditions | 7 variables, items for exposure/application/frequency, and perceived quality | Pedagogical checklist |
| VIR-LAW-22 | 22 Laws of Life | 22 philosophical variables/concepts; reflective items without diagnostic scoring | Interpretive reference |
| VIR-DEV-13 | 33-virtue protocol in 13 steps | 13 execution indicators per cycle; sub-items for morning, day, night, week, and review | Adherence record |

## 5. Correspondence with the Existing Psychometric Collection

The instruments VIA/GACS-72 (character strengths), IPIP (personality traits), SCS (self-compassion), and GQ-6 (gratitude) are already associated with the 33 virtues, with conceptual relationships classified as direct, partial, or exploratory. These links must be preserved: new virtue-application indicators enrich, rather than replace, the current constructs. New associations must record source, version, degree of proximity, and validation status in the existing fields/structures that actually accommodate such metadata.

## 6. 51 Needs — Operationalization

Build the measurement structure in `GDX_PSY_INSTRUMENT`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_VARIABLE`, and `GDX_PSY_INSTRUMENT_ITEM`; individual scoring in `GDX_PSY_ITEM_RESPONSE`; derived results in `GDX_PSY_INDICATOR_RESULT`. Properties such as duration must carry an explicit unit and reference period. Deficiency/balance/excess, if used, are exploratory classifications, not validated psychometric cutoffs.

| Group | Count | Examples/Scope |
|---|---|---|
| Primitive | 8 | Survival; security; protection; importance |
| Sensation and Bonding | 21 | Contact, comfort, expression, bonds, and privacy |
| Development | 11 | Self-development, knowledge, inquiry, introspection |
| Reconnection | 8 | Purpose, self-realization, contribution, finitude |
| Transcendence | 3 | Self-transcendence, unity, and fullness |

## 7. 33 Virtues and the 13-Step Protocol

The longitudinal unit is the application of an instrument on a defined date: start, daily/weekly execution, and follow-ups. Depending on the current schema, the cycle can be recognized by study, application, form, and instrument code. If no identifier exists to join multiple applications to the same plan, document this gap before execution — do not invent a heuristic grouping that could mix cycles.

| Steps | Time | Capturable Observation |
|---|---|---|
| 1–7 | Morning | Preparation, reading, affirmation, writing, mental rehearsal, active recovery, situational plan |
| 8 | Day | Safe opportunity, action taken, and contextual adequacy |
| 9–10 | Night | Episode report, error/success, sleep and rest |
| 11–12 | Week | Specific exercise and a ten-question circle (optional participation) |
| 13 | Review | Follow-ups at 7, 30, 90, and 180 days, on a calendar defined by the study |

## 8. Real-World Application Indicators

| Indicator | Operational Definition | Caveat |
|---|---|---|
| Application rate | Adequate applications / eligible opportunities | No opportunities => NULL |
| Generalization | New contexts with application / new contexts assessed | Requires a formal definition of context |
| Recovery | Time between episode and return to defined functioning | Unit and measurement method |
| Adherence | Steps completed / applicable steps | Not equivalent to efficacy |
| Autonomy | Help needed in the action or the choice | Requires its own scale |
| Maintenance | Comparisons at follow-up points | Control for non-response |

## 9. Differential Management, the Law of Flow, and the Laws of Life

**Differential Management:** record competing hypotheses about identity, temperament, and defense; keep the status undetermined when there is insufficient basis.

**Law of Flow:** `FRP = S × I × P × R × D × LL` (Stimulus × Intensity × Personality × Range × Driver × Law of Life) is conceptual notation; do not generate a metric by multiplying these terms.

The 22 Laws of Life are items for philosophical reflection and interpretive hypotheses, never demonstrated physical laws or clinical tests. In particular, "Quantum Entanglement" does not represent evidence of a quantum mechanism in mental health.

## 10. Inventory of the 22 Laws of Life

| Code | Philosophical Law | Code | Philosophical Law |
|---|---|---|---|
| LV01 | Mentalism | LV12 | Gender |
| LV02 | Vibration | LV13 | Rhythm |
| LV03 | Karma | LV14 | Cause and Effect |
| LV04 | Observer | LV15 | Free Will |
| LV05 | Quantum Entanglement | LV16 | Patience |
| LV06 | Life Is Chaos | LV17 | Love |
| LV07 | Life Works in Cycles | LV18 | Service |
| LV08 | Evolution and Purpose | LV19 | Harmony |
| LV09 | Life Is Movement | LV20 | Unity |
| LV10 | Correspondence | LV21 | Law of Three |
| LV11 | Polarity | LV22 | Truth |

## 11. Seven Learning Conditions

| Code | Condition |
|---|---|
| LC01 | Attention |
| LC02 | Repetition |
| LC03 | Spacing |
| LC04 | Regulated affective load with bonding |
| LC05 | Active engagement with retrieval |
| LC06 | Error feedback (return from error) |
| LC07 | Sleep-based consolidation |

## 12. Mapping to Existing Tables

| Functional Need | Priority Existing Tables | Strategy Without a New Entity |
|---|---|---|
| Instrument definition | `GDX_PSY_INSTRUMENT` | Register new versions/instruments |
| Theoretical dimension and phenomenon | `GDX_PSY_PHENOMENON`; `GDX_PSY_CONSTRUCT` | Concepts, dimensions, and their relationships |
| Measured variable | `GDX_PSY_VARIABLE` | One operational definition per variable |
| Indicator and formula | `GDX_PSY_INDICATOR`; `GDX_PSY_INDICATOR_ITEM` | Reproducible derived results |
| Questions and alternatives | `GDX_PSY_INSTRUMENT_ITEM`; `GDX_PSY_ITEM_ALTERNATIVES` | Scales and options per item |
| People and studies | `GDX_PSY_PERSON`; `GDX_PSY_STUDY`; `GDX_PSY_STUDY_PARTICIPANT` | Reuse IDs and consent |
| Applications and responses | `GDX_PSY_APPLICATION`; `GDX_PSY_ITEM_RESPONSE` | Time series by application |
| Scores and results | `GDX_PSY_INDICATOR_RESULT`; `GDX_PSY_CONSTRUCT_RESULT` | Derived from versioned responses |
| Observations and evaluation | `GDX_PSY_OBSERVATION`; `GDX_PSY_EVALUATION` | Context, judgment, and follow-up according to actual fields |
| Activity/action | `GDX_PSY_ACTION`; `GDX_PSY_EVALUATION_ACTION` | Practice/activity if semantics and cardinality fit |
| Virtue mapping | `GDX_VT_VIRTUE`; `GDX_VT_VARIABLE_VIRTUE_MAP` | Preserve already-existing relationships |

## 13. Firebird 2.5 SQL — Schema Audit (Executable)

Start with the native metadata. The queries below do not assume any functional column and use syntax compatible with Firebird 2.5, SQL Dialect 3.

```sql
SELECT TRIM(r.RDB$RELATION_NAME) AS TABLE_NAME
FROM RDB$RELATIONS r
WHERE r.RDB$SYSTEM_FLAG = 0
  AND (r.RDB$RELATION_NAME STARTING WITH 'GDX_PSY_'
       OR r.RDB$RELATION_NAME STARTING WITH 'GDX_VT_')
ORDER BY 1;

SELECT TRIM(rf.RDB$RELATION_NAME) AS TABLE_NAME,
       TRIM(rf.RDB$FIELD_NAME) AS COLUMN_NAME,
       rf.RDB$FIELD_POSITION AS ORDINAL_POSITION,
       f.RDB$FIELD_TYPE AS FIELD_TYPE,
       f.RDB$FIELD_LENGTH AS FIELD_LENGTH,
       rf.RDB$NULL_FLAG AS NOT_NULL_FLAG
FROM RDB$RELATION_FIELDS rf
JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
WHERE rf.RDB$RELATION_NAME IN
  ('GDX_PSY_INSTRUMENT','GDX_PSY_CONSTRUCT','GDX_PSY_VARIABLE',
   'GDX_PSY_INDICATOR','GDX_PSY_INSTRUMENT_ITEM',
   'GDX_PSY_APPLICATION','GDX_PSY_ITEM_RESPONSE',
   'GDX_VT_VIRTUE','GDX_VT_VARIABLE_VIRTUE_MAP')
ORDER BY 1,3;

SELECT TRIM(rc.RDB$RELATION_NAME) AS TABLE_NAME,
       TRIM(rc.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME,
       TRIM(rc.RDB$CONSTRAINT_TYPE) AS CONSTRAINT_TYPE
FROM RDB$RELATION_CONSTRAINTS rc
WHERE rc.RDB$RELATION_NAME STARTING WITH 'GDX_PSY_'
   OR rc.RDB$RELATION_NAME STARTING WITH 'GDX_VT_'
ORDER BY 1,2;

SELECT TRIM(i.RDB$RELATION_NAME) AS TABLE_NAME,
       TRIM(i.RDB$INDEX_NAME) AS INDEX_NAME,
       s.RDB$FIELD_POSITION AS FIELD_ORDER,
       TRIM(s.RDB$FIELD_NAME) AS COLUMN_NAME
FROM RDB$INDICES i
JOIN RDB$INDEX_SEGMENTS s
  ON s.RDB$INDEX_NAME = i.RDB$INDEX_NAME
WHERE i.RDB$RELATION_NAME STARTING WITH 'GDX_PSY_'
   OR i.RDB$RELATION_NAME STARTING WITH 'GDX_VT_'
ORDER BY 1,2,3;
```

## 14. Firebird 2.5 SQL — Safe Loading and Analyses

Column names were not provided. Therefore, the templates below are deliberately templates, not ready-to-run scripts. Replace column identifiers only after consulting `RDB$RELATION_FIELDS` and verifying FKs/NOT NULL constraints.

```sql
/* TEMPLATE — DO NOT EXECUTE WITHOUT MAPPING REAL COLUMNS
INSERT INTO GDX_PSY_INSTRUMENT
  (<PK>, <CODE>, <NAME>, <VERSION>)
VALUES (<ID_GENERATED_BY_EXISTING_MECHANISM>,
        'VIR-NEED-51', 'Human Needs', '1.0');

-- Repeat registration of constructs, variables, indicators
-- and items in the already-existing GDX_PSY_* tables.
-- Validate all required fields and FKs.
*/

/* ANALYTICAL TEMPLATE — ADJUST COLUMN NAMES
SELECT <PLAN_OR_STUDY_ID>,
       SUM(CASE WHEN <ELIGIBLE_OPPORTUNITY> = 1 THEN 1 ELSE 0 END)
           AS OPPORTUNITIES,
       SUM(CASE WHEN <ELIGIBLE_OPPORTUNITY> = 1
                     AND <ADEQUATE_APPLICATION> = 1
                THEN 1 ELSE 0 END) AS APPLICATIONS,
       CAST(SUM(CASE WHEN <ELIGIBLE_OPPORTUNITY> = 1
                         AND <ADEQUATE_APPLICATION> = 1
                    THEN 1 ELSE 0 END) AS DOUBLE PRECISION)
       / NULLIF(SUM(CASE WHEN <ELIGIBLE_OPPORTUNITY> = 1
                        THEN 1 ELSE 0 END), 0) AS RATE
FROM <QUERY_ON_APPLICATIONS_RESPONSES>
GROUP BY <PLAN_OR_STUDY_ID>;
*/
```

Firebird 2.5: use `SMALLINT` for flags, `TIMESTAMP` without time zone, `VARCHAR(36)` or `CHAR(36)` for UUIDs as per the legacy convention, `BLOB SUB_TYPE TEXT` for narratives, and `GEN_ID(generator, 1)` or an already-existing strategy for keys. Do not use `FILTER`, `TIMESTAMPTZ`, `JSONB`, multi-row `RETURNING`, or DDL syntax from other database engines. Transactional loading is recommended, with prior verification of natural keys and controlled rollback.

## 15. Neo4j Integration Without Additional Tables

The relational database remains the canonical source. The graph can be updated through an incremental ETL process based on existing applications and results; if there is no reliable event mechanism in the legacy system, use extraction via a verified watermark or periodic reconciliation. Do not require a new relational outbox. Each node receives `origin_table`, `origin_pk`, `model_version`, and `evidence_class` when available in the source data; do not infer empirical evidence from a conceptual association.

```cypher
MERGE (v:Virtue {id:$virtueId})
SET v.name = $virtueName;
MERGE (x:PsychometricVariable {id:$variableId})
SET x.name = $variableName;
MERGE (v)-[r:CONCEPTUALLY_MAPPED_TO]->(x)
SET r.proximity = $proximity,
    r.source = $source,
    r.validationStatus = $validationStatus;
```

Besides `Virtue` and `PsychometricVariable`, the graph may also contain `Need`, `LearningCondition`, `LifeLaw`, `Episode`, `Assessment`, and `Hypothesis` nodes, provided they are derivable from existing records or instrument applications; new nodes in Neo4j do not equate to new tables in Firebird.

## 16. Collection and Assessment Workflow

1. Register/select existing study and participants.
2. Apply the current psychometric battery and the candidate Virtology instruments.
3. Produce results within the current indicator schema.
4. Relate virtue variables to the already-measured constructs.
5. Apply the development protocol across successive assessments.
6. Collect opportunities and episodes via forms.
7. Relate physiological/EEG responses whenever a valid session exists.
8. Draft a revisable interpretive formulation.
9. Reassess at the defined checkpoints.
10. Export pseudonymized data for analysis and for Neo4j.

## 17. Integrated Perspectives of GDX H7ph

| Existing Dimension | Integration Contribution |
|---|---|
| Psychometrics | Complementary instruments and links to VIA/GACS-72, IPIP, SCS, GQ-6, CAAS, Hardiness, Engagement, and other existing measures |
| Neurophysiology | Associations with ECG/HRV, EDA, EEG, respiration, and observed sessions, without automatic causal attribution |
| Metaphysicometrics | Interpretive hypotheses on the septenary constitution, chakras, the Five Ways, and other traditions, kept separate from validated scales |
| Knowledge Graph | Traceable, contextual, and versioned relationships |
| Machine Learning | Clustering, predictive models, and temporal validation, avoiding data leakage |
| Environmental/EAP | Confounders and environmental context, if actually collected |
| Education/Distance Learning | Exercises, virtue cycles, and feedback in learning processes |
| Governance | Consent, minimization, audit, versions, and provenance within already-existing resources |

## 18. Implementation Plan Without Creating Tables

| Phase | Deliverable | Acceptance Criterion |
|---|---|---|
| F0 — Inventory | Actual DDL, PK/FK, types, domains, and capabilities existing in the GDX H7ph Framework | Validated column ↔ function matrix |
| F1 — Catalogs | 51 needs, 22 laws, seven conditions, 13 steps, and links to the 33 virtues | Cardinality and nomenclature verified |
| F2 — Instruments | Items, alternatives, variables, indicators, and versions | End-to-end test application |
| F3 — Longitudinal | Repeated applications and real indicators | Same participant on different dates, without ambiguity |
| F4 — Virtology and Graph | Incremental associations and export to Neo4j | Auditable provenance and reconciliation |
| F5 — Pilot Study | Feasibility, safety, consistency, and instrument review | Report and scientific go/no-go decision |

## 19. Scientific Validation and Limits

The Virtology taxonomy is a theoretical source, not psychometric validation. New instruments may require content validation, cognitive interviews, pilots, EFA/CFA where applicable, internal consistency, test-retest reliability, measurement invariance, and convergent/discriminant validity. For behavioral indicators, inter-rater agreement, self-report bias, occurrence opportunities, and missing data must be assessed. Comparative studies are required for efficacy claims, and physiological measures do not prove the existence of metaphysical categories.

The Law of Flow is not a calibrated multiplication; the 22 Laws of Life are philosophical categories. Do not automatically convert moral classification into diagnosis, nor assign causal responsibility for violence, abuse, or loss. The selection of competencies must preserve identity, autonomy, and context.

## 20. Blocking Points to Resolve Before Writing Final INSERTs

| Verification | Why |
|---|---|
| Actual fields of the `GDX_PSY_*` and `GDX_VT_*` tables | Avoid invalid scripts or destructive updates |
| Instrument ↔ variable ↔ construct cardinality | Ensure correct association of measures and results |
| Existing item types and alternatives | Support scales, narrative, and duration |
| Study/application IDs and timestamps | Ensure longitudinality and cycles without duplication |
| Versioning and provenance strategy | Preserve the distinction between evidence and interpretation |
| Current observation and action capability | Check whether episode and plan fit without semantic distortion |
| Reproduction rights for items and materials | Respect Eduardo Casarotto's rights |
| Consent, audit, and retention mechanism | Enable ethical data processing |

## 21. Documentary References Used to Suggest New Measurement Instruments

Eduardo Casarotto — *As Diferenças da Virtologia* [The Differences of Virtology], slide deck (90 pages); Participant Handbook, *As Diferenças da Virtologia* (145 pages). Diagrams submitted by the proponent: `GDX_PSY_*` relational model and the `GDX_VT_VIRTUE` ↔ `GDX_VT_VARIABLE_VIRTUE_MAP` ↔ `GDX_PSY_VARIABLE` relationship. Consolidated base document, *GDX H7ph Virtology*, previous version. This version replaces only the persistence strategy: it abandons the creation of additional tables and preserves the scientific and functional objectives already implemented previously by the GDX H7ph Framework.
