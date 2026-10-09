# OT-7 — Purpose Orientation | Registered Metaphysical Instrument

> Consolidates the OT-7 metaphysical instrument proposal from the project's two source documents
> — `Orientacao_a_Finalidade_Trivium_Quadrivium_OT7.pdf` (working document, 2026-09-26, already
> present in this same folder) and the GDX H7ph book/scientific article (`Beyond the Labyrinth
> v2.docx`) — and documents how that proposal was actually registered in the database (study,
> instrument, variables, items) and linked to the Septenary Constitution and to Aquinas's Five Ways.
> Written manually on 2026-10-09 from the real load into the local Firebird database
> (`13.on.bording.env/GODATAX7HPH.GDB`).

## 1. What OT-7 is

**Name:** Purpose Orientation (provisional working name: **OT-7** — **O**rientation,
**T**eleology, **7** liberal arts of the Trivium/Quadrivium).

**Nature:** an **experimental metaphysicometric prototype, explicitly NOT validated** — no
norms, cutoffs, or reliability/validity evidence. Within the GDX H7ph project it serves as a case
study of how a metaphysical concept can move through the stages: conceptual definition →
decomposition into dimensions → formulation of observable items → experimental application →
future investigation of psychometric properties.

**Philosophical anchor:** Aquinas's Fifth Way (*Summa Theologiae*, I, Q.2, Art.3 — governance,
order, and finality). The other four ways offer context questions but are not, themselves,
variables or scales. Applying the Fifth Way to the finality of a human action is a contemporary
interpretive extension of the framework — Aquinas never proposed a vital-energy scale or a
psychometric instrument based on the Five Ways.

**Observational decomposition:** the seven medieval liberal arts (Trivium: grammar, logic,
rhetoric; Quadrivium: arithmetic, geometry, music, astronomy), used here as **analytical lenses
adapted to the project**, not as variables Aquinas himself historically formulated.

**Central distinction preserved throughout the design:** psychometric and physiological data can
be observed and analyzed; the metaphysical dimension is an **interpretive lens proposed by the
framework**, not a form of energy already measured by science. A correlation between an OT-7
variable and a physiological indicator can support an *association* between the data — it does
not demonstrate that the metaphysical variable is a physical quantity, nor that it causes the
result.

## 2. The seven dimensions (lenses) and the items

One item per dimension, response 0–5 (0 = "Does not describe me" … 5 = "Completely"), referring to
the last 14 days and to a personal goal chosen by the respondent.

| # | Group | Art | Dimension | Item (statement) |
|---|---|---|---|---|
| 1 | Trivium | Grammar | Clarity of purpose | I can clearly describe the goal I am trying to achieve. |
| 2 | Trivium | Logic | Coherence between means and ends | My recent actions are coherent with this goal. |
| 3 | Trivium | Rhetoric | Expression of purpose | I can explain why this goal matters to me. |
| 4 | Quadrivium | Arithmetic | Proportion between resources and goal | I distributed time and effort in a way compatible with this goal. |
| 5 | Quadrivium | Geometry | Structure among goals, values, and actions | I can align this goal with my values and my other responsibilities. |
| 6 | Quadrivium | Music | Rhythm and continuity | I maintain a sustainable pace and adjust my effort when my vitality changes. |
| 7 | Quadrivium | Astronomy | Cycles and broader context | I reassess this goal when the context, priorities, or conditions change. |

**Associated behaviors (working hypotheses, not causal claims):** goal-directed action,
self-regulation, and adaptive persistence — provisionally linked to the seven lenses (see source
PDF, Step 3). Perceived vitality is recorded as a **separate** psychological observable, not a
metaphysical one (Ryan & Frederick, 1997).

## 3. How it was registered in the database (GDX_PSY_* / psychometrics_model_firebird25.sql)

Existing tables from the psychometric layer were reused — **no new table was created for
metaphysical variables/instruments**: `VARIABLE_TYPE = 'METAPHYSICS'` (a free column, no `CHECK`
constraint) is what distinguishes these 7 variables from the psychological/SPSS ones already
loaded.

