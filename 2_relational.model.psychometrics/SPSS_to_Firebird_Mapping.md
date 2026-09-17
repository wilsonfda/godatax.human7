# GDX_HUMAN — SPSS (.sav) to Psychometrics Relational Model (Firebird) Mapping

> Generated on 2026-09-10, based on reading:
> - `GDX_HUMAN/output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` (data, via `pyreadstat`)
> - `GDX_HUMAN/output.ibm.spss.statistics/SCALES/utf-8_Quadro Sintese das Escalas.docx` and `(1).docx` (identical — scale summary table)
> - `GDX_HUMAN/output.ibm.spss.statistics/SCALES/ESCALA PESQUISA PORTUGAL AMAN 2012.pptx` (item wording, response anchors, authorship)
> - `GDX_HUMAN/relational.model.psychometrics/psychometrics_model_firebird25.sql` (target DDL)
>
> **Translated from the original Portuguese mapping (2026-09-10); table/column names updated to the English schema (`psychometrics_model_firebird25.sql`). Data was later loaded via `01_load_study.sql`–`08_adjust_sequences.sql` — see the headers of those files for the exact load decisions.**

## 1. What the dataset is

Study **"Predictors of Adaptability to Military Higher Education"** (Military Academy, Portugal), administered to **cadets/officer cadets ("SO CADETES")**.

- **423 respondents** (rows), numeric `ID` column (784–1645), no duplicates → 423 unique IDs, one per person/application.
- **159 variables** (columns): 1 identifier + 137 raw questionnaire items + 1 nominal context variable (`ano`, curricular year) + 20 computed scores (dimension means).
- The `.sav` **has no embedded metadata**: `column_labels` and `variable_value_labels` come back empty from `pyreadstat` — column names are only the short codes (`AC1`, `Ha7`, `ENGAGvigor`...). All the meaning (item wording, scale authorship, response-scale anchors) came from the two Word/PowerPoint files, not from the `.sav`.
- All variables are numeric (`double`); the computed scores have decimal places (item means), the raw items are integers 1–5 (or 0–4 for the positivity scale).

## 2. Instruments identified (high confidence — name, author and items match the summary table)

| Scale | Authors | Raw columns in the `.sav` | Dimensions → computed column | Response anchor (from the pptx) |
|---|---|---|---|---|
| Hardiness | Bartone, Ursano, Wright & Ingraham, 1989; adapt. Mallar & Capitao, 2004 | `Ha1`–`Ha30` (30 items) | Commitment→`HARDcompromis` · Control→`HARDcontrole` · Challenge→`HARDdesafio` | 1=Not True at All … 5=Completely True |
| Student Engagement Scale | Schaufeli, Martinez, Marques Pinto, Salanova & Bakker, 2002 | `En1`–`En14` (14 items) | Vigor→`ENGAGvigor` · Dedication→`ENGAGdedicac` · Absorption→`ENGAGabsorc` | 1=Never … 5=Always |
| Career Adapt-Abilities Scale | Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011 | `AC1`–`AC28` (28 items) | Concern→`ACpreocup` · Control→`ACcontrole` · Curiosity→`ACcuriosid` · Confidence→`ACconfianc` | 1=Very little … 5=A lot |
| Satisfaction With Life Scale | Diener, Emmons, Larson & Griffin, 1985 | `SV1`–`SV5` (5 items) | Single index→`SATISFVIDA` | 1=Never … 5=Always |
| Job Satisfaction Scale | Judge & Klinger, 2000 | `ST1`–`ST5` (5 items) | Single index→`SATISFTRAB` | 1=Never … 5=Always |
| Positivity Ratio Scale | Fredrickson, 2009; De Sousa, Goncalves & Rosinha, 2010 | `RP1`–`RP20` (20 items) | Positive Emotions→`EmocPos` (items 1,4,8,11,12,13,14,15,16,19) · Negative Emotions→`EmocNeg` (items 2,3,5,6,7,9,10,17,18,20) | 0=Not at all … 4=Very much |
| General Emotions Level | same Fredrickson/Rosinha family | single item, not individually named in the `.sav` | probably embedded in the final `EmocPos`/`EmocNeg` (see §4) | 0=Not at all … 4=Very much |
| Personal Satisfaction | Diener, 1995 | single item, not individually named | `SatPes` | 1=Not satisfied at all … 5=Completely Satisfied |
| Perceived Control of Life | Inglehart, 1998 | single item, not individually named | `CtrlVi` | 1=No control … 5=Total Control |

## 3. Blocks with medium/low confidence — **need researcher confirmation before extraction**

