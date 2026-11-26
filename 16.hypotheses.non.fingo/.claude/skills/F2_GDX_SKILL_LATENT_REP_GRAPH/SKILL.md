---
name: F2_GDX_SKILL_LATENT_REP_GRAPH
description: Given a study slug, reads the real GDX_HNF_LATENT_* tables F2_GDX_SKILL_LATENT_REPRESENTATIONS already wrote (GDX_HNF_LATENT_RUN, GDX_HNF_LATENT_DIMENSION, GDX_HNF_LATENT_VALUE, GDX_HNF_LATENT_LOADING) and renders a standalone, English-only HTML page with one 2D scatter card per method -- PCA (with real loading-direction arrows, a biplot), an autoencoder, and UMAP -- each plotting every person's own first two latent coordinates around the origin. A method with no run yet for the study gets an explicit "Not available" card instead of being silently omitted or faked. Use when the user asks to plot, chart, or visualize a study's latent representation / PCA / autoencoder / UMAP results, after F2_GDX_SKILL_LATENT_REPRESENTATIONS has already run for it.
---

# F2_GDX_SKILL_LATENT_REP_GRAPH

Renders the output of **F2_GDX_SKILL_LATENT_REPRESENTATIONS** (F2) -- this folder's latent-space
model, see that skill's own `SKILL.md` -- as a standalone HTML page. One 2D scatter card per
method it defines (PCA, an autoencoder, UMAP), each plotting every person's own first two latent
coordinates for the chosen run.

## What each card shows

For a method with a `GDX_HNF_LATENT_RUN`: a scatter of `(h_1, h_2)` -- each point one real person's
own coordinate on that run's first two dimensions (`GDX_HNF_LATENT_VALUE`, `DIMENSION_ORDER` 1 and
2) -- with a dashed crosshair through the origin (where a mean-centered representation's own center
sits). Hovering a point shows the person id and their exact coordinate on both dimensions; every
point is also listed in the card's table-view fallback.

**PCA's card only** is additionally overlaid with loading-direction arrows (a standard PCA biplot):
one arrow per input feature from `GDX_HNF_LATENT_LOADING`, for the features with the largest
combined magnitude on these two dimensions (`--top-loadings`, default 8 -- every loading still
appears in the card's own table regardless of this cap, only the drawn arrows are capped so the
plot stays legible). An arrow's *length* is rescaled for visibility relative to the score cloud,
never the true `LOADING_VALUE` -- the raw, unscaled value is always in the tooltip and the table, so
the rescaling is never mistaken for the real coefficient.

**Autoencoder and UMAP cards never get an arrow overlay.** Neither method has a
`GDX_HNF_LATENT_LOADING` row (per F2's own schema, no fixed per-feature coefficient exists for
either), so nothing is approximated or implied in its place -- a plain scatter is the honest
rendering for both.

## A method with no data is reported, never silently dropped

If a study has no `GDX_HNF_LATENT_RUN` yet for a given method (today: `AUTOENCODER` and `UMAP`,
since F2 only implements `--method pca` as of this writing), that method still gets its own card,
explicitly marked "Not available" with the reason -- never omitted from the page, and never filled
with a fabricated scatter.

## Epistemic cautions, same as F2's own

A visual grouping or distance in a 2D projection is not, by itself, evidence of a real subgroup or
a meaningful similarity -- interpreting one needs separate validation this skill never performs.
Component/dimension labels stay exactly what F2 itself wrote (`PC1`, `LATENT_2`, ...), never
renamed here into a semantic label. A PCA projection, an autoencoder projection, and a UMAP
projection of the same people are three independent, non-interchangeable views -- this page never
merges or compares them as if they shared one space; each gets its own card, its own axes, its own
scale.

## What it reads

```
GDX_HNF_LATENT_RUN         -> which run per method (latest for the study, or an explicit --<method>-run-id)
GDX_HNF_LATENT_DIMENSION   -> that run's first two dimensions (DIMENSION_ORDER 1 and 2), labels and (PCA only) explained variance
GDX_HNF_LATENT_VALUE       -> the real per-person coordinates on those two dimensions
GDX_HNF_LATENT_LOADING     -> PCA only: the real per-feature loadings on those two dimensions, for the biplot arrows
GDX_HNF_FEATURE_DICTIONARY -> feature code/name, to label the loading-arrow tooltips and table (PCA only)
```

Never reads `GDX_HNF_FEATURE_VALUE` or any lower-level source (`2.relational.model.psychometrics`,
`6.cardiac.coherence`, `7.multidimensional.database`, `9.knowledge.graph`) directly -- F2 already
read those and froze its own result; this skill only reads F2's output, the same posture this
folder's other graph skill already takes toward F1. Never writes to the database -- purely a
reader.

## Privacy stance

Each point is labeled only by its internal `ID_PERSON` surrogate key, never by
`GDX_PSY_PERSON.NAME` -- same aggregate posture as this folder's other graph skill.

## Options

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F2_GDX_SKILL_LATENT_REP_GRAPH/scripts
npm install                                                       # once, installs node-firebird
node generate_latent_rep_graph.js --sample --dry-run                 # sanity check: embedded sample data, no DB, writes nothing
node generate_latent_rep_graph.js --sample                            # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_latent_rep_graph.js --study <slug> --dry-run            # real run: logs each method's availability, writes nothing
node generate_latent_rep_graph.js --study <slug>                      # real run: writes the HTML page
```

- `--study <slug>` **required** outside `--sample` -- the same slug F1/F2 use, resolved to
  `GDX_PSY_STUDY.ID_STUDY` via `new_study_intake/<slug>/intake.json`'s `study.title`.
- `--pca-run-id <id>` / `--autoencoder-run-id <id>` / `--umap-run-id <id>` optional -- use a
  specific `GDX_HNF_LATENT_RUN.ID_LATENT_RUN` for that one method instead of its latest run for
  this study (F2 never updates a run in place, so a study can have several per method).
- `--top-loadings <n>` optional, default `8` -- how many PCA feature-loading arrows to draw (by
  combined magnitude on the two plotted dimensions). Every loading still appears in that card's
  table regardless.
- `--out-dir <path>` optional, defaults to this folder's own `output/` subfolder (`16.hypotheses.non.fingo/output/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything and logs each method's availability, writing no file.
- `--sample` renders from small, explicitly-labeled embedded sample data covering all three card
  states (PCA with arrows, a method with points only, a method marked unavailable) instead of
  connecting to Firebird.

## Output filename

```
f2_latent_rep_graph__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention this folder's other graph skill uses: `<study-slug>` is the literal `--study`
value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the moment the run
started -- re-running later never overwrites an earlier file.

## Files in this skill

- `scripts/generate_latent_rep_graph.js` -- resolves each method's latest (or explicitly chosen)
  run, reads its first two dimensions/values/(PCA only) loadings, and writes the HTML page
  (Node.js + `node-firebird`, no native client library required)
- `scripts/chart_renderer.js` -- the scatter/biplot-card SVG renderer, the shared self-contained
  HTML page shell, and the (duplicated) reference palette
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
