---
name: F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH
description: Given a study slug, reads the real GDX_HNF_CDI_COMPARE_* rows F4_CURV_DEPTH_KPI_COMPARE_MODEL already wrote (GDX_HNF_CDI_COMPARE_RUN, GDX_HNF_CDI_COMPARE_VALUE), plus GDX_HNF_CDI_RUN/GDX_HNF_CDI_REFERENCE_SET (F4) and GDX_HNF_CDIH_RUN/GDX_HNF_CDIH_REFERENCE_SET/GDX_HNF_LATENT_RUN (F4-alternative) for the two source runs' own labels, and renders a standalone, English-only HTML page with three cards: (1) two histograms side by side -- CDIx's own distribution and CDIh's own distribution -- over the same paired-person set, each on its own scale, (2) a scatter of (CDIx, CDIh) per paired person annotated with the real Pearson r (computed here, at render time, from the frozen paired values -- never stored by the compute layer), and (3) a back-to-back bar panel for the three representative persons (lowest/median-closest/highest CDIx among the paired set, with their CDIx/CDIh rank also computed here) showing their real CDIx and CDIh side by side on two independent scales. Shaped after this project's own design document section 7.1, figure "Figura -- Comparacao puramente ficticia de indices em dois espacos; valores nao sao uma avaliacao de desempenho" -- unlike that document's own fictitious single-pair example, every value here is real and paired. Use when the user asks to plot, chart, or visualize the comparison between CDIx and CDIh, a CDIx-vs-CDIh dashboard, or this project's "two spaces" comparison figure for a study, after F4_CURV_DEPTH_KPI_COMPARE_MODEL has already run for it.
---

# F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH

Renders the output of **F4_CURV_DEPTH_KPI_COMPARE_MODEL** -- this folder's F4 comparison layer,
see that skill's own `SKILL.md` -- as a standalone HTML page. Three cards, built from one chosen
`GDX_HNF_CDI_COMPARE_RUN`.

## Why this reads GDX_HNF_CDI_COMPARE_VALUE, never GDX_HNF_CDI_VALUE/GDX_HNF_CDIH_VALUE directly

`F4_CURV_DEPTH_KPI_COMPARE_MODEL` already paired every person present in both a chosen
`GDX_HNF_CDI_RUN` and a chosen `GDX_HNF_CDIH_RUN`, excluding (and counting) anyone present in only
one, and froze the result into `GDX_HNF_CDI_COMPARE_VALUE`. Reading that table directly is
strictly simpler and more precise than re-pairing the two source runs a second time, and
guarantees this page always matches exactly what that skill computed and froze.

## What this skill computes itself, at render time -- and why that is not a layering violation

This skill computes **Pearson r**, **each person's own CDIx/CDIh rank among the paired set**, and
the **three representative persons** (lowest/median-closest/highest CDIx) directly from the
already-frozen `GDX_HNF_CDI_COMPARE_VALUE` rows, every time it renders. None of these three are
stored anywhere. This is the same posture this folder's other GRAPH skills already take toward
their own lightweight, deterministic, non-persisted descriptive statistics -- `F3_GDX_SKILL_
DISTANCE_SIMILARITY_PROFILES_GRAPH`'s own Pearson r between two real dimensions, or any F4 GRAPH
skill's own histogram mean/median and per-feature RMS contribution ranking -- never computed by
the compute layer underneath, always recomputed from already-frozen raw numbers at the moment a
chart is drawn. The dividing line this project draws is not "a GRAPH skill never computes
anything": it is "a GRAPH skill never computes or freezes a new scored *result*" -- Pearson r,
a rank, or a "representative" label is a view of already-frozen numbers, not a new result.

## Card 1 -- paired distributions, two spaces

Two histograms side by side, over the SAME paired-person set this run froze: `CDIx` on its own
axis (normalized feature space) and `CDIh` on its own, separate axis (this run's fitted latent
space, labeled with its own `METHOD`). Each panel marks its own real mean/median -- deliberately
**not** overlaid on one shared axis, since the two indices are not on a common scale.

## Card 2 -- CDIx vs. CDIh scatter, with Pearson r

One point per paired person: `CDIx` on the x-axis, `CDIh` on the y-axis, annotated with the real
Pearson correlation coefficient of this run's own paired sample (computed here, see above). This
is the "test the association" comparison this project's own design document calls for -- a
descriptive statistic about whether the two indices move together across persons, **never** a
claim that they measure the same thing, **never** a causal statement, and **never** evidence that
one space or algorithm is "better". With fewer than 3 paired persons, `r` is reported as
"insufficient paired persons", never fabricated from too few points.

## Card 3 -- representative persons, side by side

The three representative roles this folder's other F4 graph skills already use -- **lowest**,
**closest to median**, and **highest** `CDIx` among the paired set -- shown as two independent
horizontal bars per person: their real `CDIx` (its own axis/scale) and their real `CDIh` (its own,
separate axis/scale), each annotated with that person's own rank (computed here) in both spaces.
Concretely demonstrates this project's own point: a person ranked low/median/high by `CDIx` need
not hold the same rank under `CDIh`.

## What it reads

