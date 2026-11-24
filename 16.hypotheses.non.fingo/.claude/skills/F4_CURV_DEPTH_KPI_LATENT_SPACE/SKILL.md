---
name: F4_CURV_DEPTH_KPI_LATENT_SPACE
description: Implements this folder's F4-alternative layer ("Curvature Depth Index, latent space") on top of F2_GDX_SKILL_LATENT_REPRESENTATIONS's own output -- for a given study, computes CDIh (unweighted and weighted) between every complete-case person's own fitted latent profile h(t) (GDX_HNF_LATENT_VALUE, one GDX_HNF_LATENT_RUN) and an explicit, frozen reference expressed in that SAME latent run's own coordinate system, built from one of three bases (personal baseline -- projected from F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own original-feature-space baseline through the run's PCA loadings, latent cohort, population reference). Writes GDX_HNF_CDIH_REFERENCE_SET/GDX_HNF_CDIH_REFERENCE_VALUE/GDX_HNF_CDIH_REFERENCE_MEMBER/GDX_HNF_CDIH_RUN/GDX_HNF_CDIH_RUN_DIMENSION/GDX_HNF_CDIH_VALUE/GDX_HNF_CDIH_VALUE_DETAIL (hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql, this folder) via scripts/generate_curvature_depth_index_latent.js --study <slug> --reference-type latent_cohort|population_reference|personal_baseline [...]. Use when the user asks to compute the Curvature Depth Index in latent space, a CDIh, or a deviation/displacement index against a reference profile expressed in a fitted (PCA/autoencoder/UMAP) representation for a GDX_HUMAN study. Does NOT compute CDIx (the original-characteristics variant -- that is F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own job). Validated end-to-end against this project's own study 1 (see "Current status").
---

# F4_CURV_DEPTH_KPI_LATENT_SPACE (F4-alternative)

Implements this folder's **F4-alternative** layer -- the same displacement-from-a-reference
question `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` (F4, original characteristics) already answers,
applied instead to the fitted latent representation `h(t)` that
`F2_GDX_SKILL_LATENT_REPRESENTATIONS` (F2) produces on top of `F1_GDX_SKILL_MULTIDIMENSIONAL_
FEATURE_SPACE` (MFS, F1):

```
CDIh(t)   = sqrt( (1/k) * sum_j=1..k ( h_j(t) - h_j_ref )^2 )                    unweighted
CDIh_w(t) = sqrt( sum_j=1..k w_j * ( h_j(t) - h_j_ref )^2  /  sum_j=1..k w_j )    weighted
            w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to CDIh)
```

`k` is the evaluated run's own `GDX_HNF_LATENT_RUN.LATENT_DIMENSION_COUNT`; `h_j(t)` is
`GDX_HNF_LATENT_VALUE.COORDINATE_VALUE` for that run, that dimension, that person.

The formula's shape is identical to `CDIx`/`CDIx_w` -- it reuses exactly the same RMS-distance
arithmetic F4 already validates -- but its content is not: `h` is a fitted, model-dependent
coordinate, never a direct observation or a direct normalization of one. `CDIh = 0` means
coincidence with the reference on every included latent dimension **of that one fitted run**;
nothing here licenses any claim about a data manifold's real curvature, psychological depth, or
physical curved space. `CDIx` and `CDIh` live in two different, generally non-comparable spaces --
this skill never computes or implies a conversion between them, and a smaller `CDIh` is never, by
itself, evidence of "better", "closer to normal" or a superior model.

## The constraint that drives this whole design: one fixed coordinate system

Re-fitting PCA, an autoencoder or UMAP on a different sample, a different `k`, or a different random
seed produces a **different** coordinate system. Two `CDIh` values computed under two different
`GDX_HNF_LATENT_RUN` rows are not directly comparable without a separate, explicit alignment and
validation procedure this skill does not implement. Every reference this skill builds is therefore
pinned to the **exact same** `ID_LATENT_RUN` as the run being evaluated -- unlike F4 (original
characteristics), whose `POPULATION_REFERENCE` basis may legitimately be sourced from a different
`GDX_HNF_FEATURE_SPACE_RUN`.

## Three reference bases (one fewer than F4's four)

### 1. `personal_baseline`

A single `GDX_HNF_LATENT_RUN` gives each person exactly **one** `h(t)` coordinate per dimension (F2
already collapsed any repeated session into a single scalar before fitting -- see its own
`SKILL.md`), so there is no "earliest `m` sessions of `h(t)`" to average inside one run the way F4
averages sessions of `z(t)`. Instead, this basis **projects** that same person's already-frozen,
original-feature-space personal baseline (an existing `GDX_HNF_CDI_REFERENCE_SET`,
`REFERENCE_TYPE='PERSONAL_BASELINE'`, built by `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`) through the
evaluated run's own fitted linear map:

```
h_ref = W^T (z_ref - mean_z)
```

the exact PCA formula F2 already fits and stores in `GDX_HNF_LATENT_LOADING`. This is only
well-defined for a `METHOD='PCA'` latent run -- an autoencoder or a UMAP embedding has no stored,
reapplicable linear map from an arbitrary reference point into `h`-space, so `personal_baseline` is
**not available** for those two methods in this schema today. This is a documented limitation, never
worked around with an invented approximation, and it is the direct integration point this layer is
required to honor rather than recompute: the personal baseline itself is never redefined here, only
re-expressed in the evaluated run's own coordinates.

### 2. `latent_cohort`

The mean of `h(t)` actually realized, dimension by dimension, across the evaluated run's own
complete-case person set -- always computed from real `GDX_HNF_LATENT_VALUE` rows, never assumed to
be exactly the zero vector (the training sample PCA centers at 0 need not equal the mean of whatever
complete-case subset a given CDI run ends up evaluating).

### 3. `population_reference`

The same mean-of-`h(t)` computation as `latent_cohort`, but over an explicitly identified, named
**subset** of the persons already embedded in that **same** run (`GDX_HNF_CDIH_REFERENCE_MEMBER`) --
one phase, one site, one stratum of the same fitted sample. Never a different `GDX_HNF_LATENT_RUN`
(see above); never silently identical to the full complete-case set, which would collapse it into
`latent_cohort` under a different label.

There is no `instrument_norm` basis here: a published instrument manual documents norms for the
instrument's own original items/scores, never for the coordinates of a model fitted inside this
project. There is no external authority to read a validated "latent norm" from, so this layer does
not invent a mechanism to hold one.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_LATENT_RUN         -> the evaluated F2 run (h(t)'s coordinate system, method, k)
GDX_HNF_LATENT_DIMENSION   -> which dimensions h_1..h_k are, and (PCA only) their explained variance
GDX_HNF_LATENT_VALUE       -> h(t): the fitted per-person, per-dimension coordinates F2 already froze
GDX_HNF_LATENT_LOADING     -> W (PCA only), reused to project an original-feature-space personal
                               baseline into this run's own coordinates
GDX_HNF_CDI_REFERENCE_SET / GDX_HNF_CDI_REFERENCE_VALUE
                            -> F4's own frozen PERSONAL_BASELINE (z_ref), for personal_baseline only
GDX_HNF_FEATURE_DICTIONARY -> feature metadata, transitively, only insofar as F2's own run already
                               resolved it
GDX_HNF_LATENT_RUN_FEATURE / GDX_HNF_FEATURE_VALUE
                            -> for personal_baseline (PCA only) ALSO read directly, for exactly one
                               purpose: reconstructing mean_z, the per-feature mean of the evaluated
                               run's own complete-case training matrix (needed by h_ref = W^T (z_ref
                               - mean_z), since GDX_HNF_LATENT_RUN.METHOD_PARAMS does not store it).
                               Never read for latent_cohort/population_reference, and never used to
                               re-derive anything F2 itself already computed.
