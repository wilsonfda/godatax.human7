---
name: F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE
description: Given a study slug, reads that study's data from the relational OLTP schemas (2.relational.model.psychometrics, 6.cardiac.coherence), preferring the BI star schema (7.multidimensional.database) when it is already loaded, and optionally Neo4j (--include-graph), to assemble and F1-normalize (z-score/min-max/robust) a per-person feature space x(t)/z(t) across every perspective with real data today (Psi/psychometrics, Phi/physiology) -- recording it into the new GDX_HNF_* tables in hypotheses_non_fingo_feature_space_model_firebird25.sql (this folder). Missing data is flagged (IS_MISSING), never imputed. Each run is a new, versioned snapshot. Use when the user asks to build/generate the (multidimensional) feature space for a study, as the first step of this project's multidimensional feature-space mathematical model -- it does NOT compute latent representations, distances, the Curvature Depth Index, reference baselines, trajectories, Knowledge Graph relations, or the Virtology layer (later skills in this folder). Also known by its short name, MFS.
---

# F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS)

Implements **F1 (normalization and comparability)**: for one study, assembles a
per-person, per-feature vector `x(t) = [Ψ, Φ, N, B, A, C, E, M]` from whatever
perspectives this project already has real, operationalized data for, and
normalizes it into `z(t)`. This is the **first** skill in `16.hypotheses.non.fingo`
(the folder implementing this mathematical-model layer), referred to as **MFS**
from here on; later skills will add
F2 (latent representations), F3 (distance/similarity), F4 (the Curvature Depth
Index), F6 (temporal trajectories), F7 (Knowledge Graph relations) and F8
(Virtology layer) on top of what this skill produces, **none of that is in scope
here**.

## What it reads

```
2.relational.model.psychometrics  -> GDX_PSY_VARIABLE_RESULT / GDX_PSY_APPLICATION   (Ψ, psychometric scores)
6.cardiac.coherence               -> GDX_CC_HRV_WINDOW / GDX_CC_SESSION              (Φ, physiology/HRV)
7.multidimensional.database       -> DW_FACT_PSY_VARIABLE_RESULT / DW_FACT_CC_HRV_WINDOW  (preferred over the
                                      two rows above, used instead of the OLTP source for a given modality
                                      ONLY when GDX_SKILL_LOAD_NEW_STUDY_DW has already loaded this study,
                                      checked live against the database, never assumed)
9.knowledge.graph (Neo4j)         -> GDX_PSY_PERSON node properties, ONLY with --include-graph
```

Today this covers exactly the two perspectives this project has real operationalized
data for. Neurophysiology, behavior, environment and energy (N, B, A, E) have no
source table anywhere in the project yet, nothing is fabricated for them, they
simply contribute zero features until a real source exists (e.g.
`15.environmental.anomalous.phenomena`'s `GDX_PH_*` sensor tables could feed A/E in
a future revision of this skill). **Metaphysics (M) is never turned into a feature
by this skill**, per this project's `CLAUDE.md` rule ("Empirical finding !=
interpretive reading"): a chakra, a Thomistic Way or a septenary level is an
interpretive ontology, not a measurement.

## Why Neo4j is optional and usually finds nothing

