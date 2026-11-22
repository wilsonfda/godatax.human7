---
name: F1_GDX_SKILL_MFS_GRAPH
description: Given a study slug, reads the real GDX_HNF_* feature-space tables that F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS) already wrote for a ZSCORE run of that study (GDX_HNF_FEATURE_SPACE_RUN, GDX_HNF_FEATURE_RUN_MEMBER, GDX_HNF_FEATURE_DICTIONARY, GDX_HNF_NORMALIZATION_PARAM, GDX_HNF_FEATURE_VALUE) and renders a standalone, English-only HTML page, one chart card per feature, using as its template figure 3.F1 of GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataX_Human7ph_Documento_Unificado_Completo.docx ("Figura -- Curva de referencia e observacao em escala z; valores apenas ilustrativos"): a standard normal reference curve, a dashed line at the reference mean, and one solid rule per real, non-missing observation (never an illustrative placeholder, unlike the document's own figure). Use when the user asks to plot, chart, or visualize the (multidimensional) feature space / z-scores for a study, after MFS has already run for it.
---

# F1_GDX_SKILL_MFS_GRAPH

Renders the output of **F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS)** -- this folder's own
`x(t)`/`z(t)` feature-space model, see that skill's own `SKILL.md` -- as a standalone HTML page.
One chart card per feature in a chosen run, each shaped after this project's own template figure.

## The template

`GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataX_Human7ph_Documento_Unificado_Completo.docx`, section 3
("F1 -- Normalização e comparabilidade"), figure 3.F1: **"Figura -- Curva de referência e
observação em escala z; valores apenas ilustrativos"** (word/media/image2.png) -- a standard
normal density curve (the z-score's reference distribution), a dashed vertical line at the
reference mean (`z=0`), and one solid vertical rule at one illustrative observation
(`z=1,35`), captioned explicitly as illustrative-only values, not real data.

This skill draws the exact same three marks, with one deliberate difference: **every rule it
draws is a real `GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE` row for the study passed via `--study`**,
never a fabricated or illustrative number (this repo's `CLAUDE.md`, "Never invent missing data").
A study typically has many real observations per feature (one per participant with a non-missing
value in that run), not one -- each becomes its own solid rule, so the chart reads as the
reference curve plus a rug of real observations, rather than one placeholder point. The page is
generated entirely in English, regardless of the source document's own Portuguese.

## Why only `NORMALIZATION_METHOD='ZSCORE'` runs

The standard normal curve is only the correct reference distribution for a value expressed "em
escala z" (in z-scale). A `GDX_HNF_FEATURE_SPACE_RUN` produced with `--normalization minmax`
(values rescaled into an arbitrary `[a,b]`) or `--normalization robust` (median/IQR-centered, not
necessarily normal-shaped) would make the shared `N(0,1)` curve this skill draws meaningless for
that run's own values. This skill only ever plots a `ZSCORE` run -- the default (and, as of this
writing, only commonly used) `--normalization` MFS itself defaults to -- and errors out, naming
the run's actual method, if `--run-id` points at a non-`ZSCORE` run.

Because every feature's `NORMALIZED_VALUE` in a `ZSCORE` run is already expressed in units of
*that feature's own* reference mean/std (frozen in `GDX_HNF_NORMALIZATION_PARAM` for that run), the
reference curve is the exact same `N(0,1)` density for every feature -- there is nothing to refit
per feature, and nothing here resembles the document's own illustrative `μ=70, σ=10` example.

## What it reads

```
GDX_HNF_FEATURE_SPACE_RUN        -> which run (latest ZSCORE run for the study, or --run-id)
GDX_HNF_FEATURE_RUN_MEMBER       -> which features were in that run, and in what order
GDX_HNF_FEATURE_DICTIONARY       -> each feature's name, unit, scale direction, perspective
GDX_HNF_PERSPECTIVE              -> each feature's perspective name (Psi/Phi today -- see MFS)
GDX_HNF_NORMALIZATION_PARAM      -> that run's frozen reference mean/std per feature (shown for
                                     traceability in each card's subtitle; the curve itself is
                                     always the standard normal once values are already z-scored)
GDX_HNF_FEATURE_VALUE            -> the real observations plotted, filtered to IS_MISSING=0 AND
                                     NORMALIZED_VALUE IS NOT NULL (a missing or un-normalizable
                                     value is never turned into a fabricated rule)
```

Never writes to the database -- purely a reader, same posture as the two `10.gdx.machine.learning`
skills toward Neo4j. Its only output is the HTML file.

## Features without a plotted curve are reported, never silently dropped

A feature that is a member of the run (`GDX_HNF_FEATURE_RUN_MEMBER`) but has no
`GDX_HNF_NORMALIZATION_PARAM` row (MFS could not normalize it in that run -- insufficient sample
or zero variance) or ends up with zero non-missing `NORMALIZED_VALUE` rows still gets its own card
in its original `FEATURE_ORDER` position, with an explicit "Not plotted: ..." note naming the
reason, instead of silently vanishing from the page.

## Privacy stance -- aggregate, not per-respondent

Each observation is labeled only by its internal `ID_PERSON` surrogate key, **never** by
`GDX_PSY_PERSON.NAME` -- the same posture the aggregate `8.gdx.dashboards` charts (00-08) take,
as opposed to that folder's named per-respondent profile (chart 09). This page is read as "how
this study's z-scores distribute per feature," not as an identified individual's own profile.

## Options

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F1_GDX_SKILL_MFS_GRAPH/scripts
npm install                                                 # once, installs node-firebird
node generate_mfs_graph.js --sample --study sample --dry-run   # sanity check: embedded sample data, no DB, writes nothing
node generate_mfs_graph.js --sample --study sample              # sanity check: embedded sample data, no DB, writes the file
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node generate_mfs_graph.js --study <slug> --dry-run             # real run: logs feature/observation counts and the output filename, writes nothing
node generate_mfs_graph.js --study <slug>                       # real run: writes the HTML page
```

- `--study <slug>` **required** (outside `--sample`, where it only affects the filename) -- the
  same slug `GDX_SKILL_NEW_STUDY`/MFS use, resolved to `GDX_PSY_STUDY.ID_STUDY` via
  `new_study_intake/<slug>/intake.json`'s `study.title`.
- `--run-id <id>` optional -- plot a specific `GDX_HNF_FEATURE_SPACE_RUN.ID_RUN` instead of the
  latest `ZSCORE` run for this study (MFS never updates a run in place, so a study can have
  several; this lets a human compare an older snapshot against a newer one). Errors if that run
  belongs to a different study or is not `ZSCORE`.
- `--feature <text>` optional -- only features whose `FEATURE_CODE` contains this text
  (case-insensitive), e.g. `--feature "CC.HRV"` for the physiological perspective only, or
  `--feature "PSY.VAR."` for the psychometric perspective only.
- `--out-dir <path>` optional, defaults to this folder (`16.hypotheses.non.fingo/`), mirroring
  `8.gdx.dashboards` writing its own charts into its own folder.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (features in scope, observation counts, the output filename)
  and logs it, writing no file.
- `--sample` renders from small, explicitly-labeled embedded sample data (one Psi feature, one Phi
  feature, a handful of fabricated observations) instead of connecting to Firebird -- lets the
  rendering logic be checked with no live database, same convention
  `GDX_SKILL_MAKE_DASHBOARS_DW --sample` uses. The rendered page's own meta line says
  "SAMPLE DATA" in this mode so it is never mistaken for a real run.

## Output filename

```
f1_mfs_graph_reference_curve_zscale__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html
```

Same convention `8.gdx.dashboards` uses for its own chart files: `<study-slug>` is the literal
`--study` value, `<study-title-slug>` is `GDX_PSY_STUDY.TITLE` slugified, `<timestamp>` is the
moment the run started -- so re-running for the same study later never overwrites an earlier
file.

## Chart design

Follows this repo's existing dataviz-skill-derived house style (the same validated categorical
palette and chrome tokens `8.gdx.dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts/chart_lib.js`
uses): 2px lines, hairline solid gridlines, a legend naming all three marks (reference
distribution, mean, observations), hover tooltips on every observation rule (`Person #<id>`, raw
value, z value), light/dark theme via CSS custom properties, and a per-card table-view fallback
toggle. Slot 1 (blue) draws the reference curve and slot 2 (orange) draws observations -- the same
two hues the template figure itself uses for its curve and its single illustrative rule. With many
observations, each rule's opacity backs off so overlapping rules read as density rather than one
solid wash, instead of drawing only one rule per feature the way the template does.

`scripts/chart_renderer.js` and its palette/page-shell constants are duplicated from (not
`require()`'d out of) `8.gdx.dashboards`'s own `chart_lib.js`, per this repo's "each numbered
folder is close to self-contained" convention (`CLAUDE.md`, "Folder map").

## Files in this skill

- `scripts/generate_mfs_graph.js` -- resolves `--study`'s run, reads the `GDX_HNF_*` tables (or
  builds embedded `--sample` data), and writes the HTML page (Node.js + `node-firebird`, no native
  client library required)
- `scripts/chart_renderer.js` -- the reference-curve-card SVG renderer, the shared self-contained
  HTML page shell, and the (duplicated) reference palette
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `../../hypotheses_non_fingo_feature_space_model_firebird25.sql` -- DDL for the `GDX_HNF_*` tables
  this skill reads (must already be applied, and MFS must already have run at least once for this
  study, before this skill has anything to plot)
