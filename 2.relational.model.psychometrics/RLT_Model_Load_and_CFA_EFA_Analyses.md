# GDX_HUMAN — Loading the Relational Model & Running CFA/EFA Analyses from Firebird

> Written 2026-09-17, documenting the two Claude Code skills living under
> `GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/`:
> `GDX_SKILL_LOAD_RLT_MODEL_DB` and `GDX_SKILL_MAKE_ANALYSES_CFA_EFA`.

## 1. Why this exists

`2.relational.model.psychometrics` already had two separate, hand-written pieces before either skill
existed:

- `psychometrics_model_firebird25.sql` + `SPSS_to_Firebird_Mapping.md` — the target schema and the
  reasoning behind loading the one study currently in it ("Predictors of Adaptability to Military
  Higher Education", 423 respondents), and
- `analyses.CFA/run_cfa_career_adaptability.py` + `analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py`
  — two independent statistical analyses (Confirmatory and Exploratory Factor Analysis) of the
  Career Adapt-Abilities Scale (CAAS), both reading the raw `AC1`-`AC28` items **directly from the
  `.sav` file**, not from Firebird.

This document describes the two skills that turned that hand-run, `.sav`-only pipeline into
something repeatable and, for the analyses, DB-verifiable:

1. **`GDX_SKILL_LOAD_RLT_MODEL_DB`** — (re)generates the `01_load_study.sql`…`08_adjust_sequences.sql`
   scripts from the `.sav` and loads them into Firebird. This is the thing that makes `AC1`-`AC28`
   (and everything else in the study) exist in `GDX_PSY_ITEM_RESPONSE` at all — every other tool in
   this document depends on it having already been run once.
2. **`GDX_SKILL_MAKE_ANALYSES_CFA_EFA`** — re-runs the *same* CFA and EFA analyses as
   `analyses.CFA`/`analyses.EFA`, but sourced from what `GDX_SKILL_LOAD_RLT_MODEL_DB` put into
   Firebird instead of the `.sav` file directly. It exists to answer "what does the database actually
   say", independent of whether the `.sav` file is still around or still agrees with the DB.

## 2. The two skills, at a glance

```
 PLANILHAPOSDOC11SET SO CADETES.sav
 (1.output.ibm.spss.statistics/)
                |
                v
 +--------------------------------------------+
 | GDX_SKILL_LOAD_RLT_MODEL_DB                 |   generate (Python) + execute (Node.js)
 |  - reads the .sav fresh every run           |
 |  - catalog.py: fixed instrument/item        |
 |    metadata, hand-extracted from the        |
 |    researcher's .pptx/.docx                 |
 |  - writes 01_load_study.sql .. 08_*.sql     |
 |  - execute_load.js runs them against        |
 |    Firebird (dry-run first, then real)      |
 +--------------------------------------------+
                |
                v
   Firebird: GDX_PSY_STUDY / GDX_PSY_INSTRUMENT / GDX_PSY_INSTRUMENT_ITEM /
   GDX_PSY_PERSON / GDX_PSY_APPLICATION / GDX_PSY_ITEM_RESPONSE (423 x 28 AC items) /
   GDX_PSY_VARIABLE_RESULT (Concern/Control/Curiosity/Confidence dimension scores)
                |
                v
 +--------------------------------------------+
 | GDX_SKILL_MAKE_ANALYSES_CFA_EFA             |   fetch (Node.js) + CFA + EFA (Python)
 |  - fetch_career_adaptability_items.js reads |
 |    the tables above, pivots AC1..AC28 per   |
 |    application, writes 2 CSVs               |
 |  - run_cfa_from_db.py: same 4-factor CFA    |
 |    as analyses.CFA (semopy, ML)             |
 |  - run_efa_from_db.py: same EFA (sklearn    |
 |    FactorAnalysis + Varimax), KMO/Bartlett, |
 |    Pearson correlations                     |
 +--------------------------------------------+
                |
                v
   output/09-11_..._from_db.sql   <-- same GDX_PSY_PSYCHOMETRIC_PROPERTY INSERT shape as
                                       samples.SQL/09-11 (the .sav-sourced originals),
                                       numerically identical to float-rounding
```

`GDX_SKILL_LOAD_RLT_MODEL_DB` is the only one of the two that writes application/person/response
rows. `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` only reads them back out (stage 1) and, if the user later
chooses to load its output, writes only new `GDX_PSY_PSYCHOMETRIC_PROPERTY` rows (analysis results),
never touching `GDX_PSY_ITEM_RESPONSE` or anything upstream of it.

## 3. `GDX_SKILL_LOAD_RLT_MODEL_DB` — `.sav` → Firebird

Two stages, matching the "generate, then execute" shape used by every DB-writing skill in this repo:

1. **Generate (Python)** — `scripts/generate_load_scripts.py` reads
   `1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` fresh every run (via
   `pyreadstat`) and writes `01_load_study.sql` … `08_adjust_sequences.sql` into `samples.SQL/`,
   matching the tables in `psychometrics_model_firebird25.sql`.
2. **Execute (Node.js)** — `scripts/execute_load.js` connects to Firebird over the wire protocol
   (`node-firebird`, no native client library needed) and runs those 8 files in order.

**Dynamic vs. fixed.** The actual rows (respondent IDs, raw item values, computed scores) are
re-read from the `.sav` every run. Which instrument each column belongs to, dimension names, and
English item wording are **fixed** in `scripts/catalog.py` — this cannot be derived from the `.sav`
itself (it carries no column labels; see `SPSS_to_Firebird_Mapping.md` §1), so it was hand-extracted
from the researcher's `.pptx`/`.docx` once. `generate_load_scripts.py` cross-checks the `.sav`'s
actual columns against this catalog on every run and prints a warning — never guesses — if it finds
a mismatch.

**Safety behavior already built into `execute_load.js`:**

- **Preflight schema check** — refuses to run if any `GDX_PSY_*` table is missing.
- **Idempotency guard** — refuses to run if `GDX_PSY_STUDY.ID_STUDY = 1` already exists, to avoid a
  duplicate/partial load (`--force` skips the guard; the script still never deletes anything).
- **Resumable** — `--only <1-8>` re-runs a single file.
- **Batched commits** — the two bulk files (`06`, `07`, ~58k and ~8.9k statements) commit every 2000
  statements instead of one giant transaction.

A sibling one-off executor, `scripts/execute_afc_property_load.js`, targets a single arbitrary SQL
file instead of the fixed 01..08 pipeline — this is what originally loaded `samples.SQL/09-11` (the
CFA/EFA results computed from the `.sav`) into `GDX_PSY_PSYCHOMETRIC_PROPERTY`, and it is reused by
§4 below to (optionally) load `GDX_SKILL_MAKE_ANALYSES_CFA_EFA`'s DB-sourced results the same way.

Full instructions, flags and the `.env` connection variables: see this skill's own `SKILL.md`.

## 4. `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` — Firebird → CFA/EFA results

DB-sourced twin of `analyses.CFA/run_cfa_career_adaptability.py` and
`analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py` for the Career Adapt-Abilities Scale
(CAAS, `ID_INSTRUMENT=3`, `ID_CONSTRUCT=3`). Same statistical models, same fit indices, same output
shape — the only difference is where the raw `AC1`-`AC28` values come from.

Three stages:

1. **Fetch (Node.js)** — `scripts/fetch_career_adaptability_items.js` connects to Firebird
   (`node-firebird`, same wire-protocol approach as `execute_load.js`) and writes two CSVs into
   `data/`:
   - `career_adaptability_items.csv` — one row per `ID_APPLICATION`, columns `AC1..AC28`, built by
     joining `GDX_PSY_ITEM_RESPONSE` to `GDX_PSY_INSTRUMENT_ITEM` (`ID_INSTRUMENT=3`) and pivoting
     on `ITEM_ORDER`. Refuses to write the file if any application is missing one of the 28 items.
   - `career_adaptability_dimension_scores.csv` — one row per `ID_APPLICATION`, columns
     `Concern/Control/Curiosity/Confidence`, read from `GDX_PSY_VARIABLE_RESULT`
     (`ID_VARIABLE` 7-10). This plays the same cross-validation role the SPSS-precomputed
     `ACpreocup/ACcontrole/ACcuriosid/ACconfianc` columns play in the `.sav`-sourced scripts, and
     feeds the EFA script's dimension-level mean/SD and Pearson-correlation sections directly.
2. **CFA (Python)** — `scripts/run_cfa_from_db.py` reads the items CSV, fits the same 4-factor
   correlated CFA model (`semopy`, ML), prints fit indices / Cronbach alpha / factor correlations /
   standardized loadings, and writes
   `output/09_load_psychometric_properties_afc_career_adaptability_from_db.sql`.
3. **EFA (Python)** — `scripts/run_efa_from_db.py` reads both CSVs, extracts 4 factors
   (`sklearn.decomposition.FactorAnalysis` + a hand-rolled Varimax rotation — `factor_analyzer` is
   still broken against scikit-learn >= 1.6), prints KMO/Bartlett, item-level loadings/mean/SD,
   dimension-level mean/SD, Pearson correlations, and writes
   `output/10_load_psychometric_properties_efa_means_sd_career_adaptability_from_db.sql` +
   `output/11_load_psychometric_properties_pearson_correlation_career_adaptability_from_db.sql`.

Both Python scripts assert the raw-item dimension means they compute match the DB's precomputed
dimension scores to within `1e-3` (the DB's `NUMERIC(12,4)` rounding) before doing anything else —
if that assertion fails, the run aborts instead of silently producing numbers that disagree with
`GDX_PSY_VARIABLE_RESULT`.

`data/` and `output/` are gitignored inside this skill folder — they are regenerable artifacts,
re-created fresh every run, unlike the `.sav`-sourced originals in `samples.SQL/09-11`, which stay
the committed, authoritative record of that run.

### 4.1 Verified against the live database (2026-09-17)

Running all three stages against the same Firebird database `GDX_SKILL_LOAD_RLT_MODEL_DB` loads into
reproduced `n=423` and fit/EFA numbers matching `samples.SQL/09-11` to float-rounding, e.g.:

| Metric | `.sav`-sourced (`samples.SQL/09`) | DB-sourced (`output/09_..._from_db.sql`) |
|---|---|---|
| CFI | 0.885943 | 0.885943 |
| KMO | 0.933634 | 0.933634 |
| Pearson r, Concern↔Control | 0.571796 | 0.571800 |

This is expected, not a coincidence — the database itself was loaded from that same `.sav` — but it
is the whole point of the skill: it is an executable proof that what is in Firebird still agrees with
what the `.sav` says, rather than an assumption.

### 4.2 Comparing DB-sourced vs. `.sav`-sourced results

```
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_MAKE_ANALYSES_CFA_EFA/scripts
diff <(grep -o "'[A-Z_]*', '[^']*', [0-9.-]*" ../../../../samples.SQL/09_load_psychometric_properties_afc_career_adaptability.sql) \
     <(grep -o "'[A-Z_]*', '[^']*', [0-9.-]*" ../output/09_load_psychometric_properties_afc_career_adaptability_from_db.sql)
```

A real (non-float-rounding) discrepancy means the database and the `.sav` have drifted — e.g. the
`.sav` was updated and `GDX_SKILL_LOAD_RLT_MODEL_DB` was not re-run to sync it. Investigate that
before trusting either set of numbers.

### 4.3 Loading the DB-sourced results into Firebird (optional)

`output/09-11_*.sql` use the exact same `GDX_PSY_PSYCHOMETRIC_PROPERTY` INSERT shape as the
`.sav`-sourced ones, so they can be executed the same way `GDX_SKILL_LOAD_RLT_MODEL_DB` already
loaded `samples.SQL/09-11`, with `execute_afc_property_load.js --file <path> --dry-run` first.
**Confirm with the user before a real (non-dry-run) load** — it duplicates rows already loaded from
the `.sav` pipeline, under a different `METHOD` tag (`"... - sourced from Firebird DB"`), unless
deliberately keeping both provenances side by side is what is wanted.

Full instructions and flags: see this skill's own `SKILL.md`.

## 5. Running both, end to end

```
# 0) apply the DDL once, if not already applied
#    (execute psychometrics_model_firebird25.sql against the target Firebird database)

# 1) GDX_SKILL_LOAD_RLT_MODEL_DB — .sav -> Firebird
python GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/generate_load_scripts.py
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts
npm install                                # once
# copy ../.env.example to ../.env, fill in GDX_HUMAN_FB_PASSWORD
node execute_load.js --dry-run
node execute_load.js

# 2) GDX_SKILL_MAKE_ANALYSES_CFA_EFA — Firebird -> CFA/EFA results
cd ../../GDX_SKILL_MAKE_ANALYSES_CFA_EFA/scripts
npm install                                # once
# copy ../.env.example to ../.env (or reuse step 1's .env unchanged -- same DB, same var names)
node fetch_career_adaptability_items.js
pip install pandas numpy semopy scipy scikit-learn
python run_cfa_from_db.py
python run_efa_from_db.py

# 3) (optional) load the DB-sourced results back into GDX_PSY_PSYCHOMETRIC_PROPERTY
cd ../../GDX_SKILL_LOAD_RLT_MODEL_DB/scripts
node execute_afc_property_load.js --file ../../GDX_SKILL_MAKE_ANALYSES_CFA_EFA/output/09_load_psychometric_properties_afc_career_adaptability_from_db.sql --dry-run
```

## 6. What is committed vs. gitignored

- `01_load_study.sql`…`08_adjust_sequences.sql` and `samples.SQL/09-11_*.sql` (the `.sav`-sourced
  originals) **are committed** — they document exactly what was loaded and computed.
- `GDX_SKILL_MAKE_ANALYSES_CFA_EFA/data/` and `.../output/` (the DB-sourced CSVs and generated SQL)
  are **gitignored** — regenerable on demand from stage 1/2/3, not a second source of truth to keep
  in sync by hand.
- Each skill's `.env` (real Firebird credentials) is **never committed** — only `.env.example` (no
  secrets) is. Never hardcode host/user/password in any script; read them from environment variables
  only (existing top-level `CLAUDE.md` guidance).
- `node_modules/` and Python `__pycache__/` are gitignored as usual.

## 7. Where everything lives

```
GDX_HUMAN/
  1.output.ibm.spss.statistics/
    PLANILHAPOSDOC11SET SO CADETES.sav          <- source data for GDX_SKILL_LOAD_RLT_MODEL_DB
  2.relational.model.psychometrics/
    RLT_Model_Load_and_CFA_EFA_Analyses.md      <- this document
    psychometrics_model_firebird25.sql          <- the DDL both skills target
    SPSS_to_Firebird_Mapping.md                 <- reasoning behind the one study already loaded
    GDX_PSY_RELATIONAL_MODEL.png                <- schema diagram
    samples.SQL/
      01_load_study.sql .. 08_adjust_sequences.sql   <- generated by GDX_SKILL_LOAD_RLT_MODEL_DB, committed
      09-11_*.sql                                    <- .sav-sourced CFA/EFA results, committed
    analyses.CFA/
      run_cfa_career_adaptability.py            <- .sav-sourced CFA (original)
      AFC_Career_Adaptability.md
    analyses.EFA/
      run_efa_loadings_means_sd_career_adaptability.py   <- .sav-sourced EFA (original)
      EFA_Loadings_Means_SD_Career_Adaptability.md
    .claude/skills/
      GDX_SKILL_LOAD_RLT_MODEL_DB/               <- .sav -> Firebird
        SKILL.md
        scripts/catalog.py
        scripts/generate_load_scripts.py
        scripts/execute_load.js + package.json
        scripts/execute_afc_property_load.js
        .env.example
      GDX_SKILL_MAKE_ANALYSES_CFA_EFA/           <- Firebird -> CFA/EFA results
        SKILL.md
        scripts/fetch_career_adaptability_items.js + package.json
        scripts/run_cfa_from_db.py
        scripts/run_efa_from_db.py
        .env.example
        .gitignore                                <- excludes data/ and output/
        data/            (gitignored)             <- career_adaptability_items.csv, ..._dimension_scores.csv
        output/          (gitignored)             <- 09-11_..._from_db.sql
```
