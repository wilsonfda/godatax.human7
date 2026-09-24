---
name: GDX_SKILL_MAKE_DASHBOARS_DW
description: Generates 9 self-contained HTML charts (a small-multiples response-vs-factor-analysis line chart, multi-dimension line, bar, 4 heatmaps, a chakra gradient portrait, and a Septenary Constitution gradient portrait) from the GDX_HUMAN data warehouse (7.multidimensional.database) plus, for chart 0 only, the psychometric-properties catalog (2.relational.model.psychometrics), scoped to one study passed in via --study <slug>, each an interesting cross-perspective read on the data described in GoDataX_Human_7_DW.md. Pass --chart <code> to generate just one chart instead of all 9. Use when the user asks for dashboards, charts, or visualizations of a specific GDX_HUMAN study.
---

# GDX_SKILL_MAKE_DASHBOARS_DW

Reads `7.multidimensional.database` (see `GoDataX_Human_7_DW.md`) and writes 9 standalone `.html` chart files, each openable directly in a browser — no server, no external CDN, no native dependency (pure `node-firebird` wire-protocol connection, same as the other two `GDX_SKILL_*` skills in `GDX_HUMAN`).

## Scoped to one study

Every run requires `--study <slug>` — the same slug `GDX_SKILL_NEW_STUDY` used for
`new_study_intake/<slug>/intake.json`. Every chart's study-scoped data is filtered to **only that
study's people**: the slug resolves to the study's title (from its `intake.json`), the title resolves
to `GDX_PSY_STUDY.ID_STUDY`, and the relevant query joins `DW_DIM_PERSON` on `ID_STUDY = ?` (the same
column `GDX_SKILL_LOAD_NEW_STUDY_DW` populates when it first loads a person for that study — see
`GoDataX_Human_7_DW.md` section 8). The one exception is chart 0's bottom panel (EFA/CFA factor
loadings, from `GDX_PSY_PSYCHOMETRIC_PROPERTY`) — that table has no `ID_STUDY` column at all, so it is
always read in full, same as the "always exported in full" global tables `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`
documents. Running the skill again for a different study produces a completely separate set of files;
it never mixes two studies' people into one chart.

Every output filename carries the study's slug, its title (slugified), and the moment that run was
generated — `dashboard_0N_<chart>__<slug>__<title-slug>__<YYYYMMDD-HHMMSS>.html` — so re-running for
the same study later (e.g. after more participants answer) never overwrites an earlier run's files.

Charts follow the **dataviz** skill's method: fixed categorical hue order, single-hue sequential ramp for magnitude, thin marks, a legend, direct labels, hover tooltips, light/dark theme via CSS custom properties, and a table-view fallback toggle on every chart.

## The 9 charts

