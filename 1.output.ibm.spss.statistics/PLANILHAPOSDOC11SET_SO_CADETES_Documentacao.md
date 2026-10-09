# SPSS Dataset Documentation — `PLANILHAPOSDOC11SET SO CADETES.sav`

> Generated on 2026-09-19 from a direct read of the `.sav` file (via `pyreadstat` in Python) located at
> `1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav`, cross-checked against the knowledge
> already documented in `2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` (SPSS → Firebird
> mapping, generated on 2026-09-10 from the same file plus the supporting documents `Quadro Síntese das
> Escalas.docx` and `ESCALA PESQUISA PORTUGAL AMAN 2012.pptx`, which are no longer present in this folder).

## 1. Study identification

- **Study title:** *Predictors of Adaptability to Military Higher Education*.
- **Institution/population:** Military Academy — applied to cadets / officer cadets ("SO CADETES" in the file name).
- **File:** `PLANILHAPOSDOC11SET SO CADETES.sav` (IBM SPSS Statistics, binary `.sav` format).
- **File encoding:** `WINDOWS-1252`.
- **SPSS file label:** *(not set)*.
- **SPSS internal notes:** *(none)*.
- **Cases (rows):** 423.
- **Variables (columns):** 159.

## 2. General structure

The dataset is a flat numeric matrix (all 159 variables stored as `double`), with no embedded
metadata: `pyreadstat` found **no** variable labels, **no** value labels, and **no** defined
missing-value ranges (`missing_ranges`) in the `.sav` file. In other words, the entire semantic
meaning of the columns (instrument name, authorship, item text, response anchors) comes from
sources external to the file — already reconstructed in `SPSS_to_Firebird_Mapping.md` and
summarized here.

The 159 columns break down as:

| Group | # of columns | Description |
|---|---|---|
| `ID` | 1 | Numeric respondent identifier (784–1645), 423 unique values, no duplicates. |
| Raw scale items (`AC`, `ef`, `Ha`, `En`, `SV`, `ST`, `RP`, `an`, `red`) | 137 | Item-by-item responses to 9 instruments/questionnaire blocks (see §3–4). |
| `ano` | 1 | Nominal context variable — the cadet's curricular year (1st to 4th year). |
| Computed scores (dimension means) | 20 | Already calculated in SPSS from the item blocks (see §3–4). |

**SPSS measure (`variable_measure`):** all variables are `scale`, except `ano`, which is `nominal`.

**Display format:** raw items in `F9.0` (but with real decimal values 1–5 or 0–4, width-only format),
`ID`/`ano` in `F7.0`, computed scores in `F8.1`/`F8.2` (item means, with decimal places).

## 3. Identified instruments (high confidence)

Confirmed by name/authorship/items in the `Quadro Síntese das Escalas` and the supporting `.pptx` (see original mapping).

| Scale | Authorship | Raw columns | Dimensions → computed column | Response anchor |
|---|---|---|---|---|
| Hardiness (Psychological Resilience) | Bartone, Ursano, Wright & Ingraham, 1989; adapted by Mallar & Capitão, 2004 | `Ha1`–`Ha30` (30 items) | Commitment→`HARDcompromis` · Control→`HARDcontrole` · Challenge→`HARDdesafio` | 1=Not at all true … 5=Completely true |
| Student Engagement Scale | Schaufeli, Martinez, Marques Pinto, Salanova & Bakker, 2002 | `En1`–`En14` (14 items) | Vigor→`ENGAGvigor` · Dedication→`ENGAGdedicac` · Absorption→`ENGAGabsorc` | 1=Never … 5=Always |
| Career Adapt-Abilities Scale (CAAS) | Duarte, Fraga, Agostinho, Djaló, Lima, Paredes, Rafael & Soares, 2011 | `AC1`–`AC28` (28 items) | Concern→`ACpreocup` · Control→`ACcontrole` · Curiosity→`ACcuriosid` · Confidence→`ACconfianc` | 1=Very little … 5=A lot |
| Satisfaction With Life Scale (SWLS) | Diener, Emmons, Larson & Griffin, 1985 | `SV1`–`SV5` (5 items) | Single index→`SATISFVIDA` | 1=Never … 5=Always |
| Job Satisfaction Scale | Judge & Klinger, 2000 | `ST1`–`ST5` (5 items) | Single index→`SATISFTRAB` | 1=Never … 5=Always |
| Positivity Ratio Scale | Fredrickson, 2009; De Sousa, Gonçalves & Rosinha, 2010 | `RP1`–`RP20` (20 items) | Positive emotions→`EmocPos` (items 1,4,8,11,12,13,14,15,16,19) · Negative emotions→`EmocNeg` (items 2,3,5,6,7,9,10,17,18,20) | 0=Not at all … 4=Very much |
| General Emotion Level | same Fredrickson/Rosinha family | single item, not individually named in the `.sav` | probably embedded in `EmocPos`/`EmocNeg` | 0=Not at all … 4=Very much |
| Personal Satisfaction | Diener, 1995 | single item, not individually named | `SatPes` | 1=Not at all satisfied … 5=Completely satisfied |
| Perceived Control of Life | Inglehart, 1998 | single item, not individually named | `CtrlVi` | 1=No control … 5=Total control |

