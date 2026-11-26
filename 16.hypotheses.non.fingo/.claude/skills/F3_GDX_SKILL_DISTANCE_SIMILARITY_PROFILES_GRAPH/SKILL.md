---
name: F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH
description: Given a study slug, reads the real GDX_HNF_DISTANCE_* tables F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES already wrote (GDX_HNF_DISTANCE_RUN, GDX_HNF_DISTANCE_DIMENSION, GDX_HNF_DISTANCE_COVARIANCE) -- plus, transitively through that run's own FK, the real per-person coordinates still frozen in GDX_HNF_FEATURE_VALUE or GDX_HNF_LATENT_VALUE -- and renders a standalone, English-only HTML page with two cards: (1) constant-Mahalanobis-distance curves over a real 2-dimension marginal of a Mahalanobis run's own stored covariance matrix, with the real complete-case scatter overlaid on top (an anisotropic distribution shown honestly, never a fabricated illustration), and (2) a scatter between two real dimensions of the same run, annotated with their real Pearson correlation coefficient (a statistical association, never a causal claim). Use when the user asks to plot, chart, or visualize Mahalanobis/covariance geometry or the association between two dimensions for a study, after F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES has already run --metric mahalanobis for it.
---

# F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH

Renders the output of **F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES** (F3) -- this folder's
distance/similarity model, see that skill's own `SKILL.md` -- as a standalone HTML page. Two
cards, built from one chosen `GDX_HNF_DISTANCE_RUN` with `METRIC='MAHALANOBIS'`.

## Card 1 -- constant-Mahalanobis-distance curves (2-D marginal)

A 2x2 submatrix of the run's own, already-stored `GDX_HNF_DISTANCE_COVARIANCE` (the real sample
covariance for two chosen dimensions, never recomputed from scratch) defines a family of ellipses:
the set of points at constant Mahalanobis distance `r` from the sample mean, for
`r` in `--ellipse-radii` (default `1,2,3`). Overlaid on top is the real scatter of the same run's
own complete-case persons on those same two dimensions -- so if the real data is anisotropic
(two dimensions correlated, or with unequal variance), both the ellipses and the point cloud show
it as it really is, never as an illustrative stand-in.

**Equal pixel scale on both axes is mandatory for this card.** An independently-scaled x/y plot
(the usual convention for a generic scatter) would stretch or compress the ellipse relative to the
point cloud and could visually fabricate anisotropy that is not really there, or hide anisotropy
that is -- so this one chart deliberately breaks from that convention and uses one shared
pixels-per-unit factor for both axes.

The ellipse is drawn from the **raw, unregularized** covariance entries (`COV_VALUE`), even on a
run whose own full-dimension `dM` pairwise values used a shrinkage-regularized inverse (see F3's
`SKILL.md`, "Mahalanobis and regularization") -- a 2x2 submatrix of a real covariance matrix is
essentially always well-conditioned on its own, and the card's own note says so explicitly when
the parent run applied regularization, so the two views are never conflated.

## Card 2 -- association between two dimensions

A plain scatter between two of the run's own dimensions, annotated with their real Pearson
correlation coefficient `r`, computed fresh from the same real complete-case matrix the rest of
this page uses. `--assoc-dim-a`/`--assoc-dim-b` pick the pair explicitly; left unset, this skill
auto-selects the pair with the largest real `|r|` among every pair of the run's own dimensions,
**preferring a pair that spans two different perspectives** when one exists with real data in
this run (today, a run built with `--feature "PSY.VAR."` has only psychometric dimensions in
scope, so the auto-selection falls back to the strongest real association within that one
perspective -- the card's own note says this explicitly rather than silently presenting a
same-perspective pair as if it were cross-perspective). A latent-space run has no single
perspective per dimension, so the preference does not apply there.

## Why this reads GDX_HNF_FEATURE_VALUE/GDX_HNF_LATENT_VALUE -- and only those two dimensions

`GDX_HNF_DISTANCE_RUN`/`GDX_HNF_DISTANCE_DIMENSION`/`GDX_HNF_DISTANCE_COVARIANCE` are F3's own
output, and the only thing this skill treats as authoritative for the run's own statistics (the
covariance entries drawn as ellipses are never recomputed). But that schema stores pairwise
distances and the covariance matrix only -- never raw per-person coordinates -- so there is no
other real source for the scatter overlay on either card. This skill resolves, via the distance
run's own `ID_INPUT_FEATURE_RUN`/`ID_INPUT_LATENT_RUN` pointer, the exact upstream F1
(`GDX_HNF_FEATURE_VALUE`) or F2 (`GDX_HNF_LATENT_VALUE`) rows needed -- restricted to only the
dimensions that are actually members of the chosen distance run, and only the same complete-case
persons that run's own `PERSON_COUNT` was computed from. This is the same "transitively satisfied"
reading posture F3's own compute script already documents one layer down (toward
`2.relational.model.psychometrics`/`6.cardiac.coherence`/`7.multidimensional.database`/
`9.knowledge.graph`), applied one layer further here, purely for the chart -- never an independent
re-derivation of which dimensions are in scope, that answer already comes from
`GDX_HNF_DISTANCE_DIMENSION`.