| # | File (base name, before the `__<slug>__<title>__<timestamp>` suffix) | Type | What it shows | Why this form |
|---|---|---|---|---|
| 0 | `dashboard_00_means_psychometric_responses` | Line, small multiples (2 panels) | Pure-psychometric perspective (cardiac coherence excluded on purpose): one instrument per x-axis position. Top panel — mean response score participants actually gave (`DW_FACT_PSY_VARIABLE_RESULT.RAW_SCORE`, study-scoped). Bottom panel — mean `\|`loading`\|` per instrument from `GDX_PSY_PSYCHOMETRIC_PROPERTY`, one line for `EFA_FACTOR_LOADING` (exploratory) and one for `STD_FACTOR_LOADING` (confirmatory/CFA); that table has no `ID_STUDY` column, so this half is never study-scoped. | Response score (≈1–5 Likert, not even uniform across instruments) and factor loading (-1 to 1) are different quantities entirely — one shared y-axis would be the dual-axis anti-pattern the dataviz skill flags as the #1 chart mistake, and there's no natural "instrument zero" to index to (unlike chart 1's BASELINE phase), so each gets its own panel (small multiples) instead. Today only the Career Adapt-Abilities Scale has any EFA/CFA rows — every other instrument's bottom-panel point is absent, not zero. |
| 1 | `dashboard_01_physiological_response` | Line, 4 series | Coherence Index, Heart Rate, RMSSD, SDNN across the 5 cardiac-coherence protocol phases (`DW_FACT_CC_HRV_WINDOW`), for this study's people only, each **indexed to its own BASELINE = 100** | The 4 metrics are on different units (ms, bpm, a 0–1 index) — plotting raw values on one shared axis would be the dual-axis anti-pattern the dataviz skill flags as the #1 chart mistake. Indexing to a common base is the documented fix. |
| 2 | `dashboard_02_score_by_septenary_level` | Bar | Average psychometric `RAW_SCORE` grouped by `DW_DIM_SEPTENARY_LEVEL`, for this study's participants | The simplest version of the cross-perspective question the whole DW exists to answer: does any level of consciousness score systematically higher/lower across this study's participants? |
| 3 | `dashboard_03_instrument_by_level_heatmap` | Heatmap | Average score per (instrument × septenary level) cell, this study only | A radar/spider chart was the obvious "3rd type" instinct for 7 levels, but the dataviz skill's anti-patterns flag radar charts for distorting area/angle — a single-hue heatmap reads magnitude per cell accurately instead, and additionally shows *which instruments concentrate at one level vs. spread across several*, which a radar chart can't show at all. |
| 4 | `dashboard_04_instrument_by_cardiac_coherence_heatmap` | Heatmap | Average score per (instrument × cardiac-coherence `STRESS_CLASS`) cell, this study only | Same reasoning as #3, applied to the physiological perspective. No direct fact links an instrument to a session, so this joins through the shared `DW_DIM_PERSON` — it only has data for people who did both the psychometric battery and a coherence session, within this study. |
| 5 | `dashboard_05_instrument_by_kundalini_chakra_heatmap` | Heatmap | Average score per (instrument × chakra) cell, this study only | Each chakra maps 1:1 to a septenary level (`DW_DIM_CHAKRA.ID_SEPTENARY_LEVEL`), so this is chart 3's exact numbers, relabeled through the energetic/chakra lens instead of the "level" lens. |
| 6 | `dashboard_06_instrument_by_five_ways_heatmap` | Heatmap | Average score per (instrument × Aquinas's Five Ways) cell, this study only | Ways map N:1 to a level (several ways can share one — see `five_ways_septenary_map_firebird25.sql`), so a level's score repeats across every way built on it; levels with no way at all (Physical, Vital/Etheric, Astral, Atmic/Spirit) are empty here even where chart 3/5 have data. |
| 7 | `dashboard_07_chakra_gradient_portrait` | Figure (meditating silhouette, 7 marks) | The traditional 7-chakra illustration (`4.kundalini.chakras/MMPC7_4_Ilustracion.webp`), each chakra's circle colored by a computed single-hue gradient instead of its fixed rainbow color, driven by chart 5's join collapsed to **one average score per chakra** | Same relation as chart 5, at coarser grain: not "which instrument scores what at this chakra" but "what does this chakra score, overall" — read as a picture instead of a table. Uses the dataviz sequential ramp, continuously interpolated between steps (not floored into buckets the way the heatmaps are) since only 7 marks are on screen and the real scores cluster tightly. |
| 8 | `dashboard_08_septenary_constitution_gradient_portrait` | Figure (Individuality triangle over Personality stack, 7 bands) | The Septenary Constitution diagram (`3.septenary.constitution/septenaria.webp`), each of its 7 bands colored by the same computed single-hue gradient as chart 7, driven by chart 2's exact data (**one average score per septenary level**) | Chart 2's bar-chart numbers, replotted onto the diagram they were always secretly describing — the triangle (Atma/Buddhi/Manas, levels 7-6-5) over the stack (Kama-manas/Kama Rupa/Vital-Etheric/Physical, levels 4-3-2-1). Same continuous-interpolation method as chart 7, for the same reason (only 7 bands on screen, real scores cluster tightly). |

All four heatmaps share one pivot helper (`buildInstrumentHeatmapHtml` in `make_dashboards.js`) — only the query and the fixed column list differ between them. Every study-scoped query (charts 0's top panel, 1–6, 8) joins `DW_DIM_PERSON` and filters `WHERE P.ID_STUDY = ?` on the id resolved from `--study`; chart 0's bottom panel reads `GDX_PSY_PSYCHOMETRIC_PROPERTY` directly (OLTP, no `ID_STUDY` column — global reference data, same bucket `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` classifies it in).

## Running it

```
cd 8.gdx.dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts
npm install                 # once, installs node-firebird
node make_dashboards.js --sample --study <slug>            # sanity check: embedded sample data, no DB connection, writes all 9 files
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node make_dashboards.js --study <slug>                     # real run against the live DW, scoped to that one study, all 9 charts
node make_dashboards.js --study <slug> --chart 00           # real run, ONLY chart 0 (means: responses vs. EFA/CFA) -- skips the other 8 queries entirely
```

`--study <slug>` is **required** — the same slug `GDX_SKILL_NEW_STUDY` used for
`new_study_intake/<slug>/intake.json` (resolved automatically from this script's location; pass
`--intake-dir <path>` if that intake lives somewhere else). In real mode, the slug's `intake.json`
must already exist and its `study.title` must already be a row in `GDX_PSY_STUDY` (i.e.
`GDX_SKILL_RECORD_NEW_STUDY` and `GDX_SKILL_LOAD_NEW_STUDY_DW` must have already run for it) — the
skill errors out with a clear message otherwise. In `--sample` mode, a missing `intake.json` is not
an error: the filename just falls back to a generic "Sample Study" title.

`--chart <code>` is **optional**, one of `00`–`08` (the `#` column above). Passing it generates only
that one chart's file, and only issues that chart's own queries (no wasted round-trips against the
other 8). Omit it to generate all 9, exactly as before this flag existed.

Output defaults to `8.gdx.dashboards/` (pass `--out-dir <path>` to change it), with filenames shaped
`dashboard_0N_<chart>__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html` — see "Output
filenames" below. A chart is skipped (not written) if its query returns no rows for this study —
check the console output before assuming all 9 exist (e.g. chart 1 and chart 4 both depend on
`DW_FACT_CC_HRV_WINDOW`, which is empty until a cardiac-coherence session is loaded for a person, in
this study, that already exists in `DW_DIM_PERSON` — see `GoDataX_Human_7_DW.md` §6; chart 7 is
skipped only if chart 5's underlying join returns nothing at all for this study, and chart 8 only if
chart 2's underlying join returns nothing, since both are the same joins at a coarser grain; chart 0
is only skipped if its instrument list itself is empty — its EFA/CFA columns going entirely blank
for every instrument except the Career Adapt-Abilities Scale is expected, not a skip condition).

## Output filenames

Every file is named `<base-name>__<study-slug>__<study-title-slug>__<timestamp>.html`, e.g.:

```
dashboard_02_score_by_septenary_level__workplace-resilience-pilot__workplace-resilience-pilot-study__20260917-143022.html
```

- `<study-slug>` — the literal `--study` value.
- `<study-title-slug>` — the study's `GDX_PSY_STUDY.TITLE` (from its `intake.json`), lowercased,
  accents stripped, non-alphanumeric runs collapsed to `-`, capped at 60 characters.
- `<timestamp>` — `YYYYMMDD-HHMMSS`, the moment this run started (one shared timestamp for every file
  written in a single run — all 9 by default, or just the one named by `--chart`).

This means two different runs — for two different studies, or the same study re-run later — never
collide or overwrite each other's files.

## Files in this skill

- `scripts/chart_lib.js` — the 5 renderers (`renderLineChart`, `renderBarChart`, `renderHeatmap`, `renderChakraPortrait`, `renderSeptenaryConstitutionPortrait`) plus the shared self-contained HTML page shell and the reference palette (dataviz skill default — swap the hex values here to retheme)
- `scripts/make_dashboards.js` — connects (or `--sample`), runs the 8 queries, shapes the data, writes the 8 `.html` files
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
