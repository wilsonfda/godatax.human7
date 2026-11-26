---
name: F5_GEOMETRIC_CURVATURE
description: Implements this folder's F5 layer on top of F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's and F4_CURV_DEPTH_KPI_LATENT_SPACE's own output -- for a given study, answers "is the Curvature Depth Index a geometric curvature?" by separating what is actually computable from what is not. Two real, explicit transforms of an already-frozen CDIx/CDIh value, the parameter always explicit and never defaulted: (1) linear visual-depth rescaling, profundidade_visual(t) = a * CDI(t), a > 0, written to GDX_HNF_VISDEPTH_RUN/GDX_HNF_VISDEPTH_VALUE; (2) the Gaussian dip curve, y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), sigma > 0, written to GDX_HNF_DEPTHCURVE_RUN/GDX_HNF_DEPTHCURVE_VALUE (storing only CURVE_MIN_VALUE = -CDI(t), the one point the curve's own formula actually determines, plus sigma -- never a sampled curve). Both DDLs live in hypotheses_non_fingo_geometric_curvature_model_firebird25.sql (this folder), via scripts/generate_geometric_curvature.js --study <slug> --source-kind cdix|cdih (--gain <a> | --sigma <s>). Never computes a true Riemannian scalar curvature R(h) -- no manifold/metric/connection is defined anywhere in this project's own pipeline, and both runs' own SCALAR_CURVATURE_COMPUTED column is schema-CHECKed to always equal 0, with a mandatory SCALAR_CURVATURE_SCOPE_NOTE explaining why. Use when the user asks about visual/graphic depth derived from a CDI, a Gaussian dip/well curve from a CDI, whether the CDI is a curvature, or the geometric-curvature caution for a GDX_HUMAN study. Does NOT recompute CDIx/CDIh itself (those stay F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's and F4_CURV_DEPTH_KPI_LATENT_SPACE's own jobs) and does NOT fabricate a scalar curvature.
---

# F5_GEOMETRIC_CURVATURE

Implements this folder's **F5** layer: the question this project's own design discussion raises
right after building the Curvature Depth Index -- **is this a geometric curvature?** -- and this
layer's own, structural answer: **part of it is real and computable, part of it deliberately is
not, and the schema itself keeps that distinction visible.**

## Three things this layer is explicit about never conflating

### 1. Visual depth (linear rescaling) -- real, computed here

```
profundidade_visual(t) = a * CDI(t),   a > 0
```

`a` is a **graphic gain**, not a physical constant -- it only controls how much a drawing's depth
grows per unit of an already-frozen CDI (`CDIx` from `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`, or
`CDIh` from `F4_CURV_DEPTH_KPI_LATENT_SPACE`). This is well-defined and computable from data this
project already has -- an explicit linear transform of an explicit, real number -- so this skill
computes it, for real, into `GDX_HNF_VISDEPTH_RUN`/`GDX_HNF_VISDEPTH_VALUE` (`--gain`).

