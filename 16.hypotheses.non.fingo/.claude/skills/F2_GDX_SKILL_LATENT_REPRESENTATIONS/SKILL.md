---
name: F2_GDX_SKILL_LATENT_REPRESENTATIONS
description: Implements this folder's F2 layer ("latent representations") on top of F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE's own output -- for a given study, maps the per-person normalized feature vector z(t) already frozen in GDX_HNF_FEATURE_VALUE (an MFS ZSCORE run) into a smaller learned vector h(t), via three concrete techniques: PCA (linear, fit directly in Node.js with ml-pca), an autoencoder (non-linear, fit via a Python subprocess using scikit-learn's MLPRegressor), and UMAP (non-linear, neighborhood-preserving, fit via the same Python subprocess using the real umap-learn package). Writes GDX_HNF_LATENT_RUN/GDX_HNF_LATENT_RUN_FEATURE/GDX_HNF_LATENT_DIMENSION/GDX_HNF_LATENT_VALUE/GDX_HNF_LATENT_LOADING (hypotheses_non_fingo_latent_representations_model_firebird25.sql, this folder) via scripts/generate_latent_representations.js --study <slug> --method pca|autoencoder|umap. autoencoder/umap need Python 3 with requirements.txt installed (scripts/fit_latent.py) -- see "Current status" below. Use when the user asks to reduce dimensionality, compute a latent space, run PCA/an autoencoder/UMAP, or build a learned representation for a GDX_HUMAN study.
---

# F2_GDX_SKILL_LATENT_REPRESENTATIONS

Implements **F2** -- this folder's second step in its own multidimensional feature-space
mathematical model, built directly on top of what **F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE**
(MFS, this folder's F1 skill) already produced. Where F1 assembles and z-score-normalizes a
per-person feature vector, F2 maps that normalized vector into a smaller, *learned* vector:

```
h(t) = f_theta( z(t) ),     f_theta : R^n -> R^k
```

- `z(t)` -- the per-person normalized feature vector F1 already froze into
  `GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE` for one `ZSCORE` run (`n` input features).
- `h(t)` -- the learned, lower-dimensional representation this skill fits and writes (`k` latent
  dimensions, `k << n`).
- `f_theta` -- the fitted mapping, one of three concrete techniques below. "Latent" here only means
  the components are *derived by a model*, not directly measured as original variables -- it carries
  no further claim.

Fewer dimensions does not automatically mean a better or more valid representation: information
relevant to the actual research question can be discarded in the process. Which technique is
appropriate, and how many dimensions to keep, is a modeling choice the skill records (`METHOD`,
`LATENT_DIMENSION_COUNT`, `METHOD_PARAMS`), never one it makes silently.

## The three techniques

All three share the exact same `GDX_HNF_LATENT_RUN` / `GDX_HNF_LATENT_DIMENSION` /
`GDX_HNF_LATENT_VALUE` shape -- only `GDX_HNF_LATENT_LOADING` is method-specific (PCA only, see
below).

### 1. PCA (linear)

```
h = W^T (z - mean_z),     W^T W = I
```

`W`'s columns are the directions of maximum preserved variance under PCA's own orthogonality
constraint. This is the one technique with a real, fixed per-feature linear coefficient per latent
dimension -- `GDX_HNF_LATENT_LOADING` stores exactly that `W` matrix, and
`GDX_HNF_LATENT_DIMENSION.EXPLAINED_VARIANCE_RATIO` the share of variance each component
preserves. A PCA run's result still depends on the training sample, the normalization already
applied in F1, and the chosen `k` -- a component with a large loading on some feature has no
intrinsic interpretation on its own; naming it is a separate analysis this skill never performs.

### 2. Autoencoder (non-linear)

```
h = f_theta(z) ;   z_hat = g_phi(h) ;   L = (1/N) * sum_i || z_i - z_hat_i ||^2
```

An encoder `f_theta` and a decoder `g_phi`, trained to minimize mean squared reconstruction error
`L` (`GDX_HNF_LATENT_RUN.RECONSTRUCTION_LOSS`). Unlike PCA, there is no fixed per-feature
coefficient per latent dimension to store -- `GDX_HNF_LATENT_LOADING` is never populated for an
`AUTOENCODER` run. An autoencoder can learn genuinely non-linear structure, but can also overfit
small samples and produce distances in `h` with no stable meaning; results depend on architecture,
regularization, the train/test split, and data volume -- all recorded in `METHOD_PARAMS` for
traceability, never silently defaulted without being written down.

Fit by `scripts/fit_latent.py` (a Python subprocess, see "Current status" below): a symmetric
encoder/decoder built from a single `scikit-learn` `MLPRegressor` (`input -> hidden -> bottleneck(k)
-> hidden -> input`, `tanh` activation, trained with an identity reconstruction target `X -> X`).
`MLPRegressor` has no public "encode only" method, so `fit_latent.py` reads out `h` by
re-running the model's own learned first two layers (same weights, same activation) by hand after
training. `tanh`, not the more common `relu`, specifically because a `relu` bottleneck can collapse
into dead units stuck at exactly 0 for every sample (reproduced on this project's own test data
before the fix) and one-sidedly restricts every latent coordinate to be non-negative; `tanh` stays
bounded, keeps both signs, and does not collapse the same way.

### 3. UMAP (non-linear, neighborhood-preserving)

A non-linear projection that preserves local neighborhood structure, typically fit to `k=2` for
visualization (and this skill's own default `--dims` for `--method umap`, see "Options" below).
Like the autoencoder, it has no fixed per-feature linear coefficient -- `GDX_HNF_LATENT_LOADING` is
never populated for a `UMAP` run either. Global distances between clusters in a UMAP projection can
be distorted relative to the original space; this skill never infers or records a cluster label or
an inter-cluster distance claim on its own -- that is a separate, later analysis (outside F2's own
scope) if the user asks for it. A PCA run, an autoencoder run, and a UMAP run of the same input are
three independent, non-interchangeable representations -- never merged or compared as if they were
the same space.

Fit by the same `scripts/fit_latent.py` subprocess, via the real `umap-learn` package -- never
approximated with t-SNE, PCA, or anything else filed under the `UMAP` method label.
`n_neighbors` must be smaller than the complete-case person count; when not pinned with
`--umap-n-neighbors`, `fit_latent.py` uses `umap-learn`'s own documented default (15), capped down
to fit the run's own sample size.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_FEATURE_SPACE_RUN  -> the input F1 run (must be NORMALIZATION_METHOD='ZSCORE')
GDX_HNF_FEATURE_VALUE      -> z(t): the normalized per-person, per-feature values already frozen by MFS
GDX_HNF_FEATURE_DICTIONARY -> feature metadata (name, type), to decide eligibility and label GDX_HNF_LATENT_LOADING rows
```

This skill never reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` directly. MFS already read every one of those
sources, resolved which features are in scope for a study, and froze the resulting `z(t)` into
`GDX_HNF_FEATURE_VALUE` -- re-reading the lower-level sources here would duplicate that work and
risk silently drifting from what F1 actually used. "Reading the relational/BI/graph sources" for F2
is satisfied *transitively*, through an already-run F1 `ZSCORE` run -- if no such run exists for the
study yet, this skill has nothing to compute from and must point the user at MFS first, exactly the
same posture `F1_GDX_SKILL_MFS_GRAPH` (this folder's chart skill) already takes toward MFS.

## Turning F1's per-(person, feature, session) grain into one row per person

PCA, an autoencoder and UMAP all require exactly one fixed-length vector per training sample
(person). Most F1 features are already one row per (person, feature) -- but a physiological
feature can have several `GDX_HNF_FEATURE_VALUE` rows per (person, feature) when a person has
multiple cardiac-coherence sessions (F1's own sparse-Phi grain, one row per real session). Before
fitting any of the three methods, this skill reduces that to a single scalar per (person, feature):
the mean of that person's own `NORMALIZED_VALUE` rows for that feature within the chosen F1 run --
the same averaging principle MFS itself already applies one level down (averaging a session's own
HRV windows). This reduction happens in the compute script; it is not represented as its own table
(see the DDL file's own header for the full rationale).

## Missing data: complete cases only, never imputed

A person missing a non-missing value on **any** feature selected for a given latent run is excluded
from that run entirely (`GDX_HNF_LATENT_RUN.INPUT_SELECTION = 'COMPLETE_CASES'`, the only value
this schema ever allows -- see its `CHECK` constraint). Per this repo's own rule against inventing
missing data, nothing here is ever mean-imputed, zero-filled, or otherwise fabricated to keep a
person in the matrix. Which persons were dropped, and which candidate features were excluded before
fitting (e.g. a `NOMINAL`-scale feature, which none of these three techniques take sensible numeric
input from), is reported in that run's own `NOTES`, never left unexplained.

## Dimension labels stay neutral

Every `GDX_HNF_LATENT_DIMENSION.DIMENSION_LABEL` this skill writes is a neutral, ordinal, strictly
machine-generated label (`PC1`, `LATENT_2`, `UMAP_1`, ...) -- never a semantic name ("Resilience
factor") assigned without a separate, explicit validating analysis. A component standing out on one
feature is not, by itself, evidence that the component *is* that construct.

## Database structure

`hypotheses_non_fingo_latent_representations_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_LATENT_RUN` | 1 row per execution | Versioned run metadata: input F1 run, method, `k`, hyperparameters, headline fit diagnostics |
| `GDX_HNF_LATENT_RUN_FEATURE` | 1 row per (run, input feature) | Which features actually formed `z`'s `n` input columns, and in what order |
| `GDX_HNF_LATENT_DIMENSION` | 1 row per (run, output dimension) | One row per `h_1..h_k`; `EXPLAINED_VARIANCE_RATIO` populated for PCA only |
| `GDX_HNF_LATENT_VALUE` | 1 row per (dimension, person) | The fitted `h_k(person)` coordinate -- always real, never imputed |
| `GDX_HNF_LATENT_LOADING` | 1 row per (dimension, input feature) | The fitted `W` matrix entry -- PCA only, never populated for AUTOENCODER/UMAP |

Apply this DDL once (after `hypotheses_non_fingo_feature_space_model_firebird25.sql`, this
folder's F1 schema) before this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F2_GDX_SKILL_LATENT_REPRESENTATIONS/scripts
npm install                                                            # once, installs ml-pca + node-firebird
python -m pip install -r ../requirements.txt                              # once, only needed for --method autoencoder/umap
node generate_latent_representations.js --sample --dims 2                 # sanity check: embedded synthetic data, no DB/Python, prints the PCA fit, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_latent_representations.js --study <slug> --feature "PSY.VAR." --dry-run                     # real run: PCA, logs everything, writes nothing
node generate_latent_representations.js --study <slug> --feature "PSY.VAR."                                 # real run: fits PCA and writes the GDX_HNF_LATENT_* rows
node generate_latent_representations.js --study <slug> --feature "PSY.VAR." --method autoencoder --dry-run  # real run: autoencoder, writes nothing
node generate_latent_representations.js --study <slug> --feature "PSY.VAR." --method autoencoder            # real run: fits the autoencoder (Python subprocess) and writes the rows
node generate_latent_representations.js --study <slug> --feature "PSY.VAR." --method umap                   # real run: fits UMAP (Python subprocess, k=2 by default) and writes the rows
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug MFS/`F1_GDX_SKILL_MFS_GRAPH` use.
- `--method pca` (default) | `autoencoder` | `umap`.
- `--dims <k>` number of components/dimensions to keep. Default `min(10, usable feature count,
  complete-case person count - 1)` for `pca`/`autoencoder`; `min(2, that same ceiling)` for `umap`
  (2D is the standard UMAP visualization target). Must fall within that ceiling if passed explicitly,
  regardless of method.
- `--run-id <id>` fit on a specific input `GDX_HNF_FEATURE_SPACE_RUN.ID_RUN` instead of the latest
  `ZSCORE` run for the study.
- `--feature <text>` only input features whose `FEATURE_CODE` contains this text (case-insensitive).
  **Recommended today**: this project currently has real cardiac-coherence data for only one person
  study-wide, so a run that mixes the psychometric and physiological perspectives together collapses
  `COMPLETE_CASES` down to that one person (or zero); `--feature "PSY.VAR."` scopes a run to the
  psychometric perspective only, where complete-case coverage is near-total.
- `--random-seed <n>` default `42`. Passed to the autoencoder's weight initialization/training and to
  UMAP's own stochastic layout; ignored for `--method pca` (deterministic SVD -- `RANDOM_SEED` stays
  `NULL` for a PCA run).
- `--autoencoder-max-iter <n>` default `2000`. `--method autoencoder` only.
- `--umap-n-neighbors <n>` optional. `--method umap` only; default: `fit_latent.py`'s own default
  (15), capped to this run's own complete-case person count.
- `--umap-min-dist <d>` default `0.1`. `--method umap` only.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (candidates, exclusions, usable features, complete-case persons,
  explained variance/reconstruction loss where applicable) and logs it, writing no row.
- `--sample` fits PCA on small, explicitly-labeled synthetic data (two correlated feature pairs)
  instead of connecting to Firebird, and only ever prints the result -- it never writes to the
  database, since fabricated sample ids have no real `GDX_PSY_PERSON`/`GDX_HNF_FEATURE_SPACE_RUN`
  row to point at. `--sample` only exercises `--method pca` (no Firebird/Python involved) -- use
  `--dry-run` against a real `--study` to exercise `autoencoder`/`umap`.

## Current status

**All three methods are implemented.**

- `--method pca` -- fit directly in `scripts/generate_latent_representations.js` with the `ml-pca`
  package's SVD method (pure JavaScript, no native dependency, no subprocess -- same posture as this
  project's `node-firebird` usage elsewhere). Centers each run's own complete-case submatrix (its
  mean is generally not exactly 0, even though every input column is already a z-score, because
  complete-case filtering can drop a different subset of persons per feature) and does **not**
  rescale again (F1 already standardized every input column; rescaling a second time here would
  double-normalize).
- `--method autoencoder` and `--method umap` -- fit by spawning `scripts/fit_latent.py` as a
  subprocess (Python 3 + the packages in `requirements.txt`: `numpy`, `scikit-learn` for the
  autoencoder, also `umap-learn` for UMAP). `generate_latent_representations.js` writes the
  already-built input matrix to the subprocess's stdin as JSON and reads the fitted scores back
  from its stdout as JSON -- `fit_latent.py` never touches the database itself, so every
  `GDX_HNF_LATENT_*` write still happens in exactly one place (the Node.js script). This follows
  the same `Node.js + Python` pattern this repo's own `CLAUDE.md` already describes for
  `2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/
  generate_load_scripts.py`. The Python interpreter defaults to `python` on `PATH`; override with
  the `PYTHON_BIN` environment variable if that is not the right one (see `.env.example`).

Validated end-to-end against this project's own study 1 (423 participants, `--feature "PSY.VAR."`,
422 complete-case persons): PCA (`ID_LATENT_RUN=3`, 10 components, 80.07% cumulative explained
variance), the autoencoder (`ID_LATENT_RUN=4`, 10 dimensions, reconstruction loss 4.63, architecture
`22-16-10-16-22`), and UMAP (`ID_LATENT_RUN=5`, 2 dimensions, `n_neighbors=15`) all produced real,
non-degenerate rows across every `GDX_HNF_LATENT_*` table.

## Files in this skill

- `../../hypotheses_non_fingo_latent_representations_model_firebird25.sql` -- DDL for the five
  `GDX_HNF_LATENT_*` tables this skill reads/writes (must already be applied, and MFS must already
  have produced a `ZSCORE` run for the study, before this skill has anything to compute)
- `scripts/generate_latent_representations.js` -- resolves `--study`'s input run, selects eligible
  features, reduces F1's grain to one row per person, fits the chosen method (PCA directly via
  `ml-pca`; autoencoder/UMAP by spawning `fit_latent.py`), and writes the `GDX_HNF_LATENT_*` rows
  (Node.js + `node-firebird` + `ml-pca`, no native client library required)
- `scripts/fit_latent.py` -- the Python subprocess fitter for `--method autoencoder`/`--method umap`
  (`scikit-learn`'s `MLPRegressor` for the autoencoder, `umap-learn` for UMAP) -- a pure numeric
  fitter communicating over stdin/stdout JSON, never reads or writes the database itself
- `scripts/package.json`
- `../requirements.txt` -- Python dependencies for `fit_latent.py` (`python -m pip install -r
  requirements.txt`); not needed at all for `--method pca`
- `.env.example` -- connection variable template (no secrets) plus the optional `PYTHON_BIN` override
- `SKILL.md` -- this file
