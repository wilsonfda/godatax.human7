---
name: F5_GEOMETRIC_CURVATURE_GRAPH
description: Given a study slug, reads the real GDX_HNF_CDI_VALUE or GDX_HNF_CDIH_VALUE rows F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS/F4_CURV_DEPTH_KPI_LATENT_SPACE already wrote and renders a standalone, English-only HTML page with TWO cards from this layer's own mathematical foundation, over the same real CDI(t)/CDIh(t) population and the same three representative real persons (lowest/median-closest/highest CDI): (1) section 9.1's "three graphic depths parametrized by CDI; relationship chosen by design" -- several straight reference lines, profundidade_visual = a * CDI, default gains 1, 2, 5; (2) section 9.3's "Como produzir a curva utilizando os dados reais?" -- each representative person's own Gaussian dip curve, y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), default sigma 1, where only the curve's point at s=0 (= -CDI(t)) is real and the rest is a sampled illustration. Both the gains and sigma are applied live, at render time -- never requires or reads a pre-existing GDX_HNF_VISDEPTH_RUN/GDX_HNF_DEPTHCURVE_RUN. Use when the user asks to plot, chart, or visualize the geometric-curvature "three depths" figure, a Gaussian dip/well curve from a CDI, how a graphic gain or curve width changes the look of a CDI-based drawing, or the visual-depth design choice for a study. Never computes or displays a true Riemannian scalar curvature.
---

# F5_GEOMETRIC_CURVATURE_GRAPH

Renders two of this folder's own figures over the same real CDI population and the same three
representative real persons, to make visible -- with real data -- that neither a graphic gain
nor a curve width changes which person is actually farther from their own reference, only how
the drawing looks.

## Card 1 -- "three graphic depths" (section 9.1)

Several straight reference lines, `profundidade_visual = a * CDI`, a rug of every real CDI value
on the shared axis, and the three representative persons marked on every line.

## Card 2 -- the Gaussian dip curve (section 9.3)

Each representative person's own curve, `y(s) = -CDI(t) * exp(-s^2/(2*sigma^2))`, sampled across
a fixed `+/-3*sigma` window. Only each curve's point at `s=0` (`= -CDI(t)`) is determined by a
real number -- `sigma` only changes how wide the dip looks away from that one point, and the rest
of the sampled curve is a rendering choice, not a measurement.

## Why this script computes both transforms live, instead of reading a persisted run

`F5_GEOMETRIC_CURVATURE` can persist one `GDX_HNF_VISDEPTH_RUN` per `(source run, gain)` pair and
one `GDX_HNF_DEPTHCURVE_RUN` per `(source run, sigma)` pair, but requiring several
separately-persisted runs just to render one comparison figure would be unnecessary ceremony for
what sections 9.1 and 9.3 both frame as rendering/design choices. Instead, this script reads the
real CDI source directly (`GDX_HNF_CDI_VALUE`/`GDX_HNF_CDIH_VALUE`) and applies both the gains and
`sigma` live, at render time -- the same posture every other GRAPH skill in this folder already
takes toward lightweight, deterministic, non-persisted statistics (e.g. F3's own Pearson r). The
defaults (gains `1, 2, 5`; `sigma` `1`) are not arbitrary -- they are the exact values
`F5_GEOMETRIC_CURVATURE --sample` already documents and uses.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_RUN / GDX_HNF_CDI_VALUE     -> the CDIx source (--source-kind cdix, the default)
GDX_HNF_CDIH_RUN / GDX_HNF_CDIH_VALUE   -> the CDIh source (--source-kind cdih)
```

Never reads `GDX_HNF_VISDEPTH_RUN`/`GDX_HNF_VISDEPTH_VALUE`/`GDX_HNF_DEPTHCURVE_RUN`/`GDX_HNF_
DEPTHCURVE_VALUE` (`F5_GEOMETRIC_CURVATURE`'s own persisted transforms -- this script recomputes
both live instead, see above), never reads `GDX_HNF_CDI_VALUE_DETAIL`/`GDX_HNF_CDIH_VALUE_DETAIL`,
`GDX_HNF_REFPROF_*`, or `GDX_HNF_FEATURE_VALUE`/`GDX_HNF_LATENT_VALUE` directly, and never
re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`, `7.multidimensional.database`
or `9.knowledge.graph` -- "reading the relational/BI/graph sources" is satisfied *transitively*,
through an already-run F4 CDI/CDIh run, the same posture every other skill in this folder already
takes one layer down.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F5_GEOMETRIC_CURVATURE_GRAPH/scripts
npm install                                                        # once, installs node-firebird
node generate_geometric_curvature_graph.js --sample               # sanity check: embedded sample data, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

node generate_geometric_curvature_graph.js --study 1 --dry-run              # real run: logs scope, writes no file
node generate_geometric_curvature_graph.js --study 1                       # real run: writes the HTML page (both cards; CDIx, gains 1/2/5, sigma 1)
node generate_geometric_curvature_graph.js --study 1 --source-kind cdih --gains 0.5,1.5,3 --sigma 2
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4/F5 use.
- `--source-kind cdix|cdih` optional, default `cdix`. See `F5_GEOMETRIC_CURVATURE/SKILL.md` for
  what each one means.
- `--source-run-id <id>` optional. A specific `GDX_HNF_CDI_RUN.ID_CDI_RUN` or
  `GDX_HNF_CDIH_RUN.ID_CDIH_RUN` (matching `--source-kind`) instead of the study's latest of that
  kind.
- `--gains <a1,a2,...>` optional, default `1,2,5`. Card 1's gains. Every value must be `> 0`.
- `--sigma <s>` optional, default `1`, `s > 0`. Card 2's curve width.
- `--out-dir <path>` optional. Defaults to this folder's own `output/` subfolder (`16.hypotheses.non.fingo/output/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (source run, person count, representative persons) and logs
  it, writing no file.
- `--sample` renders from embedded, clearly-labeled sample data instead of connecting to
  Firebird -- lets the rendering logic be checked with no live database.

## Current status

Implemented and validated end-to-end against this project's own study 1 (423 cadets,
`ID_STUDY=1`), `--source-kind cdix` (its latest `GDX_HNF_CDI_RUN`), default gains `1, 2, 5` and
default `sigma = 1` -- both cards on one page, same three representative persons
(`#784`/`#1358`/`#822`, lowest/median/highest).

## What this skill will never do

- **Never computes or displays a true Riemannian scalar curvature.** See
  `F5_GEOMETRIC_CURVATURE/SKILL.md` for why that is permanently out of scope for this project's
  own pipeline.
- **Never fabricates a CDI value.** Every point on the shared axis and every representative
  person comes from a real `GDX_HNF_CDI_VALUE`/`GDX_HNF_CDIH_VALUE` row.
- **Never samples or persists the Gaussian dip curve to the database.** Card 2 is computed live,
  every run, from the real per-person CDI values; this is a pure read-and-render skill, like
  every other GRAPH skill in this folder.
- **Never implies that a larger gain, a deeper-looking line, or a wider/narrower dip means a
  worse or more extreme condition.** Both cards describe the exact same underlying displacements.

## Files in this skill

- `scripts/chart_renderer.js` -- self-contained SVG renderer (house style shared with this
  folder's other GRAPH skills: validated categorical palette, hover tooltips, table-view
  fallback, light+dark theme)
- `scripts/generate_geometric_curvature_graph.js` -- resolves the CDI source, applies the gains
  and sigma live, and writes the HTML page with both cards (Node.js + `node-firebird`, no native
  client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
