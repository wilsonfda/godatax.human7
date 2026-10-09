# EFA loadings, means and standard deviations — Career Adapt-Abilities Scale (Career Adaptability)

> Generated 2026-09-13. Analyst: Claude Code, at the user's request, over data already loaded into the GoDataX psychometric relational model (`GDX_HUMAN/2.relational.model.psychometrics`).

## 1. Objective

Complement the CFA already run on the **Career Adapt-Abilities Scale (CAAS)** (see [`../analyses.AFC/AFC_Career_Adaptability.md`](../analyses.AFC/AFC_Career_Adaptability.md)) with an **Exploratory Factor Analysis (EFA)** and descriptive statistics for the same 4 dimensions — Concern (preocupação), Control (controle), Curiosity (curiosidade) and Confidence (confiança) — reporting, per item and per dimension, the **factor loading**, **mean** and **standard deviation** requested by the user, and writing them into the same relational structure used for the CFA (`GDX_PSY_PSYCHOMETRIC_PROPERTY`). Later extended, at the user's request, with the **Pearson linear correlation** between the 4 dimension scores (§4.5).

## 2. Input variables

| Item | Detail |
|---|---|
| Data source | `GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` (read via `pyreadstat`), the same file used by the CFA script |
| Instrument | Career Adapt-Abilities Scale (`GDX_PSY_INSTRUMENT.ID_INSTRUMENT = 3`) |
| Construct | Career Adaptability (`GDX_PSY_CONSTRUCT.ID_CONSTRUCT = 3`) |
| Sample | n = 423 respondents (Military Academy cadets), 0 missing values across the 28 items |
| Observed items (indicators) | `AC1`…`AC28`, 1–5 Likert scale |
| Dimensions | **Concern** (AC1–AC7) · **Control** (AC8–AC14) · **Curiosity** (AC15–AC21) · **Confidence** (AC22–AC28) — 7 items each |
| Grouping validation | Same check as the CFA: the mean of each block's 7 items reproduces the SPSS-precomputed column (`ACpreocup`, `ACcontrole`, `ACcuriosid`, `ACconfianc`) exactly (max abs diff < 1e-9) |

## 3. Calculation performed

