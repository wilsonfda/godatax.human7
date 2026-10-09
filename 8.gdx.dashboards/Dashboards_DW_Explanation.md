# GDX_HUMAN Dashboards — What the 9 Charts Show

> Generated 2026-09-10, updated the same day when the skill grew from 3 to 6
> charts, updated again 2026-09-17 when the skill became study-scoped, updated
> again 2026-09-24 when a 9th chart (chart 00) was added — see §12.
> Location: `GDX_HUMAN/8.gdx.dashboards/`
>
> The files below were produced by `GDX_SKILL_MAKE_DASHBOARS_DW`
> (`.claude/skills/GDX_SKILL_MAKE_DASHBOARS_DW/`) reading
> `7.multidimensional.database` (see `GoDataX_Human_7_DW.md`) and, for chart 00
> only, the psychometric-properties catalog in `2.relational.model.psychometrics`.
> Each is a standalone `.html` file — open it directly in a browser, no server
> needed. The numbers quoted in §1–§7 are the real values from the live
> `godatax.human` run on 2026-09-10, **before** the skill required
> `--study <slug>` — at that time the DW held only one study's data, so these
> numbers happen to match what a study-scoped run for that same study would
> show today. See §8 below for what changed on 2026-09-17 and why re-running
> the skill no longer overwrites these files, and §12 for chart 00, the skill's
> 9th and newest chart.

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

**Physical Body has no bar at all** — no psychometric variable in this dataset maps to it (the only candidate, Burnout's Emotional Exhaustion, has no computed score column in the source `.sav`; see `SPSS_to_Firebird_Mapping.md`). *(As of 2026-09-18 evening this gap is closed with a real, computed score — see §11. A current run of the skill now draws this bar.)*

**A pattern worth noticing:** the two lowest-scoring levels, Vital/Etheric (2.85) and Buddhic (3.18), are also the two levels this project's own mapping flagged as **least certain** (`SPSS_Septenary_Constitution_Mapping.md` marks Buddhic-level correspondences as `SPECULATIVE` and Vital/Etheric's `EmocPos` link as `MEDIUM`). Whether that's a real psychological signal or an artifact of which variables happened to get assigned to those levels is exactly the kind of question this cross-perspective view is meant to surface, not answer on its own.

## 3. `dashboard_03_instrument_by_level_heatmap` — Heatmap (suggested chart type)

**Source:** the same fact table as chart 2, but grouped by (instrument × level) instead of level alone.

**Why a heatmap and not a radar/spider chart:** 7 levels practically begs for a radar chart, but the `dataviz` skill's anti-patterns explicitly call those out for distorting area and angle in ways that mislead about magnitude. A single-hue heatmap reads each cell's value accurately, and does something a radar chart structurally can't: show **which instruments concentrate their measurement at one level versus spread across several.**

**What it shows, reading the real cells:**