```

This skill never reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` directly, and never re-fits a latent
representation on its own -- F2 has already done that work. "Reading the relational/BI/graph
sources" for this layer is satisfied *transitively*, through an already-run F2 latent run, exactly
the same posture F2 and F3 themselves take toward F1. If no `GDX_HNF_LATENT_RUN` exists yet for the
study, this skill has nothing to compute from and must point the user at F2 first; if
`personal_baseline` is requested against an `AUTOENCODER`/`UMAP` run, it must point the user at a
`PCA` run of the same study instead (or at `latent_cohort`/`population_reference`).

## Per-dimension traceability: the difference vector is never discarded

Same posture as F4 (original characteristics): `GDX_HNF_CDIH_VALUE` stores only the aggregate
scalar for a person, but `GDX_HNF_CDIH_VALUE_DETAIL` stores the full per-dimension difference vector
behind it (current coordinate, reference coordinate, signed difference, weight actually applied) --
summarizing a multivariate latent displacement into one scalar necessarily discards which dimension
moved and in which direction.

## Weighting (CDIh_w)

Same governance rule as F4: a weight must never be chosen simply to produce a desired `CDIh` value.
A PCA dimension's own `EXPLAINED_VARIANCE_RATIO` is a legitimate, defensible candidate weight, but it
is never defaulted automatically -- a weighted run always requires an explicit, complete weighting
decision from the user, the same discipline `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` already
enforces for `CDIx_w` via `--weights-file`.