- **Tooling**: Python 3.12, `pyreadstat` (read `.sav`), `numpy`/`scipy` (linear algebra, Bartlett p-value), `scikit-learn`'s `sklearn.decomposition.FactorAnalysis` (common-factor/ML-style extraction).
- **Why not the `factor_analyzer` PyPI package**: it is the natural first choice for EFA in Python, but its latest release (0.5.1) calls `sklearn.utils.check_array(..., force_all_finite=...)`, an argument scikit-learn removed in newer versions (this environment has scikit-learn 1.9) — `fa.fit(data)` raises `TypeError: check_array() got an unexpected keyword argument 'force_all_finite'`. Rather than pin an older scikit-learn (which could break other tooling in this environment), the extraction was implemented directly on `sklearn.decomposition.FactorAnalysis` plus a hand-written rotation/KMO/Bartlett, verified analytically (see §7).
- **Extraction**: `FactorAnalysis(n_components=4)`, no built-in rotation.
- **Rotation**: orthogonal **Varimax** (Kaiser's SVD-based iterative algorithm), applied by hand to the 4 raw factor loadings.
- **Factor → dimension matching**: EFA factors are unordered/unlabeled by construction; each of the 4 rotated factors was assigned to the CAAS dimension (Concern/Control/Curiosity/Confidence) whose known 7 items have the highest mean absolute loading on it. The assignment came out 1-to-1 and unambiguous (no dimension tied for the same factor).
- **Sampling adequacy**: Kaiser-Meyer-Olkin (KMO) overall measure and Bartlett's test of sphericity, both computed by hand from the item correlation matrix (standard closed-form formulas — no dependency on `factor_analyzer`).
- **Means/SDs**:
  - *Item-level*: straight `mean()`/`std(ddof=1)` of each raw `AC1`…`AC28` column.
  - *Dimension-level*: `mean()`/`std(ddof=1)` of the SPSS-precomputed dimension column (`ACpreocup` etc.), which is itself the mean of that dimension's 7 items — validated identical to computing it from the raw items (§2).
- **Inter-dimension correlation**: Pearson linear correlation (`scipy.stats.pearsonr`) between each pair of the 4 dimension scores (`ACpreocup`, `ACcontrole`, `ACcuriosid`, `ACconfianc`) — the **manifest/observed-score** correlation, deliberately distinct from the CFA's **latent factor** correlation (`TYPE=FACTOR_CORRELATION` in the AFC load), which corrects for measurement error and is therefore attenuated differently. 6 pairs (C(4,2)).
- Full reproducible script: [`run_efa_loadings_means_sd_career_adaptability.py`](./run_efa_loadings_means_sd_career_adaptability.py), in this same folder.

## 4. Output variables and values obtained

### 4.1 Sampling adequacy

| Index | Value | Interpretation |
|---|---|---|
| KMO (overall) | **0.934** | "Meritorious"/"marvelous" by Kaiser's criterion (≥0.80); the item set is very well suited to factor analysis |
| Bartlett's test of sphericity | χ²=5056.30, df=378, p<0.001 | Strongly rejects the null hypothesis that the correlation matrix is an identity matrix — items are sufficiently intercorrelated for EFA |

### 4.2 Variance explained per factor (Varimax-rotated)

| Dimension | SS loadings | % of total variance |
|---|---|---|
| Concern | 1.669 | 5.96% |
| Control | 1.333 | 4.76% |
| Curiosity | 1.338 | 4.78% |
| Confidence | 1.747 | 6.24% |

### 4.3 Item-level factor loading, mean and standard deviation

| Dimension | Item | Loading (Varimax) | Mean | SD |
|---|---|---|---|---|
| Concern | AC1 | -0.377 | 4.017 | 0.730 |
| Concern | AC2 | -0.498 | 3.991 | 0.738 |
| Concern | AC3 | -0.465 | 4.151 | 0.696 |
| Concern | AC4 | -0.490 | 3.986 | 0.681 |
| Concern | AC5 | -0.276 | 3.993 | 0.673 |
| Concern | AC6 | -0.292 | 3.936 | 0.680 |
| Concern | AC7 | -0.387 | 3.865 | 0.864 |
| Control | AC8 | -0.251 | 3.993 | 0.795 |
| Control | AC9 | -0.325 | 4.173 | 0.696 |
| Control | AC10 | -0.384 | 4.477 | 0.697 |
| Control | AC11 | -0.470 | 4.293 | 0.681 |
| Control | AC12 | -0.480 | 4.144 | 0.755 |
| Control | AC13 | -0.277 | 3.991 | 0.748 |
| Control | AC14 | -0.284 | 4.166 | 0.726 |
| Curiosity | AC15 | 0.409 | 3.794 | 0.687 |
| Curiosity | AC16 | 0.407 | 4.059 | 0.688 |
| Curiosity | AC17 | 0.336 | 3.991 | 0.709 |
| Curiosity | AC18 | 0.254 | 3.943 | 0.629 |
| Curiosity | AC19 | 0.289 | 3.922 | 0.682 |
| Curiosity | AC20 | 0.267 | 4.002 | 0.687 |
| Curiosity | AC21 | 0.361 | 3.967 | 0.731 |
| Confidence | AC22 | -0.325 | 4.125 | 0.703 |
| Confidence | AC23 | -0.321 | 4.091 | 0.671 |
| Confidence | AC24 | -0.301 | 4.071 | 0.660 |
| Confidence | AC25 | -0.361 | 4.411 | 0.710 |
| Confidence | AC26 | -0.456 | 4.305 | 0.634 |
| Confidence | AC27 | -0.508 | 4.155 | 0.692 |
| Confidence | AC28 | -0.474 | 4.284 | 0.660 |

The sign of each column is arbitrary (a rotation-matrix artifact) — within a dimension, all 7 items load with the same sign, which is what matters (internal consistency of direction).

### 4.4 Dimension-level mean and standard deviation

| Dimension | Items | Mean | SD |
|---|---|---|---|
| Concern | 7 | 3.991 | 0.504 |
| Control | 7 | 4.177 | 0.491 |
| Curiosity | 7 | 3.954 | 0.483 |
| Confidence | 7 | 4.206 | 0.510 |

### 4.5 Pearson correlation between dimension scores (manifest, n=423)

| Dimension pair | Pearson r | p-value |
|---|---|---|
| Concern ↔ Control | 0.572 | 4.31e-38 |
| Concern ↔ Curiosity | 0.606 | 8.80e-44 |
| Concern ↔ Confidence | 0.550 | 9.17e-35 |
| Control ↔ Curiosity | 0.573 | 2.53e-38 |
| Control ↔ Confidence | 0.639 | 7.68e-50 |
| Curiosity ↔ Confidence | 0.692 | 1.89e-61 |

All 6 pairs are moderate-to-high and highly significant (p < 1e-30). For comparison, the CFA's **latent factor** correlations (`FACTOR_CORRELATION`, corrected for measurement error) were consistently higher: Concern↔Control 0.678, Concern↔Curiosity 0.731, Concern↔Confidence 0.623, Control↔Curiosity 0.708, Control↔Confidence 0.762, Curiosity↔Confidence 0.805. The manifest (Pearson) correlations here are attenuated versions of those, as expected from classical test theory (observed-score correlations are bounded by the product of the two measures' reliabilities relative to their latent correlation).

