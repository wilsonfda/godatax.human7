---
name: F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH
description: Given a study slug, reads the real GDX_HNF_CDI_* tables F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS already wrote (GDX_HNF_CDI_RUN, GDX_HNF_CDI_RUN_FEATURE, GDX_HNF_CDI_VALUE, GDX_HNF_CDI_VALUE_DETAIL, GDX_HNF_CDI_REFERENCE_SET) and renders a standalone, English-only HTML page with three cards: (1) a histogram of every complete-case person's own real CDIx(t)/CDIx_w(t) in one chosen run, (2) a per-feature ranking of the real RMS contribution to that run's own CDI (never a fabricated illustration, computed from GDX_HNF_CDI_VALUE_DETAIL), and (3) one diverging bar chart per representative person (the run's own lowest, median-closest and highest CDI) showing that real person's own full per-feature signed difference vector. Use when the user asks to plot, chart, or visualize the Curvature Depth Index, a CDI dashboard, or what drives a CDI value for a study, after F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS has already run for it.
---

# F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH

Renders the output of **F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS** (F4) -- this folder's Curvature
Depth Index model, see that skill's own `SKILL.md` -- as a standalone HTML page. Three cards, built
from one chosen `GDX_HNF_CDI_RUN`.

## Card 1 -- CDI distribution

A histogram of `CDI_VALUE` across every complete-case person in the chosen run, with dashed
markers at the run's own real mean and median. Shows how displaced from the reference this run's
whole sample is, and how spread out that displacement is -- never a single aggregate number
standing in for the whole distribution.

## Card 2 -- per-feature contribution ranking

For each feature in the run, the RMS of that feature's own real signed difference
(`current − reference`) across every complete-case person (`sqrt(mean(DIFFERENCE^2))`, computed
by the database from `GDX_HNF_CDI_VALUE_DETAIL`, never re-derived by an approximation), sorted
descending. This is exactly the breakdown F4's own schema stores so it is never discarded behind
the single aggregate CDI scalar -- summarizing a multivariate displacement into one number
necessarily hides which features move the most; this card answers that directly. On a `WEIGHTED`
run, each bar's own `w_j` is shown alongside its RMS difference (a feature can have a large RMS
difference and still contribute little to the final CDI if its weight is small, or vice versa --
the two numbers are shown together so that distinction stays visible).

## Card 3 -- representative person profiles

Three diverging bar charts, one per representative person in the run: the person with the
**lowest** CDI, the person whose CDI sits **closest to the run's median**, and the person with the
**highest** CDI. Each shows that one real person's own complete per-feature difference vector
(`GDX_HNF_CDI_VALUE_DETAIL.DIFFERENCE`) as bars diverging from zero -- positive (current above
reference) in one color, negative (current below reference) in another. Per this layer's own
mathematical foundation, an aggregate CDI "loses the information of direction"; recovering *what
actually changed* for a concrete person requires exactly this per-feature view, which is why it is
rendered here rather than left to a manual query.

## Why this reads GDX_HNF_CDI_VALUE_DETAIL directly, never GDX_HNF_FEATURE_VALUE

Unlike `F1_GDX_SKILL_MFS_GRAPH`/`F2_GDX_SKILL_LATENT_REP_GRAPH`/
`F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH` (which sometimes read back through to F1/F2's own
raw coordinate tables), this skill never needs to -- F4 already stored both the current and
reference coordinates, and their difference, per feature per person
(`GDX_HNF_CDI_VALUE_DETAIL.CURRENT_VALUE`/`REFERENCE_VALUE`/`DIFFERENCE`). Reading that table
directly is strictly more precise than recomputing the same numbers from `GDX_HNF_FEATURE_VALUE`
and `GDX_HNF_CDI_REFERENCE_VALUE` a second time, and guarantees this chart always matches exactly
what F4 itself computed and froze.

## What it reads

```
GDX_HNF_CDI_RUN             -> which run (latest for the study, or --cdi-run-id)
GDX_HNF_CDI_REFERENCE_SET   -> that run's own reference type/label, for the page's own meta line
GDX_HNF_CDI_RUN_FEATURE     -> that run's own features, order and weights
GDX_HNF_CDI_VALUE           -> the real CDI scalar per complete-case person (card 1, and to pick
                                the three representative persons for card 3)
GDX_HNF_CDI_VALUE_DETAIL    -> the real per-feature signed difference (cards 2 and 3)
```

Never writes to the database -- purely a reader, same posture as this folder's other three graph
skills toward F1/F2/F3. Never re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph`, and never re-computes a CDI value on its own.

## Privacy stance

Each person is labeled only by their internal `ID_PERSON` surrogate key, never by
`GDX_PSY_PERSON.NAME` -- same aggregate posture as this folder's other three graph skills.

## Options

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH/scripts
npm install                                                 # once, installs node-firebird
node generate_curvature_depth_graph.js --sample --dry-run   # sanity check: embedded sample data, no DB, writes nothing
node generate_curvature_depth_graph.js --sample               # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_curvature_depth_graph.js --study <slug> --dry-run     # real run: logs the resolved CDI run/counts, writes nothing
node generate_curvature_depth_graph.js --study <slug>               # real run: writes the HTML page
```

- `--study <slug>` **required** outside `--sample` -- the same slug F1/F2/F3/F4 use, resolved to
  `GDX_PSY_STUDY.ID_STUDY` via `new_study_intake/<slug>/intake.json`'s `study.title`.
- `--cdi-run-id <id>` optional -- a specific `GDX_HNF_CDI_RUN.ID_CDI_RUN` instead of the study's
  latest. Errors if that run belongs to a different study.
- `--out-dir <path>` optional, defaults to this folder (`16.hypotheses.non.fingo/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (resolved run, feature/person counts, representative persons,
  output filename) and logs it, writing no file.
- `--sample` renders from small, explicitly-labeled embedded synthetic data (eight synthetic
  persons, four synthetic features, both positive and negative differences) instead of connecting
  to Firebird.

## Output filename

```
f4_curvature_depth_index_graph__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention this folder's other three graph skills use: `<study-slug>` is the literal
`--study` value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the
moment the run started -- re-running later never overwrites an earlier file.

## Files in this skill

- `scripts/generate_curvature_depth_graph.js` -- resolves the chosen `GDX_HNF_CDI_RUN`, its
  features/weights, its complete-case CDI values, the real per-feature RMS contribution
  (aggregated by the database), and the three representative persons' own detail rows, then
  writes the HTML page (Node.js + `node-firebird`, no native client library required)
- `scripts/chart_renderer.js` -- the histogram, feature-ranking and diverging-profile SVG
  renderers, the shared self-contained HTML page shell, and the (duplicated) reference palette
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
