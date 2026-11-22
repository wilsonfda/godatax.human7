---
name: F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH
description: Given a study slug, reads the real GDX_HNF_CDIH_* tables F4_CURV_DEPTH_KPI_LATENT_SPACE already wrote (GDX_HNF_CDIH_RUN, GDX_HNF_CDIH_RUN_DIMENSION, GDX_HNF_CDIH_VALUE, GDX_HNF_CDIH_VALUE_DETAIL, GDX_HNF_CDIH_REFERENCE_SET), plus GDX_HNF_LATENT_RUN/GDX_HNF_LATENT_DIMENSION (F2) for the evaluated run's own method/label, and renders a standalone, English-only HTML page with three cards: (1) a histogram of every complete-case person's own real CDIh(t)/CDIh_w(t) in one chosen run, (2) a per-latent-dimension ranking of the real RMS contribution to that run's own CDIh (never a fabricated illustration, computed from GDX_HNF_CDIH_VALUE_DETAIL), and (3) one diverging bar chart per representative person (the run's own lowest, median-closest and highest CDIh) showing that real person's own full per-dimension signed difference vector. Use when the user asks to plot, chart, or visualize the Curvature Depth Index in latent space, a CDIh dashboard, or what drives a CDIh value for a study, after F4_CURV_DEPTH_KPI_LATENT_SPACE has already run for it.
---

# F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH

Renders the output of **F4_CURV_DEPTH_KPI_LATENT_SPACE** (F4-alternative) -- this folder's
Curvature Depth Index in latent space, see that skill's own `SKILL.md` -- as a standalone HTML
page. Three cards, built from one chosen `GDX_HNF_CDIH_RUN`, in exactly the same shape
`F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH` already renders for `CDIx`. This skill's own
`scripts/chart_renderer.js` started as a copy of that sibling's, with its three renderers given two
small optional parameters (`metricLabel`, default `'CDI'`; `axisNoun`/`metricNoun`, default
`'feature'`/`'normalized feature space'`) -- the only wording in the three renderers that was
hardcoded to `CDIx`'s own vocabulary. Every other line, including the SVG layout, palette and HTML
shell, is unchanged; the sibling's own call site is unaffected since it never passes those
parameters and keeps the original defaults.

## Card 1 -- CDIh distribution

A histogram of `CDIH_VALUE` across every complete-case person in the chosen run, with dashed
markers at the run's own real mean and median. Shows how displaced from the reference this run's
whole sample is, within that one fitted latent coordinate system, and how spread out that
displacement is -- never a single aggregate number standing in for the whole distribution.

## Card 2 -- per-latent-dimension contribution ranking

For each latent dimension in the run, the RMS of that dimension's own real signed difference
(`current − reference`) across every complete-case person (`sqrt(mean(DIFFERENCE^2))`, computed
by the database from `GDX_HNF_CDIH_VALUE_DETAIL`, never re-derived by an approximation), sorted
descending. This is exactly the breakdown F4-alternative's own schema stores so it is never
discarded behind the single aggregate `CDIh` scalar. There is no "perspective" grouping the way
`CDIx`'s input features have one (psychometrics vs. physiology) -- a latent run's dimensions are
all of one kind, produced by one fitted model, so the evaluated run's own `METHOD`
(`PCA`/`AUTOENCODER`/`UMAP`) fills that same slot instead, and every bar shares one consistent
legend entry naming it. When `METHOD='PCA'` and a dimension has a real `EXPLAINED_VARIANCE_RATIO`
(`GDX_HNF_LATENT_DIMENSION`), that is shown alongside it; it stays absent for `AUTOENCODER`/`UMAP`,
never approximated. On a `WEIGHTED` run, each bar's own `w_j` is shown alongside its RMS difference
(a dimension can have a large RMS difference and still contribute little to the final `CDIh` if its
weight is small, or vice versa -- the two numbers are shown together so that distinction stays
visible).

## Card 3 -- representative person profiles

Three diverging bar charts, one per representative person in the run: the person with the
**lowest** `CDIh`, the person whose `CDIh` sits **closest to the run's median**, and the person
with the **highest** `CDIh`. Each shows that one real person's own complete per-dimension
difference vector (`GDX_HNF_CDIH_VALUE_DETAIL.DIFFERENCE`) as bars diverging from zero -- positive
(current above reference, in this fitted latent coordinate system) in one color, negative in
another. An aggregate `CDIh` discards direction; recovering *which latent dimension actually moved*
for a concrete person requires exactly this per-dimension view.

## Why this reads GDX_HNF_CDIH_VALUE_DETAIL directly, never GDX_HNF_LATENT_VALUE

Same posture as `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH` toward `GDX_HNF_FEATURE_VALUE`: F4
(latent) already stored both the current and reference coordinates, and their signed difference,
per dimension per person (`GDX_HNF_CDIH_VALUE_DETAIL.CURRENT_VALUE`/`REFERENCE_VALUE`/`DIFFERENCE`).
Reading that table directly is strictly more precise than recomputing the same numbers from
`GDX_HNF_LATENT_VALUE` and `GDX_HNF_CDIH_REFERENCE_VALUE` a second time, and guarantees this chart
always matches exactly what F4-alternative itself computed and froze.

## What it reads