## 5. Interpretation

- **Sampling adequacy is excellent** (KMO=0.934, Bartlett p<0.001): the 28 items are strongly intercorrelated and well suited to factor analysis.
- **Item loadings are moderate (0.25–0.51 in absolute value)**, weaker than the CFA's standardized loadings (0.45–0.77, see the CFA write-up). This is expected, not a defect: the CFA already found the 4 dimensions to be **highly correlated** (r = 0.62–0.81 between latent factors). An **orthogonal** rotation (Varimax) forces the 4 extracted factors to be uncorrelated with each other, which spreads shared variance across factors instead of concentrating it — the natural next step to get a cleaner "simple structure" table would be an **oblique** rotation (Promax/Oblimin), which was not implemented here to avoid an error-prone from-scratch implementation (see §8).
- All 28 items load on their expected dimension with a **consistent sign** within each dimension, and each of the 4 rotated factors matched exactly one dimension with no ambiguity — structural support for the same 4-dimension grouping the CFA and the original SPSS scoring already used.
- **Dimension means** range from 3.95 (Curiosity) to 4.21 (Confidence), all above the scale midpoint (3.0) — consistent with a generally adaptable cadet sample. **Control** and **Confidence** have the highest means; **Curiosity** the lowest, mirroring the CFA sample's overall profile.
- **Dimension SDs** are all close to 0.50, indicating similar dispersion across the 4 dimensions — no dimension stands out as unusually homogeneous or heterogeneous.
- **Inter-dimension Pearson correlations** (0.55–0.69) confirm, at the manifest-score level, the same pattern the CFA found at the latent level (0.62–0.81): Curiosity↔Confidence is consistently the strongest pair, Concern↔Confidence the weakest. The systematic gap between manifest and latent correlations (always lower here) is exactly what measurement-error attenuation predicts, not a discrepancy between the two analyses.

## 6. Where the results were written in Firebird

Table: **`GDX_PSY_PSYCHOMETRIC_PROPERTY`** (schema `psychometrics_model_firebird25.sql`), same table used by the CFA (`ID_INSTRUMENT=3`, `ID_CONSTRUCT=3`), now extended with new `TYPE` values that do not overlap with the CFA's:

- `KMO`, `BARTLETT_CHI_SQUARE` (2 rows) — sampling adequacy.
- `EFA_FACTOR_LOADING`, `ITEM_MEAN`, `ITEM_STD_DEV` (3 rows × 28 items = 84 rows) — item level, `METHOD` = `"<item> -> <dimension>"`.
- `DIMENSION_MEAN`, `DIMENSION_STD_DEV` (2 rows × 4 dimensions = 8 rows) — dimension level, `METHOD` = `"<dimension>"`.
- `PEARSON_CORRELATION` (6 rows) — one per dimension pair, `METHOD` = `"<dimension A> <-> <dimension B>"`.
- Total: **100 rows** (94 from the EFA/means/SD load + 6 from the Pearson-correlation load).

Load scripts:
- [`../samples.SQL/10_load_psychometric_properties_efa_means_sd_career_adaptability.sql`](../samples.SQL/10_load_psychometric_properties_efa_means_sd_career_adaptability.sql) — continues the numeric sequence after `09_load_psychometric_properties_afc_career_adaptability.sql`. 94 rows (KMO, Bartlett, item loadings/means/SDs, dimension means/SDs).
- [`../samples.SQL/11_load_psychometric_properties_pearson_correlation_career_adaptability.sql`](../samples.SQL/11_load_psychometric_properties_pearson_correlation_career_adaptability.sql) — added afterwards, at the user's request, once the Pearson correlation (§4.5) was implemented. Kept as a **separate incremental file** rather than folded into a regenerated `10_...sql`, specifically so re-running the generator script never re-touches the 94 rows already committed from file 10 (this pipeline's executor never updates or deletes, only inserts).

**Load status: DONE (both files).** Executed against the live Firebird database (`127.0.0.1`, `/firebird/godatax.gdb`) via `execute_afc_property_load.js` and verified with direct read-back queries after each load.
- File 10, run on 2026-09-13: all **94 rows** present under `ID_INSTRUMENT = 3`; spot-checked value (`KMO=0.933634`) matches this document exactly. Per-type counts: `DIMENSION_MEAN`=4, `DIMENSION_STD_DEV`=4, `EFA_FACTOR_LOADING`=28, `ITEM_MEAN`=28, `ITEM_STD_DEV`=28, `KMO`=1, `BARTLETT_CHI_SQUARE`=1.
- File 11, run on 2026-09-13: all **6 rows** present under `ID_INSTRUMENT = 3`, `TYPE='PEARSON_CORRELATION'`; values read back match §4.5 exactly (e.g. `Curiosity <-> Confidence` = 0.691549).
- After both loads, `GDX_PSY_PSYCHOMETRIC_PROPERTY` has **154 rows** total (54 AFC + 94 EFA/means/SD + 6 Pearson), all under `ID_INSTRUMENT=3`. A duplicate check — `GROUP BY ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD HAVING COUNT(*) > 1` over the **whole table** (not just this instrument) — returned **zero rows**: no duplicates anywhere in `GDX_PSY_PSYCHOMETRIC_PROPERTY`.