| Entity | Registered value |
|---|---|
| `GDX_PSY_STUDY` | #2 "Purpose Orientation (OT-7) - Exploratory Pilot Study", status `PLANNED` |
| `GDX_PSY_PHENOMENON` | #12 "Purpose Orientation (OT-7, hypothesis)" |
| `GDX_PSY_CONSTRUCT` | "Purpose Orientation (OT-7, hypothesis)", `DOMAIN = 'METAPHYSICAL'` |
| `GDX_PSY_INSTRUMENT` | #12 "Purpose Orientation (OT-7)", `VERSION = '2026'`, `TYPE = 'LIKERT_SCALE'` |
| `GDX_PSY_VARIABLE` | 7 variables (one per dimension, ids 23–29), all `VARIABLE_TYPE = 'METAPHYSICS'`, `MEASUREMENT_LEVEL = 'INTERVAL'` |
| `GDX_PSY_INDICATOR` | 1 indicator per variable (`INDICATOR_TYPE = 'SINGLE_ITEM_SCORE'`, `MIN_VALUE = 0`, `MAX_VALUE = 5`) |
| `GDX_PSY_INSTRUMENT_ITEM` | 7 items, `RESPONSE_TYPE = 'LIKERT_0_5'` (a new value — existing SPSS studies used `LIKERT_0_4`/`LIKERT_5`) |
| `GDX_PSY_ITEM_ALTERNATIVE` | 6 alternatives per item (0–5), same text/label across all 7 items |

**Update (2026-10-09):** every `GDX_PSY_*` catalog field for this study (study `TITLE`, phenomenon
and construct `NAME`/`DEFINITION`, instrument `NAME`/`DESCRIPTION`/`INSTRUCTIONS`, all 10 variable
`NAME`/`DESCRIPTION`/`OPERATIONAL_DEFINITION`, all 10 indicators, the 7 item `STATEMENT_TEXT`
values, and all 42 response-alternative `LABEL`s) was translated to English directly in the live
Firebird database — see
`0.new.instrument/new_study_intake/ot7-orientacao-finalidade/04_translate_catalog_to_english.sql`.
`intake.json` and the other load scripts in that same folder were rewritten in English to match,
so a fresh load from scratch would no longer reintroduce the original Portuguese text.

Pipeline used (same project skills, no new table):

```
0.new.instrument/new_study_intake/ot7-orientacao-finalidade/intake.json   <- written by hand from the PDF/book
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   (generate_new_study_scripts.py + execute_new_study.js)
        |
        v
GDX_SKILL_LOAD_SEPT_MAPS_DB  (--study ot7-orientacao-finalidade)  -> see Section 4
        |
        v
Manual INSERTs into GDX_TA_WAY_SEPT_MAP (no skill covers this mapping yet) -> see Section 4
```

**Operational note:** when running the load, the `SEQ_GDX_PSY_STUDY` generator was out of sync
with the data restored from the remote backup (`GEN_ID` at 0, yet `ID_STUDY = 1` already existed)
— fixed before the real load (see this session's history; not a schema problem per se, just the
post-restore state of that `.gbk` file).

## 3b. Associated behaviors (hypotheses, no instrument yet)

The source document (Step 3) proposes three behavioral patterns that would relate to the seven
OT-7 dimensions — but it only gives loose free-text indicators, not items/scale. They were
registered as catalog entries (construct + variable + indicator), **with no instrument/items**,
linked to the same OT-7 phenomenon (#12) via
`GDX_PSY_PHENOMENON_CONSTRUCT.RELATION_TYPE = 'HYPOTHESIZED_CORRELATE'`
(script `0.new.instrument/new_study_intake/ot7-orientacao-finalidade/03_behavioral_correlates.sql`).

| Entity | Value |
|---|---|
| `GDX_PSY_CONSTRUCT` | #13 "Behavioral Patterns Associated with OT-7 (hypothesis)", `DOMAIN = 'PSYCHOLOGICAL'` |

| Variable | Base OT-7 dimensions | Indicator (pending) |
|---|---|---|
| #30 Goal-Directed Action (OT-7, hypothesis) | Grammar, Logic, Arithmetic, Geometry | `INDICATOR_TYPE = 'PENDING_MEASUREMENT'` |
| #31 Self-Regulation (OT-7, hypothesis) | Logic, Arithmetic, Geometry, Music, Astronomy | `INDICATOR_TYPE = 'PENDING_MEASUREMENT'` |
| #32 Adaptive Persistence (OT-7, hypothesis) | Logic, Rhetoric, Arithmetic, Music, Astronomy | `INDICATOR_TYPE = 'PENDING_MEASUREMENT'` |

These 3 variables were **not** linked to `GDX_PSY_SEPT_LEVEL_PSY_MAP` nor to `GDX_TA_WAY_SEPT_MAP`
— they are observable (psychological) behaviors, not metaphysical readings; Section 4 below only
covers the 7 metaphysical OT-7 variables themselves.

## 4. Associations with the Septenary Constitution and with the Five Ways

The 7 variables were linked to **both** of the framework's `_MAP` tables, with the **same reading
in both**: everything at Septenary Level **#6 Buddhic Body** and at the **Fifth Way**
(governance/order/finality), confidence `SPECULATIVE` on every row — this is the only
correspondence the source documents actually assert (the anchoring of the **whole** OT-7 construct,
not a distinct way/level per Trivium/Quadrivium lens). Giving each lens a different septenary level
would be an invention unsupported by the sources.

### 4.1 `GDX_PSY_SEPT_LEVEL_PSY_MAP` (3.septenary.constitution)

Loaded via `GDX_SKILL_LOAD_SEPT_MAPS_DB --study ot7-orientacao-finalidade` (7 rows inserted), with
new entries in `knowledge.js` keyed by the variable's own name (there is no `.sav` file behind it
— the normal case for a study onboarded via `GDX_SKILL_NEW_STUDY`).