```
GDX_HNF_CDI_COMPARE_RUN     -> which run (latest for the study, or --compare-run-id)
GDX_HNF_CDI_COMPARE_VALUE   -> the real, already-paired CDIx/CDIh scalar per person (all three cards)
GDX_HNF_CDI_RUN             -> the CDIx source run's own label/weighting, for the page's meta line
GDX_HNF_CDI_REFERENCE_SET   -> the CDIx source run's own reference type/label
GDX_HNF_CDIH_RUN            -> the CDIh source run's own label/weighting, for the page's meta line
GDX_HNF_CDIH_REFERENCE_SET  -> the CDIh source run's own reference type/label
GDX_HNF_LATENT_RUN          -> the CDIh source run's own evaluated METHOD (PCA/AUTOENCODER/UMAP)
```

Never reads `GDX_HNF_CDI_VALUE`, `GDX_HNF_CDIH_VALUE`, `GDX_HNF_CDI_VALUE_DETAIL`,
`GDX_HNF_CDIH_VALUE_DETAIL`, `GDX_HNF_FEATURE_VALUE` or `GDX_HNF_LATENT_VALUE` directly -- F4's
comparison layer already consumed what it needed from the first two and froze everything this page
needs. Never writes to the database -- purely a reader, same posture as this folder's other graph
skills. Never re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph`, and never re-pairs the two source runs.

## Privacy stance

Each person is labeled only by their internal `ID_PERSON` surrogate key, never by
`GDX_PSY_PERSON.NAME` -- same aggregate posture as this folder's other graph skills.

## Options

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH/scripts
npm install                                                          # once, installs node-firebird
node generate_curvature_depth_compare_graph.js --sample --dry-run   # sanity check: embedded sample data, no DB, writes nothing
node generate_curvature_depth_compare_graph.js --sample             # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_curvature_depth_compare_graph.js --study <slug> --dry-run     # real run: logs the resolved run/pairing, writes nothing
node generate_curvature_depth_compare_graph.js --study <slug>               # real run: writes the HTML page
node generate_curvature_depth_compare_graph.js --study <slug> --compare-run-id <id>  # a specific compare run instead of the study's latest
```

- `--study <slug>` **required** outside `--sample` -- the same slug F1/F2/F3/F4/F4-alternative/
  `F4_CURV_DEPTH_KPI_COMPARE_MODEL` use.
- `--compare-run-id <id>` optional -- a specific `GDX_HNF_CDI_COMPARE_RUN.ID_COMPARE_RUN` instead
  of the study's latest. Errors if that run belongs to a different study.
- `--out-dir <path>` optional, defaults to this folder's own `output/` subfolder (`16.hypotheses.non.fingo/output/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (resolved run, paired count, representative persons, Pearson r,
  output filename) and logs it, writing no file.
- `--sample` renders from small, explicitly-labeled embedded synthetic data (eight synthetic
  persons with both a synthetic CDIx and CDIh, deliberately rank-shuffled between the two)
  instead of connecting to Firebird.

## Output filename

```
f4_curvature_depth_index_compare_graph__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention this folder's other graph skills use: `<study-slug>` is the literal `--study`
value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the moment the run
started -- re-running later never overwrites an earlier file.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (`--study 1`),
rendering `ID_COMPARE_RUN=2` (pairing `ID_CDI_RUN=3` against `ID_CDIH_RUN=4`, 422 paired persons,
0 excluded on either side): person `#822` is the highest-`CDIx` AND highest-`CDIh` person (rank
422/422 in both), while person `#784` -- the lowest-`CDIx` person (rank 1/422) -- sits only at
rank 157/422 under `CDIh`, a concrete, real example of the "ranks need not agree between the two
spaces" point this skill exists to show. `--sample` renders from embedded synthetic data with
deliberately shuffled ranks, no DB.

## What this skill will never do

- **Never computes `CDIx` or `CDIh`**, and never re-pairs the two source runs -- that stays
  `F4_CURV_DEPTH_KPI_COMPARE_MODEL`'s own job; this skill only reads its already-frozen rows back.
- **Never plots the two indices on one shared axis/scale**, and never computes or implies a
  conversion factor between them -- they live in two different, generally non-comparable spaces.
- **Never treats a higher Pearson r as evidence the two indices are "the same" index**, and never
  computes `r` from fewer than 3 paired persons.
- **Never treats agreement or disagreement between a person's `CDIx` and `CDIh` rank as evidence of
  causality, a clinical condition, or a validated correspondence to a chakra, a Thomistic Way or a
  septenary level.**

## Files in this skill

- `scripts/generate_curvature_depth_compare_graph.js` -- resolves the chosen
  `GDX_HNF_CDI_COMPARE_RUN` and its two source runs' own labels, loads the real paired
  `GDX_HNF_CDI_COMPARE_VALUE` rows, computes Pearson r/ranks/representative persons, then writes
  the HTML page (Node.js + `node-firebird`, no native client library required)
- `scripts/chart_renderer.js` -- the paired-histogram, scatter-with-correlation and
  representative-pair-bars SVG renderers, the Pearson r / rank / representative-person helpers,
  the shared self-contained HTML page shell, and the (duplicated) reference palette
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