## 4. Blocks with medium/low confidence (not documented in the supporting sources)

| Block | # items | Observed range | Hypothesis | Why it's uncertain |
|---|---|---|---|---|
| `ef1`–`ef18` | 18 | 1.0–5.0 | Maslach Burnout Inventory - Student Survey (Maroco & Tecedeiro, 2009) — Emotional Exhaustion (5) + Depersonalization (4) + Efficacy/Personal Accomplishment (6) | The summary table documents this scale with **15 items**, but the file has **18 `ef*` columns**. There is no computed column (`ExaustEmoc`, `Despers`, etc.) associated with this block in the `.sav`. |
| `an1`–`an11` | 11 | 1.0–5.0 | Scale not documented in the summary table or the `.pptx`. The name + statistics suggest 4 computed sub-dimensions right after `RedTap`: `AnoOrg` (mean 2.34, the lowest — possibly "Organizational Anomie"), `SucProfFin` (Professional/Financial Success, mean 4.09), `CondSocie` (Social Standing, mean 3.15), `RealizPess` (Personal Fulfillment, mean 4.03) | No supporting document mentions this scale — authorship and item text unknown. |
| `red1`–`red5` | 5 | 1.0–5.0 | "Red Tape" / perceived bureaucracy → `RedTap` (mean 3.34) | The name matches (`red` → `RedTap`), but the scale/authorship is not in the summary table or the `.pptx` — text of the 5 items unknown. |
| `ano` | 1 (nominal, values 1–4, 1 case missing) | — | Cadet's curricular year (1st–4th year) | Not a scale score, it is a context/demographic variable — distinct from `AnoOrg` (which has fractional means, i.e. is a multi-item score, not the curricular year). |

## 5. Documented in the supporting sources but **absent** from the `.sav`

- **Perceived Stress Scale (PSS-10)**, Moreira, 2002, 10 items — there is no remaining 10-column block compatible with this scale.
- **"How do you currently rate your academic performance?"** (single item, 1–5 scale) — the original `.pptx` itself explicitly records that this item **does not appear in the data**.

## 6. Descriptive statistics per variable

Calculated directly over the file's 423 cases (`pandas.describe()` + missing-value count).

### 6.1 Identifier
**ID — respondent identifier**

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `ID` | 423 | 0 | 784 | 1645 | 1214.34 | 249.83 |

