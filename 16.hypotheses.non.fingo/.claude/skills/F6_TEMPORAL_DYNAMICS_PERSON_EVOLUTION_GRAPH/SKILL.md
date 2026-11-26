---
name: F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH
description: Given a study slug, reads the real GDX_HNF_TRAJECTORY_RUN/GDX_HNF_TRAJECTORY_POINT/GDX_HNF_TRAJECTORY_STEP rows F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION already wrote and renders a standalone, English-only HTML page using as its template the figure right above this layer's own section 10.1 ("Figura -- Sequencia Antes-Durante-Depois-Seguimento com valores ficticios de CDI" / "Before-During-After-Follow-up sequence with fictitious CDI values"): a line connecting one real subject's own real CDIx(t) across real sessions, each segment tinted by the sign of its own real DELTA_CDI (explicitly never implying better/worse), with hover detail per point (session/instant/CDIx) and per segment (DELTA_CDI, real elapsed time, discrete velocity). Reads the already-frozen trajectory rather than recomputing it -- never re-groups sessions or re-evaluates CDIx itself. Every point against a real study is labeled by its own real session grain, never a fictitious phase name -- "before/during/after/follow-up" is used only for --sample's own clearly-labeled synthetic data. Use when the user asks to plot, chart, or visualize a person's evolution over time, a before/after CDI sequence, or this layer's own temporal-dynamics figure for a study. Never attributes an observed change to a cause.
---

# F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH

Renders this folder's own "before-during-after-follow-up" figure: one real subject's own real
`CDIx(t)` across real sessions, to make visible -- with real data -- that a trajectory need not be
monotonic, and that moving toward or away from a reference is never, by itself, "better" or
"worse".

## Why this script reads a persisted run, instead of recomputing live

Unlike this folder's F5 GRAPH skills (which recompute a rendering/design choice such as a gain or
a curve width live, at render time, because sections 9.1/9.3 explicitly frame those as design
choices), a trajectory is a genuine **compute result**: which features and sessions qualify, and
each session's own `CDIx(t_s)`, come from real business logic (session-structure grouping,
reference reuse) worth freezing once rather than re-deriving at every render.
`F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION` already does that work and writes `GDX_HNF_TRAJECTORY_RUN`/
`POINT`/`STEP` -- this script only reads those rows back, the same posture this folder's F4 GRAPH
skills already take toward `GDX_HNF_CDI_RUN`/`VALUE`.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_TRAJECTORY_RUN / POINT / STEP   -> the chosen run (latest for the study, or --trajectory-run-id)
GDX_HNF_CDI_REFERENCE_SET               -> only to show that run's own reference label in the page's meta line
```

Never reads `GDX_HNF_FEATURE_VALUE`, `GDX_HNF_CDI_REFERENCE_VALUE`, `GDX_HNF_CDI_RUN`/`VALUE`, or
any other upstream table directly, and never re-reads `2.relational.model.psychometrics`,
`6.cardiac.coherence`, `7.multidimensional.database` or `9.knowledge.graph` -- "reading the
relational/BI/graph sources" is satisfied *transitively*, through an already-run F6 trajectory,
the same posture every other skill in this folder already takes. Never recomputes `CDIx`,
`DELTA_CDI` or velocity, and never re-groups sessions -- those stay
`F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION`'s own job.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH/scripts
npm install                                                    # once, installs node-firebird
node generate_temporal_dynamics_graph.js --sample             # sanity check: embedded sample data, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

node generate_temporal_dynamics_graph.js --study 1 --dry-run        # real run: logs scope, writes no file
node generate_temporal_dynamics_graph.js --study 1                 # real run: writes the HTML page
node generate_temporal_dynamics_graph.js --study 1 --trajectory-run-id <id>
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4/F6 use.
- `--trajectory-run-id <id>` optional. A specific `GDX_HNF_TRAJECTORY_RUN.ID_TRAJECTORY_RUN`
  instead of the study's latest.
- `--out-dir <path>` optional. Defaults to this folder (`16.hypotheses.non.fingo/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (run, subject, session/step counts) and logs it, writing no
  file.
- `--sample` renders from embedded, clearly-labeled sample data (this layer's own document-style
  named phases) instead of connecting to Firebird -- lets the rendering logic be checked with no
  live database.

## Current status

Implemented and validated end-to-end against this project's own study 1 (423 cadets,
`ID_STUDY=1`): rendered `ID_TRAJECTORY_RUN=1` (subject `#784`, 5 real cardiac-coherence sessions,
`CC_SESSION:1001`-`1005`) -- every session's own real timestamp and `CDIx` value, and every
step's real `DELTA_CDI`/velocity, matched exactly against the underlying `GDX_HNF_TRAJECTORY_*`
rows.

## What this skill will never do

- **Never attributes an observed change to a cause.** The rendered page always shows this run's
  own `CAUSAL_CAVEAT_NOTE` (or, for `--sample`, the equivalent fixed caution).
- **Never fabricates a session or a CDIx value.** Every point against a real study comes from a
  real `GDX_HNF_TRAJECTORY_POINT` row, labeled by its own real session grain -- never a fictitious
  phase name.
- **Never recomputes `CDIx`, `DELTA_CDI` or velocity, and never re-groups sessions.** Those stay
  `F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION`'s own job; this skill only reads its already-frozen
  rows back.
- **Never writes to the database.** This is a pure read-and-render skill, like every other GRAPH
  skill in this folder.
- **Never implies that a segment colored one way is "better" or "worse" than the other** -- the
  legend states this explicitly, and the two colors only encode the sign of a real, signed number.

## Files in this skill

- `scripts/chart_renderer.js` -- self-contained SVG renderer (house style shared with this
  folder's other GRAPH skills: validated categorical palette, hover tooltips, table-view
  fallback, light+dark theme)
- `scripts/generate_temporal_dynamics_graph.js` -- resolves the trajectory run, loads its real
  points/steps, and writes the HTML page (Node.js + `node-firebird`, no native client library
  required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