`--include-graph` makes MFS scan each study participant's own
`GDX_PSY_PERSON` node (matched by `gdx_key = String(ID_PERSON)`, per
`GDX_SKILL_GODATAX_HUMAN7_BY_SPU`'s schema-driven exporter) for numeric properties
beyond the standard catalog columns. As of this writing, the two graph-ML skills in
`10.gdx.machine.learning` (link prediction, community detection) are **read-only
against Neo4j** and only ever write their results to a Markdown report in that
folder — they do not persist anything back onto a node. So a normal run of
`--include-graph` will report "no extra numeric properties found" and move on. If
it does find something (a future graph-ML skill starts writing back, say), it is
only **reported** in the run's `NOTES` — this skill never auto-catalogs an arbitrary
graph property into a perspective/feature_type on its own; that mapping is a human
judgment call (or a future skill's), not something to guess.

## Normalization (F1) — scope and deliberate limits

- Method: `--normalization zscore|minmax|robust` (default `zscore`) — z-score;
  min-max against an arbitrary `[a,b]` range; or robust median/IQR.
- **Reference basis: this run's own study sample only** (`REFERENCE_SAMPLE =
  'STUDY_SAMPLE'` in `GDX_HNF_NORMALIZATION_PARAM`). Individual baseline,
  population reference and instrument-normative reference schemes are
  deliberately **not** implemented here — they belong to a later CDI/F4 skill,
  which is a different, much more consequential design decision (what is "the
  center" a distance is measured from) that the user asked to defer.
- Parameters (`PARAM_1`/`PARAM_2`: mean/std, min/max, or median/IQR) are computed
  once per feature per run and **frozen** — never recomputed in place for an
  existing `ID_RUN`, since redefining μ/σ on every observation would make the
  very movement being measured disappear.
- A feature with fewer than 2 non-missing values, or zero spread (σ=0, max=min, or
  IQR=0) in this run's sample, is **not normalized** (`NORMALIZED_VALUE` stays
  `NULL`) — reported under the run's notes, never divided-by-zero or silently
  given a meaningless constant z-score.

## Missing data — dense for Ψ, sparse for Φ

- **Psychometric (Ψ):** dense. Every `(participant, in-scope variable)` pair gets a
  `GDX_HNF_FEATURE_VALUE` row, even when no `GDX_PSY_VARIABLE_RESULT` exists yet,
  `IS_MISSING=1`, `MISSING_REASON` filled in, `NORMALIZED_VALUE` left `NULL`.
  Missing data is signaled, never imputed or zero-filled.
- **Physiological (Φ):** sparse, by design. A person may have zero, one or many
  cardiac-coherence sessions — there is no fixed "expected count" to diff against,
  so this skill never fabricates a "missing session" row. Each real session
  contributes one row per HRV column, averaged across that session's windows.

## Observation grain

`GDX_HNF_FEATURE_SPACE_RUN.OBSERVATION_GRAIN` records the dominant grain for the
run (`APPLICATION` if only Ψ features exist, `CC_SESSION` if only Φ, `CUSTOM_WINDOW`
when both are mixed, this project never forces a questionnaire administered once
and an HRV signal sampled continuously onto the same literal "session"). Each
individual `GDX_HNF_FEATURE_VALUE` row still carries its own precise
`OBS_GRAIN_KEY` (`APPLICATION:<id>` or `CC_SESSION:<id>`) and
`OBS_INSTANT`, so the real grain of any one value is never lost even when the run
mixes grains.

## Versioning, every run is a new snapshot

`GDX_HNF_FEATURE_SPACE_RUN` is **never updated in place**. Running this skill again
for the same study (more participants answered, a new cardiac-coherence session
recorded, a different `--normalization` method) creates a brand-new `ID_RUN`, with
its own frozen `GDX_HNF_NORMALIZATION_PARAM` and its own
`GDX_HNF_FEATURE_VALUE`/`GDX_HNF_FEATURE_RUN_MEMBER` rows, so every past
`x(t)`/`z(t)` assembly stays reproducible and auditable. Only the two shared
catalogs, `GDX_HNF_PERSPECTIVE` and `GDX_HNF_FEATURE_DICTIONARY`, are
insert-if-missing across runs and studies (a feature discovered for one study is
immediately reusable by the next study that has the same variable/HRV column in
scope).

## Database structure (first moment, see the DDL file for the full rationale)

`hypotheses_non_fingo_feature_space_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_PERSPECTIVE` | 1 row per Ψ/Φ/N/B/A/C/E/M symbol | Catalog of this model's 8 perspectives |
| `GDX_HNF_FEATURE_DICTIONARY` | 1 row per characteristic | Cross-domain pointer back to the real source (variable, HRV column, ...) |
| `GDX_HNF_FEATURE_SPACE_RUN` | 1 row per execution | Versioned run metadata (study, grain, normalization method, sources used) |
| `GDX_HNF_FEATURE_RUN_MEMBER` | 1 row per (run, feature) | Which features, and in what order `j`, composed `x(t)` for this run |
| `GDX_HNF_FEATURE_VALUE` | 1 row per (run, person, feature, grain key) | The actual `x_ij(t)` / `z_j(t)` values, with explicit `IS_MISSING` |
| `GDX_HNF_NORMALIZATION_PARAM` | 1 row per (run, feature) | The frozen μ/σ, min/max or median/IQR used for that feature in that run |

Apply this DDL once (after `2.relational.model.psychometrics/psychometrics_model_firebird25.sql`
and, if cardiac-coherence features are wanted, `6.cardiac.coherence/gdx_coerencia_cardiaca_fb25_ddl.sql`)
before the first run of MFS.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE/scripts
npm install                                                                  # once, installs node-firebird + neo4j-driver
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD
# (and the NEO4J_* vars, only if you will pass --include-graph), or export the vars directly
node generate_multidimensional_feature_space.js --study <slug> --dry-run    # see exactly what would be computed, writes nothing
node generate_multidimensional_feature_space.js --study <slug>             # apply it
```

Options:
- `--normalization zscore|minmax|robust` (default `zscore`)
- `--include-graph`, also scan Neo4j (see above; requires `NEO4J_*` env vars only then)
- `--intake-dir <path>`, override the default `new_study_intake/<slug>/` location

Read the run's notes before trusting the result is what you expect: "not normalized"
features, duplicate-result collisions, and whether the DW or the raw OLTP schemas
were actually used all need a human to look, not something MFS resolves silently.

## What this skill will never do

- **Never computes a CDI, a distance, a latent embedding, or a reference baseline**
 , those are later skills (F2–F4) in this same folder.
- **Never turns a metaphysical category into a numeric feature** on its own (M is
  cataloged in `GDX_HNF_PERSPECTIVE` with `IS_DIRECTLY_OPERATIONALIZABLE=0` and is
  never populated by this skill).
- **Never imputes or zero-fills a missing value.** `IS_MISSING`/`MISSING_REASON`
  exist precisely so a gap is documented, not hidden.
- **Never updates an existing `GDX_HNF_FEATURE_SPACE_RUN` in place.** A new run is
  always a new row; nothing is truncated or overwritten.
- **Never writes to Neo4j.** `--include-graph` only reads.

## Files in this skill

- `scripts/generate_multidimensional_feature_space.js`, resolves `--study <slug>`'s
  scope, reads the relational/BI (and optionally graph) sources, normalizes, and
  loads the `GDX_HNF_*` tables (Node.js + `node-firebird` + `neo4j-driver`, no
  native client library required)
- `scripts/package.json`
- `.env.example`, connection variable template (no secrets)
- `../../hypotheses_non_fingo_feature_space_model_firebird25.sql`, DDL for the six
  `GDX_HNF_*` tables this skill reads/writes (must already be applied to the
  database)

## Worked example — all 8 perspectives (illustrative numbers only, not real study data)

This walks through one tiny, fabricated run end to end against the full `x(t) = [Ψ, Φ, N, B, A,
C, E, M]` vector, so the formula and the code that implements it can be checked side by side.
None of these numbers come from a real GDX_HUMAN study.

**Important scope note:** today this skill only ever *actually* produces Ψ and Φ features —
see "What it reads" above. N, B, A, C and E below are **hypothetical**: there is no source
table for them yet anywhere in the project, so they are included here purely to show what the
*same* normalization mechanism would do once a real source exists (e.g. `A`/`E` from a future
`15.environmental.anomalous.phenomena` extension, per "What it reads"). **M is never a feature**,
by design (see `IS_DIRECTLY_OPERATIONALIZABLE=0` on `GDX_HNF_PERSPECTIVE`) — it is kept in the
table below only to show *why* it has no numeric column at all.

### 1. The simulated raw matrix `x(t)`

| Person | Ψ `PSY.VAR.101`<br>"Resilience" | Φ `CC.HRV.RMSSD_MS`<br>(ms) | N *(hypothetical)*<br>`EEG.ALPHA_POWER_UV2` | B *(hypothetical)*<br>`BEHAVIOR.DAILY_STEP_COUNT` | A *(hypothetical)*<br>`ENV.AMBIENT_TEMP_C` | C *(hypothetical)*<br>`SELFREPORT.MINDFULNESS_0_10` | E *(hypothetical)*<br>`ENERGY.CALORIC_EXPENDITURE_KCAL` | M |
|---|---|---|---|---|---|---|---|---|
| P1 | 7.0 | 42.0 | 18.0 | 8000 | 22.0 | 7.0 | 350 | — |
| P2 | 5.0 | 38.0 | 22.0 | 6500 | 24.5 | 6.0 | 300 | — |
| P3 | 6.0 | *(no session — no row)* | 15.0 | 9200 | 21.0 | 8.0 | 400 | — |
| P4 | *(no result row — `IS_MISSING=1`)* | 50.0 | 20.0 | 7100 | 23.0 | 5.0 | 320 | — |

`M`'s column is `—` for every row on purpose: it is never measured, never operationalized into
a number by this skill, and never enters `x(t)` at all — not even as a missing value. N/B/A/C/E
are shown here with full data (no gaps) to keep the arithmetic below simple; a real future
source for any of them would follow the exact same dense-missing (one expected value per
person, like Ψ) or sparse-missing (variable count of observations, like Φ) rule shown for Ψ/Φ
below, depending on its own nature.

### 2. The formula (F1, z-score, the default `--normalization`)

For any one numeric feature `j` with non-missing sample values `v_1..v_n` in this run:

```
mean = (Σ v_i) / n
std  = sqrt( (Σ (v_i − mean)²) / n )          <- population variance, not sample (n, not n-1)
z_i  = (v_i − mean) / std
```

This is applied independently, feature by feature — there is no cross-perspective term; Ψ, Φ,
N, B, A, C, E each get their own mean/std from their own sample.

### 3. The exact code that implements it (`scripts/generate_multidimensional_feature_space.js`)

```js
function meanStd(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  return { mean, std: Math.sqrt(variance) };
}
function computeParams(method, values) {
  if (values.length < 2) return null;
  if (method === 'ZSCORE') {
    const { mean, std } = meanStd(values);
    return std === 0 ? null : { param1: mean, param2: std, sampleSize: values.length };
  }
  // ... MINMAX and ROBUST branches, same idea with min/max or median/IQR
}
function normalizeValue(method, raw, param1, param2) {
  if (method === 'ZSCORE') return (raw - param1) / param2;
  // ... MINMAX: (raw - param1) / (param2 - param1); ROBUST: (raw - param1) / param2
}
```

`values` here is exactly the non-missing sample for one `FEATURE_CODE` in this one run
(`valuesByCode.get(code)` in `main()`) — this is what makes `REFERENCE_SAMPLE='STUDY_SAMPLE'`
true: the mean/std come only from the people who actually have a value in this run, nothing
external. `M` never reaches this function at all — it has no `FEATURE_CODE`, so there is
nothing for `valuesByCode` to even collect.

### 4. Computing it by hand for this example

**Ψ — Resilience**, non-missing sample = `[7.0, 5.0, 6.0]` (P1, P2, P3; n=3):

```
mean = 6.0000   std = 0.8165
z_P1 =  1.2247   z_P2 = -1.2247   z_P3 =  0.0000   z_P4 = NULL (RAW_VALUE itself is NULL)
```

**Φ — RMSSD_MS**, non-missing sample = `[42.0, 38.0, 50.0]` (P1, P2, P4; n=3):

```
mean = 43.3333   std = 4.9889
z_P1 = -0.2673   z_P2 = -1.0690   z_P4 =  1.3363   (P3 contributes no row — sparse, see above)
```

**N — EEG_ALPHA_POWER_UV2** *(hypothetical)*, sample = `[18.0, 22.0, 15.0, 20.0]` (n=4):

```
mean = 18.7500   std = 2.5860
z_P1 = -0.2900   z_P2 =  1.2568   z_P3 = -1.4501   z_P4 =  0.4834
```

**B — DAILY_STEP_COUNT** *(hypothetical)*, sample = `[8000, 6500, 9200, 7100]` (n=4):

```
mean = 7700.0000   std = 1017.3495
z_P1 =  0.2949   z_P2 = -1.1795   z_P3 =  1.4744   z_P4 = -0.5898
```

**A — AMBIENT_TEMP_C** *(hypothetical)*, sample = `[22.0, 24.5, 21.0, 23.0]` (n=4):

```
mean = 22.6250   std = 1.2930
z_P1 = -0.4834   z_P2 =  1.4501   z_P3 = -1.2568   z_P4 =  0.2900
```

**C — SELFREPORT.MINDFULNESS_0_10** *(hypothetical)*, sample = `[7.0, 6.0, 8.0, 5.0]` (n=4):

```
mean = 6.5000   std = 1.1180
z_P1 =  0.4472   z_P2 = -0.4472   z_P3 =  1.3416   z_P4 = -1.3416
```

**E — CALORIC_EXPENDITURE_KCAL** *(hypothetical)*, sample = `[350, 300, 400, 320]` (n=4):

```
mean = 342.5000   std = 37.6663
z_P1 =  0.1991   z_P2 = -1.1283   z_P3 =  1.5266   z_P4 = -0.5974
```

**M**: no sample, no mean/std, no `z` — it is structurally absent from `x(t)`, not a value that
happened to come out missing.

### 5. What this run writes to the database

`GDX_HNF_NORMALIZATION_PARAM` (one frozen row per feature, `METHOD='ZSCORE'`,
`REFERENCE_SAMPLE='STUDY_SAMPLE'` — nothing is ever written for `M`):

| `ID_FEATURE` | Perspective | `PARAM_1` (mean) | `PARAM_2` (std) | `SAMPLE_SIZE` |
|---|---|---|---|---|
| `PSY.VAR.101` | Ψ | 6.0000 | 0.8165 | 3 |
| `CC.HRV.RMSSD_MS` | Φ | 43.3333 | 4.9889 | 3 |
| `EEG.ALPHA_POWER_UV2` | N | 18.7500 | 2.5860 | 4 |
| `BEHAVIOR.DAILY_STEP_COUNT` | B | 7700.0000 | 1017.3495 | 4 |
| `ENV.AMBIENT_TEMP_C` | A | 22.6250 | 1.2930 | 4 |
| `SELFREPORT.MINDFULNESS_0_10` | C | 6.5000 | 1.1180 | 4 |
| `ENERGY.CALORIC_EXPENDITURE_KCAL` | E | 342.5000 | 37.6663 | 4 |

`GDX_HNF_FEATURE_VALUE` (one row per person × feature × observed grain; `OBS_GRAIN_KEY` uses
the real `ID_APPLICATION`/`SESSION_ID` the value came from for Ψ/Φ today, shown here as
`<app-N>`/`<sess-N>` placeholders — the hypothetical N/B/A/C/E rows show the same shape a real
future source would populate):

| `ID_PERSON` | `ID_FEATURE` | `OBS_GRAIN_KEY` | `RAW_VALUE` | `NORMALIZED_VALUE` | `IS_MISSING` |
|---|---|---|---|---|---|
| P1 | `PSY.VAR.101` | `APPLICATION:<app-1>` | 7.0 | 1.2247 | 0 |
| P2 | `PSY.VAR.101` | `APPLICATION:<app-2>` | 5.0 | -1.2247 | 0 |
| P3 | `PSY.VAR.101` | `APPLICATION:<app-3>` | 6.0 | 0.0000 | 0 |
| P4 | `PSY.VAR.101` | `APPLICATION:NONE` | NULL | NULL | 1 |
| P1 | `CC.HRV.RMSSD_MS` | `CC_SESSION:<sess-1>` | 42.0 | -0.2673 | 0 |
| P2 | `CC.HRV.RMSSD_MS` | `CC_SESSION:<sess-2>` | 38.0 | -1.0690 | 0 |
| P4 | `CC.HRV.RMSSD_MS` | `CC_SESSION:<sess-4>` | 50.0 | 1.3363 | 0 |
| P1 | `EEG.ALPHA_POWER_UV2` | *(hypothetical grain)* | 18.0 | -0.2900 | 0 |
| P2 | `EEG.ALPHA_POWER_UV2` | *(hypothetical grain)* | 22.0 | 1.2568 | 0 |
| P3 | `EEG.ALPHA_POWER_UV2` | *(hypothetical grain)* | 15.0 | -1.4501 | 0 |
| P4 | `EEG.ALPHA_POWER_UV2` | *(hypothetical grain)* | 20.0 | 0.4834 | 0 |
| … | *(same shape for `BEHAVIOR.DAILY_STEP_COUNT`, `ENV.AMBIENT_TEMP_C`, `SELFREPORT.MINDFULNESS_0_10`, `ENERGY.CALORIC_EXPENDITURE_KCAL`)* | | | | |

Two things to notice: (1) no row at all for `(P3, CC.HRV.RMSSD_MS)` — a sparse-missing feature
never gets a placeholder row, only a dense-missing one does (`(P4, PSY.VAR.101)` above); and
(2) **no `M` rows anywhere, in any table** — that absence is the whole point of
`IS_METAPHYSICAL_INTERPRETATION`/`IS_DIRECTLY_OPERATIONALIZABLE`: a chakra, a Thomistic Way or a
septenary level stays in its own interpretive tables elsewhere in this project and never gets a
`GDX_HNF_FEATURE_DICTIONARY` row of its own.