### 6.2 Career Adapt-Abilities Scale — raw items
**AC1–AC28 (CAAS)** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `AC1` | 423 | 0 | 1 | 5 | 4.02 | 0.73 |
| `AC2` | 423 | 0 | 1 | 5 | 3.99 | 0.74 |
| `AC3` | 423 | 0 | 1 | 5 | 4.15 | 0.70 |
| `AC4` | 423 | 0 | 1 | 5 | 3.99 | 0.68 |
| `AC5` | 423 | 0 | 2 | 5 | 3.99 | 0.67 |
| `AC6` | 423 | 0 | 1 | 5 | 3.94 | 0.68 |
| `AC7` | 423 | 0 | 1 | 5 | 3.87 | 0.86 |
| `AC8` | 423 | 0 | 1 | 5 | 3.99 | 0.80 |
| `AC9` | 423 | 0 | 1 | 5 | 4.17 | 0.70 |
| `AC10` | 423 | 0 | 1 | 5 | 4.48 | 0.70 |
| `AC11` | 423 | 0 | 2 | 5 | 4.29 | 0.68 |
| `AC12` | 423 | 0 | 1 | 5 | 4.14 | 0.75 |
| `AC13` | 423 | 0 | 2 | 5 | 3.99 | 0.75 |
| `AC14` | 423 | 0 | 2 | 5 | 4.17 | 0.73 |
| `AC15` | 423 | 0 | 1 | 5 | 3.79 | 0.69 |
| `AC16` | 423 | 0 | 2 | 5 | 4.06 | 0.69 |
| `AC17` | 423 | 0 | 1 | 5 | 3.99 | 0.71 |
| `AC18` | 423 | 0 | 1 | 5 | 3.94 | 0.63 |
| `AC19` | 423 | 0 | 2 | 5 | 3.92 | 0.68 |
| `AC20` | 423 | 0 | 1 | 5 | 4.00 | 0.69 |
| `AC21` | 423 | 0 | 1 | 5 | 3.97 | 0.73 |
| `AC22` | 423 | 0 | 2 | 5 | 4.13 | 0.70 |
| `AC23` | 423 | 0 | 2 | 5 | 4.09 | 0.67 |
| `AC24` | 423 | 0 | 2 | 5 | 4.07 | 0.66 |
| `AC25` | 423 | 0 | 2 | 5 | 4.41 | 0.71 |
| `AC26` | 423 | 0 | 2 | 5 | 4.30 | 0.63 |
| `AC27` | 423 | 0 | 1 | 5 | 4.16 | 0.69 |
| `AC28` | 423 | 0 | 2 | 5 | 4.28 | 0.66 |

### 6.3 `ef` block (hypothesis: Maslach Burnout Inventory - Student Survey)
**ef1–ef18** — 1–5 scale, no computed score in the file

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `ef1` | 423 | 0 | 1 | 5 | 4.02 | 0.82 |
| `ef2` | 423 | 0 | 2 | 5 | 4.26 | 0.65 |
| `ef3` | 423 | 0 | 1 | 5 | 3.63 | 0.85 |
| `ef4` | 423 | 0 | 1 | 5 | 4.11 | 0.82 |
| `ef5` | 423 | 0 | 1 | 5 | 2.67 | 0.92 |
| `ef6` | 423 | 0 | 1 | 5 | 3.86 | 0.79 |
| `ef7` | 423 | 0 | 1 | 5 | 3.08 | 0.91 |
| `ef8` | 423 | 0 | 2 | 5 | 4.10 | 0.70 |
| `ef9` | 423 | 0 | 1 | 5 | 3.64 | 1.02 |
| `ef10` | 423 | 0 | 1 | 5 | 3.98 | 0.77 |
| `ef11` | 423 | 0 | 1 | 5 | 2.76 | 0.97 |
| `ef12` | 423 | 0 | 1 | 5 | 3.98 | 1.05 |
| `ef13` | 423 | 0 | 2 | 5 | 4.14 | 0.76 |
| `ef14` | 423 | 0 | 1 | 5 | 3.26 | 0.89 |
| `ef15` | 423 | 0 | 1 | 5 | 4.16 | 0.82 |
| `ef16` | 423 | 0 | 1 | 5 | 4.41 | 0.89 |
| `ef17` | 423 | 0 | 1 | 5 | 3.01 | 0.89 |
| `ef18` | 423 | 0 | 1 | 5 | 3.23 | 1.00 |

### 6.4 Context variable
**ano — curricular year** — nominal, 1–4; distribution: 1st=99, 2nd=104, 3rd=108, 4th=111, missing=1

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `ano` | 422 | 1 | 1 | 4 | 2.55 | 1.12 |

