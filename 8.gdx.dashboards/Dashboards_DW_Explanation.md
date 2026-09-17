# GDX_HUMAN Dashboards — What the 6 Charts Show

> Generated 2026-09-10, updated the same day when the skill grew from 3 to 6
> charts, updated again 2026-09-17 when the skill became study-scoped.
> Location: `GDX_HUMAN/8.gdx.dashboards/`
>
> The 6 files below were produced by `GDX_SKILL_MAKE_DASHBOARS_DW`
> (`.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/`) reading
> `7.multidimensional.database` (see `GoDataX_Human_7_DW.md`). Each is a
> standalone `.html` file — open it directly in a browser, no server needed.
> The numbers quoted here are the real values from the live `godatax.human`
> run on 2026-09-10, **before** the skill required `--study <slug>` — at that
> time the DW held only one study's data, so these numbers happen to match
> what a study-scoped run for that same study would show today. See §8 below
> for what changed on 2026-09-17 and why re-running the skill no longer
> overwrites these files.

## 1. `dashboard_01_physiological_response` — Line chart, 4 series

**Source:** `DW_FACT_CC_HRV_WINDOW` joined to `DW_DIM_SESSION`, one cardiac-coherence participant (`SPSS-784`), 5 protocol phases.

**What it plots:** Coherence Index, Mean Heart Rate, RMSSD and SDNN across the 5 phases of the coherence protocol (`BASELINE 5 MIN` → `MENTAL ARITHMETIC 5 MIN` → `PACED BREATHING 6 BPM` → `RECOVERY 5 MIN` → `QUIET WORRY 5 MIN`). Each line is **indexed to its own BASELINE value = 100** — the four metrics live on different units (a 0–1 index, beats per minute, milliseconds), so plotting their raw values on one shared axis would be a dual-axis chart, which the `dataviz` skill flags as the single most common charting mistake. Indexing to a common base is the documented fix: every line answers the same question — "how far from baseline, in percent."

**How to read it — the real numbers:**

| Phase | Coherence Index | Heart Rate | RMSSD | SDNN |
|---|---|---|---|---|
| Baseline | 100 | 100 | 100 | 100 |
| Mental Arithmetic (stress) | 28.6 | 133.5 | 44.7 | 41.4 |
| Paced Breathing (coherent) | 216.7 | 87.7 | 466.7 | 611.2 |
| Recovery | 138.1 | 107.2 | 159.7 | 171.9 |
| Quiet Worry | 59.5 | 112.3 | 90.3 | 76.4 |

The pattern is exactly what the coherence-training literature predicts: mental arithmetic (an acute stressor) drives heart rate up and every variability metric down; paced breathing at 6 breaths/minute does the opposite by a wide margin (coherence index more than doubles, RMSSD/SDNN jump 4–6×); recovery lands partway back toward baseline; quiet worry — a *low-arousal* stressor — barely moves heart rate but still suppresses coherence and variability, showing the metrics pick up on something heart rate alone misses.

**Caveat:** this is a single synthetic demo participant (`gdx_coerencia_cardiaca_dml_simulacao_fb25.sql`, folder 6) with clearly labeled illustrative numbers, not a real physiological recording — see that file's header comment. The chart demonstrates the pipeline works end-to-end (OLTP → DW → chart); it is not a clinical or research finding.

## 2. `dashboard_02_score_by_septenary_level` — Bar chart

**Source:** `DW_FACT_PSY_VARIABLE_RESULT` joined through `DW_DIM_VARIABLE` to `DW_DIM_SEPTENARY_LEVEL`, averaged across all 423 psychometric participants.

**What it plots:** the average psychometric raw score (1–5 scale) of every variable that resolves to a given septenary level, one bar per level.

**The real numbers:**

| Level | Avg score | N (person × variable rows) |
|---|---|---|
| Vital/Etheric Body | 2.85 | 846 (2 variables) |
| Astral Body | 3.77 | 1,269 (3 variables) |
| Lower Mental Body | 3.90 | 1,269 (3 variables) |
| Higher Mental Body | 3.85 | 1,692 (4 variables) |
| Buddhic Body | 3.18 | 1,269 (3 variables) |
| Atmic Body/Spirit | 4.03 | 423 (1 variable) |

