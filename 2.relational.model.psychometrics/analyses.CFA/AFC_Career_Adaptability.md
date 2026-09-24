# CFA — Career Adapt-Abilities Scale (Career Adaptability)

> Generated 2026-09-11. Analyst: Claude Code, at the user's request, over data already loaded into the GoDataX psychometric relational model (`GDX_HUMAN/2.relational.model.psychometrics`).

## 1. Objective

Run a Confirmatory Factor Analysis (CFA) on the **Career Adapt-Abilities Scale (CAAS)** — the first instrument present in the original `.sav` (`PLANILHAPOSDOC11SET SO CADETES.sav`, columns right after `ID`) — to check whether the 4-factor structure proposed by the authors (Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011; Portuguese adaptation of the CAAS by Savickas & Porfeli, 2012) statistically holds in this sample, and to write the fit indices (χ², χ²/df, RMR, GFI, AGFI, CFI, RMSEA, among others) into the relational structure that already existed for this purpose (`GDX_PSY_PSYCHOMETRIC_PROPERTY`), which was empty until this run.

## 2. Input variables

| Item | Detail |
|---|---|
| Data source | `GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` (read via `pyreadstat`), the same file that already fed `GDX_PSY_ITEM_RESPONSE`/`GDX_PSY_VARIABLE_RESULT` in Firebird |
| Instrument | Career Adapt-Abilities Scale (`GDX_PSY_INSTRUMENT.ID_INSTRUMENT = 3`) |
| Construct | Career Adaptability (`GDX_PSY_CONSTRUCT.ID_CONSTRUCT = 3`) |
| Sample | n = 423 respondents (Military Academy cadets), **0 missing values** across the 28 items |
| Observed items (indicators) | `AC1`…`AC28`, 1–5 Likert scale |
| Hypothesized latent factors | **Concern** (AC1–AC7) · **Control** (AC8–AC14) · **Curiosity** (AC15–AC21) · **Confidence** (AC22–AC28) — 7 items per factor |
| Grouping validation | The grouping above was checked item by item against the scores the SPSS file itself had already precomputed (`ACpreocup`, `ACcontrole`, `ACcuriosid`, `ACconfianc`): the mean of each block's 7 items has Pearson correlation = 1.0 and max absolute difference = 0.0 against the matching precomputed column. In other words, the grouping used in the CFA is exactly the same one the original researcher used to compute the scores. |
| Reverse-scored items | None were flagged as reversed in this analysis. There is no documentation (neither in the `.sav` nor in the supporting `.docx`/`.pptx` files) indicating reverse-scored items for the CAAS — unlike Hardiness, whose reversal gap is already documented in `SPSS_to_Firebird_Mapping.md` §6.4. All 28 items have means and semantic direction consistent with direct scoring (higher = more adaptability). |

## 3. Calculation performed