```
GDX_HNF_CDIH_RUN             -> which run (latest for the study, or --cdih-run-id)
GDX_HNF_CDIH_REFERENCE_SET   -> that run's own reference type/label, for the page's own meta line
GDX_HNF_CDIH_RUN_DIMENSION   -> that run's own dimensions, order and weights
GDX_HNF_CDIH_VALUE           -> the real CDIh scalar per complete-case person (card 1, and to pick
                                 the three representative persons for card 3)
GDX_HNF_CDIH_VALUE_DETAIL    -> the real per-dimension signed difference (cards 2 and 3)
GDX_HNF_LATENT_RUN           -> the evaluated run's own METHOD and LATENT_DIMENSION_COUNT (k), for
                                 the page's meta line and card 2's grouping/legend
GDX_HNF_LATENT_DIMENSION     -> DIMENSION_LABEL (e.g. "PC1") and, PCA only, EXPLAINED_VARIANCE_RATIO
```

Never reads `GDX_HNF_LATENT_VALUE` or `GDX_HNF_FEATURE_VALUE` -- F4-alternative already consumed
those and froze everything this page needs into `GDX_HNF_CDIH_*`. Never writes to the database --
purely a reader, same posture as this folder's other four graph skills toward their own compute
layer. Never re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph`, and never re-computes a `CDIh` value on its
own.

## Privacy stance

Each person is labeled only by their internal `ID_PERSON` surrogate key, never by
`GDX_PSY_PERSON.NAME` -- same aggregate posture as this folder's other four graph skills.

## Options

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH/scripts
npm install                                                        # once, installs node-firebird
node generate_curvature_depth_graph_latent.js --sample --dry-run   # sanity check: embedded sample data, no DB, writes nothing
node generate_curvature_depth_graph_latent.js --sample             # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_curvature_depth_graph_latent.js --study <slug> --dry-run           # real run: logs the resolved CDIh run/counts, writes nothing
node generate_curvature_depth_graph_latent.js --study <slug>                     # real run: writes the HTML page
node generate_curvature_depth_graph_latent.js --study <slug> --cdih-run-id <id>  # a specific run instead of the study's latest
```

- `--study <slug>` **required** outside `--sample` -- the same slug F1/F2/F3/F4/F4-alternative use,
  resolved to `GDX_PSY_STUDY.ID_STUDY` via `new_study_intake/<slug>/intake.json`'s `study.title`.
- `--cdih-run-id <id>` optional -- a specific `GDX_HNF_CDIH_RUN.ID_CDIH_RUN` instead of the study's
  latest. Errors if that run belongs to a different study.
- `--out-dir <path>` optional, defaults to this folder (`16.hypotheses.non.fingo/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (resolved run, dimension/person counts, representative persons,
  output filename) and logs it, writing no file.
- `--sample` renders from small, explicitly-labeled embedded synthetic data (eight synthetic
  persons, four synthetic latent dimensions of a synthetic PCA run, both positive and negative
  differences) instead of connecting to Firebird.

## Output filename

```
f4_curvature_depth_index_latent_graph__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention this folder's other four graph skills use: `<study-slug>` is the literal `--study`
value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the moment the run
started -- re-running later never overwrites an earlier file.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (`--study 1`), reusing
the real `GDX_HNF_CDIH_RUN` rows `F4_CURV_DEPTH_KPI_LATENT_SPACE` already wrote and validated:

- `--sample` renders from embedded synthetic data, no DB, confirmed error-free, including the
  `CDIh`/`dimension` wording (not `CDIx`/`feature`) in every card title, axis label and table
  header.
- Real page rendered for `ID_CDIH_RUN=4` (`--study 1`'s latest at the time: `LATENT_COHORT`
  reference, `WEIGHTED`, PCA run `ID_LATENT_RUN=3`, k=10, 422 complete-case persons):
  `f4_curvature_depth_index_latent_graph__1__predictors-of-adaptability-to-military-higher-education__20261121-124357.html`
  -- all three cards populated, weights shown per dimension alongside each `EXPLAINED_VARIANCE_RATIO`
  annotation (e.g. `PC1`: `w=0.28`, explained variance `27.8%`), highest-`CDIh` person `#822` at
  `6.388`.
- Real page rendered for `ID_CDIH_RUN=1` via explicit `--cdih-run-id 1` (`LATENT_COHORT`,
  `UNWEIGHTED`):
  `f4_curvature_depth_index_latent_graph__1__predictors-of-adaptability-to-military-higher-education__20261121-124400.html`
  -- confirmed the override path resolves a specific, non-latest run correctly; same person `#822`
  is still the run's own highest, but at the unweighted `CDIh=3.907` (vs. `6.388` weighted) --
  consistent with `F4_CURV_DEPTH_KPI_LATENT_SPACE`'s own validated weighting behavior.

## Files in this skill

- `scripts/generate_curvature_depth_graph_latent.js` -- resolves the chosen `GDX_HNF_CDIH_RUN`, its
  dimensions/weights (joined to `GDX_HNF_LATENT_DIMENSION` for labels/explained variance), its
  complete-case `CDIh` values, the real per-dimension RMS contribution (aggregated by the
  database), and the three representative persons' own detail rows, then writes the HTML page
  (Node.js + `node-firebird`, no native client library required)
- `scripts/chart_renderer.js` -- the histogram, dimension-ranking and diverging-profile SVG
  renderers, the shared self-contained HTML page shell, and the (duplicated) reference palette --
  started as a copy of `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH`'s own, with the small
  `metricLabel`/`axisNoun`/`metricNoun` parameters described above (everything else unchanged)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