- **Concentrated at a single level** (the satisfaction-family instruments): Job Satisfaction (3.79), Personal Satisfaction (3.91) and Satisfaction With Life (3.61) all land purely on **Astral** — consistent with all three being direct affective/hedonic judgments, exactly what the Astral level is defined to capture.
- **Spread across several levels**: Career Adapt-Abilities Scale appears at Lower Mental (4.18), Higher Mental (4.08) and Buddhic (3.99) — its four sub-dimensions (Control, Confidence, Curiosity, Concern) were deliberately mapped to different levels of abstraction in `SPSS_Septenary_Constitution_Mapping.md`, and the heatmap makes that spread visible at a glance. Hardiness and Student Engagement Scale show the same pattern.
- **The single hypothesis-block result**: Undocumented Organizational Block sits at Atmic/Spirit (4.03) via its `RealizPess` (Personal Fulfillment) variable — the block's other three variables (`AnoOrg`, `SucProfFin`, `CondSocie`) are excluded from the septenary mapping by design (see `GoDataX_Human_7_DW.md` §7, item 3), so this instrument's row is otherwise empty.
- **Gray cells** mean "no variable from that instrument maps to that level" — not zero, not missing data, just structurally absent (at the time this section was written, no instrument had anything at the Physical level at all, matching chart 2's missing bar — closed 2026-09-18 evening, see §11).

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

## 9. 2026-09-18: chart 7 — the chakra gradient portrait

### 9.1 The first real run under `--study`

Before this date, every number in this document (§1–§7) came from the *pre-scoping* run —
`--study` didn't exist yet. On 2026-09-18 the skill was run for real, for the first time, under the
now-required flow, against the only study currently in `GDX_PSY_STUDY`:

```
node make_dashboards.js --study 1 --intake-dir <path-to-a-minimal-intake.json>
```

`ID_STUDY=1` is `"Predictors of Adaptability to Military Higher Education"` (423 participants). No
`new_study_intake/1/intake.json` exists for it — this study predates the `GDX_SKILL_NEW_STUDY` intake
pipeline entirely (it was loaded the older way, via `GDX_SKILL_LOAD_RLT_MODEL_DB`'s `.sav` import, not
through an interview). Rather than fabricate a full intake file as if this study had gone through that
interview, `--intake-dir` was pointed at a throwaway file containing only the one field
`make_dashboards.js` actually reads — `{"study":{"title":"Predictors of Adaptability to Military Higher
Education"}}` — kept outside `new_study_intake/` on purpose, so nothing in the repo misrepresents this
study as onboarded through `GDX_SKILL_NEW_STUDY`.

This first run (timestamp `20260918-184200`) produced 6 files and matched §1–§7 above exactly —
expected, since `ID_STUDY=1` is still the *only* study in the DW, so scoping to it changes nothing
yet. Each time the skill's code or the underlying data changed afterward (chart 7 added in §9.2, chart
8 added in §10, the Physical Body gap closed with real data in §11) the skill was re-run in full, and
the previous, now-superseded run was deleted rather than kept alongside it — the current files on disk
are always the single most recent run; see §11 for its timestamp and what's different about it.

### 9.2 Chart 7 is a real skill capability

A request asked for a variant of the traditional 7-chakra meditating-figure illustration
(`4.kundalini.chakras/MMPC7_4_Ilustracion.webp`) where the 7 circles, instead of their fixed rainbow
colors, are shaded in a single-hue **degradê** (gradient) driven by each chakra's real average
instrument score. That method was built directly into the skill's code so every future `--study` run
produces it automatically, as file 7 of 8 (§10 adds the 8th), in English (matching charts 1–6's language) — no manual
step, no hand-authored HTML:

- **`chart_lib.js`** gained `renderChakraPortrait({ title, description, rows, favicon, mode })`, plus a
  small `rampColorContinuous(t, ramp)` helper (`hexToRgb`/`rgbToHex` + linear RGB interpolation) so the
  gradient reads continuously across the sequential ramp instead of the discrete floor()-into-buckets
  `renderHeatmap` uses — with only 7 marks on the figure, flooring collapsed several chakras onto the
  same ramp step, which continuous interpolation avoids. Exported alongside the other 3 renderers.
- **`make_dashboards.js`** gained `loadChakraPortrait(db, studyId)` (the query below),
  `sampleChakraPortraitRows()` (mirrors `sampleScoreByLevelRows()` 1:1, same convention chart 5's
  sample data already uses), and `buildChakraPortraitHtml(rows)`, wired into `main()` as the 7th
  entry in the `outputs` array — `dashboard_07_chakra_gradient_portrait`.

**The query** — chart 5's join (`DW_FACT_PSY_VARIABLE_RESULT` → `DW_DIM_VARIABLE` → `DW_DIM_CHAKRA`,
1:1 with `DW_DIM_SEPTENARY_LEVEL` — see `chakras_model_firebird25.sql`), collapsed to one row per
chakra instead of per (instrument × chakra) cell, with the level name joined in for the table view:

```sql
SELECT C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME, L.NAME AS LEVEL_NAME,
       AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
FROM DW_FACT_PSY_VARIABLE_RESULT VR
JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
JOIN DW_DIM_CHAKRA C ON C.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = C.ID_SEPTENARY_LEVEL
JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
WHERE P.ID_STUDY = ?
GROUP BY C.ORDER_NUM, C.SANSKRIT_NAME, C.COMMON_NAME, L.NAME
ORDER BY C.ORDER_NUM
```