- **Tooling**: Python 3.12, [`semopy`](https://semopy.com/) 2.3.11 (Structural Equation Modeling), `pyreadstat` 1.x to read the `.sav`.
- **Estimator**: Maximum Likelihood (`objective=MLW`, SLSQP optimizer).
- **Model specification** (`semopy` syntax, equivalent to `lavaan`):

```
Concern    =~ AC1 + AC2 + AC3 + AC4 + AC5 + AC6 + AC7
Control    =~ AC8 + AC9 + AC10 + AC11 + AC12 + AC13 + AC14
Curiosity  =~ AC15 + AC16 + AC17 + AC18 + AC19 + AC20 + AC21
Confidence =~ AC22 + AC23 + AC24 + AC25 + AC26 + AC27 + AC28
```

- Model with **4 correlated first-order factors** (no correlated error terms, no cross-loadings) — the standard structure used to validate the CAAS in the literature.
- **RMR/SRMR** are not natively computed by `semopy`; they were computed manually from the model-implied covariance matrix (`model.calc_sigma()`) versus the sample covariance matrix, following the standard definition:
  - RMR = square root of the mean of squared raw residuals (lower triangle + diagonal of the covariance matrix)
  - SRMR = same formula, but with residuals standardized by the items' standard deviations
- **Cronbach's alpha** was computed separately (classic formula, straight from the raw items in `GDX_PSY_ITEM_RESPONSE`/`.sav`) — it is not a CFA output, but complements reliability.
- Full reproducible script: [`run_cfa_career_adaptability.py`](./run_cfa_career_adaptability.py), in this same folder.

## 4. Output variables and values obtained

### 4.1 Global model fit indices

| Index | Value | Conventional cutoff (literature) |
|---|---|---|
| χ² (chi-square) | 893.229 (df = 344, p < 0.001) | lower is better (but sensitive to large n) |
| χ²/df (normed chi-square) | **2.60** | < 3 acceptable, < 2 good |
| RMR | **0.027** | lower is better |
| SRMR | 0.055 | ≤ 0.08 acceptable |
| GFI | **0.828** | ≥ 0.90 conventionally acceptable |
| AGFI | **0.811** | ≥ 0.90 conventionally acceptable |
| NFI | 0.828 | ≥ 0.90 acceptable |
| TLI | 0.875 | ≥ 0.90 acceptable |
| **CFI** | **0.886** | ≥ 0.90 acceptable, ≥ 0.95 good |
| **RMSEA** | **0.062** | ≤ 0.08 acceptable, ≤ 0.06 good |
| AIC | 119.777 | comparative use only (no absolute cutoff) |
| BIC | 370.714 | comparative use only (no absolute cutoff) |
| Log-likelihood | 2.112 | — |

### 4.2 Internal consistency reliability (Cronbach's alpha)

| Subscale | Alpha |
|---|---|
| Concern (7 items) | 0.821 |
| Control (7 items) | 0.799 |
| Curiosity (7 items) | 0.828 |
| Confidence (7 items) | 0.874 |
| Full scale (28 items) | 0.931 |

### 4.3 Correlations between latent factors (standardized)

| Factor pair | Correlation |
|---|---|
| Concern ↔ Control | 0.678 |
| Concern ↔ Curiosity | 0.731 |
| Concern ↔ Confidence | 0.623 |
| Control ↔ Curiosity | 0.708 |
| Control ↔ Confidence | 0.762 |
| Curiosity ↔ Confidence | 0.805 |

### 4.4 Standardized factor loadings (item → factor)

| Factor | Items (standardized loading) |
|---|---|
| Concern | AC1=0.603 · AC2=0.653 · AC3=0.700 · AC4=0.749 · AC5=0.627 · AC6=0.615 · AC7=0.513 |
| Control | AC8=0.593 · AC9=0.633 · AC10=0.646 · AC11=0.652 · AC12=0.605 · AC13=0.451 · AC14=0.655 |
| Curiosity | AC15=0.640 · AC16=0.714 · AC17=0.646 · AC18=0.626 · AC19=0.596 · AC20=0.660 · AC21=0.595 |
| Confidence | AC22=0.715 · AC23=0.649 · AC24=0.651 · AC25=0.685 · AC26=0.770 · AC27=0.727 · AC28=0.751 |

All loadings are statistically significant (p < 0.001) and positive, in the expected direction. The weakest item is `AC13` ("Doing what is best for me", Control factor, loading = 0.451) — the only one below 0.50.

## 5. Interpretation

The CAAS's 4-factor structure **holds partially** in this sample:

- All factor loadings are positive, significant, and consistent with the instrument's original design — no evidence of a misallocated item.
- Reliability is good to excellent across all subscales (α between 0.80 and 0.93).
- χ²/df = 2.60 and RMR = 0.027 are good.
- **RMSEA = 0.062** falls in the acceptable range (≤ 0.08), close to the "good" range (≤ 0.06).
- **CFI = 0.886** and **TLI = 0.875** fall **below** the conventional 0.90 cutoff — indicating only marginal/moderate fit, not excellent.
- **GFI = 0.828** and **AGFI = 0.811** also fall below 0.90.
- Correlations between factors are all moderate-to-high (0.62–0.81), especially Curiosity↔Confidence (0.805) — consistent with the usual reading of the CAAS as a second-order construct ("Career Adaptability" overall), with the 4 dimensions strongly inter-related but still distinguishable.

**Practical conclusion**: the 4-correlated-factor model is a reasonable approximation but not an excellent fit by conventional standards (CFI/TLI/GFI below 0.90). This is common in psychological scale validations with Likert items and convenience samples, and does not invalidate use of the scale — but it indicates that refinements (e.g., freeing 1–2 theoretically justifiable error correlations, or testing a second-order/bifactor model) could improve fit if a formal published validation is desired.

## 6. Where the results were written in Firebird

Table: **`GDX_PSY_PSYCHOMETRIC_PROPERTY`** (schema `psychometrics_model_firebird25.sql`), which was empty before this run.

- `ID_INSTRUMENT = 3`, `ID_CONSTRUCT = 3` on every row.
- `TYPE` identifies the indicator (`CHI_SQUARE`, `CHI_SQUARE_DF`, `CHI_SQUARE_P_VALUE`, `CHI_SQUARE_DF_RATIO`, `RMR`, `SRMR`, `GFI`, `AGFI`, `NFI`, `TLI`, `CFI`, `RMSEA`, `AIC`, `BIC`, `LOG_LIKELIHOOD`, `CRONBACH_ALPHA`, `FACTOR_CORRELATION`, `STD_FACTOR_LOADING`).
- `METHOD` describes the specific calculation/context of the row (e.g., which subscale, which factor pair, which item→factor).
- `"VALUE"` is the number (NUMERIC(14,6)).
- `SAMPLE_SIZE = 423` on every row.
- `REFERENCE` carries a short interpretation/cutoff note for each index.
- `CALCULATED_AT = 2026-09-11`.

Load script: [`../samples.sql/09_load_psychometric_properties_afc_career_adaptability.sql`](../samples.sql/09_load_psychometric_properties_afc_career_adaptability.sql) — 54 `INSERT` statements (15 fit indices + 5 alphas + 6 factor correlations + 28 factor loadings).

**Load status: DONE.** The script was executed against the live Firebird database (`firebird.godatax.com`, `godatax.gdb`) on 2026-09-11 via `execute_afc_property_load.js` and verified with a direct read-back query. All **54 rows** are present under `ID_INSTRUMENT = 3`; spot-checked values (`CFI=0.885943`, `GFI=0.828007`, `AGFI=0.811007`, `RMSEA=0.061509`, `RMR=0.02733`, `CHI_SQUARE=893.229329`, `CHI_SQUARE_DF_RATIO=2.596597`) match this document exactly.

Command used:
```
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts
node execute_afc_property_load.js --file ../../../../samples.sql/09_load_psychometric_properties_afc_career_adaptability.sql --dry-run   # verified first
node execute_afc_property_load.js --file ../../../../samples.sql/09_load_psychometric_properties_afc_career_adaptability.sql               # then the real load
```

The executor (`execute_afc_property_load.js`, new, in this same skill) checks that `GDX_PSY_PSYCHOMETRIC_PROPERTY` exists and that `GDX_PSY_INSTRUMENT.ID_INSTRUMENT = 3` is already loaded, and refuses to duplicate the load if a `TYPE='CFI'` row already exists for instrument 3 (unless `--force` is passed).

**Bug found and fixed during the first load attempt**: the first version of the generated SQL file used `/* ---- section ---- */` block comments between sections (e.g. `/* ---- 2. Internal consistency reliability (Cronbach's alpha) ---- */`). The stray apostrophe in "Cronbach's" desynchronized `execute_load.js`'s quote-aware statement splitter (it only strips `--` line comments, not `/* */` block comments, so an unescaped `'` inside a body comment is misread as the start of a string literal), which corrupted statement boundaries for the rest of the file and caused a live `ERROR: Unexpected end of command` on the real run (the `--dry-run` pass did not catch it, since it only counts statements without letting Firebird parse them). Fixed by switching the in-body section separators to `--` line comments with no apostrophes, in both the generator script and the regenerated `.sql` file. Re-verified with another dry run before the real (successful) execution.

## 7. Reproducibility

- Python script: [`run_cfa_career_adaptability.py`](./run_cfa_career_adaptability.py) — reads the `.sav`, runs the CFA, prints all indices, and generates the `INSERT` statements.
- Dependencies: `pyreadstat`, `pandas`, `numpy`, `semopy==2.3.11` (installed via `pip install semopy` in this session).
- Deterministic: same model specification + same `.sav` ⇒ same numbers (optimizer converged in 75 iterations, no warnings). Re-run and verified to reproduce identical values before the live load.

## 8. Known limitations and gaps

- No item was treated as reverse-scored — there is no documentary confirmation that the CAAS has no reversed items in this application; assumed from semantic direction and observed means.
- The model tested is the first-order 4-correlated-factor model; a second-order model (a general "Career Adaptability" factor explaining the 4 factors) or a bifactor model were not tested, and either could fit better given the high correlation pattern found.
- RMR/SRMR are not native to `semopy` — they were implemented manually in this process (standard formula, see §3); revisit if bit-for-bit precision against AMOS/lavaan is needed for publication.
- See also the gaps already documented in `SPSS_to_Firebird_Mapping.md` (items with unknown wording, the still-empty `GDX_PSY_INDICATOR` layer) — they do not affect this specific analysis (which read the raw items directly from the `.sav`, not from the `GDX_PSY_INDICATOR` layer), but remain open for the rest of the model.