### 6.5 Hardiness — raw items
**Ha1–Ha30** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `Ha1` | 423 | 0 | 2 | 5 | 4.53 | 0.66 |
| `Ha2` | 423 | 0 | 2 | 5 | 4.25 | 0.71 |
| `Ha3` | 423 | 0 | 2 | 5 | 4.40 | 0.68 |
| `Ha4` | 423 | 0 | 1 | 5 | 3.41 | 0.87 |
| `Ha5` | 423 | 0 | 1 | 5 | 2.37 | 0.74 |
| `Ha6` | 423 | 0 | 1 | 5 | 4.12 | 0.86 |
| `Ha7` | 423 | 0 | 1 | 5 | 4.33 | 0.73 |
| `Ha8` | 423 | 0 | 1 | 5 | 3.20 | 0.94 |
| `Ha9` | 423 | 0 | 1 | 5 | 3.33 | 0.79 |
| `Ha10` | 423 | 0 | 1 | 5 | 4.18 | 0.71 |
| `Ha11` | 423 | 0 | 1 | 5 | 4.31 | 0.68 |
| `Ha12` | 423 | 0 | 1 | 5 | 3.80 | 0.78 |
| `Ha13` | 423 | 0 | 1 | 5 | 2.45 | 0.77 |
| `Ha14` | 423 | 0 | 1 | 5 | 3.84 | 0.88 |
| `Ha15` | 423 | 0 | 1 | 5 | 3.73 | 0.73 |
| `Ha16` | 423 | 0 | 1 | 5 | 4.49 | 0.78 |
| `Ha17` | 423 | 0 | 1 | 5 | 4.21 | 0.75 |
| `Ha18` | 423 | 0 | 1 | 5 | 3.55 | 0.80 |
| `Ha19` | 423 | 0 | 1 | 5 | 3.47 | 0.88 |
| `Ha20` | 423 | 0 | 1 | 5 | 3.78 | 0.98 |
| `Ha21` | 423 | 0 | 1 | 5 | 3.48 | 0.85 |
| `Ha22` | 423 | 0 | 1 | 5 | 3.87 | 0.93 |
| `Ha23` | 423 | 0 | 1 | 5 | 2.38 | 0.84 |
| `Ha24` | 423 | 0 | 1 | 5 | 2.85 | 0.93 |
| `Ha25` | 423 | 0 | 1 | 5 | 3.93 | 0.83 |
| `Ha26` | 423 | 0 | 1 | 5 | 3.22 | 0.84 |
| `Ha27` | 423 | 0 | 1 | 5 | 3.80 | 0.80 |
| `Ha28` | 423 | 0 | 1 | 5 | 4.14 | 0.85 |
| `Ha29` | 423 | 0 | 1 | 5 | 3.89 | 0.86 |
| `Ha30` | 423 | 0 | 1 | 5 | 2.99 | 0.97 |

### 6.6 Student Engagement Scale — raw items
**En1–En14** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `En1` | 423 | 0 | 1 | 5 | 3.01 | 0.96 |
| `En2` | 423 | 0 | 1 | 5 | 2.86 | 1.08 |
| `En3` | 423 | 0 | 1 | 5 | 2.48 | 0.85 |
| `En4` | 423 | 0 | 1 | 5 | 2.52 | 0.87 |
| `En5` | 423 | 0 | 1 | 5 | 2.66 | 0.97 |
| `En6` | 423 | 0 | 1 | 5 | 3.66 | 0.95 |
| `En7` | 423 | 0 | 1 | 5 | 3.05 | 0.89 |
| `En8` | 423 | 0 | 1 | 5 | 3.12 | 0.88 |
| `En9` | 423 | 0 | 1 | 5 | 3.55 | 0.92 |
| `En10` | 423 | 0 | 1 | 5 | 3.47 | 0.88 |
| `En11` | 423 | 0 | 1 | 5 | 3.13 | 1.09 |
| `En12` | 423 | 0 | 1 | 5 | 2.69 | 0.97 |
| `En13` | 423 | 0 | 1 | 5 | 2.48 | 1.02 |
| `En14` | 423 | 0 | 1 | 5 | 2.68 | 0.91 |

### 6.7 Satisfaction With Life Scale — raw items
**SV1–SV5** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `SV1` | 423 | 0 | 1 | 5 | 3.58 | 0.82 |
| `SV2` | 423 | 0 | 1 | 5 | 3.62 | 0.87 |
| `SV3` | 423 | 0 | 1 | 5 | 3.64 | 0.85 |
| `SV4` | 423 | 0 | 1 | 5 | 3.88 | 0.86 |
| `SV5` | 423 | 0 | 1 | 5 | 3.32 | 1.19 |

### 6.8 Job Satisfaction Scale — raw items
**ST1–ST5** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `ST1` | 423 | 0 | 1 | 5 | 3.70 | 0.82 |
| `ST2` | 423 | 0 | 1 | 5 | 3.57 | 0.84 |
| `ST3` | 423 | 0 | 1 | 5 | 3.49 | 0.91 |
| `ST4` | 423 | 0 | 1 | 5 | 3.86 | 0.81 |
| `ST5` | 423 | 0 | 1 | 5 | 4.34 | 0.85 |

