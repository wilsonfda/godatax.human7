---
name: F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS
description: Implements this folder's F4 layer ("Curvature Depth Index, original characteristics") on top of F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE's own output -- for a given study, computes the Curvature Depth Index (CDIx, unweighted and weighted) between every complete-case person's own observed, normalized profile z(t) (GDX_HNF_FEATURE_VALUE, an MFS ZSCORE run) and an explicit, frozen reference profile built from one of four bases (personal baseline, study cohort, population reference, instrument norm). Writes GDX_HNF_CDI_REFERENCE_SET/GDX_HNF_CDI_REFERENCE_VALUE/GDX_HNF_CDI_RUN/GDX_HNF_CDI_RUN_FEATURE/GDX_HNF_CDI_VALUE/GDX_HNF_CDI_VALUE_DETAIL (hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql, this folder) via scripts/generate_curvature_depth_index.js --study <slug> --reference-type ... [--weighted --weights-file <path>]. Use when the user asks to compute the Curvature Depth Index, a CDI, a deviation/displacement index against a reference profile, or a KPI of distance to a baseline/population/norm for a GDX_HUMAN study. Does NOT compute the latent-space CDI variant (a separate, later extension of this layer).
---

# F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS (F4)

Implements **F4** -- this folder's fourth step in its own multidimensional feature-space
mathematical model, built directly on top of what **F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE**
(MFS, F1) already produced, and reusing the exact RMS-distance arithmetic
**F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES** (F3) already validates one layer down. Where F1
assembles and normalizes a per-person feature vector `z(t)` and F3 compares pairs of *observed*
profiles against each other, F4 answers a different question: **how far is one observed profile
from an explicit, chosen reference?**

```
CDIx(t)   = sqrt( (1/n) * sum_j=1..n ( z_j(t) - z_j_ref )^2 )                    unweighted
CDIx_w(t) = sqrt( sum_j=1..n w_j * ( z_j(t) - z_j_ref )^2  /  sum_j=1..n w_j )    weighted
            w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to CDIx)
```

"Curvature Depth" is this project's own naming convention for this quantity, carried over from a
visual design metaphor (a larger CDI drawn as a "deeper" point on a graphic). The formula itself
is an ordinary RMS distance -- it is **not** the scalar curvature of a Riemannian manifold, **not**
a measurement of consciousness, health, spiritual energy or virtue, and carries **no fixed upper
bound** under the z-score input this project uses: `CDIx = 0` means coincidence with the reference
on every included feature; a larger `CDIx` means a larger normalized displacement, **never** a
"worse" condition by itself. A `CDIx` near 1 means nothing special on a z-score scale (unlike a
min-max scale centered at 0.5, where the maximum possible value is 0.5, not 1) -- whether a given
`CDIx` is large, small, stable or related to any external outcome is an empirical question this
skill records the inputs for; it never answers that question on its own.

## Why this is a different, later decision than F3

