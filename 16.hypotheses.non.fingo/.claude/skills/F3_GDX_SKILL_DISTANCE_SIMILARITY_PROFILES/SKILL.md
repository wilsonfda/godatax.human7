---
name: F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES
description: Implements this folder's F3 layer ("distance and similarity between profiles") on top of F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE's and F2_GDX_SKILL_LATENT_REPRESENTATIONS's own output -- for a given study, computes the pairwise distance between every pair of persons' own profile vectors (F1's normalized z(t) frozen in GDX_HNF_FEATURE_VALUE, or F2's learned h(t) frozen in GDX_HNF_LATENT_VALUE), under three metrics: the ordinary Euclidean distance, the RMS distance (Euclidean divided by sqrt(n)), and the Mahalanobis distance (covariance-aware, regularized when the covariance estimate is ill-conditioned). Writes GDX_HNF_DISTANCE_RUN/GDX_HNF_DISTANCE_DIMENSION/GDX_HNF_DISTANCE_COVARIANCE/GDX_HNF_DISTANCE_VALUE (hypotheses_non_fingo_distance_similarity_model_firebird25.sql, this folder) via scripts/generate_distance_similarity_profiles.js --study <slug> [--space feature|latent] [--metric euclidean|rms|mahalanobis|all]. Use when the user asks to compute distance/similarity between participants' profiles, a distance matrix, or Euclidean/RMS/Mahalanobis distance for a GDX_HUMAN study. Does NOT compute a reference-baseline deviation index (a later, separate skill).
---

# F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES (F3)

Implements **F3** -- this folder's third step in its own multidimensional feature-space
mathematical model, built directly on top of what **F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE**
(MFS, F1) and, optionally, **F2_GDX_SKILL_LATENT_REPRESENTATIONS** (F2) already produced. Where F1
assembles and normalizes a per-person feature vector and F2 optionally maps it into a smaller
learned vector, F3 answers a single question: **how far apart are two observed profiles?**

For any two vectors `u` and `v` of the same dimension `n`:

```
dE(u,v)   = sqrt( sum_j=1..n (u_j - v_j)^2 )                       Euclidean (ordinary)
dRMS(u,v) = sqrt( (1/n) * sum_j=1..n (u_j - v_j)^2 ) = dE(u,v)/sqrt(n)     RMS
dM(u,v)   = sqrt( (u - v)^T * Sigma^-1 * (u - v) )                   Mahalanobis
```

- `dE` depends only on coordinates, units and scale -- never on an interpretive category. It
  grows with both the number and the magnitude of per-dimension deviations.
- `dRMS` divides the same sum of squared deviations by `n` before the square root. For a fixed
  `n` this changes only the scale, never the ordering of distances within one run -- the same
  rescaling a later, separate skill (a reference-baseline deviation index) will build directly on
  top of `dRMS`, but **this skill never computes that index itself** -- see "What this skill will
  never do" below.
- `dM` reweights and rotates the space using the covariance `Sigma` of the dimensions being
  compared, so that two strongly correlated dimensions do not get counted as if they were two
  independent directions. `Sigma` is estimated from this run's own complete-case sample and can be
  unstable or singular when there are few persons relative to the number of dimensions -- see
  "Mahalanobis and regularization" below.

This skill computes **all three** of the above by default (`--metric all`) for one input run, each
written as its own independent `GDX_HNF_DISTANCE_RUN`.

## What it reads -- and deliberately does NOT re-read

```
--space feature (default):
  GDX_HNF_FEATURE_SPACE_RUN   -> the input F1 run (must be NORMALIZATION_METHOD='ZSCORE')
  GDX_HNF_FEATURE_VALUE       -> z(t): the normalized per-person, per-feature values F1 froze
  GDX_HNF_FEATURE_DICTIONARY  -> feature metadata, to decide eligibility and label dimensions

--space latent:
  GDX_HNF_LATENT_RUN          -> the input F2 run (a specific method: PCA/AUTOENCODER/UMAP)
  GDX_HNF_LATENT_DIMENSION    -> which h_1..h_k dimensions compose the compared vectors
  GDX_HNF_LATENT_VALUE        -> h(t): the learned per-person coordinates F2 froze
```

