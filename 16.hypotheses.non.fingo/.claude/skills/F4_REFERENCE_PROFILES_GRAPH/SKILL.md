---
name: F4_REFERENCE_PROFILES_GRAPH
description: Given a study slug, reads the real GDX_HNF_FEATURE_VALUE rows F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE already wrote for one real subject (defaulting to the subject of the study's latest PERSONAL_BASELINE GDX_HNF_CDI_REFERENCE_SET) and renders a standalone, English-only HTML page, one chart card per feature, using as its template this layer's own "first m real sessions establish a constant reference, compared with later real sessions" figure (section 8.1, "Construcao de baseline individual"): a constant dashed reference line (the live-computed mean/median of that subject's own first m real sessions, m=4 by default), a thin trajectory line, and one marker per real session, colored by role (baseline-forming vs. later/compared). Only a feature with more than m real sessions for that subject is plotted -- most psychometric items (one session per person) are skipped with an explicit reason; repeated-session physiological features (e.g. cardiac-coherence) usually qualify. Use when the user asks to plot, chart, or visualize a personal baseline, the "first sessions establish a reference" figure, or how a subject's later sessions compare to their own early history, for a study. Does NOT read or duplicate the already-frozen GDX_HNF_CDI_REFERENCE_VALUE (F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own job, possibly built with a different session count) -- the baseline shown here is always recomputed live, with m fixed at this figure's own default of 4.
---

# F4_REFERENCE_PROFILES_GRAPH

Renders this folder's own reference-profiles figure for **one real subject**: the first `m` real
sessions of a feature establish a constant reference (the subject's own personal baseline), and
every later real session is plotted against it. Built on top of
**F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE**'s own frozen `z(t)`, and defaults its choice of
subject from **F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS**'s own `PERSONAL_BASELINE` reference set,
but computes the baseline shown on the chart independently and live every run.

## Why this script recomputes the baseline itself, instead of reading F4's own frozen one

`F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` already builds and freezes a `PERSONAL_BASELINE`
`GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_REFERENCE_VALUE` -- but that table stores only the
**final** mean/median per feature, not the per-session values that went into it, and it may have
been built with a different `--baseline-sessions` than this figure's own. This figure's own
caption names a specific number -- **the first four sessions** -- so this script fixes
`--baseline-sessions` at `4` by default and recomputes that mean/median live, directly from
`GDX_HNF_FEATURE_VALUE`, every time it runs. This is the same lightweight, deterministic,
render-time computation posture every other GRAPH skill in this folder already takes (e.g. F3's
own Pearson r, computed live from already-frozen coordinates, never stored by F3 itself).

## Which features actually qualify

A feature is plotted only when this subject has **more** real, non-missing sessions than `m`
(there must be at least one real "later" session to compare the baseline against). In this
project's own data today, that excludes most psychometric items (one real administration per
person -- `OBS_GRAIN_KEY='APPLICATION:<id>'`, a single row) and includes the physiological,
repeated-session features (e.g. cardiac-coherence, `OBS_GRAIN_KEY='CC_SESSION:<n>'`, several real
sessions with real timestamps). A feature that does not qualify gets an explicit "Not plotted"
card naming why (zero real sessions, or not more than `m`) -- never silently omitted and never
padded with a fabricated session to make the chart "work" (CLAUDE.md "Never invent missing data").

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_REFERENCE_SET   -> only to default --subject (PERSONAL_BASELINE's own ID_SUBJECT)
                                when --subject is not given; never read again afterward
GDX_HNF_FEATURE_SPACE_RUN   -> the evaluated F1 run (must be NORMALIZATION_METHOD='ZSCORE')
GDX_HNF_FEATURE_RUN_MEMBER /
GDX_HNF_FEATURE_DICTIONARY  -> which features this run includes, and their metadata
GDX_HNF_FEATURE_VALUE       -> every real, non-missing session this one subject has, per feature
```

Never reads `GDX_HNF_CDI_REFERENCE_VALUE`/`GDX_HNF_CDI_VALUE_DETAIL` (see above), and never
re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`, `7.multidimensional.database`
or `9.knowledge.graph` directly -- "reading the relational/BI/graph sources" is satisfied
*transitively*, through F1's own already-frozen `z(t)`, the same posture every other skill in this
folder already takes.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_REFERENCE_PROFILES_GRAPH/scripts
npm install                                                   # once, installs node-firebird
node generate_reference_profiles_graph.js --sample           # sanity check: embedded sample data, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

node generate_reference_profiles_graph.js --study 1 --dry-run         # real run: logs scope, writes no file
node generate_reference_profiles_graph.js --study 1                  # real run: writes the HTML page
node generate_reference_profiles_graph.js --study 1 --feature "CC."   # scope to the features that actually qualify today
node generate_reference_profiles_graph.js --study 1 --subject 784 --baseline-sessions 4
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4/F4_REFERENCE_PROFILES use.
- `--subject <id_person>` optional. Defaults to the study's latest `PERSONAL_BASELINE`
  `GDX_HNF_CDI_REFERENCE_SET.ID_SUBJECT` -- errors, naming
  `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`, if none exists and this is not given.
- `--run-id <id>` optional. A specific `GDX_HNF_FEATURE_SPACE_RUN.ID_RUN` (must be `ZSCORE`)
  instead of the study's latest.
- `--baseline-sessions <m>` default `4` -- this figure's own "first four sessions". A feature
  with `m` or fewer real sessions for this subject is skipped.
- `--baseline-estimator mean|median` default `mean`.
- `--feature <text>` optional, same convention as this folder's other skills (e.g. `--feature
  "CC."` to scope to the repeated-session physiological features that actually qualify today).
- `--out-dir <path>` optional. Defaults to this folder (`16.hypotheses.non.fingo/`).
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (subject, run, features in/out of scope, session counts) and
  logs it, writing no file.
- `--sample` renders from embedded, clearly-labeled sample data instead of connecting to
  Firebird -- lets the rendering logic be checked with no live database.

## Current status

Implemented; smoke-tested with `--sample`. Not yet run against a live study in this environment --
validate with `--dry-run` first, e.g. `--study 1` (this project's own 423-cadet study), which
already has a `PERSONAL_BASELINE` reference set (subject `#784`) and real multi-session
cardiac-coherence features to plot.

## What this skill will never do

- **Never fabricates a session.** A feature with zero or not-enough real sessions gets an
  explicit "Not plotted" card naming why -- never a placeholder point.
- **Never reads or duplicates the already-frozen `GDX_HNF_CDI_REFERENCE_VALUE`.** The baseline
  drawn here is always recomputed live from `GDX_HNF_FEATURE_VALUE`, with this figure's own fixed
  default `m=4` -- see "Why this script recomputes the baseline itself" above.
- **Never writes to the database.** This is a pure read-and-render skill, like every other GRAPH
  skill in this folder.
- **Never treats a personal baseline as a population norm or an "optimal state".** One person's
  own early history is not evidence about health, virtue, or any other person -- see this layer's
  own `F4_REFERENCE_PROFILES/SKILL.md` for the other two reference bases and why they answer
  different questions.

## Files in this skill

- `scripts/chart_renderer.js` -- self-contained SVG renderer (house style shared with this
  folder's other GRAPH skills: validated categorical palette, hover tooltips, table-view
  fallback, light+dark theme)
- `scripts/generate_reference_profiles_graph.js` -- resolves the subject/run, loads real sessions,
  computes the live baseline, and writes the HTML page (Node.js + `node-firebird`, no native
  client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