Never writes to the database -- purely a reader, same posture as this folder's other two graph
skills toward F1/F2.

## What it reads

```
GDX_HNF_DISTANCE_RUN         -> which run (latest METRIC='MAHALANOBIS' run for the study, or --run-id)
GDX_HNF_DISTANCE_DIMENSION   -> that run's own dimensions (feature or latent), and their order
GDX_HNF_DISTANCE_COVARIANCE  -> the real covariance entries drawn as ellipses (card 1 only)
GDX_HNF_FEATURE_VALUE        -> SPACE_KIND='FEATURE_SPACE': real per-person values on the run's
                                 own dimensions (reduced to one scalar per person exactly as F3's
                                 own compute script does)
GDX_HNF_FEATURE_DICTIONARY   -> feature code/name/perspective, to label dimensions and decide the
                                 association card's cross-perspective preference
GDX_HNF_LATENT_VALUE         -> SPACE_KIND='LATENT': real per-person coordinates on the run's own
                                 latent dimensions
GDX_HNF_LATENT_DIMENSION     -> latent dimension labels
```

## Privacy stance

Each point is labeled only by its internal `ID_PERSON` surrogate key, never by
`GDX_PSY_PERSON.NAME` -- same aggregate posture as this folder's other two graph skills.

## Options

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH/scripts
npm install                                               # once, installs node-firebird
node generate_distance_similarity_graph.js --sample --dry-run   # sanity check: embedded sample data, no DB, writes nothing
node generate_distance_similarity_graph.js --sample               # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_distance_similarity_graph.js --study <slug> --dry-run     # real run: logs the resolved dimensions/pair/filename, writes nothing
node generate_distance_similarity_graph.js --study <slug>               # real run: writes the HTML page
```

- `--study <slug>` **required** outside `--sample` -- the same slug F1/F2/F3 use, resolved to
  `GDX_PSY_STUDY.ID_STUDY` via `new_study_intake/<slug>/intake.json`'s `study.title`.
- `--run-id <id>` optional -- a specific `GDX_HNF_DISTANCE_RUN.ID_DISTANCE_RUN` with
  `METRIC='MAHALANOBIS'` instead of the study's latest such run. Errors if that run belongs to a
  different study or is not `MAHALANOBIS` (only a Mahalanobis run has a covariance matrix).
- `--ellipse-dim-a <order>` / `--ellipse-dim-b <order>` which two of the run's own dimensions (by
  `DIMENSION_ORDER`) card 1 plots. Default `1` and `2`.
- `--ellipse-radii <csv>` constant-Mahalanobis-distance values to draw, comma-separated. Default
  `1,2,3`.
- `--assoc-dim-a <order>` / `--assoc-dim-b <order>` which two dimensions card 2 plots. Default:
  auto-selected (see "Card 2" above).
- `--out-dir <path>` optional, defaults to this folder's own `output/` subfolder (`16.hypotheses.non.fingo/output/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (resolved dimensions, chosen pair, person counts) and logs it,
  writing no file.
- `--sample` renders from small, explicitly-labeled embedded synthetic data (one correlated,
  anisotropic pair for card 1; one separately correlated pair for card 2) instead of connecting to
  Firebird.

## Output filename

```
f3_distance_similarity_graph__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention this folder's other two graph skills use: `<study-slug>` is the literal `--study`
value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the moment the run
started -- re-running later never overwrites an earlier file.

## Files in this skill

- `scripts/generate_distance_similarity_graph.js` -- resolves the Mahalanobis distance run, the
  real per-person coordinates on its dimensions (via F1/F2's own tables), the covariance entries,
  and the association pair, and writes the HTML page (Node.js + `node-firebird`, no native client
  library required)
- `scripts/chart_renderer.js` -- the ellipse-card and association-scatter-card SVG renderers (2x2
  eigen-decomposition, equal-aspect-ratio scaling, Pearson correlation), the shared self-contained
  HTML page shell, and the (duplicated) reference palette
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