**Physical Body has no bar at all** — no psychometric variable in this dataset maps to it (the only candidate, Burnout's Emotional Exhaustion, has no computed score column in the source `.sav`; see `SPSS_to_Firebird_Mapping.md`).

**A pattern worth noticing:** the two lowest-scoring levels, Vital/Etheric (2.85) and Buddhic (3.18), are also the two levels this project's own mapping flagged as **least certain** (`SPSS_Septenary_Constitution_Mapping.md` marks Buddhic-level correspondences as `SPECULATIVE` and Vital/Etheric's `EmocPos` link as `MEDIUM`). Whether that's a real psychological signal or an artifact of which variables happened to get assigned to those levels is exactly the kind of question this cross-perspective view is meant to surface, not answer on its own.

## 3. `dashboard_03_instrument_by_level_heatmap` — Heatmap (suggested chart type)

**Source:** the same fact table as chart 2, but grouped by (instrument × level) instead of level alone.

**Why a heatmap and not a radar/spider chart:** 7 levels practically begs for a radar chart, but the `dataviz` skill's anti-patterns explicitly call those out for distorting area and angle in ways that mislead about magnitude. A single-hue heatmap reads each cell's value accurately, and does something a radar chart structurally can't: show **which instruments concentrate their measurement at one level versus spread across several.**

**What it shows, reading the real cells:**

