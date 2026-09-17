---
name: GDX_SKILL_MAKE_DASHBOARS_DW
description: Generates 6 self-contained HTML charts (multi-dimension line, bar, and 4 heatmaps) from the GDX_HUMAN data warehouse (7_multidimensional.database), scoped to one study passed in via --study <slug>, each an interesting cross-perspective read on the data described in GoDataX_Human_7_DW.md. Use when the user asks for dashboards, charts, or visualizations of a specific GDX_HUMAN study.
---

# GDX_SKILL_MAKE_DASHBOARS_DW

Reads `7_multidimensional.database` (see `GoDataX_Human_7_DW.md`) and writes 6 standalone `.html` chart files, each openable directly in a browser — no server, no external CDN, no native dependency (pure `node-firebird` wire-protocol connection, same as the other two `GDX_SKILL_*` skills in `GDX_HUMAN`).

## Scoped to one study

Every run requires `--study <slug>` — the same slug `GDX_SKILL_NEW_STUDY` used for
`new_study_intake/<slug>/intake.json`. All 6 charts are filtered to **only that study's people**:
the slug resolves to the study's title (from its `intake.json`), the title resolves to
`GDX_PSY_STUDY.ID_STUDY`, and every chart query joins `DW_DIM_PERSON` on `ID_STUDY = ?` (the same
column `GDX_SKILL_LOAD_NEW_STUDY_DW` populates when it first loads a person for that study — see
`GoDataX_Human_7_DW.md` section 8). Running the skill again for a different study produces a
completely separate set of 6 files; it never mixes two studies' people into one chart.

Every output filename carries the study's slug, its title (slugified), and the moment that run was
generated — `dashboard_0N_<chart>__<slug>__<title-slug>__<YYYYMMDD-HHMMSS>.html` — so re-running for
the same study later (e.g. after more participants answer) never overwrites an earlier run's files.

Charts follow the **dataviz** skill's method: fixed categorical hue order, single-hue sequential ramp for magnitude, thin marks, a legend, direct labels, hover tooltips, light/dark theme via CSS custom properties, and a table-view fallback toggle on every chart.

## The 6 charts