**The real result** (`ID_STUDY=1`, 423 participants):

| No. | Chakra | Level | Avg score | N (person×variable) | Fill color |
|---|---|---|---|---|---|
| 7 | Sahasrara | Atmic Body/Spirit | 4.03 | 423 | `#0d366b` (darkest) |
| 6 | Ajna | Buddhic Body | 3.18 | 1,269 | `#7db1ef` |
| 5 | Vishuddha | Higher Mental Body | 3.85 | 1,692 | `#174d91` |
| 4 | Anahata | Lower Mental Body | 3.90 | 1,269 | `#144686` |
| 3 | Manipura | Astral Body | 3.77 | 1,269 | `#1c58a3` |
| 2 | Svadhisthana | Vital/Etheric Body | 2.85 | 846 | `#cde2fb` (lightest) |
| 1 | Muladhara | Physical Body | — | 0 | `var(--grid)`, dashed ring — no variable maps here |

*(This table reflects the run at the time this section was written. As of 2026-09-18 evening, Muladhara
has a real score too — 3.74, N=423 — see §11. The color-method and Ajna discussion below still apply
unchanged to the 6 chakras that already had data.)*

**Color method** — reuses the **dataviz** skill's sequential formula (same 7-step blue ramp already
hardcoded as `PALETTE.sequential` in `chart_lib.js`: `#cde2fb → #9ec5f4 → #6da7ec → #3987e5 →
#256abf → #184f95 → #0d366b`), interpolated **continuously** rather than bucketed into the ramp's 7
discrete steps the way `renderHeatmap` does — the 6 real scores cluster tightly (2.85–4.03), and
flooring them into 7 buckets would collapse several chakras onto the same step. Each chakra's color is
`t = (score − min) / (max − min)` (min/max taken across the chakras that actually have data, not the
instruments' theoretical 1–5 range — same "normalize to what's actually on screen" choice
`renderHeatmap` already makes for its `vMin`/`vMax`), then linearly interpolated in RGB between the two
ramp stops `t` falls between. Muladhara (no instrument maps to Physical Body — same structural gap
chart 2/3/5/6 already document) renders the same way the heatmaps render an empty cell: filled with
`var(--grid)`, not zero and not colored, with a dashed ring instead of a solid one.

**Why Ajna reads distinctly lighter than its neighbors:** the septenary-level ↔ chakra correspondence
is a symbolic ascending-order mapping (`chakras_model_firebird25.sql`'s own header calls it
"interpretive/symbolic... not an empirical finding"), not a validated psychological scale — and the
Buddhic level's own mapping was separately flagged `SPECULATIVE` in
`SPSS_Septenary_Constitution_Mapping.md` (see §2 above). Ajna's noticeably lighter fill is the
gradient faithfully surfacing that same low score on the figure — a real read of real data laid over a
symbolic map, not a rendering bug.

**Where it lives:** as part of the current 8-file run — see §11 for its exact timestamp, which
superseded this section's original run once file 8 (§10) and the Physical Body fix (§11) both landed.

Every future `node make_dashboards.js --study <slug>` run now writes this as file 7 of 8 automatically,
for whichever study is passed, using that study's own real numbers — no manual step, no hand-authored
HTML.

## 10. 2026-09-18: an 8th file — the Septenary Constitution gradient portrait

The same request that produced chart 7 asked for the same treatment applied to the other diagram this
project already draws by hand: the Septenary Constitution pyramid-and-stack illustration
(`3.septenary.constitution/septenaria.webp`) — Individuality (Atma / Buddhi / Manas) as a triangle over
Personality (Kama-manas / Kama Rupa / Vital-Etheric / Physical) as a stack. Same idea as chart 7: color
each of the 7 bands with a computed single-hue gradient instead of hand-picked colors, driven by real
data instead of decoration. This one went straight into the skill's code — no manual prototype step,
since chart 7 had already proven the method.

