---
name: GDX_SKILL_MAKE_ANALYSES_CFA_EFA
description: Runs CFA/EFA psychometric analyses sourced from a live Firebird database (GDX_PSY_ITEM_RESPONSE / GDX_PSY_VARIABLE_RESULT) instead of the .sav file, for EVERY instrument (ID_INSTRUMENT 1-11), not just the Career Adapt-Abilities Scale. Track A (CAAS, ID_INSTRUMENT=3): DB-sourced twin of ../../analyses.CFA/run_cfa_career_adaptability.py and ../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py, hardcoded/confirmed item grouping. Track B (the other 8 multi-item instruments: Hardiness, Student Engagement, Satisfaction With Life, Job Satisfaction, Positivity Ratio, Maslach Burnout, Undocumented Organizational Block, Red Tape): discovers item-to-variable structure computationally (GDX_PSY_INDICATOR_ITEM is empty in this database), runs both EFA and CFA on that discovered grouping, every row honestly labeled DISCOVERED or -- for a variable that independently earns it, like MBI-SS's Emotional Exhaustion -- CONFIRMED (`run_cfa_generic.py` runs either way now; `run_efa_generic.py` still refuses if any variable is confirmed, since whole-instrument exploratory extraction stops making sense once part of the structure is already proven). Track C (Personal Satisfaction, Perceived Control of Life): descriptive statistics only -- a single item has no factor to analyze. Every track's fetch/discovery stage also accepts an optional `--study <slug>` to scope applications to one study (same intake.json slug resolution as GDX_SKILL_GODATAX_HUMAN7_BY_SPU), and `scripts/run_study_analyses.js --study <slug>` runs every instrument that one study actually has responses for in one pass, routed to its track automatically. Use when the user asks to (re)run CFA/EFA analyses from the database, verify the .sav-sourced results, run factor analysis "for all instruments"/"all variables", or run analyses scoped to one specific study.
---

# GDX_SKILL_MAKE_ANALYSES_CFA_EFA

Three tracks, all writing `GDX_PSY_PSYCHOMETRIC_PROPERTY` rows from raw item responses read live
from Firebird instead of a `.sav` file. Together they cover all 11 instruments.

### Track A -- CAAS (`ID_INSTRUMENT=3`), CFA + EFA, hardcoded grouping

DB-sourced twin of the two existing `.sav`-based analyses for the Career Adapt-Abilities Scale
(CAAS, `ID_CONSTRUCT=3`, Career Adaptability):

- `../../analyses.CFA/run_cfa_career_adaptability.py` (see `AFC_Career_Adaptability.md` there)
- `../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py` (see
  `EFA_Loadings_Means_SD_Career_Adaptability.md` there)

Same statistical models, same fit indices, same output shape -- the only difference is where the
AC1-AC28 raw item values come from: a live Firebird database instead of
`GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav`. The AC1-7/8-14/15-21/22-28
grouping is hardcoded because it is independently *confirmed*: `scripts/analyze_instrument.js`
(below) proves this exact grouping's unweighted item mean reproduces `GDX_PSY_VARIABLE_RESULT`'s
Concern/Control/Curiosity/Confidence scores for every one of 423 applications, max discrepancy
~4e-5 -- true byte-for-byte reconstruction, not a fit.

### Track B -- every other multi-item instrument, EFA + CFA on discovered grouping

`GDX_PSY_INDICATOR_ITEM` (the schema's own item -> indicator -> variable mapping table) is
**completely empty** in this database (0 rows), and
`1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET_SO_CADETES_Documentacao.md` admits some subscale
item memberships are unknown even to the original project's authors (e.g. which of the 18 `ef*`
items feed "Emotional Exhaustion", or the "Undocumented Organizational Block" `an1-an11` items' 4
subdimensions). So for the other 8 multi-item instruments (everything except CAAS and the two
single-item instruments, Track C below), `scripts/analyze_instrument.js` *discovers* the grouping
instead of assuming it -- see "Structure discovery" below. Most of these variables do **not**
reproduce their `GDX_PSY_VARIABLE_RESULT` score exactly from any linear combination of their own raw
items (best match varies from strong, r=0.74-0.86 for Satisfaction With Life/Red Tape, to weak,
r=0.09-0.50 for Positivity Ratio) -- likely reflecting that the DB's raw items and precomputed
scores were loaded in separate passes that drifted, not that the items are unrelated to their
construct. **One exception:** Maslach Burnout's (`ID_INSTRUMENT=9`) sole named variable, Emotional
Exhaustion, *does* reproduce exactly -- unweighted mean of items 1-5, max discrepancy 0 -- discovered
the same way CAAS's grouping was, just for a single variable rather than four. A variable earning
`confirmed: true` this way is not limited to CAAS; see "Confirmed variables outside CAAS" below.

