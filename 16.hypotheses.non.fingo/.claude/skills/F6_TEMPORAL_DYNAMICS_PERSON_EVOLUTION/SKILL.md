---
name: F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION
description: Implements this folder's F6 layer on top of F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own output -- for a given study and one real subject, evaluates the already-validated CDIx RMS-distance shape once PER REAL SESSION instead of once, turning a sequence of real points into a trajectory. Computes CDIx(t_s) at every real session, DELTA_CDI = CDIx(after) - CDIx(before) between real, adjacent sessions, and a discrete velocity approximation v = |DELTA_CDI| / Delta_t when a real elapsed time is available, writing GDX_HNF_TRAJECTORY_RUN/GDX_HNF_TRAJECTORY_RUN_FEATURE/GDX_HNF_TRAJECTORY_POINT/GDX_HNF_TRAJECTORY_STEP (hypotheses_non_fingo_temporal_dynamics_model_firebird25.sql, this folder) via scripts/generate_temporal_dynamics.js --study <slug> --reference-set-id <id> [--subject <id_person>]. Reuses an already-built GDX_HNF_CDI_REFERENCE_SET (F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS) -- never builds a reference of its own -- and never attributes a real CDIx change to a cause (GDX_HNF_TRAJECTORY_RUN.CAUSAL_CLAIM_MADE is schema-CHECKed to always equal 0). Use when the user asks to track a person's evolution over time, compute a before/after or velocity index from real sessions, or build a CDIx trajectory for a GDX_HUMAN study. Does NOT recompute CDIx's own formula or build a reference center (those stay F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own job) and does NOT attribute any observed change to a cause.
---

# F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION

Implements this folder's **F6** layer: a sequence of real measurements across real sessions
becomes a trajectory, and this folder's own RMS-distance CDIx shape (already validated by
**F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS**) is evaluated **once per real session** instead of
once, turning one scalar into a real time series.

```
gamma_i(t) = h_i(t)                               trajectory: real points, one per real session
CDIx(t_s)  = sqrt( (1/n) * sum_j (z_j(t_s) - z_j_ref)^2 )     same RMS shape as GDX_HNF_CDI_VALUE
DeltaCDI   = CDIx(t_after) - CDIx(t_before)        change between two real, adjacent sessions
v(t)       = |DeltaCDI| / Delta_t                   a DISCRETE finite-difference approximation
```

## Why the trajectory lives in the original feature space, not the latent one