## Missing data: complete cases only, never imputed

A person without a real `GDX_HNF_LATENT_VALUE` row on **every** dimension selected for a run, or
without a dimension present in the chosen reference set, is excluded from that run entirely
(`GDX_HNF_CDIH_RUN.INPUT_SELECTION = 'COMPLETE_CASES'`, the only value this schema allows -- same
convention as every other `GDX_HNF_*_RUN` table in this folder). Nothing here is ever imputed,
zero-filled, or defaulted.

## Database structure

`hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_CDIH_REFERENCE_SET` | 1 row per constructed latent reference | Which basis (`REFERENCE_TYPE`), pinned to one `ID_LATENT_RUN`, frozen once built |
| `GDX_HNF_CDIH_REFERENCE_VALUE` | 1 row per (reference set, latent dimension) | The frozen `h_j_ref`, its own dispersion and sample size |
| `GDX_HNF_CDIH_REFERENCE_MEMBER` | 1 row per (reference set, person) | Which persons were averaged into a `population_reference` (never needed for `latent_cohort`, which is the full complete-case set) |
| `GDX_HNF_CDIH_RUN` | 1 row per execution | Versioned run metadata: evaluated latent run, reference set, weighting, counts |
| `GDX_HNF_CDIH_RUN_DIMENSION` | 1 row per (run, latent dimension) | Which dimensions, in what order, under which weight `w_j` |
| `GDX_HNF_CDIH_VALUE` | 1 row per (run, person) | The computed `CDIh(t)`/`CDIh_w(t)` -- always real, never imputed |
| `GDX_HNF_CDIH_VALUE_DETAIL` | 1 row per (CDIh value, latent dimension) | The per-dimension difference vector behind that one scalar |

Apply this DDL once, **after**:

1. `hypotheses_non_fingo_feature_space_model_firebird25.sql` (F1),
2. `hypotheses_non_fingo_latent_representations_model_firebird25.sql` (F2), and
3. `hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql` (F4, original characteristics
   -- only its `GDX_HNF_CDI_REFERENCE_SET` table is actually referenced, by
   `GDX_HNF_CDIH_REFERENCE_SET.ID_ORIG_REFERENCE_SET`),

and only once F2 has produced at least one `GDX_HNF_LATENT_RUN` for the study (and, for
`personal_baseline`, F4 has already frozen a `PERSONAL_BASELINE` reference set for the subject in
question in the original feature space).

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_LATENT_SPACE/scripts
npm install                                                           # once, installs node-firebird
node generate_curvature_depth_index_latent.js --sample               # sanity check: the worked numeric examples, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# Latent cohort reference (needs no --subject/--orig-reference-set-id/--population-members-file):
node generate_curvature_depth_index_latent.js --study <slug> --latent-run-id <id> --reference-type latent_cohort --dry-run
node generate_curvature_depth_index_latent.js --study <slug> --latent-run-id <id> --reference-type latent_cohort

# Personal baseline (PCA runs only -- projects an existing F4-original baseline through this run's own W):
node generate_curvature_depth_index_latent.js --study <slug> --latent-run-id <id> --reference-type personal_baseline --subject <id_person> --orig-reference-set-id <id>

# Population reference (an explicitly named subset of persons already embedded in the SAME run):
node generate_curvature_depth_index_latent.js --study <slug> --latent-run-id <id> --reference-type population_reference --population-members-file ./members_example.json