**No new query was needed.** The data is exactly chart 2's — average `RAW_SCORE` grouped by
`DW_DIM_SEPTENARY_LEVEL` — with `TECHNICAL_NAME` added (the Sanskrit term each band's label needs, e.g.
`Atma`, `Buddhi`, `Manas`) since chart 2's bar chart never needed it:

```sql
SELECT L.ORDER_NUM, L.NAME AS LEVEL_NAME, L.TECHNICAL_NAME,
       AVG(VR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
FROM DW_FACT_PSY_VARIABLE_RESULT VR
JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
JOIN DW_DIM_PERSON P ON P.ID_PERSON = VR.ID_PERSON
WHERE P.ID_STUDY = ?
GROUP BY L.ORDER_NUM, L.NAME, L.TECHNICAL_NAME
ORDER BY L.ORDER_NUM
```

**The code:**
- **`chart_lib.js`** gained `renderSeptenaryConstitutionPortrait({ title, description, rows, favicon, mode })`,
  plus the fixed layout geometry it needs: `septBandGeometry(orderNum)` computes each band's polygon —
  a true triangle for the apex band (level 7), trapezoids for the rest of the triangle (level 6) and
  the triangle's base band (level 5), equal rectangles for the Personality stack (levels 4-1) — from a
  handful of constants (`SEPT_CX`, `SEPT_Y_APEX`, `SEPT_Y_TRI_BASE`, `SEPT_BASE_HALF_W`,
  `SEPT_RECT_BAND_H`). Reuses chart 7's `rampColorContinuous`/`hexToRgb`/`rgbToHex` helpers unchanged,
  plus a small new `luminance()` helper to pick white-vs-ink label text against each band's computed fill.