The document's own `gamma_i(t) = h_i(t)` names the latent representation -- but
**F2_GDX_SKILL_LATENT_REPRESENTATIONS** already collapses every repeated session into exactly
**one** latent coordinate per person before fitting (see that skill's own DDL header). There is
therefore no multi-session latent trajectory anywhere in this project's own data today. What
*does* exist, real and multi-session, is `GDX_HNF_FEATURE_VALUE` itself (F1): a physiological
feature with repeated real administrations (e.g. a cardiac-coherence session) carries several
real `OBS_GRAIN_KEY` rows per person, each with a real `OBS_INSTANT`. This module builds its
trajectory there, in the original normalized `z(t)` -- never the latent `h(t)` -- because that is
where this project's own real repeated-session data actually lives. A latent-space variant, if
this project ever collapses sessions differently, would be a separate, later extension, not
folded in here (the same posture this folder's own F4-vs-F4-alternative split already takes).

## Velocity: a scalar, discrete approximation -- not the document's own vector norm

The document's own `v_i(t) = ||d(gamma_i(t))/dt||_g` is a **vector** velocity under a metric `g`
on feature/latent space -- this module defines no such metric and computes something narrower and
honestly labeled instead: the rate of change of the already-aggregated **scalar** `CDIx(t)` index
itself, as a **discrete finite-difference** between two real, adjacent sessions (`|DeltaCDI| /
Delta_t`), never a true derivative (two discrete points do not establish a differentiable curve).
A negative `DeltaCDI` means the person's own profile moved **closer** to the chosen reference
between those two sessions -- never, by itself, evidence of improvement.

## Session structure: never inventing an alignment across features

There is no project-wide, cross-feature notion of "session 1, 2, 3..." -- each feature's own real
`OBS_GRAIN_KEY` sequence is independent. This module requires every feature in its own trajectory
feature set to share the **exact same** ordered sequence of real grain keys for the subject; among
all candidates (covered by the chosen reference **and** with more than one real session), it picks
the single largest group that actually shares one common session sequence. It never merges two
different session structures into one trajectory, and never assumes two features' sessions line
up without checking.

## Reusing F4's reference -- never building one here

`--reference-set-id` must name an **already-built** `GDX_HNF_CDI_REFERENCE_SET`
(`F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`). This module never constructs a reference center of its
own -- the same separation of concerns `F4_REFERENCE_PROFILES` already enforces one layer up. If
the study's existing reference sets do not cover the subject's own repeated-session features, this
module has nothing to evaluate against until `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` is run again
with a `--feature` filter that reaches those features (e.g. the physiological ones) -- this module
never works around that by inventing a reference inline.

## Evolution and causal hypotheses (section 10.1) -- a permanent, schema-enforced refusal

Observing `CDIx(t)` rise or fall across real sessions shows a **temporal association**, never an
isolated cause. Sleep, expectation, maturation, test-repetition effects and environmental context
can all explain a real change; attributing it to Virtology or any other intervention requires an
appropriate design, a comparison condition and an assessment of bias this module does not, and
cannot, supply on its own. `GDX_HNF_TRAJECTORY_RUN.CAUSAL_CLAIM_MADE` carries a `CHECK` that it
always equals `0`, and `CAUSAL_CAVEAT_NOTE` is a mandatory, non-empty column this skill always
fills with the same fixed explanation -- the same structural-refusal pattern
`F5_GEOMETRIC_CURVATURE` already uses for `SCALAR_CURVATURE_COMPUTED`, applied here to causal
attribution instead of to a physical curvature claim.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_REFERENCE_SET / GDX_HNF_CDI_REFERENCE_VALUE   -> the reused reference (never built here)
GDX_HNF_FEATURE_VALUE / GDX_HNF_FEATURE_DICTIONARY        -> every real session for the subject
```

Never reads `GDX_HNF_CDI_RUN`/`GDX_HNF_CDI_VALUE`/`GDX_HNF_CDI_VALUE_DETAIL`,
`GDX_HNF_LATENT_VALUE`, `GDX_HNF_REFPROF_*`, or `GDX_HNF_VISDEPTH_*`/`GDX_HNF_DEPTHCURVE_*`
directly, and never re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` -- "reading the relational/BI/graph sources"
is satisfied *transitively*, through an already-run F1 run and an already-built F4 reference set,
the same posture every other skill in this folder already takes.

## Database structure

`hypotheses_non_fingo_temporal_dynamics_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_TRAJECTORY_RUN` | 1 row per execution | Subject, evaluated F1 run, reused reference set, session/feature counts -- plus the permanent, `CHECK`-enforced record that no causal claim is made, and why |
| `GDX_HNF_TRAJECTORY_RUN_FEATURE` | 1 row per (run, feature) | Which features actually composed the per-session CDIx vector |
| `GDX_HNF_TRAJECTORY_POINT` | 1 row per (run, real session) | That session's own real grain/instant and its real `CDIx(t_s)` |
| `GDX_HNF_TRAJECTORY_STEP` | 1 row per (run, consecutive step) | The real, signed `DELTA_CDI`, the real elapsed time (when available), and the resulting discrete velocity (never fabricated when no real elapsed time exists) |

Apply this DDL once (after this folder's F4 DDL and at least one qualifying `GDX_HNF_CDI_
REFERENCE_SET` already produced for the study) before this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION/scripts
npm install                                                    # once, installs node-firebird
node generate_temporal_dynamics.js --sample                   # sanity check: worked numeric example, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

node generate_temporal_dynamics.js --study <slug> --reference-set-id <id> --dry-run
node generate_temporal_dynamics.js --study <slug> --reference-set-id <id>
node generate_temporal_dynamics.js --study <slug> --reference-set-id <id> --subject <id_person> --feature "CC."
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4/F4_REFERENCE_PROFILES/F5
  use.
- `--reference-set-id <id>` required outside `--sample`. An already-built `GDX_HNF_CDI_
  REFERENCE_SET` whose own `GDX_HNF_CDI_REFERENCE_VALUE` rows cover the trajectory's feature set.
- `--subject <id_person>` required when the chosen reference is not `PERSONAL_BASELINE`; optional
  (and must match) when it is.
- `--feature <text>` optional, same convention as this folder's other skills -- narrows candidate
  features before grouping by session structure.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes the trajectory (session grouping, per-session CDIx, deltas, velocities)
  and logs it, writing no row.
- `--sample` runs the worked numeric example below on small, explicitly-labeled synthetic data --
  never connects to Firebird, never writes anything.

## Worked example (`--sample`, illustrative numbers only, not real study data)

```
CDIx(before)    = 0.42
CDIx(during)    = 0.65
CDIx(after)     = 0.30
CDIx(follow-up) = 0.38

before -> during:    DeltaCDI = +0.2300, Delta_t = 20 min
during -> after:      DeltaCDI = -0.3500, Delta_t = 15 min
after -> follow-up:   DeltaCDI = +0.0800, Delta_t = 1440 min
```

The "during -> after" step is negative -- the profile moved toward the reference. That is never,
by itself, evidence of improvement or of any intervention's effect.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (423 cadets,
`ID_STUDY=1`), subject `#784` (today the only person with both psychometric and cardiac-coherence
data): a `PERSONAL_BASELINE` reference set scoped to the 7 cardiac-coherence features
(`ID_REFERENCE_SET=3`, built via `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS --feature "CC."`) feeds a
real 5-session trajectory (`CC_SESSION:1001`-`1005`, 10 minutes apart), writing 1
`GDX_HNF_TRAJECTORY_RUN`, 7 `GDX_HNF_TRAJECTORY_RUN_FEATURE`, 5 `GDX_HNF_TRAJECTORY_POINT` and 4
`GDX_HNF_TRAJECTORY_STEP` rows -- every `DELTA_T_SECONDS` real and exactly `600` (the sessions'
own real 10-minute spacing).

## What this skill will never do

- **Never attributes a real `CDIx` change to a cause.** `CAUSAL_CLAIM_MADE` is `CHECK`-enforced to
  always be `0`; this is a permanent, schema-level refusal, not a per-run choice.
- **Never builds a reference center of its own.** `--reference-set-id` must name an already-built
  `GDX_HNF_CDI_REFERENCE_SET`; this skill only reads it back.
- **Never recomputes `CDIx`'s own formula** -- it only evaluates the exact same RMS shape at more
  than one real point in time.
- **Never merges two different session structures into one trajectory**, and never assumes two
  features' real sessions line up without checking.
- **Never fabricates a velocity.** `VELOCITY` is `NULL` whenever a real, positive elapsed time is
  not available between two sessions -- never defaulted to `0` or an assumed interval.
- **Never updates an existing `GDX_HNF_TRAJECTORY_RUN` in place.** A new trajectory is always a
  new row, exactly like every other `*_RUN` table in this folder.
- **Never treats a trajectory, a `DeltaCDI`, or a velocity as evidence of a clinical condition,
  intervention effect, or a validated correspondence to a chakra, a Thomistic Way or a septenary
  level.**

## Files in this skill

- `../../hypotheses_non_fingo_temporal_dynamics_model_firebird25.sql` -- DDL for the four
  `GDX_HNF_TRAJECTORY_*` tables this skill writes (must already be applied, together with this
  folder's F4 DDL and a qualifying `GDX_HNF_CDI_REFERENCE_SET` for the study, before this skill's
  first run)
- `scripts/generate_temporal_dynamics.js` -- resolves the reference/subject, groups real sessions
  into a trajectory, computes `CDIx(t_s)`/`DeltaCDI`/velocity, and writes the `GDX_HNF_
  TRAJECTORY_*` rows (Node.js + `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