# Weighted CDIh, reusing an already-built reference set instead of building a new one:
node generate_curvature_depth_index_latent.js --study <slug> --reference-set-id <id> --weighted --weights-file ./weights_example.json
```

`--latent-run-id` must be passed explicitly whenever the study has latent runs under more than one
`METHOD` (PCA/AUTOENCODER/UMAP are different, non-comparable coordinate systems) -- the script
refuses to silently pick "the latest" across them.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (423 cadets,
`ID_STUDY=1`, PCA latent run `ID_LATENT_RUN=3`, 10 dimensions, 422 complete-case persons):

- `--sample` prints the worked `CDIh`/`CDIh_w` arithmetic (identical in shape to `CDIx`), no DB.
- `latent_cohort`, real run: `ID_REFERENCE_SET=1` (10 `GDX_HNF_CDIH_REFERENCE_VALUE` rows) and
  `ID_CDIH_RUN=1` (10 `GDX_HNF_CDIH_RUN_DIMENSION`, 422 `GDX_HNF_CDIH_VALUE`, 4220
  `GDX_HNF_CDIH_VALUE_DETAIL` rows).
- `personal_baseline`, real run for the one person with both psychometric and cardiac-coherence data
  in this project (`ID_PERSON=784`), projecting F4-original's own `ID_REFERENCE_SET=2`
  (`PERSONAL_BASELINE`) through PCA run 3's loadings: `ID_REFERENCE_SET=2` (10 rows, every dimension
  projected -- this subject's F4-original baseline covers exactly the same 22 input features PCA run
  3 was fit on) and `ID_CDIH_RUN=2`. As a mathematical sanity check, person 784's own `CDIh` against
  their own projected baseline came back at `0.00000084` -- effectively zero, as expected, since this
  project's only real baseline today was built from that same person's single real administration,
  confirming the `mean_z` reconstruction and `h_ref = W^T (z_ref - mean_z)` projection are correct.
- `population_reference`, real run over an explicit 211-person subset of this run's own 422
  complete-case persons (no demographic field is populated for this legacy study today, so the test
  subset was drawn as a plain ID split rather than a real stratum -- any future real stratification
  variable plugs into the same `--population-members-file` mechanism unchanged): `ID_REFERENCE_SET=3`
  (10 rows) and `ID_CDIH_RUN=3` (422 `GDX_HNF_CDIH_VALUE` rows). Refused, as documented, when the
  file was tried with the full 422-person set instead (collapses into `latent_cohort`).
- `--weighted`, real run reusing `ID_REFERENCE_SET=1` (`latent_cohort`) with each `PCx`'s own
  `EXPLAINED_VARIANCE_RATIO` as its weight: `ID_CDIH_RUN=4`. Weights stored in
  `GDX_HNF_CDIH_RUN_DIMENSION.WEIGHT` matched the input file exactly; resulting `CDIh_w` values
  differ from `ID_CDIH_RUN=1`'s unweighted `CDIh` person by person (e.g. `ID_PERSON=788`: `1.3399`
  unweighted vs `2.2522` weighted -- that person's displacement concentrates on `PC1`, which this
  weighting emphasizes most), exactly as expected from the formula.

Every one of the three reference bases and both weighting modes is now validated against this
project's real data, not only `--sample`.

## What this skill will never do

- **Never computes `CDIx`** (the original-characteristics variant) -- that stays
  `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`'s own job.
- **Never compares two `GDX_HNF_CDIH_RUN` rows built from different `ID_LATENT_RUN` values** as if
  they shared a coordinate system.
- **Never re-fits a latent representation or re-reads the relational/BI/graph sources F1/F2 already
  consolidated.**
- **Never builds a `personal_baseline` reference against an `AUTOENCODER`/`UMAP` run** -- only
  `PCA`, because only PCA has a stored, reapplicable linear map from an arbitrary reference point
  into `h`-space.
- **Never fabricates a reference value.** A dimension with no real observation in the source run
  (`latent_cohort`/`population_reference`) or no row in the projected baseline (`personal_baseline`)
  is excluded from that reference set entirely.
- **Never defaults a weight.** A weighted run always requires an explicit, complete weighting
  decision.
- **Never imputes or zero-fills a missing value.** A person missing any final-dimension value is
  excluded from the run entirely.
- **Never updates an existing `GDX_HNF_CDIH_REFERENCE_SET` or `GDX_HNF_CDIH_RUN` in place.** A new
  reference or a new run is always a new row.
- **Never treats a `CDIh` value as evidence of causality, a clinical condition, or a validated
  correspondence to a chakra, a Thomistic Way or a septenary level.**

## Files in this skill

- `../../hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql` -- DDL for the
  seven `GDX_HNF_CDIH_*` tables this skill will read/write (must already be applied, together with
  the F1/F2/F4-original schemas and at least one F2 `GDX_HNF_LATENT_RUN` for the study, before this
  skill has anything to compute)
- `scripts/generate_curvature_depth_index_latent.js` -- resolves `--study`'s evaluated latent run,
  builds or reuses a reference set (including, for `personal_baseline`, reconstructing `mean_z` and
  projecting F4-original's own baseline through the run's PCA loadings), computes `CDIh`/`CDIh_w`
  over the complete-case (run, person) matrix, and writes the `GDX_HNF_CDIH_*` rows (Node.js +
  `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