### 6.9 Positivity Ratio Scale — raw items
**RP1–RP20** — 0–4 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `RP1` | 423 | 0 | 0 | 4 | 2.61 | 0.83 |
| `RP2` | 423 | 0 | 0 | 4 | 1.60 | 0.95 |
| `RP3` | 423 | 0 | 0 | 4 | 0.66 | 0.80 |
| `RP4` | 423 | 0 | 0 | 4 | 2.00 | 0.93 |
| `RP5` | 423 | 0 | 0 | 4 | 0.82 | 0.88 |
| `RP6` | 423 | 0 | 0 | 4 | 0.76 | 0.88 |
| `RP7` | 423 | 0 | 0 | 4 | 0.97 | 0.87 |
| `RP8` | 423 | 0 | 0 | 4 | 2.45 | 0.82 |
| `RP9` | 423 | 0 | 0 | 4 | 0.99 | 0.92 |
| `RP10` | 423 | 0 | 0 | 4 | 1.00 | 0.97 |
| `RP11` | 423 | 0 | 0 | 4 | 2.79 | 0.74 |
| `RP12` | 423 | 0 | 0 | 4 | 2.45 | 0.81 |
| `RP13` | 423 | 0 | 0 | 4 | 2.60 | 0.77 |
| `RP14` | 423 | 0 | 0 | 4 | 2.69 | 0.80 |
| `RP15` | 423 | 0 | 0 | 4 | 2.52 | 0.94 |
| `RP16` | 423 | 0 | 0 | 4 | 2.68 | 0.80 |
| `RP17` | 423 | 0 | 0 | 4 | 1.17 | 0.82 |
| `RP18` | 423 | 0 | 0 | 4 | 0.99 | 0.89 |
| `RP19` | 423 | 0 | 0 | 4 | 2.39 | 0.86 |
| `RP20` | 423 | 0 | 0 | 4 | 1.57 | 1.03 |

### 6.10 Standalone items/scores (Positivity family / Diener / Inglehart)
**EmocPos, EmocNeg, SatPes, CtrlVi**

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `EmocPos` | 423 | 0 | 0 | 4 | 3.00 | 0.58 |
| `EmocNeg` | 423 | 0 | 0 | 4 | 1.33 | 0.72 |
| `SatPes` | 423 | 0 | 1 | 5 | 3.91 | 0.62 |
| `CtrlVi` | 423 | 0 | 1 | 5 | 3.77 | 0.58 |

### 6.11 `an` block (undocumented)
**an1–an11** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `an1` | 423 | 0 | 1 | 5 | 2.30 | 1.08 |
| `an2` | 423 | 0 | 1 | 5 | 2.65 | 1.01 |
| `an3` | 423 | 0 | 1 | 5 | 2.39 | 1.09 |
| `an4` | 423 | 0 | 1 | 5 | 2.40 | 1.01 |
| `an5` | 423 | 0 | 1 | 5 | 2.49 | 0.94 |
| `an6` | 423 | 0 | 1 | 5 | 2.18 | 0.95 |
| `an7` | 423 | 0 | 1 | 5 | 2.40 | 1.05 |
| `an8` | 423 | 0 | 1 | 5 | 2.11 | 0.99 |
| `an9` | 423 | 0 | 1 | 5 | 2.48 | 0.98 |
| `an10` | 423 | 0 | 1 | 5 | 2.17 | 0.99 |
| `an11` | 423 | 0 | 1 | 5 | 2.13 | 0.96 |

### 6.12 `red` block (undocumented, hypothesis: Red Tape)
**red1–red5** — 1–5 scale

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `red1` | 423 | 0 | 1 | 5 | 3.42 | 1.17 |
| `red2` | 423 | 0 | 1 | 5 | 3.33 | 1.00 |
| `red3` | 423 | 0 | 1 | 5 | 2.87 | 0.95 |
| `red4` | 423 | 0 | 1 | 5 | 3.50 | 1.12 |
| `red5` | 423 | 0 | 1 | 5 | 3.57 | 1.03 |

### 6.13 Computed scores (dimension means)
**20 calculated variables** — already aggregated in SPSS from the blocks above