- **`make_dashboards.js`** gained `loadSeptenaryConstitutionPortrait(db, studyId)` (the query above),
  `sampleSeptenaryConstitutionPortraitRows()` (mirrors `sampleScoreByLevelRows()` 1:1, with
  `TECHNICAL_NAME` added from `GDX_PSY_SEPTENARY_LEVEL`'s own DML), and
  `buildSeptenaryConstitutionPortraitHtml(rows)`, wired into `main()` as the 8th entry in the `outputs`
  array — `dashboard_08_septenary_constitution_gradient_portrait`.

**Level ↔ diagram-band mapping** (confirmed against `septenary_constitution_model_firebird25.sql`'s
own `ORDER_NUM` — the diagram's Portuguese labels line up with the DW's English `NAME`/`TECHNICAL_NAME`
1:1, top to bottom):

| No. | `NAME` (DW) | `TECHNICAL_NAME` (DW) | Diagram label (`septenaria.webp`) | Group |
|---|---|---|---|---|
| 7 | Atmic Body/Spirit | Atma | Vontade (Atma) | Individuality (triangle apex) |
| 6 | Buddhic Body | Buddhi | Intuição (Budhi) | Individuality |
| 5 | Higher Mental Body | Abstract Manas | Mente Pura (Manas) | Individuality (triangle base) |
| 4 | Lower Mental Body | Concrete Manas | Mente de Desejos (Kama-manas) | Personality (stack top) |
| 3 | Astral Body | Kama Rupa | Emocional (Linga sharira) | Personality |
| 2 | Vital/Etheric Body | Prana/Linga Sharira | Energético (Prana sharira) | Personality |
| 1 | Physical Body | Sthula Sharira | Etéreo-Físico (Stula sharira) | Personality (stack bottom) |

**The real result** (`ID_STUDY=1`, 423 participants — identical numbers to chart 2 and chart 7's
level 2-7 rows, since it's the same underlying average, just relabeled and repositioned):

| No. | Level | Technical name | Avg score | N (person×variable) | Fill color |
|---|---|---|---|---|---|
| 7 | Atmic Body/Spirit | Atma | 4.03 | 423 | `#0d366b` (darkest) |
| 6 | Buddhic Body | Buddhi | 3.18 | 1,269 | `#7db1ef` |
| 5 | Higher Mental Body | Abstract Manas | 3.85 | 1,692 | `#174d91` |
| 4 | Lower Mental Body | Concrete Manas | 3.90 | 1,269 | `#144686` |
| 3 | Astral Body | Kama Rupa | 3.77 | 1,269 | `#1c58a3` |
| 2 | Vital/Etheric Body | Prana/Linga Sharira | 2.85 | 846 | `#cde2fb` (lightest) |
| 1 | Physical Body | Sthula Sharira | — | 0 | `var(--grid)`, dashed band — no variable maps here |

*(Same note as chart 7's table above: as of 2026-09-18 evening Physical Body has a real score too —
3.74, N=423 — see §11.)*

**Color method** — identical to chart 7's: the same 7-step blue `PALETTE.sequential` ramp, continuously
interpolated (`t = (score − min) / (max − min)` over the 6 levels that actually have data, then linear
RGB interpolation between the two ramp stops `t` falls between) rather than bucketed. Physical Body (no
variable in this dataset maps to it — the same absence chart 2's missing bar and chart 7's Muladhara
ring already document) renders as `var(--grid)` with a dashed border, not zero and not colored.

**Where it lives:** as part of the current 8-file run — see §11 for its exact timestamp (this run's own
timestamp was superseded a few minutes later, once §11's real Physical Body data landed).

Every future `node make_dashboards.js --study <slug>` run now writes this as file 8 of 8 automatically.

## 11. 2026-09-18 (same evening): the Physical Body gap closed with real data, not a placeholder

§2's original text said it plainly: "Physical Body has no bar at all." Charts 7 and 8 inherited that
same gap as an empty Muladhara ring / Physical Body band. A user asked whether a single record could
just be inserted into Firebird with an average score, purely so the gradient portraits would look
complete.

**That request was not carried out as asked.** Inserting one fabricated number into a database holding
423 real participants' real answers would have mixed synthetic data into real research data, silently —
exactly the kind of thing this whole DW goes out of its way to document instead of paper over (see
every "not zero, not missing, structurally absent" note throughout this file). Before writing anything,
the OLTP was checked for a real fix instead.

**What was actually there:** `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s existing level-1 row already named a
candidate — Burnout's "Emotional Exhaustion" — with `ID_VARIABLE IS NULL` and the note "no computed
column in the .sav" (`septenary_constitution_model_firebird25.sql`, confidence `LOW`). The instrument's
raw items were traced (`ef1`-`ef18`, `GDX_PSY_INSTRUMENT_ITEM.ID_INSTRUMENT = 9`) and turned out to be
**fully answered by all 423 participants already** (`GDX_PSY_ITEM_RESPONSE`) — the score was simply
never aggregated, not missing. Item wording confirmed `ef1`-`ef5` are exactly the Maslach Burnout
Inventory - Student Survey's standard 5-item Emotional Exhaustion subscale ("my studies leave me
emotionally exhausted," "I feel wiped out," "tired when I get up," "tense," "completely drained") —
matching `SPSS_to_Firebird_Mapping.md`'s own documented expectation for this block.

### What was written to the OLTP (real data, real participants, nothing invented)

1. **`GDX_PSY_VARIABLE`** — one new row, `ID_VARIABLE=22`, `NAME='Emotional Exhaustion'`,
   `ID_CONSTRUCT=9` (the existing Burnout construct). `OPERATIONAL_DEFINITION` documents exactly how
   it was computed and that it was never in the original `.sav` — written in prose, not the
   `.sav column: <col>` format the ETL parses, so the septenary-level reconciliation resolves it by
   exact variable-name match instead (see below).
2. **`GDX_PSY_VARIABLE_RESULT`** — **423 real rows**, one per participant, `RAW_SCORE` = the mean of
   that person's own `ef1`-`ef5` answers (not a single average pushed onto everyone). Overall mean
   across the 423: **3.7382**.
3. **`GDX_PSY_SEPT_LEVEL_PSY_MAP`** (`ID_MAPPING=1`) — `ID_VARIABLE` set to `22`, `VARIABLE_LABEL`
   updated to `'Emotional Exhaustion'` (dropping the now-resolved "no computed column" note).
   `CONFIDENCE_LEVEL` was left at `LOW` — that rating is about the interpretive plausibility of
   *Physical Body ↔ Emotional Exhaustion*, a curatorial judgment call, not about whether the data
   existed, so it wasn't mine to change.

### `GDX_SKILL_LOAD_NEW_STUDY_DW` gained a fallback for studies with no full intake.json

Getting the new variable into the DW's fact table should have been this skill's job — but its scope
resolution reads `new_study_intake/<slug>/intake.json`'s `instruments[]` section to know what belongs
to a study, and `ID_STUDY=1` predates that pipeline entirely (see §9.1), so it has no such section.
Running the skill threw immediately on `intake.instruments` being undefined.

`load_new_study_dw.js` (`7.multidimensional.database/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/scripts/`)
now has `resolveScopeFromDatabase(db, studyId)`: when a study's intake has no `instruments[]`, scope is
derived directly from what the OLTP already shows applied for that study — every `GDX_PSY_VARIABLE`
with at least one real `GDX_PSY_VARIABLE_RESULT` row through that study's applications, its instrument
resolved the same `FIRST 1` way the whole-database ETL does. `resolveScope()` now takes `studyId` and
dispatches to this fallback automatically; `main()` logs when it's in use. This is documented, general
behavior for *any* legacy study with no intake.json, not a one-off hack for study 1.

**This fallback was not run end-to-end against study 1**, on purpose. `loadItemResponseFacts()` and
`loadVariableResultFacts()` — unrelated to this fix, pre-existing in the skill — re-check *every* fact
row for the whole study one existence-query at a time; for study 1's ~423 people × 100+ items across 9
instruments, a `--dry-run` was still running after 10+ minutes of read-only existence checks and was
stopped rather than left to finish (a rough extrapolation put the real run at over an hour of network
round-trips against the shared DB, re-validating thousands of already-loaded facts to load 423 new
ones). Instead, the same insert-if-missing discipline was applied directly and narrowly: `DW_DIM_VARIABLE`
for `ID_VARIABLE=22` (with its septenary level resolved), and the 423 `DW_FACT_PSY_VARIABLE_RESULT` rows
for it — the exact rows the fallback would have produced, without the expensive full-study rescan. The
code fix to the skill itself stands as written and is correct for a future legacy study with fewer
existing facts to rescan.

### The result

```
SELECT L.NAME, AVG(VR.RAW_SCORE), COUNT(*) FROM DW_FACT_PSY_VARIABLE_RESULT VR
JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
WHERE V.ID_VARIABLE = 22 GROUP BY L.NAME;
-- Physical Body | 3.7382 | 423
```

All 8 charts were regenerated for `ID_STUDY=1` — timestamp `20260918-215257`,
`8.gdx.dashboards/dashboard_0[1-8]_*__1__predictors-of-adaptability-to-military-higher-education__20260918-215257.html`.
Chart 2 now draws a Physical Body bar (3.74); chart 7's Muladhara and chart 8's Physical Body band both
carry a real fill color instead of the gray dashed "no data" mark. The previous 8-file run (timestamp
`20260918-192724`, Physical Body still empty) was deleted rather than kept alongside — same convention
established in §9.1.

**What this does and doesn't mean:** the septenary correspondence itself is still the same symbolic,
interpretive mapping it always was (`CONFIDENCE_LEVEL='LOW'`, unchanged) — this closed a **data**
availability gap, not a **conceptual** one. The chart now plots a real number where it used to plot
nothing; it does not make the Physical-Body-↔-Emotional-Exhaustion correspondence itself any more or
less certain than the project's own documentation already says it is.

## 12. 2026-09-24: a 9th chart — `dashboard_00_means_psychometric_responses`

`GDX_SKILL_MAKE_DASHBOARS_DW` gained a 9th chart, numbered `00` (it sorts before chart 1 in the
`outputs` array and on disk, as the "pure-psychometric" counterpart to chart 1's "pure-physiological"
one) — a small-multiples **line chart with 2 panels**, one instrument per x-axis position:

- **Top panel — response score:** the mean `DW_FACT_PSY_VARIABLE_RESULT.RAW_SCORE` participants
  actually gave, from the DW, scoped to this study like every other chart here.
- **Bottom panel — factor-analysis loadings:** the mean `|VALUE|` from
  `GDX_PSY_PSYCHOMETRIC_PROPERTY` in `2.relational.model.psychometrics` (the OLTP catalog, **not** the
  DW), one line for `EFA_FACTOR_LOADING` (exploratory) and one for `STD_FACTOR_LOADING`
  (confirmatory/CFA).

**Two panels, not one shared axis, and not an indexed baseline like chart 1:** a response score
(mostly a 1–5 Likert mean, though not uniformly — Positivity Ratio Scale runs 0–4) and a factor
loading (−1 to 1) are different quantities; one shared y-axis would be the dual-axis anti-pattern the
`dataviz` skill flags, and there is no natural "instrument zero" the way chart 1 has a BASELINE phase
to index against.

**Why this chart is scoped differently from charts 1–8:** the x-axis instrument list is study-scoped —
only instruments this study actually administered appear, resolved from `GDX_PSY_ITEM_RESPONSE` (which
instruments this study's applications have real answers for), deliberately **not** from
`GDX_PSY_APPLICATION.ID_INSTRUMENT` (a legacy study loaded via `GDX_SKILL_LOAD_RLT_MODEL_DB`, like
`ID_STUDY=1`, gives every person one "umbrella" application row hardcoded to `ID_INSTRUMENT=1`, which
would misleadingly make the whole battery look like just Hardiness). But `GDX_PSY_PSYCHOMETRIC_PROPERTY`
has **no `ID_STUDY` column** — a loading plotted here reflects whatever population last had CFA/EFA run
for that instrument, not necessarily this study's own (see `GDX_SKILL_MAKE_ANALYSES_CFA_EFA`'s own
`--study` flag for computing a study-specific value instead of reusing whatever is already loaded).

**The real numbers**, from the current run (`ID_STUDY=1`, `20260924-004325`):

| Instrument | Response score | Response N | EFA loading (avg \|value\|) | CFA loading (avg \|value\|) |
|---|---|---|---|---|
| Hardiness | 3.54 | 1,269 | 0.36 | 0.40 |
| Student Engagement Scale | 2.89 | 1,269 | 0.58 | 0.68 |
| Career Adapt-Abilities Scale | 4.08 | 1,692 | 0.37 | 0.65 |
| Satisfaction With Life Scale | 3.61 | 423 | 0.61 | 0.75 |
| Job Satisfaction Scale | 3.79 | 423 | 0.46 | 0.56 |
| Positivity Ratio Scale | 2.16 | 846 | 0.53 | 0.53 |
| Personal Satisfaction | 3.91 | 423 | — | — |
| Perceived Control of Life | 3.77 | 423 | — | — |
| Maslach Burnout Inventory - Student Survey (hypothesis - unconfirmed) | 3.74 | 423 | 0.37 | 0.52 |
| Undocumented Organizational Block (hypothesis - an1-an11) | 3.40 | 1,692 | 0.57 | 0.66 |
| Red Tape / Perceived Bureaucracy (hypothesis - red1-red5) | 3.34 | 422 | 0.77 | 0.76 |

Note some response-score values differ slightly from the scores quoted for the same instruments in §2–§6
above (e.g. Hardiness 3.54 here vs. 3.95/3.97 earlier, Positivity Ratio 2.16 here vs. 2.71/2.8 earlier) —
those earlier numbers came from the very first, pre-scoping 2026-09-10 run or from this document's
embedded sample data, not from the current `ID_STUDY=1` data as it stands after the fixes in §11 and
whatever else has been loaded since; they are not inconsistent with each other, just snapshots of
different points in time. **Personal Satisfaction** and **Perceived Control of Life** have no EFA/CFA
points — absent, not zero, meaning no CFA/EFA run has been recorded for them yet; the chart's own
caption lists exactly which of the study's instruments do and don't have loadings, computed from the
data rather than hardcoded.

**Where it lives:** `dashboard_00_means_psychometric_responses__<study-slug>__<study-title-slug>__<timestamp>.html`,
same filename convention as charts 1–8 (§8). As of this writing the current run is
`dashboard_00_means_psychometric_responses__1__predictors-of-adaptability-to-military-higher-education__20260924-004325.html`.
Like every other chart, `--chart 00` can generate just this one file without touching the other 8.