This skill never reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` directly, and never fits a latent
representation on its own. F1 (and, for `--space latent`, F2) has already read every one of those
sources (or already fitted `h(t)`) and frozen the result -- re-reading the lower-level sources
here would duplicate that work and risk silently drifting from what F1/F2 actually used.
"Reading the relational/BI/graph sources" for F3 is satisfied *transitively*, through an
already-run F1 `ZSCORE` run (and, optionally, an already-run F2 latent run) -- same posture
`F2_GDX_SKILL_LATENT_REPRESENTATIONS`'s own `SKILL.md` already takes one layer down. If neither
exists yet for the study, this skill has nothing to compare and must point the user at MFS (and,
for `--space latent`, at F2) first.

## Distance is between profiles, never against a fixed reference

F3 ("distance and similarity between profiles") computes the pairwise distance between every two
**observed** persons' own profiles within one run's complete-case sample. It deliberately never
computes a distance against a single, fixed reference baseline (an individual's own earlier
session, a population mean, a normative anchor) -- defining "the center" a distance is measured
from is a materially different, more consequential design decision that belongs to its own,
separate skill and its own schema, not folded into this one. This skill's own three distance
formulas (`dE`, `dRMS`, `dM`) are exactly the building blocks that later skill would reuse, applied
here between pairs of real, observed profiles instead.

## Turning F1's per-(person, feature, session) grain into one row per person

Identical reduction to F2's own script, one level down: a physiological feature can have several
`GDX_HNF_FEATURE_VALUE` rows per (person, feature) when a person has multiple cardiac-coherence
sessions. Before computing any distance, `--space feature` reduces that to a single scalar per
(person, feature) -- the mean of that person's own `NORMALIZED_VALUE` rows for that feature within
the chosen F1 run. `--space latent` needs no such reduction: F2 already wrote exactly one
coordinate per (dimension, person).

## Missing data: complete cases only, never imputed

A person missing a non-missing value on **any** dimension selected for a given distance run is
excluded from that run entirely (`GDX_HNF_DISTANCE_RUN.INPUT_SELECTION = 'COMPLETE_CASES'`, the
only value this schema ever allows). Per this repo's own rule against inventing missing data,
nothing here is ever mean-imputed, zero-filled, or otherwise fabricated to keep a person in the
comparison set. Which dimensions/persons were excluded, and why, is reported in that run's own
`NOTES`, never left unexplained.

## Mahalanobis and regularization

`Sigma`, the covariance matrix used by `dM`, is estimated from the **same** complete-case sample a
run's pairwise distances are computed over (the unbiased sample covariance, divisor
`person_count - 1`) -- never from an external population, and never re-estimated per pair. A
covariance matrix estimated from few persons relative to the number of dimensions can be singular
or near-singular, making its naive inverse numerically meaningless.

`--covariance-regularization auto` (the default) estimates the **condition number** of the raw
`Sigma` (via SVD, `max singular value / min singular value`) and, only when it exceeds `1e8`,
applies diagonal shrinkage before inverting:

```
Sigma_reg = (1 - lambda) * Sigma + lambda * diag(diag(Sigma))     lambda in [0,1], default 0.1
```

`lambda = 0` leaves `Sigma` untouched; `lambda = 1` zeroes every off-diagonal entry (equivalent to
a per-dimension-weighted Euclidean distance). `--covariance-regularization none|shrinkage` forces
that choice regardless of the condition number; `--lambda <0..1>` overrides the default weight when
shrinkage is (or becomes) active. `GDX_HNF_DISTANCE_RUN.CONDITION_NUMBER_BEFORE_REG`/
`CONDITION_NUMBER_AFTER_REG` are recorded for every Mahalanobis run as a diagnostic, never used to
silently alter a distance value after the fact -- a human auditing a Mahalanobis run can see
exactly how ill-conditioned the raw estimate was. The raw `Sigma` and the (possibly regularized)
`Sigma^-1` actually used are both stored in full (`GDX_HNF_DISTANCE_COVARIANCE`, upper triangle),
so a Mahalanobis run's own distances can be recomputed/audited without re-deriving `Sigma` from the
raw per-person values again.

## Distance is not causality, proximity is not a metaphysical claim

Per this project's `CLAUDE.md` ("Empirical finding != interpretive reading"): two profiles being
close under any of these three metrics is a purely geometric/statistical fact about the chosen
coordinates, units and scale. It is never, by itself, evidence of a causal mechanism, a shared
condition, or a correspondence to a chakra, a Thomistic Way or a septenary level -- and it is never
a clinical or diagnostic conclusion. This skill's own `NOTES` on every run restate this explicitly.

## Database structure

`hypotheses_non_fingo_distance_similarity_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_DISTANCE_RUN` | 1 row per execution | Versioned run metadata: input F1/F2 run, metric, dimension/person/pair counts, Mahalanobis regularization diagnostics |
| `GDX_HNF_DISTANCE_DIMENSION` | 1 row per (run, dimension) | Which feature (F1) or latent dimension (F2) occupies position `j` of the compared vectors, and in what order |
| `GDX_HNF_DISTANCE_COVARIANCE` | 1 row per (run, `i<=j`) | The raw `Sigma_ij` and the (possibly regularized) `Sigma^-1_ij` -- Mahalanobis runs only |
| `GDX_HNF_DISTANCE_VALUE` | 1 row per (run, unordered person pair) | The computed `d(u,v)` -- always real, never imputed |

Apply this DDL once (after `hypotheses_non_fingo_feature_space_model_firebird25.sql`, and, if
`--space latent` will be used, also after `hypotheses_non_fingo_latent_representations_model_
firebird25.sql`, both this folder) before this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES/scripts
npm install                                                            # once, installs ml-matrix + node-firebird
node generate_distance_similarity_profiles.js --sample                # sanity check: embedded synthetic profiles, no DB, prints all 3 metrics, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_distance_similarity_profiles.js --study <slug> --feature "PSY.VAR." --dry-run             # real run: all 3 metrics over F1's own z(t), logs everything, writes nothing
node generate_distance_similarity_profiles.js --study <slug> --feature "PSY.VAR."                         # real run: writes 3 GDX_HNF_DISTANCE_RUN rows (euclidean, rms, mahalanobis)
node generate_distance_similarity_profiles.js --study <slug> --metric mahalanobis --feature "PSY.VAR."     # real run: Mahalanobis only
node generate_distance_similarity_profiles.js --study <slug> --space latent --latent-method pca           # real run: all 3 metrics over F2's own PCA h(t) instead
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug MFS/F2 use.
- `--space feature` (default) | `latent`. `feature` compares F1's own normalized `z(t)`; `latent`
  compares F2's own learned `h(t)` for one specific latent run.
- `--metric euclidean | rms | mahalanobis | all` (default `all`) -- which of the three metrics to
  compute and write in this invocation. Each writes its own independent `GDX_HNF_DISTANCE_RUN`.
- `--run-id <id>` optional. `--space feature`: a specific `GDX_HNF_FEATURE_SPACE_RUN.ID_RUN`
  (must be `ZSCORE`) instead of the study's latest. `--space latent`: a specific
  `GDX_HNF_LATENT_RUN.ID_LATENT_RUN` instead of the study's latest (optionally narrowed further by
  `--latent-method`).
- `--feature <text>` `--space feature` only. Only input features whose `FEATURE_CODE` contains
  this text (case-insensitive) are candidates. **Recommended today**: `--feature "PSY.VAR."` scopes
  a run to the psychometric perspective only, same recommendation and same reason as F2 (this
  project currently has real cardiac-coherence data for only one person study-wide, so mixing
  perspectives collapses `COMPLETE_CASES` down to very few persons).
- `--latent-method pca|autoencoder|umap` `--space latent` only. Narrows which `GDX_HNF_LATENT_RUN`
  is "the study's latest" when `--run-id` is not given.
- `--dims <k>` `--space latent` only. Use only the first `k` latent dimensions (by
  `DIMENSION_ORDER`) instead of all of them.
- `--covariance-regularization auto|none|shrinkage` (default `auto`) `--metric mahalanobis`
  (including when included via `--metric all`) only -- see "Mahalanobis and regularization" above.
- `--lambda <0..1>` optional. Shrinkage weight when regularization is (or becomes)
  `SHRINKAGE_DIAGONAL`. Default when auto-triggered: `0.1`.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (usable dimensions, complete-case persons, pair count, Mahalanobis
  condition number/regularization choice) and logs it, writing no row.
- `--sample` computes all three metrics on four small, explicitly-labeled synthetic profiles
  instead of connecting to Firebird, and only ever prints the result -- never writes to the
  database (there is no real `GDX_PSY_PERSON`/`GDX_HNF_FEATURE_SPACE_RUN` for fabricated sample ids
  to point at).

## Performance note

A distance run writes one `GDX_HNF_DISTANCE_VALUE` row per unordered pair of complete-case
persons -- `person_count * (person_count - 1) / 2` rows. For a full-study run with several hundred
participants this is tens of thousands of rows per metric; narrowing `--feature`/`--dims` (fewer
usable dimensions admits more complete cases, not fewer) does not reduce `PAIR_COUNT` on its own,
only the study's own participant count does. Validated end-to-end against this project's own study
1 (422 complete-case persons, 22 psychometric dimensions, 88,831 pairs): each metric -- EUCLIDEAN,
RMS, MAHALANOBIS -- took **~3 minutes** on its own (one Firebird round trip per inserted row, same
per-row-insert pattern F1/F2 already use), so a full `--metric all` run took about 9 minutes
end-to-end. Use `--dry-run` first to see the exact `PAIR_COUNT` before committing to a real write,
and expect roughly 3 minutes per metric per ~90,000 pairs as a rule of thumb for a different
study's participant count.

## What this skill will never do

- **Never re-reads the relational/BI/graph sources F1 already consolidated, and never re-fits a
  latent representation** -- it only ever compares vectors F1/F2 already produced.
- **Never computes a distance against a fixed reference baseline** (individual, populational or
  normative) -- that is a later, separate skill's own, more consequential design decision.
- **Never imputes or zero-fills a missing value.** A person missing any selected dimension is
  excluded from that run entirely.
- **Never updates an existing `GDX_HNF_DISTANCE_RUN` in place.** A new run is always a new row.
- **Never treats proximity/distance as evidence of causality, a shared condition, or a validated
  metaphysical correspondence.**

## Files in this skill

- `../../hypotheses_non_fingo_distance_similarity_model_firebird25.sql` -- DDL for the four
  `GDX_HNF_DISTANCE_*` tables this skill reads/writes (must already be applied, and MFS -- and, for
  `--space latent`, F2 -- must already have produced a run for the study, before this skill has
  anything to compute)
- `scripts/generate_distance_similarity_profiles.js` -- resolves `--study`'s input run, builds the
  complete-case (person, dimension) matrix, computes the requested metric(s) pairwise across every
  person, and writes the `GDX_HNF_DISTANCE_*` rows (Node.js + `node-firebird` + `ml-matrix`, no
  native client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