- **Concentrated at a single level** (the satisfaction-family instruments): Job Satisfaction (3.79), Personal Satisfaction (3.91) and Satisfaction With Life (3.61) all land purely on **Astral** — consistent with all three being direct affective/hedonic judgments, exactly what the Astral level is defined to capture.
- **Spread across several levels**: Career Adapt-Abilities Scale appears at Lower Mental (4.18), Higher Mental (4.08) and Buddhic (3.99) — its four sub-dimensions (Control, Confidence, Curiosity, Concern) were deliberately mapped to different levels of abstraction in `SPSS_Septenary_Constitution_Mapping.md`, and the heatmap makes that spread visible at a glance. Hardiness and Student Engagement Scale show the same pattern.
- **The single hypothesis-block result**: Undocumented Organizational Block sits at Atmic/Spirit (4.03) via its `RealizPess` (Personal Fulfillment) variable — the block's other three variables (`AnoOrg`, `SucProfFin`, `CondSocie`) are excluded from the septenary mapping by design (see `GoDataX_Human_7_DW.md` §7, item 3), so this instrument's row is otherwise empty.
- **Gray cells** mean "no variable from that instrument maps to that level" — not zero, not missing data, just structurally absent (e.g. no instrument here has anything at the Physical level, matching chart 2's missing bar).

## 4. `dashboard_04_instrument_by_cardiac_coherence_heatmap` — Heatmap

**Source:** `DW_FACT_PSY_VARIABLE_RESULT` joined to `DW_DIM_INSTRUMENT`, joined through the shared `DW_DIM_PERSON` to `DW_FACT_CC_HRV_WINDOW`, grouped by `STRESS_CLASS`.

**What it plots:** average psychometric score per (instrument × cardiac-coherence stress class) cell. Unlike charts 3/5/6, there is no fact table that links an instrument directly to a coherence session — the only shared key is the person, so the join is genuinely "people who have both."

**What the real cells actually show today:** every instrument's score is **identical across all 5 columns** — e.g. Hardiness is 3.97 whether the column is Relaxed, Baseline, Activated, Stressed or Inconclusive; Career Adapt-Abilities Scale is 3.75 across the board. That flat pattern isn't a finding, it's a sample-size artifact: only one participant (`SPSS-784`) currently has *both* a full psychometric battery and cardiac-coherence sessions, and that one person's fixed psychometric score gets repeated once for each of their 5 session windows (which happen to span all 5 stress classes). With more people wired up the same way (real `ID_PERSON` shared between `GDX_PSY_PERSON` and `GDX_CC_PERSON`, per `GoDataX_Human_7_DW.md` §2), this chart would start showing whether people who register as `STRESSED` in their coherence sessions actually score differently on, say, Hardiness or the Positivity Ratio than people who register as `RELAXED` — which is the interesting question this chart exists to eventually answer.

## 5. `dashboard_05_instrument_by_kundalini_chakra_heatmap` — Heatmap

**Source:** the same join as chart 3, with `DW_DIM_SEPTENARY_LEVEL` swapped for `DW_DIM_CHAKRA` (1:1 with a level — see `chakras_model_firebird25.sql`).

**What it plots:** exactly chart 3's numbers again, column-for-column, just labeled by chakra instead of by level — Job/Personal/Life Satisfaction still land purely on **Manipura (Solar Plexus)**'s astral counterpart... except the label is different: since level 3 (Astral) maps to **Manipura**, and level 6 (Buddhic) maps to **Ajna (Third Eye)**, the read becomes "career curiosity and engagement absorption sit at the Third Eye" instead of "at the Buddhic level." Whether that reads as more or less intuitive than chart 3 is exactly the point of building both — the chakra framing and the philosophical "level" framing are two lenses on one number, not two different findings.

## 6. `dashboard_06_instrument_by_five_ways_heatmap` — Heatmap

**Source:** the same join again, with `DW_DIM_FIVE_WAY` (N:1 with a level, `five_ways_septenary_map_firebird25.sql`) instead of the level directly.

**What's different from chart 5:** chakras cover all 7 levels 1:1, so chart 5 is a full relabeling of chart 3. Aquinas's Five Ways only touch 3 of the 7 levels (Lower Mental via Prima/Secunda Via, Higher Mental via Tertia/Quarta Via, Buddhic via Quinta Via) — so this heatmap is visibly sparser, and every level-4/5 value appears **twice** (once per way sharing it):

| Instrument | Prima Via | Secunda Via | Tertia Via | Quarta Via | Quinta Via |
|---|---|---|---|---|---|
| Career Adapt-Abilities Scale | 4.18 | 4.18 | 4.08 | 4.08 | 3.99 |
| Hardiness | 3.77 | 3.77 | 4.03 | 4.03 | 2.81 |
| Perceived Control of Life | 3.77 | 3.77 | — | — | — |
| Student Engagement Scale | — | — | 3.23 | 3.23 | 2.75 |

Instruments whose variables only ever landed at Physical, Vital/Etheric, Astral or Atmic/Spirit (the Satisfaction-family instruments, Positivity Ratio, the Organizational Block) have **no row at all** here, even though chart 3 has data for them — a level having no philosophical "way" built on it is a real structural fact about the Five Ways mapping, not a data gap.

## 7. Data-freshness note

All six charts read the DW (`7.multidimensional.database`), which is a **loaded copy** of the OLTP schemas, not a live view. If `GDX_SKILL_LOAD_SEPT_MAPS_DB` (folder 3) adds or changes a mapping in `GDX_PSY_SEPT_LEVEL_PSY_MAP` afterward, that change does **not** appear here until `godatax_human_dw_etl_firebird25.sql` is re-run to refresh `DW_DIM_VARIABLE`. As of this document, the September 10 run of `GDX_SKILL_LOAD_SEPT_MAPS_DB` added a new `EmocNeg` → Astral mapping to the OLTP table, but the DW (and therefore chart 2's Astral bar, and charts 3/5/6's `EmocNeg`-related cells) has not yet been refreshed to include it — re-run the ETL before treating these numbers as fully current.

## 8. 2026-09-17 update: the skill is now scoped to one study, and filenames changed

`GDX_SKILL_MAKE_DASHBOARS_DW` now **requires** `--study <slug>` on every run — the same slug
`GDX_SKILL_NEW_STUDY` uses for `new_study_intake/<slug>/intake.json`. All 6 queries above are now
filtered to that one study's people, joined through `DW_DIM_PERSON.ID_STUDY` (resolved from the
slug's `intake.json` `study.title`, looked up against `GDX_PSY_STUDY`) — see the skill's `SKILL.md`
for the exact join added to each query.

This was needed because the DW is meant to eventually hold many studies at once (`GDX_SKILL_LOAD_NEW_STUDY_DW`
loads them incrementally, insert-if-missing, without truncating anything — section 8 of
`GoDataX_Human_7_DW.md`), and the original 6 charts had no way to ask for "just this one study's
people" — they always read every row in the DW's fact tables, silently mixing every study's
participants into one chart the moment a second study was loaded.

**Filenames also changed.** Every chart file is now named
`<base-name>__<study-slug>__<study-title-slug>__<YYYYMMDD-HHMMSS>.html` instead of the fixed
`<base-name>.html` used when this document's numbers (§1–§7 above) were generated. The 6 static
files referenced by name throughout this document (e.g. `dashboard_01_physiological_response.html`)
are the original, one-off demonstration run from 2026-09-10 and are **not** overwritten by a
study-scoped run — a later `node make_dashboards.js --study <slug>` writes 6 new, differently-named
files alongside them instead. Do not treat the old fixed filenames as what the skill produces going
forward; treat them as a historical snapshot.