F3 ("distance and similarity between profiles") deliberately only ever compares pairs of
**observed** persons' own profiles -- it never computes a distance against a single, fixed
reference, because defining "the center" a distance is measured from is a materially different,
more consequential design decision (see F3's own `SKILL.md`/DDL header). **This skill is exactly
that later, separate decision.** It defines four possible references (below), freezes one of them
into `GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_REFERENCE_VALUE`, then reuses F3's own RMS-distance
shape between one observed profile and that frozen reference instead of between two observed
profiles. F4 never recomputes a pairwise distance between two observed persons -- that stays F3's
job.

## Four reference bases

Which basis is appropriate depends on the question being asked ("displacement from what?") --
this skill never picks one on its own; `--reference-type` is always explicit.

### 1. `personal_baseline`

The mean (or median, `--baseline-estimator`) of **one person's own** earliest
`--baseline-sessions` (default 3) real observations of `z(t)`, per feature, drawn from any ZSCORE
run of the same study (so a sparse, multi-session feature -- e.g. physiological HRV -- and a
repeated administration of the same study's instruments over time are both honored). Quantifies
*personal* displacement over time. Needs `--subject <id_person>`. A feature with fewer real
sessions than requested still gets a reference value (from what is actually available), reported
in that reference set's own `NOTES` -- never treated as an error; a feature with **zero** real
sessions for that person simply has no reference row at all.

### 2. `study_cohort`

The mean of `z(t)` actually realized, feature by feature, across the **same** evaluated run's own
complete-case sample. Always computed from real data, never assumed to be exactly the zero vector
-- even though the normalization sample F1 used to fit `mean`/`std` may be larger or different from
the complete-case subset a given CDI run actually uses.

### 3. `population_reference`

The same mean-of-`z(t)` computation as `study_cohort`, but sourced from a **different**, explicitly
identified `GDX_HNF_FEATURE_SPACE_RUN` (`--population-run-id`) -- a different study, a different
time point, or a deliberately drawn sub-sample. Never silently reused from the run being evaluated
(that would collapse this into `study_cohort` under a different label); `--population-run-id` must
differ from the evaluated run's own `ID_RUN`, or the script refuses.

### 4. `instrument_norm`

Values taken from an instrument's own manual or validation study, supplied by a human via
`--norm-file <path>` (a JSON file keyed by `FEATURE_CODE`). This skill has **no automated source**
for this -- a feature absent from the file gets no reference row at all. Per this project's "Never
invent missing data" rule, applied here exactly as the underlying theory insists: when no validated
norm is available for a feature, it is excluded, **never** defaulted to a placeholder value (such as
a scale midpoint) as if that were a known ideal.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_FEATURE_SPACE_RUN   -> the evaluated F1 run (must be NORMALIZATION_METHOD='ZSCORE'), and,
                                for population_reference, a second, different ZSCORE run
GDX_HNF_FEATURE_VALUE       -> z(t): the normalized per-person, per-feature values F1 froze
GDX_HNF_FEATURE_DICTIONARY  -> feature metadata, to decide eligibility (excludes NOMINAL-scale and
                                IS_METAPHYSICAL_INTERPRETATION=1 features, same rule as F2/F3)
```

This skill never reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` directly, and never re-normalizes a feature on
its own -- F1 has already done that work and frozen `z(t)`. "Reading the relational/BI/graph
sources" for F4 is satisfied *transitively*, through an already-run F1 `ZSCORE` run, the same
posture `F2_GDX_SKILL_LATENT_REPRESENTATIONS` and `F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES`
already take one layer down. If no such run exists yet for the study, this skill has nothing to
compute from and must point the user at MFS first.

## Per-feature traceability: the difference vector is never discarded

Unlike `GDX_HNF_DISTANCE_VALUE` (F3), which stores only the aggregate distance for a pair, F4 also
stores the **full per-feature difference vector** behind every CDI value
(`GDX_HNF_CDI_VALUE_DETAIL`: current value, reference value, signed difference, weight actually
applied). Summarizing a multivariate displacement into one scalar necessarily discards which
features moved and in which direction -- recovering that is required for any honest reading of a
CDI run, so it is written once, at computation time, rather than left to be re-derived by hand
later from `GDX_HNF_FEATURE_VALUE` and `GDX_HNF_CDI_REFERENCE_VALUE`.

## Weighting (CDIx_w)

`--weighted` switches from `CDIx` to `CDIx_w` and **requires** `--weights-file <path>` (a JSON file
keyed by `FEATURE_CODE`, one non-negative number per feature in the final feature set). Nothing is
ever defaulted to `1` once `--weighted` is passed -- a feature missing from the weights file fails
the run outright, rather than silently being treated as unweighted inside a "weighted" run. A
weight of `0` excludes a feature's contribution without removing it from the record; weights
summing to `0` across the whole final feature set is refused (the formula would otherwise divide by
zero). Per this layer's own governance rule, a weight must never be chosen simply to produce a
desired CDI value -- weights should reflect a pre-specified theoretical rationale or validated
measurement reliability, with sensitivity analysis, not post-hoc tuning; this skill has no way to
enforce that intent, only the arithmetic constraints (`>= 0`, sum `> 0`).

## Missing data: complete cases only, never imputed

A person missing a real value on **any** feature in the final feature set (candidate features
that also have a reference value) is excluded from the run entirely
(`GDX_HNF_CDI_RUN.INPUT_SELECTION = 'COMPLETE_CASES'`, the only value this schema allows -- same
convention as `GDX_HNF_LATENT_RUN`/`GDX_HNF_DISTANCE_RUN` in F2/F3). A candidate feature with no
value in the chosen reference set is excluded from the run's final feature set entirely, not
silently compared against a fabricated center. Nothing here is ever mean-imputed, zero-filled, or
defaulted.

## Database structure

`hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_CDI_REFERENCE_SET` | 1 row per constructed reference | Which basis (`REFERENCE_TYPE`), which subject/source run, frozen once built |
| `GDX_HNF_CDI_REFERENCE_VALUE` | 1 row per (reference set, feature) | The frozen `z_j_ref`, its own dispersion and sample size |
| `GDX_HNF_CDI_RUN` | 1 row per execution | Versioned run metadata: evaluated run, reference set, weighting, counts |
| `GDX_HNF_CDI_RUN_FEATURE` | 1 row per (run, feature) | Which features, in what order, under which weight `w_j` |
| `GDX_HNF_CDI_VALUE` | 1 row per (run, person) | The computed `CDIx(t)`/`CDIx_w(t)` -- always real, never imputed |
| `GDX_HNF_CDI_VALUE_DETAIL` | 1 row per (CDI value, feature) | The per-feature difference vector behind that one scalar |

Apply this DDL once (after `hypotheses_non_fingo_feature_space_model_firebird25.sql`, this folder's
F1 schema) before this skill's first run.

## Running it

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS/scripts
npm install                                                           # once, installs node-firebird
node generate_curvature_depth_index.js --sample                      # sanity check: the worked numeric examples, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# Study cohort reference (needs no --subject/--norm-file/--population-run-id):
node generate_curvature_depth_index.js --study <slug> --reference-type study_cohort --feature "PSY.VAR." --dry-run
node generate_curvature_depth_index.js --study <slug> --reference-type study_cohort --feature "PSY.VAR."

# Personal baseline (one subject's own earliest sessions):
node generate_curvature_depth_index.js --study <slug> --reference-type personal_baseline --subject 123 --baseline-sessions 3 --feature "PSY.VAR."

# Population reference (a DIFFERENT run than the one being evaluated):
node generate_curvature_depth_index.js --study <slug> --reference-type population_reference --population-run-id 7 --feature "PSY.VAR."

# Instrument norm (human-supplied JSON, feature-by-feature, never fabricated):
node generate_curvature_depth_index.js --study <slug> --reference-type instrument_norm --norm-file ./norms_example.json --feature "PSY.VAR."

# Weighted CDI, reusing an already-built reference set instead of building a new one:
node generate_curvature_depth_index.js --study <slug> --reference-set-id 1 --weighted --weights-file ./weights_example.json --feature "PSY.VAR."
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug MFS/F2/F3 use.
- `--reference-set-id <id>` reuse an existing, already-frozen `GDX_HNF_CDI_REFERENCE_SET` instead
  of building a new one. Mutually exclusive with `--reference-type`.
- `--reference-type study_cohort|population_reference|personal_baseline|instrument_norm` required
  when `--reference-set-id` is not given -- see "Four reference bases" above.
- `--population-run-id <id>` required for `--reference-type population_reference`; must differ
  from the evaluated run.
- `--subject <id_person>` required for `--reference-type personal_baseline`.
- `--baseline-sessions <m>` default `3`, `--reference-type personal_baseline` only.
- `--baseline-estimator mean|median` default `mean`, `--reference-type personal_baseline` only.
- `--norm-file <path>` required for `--reference-type instrument_norm`.
- `--run-id <id>` optional. A specific `GDX_HNF_FEATURE_SPACE_RUN.ID_RUN` (must be `ZSCORE`) to
  evaluate, instead of the study's latest.
- `--feature <text>` optional, same convention and recommendation as F2/F3 (`--feature "PSY.VAR."`
  today, see those skills' own `SKILL.md` for why).
- `--weighted` compute `CDIx_w` instead of `CDIx`. Requires `--weights-file`.
- `--weights-file <path>` required with `--weighted` -- see "Weighting" above.
- `--reference-label <text>` optional override of the auto-generated `REFERENCE_LABEL`.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (candidate/final features, reference values, complete-case
  persons) and logs it, writing no row.
- `--sample` runs the worked numeric examples below on small, explicitly-labeled synthetic data --
  never connects to Firebird, never writes anything.

## Worked examples (`--sample`, illustrative numbers only, not real study data)

**Unweighted, against a fixed reference of 0.5 on five features:**

```
current   = [0.8, 0.6, 0.4, 0.7, 0.5]
reference = [0.5, 0.5, 0.5, 0.5, 0.5]
diff      = [0.3, 0.1, -0.1, 0.2, 0.0]   squared = [0.09, 0.01, 0.01, 0.04, 0.00]
CDIx = sqrt(0.15 / 5) = sqrt(0.03) ~= 0.1732
```

**Unweighted, against a personal baseline on four features:**

```
baseline (personal reference) = [0.62, 0.50, 0.55, 0.44]
current session               = [0.70, 0.45, 0.61, 0.49]
diff                           = [0.08, -0.05, 0.06, 0.05]   squared = [0.0064, 0.0025, 0.0036, 0.0025]
CDIx_personal = sqrt(0.015 / 4) = sqrt(0.00375) ~= 0.0612
```

## What this skill will never do

- **Never computes a distance between two observed persons** -- that stays F3's own job; F4 only
  ever compares one observed profile to one frozen reference.
- **Never re-normalizes a feature or re-reads the relational/BI/graph sources F1 already
  consolidated.**
- **Never fabricates a reference value.** A feature with no real session (`personal_baseline`), no
  real observation in the source run (`study_cohort`/`population_reference`), or no entry in the
  supplied file (`instrument_norm`) is excluded from that reference set entirely -- never defaulted
  to a placeholder such as a scale midpoint.
- **Never defaults a weight.** `--weighted` requires an explicit, complete `--weights-file`; a
  missing entry fails the run.
- **Never imputes or zero-fills a missing value.** A person missing any final-feature value is
  excluded from the run entirely.
- **Never updates an existing `GDX_HNF_CDI_REFERENCE_SET` or `GDX_HNF_CDI_RUN` in place.** A new
  reference or a new run is always a new row.
- **Never computes the latent-space CDI variant** (the same formula applied to F2's own `h(t)`
  instead of F1's `z(t)`) -- that is a separate, later extension of this layer, with its own
  different epistemological caveats, not in scope here.
- **Never treats a CDI value as evidence of causality, a clinical condition, or a validated
  correspondence to a chakra, a Thomistic Way or a septenary level.**

## Files in this skill

- `../../hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql` -- DDL for the six
  `GDX_HNF_CDI_*` tables this skill reads/writes (must already be applied, and MFS must already
  have produced a `ZSCORE` run for the study, before this skill has anything to compute)
- `scripts/generate_curvature_depth_index.js` -- resolves `--study`'s evaluated run, builds or
  reuses a reference set, computes `CDIx`/`CDIx_w` over the complete-case (person, feature) matrix,
  and writes the `GDX_HNF_CDI_*` rows (Node.js + `node-firebird`, no native client library
  required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