| `.sav` block | # items | Observed range | Hypothesis | Why it's not certain |
|---|---|---|---|---|
| `ef1`–`ef18` | 18 | 1.0–5.0 | Maslach Burnout Inventory - Student Survey (Maroco & Tecedeiro, 2009) — Emotional Exhaustion (5) + Depersonalization (4) + Personal Accomplishment/Efficacy (6) | The summary table documents this scale with **15 items**, but the file has **18 `ef*` columns**. There is no computed column (`ExaustEmoc`, `Despers`, etc.) associated with this block in the `.sav` — the 18 raw items seem to have never been aggregated in this spreadsheet. |
| `an1`–`an11` | 11 | 1.0–5.0 | Scale not documented in the summary table or the pptx. Name + statistics suggest 4 sub-dimensions computed right after `RedTap`: `AnoOrg` (mean 2.34, the lowest — possibly "Organizational Anomie"), `SucProfFin` (Professional/Financial Success, mean 4.09), `CondSocie` (Social Standing, mean 3.15), `RealizPess` (Personal Fulfillment, mean 4.03) | Neither reference document (`Quadro Sintese`, `.pptx`) mentions this scale — the authors' names and item wording are unknown from the files read. |
| `red1`–`red5` | 5 | 1.0–5.0 | "Red Tape" / perceived bureaucracy → `RedTap` (mean 3.34) | The name matches (`red` → `RedTap`), but the scale/author is not in the summary table or the pptx — the wording of the 5 items is unknown. |
| `ano` | 1 (nominal, values 1–4, 1 missing case) | — | Cadet's curricular year (1st–4th year) | Not a scale score, it's a context/demographic variable — but it is not the same as `AnoOrg` (which has fractional means, i.e. it is a multi-item score, not the curricular year). |

## 4. Documented in the summary table/pptx but **absent** from the `.sav`

- **Perceived Stress Scale (PSS-10)**, Moreira, 2002, 10 items — there is no block of 10 leftover columns that matches this scale. Not found in the file.
- **"How do you currently rate your academic performance?"** (single item, 1–5 scale) — the pptx itself (slide 16) explicitly notes **"DOES NOT APPEAR IN THE DATA"**. Confirmed: there is no corresponding column.

## 5. Structural mapping to the `GDX_PSY_*` schema (Firebird)

| Concept in the `.sav` | Target table/column | Note |
|---|---|---|
| The study as a whole ("Predictors of Adaptability to Military Higher Education") | `GDX_PSY_STUDY` (1 record) | `TITLE`, `METHOD` from pptx slide 1; `STATUS` likely `'COMPLETED'` (data already collected). |
| `ID` column (784–1645) | `GDX_PSY_PERSON.EXTERNAL_IDENTIFIER` (or `GDX_PSY_STUDY_PARTICIPANT.ANONYMOUS_CODE`) | The dataset is already anonymized — there is no name/email in the `.sav`. Recommended to use `GDX_PSY_STUDY_PARTICIPANT.ANONYMOUS_CODE` as the primary target (that is exactly what the field is for) and create a synthetic `GDX_PSY_PERSON` (`NAME` can be a generic placeholder, since it is not in the data). |
| Each row of the `.sav` (1 person = 1 battery application) | `GDX_PSY_STUDY_PARTICIPANT` (1 row) + `GDX_PSY_APPLICATION` (1 row per answered instrument, or 1 "umbrella" application covering the whole battery, to be decided) | `ano` (curricular year) is the natural candidate for `GDX_PSY_STUDY_PARTICIPANT.EXPERIMENTAL_GROUP` — **schema gap**: there is no column dedicated to "curricular year"/cohort; `EXPERIMENTAL_GROUP` is the closest available field. |
| Each scale (Hardiness, Engagement, AC, ...) | `GDX_PSY_INSTRUMENT` (1 row per scale) + `GDX_PSY_INSTRUMENT_CONSTRUCT` | `NAME`/`VERSION` from the "Scale" column of the summary table; `INSTRUCTIONS` from the instruction text of each pptx slide. |
| Each dimension/subscale (Commitment, Control, Challenge, Vigor, ...) | `GDX_PSY_CONSTRUCT` (the overall phenomenon, e.g. "Hardiness") + `GDX_PSY_VARIABLE` (the dimension, e.g. "Commitment") | See table in §2 — each "Dimension → computed column" row is 1 `GDX_PSY_VARIABLE`. |
| Raw item (`AC1`, `Ha7`, ...) | `GDX_PSY_INSTRUMENT_ITEM` (1 row per item; `ITEM_ORDER` = item number in the original scale) | `STATEMENT_TEXT` **is not in the `.sav`** — it had to be typed in from the pptx slide text (already extracted in this process, see `SCALES/ESCALA PESQUISA PORTUGAL AMAN 2012.pptx`) and translated to English. `RESPONSE_TYPE` = 5-point Likert (or 0–4 for RP). |
| Response anchors (1=Not True at All...5=Completely True, etc.) | `GDX_PSY_ITEM_ALTERNATIVE` (5 rows per item, `NUMERIC_VALUE` 1–5 or 0–4) | 7 distinct anchor sets were identified in the pptx (Hardiness / Never-Always / Very little-A lot / PSS / 0-4 Not at all-Very much / personal satisfaction / control). The `ef`, `an`, `red` items have unknown anchors (block in §3). |
| Item→dimension, with weight/reversal (e.g. Hardiness has reverse-scored items) | `GDX_PSY_INDICATOR` (1 per dimension, operationalizing the calculation) + `GDX_PSY_INDICATOR_ITEM` (`WEIGHT`, `REVERSED`) | The `REVERSED` field in the schema is exactly for Hardiness's reverse-scored items (not individually identified in this read — needs the original author's scoring key). |
| Each raw response to an item (`AC1=3`, `Ha7=4`...) | `GDX_PSY_ITEM_RESPONSE.NUMERIC_VALUE` | 1 row per (application, item). With 423 people × ~137 raw items → ~58,000 potential rows. |
| Computed dimension score (`HARDcompromis`, `ENGAGvigor`, `ACpreocup`, `EmocPos`, `SatPes`, `CtrlVi`, `SATISFVIDA`, `SATISFTRAB`, `RedTap`, `AnoOrg`, `SucProfFin`, `CondSocie`, `RealizPess` — 20/21 columns) | `GDX_PSY_INDICATOR_RESULT.CALCULATED_VALUE` (preferred, since the schema models the calculation via `GDX_PSY_INDICATOR_ITEM`) **or** `GDX_PSY_VARIABLE_RESULT.RAW_SCORE` (simpler, skips the indicator layer) | `GDX_PSY_VARIABLE_RESULT` is recommended for the first load (direct 1:1 mapping, no need to reconstruct weights/reversals item by item), evolving to `GDX_PSY_INDICATOR`/`GDX_PSY_INDICATOR_RESULT` later once the reverse items are confirmed with the scale's author. This is the path actually used in `07_load_variable_results.sql`. |
| Total construct score (e.g. overall Hardiness) | `GDX_PSY_CONSTRUCT_RESULT` | **Does not exist in the `.sav`** — no column sums the 3 Hardiness dimensions or the 3 Engagement dimensions into a single total. This table stays empty in this load, unless a decision is made to calculate the total on the fly. |