Given that, this skill still runs **both** EFA and CFA for these 8 -- and every output row says
plainly whether its own grouping is *discovered* or independently *confirmed*:

- `scripts/run_efa_generic.py` -- EFA (no a priori structure needed), extracting *k* factors
  (*k* = the instrument's own count of named `GDX_PSY_VARIABLE` rows), labeling each factor by its
  best-effort correlation against a named variable's real DB score, and writing that correlation
  itself into the output (`TYPE=FACTOR_MATCH_CORRELATION`) so a weak label (e.g. Positivity Ratio)
  is visibly distinguishable from a strong one (e.g. Satisfaction With Life) in the data itself, not
  hidden behind a confident-sounding name.
- `scripts/run_cfa_generic.py` -- CFA (semopy, ML), one factor per named variable with >= 3 items
  (fewer than 3 indicators can't identify a stable factor -- excluded and reported, not silently
  dropped: e.g. Undocumented Organizational Block's Professional/Financial Success, Social Standing
  and Personal Fulfillment all ended up with 0 items once Organizational Anomie's discovery claimed
  all 11, so only Anomie gets a factor). The resulting fit indices are real and informative -- they
  tell you how well the items cohere as a measurement model -- and METHOD/REFERENCE on every row
  spell out, per factor, "DISCOVERED grouping (not exactly confirmed)" or "CONFIRMED grouping" (see
  "Confirmed variables outside CAAS" below), so nobody downstream mistakes one for the other. Fit
  varies a lot by instrument: Red Tape's discovered 4-item factor fits well (CFI 0.99), Positivity
  Ratio's discovered 2-factor split does not (CFI 0.64) -- itself an honest finding, not a bug.

### Confirmed variables outside CAAS -- `run_cfa_generic.py` no longer refuses them

A Track B variable can independently earn `confirmed: true` in `structure.json` the same way CAAS's
grouping did (its discovered item subset's unweighted mean reproduces `GDX_PSY_VARIABLE_RESULT`
byte-for-byte) without being CAAS itself -- MBI-SS's Emotional Exhaustion is the current example.
`run_cfa_generic.py` used to refuse outright whenever every included variable in a run was confirmed,
on the theory that CAAS's own dedicated, hardcoded script (`run_cfa_from_db.py`, Track A) should be
used instead -- but that script is CAAS-only (`ID_INSTRUMENT=3` hardcoded throughout), so any other
instrument's newly-confirmed variable had nowhere to run a CFA at all. Since this script's
model-building was already fully generic (driven by `structure.json`, not CAAS-specific), it now
simply proceeds instead of refusing: every fit-index/alpha/correlation/loading row is labeled
CONFIRMED or DISCOVERED based on which factor(s) it actually involves (a statistic spanning one
confirmed and one unconfirmed factor, e.g. a cross-factor correlation in a mixed-confidence
instrument, is labeled DISCOVERED -- the more cautious claim). `run_efa_generic.py` still refuses if
*any* variable is confirmed, unchanged: EFA is a whole-instrument exploratory extraction that ignores
known structure by design, which stops making sense once part of that structure is already proven.

The one thing that does not change: sample size. `n=1` (one application) cannot fit any CFA
regardless of confirmed status -- a sample covariance matrix needs at least (item count + 1)
observations to be non-singular. `run_cfa_generic.py` checks this explicitly and refuses with a clear
message rather than letting `semopy` fail with an internal `IndexError`.

### Track C -- single-item instruments, descriptive statistics only

Personal Satisfaction (`ID_INSTRUMENT=7`) and Perceived Control of Life (`ID_INSTRUMENT=8`) each
have exactly **1 item**. Neither EFA nor CFA is mathematically defined for a single item -- factor
analysis extracts *shared* variance across multiple items, and a 1x1 correlation matrix has none to
extract (KMO/Bartlett are undefined; a "loading" of an item on its own single factor is trivially 1
by construction, not a finding). `scripts/describe_single_item_instrument.js` writes only
`ITEM_MEAN`/`ITEM_STD_DEV`/`DIMENSION_MEAN`/`DIMENSION_STD_DEV` (the last two read straight from
`GDX_PSY_VARIABLE_RESULT` and are numerically identical to the first two here, since the "dimension"
*is* the one item) -- no KMO/Bartlett/loading/fit-index row is written for these two, ever.

## Structure discovery (`scripts/analyze_instrument.js`, Track B)

For each variable, items are ranked by `max(|corr_raw|, |corr_reversed|)` against that variable's
real `GDX_PSY_VARIABLE_RESULT` score (ground truth exists for all 22 variables in this DB, n=423 or
n=422 for Red Tape, independent of whether anyone documented how it was derived). For each
candidate subset size (ranked-prefix), every 2^s reversal-flip combination is tried (fewest flips
first) to find one whose unweighted mean reproduces the ground truth for every application within
tolerance. Variables are processed most-confident-first (highest top-1 |r|) so a claimed item is
never offered to a later variable -- guarantees a true partition. A variable that confirms this way
(`confirmed: true` in `data/instrument_<ID>_structure.json`) is safe to build a CFA on (this is
exactly how CAAS's own grouping was validated, not hardcoded blindly); one that doesn't
(`confirmed: false`, the case for all 8 Track-B instruments today) gets EFA-only treatment. Run it
standalone to inspect a structure before trusting it: `node analyze_instrument.js --instrument <ID>`.

## Three-stage pipeline (Track A -- CAAS)

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

## Running all instruments for one study (`--study <slug>`)

`scripts/run_study_analyses.js` -- resolves `--study <slug>` to `GDX_PSY_STUDY.ID_STUDY` (same
`new_study_intake/<slug>/intake.json` lookup `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`/`GDX_SKILL_MAKE_DASHBOARS_DW`/
`GDX_SKILL_LOAD_NEW_STUDY_DW` already use), finds every instrument that study actually has
`GDX_PSY_APPLICATION` rows for, routes each one to its track (`ID_INSTRUMENT=3` -> Track A,
exactly 1 item -> Track C, everything else -> Track B), and runs that track's stage(s) end to end
-- no need to call `analyze_instrument.js`/`fetch_career_adaptability_items.js`/
`describe_single_item_instrument.js` once per instrument by hand.

```
node run_study_analyses.js --study <slug>            # every instrument this study has responses for
node run_study_analyses.js --study <slug> --intake-dir <path>   # override the default intake.json location
```

Each track's Node stage (`fetch_career_adaptability_items.js` / `analyze_instrument.js` /
`describe_single_item_instrument.js`) also accepts `--study <slug>` on its own now, filtering
applications to that one study; omit `--study` on any of them to keep the original unscoped
behavior (every application in the database that has responses to that instrument -- what the
"Comparing against the .sav-sourced results" section below assumes for CAAS, n=423). The Python
CFA/EFA stages never take `--study` themselves -- they only read the CSV/JSON the Node stage
already wrote, which is scoped or not depending on whether that stage got `--study`.

`run_study_analyses.js` does not gate on sample size with some arbitrary threshold -- it always
attempts every instrument's stage(s) and reports each one's real outcome (a fit, a solver error, or
a refusal like "incomplete items" / "no responses") in its final summary, the same
attempt-and-report-honestly approach Track B already uses for weak fits (see the Positivity Ratio
CFI 0.64 case below). A study with very few participants (e.g. a newly-started one) will typically
show real failures here -- that is expected, not a bug: EFA/CFA need multiple respondents to have
any cross-respondent variance to extract, and Firebird-level integrity checks (an application
missing some of an instrument's items) still apply per application, same as the single-instrument
scripts. Nothing is loaded into Firebird by this orchestrator either way -- see "Loading the results
into Firebird" below, same manual/confirmed step regardless of how the SQL was generated.

## Running it -- Track A (CAAS, `--instrument 3`)

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

## Running it -- Track B (any other multi-item instrument, EFA + CFA)

```
node analyze_instrument.js --instrument <ID>    # discovery + fetch; writes data/instrument_<ID>_{items,variable_scores,structure}.*
python run_efa_generic.py --instrument <ID>     # refuses to run if structure.json has ANY confirmed:true variable
                                                 # (that means it's CFA-worthy the CAAS way -- use Track A instead)
python run_cfa_generic.py --instrument <ID>     # same refusal; only includes variables with >=3 discovered items
```

Valid `<ID>`s today: `1` (Hardiness), `2` (Student Engagement Scale), `4` (Satisfaction With Life
Scale), `5` (Job Satisfaction Scale), `6` (Positivity Ratio Scale), `9` (Maslach Burnout Inventory),
`10` (Undocumented Organizational Block), `11` (Red Tape). Run every one of them in one pass:
`for i in 1 2 4 5 6 9 10 11; do node analyze_instrument.js --instrument $i && python run_efa_generic.py --instrument $i && python run_cfa_generic.py --instrument $i; done`.

## Running it -- Track C (single-item instruments, descriptive statistics only)

```
node describe_single_item_instrument.js --instrument <ID>   # writes output/describe_instrument_<ID>_<slug>.sql directly, no Python stage
```

Valid `<ID>`s: `7` (Personal Satisfaction), `8` (Perceived Control of Life) -- the only two
instruments with exactly 1 item. Refuses (points you at Track B instead) for any instrument with
more than 1 item.

Connection (all tracks) is read entirely from environment variables (see `.env.example`) -- **never
hardcode host/user/password** in these scripts or anywhere else in the repo (existing CLAUDE.md
guidance about not propagating hardcoded Firebird credentials).

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

All generated `output/*.sql` files use the exact same `GDX_PSY_PSYCHOMETRIC_PROPERTY` INSERT shape.

- **Track A (CAAS, `output/09-11_*.sql`):** `../GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/execute_afc_property_load.js
  --file <path> --dry-run` first, then without `--dry-run`. Its preflight is hardcoded to
  `ID_INSTRUMENT=3` / `TYPE='CFI'` (CAAS's own re-run check) -- do not point it at a Track-B file.
- **Track B/C (any other instrument, `output/efa_instrument_<ID>_*.sql` / `cfa_instrument_<ID>_*.sql` /
  `describe_instrument_<ID>_*.sql`):** `scripts/load_property_file.js --file <path> --instrument <ID>
  --dry-run` first, then without `--dry-run`. Its preflight checks for ANY existing
  `GDX_PSY_PSYCHOMETRIC_PROPERTY` row for that `--instrument` (generic, not hardcoded to instrument
  3) and refuses without `--force` -- an instrument's EFA file, its CFA file, and its companion
  `_pearson_correlation.sql` file all touch the same `ID_INSTRUMENT`, so load the EFA file first
  (no `--force` needed the first time), then the CFA and correlation files with `--force` (none of
  that is a duplicate, just successive files for the same instrument; the script never deletes
  anything either way).

**Before running a real (non-dry-run) load, confirm with the user first** -- this is a write to a
shared remote system. For Track A, re-loading would duplicate rows already loaded from the `.sav`
pipeline under a different `METHOD` tag (`... - sourced from Firebird DB`) unless that's genuinely
wanted (e.g. deliberately keeping both provenances side by side). For Track B/C there's no prior
`.sav` load to collide with (these instruments had zero `GDX_PSY_PSYCHOMETRIC_PROPERTY` rows before
this skill existed) -- the risk is only the ordinary one of writing to a shared remote database.

## Files in this skill

Track A (CAAS):
- `scripts/fetch_career_adaptability_items.js` -- stage 1 (Node.js + node-firebird)
- `scripts/run_cfa_from_db.py` -- stage 2a (Python + pandas/numpy/semopy)
- `scripts/run_efa_from_db.py` -- stage 2b (Python + pandas/numpy/scipy/scikit-learn)

Track B (every other multi-item instrument):
- `scripts/analyze_instrument.js` -- fetch + structure discovery (Node.js + node-firebird), any `--instrument <ID>`
- `scripts/run_efa_generic.py` -- EFA, factor<->variable best-effort matching (Python + pandas/numpy/scipy/scikit-learn)
- `scripts/run_cfa_generic.py` -- CFA on the discovered grouping, >=3-item variables only (Python + pandas/numpy/semopy)

Track C (single-item instruments):
- `scripts/describe_single_item_instrument.js` -- descriptive stats only, no Python stage (Node.js + node-firebird)

Shared:
- `scripts/run_study_analyses.js` -- orchestrator: resolves `--study <slug>`, finds every instrument that study has responses for, routes each to Track A/B/C, runs that track's stage(s)
- `scripts/load_property_file.js` -- generic loader for any Track-B/C `output/*.sql` file (per-instrument preflight, not hardcoded to instrument 3 like the sibling skill's `execute_afc_property_load.js`)
- `scripts/package.json` -- Node dependency (node-firebird)
- `.env.example` -- connection variable template (no secrets)
- `.gitignore` -- excludes the regenerable `data/` and `output/` folders
