---
name: GDX_SKILL_MAKE_ANALYSES_CFA_EFA
description: Runs the same Career Adapt-Abilities Scale (CAAS) analyses as ../../analyses.CFA/run_cfa_career_adaptability.py and ../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py (4-factor CFA fit/reliability/loadings, EFA loadings/means/SD, KMO/Bartlett, Pearson correlations) but reads the raw AC1-AC28 item responses from a live Firebird database (GDX_PSY_ITEM_RESPONSE / GDX_PSY_VARIABLE_RESULT) instead of the .sav file. Use when the user asks to (re)run the CFA/EFA analyses from the database, verify the .sav-sourced results against what is actually loaded in Firebird, or repeat these analyses for a population that only exists in the DB (no backing .sav).
---

# GDX_SKILL_MAKE_ANALYSES_CFA_EFA

DB-sourced twin of the two existing `.sav`-based analyses for the Career Adapt-Abilities Scale
(CAAS, `ID_INSTRUMENT=3`, `ID_CONSTRUCT=3`, Career Adaptability):

- `../../analyses.CFA/run_cfa_career_adaptability.py` (see `AFC_Career_Adaptability.md` there)
- `../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py` (see
  `EFA_Loadings_Means_SD_Career_Adaptability.md` there)

Same statistical models, same fit indices, same output shape (`GDX_PSY_PSYCHOMETRIC_PROPERTY`
INSERT scripts) -- the only difference is where the AC1-AC28 raw item values come from: a live
Firebird database instead of `GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav`.
This lets the same analyses be re-run purely from what is actually loaded in the database (a useful
cross-check against the `.sav`-sourced originals, or the only option once a study's items live only
in Firebird).

## Three-stage pipeline

1. **Fetch (Node.js)** -- `scripts/fetch_career_adaptability_items.js` connects to Firebird over the
   wire protocol (`node-firebird`, no native client library required) and writes two CSVs into
   `data/`:
   - `career_adaptability_items.csv` -- one row per `ID_APPLICATION`, columns `AC1..AC28`, built by
     joining `GDX_PSY_ITEM_RESPONSE` to `GDX_PSY_INSTRUMENT_ITEM` (`ID_INSTRUMENT=3`) and pivoting on
     `ITEM_ORDER`. Refuses to write the file if any application is missing one of the 28 items.
   - `career_adaptability_dimension_scores.csv` -- one row per `ID_APPLICATION`, columns
     `Concern/Control/Curiosity/Confidence`, read from `GDX_PSY_VARIABLE_RESULT`
     (`ID_VARIABLE` 7-10). This plays the same cross-validation role the SPSS-precomputed
     `ACpreocup/ACcontrole/ACcuriosid/ACconfianc` columns play in the `.sav`-sourced scripts, and
     feeds the EFA script's dimension-level mean/SD and Pearson correlation sections directly.
2. **CFA (Python)** -- `scripts/run_cfa_from_db.py` reads `career_adaptability_items.csv`, fits the
   same 4-factor correlated CFA model (semopy, ML), prints fit indices / Cronbach alpha / factor
   correlations / standardized loadings, and writes
   `output/09_load_psychometric_properties_afc_career_adaptability_from_db.sql`.
3. **EFA (Python)** -- `scripts/run_efa_from_db.py` reads both CSVs, extracts 4 factors
   (`sklearn.decomposition.FactorAnalysis` + hand-rolled Varimax, same as the original -- the
   `factor_analyzer` package is still broken against scikit-learn >= 1.6), prints KMO/Bartlett,
   item-level loadings/mean/SD, dimension-level mean/SD, Pearson correlations, and writes
   `output/10_load_psychometric_properties_efa_means_sd_career_adaptability_from_db.sql` +
   `output/11_load_psychometric_properties_pearson_correlation_career_adaptability_from_db.sql`.

Both Python scripts include the same sanity-check assertion as the originals: the raw-item dimension
means they compute must match the DB's precomputed dimension scores to within `1e-3` (the
DB's `NUMERIC(12,4)` rounding), or the script aborts instead of silently producing numbers that
disagree with what `GDX_PSY_VARIABLE_RESULT` already says.

`data/` and `output/` are gitignored -- these are regenerable artifacts, re-created fresh every run,
unlike the `.sav`-sourced originals in `samples.SQL/09-11`, which stay the committed, authoritative
record of that run.

## Running it

```
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_MAKE_ANALYSES_CFA_EFA/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD (or reuse
# ../../GDX_SKILL_LOAD_RLT_MODEL_DB/.env unchanged -- same database, same var names),
# or export the vars directly
node fetch_career_adaptability_items.js

pip install pandas numpy semopy scipy scikit-learn
python run_cfa_from_db.py
python run_efa_from_db.py
```

Connection is read entirely from environment variables (see `.env.example`) -- **never hardcode
host/user/password** in these scripts or anywhere else in the repo (existing CLAUDE.md guidance
about not propagating hardcoded Firebird credentials).

## Comparing against the .sav-sourced results

Both pipelines should agree closely (the DB was itself loaded from that same `.sav`, so this is
mostly a float-precision/rounding check, not an independent replication):

```
diff <(grep -o "'[A-Z_]*', '[^']*', [0-9.-]*" ../../../../samples.SQL/09_load_psychometric_properties_afc_career_adaptability.sql) \
     <(grep -o "'[A-Z_]*', '[^']*', [0-9.-]*" output/09_load_psychometric_properties_afc_career_adaptability_from_db.sql)
```

(run from `scripts/`; `../../../../samples.SQL` resolves to
`2.relational.model.psychometrics/samples.SQL` from there)

A real (non-float-rounding) discrepancy means the database and the `.sav` have drifted -- e.g. the
`.sav` was updated and `GDX_SKILL_LOAD_RLT_MODEL_DB` was not re-run to sync it. Investigate that
before trusting either set of numbers.

## Loading the results into Firebird (optional)

The generated `output/09-11_*.sql` files use the exact same `GDX_PSY_PSYCHOMETRIC_PROPERTY` INSERT
shape as the `.sav`-sourced ones, so they can be executed the same way, e.g. with
`../GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/execute_afc_property_load.js --file <path> --dry-run` first.
**Before running a real (non-dry-run) load, confirm with the user first** -- this is a write to a
shared remote system, and doing so would duplicate rows already loaded from the `.sav` pipeline
under a different `METHOD` tag (`... - sourced from Firebird DB`) unless that is genuinely what the
user wants (e.g. deliberately keeping both provenances side by side for comparison).

## Files in this skill

- `scripts/fetch_career_adaptability_items.js` -- stage 1 (Node.js + node-firebird)
- `scripts/package.json` -- stage 1 dependency
- `scripts/run_cfa_from_db.py` -- stage 2a (Python + pandas/numpy/semopy)
- `scripts/run_efa_from_db.py` -- stage 2b (Python + pandas/numpy/scipy/scikit-learn)
- `.env.example` -- connection variable template (no secrets)
- `.gitignore` -- excludes the regenerable `data/` and `output/` folders