`a` is **always explicit** -- this skill never defaults it, the same governance posture this
folder's own `GDX_HNF_CDI_RUN_FEATURE.WEIGHT` already takes toward `CDIx_w`'s weights ("a weight
must never be chosen simply to produce a desired CDI value"). A larger or smaller `a` never
changes which profile is closer to or farther from its own reference -- it only changes how the
drawing looks.

### 2. The Gaussian dip curve -- real, computed here

```
y(s) = -CDI(t) * exp( -s^2 / (2*sigma^2) ),   sigma > 0
```

`s` is the curve's own drawing coordinate -- a horizontal position along the illustration, never
a real measured dimension of any person. `sigma` is a **width design choice**, exactly as
graphic as `a` above. The document's own worked illustration: participant `#784`, `CDIx(t) =
0.8`, plotted as `y(s) = -0.8 * exp(-s^2/2)` -- "isso produz uma depressão visual cujo ponto mais
profundo corresponde a -0,8" ("this produces a visual depression whose deepest point equals
-0.8"). Two separate operations, explicit in the document itself:

1. **Cálculo do CDI** -- `CDIx(t) = sqrt( (1/n) * sum_j (z_j(t)-z_j_ref)^2 )` -- already computed
   and frozen one layer down; never recomputed here.
2. **Representação gráfica do CDI** -- `y(s)` above -- an illustrative curve shape, never a
   measurement, never a curvature.

**Why only `CURVE_MIN_VALUE` is stored, never a sampled curve:** `y(0) = -CDI(t)` is the *only*
point the formula lets a real number determine -- `exp(0) = 1` regardless of `sigma`. `sigma`
only changes how *wide* the dip looks away from that one point; it changes no real quantity. So
`GDX_HNF_DEPTHCURVE_VALUE` stores exactly the two real/parametric inputs that fully determine the
curve for a person -- the run's own `CURVE_SIGMA` (shared) and that person's own real, negated
CDI (`CURVE_MIN_VALUE`) -- and nothing else. Sampling `y(s)` across a grid of `s` to actually draw
the dip is a lightweight, deterministic, non-persisted computation left to a rendering step, same
posture every GRAPH skill in this folder already takes toward its own render-time-only
statistics.

### 3. Scalar Riemannian curvature -- never computed here

```
R(h) = g^(ab)(h) * R_(ab)(h)
```

(`R`: scalar curvature; `g^(ab)`: inverse metric components; `R_(ab)`: Ricci tensor) is
established mathematics -- but applying it to this project's own feature/latent space would
require choosing coordinates, estimating a local structure **and** metric, defining the
regularity of a differentiable manifold, and validating the statistical stability of all of
that. **None of this project's own pipeline (F1-F4, F4_REFERENCE_PROFILES) defines or fits any of
that.** Training an autoencoder (F2's own latent space) does not automatically hand back an
interpretable scalar curvature. Computing `R(h)` here without a defined manifold/metric/
connection would be exactly the kind of fabricated number this project's own "never invent
missing data" rule forbids, dressed up as a sophisticated formula.

Instead of silently omitting this, the schema makes the refusal **structural and permanent**, for
**both** run tables: `GDX_HNF_VISDEPTH_RUN.SCALAR_CURVATURE_COMPUTED` and `GDX_HNF_DEPTHCURVE_RUN.
SCALAR_CURVATURE_COMPUTED` each carry a `CHECK` that it always equals `0`, and
`SCALAR_CURVATURE_SCOPE_NOTE` is a mandatory, non-empty column this skill always fills with a
fixed explanation (worded per mode). A human reading one run's own row never has to take an
absent column as evidence curvature "was probably computed somewhere else" -- the row itself says
it was not, and why.

## Why the separation matters (the Einstein-analogy caution)

A "deeper visual well" drawn from a larger CDI is a controlled graphic encoding, not evidence of
curved space, consciousness, spiritual energy, or any equivalence between this project's
statistical feature space and general relativity's physical space-time. The analogy (geodesic,
curvature, "energy" carried from physics into this project's own vocabulary) is useful for
imagining states and trajectories, but becomes misleading the moment it implies a causal or
ontological equivalence it cannot support. This skill's own job is to make exactly the computable
half of that picture real and auditable, while making the other half impossible to silently claim
as done.

## Two CDI source kinds -- never a third, invented one

- **`cdix`** -- reads `GDX_HNF_CDI_RUN`/`GDX_HNF_CDI_VALUE` (original characteristics,
  `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`).
- **`cdih`** -- reads `GDX_HNF_CDIH_RUN`/`GDX_HNF_CDIH_VALUE` (latent space,
  `F4_CURV_DEPTH_KPI_LATENT_SPACE`).

Exactly one of `ID_CDI_RUN`/`ID_CDIH_RUN` is set per run, matching `SOURCE_KIND`, on **both**
`GDX_HNF_VISDEPTH_RUN` and `GDX_HNF_DEPTHCURVE_RUN` (enforced by a single-row `CHECK`; that the
referenced run also belongs to the same study is a cross-table rule this skill enforces before
writing, same documented limitation this folder's own schemas already accept elsewhere). This
skill deliberately does **not** read `GDX_HNF_REFPROF_DUAL_VALUE` (`F4_REFERENCE_PROFILES`'s
`CDIpersonal`/`CDIpopulation`) -- this layer's own discussion names "`CDI(t)`" in the singular,
the same quantity `F4`'s two skills already compute; the personal/population pairing is a
separate, later elaboration this layer does not fold in here.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_RUN / GDX_HNF_CDI_VALUE     -> the CDIx source (--source-kind cdix)
GDX_HNF_CDIH_RUN / GDX_HNF_CDIH_VALUE   -> the CDIh source (--source-kind cdih)
```

Never reads `GDX_HNF_CDI_VALUE_DETAIL`/`GDX_HNF_CDIH_VALUE_DETAIL`, `GDX_HNF_REFPROF_*`,
`GDX_HNF_FEATURE_VALUE`, or `GDX_HNF_LATENT_VALUE` directly, and never re-reads
`2.relational.model.psychometrics`, `6.cardiac.coherence`, `7.multidimensional.database` or
`9.knowledge.graph` -- "reading the relational/BI/graph sources" for this layer is satisfied
*transitively*, through an already-run F4 CDI/CDIh run, the same posture every other skill in this
folder already takes one layer down. Never recomputes `CDIx` or `CDIh` -- only rescales what the
prior skills already froze.

## Database structure

`hypotheses_non_fingo_geometric_curvature_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_VISDEPTH_RUN` | 1 row per execution (`--gain`) | Which source kind/run, which gain `a`, how many persons -- plus the permanent, `CHECK`-enforced record that no scalar curvature was computed, and why |
| `GDX_HNF_VISDEPTH_VALUE` | 1 row per (run, person) | That person's own real source `CDI_VALUE`/`CDIH_VALUE` AND the resulting `VISUAL_DEPTH_VALUE`, side by side -- never only the rescaled number |
| `GDX_HNF_DEPTHCURVE_RUN` | 1 row per execution (`--sigma`) | Which source kind/run, which width `sigma`, how many persons -- plus the same permanent, `CHECK`-enforced non-computation record |
| `GDX_HNF_DEPTHCURVE_VALUE` | 1 row per (run, person) | That person's own real source `CDI_VALUE`/`CDIH_VALUE` AND the curve's own deepest point, `CURVE_MIN_VALUE = -CDI(t)` -- never a sampled curve (see "The Gaussian dip curve" above) |

Apply this DDL once (after this folder's F4 DDL, both variants, and at least one `GDX_HNF_CDI_RUN`
or `GDX_HNF_CDIH_RUN` already produced for the study) before this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F5_GEOMETRIC_CURVATURE/scripts
npm install                                                       # once, installs node-firebird
node generate_geometric_curvature.js --sample                    # sanity check: worked examples (both modes), no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# Mode 9.1 -- linear visual-depth rescaling:
node generate_geometric_curvature.js --study <slug> --source-kind cdix --gain 1 --dry-run
node generate_geometric_curvature.js --study <slug> --source-kind cdix --gain 1
node generate_geometric_curvature.js --study <slug> --source-kind cdih --gain 2.5 --source-run-id <id>

# Mode 9.3 -- Gaussian dip curve:
node generate_geometric_curvature.js --study <slug> --source-kind cdix --sigma 1 --dry-run
node generate_geometric_curvature.js --study <slug> --source-kind cdix --sigma 1
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4/F4_REFERENCE_PROFILES use.
- `--source-kind cdix|cdih` required outside `--sample` -- see "Two CDI source kinds" above.
- `--gain <a>` mode 9.1, `a > 0` -- never defaulted. Mutually exclusive with `--sigma`.
- `--sigma <s>` mode 9.3, `s > 0` -- never defaulted. Mutually exclusive with `--gain`. Exactly
  one of `--gain`/`--sigma` is required outside `--sample`.
- `--source-run-id <id>` optional. A specific `GDX_HNF_CDI_RUN.ID_CDI_RUN` or
  `GDX_HNF_CDIH_RUN.ID_CDIH_RUN` (matching `--source-kind`) instead of the study's latest of that
  kind.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes the transform and logs it, writing no row.
- `--sample` runs the worked numeric examples below (both modes) on small, explicitly-labeled
  data -- never connects to Firebird, never writes anything.

## Worked examples (`--sample`, illustrative numbers only, not real study data)

**Mode 9.1:**

```
CDI(t) = 0.1732 (this folder's own worked CDIx example)
a = 1  -> profundidade_visual = 0.1732
a = 2  -> profundidade_visual = 0.3464
a = 5  -> profundidade_visual = 0.8660
```

The three results describe the exact same underlying displacement -- only the drawing changes.
None is "more correct" than another; `a` is chosen for legibility, never to make a particular
person's result look more or less extreme.

**Mode 9.3** (the document's own worked participant):

```
Participant #784, CDIx(t) = 0.8, sigma = 1
y(0)   = -0.8 * exp(0)       = -0.8000   <- the curve's deepest point, = -CDI(t)
y(0.5) = -0.7060
y(1)   = -0.4852
y(1.5) = -0.2597
y(2)   = -0.1083
```

Only `y(0)` is determined by the real `CDIx(t)`; `sigma` only changes how wide the dip looks away
from that one point.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (423 cadets,
`ID_STUDY=1`), both modes: `--source-kind cdix` against that study's own `GDX_HNF_CDI_RUN`, with
an explicit `--gain` (writing `GDX_HNF_VISDEPTH_RUN`/`VALUE`) and separately with an explicit
`--sigma` (writing `GDX_HNF_DEPTHCURVE_RUN`/`VALUE`) -- one row per complete-case person in that
source run, in each case.

## What this skill will never do

- **Never computes a true Riemannian scalar curvature.** `SCALAR_CURVATURE_COMPUTED` is
  `CHECK`-enforced to always be `0` on **both** run tables; this is a permanent, schema-level
  refusal, not a per-run choice.
- **Never recomputes `CDIx` or `CDIh`** -- that stays `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`'s
  and `F4_CURV_DEPTH_KPI_LATENT_SPACE`'s own job; this skill only reads their already-frozen rows
  back.
- **Never defaults the gain `a` or the width `sigma`.** Both are always required and explicit; a
  value chosen to make a particular result look a certain way is outside this skill's own
  ability to prevent, but neither is ever silently supplied by this skill itself.
- **Never combines `--gain` and `--sigma` in one run.** One mode per execution.
- **Never samples or persists the Gaussian dip curve itself** -- only `CURVE_MIN_VALUE` (the one
  point a real number determines) and the run's own `sigma` are stored; drawing the curve is a
  rendering step's own job.
- **Never mixes two CDI source kinds in one run**, and never invents a third source beyond
  `cdix`/`cdih`.
- **Never updates an existing `GDX_HNF_VISDEPTH_RUN`/`GDX_HNF_DEPTHCURVE_RUN` in place.** A new
  transform is always a new row, exactly like every other `*_RUN` table in this folder.
- **Never treats a visual-depth or depth-curve value as evidence of curved space, consciousness,
  spiritual energy, or a validated correspondence to a chakra, a Thomistic Way or a septenary
  level.**

## Files in this skill

- `../../hypotheses_non_fingo_geometric_curvature_model_firebird25.sql` -- DDL for the four
  `GDX_HNF_VISDEPTH_*`/`GDX_HNF_DEPTHCURVE_*` tables this skill reads/writes (must already be
  applied, and this folder's F4 layer must already have produced a `GDX_HNF_CDI_RUN` or
  `GDX_HNF_CDIH_RUN` for the study, before this skill has anything to compute)
- `scripts/generate_geometric_curvature.js` -- resolves the chosen CDI source, applies the
  explicit gain or width, and writes the corresponding rows (Node.js + `node-firebird`, no native
  client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