| OT-7 Variable | Septenary Level | Confidence |
|---|---|---|
| Clarity of Purpose (Grammar) | #6 Buddhic Body | SPECULATIVE |
| Coherence Between Means and Ends (Logic) | #6 Buddhic Body | SPECULATIVE |
| Expression of Purpose (Rhetoric) | #6 Buddhic Body | SPECULATIVE |
| Proportion Between Resources and Goal (Arithmetic) | #6 Buddhic Body | SPECULATIVE |
| Structure Among Goals, Values, and Actions (Geometry) | #6 Buddhic Body | SPECULATIVE |
| Rhythm and Continuity (Music) | #6 Buddhic Body | SPECULATIVE |
| Cycles and Broader Context (Astronomy) | #6 Buddhic Body | SPECULATIVE |

### 4.2 `GDX_TA_WAY_SEPT_MAP` (5.five.ways.tomas.aquino)

This table originally only linked Way ↔ Septenary Level (5 conceptual rows, one per way, with no
instrument/variable at all). For OT-7 it was **extended** with the same free-text fields
`GDX_PSY_SEPT_LEVEL_PSY_MAP` already had (`ID_INSTRUMENT`, `INSTRUMENT_LABEL`, `ID_VARIABLE`,
`VARIABLE_LABEL`, `RECORDED_BEHAVIOR`) — see `metaphysical_variable_way_map_firebird25.sql` (DDL)
and `ot7_way_map_dml_firebird25.sql` (the 7 rows themselves), both in this folder.

Two design decisions in the schema extension (detailed in the DDL header):
1. The new fields are **nullable** (the 5 original conceptual rows have no instrument/variable).
2. Uniqueness changed from `(ID_WAY, ID_SEPTENARY_LEVEL)` to `(ID_WAY, ID_SEPTENARY_LEVEL,
   VARIABLE_LABEL)` — the original only allowed 1 row per way, which would have blocked more than
   one metaphysical variable on the same way.

| OT-7 Variable | Way | Septenary Level | Confidence |
|---|---|---|---|
| Clarity of Purpose (Grammar) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Coherence Between Means and Ends (Logic) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Expression of Purpose (Rhetoric) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Proportion Between Resources and Goal (Arithmetic) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Structure Among Goals, Values, and Actions (Geometry) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Rhythm and Continuity (Music) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |
| Cycles and Broader Context (Astronomy) | 5. Fifth Way (Governance/Teleological) | #6 Buddhic Body | SPECULATIVE |

## 5. Explicit limits (inherited from the source document)

- One item per dimension is enough to present the idea, but does not allow a robust assessment of
  each dimension's internal consistency.
- There are no cutoffs, norms, diagnosis, or clinical interpretation.
- Until validation exists, the result should be called an "exploratory purpose-orientation
  profile," reporting each dimension separately — never as a clinical assessment or a proven
  measure of metaphysical energy.
- The full validation path (content, item expansion, pilot/reliability, prior hypotheses,
  replication, usage rules) is described in the source PDF, "Validation and Limits" section.

## 6. Related files

| File | Role |
|---|---|
| `Orientacao_a_Finalidade_Trivium_Quadrivium_OT7.pdf` | Original conceptual document (primary source of this proposal) |
| `metaphysical_variable_way_map_firebird25.sql` | DDL — extends `GDX_TA_WAY_SEPT_MAP` with instrument/variable fields |
| `ot7_way_map_dml_firebird25.sql` | DML — the 7 OT-7 ↔ Five Ways association rows |
| `0.new.instrument/new_study_intake/ot7-orientacao-finalidade/intake.json` | Full intake (study, instrument, 7 variables, 7 items) consumed by `GDX_SKILL_RECORD_NEW_STUDY` |
| `3.septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/knowledge.js` | Septenary judgment-call entries for the 7 OT-7 variables |
| `Framework_Associations_20260926_104020.md` | Framework-wide association inventory — updated to reflect this registration's 14 new rows (7 + 7) |