| # | File (base name, before the `__<slug>__<title>__<timestamp>` suffix) | Type | What it shows | Why this form |
|---|---|---|---|---|
| 1 | `dashboard_01_physiological_response` | Line, 4 series | Coherence Index, Heart Rate, RMSSD, SDNN across the 5 cardiac-coherence protocol phases (`DW_FACT_CC_HRV_WINDOW`), for this study's people only, each **indexed to its own BASELINE = 100** | The 4 metrics are on different units (ms, bpm, a 0–1 index) — plotting raw values on one shared axis would be the dual-axis anti-pattern the dataviz skill flags as the #1 chart mistake. Indexing to a common base is the documented fix. |
| 2 | `dashboard_02_score_by_septenary_level` | Bar | Average psychometric `RAW_SCORE` grouped by `DW_DIM_SEPTENARY_LEVEL`, for this study's participants | The simplest version of the cross-perspective question the whole DW exists to answer: does any level of consciousness score systematically higher/lower across this study's participants? |
| 3 | `dashboard_03_instrument_by_level_heatmap` | Heatmap | Average score per (instrument × septenary level) cell, this study only | A radar/spider chart was the obvious "3rd type" instinct for 7 levels, but the dataviz skill's anti-patterns flag radar charts for distorting area/angle — a single-hue heatmap reads magnitude per cell accurately instead, and additionally shows *which instruments concentrate at one level vs. spread across several*, which a radar chart can't show at all. |
| 4 | `dashboard_04_instrument_by_cardiac_coherence_heatmap` | Heatmap | Average score per (instrument × cardiac-coherence `STRESS_CLASS`) cell, this study only | Same reasoning as #3, applied to the physiological perspective. No direct fact links an instrument to a session, so this joins through the shared `DW_DIM_PERSON` — it only has data for people who did both the psychometric battery and a coherence session, within this study. |
| 5 | `dashboard_05_instrument_by_kundalini_chakra_heatmap` | Heatmap | Average score per (instrument × chakra) cell, this study only | Each chakra maps 1:1 to a septenary level (`DW_DIM_CHAKRA.ID_SEPTENARY_LEVEL`), so this is chart 3's exact numbers, relabeled through the energetic/chakra lens instead of the "level" lens. |
| 6 | `dashboard_06_instrument_by_five_ways_heatmap` | Heatmap | Average score per (instrument × Aquinas's Five Ways) cell, this study only | Ways map N:1 to a level (several ways can share one — see `five_ways_septenary_map_firebird25.sql`), so a level's score repeats across every way built on it; levels with no way at all (Physical, Vital/Etheric, Astral, Atmic/Spirit) are empty here even where chart 3/5 have data. |

All four heatmaps share one pivot helper (`buildInstrumentHeatmapHtml` in `make_dashboards.js`) — only the query and the fixed column list differ between them. All 6 queries join `DW_DIM_PERSON` and filter `WHERE P.ID_STUDY = ?` on the id resolved from `--study`.

## Running it

```
cd 8_gdx_dashboards/.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts
npm install                 # once, installs node-firebird
node make_dashboards.js --sample --study <slug>     # sanity check: embedded sample data, no DB connection, writes 6 files
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node make_dashboards.js --study <slug>              # real run against the live DW, scoped to that one study
```

`--study <slug>` is **required** — the same slug `GDX_SKILL_NEW_STUDY` used for
`new_study_intake/<slug>/intake.json` (resolved automatically from this script's location; pass
`--intake-dir <path>` if that intake lives somewhere else). In real mode, the slug's `intake.json`
must already exist and its `study.title` must already be a row in `GDX_PSY_STUDY` (i.e.
`GDX_SKILL_RECORD_NEW_STUDY` and `GDX_SKILL_LOAD_NEW_STUDY_DW` must have already run for it) — the
skill errors out with a clear message otherwise. In `--sample` mode, a missing `intake.json` is not
an error: the filename just falls back to a generic "Sample Study" title.

Output defaults to `8_gdx_dashboards/` (pass `--out-dir <path>` to change it), with filenames shaped
`dashboard_0N_<chart>__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html` — see "Output
filenames" below. A chart is skipped (not written) if its query returns no rows for this study —
check the console output before assuming all 6 exist (e.g. chart 1 and chart 4 both depend on
`DW_FACT_CC_HRV_WINDOW`, which is empty until a cardiac-coherence session is loaded for a person, in
this study, that already exists in `DW_DIM_PERSON` — see `GoDataX_Human_7_DW.md` §6).

## Output filenames

Every file is named `<base-name>__<study-slug>__<study-title-slug>__<timestamp>.html`, e.g.:

```
dashboard_02_score_by_septenary_level__workplace-resilience-pilot__workplace-resilience-pilot-study__20260917-143022.html
```

- `<study-slug>` — the literal `--study` value.
- `<study-title-slug>` — the study's `GDX_PSY_STUDY.TITLE` (from its `intake.json`), lowercased,
  accents stripped, non-alphanumeric runs collapsed to `-`, capped at 60 characters.
- `<timestamp>` — `YYYYMMDD-HHMMSS`, the moment this run started (one shared timestamp for all 6
  files in a single run).

This means two different runs — for two different studies, or the same study re-run later — never
collide or overwrite each other's files.

## Files in this skill

- `scripts/chart_lib.js` — the 3 renderers (`renderLineChart`, `renderBarChart`, `renderHeatmap`) plus the shared self-contained HTML page shell and the reference palette (dataviz skill default — swap the hex values here to retheme)
- `scripts/make_dashboards.js` — connects (or `--sample`), runs the 6 queries, shapes the data, writes the 6 `.html` files
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