| Variable | Valid N | Missing N | Min | Max | Mean | SD |
|---|---|---|---|---|---|---|
| `SATISFVIDA` | 423 | 0 | 1 | 5 | 3.61 | 0.69 |
| `SATISFTRAB` | 423 | 0 | 1.8 | 5 | 3.79 | 0.57 |
| `ENGAGvigor` | 423 | 0 | 1 | 4.8 | 2.71 | 0.73 |
| `ENGAGdedicac` | 423 | 0 | 1 | 5 | 3.23 | 0.68 |
| `ENGAGabsorc` | 423 | 0 | 1 | 4.75 | 2.75 | 0.75 |
| `HARDcompromis` | 423 | 0 | 2.33333 | 5 | 4.03 | 0.49 |
| `HARDcontrole` | 423 | 0 | 2.25 | 4.8 | 3.77 | 0.47 |
| `HARDdesafio` | 423 | 0 | 1.2 | 4 | 2.81 | 0.43 |
| `AnoOrg` | 423 | 0 | 1 | 5 | 2.34 | 0.70 |
| `RedTap` | 422 | 1 | 1 | 5 | 3.34 | 0.85 |
| `SucProfFin` | 423 | 0 | 2.66667 | 5 | 4.08 | 0.53 |
| `CondSocie` | 423 | 0 | 1 | 5 | 3.15 | 0.70 |
| `RealizPess` | 423 | 0 | 1.8 | 5 | 4.03 | 0.61 |
| `ACpreocup` | 423 | 0 | 2.14286 | 5 | 3.99 | 0.50 |
| `ACcontrole` | 423 | 0 | 2.71429 | 5 | 4.18 | 0.49 |
| `ACcuriosid` | 423 | 0 | 2 | 5 | 3.95 | 0.48 |
| `ACconfianc` | 423 | 0 | 2 | 5 | 4.21 | 0.51 |

## 7. Data quality and completeness

- **Total missing cells in the entire dataset:** 2 (out of 67257 cells) — the dataset is practically complete.
- **Rows with at least one missing value:** 2 of 423.
- **Fully complete rows:** 421 of 423.
- The two only detected missing values are: 1 case in `ano` and 1 case in `RedTap`.
- None of the 137 raw scale items (`AC`, `ef`, `Ha`, `En`, `SV`, `ST`, `RP`, `an`, `red`) have any missing values.
- `ID` has no duplicates (423 unique values for 423 cases) and falls in the range 784–1645.

## 8. Known limitations and open points

1. **No item dictionary in the `.sav`.** The full item text only exists in the supporting documents (`.pptx`/`.docx`),
   which are no longer present in this folder of the repository — only the summary already extracted in `SPSS_to_Firebird_Mapping.md`.
2. **`ef1`–`ef18` has no computed score in the file.** If it is indeed the Maslach Student Survey, the subscales
   (Emotional Exhaustion/Depersonalization/Accomplishment-Efficacy) would need to be recalculated from the 18 raw items,
   in addition to resolving the discrepancy between 15 (documented) and 18 (found) items.
3. **`an1`–`an11` is an unidentified scale** — authorship name and items unknown.
4. **Reverse-scored items from Hardiness** (and possibly other scales) cannot be identified
   from the data alone — needed to faithfully reproduce the computed scores from the raw items.
5. **PSS-10 and the academic-performance item** are documented in the supporting sources but confirmed absent from this data.

## 9. Related documents in this repository

- `2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` — complete mapping of this `.sav` to the
  psychometrics relational model (Firebird), including the detailed reasoning behind identifying each scale and
  the gaps to resolve before extraction.
- `2.relational.model.psychometrics/samples.SQL/` — scripts `01_load_study.sql`–`08_adjust_sequences.sql` that
  actually loaded this data into the `GDX_PSY_*` database.
- `2.relational.model.psychometrics/analyses.CFA/AFC_Career_Adaptability.md` and
  `2.relational.model.psychometrics/analyses.EFA/EFA_Loadings_Means_SD_Career_Adaptability.md` — factor
  analyses (CFA/EFA) already performed on the `AC1`–`AC28` items of this file.
- `8.gdx.dashboards/` — HTML dashboards that consume this dataset's computed scores
  ("predictors-of-adaptability-to-military-higher-education").