Commands used:
```
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts
node execute_afc_property_load.js --file ../../../../samples.SQL/10_load_psychometric_properties_efa_means_sd_career_adaptability.sql --dry-run   # verified first
node execute_afc_property_load.js --file ../../../../samples.SQL/10_load_psychometric_properties_efa_means_sd_career_adaptability.sql --force    # then the real load

node execute_afc_property_load.js --file ../../../../samples.SQL/11_load_psychometric_properties_pearson_correlation_career_adaptability.sql --dry-run --force
node execute_afc_property_load.js --file ../../../../samples.SQL/11_load_psychometric_properties_pearson_correlation_career_adaptability.sql --force
```

**Operational notes from these loads, kept for future reference:**
- **`MSYS_NO_PATHCONV=1` is required** when running this executor from Git Bash on Windows. `GDX_HUMAN_FB_DATABASE=/firebird/godatax.gdb` looks like a POSIX path, and MSYS silently rewrites it to a Windows path (`C:/Program Files/Git/firebird/godatax.gdb`) before it ever reaches `node`, causing an `Unavailable database` error that has nothing to do with the database itself.
- **`--force` was required for both files, and is safe here.** `execute_afc_property_load.js`'s preflight check only looks for a pre-existing `TYPE='CFI'` row (a sentinel written by the AFC load) to decide "already loaded, refuse" — it does not know about this script's own `TYPE` values. Since the AFC was already loaded in a prior session, the check always trips for this instrument regardless of whether the EFA/Pearson data specifically was already present. Before each `--force`, a direct query confirmed 0 existing rows for that file's new `TYPE` values under `ID_INSTRUMENT=3`, so `--force` did not create duplicates — it only bypassed a false positive from a guard that wasn't designed for more than one analysis type per instrument.
- The `analyses.factor.loading.means.standard.deviation` and `analyses.combinatorial.factor` folder names used earlier in this project were subsequently shortened to `analyses.EFA` and `analyses.AFC`; `samples.sql` was renamed `samples.SQL`. Links in this document point to the current names.

## 7. Reproducibility

- Python script: [`run_efa_loadings_means_sd_career_adaptability.py`](./run_efa_loadings_means_sd_career_adaptability.py).
- Dependencies: `pyreadstat`, `pandas`, `numpy`, `scipy`, `scikit-learn` (all already used elsewhere in this repo's Python tooling, or standard).
- The hand-written Varimax rotation was verified to be communality-preserving (an orthogonal-rotation invariant): `sum(raw_loadings**2, axis=1)` equals `sum(rotated_loadings**2, axis=1)` for every item, to within floating-point precision (max abs diff ≈ 1.1e-16) in a standalone check run alongside this script.
- Deterministic: `FactorAnalysis(random_state=0)` fixes the extraction's random seed; same `.sav` ⇒ same numbers.

## 8. Known limitations and gaps

- **Orthogonal rotation only.** Varimax was used instead of an oblique rotation (Promax/Oblimin), even though the CFA shows the 4 dimensions are meaningfully correlated (0.62–0.81). An oblique rotation would likely produce a cleaner "simple structure" (higher primary loadings, lower cross-loadings) and should be considered a follow-up if a from-scratch, carefully-verified oblique implementation (or a compatible EFA library) becomes available.
- **`factor_analyzer` package incompatibility.** As of this run, `factor_analyzer==0.5.1` (latest on PyPI) is broken against `scikit-learn>=1.6` (`TypeError` on `force_all_finite`). If a future `factor_analyzer` release fixes this, re-evaluate switching to it for built-in oblique rotations (Promax/Oblimin) and polychoric-correlation support (more appropriate for 5-point Likert items than the Pearson correlation used here).
- **Pearson correlation on ordinal (1–5 Likert) data** — same simplification the CFA made (ML estimator on raw items); polychoric correlations would be more appropriate for strictly ordinal data but were out of scope here.
- Same open gaps already documented in `SPSS_to_Firebird_Mapping.md` and the CFA write-up (no reverse-scored items confirmed, `GDX_PSY_INDICATOR` layer still empty) apply equally here.