## 6. ⚠️ Gaps to resolve before extracting

1. **No item dictionary in the `.sav`** — full item wording only exists in the `.pptx` (Hardiness, Burnout, Engagement, AC, PSS-10, Satisfaction, Positivity). For the `ef`, `an`, `red` blocks, not even that exists: no wording, no author, no documented anchor.
2. **`ef1`–`ef18` (Burnout?) has no computed score** in the file — if it really is the Maslach Student Survey, someone needs to recalculate `ExaustaoEmoc`/`Despersonaliz`/`RealizEficacia` from the 18 items (and resolve the 15-vs-18-item discrepancy against the summary table).
3. **`an1`–`an11` is an undocumented scale** — before naming a `GDX_PSY_INSTRUMENT`/`GDX_PSY_CONSTRUCT` for it, confirm with the researcher the name/author of the scale behind `AnoOrg`, `SucProfFin`, `CondSocie`, `RealizPess`.
4. **Hardiness's reverse-scored items** (and possibly other scales') cannot be identified from the data read — needed to correctly populate `GDX_PSY_INDICATOR_ITEM.REVERSED`; without it, calculating `GDX_PSY_INDICATOR_RESULT` would not reproduce the scores already computed in the `.sav`.
5. **`GDX_PSY_PERSON.NAME`** is `NOT NULL` in the DDL, but the dataset is anonymized (only a numeric `ID` exists) — the load needs a placeholder value (e.g. `'Participant ' || ID`, as used in `04_load_persons_participants.sql`) or a schema change to allow a null/pseudonymous name in this anonymized research context.
6. **`ano` (curricular year) has no dedicated column** in `GDX_PSY_STUDY_PARTICIPANT` nor in `GDX_PSY_PERSON` — provisionally mapped to `EXPERIMENTAL_GROUP`, but it is semantically "year/cohort", not "experimental group".
7. PSS-10 and the academic-performance item are documented in the scales but are **confirmedly absent** from the data — do not create a `GDX_PSY_INSTRUMENT` for them unless they show up in another source.

## 7. Suggested next step (when the user authorizes extraction)

**Update: this step has since been executed.** The load order below was followed exactly, producing `01_load_study.sql` through `08_adjust_sequences.sql` in this folder: (1) `GDX_PSY_STUDY` → (2) `GDX_PSY_INSTRUMENT` + `GDX_PSY_PHENOMENON`/`GDX_PSY_CONSTRUCT` + `GDX_PSY_VARIABLE` (catalog, once) → (3) `GDX_PSY_INSTRUMENT_ITEM` (catalog, once, using the wording from the `.pptx`, translated to English) → (4) `GDX_PSY_PERSON` + `GDX_PSY_STUDY_PARTICIPANT` (423 rows) → (5) `GDX_PSY_APPLICATION` (423 rows) → (6) `GDX_PSY_ITEM_RESPONSE` (bulk load of the raw items) → (7) `GDX_PSY_VARIABLE_RESULT` (bulk load of the 20/21 computed scores) — the gaps in §6 that block full fidelity (reverse items, `ef`/`an`/`red` wording) were preserved as documented gaps rather than resolved, exactly as flagged above.
