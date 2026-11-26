---
name: F4_CURV_DEPTH_KPI_COMPARE_MODEL
description: Implements this folder's F4 comparison layer on top of F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's and F4_CURV_DEPTH_KPI_LATENT_SPACE's own output -- for a given study, pairs by ID_PERSON the real GDX_HNF_CDI_VALUE (CDIx, original normalized feature space) and GDX_HNF_CDIH_VALUE (CDIh, fitted latent space) rows from one chosen GDX_HNF_CDI_RUN and one chosen GDX_HNF_CDIH_RUN, excluding (and counting, never imputing) any person present in only one of the two. Writes GDX_HNF_CDI_COMPARE_RUN/GDX_HNF_CDI_COMPARE_VALUE (hypotheses_non_fingo_curvature_depth_index_compare_model_firebird25.sql, this folder) via scripts/generate_curvature_depth_compare.js --study <slug> [--cdi-run-id <id>] [--cdih-run-id <id>]. Shaped after this project's own design document section 7.1 ("Exemplo numerico completo e comparacao", figure "Figura -- Comparacao puramente ficticia de indices em dois espacos; valores nao sao uma avaliacao de desempenho"), which works a single FICTITIOUS pair of numbers and concludes the two indices are not directly interchangeable and that the appropriate comparison tests stability and association, not equivalence. Use when the user asks to compare/pair CDIx and CDIh, or to prepare a comparison between the two F4 functions/spaces for a study. Does NOT compute CDIx or CDIh itself (those stay F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's and F4_CURV_DEPTH_KPI_LATENT_SPACE's own jobs) and does NOT compute Pearson r, ranks, or representative persons (that is F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH's own job, at render time, from the rows this skill freezes).
---

# F4_CURV_DEPTH_KPI_COMPARE_MODEL

Implements this folder's **F4 comparison** layer -- a thin pairing step between the outputs of
this folder's two F4 skills -- `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` (CDIx, computed over F1's
normalized feature space `z(t)`) and `F4_CURV_DEPTH_KPI_LATENT_SPACE` (CDIh, computed over F2's
fitted latent space `h(t)`) -- for one chosen `GDX_HNF_CDI_RUN` and one chosen `GDX_HNF_CDIH_RUN`
of the same study.

## Why this skill exists -- the source figure

This folder's own design document, in the section introducing CDIh right after CDIx
(`GoDataX_Human7ph_Matematica_Completo.docx`, "7. F4 alternativa -- CDI no espaco latente",
"7.1. Exemplo numerico completo e comparacao"), works a single illustrative pair of numbers --
`CDIx ~= 0,1732` (original five-feature example) and `CDIh ~= 0,1458` (a deliberately simple,
untrained two-dimension average, explicitly *not* a fitted PCA or neural network) -- then states
the point this skill and its GRAPH sibling exist to operationalize:

> *"Os resultados 0,1732 e 0,1458 nao sao diretamente intercambiaveis. Eles dependem de espacos e
> escalas diferentes. Um CDIh menor nao significa melhoria, menor anomalia ou superioridade do
> algoritmo. A comparacao adequada consiste em testar a estabilidade e a associacao de cada
> indicador a desfechos definidos externamente."*
>
> *(Figura -- Comparacao puramente ficticia de indices em dois espacos; valores nao sao uma
> avaliacao de desempenho.)*

The document's own figure is a single fictitious pair with no real data behind it. This skill
produces the real-data groundwork for that comparison: for one study, it pairs up every person who
has **both** a real `CDIx` and a real `CDIh` value already computed, and freezes exactly those
real, paired numbers -- nothing more. Computing the actual "test the association" step (Pearson r)
and rendering it is `F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH`'s own job, one layer up.

## Pairing rule -- only real, paired persons; nothing imputed

A person is written here **only if** they have a real value in both the chosen
`GDX_HNF_CDI_VALUE` (CDIx) and the chosen `GDX_HNF_CDIH_VALUE` (CDIh) rows -- the intersection of
the two runs' own complete-case person sets. A person present in only one of the two runs is
excluded and **counted**, by the run's own `EXCLUDED_CDI_ONLY_COUNT`/`EXCLUDED_CDIH_ONLY_COUNT` --
never imputed, defaulted, or silently dropped without being recorded. If the intersection is
empty, the script refuses to write anything (there is nothing paired to freeze) rather than
writing an empty or fabricated run.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_RUN      -> the chosen CDIx run (latest for the study, or --cdi-run-id)
GDX_HNF_CDI_VALUE     -> the real CDIx scalar per complete-case person

GDX_HNF_CDIH_RUN      -> the chosen CDIh run (latest for the study, or --cdih-run-id)
GDX_HNF_CDIH_VALUE    -> the real CDIh scalar per complete-case person
```

Never reads `GDX_HNF_CDI_VALUE_DETAIL`/`GDX_HNF_CDIH_VALUE_DETAIL` (the per-feature/per-dimension
breakdown stays each sibling skill's own concern, not this comparison's), never reads
`GDX_HNF_FEATURE_VALUE`/`GDX_HNF_LATENT_VALUE` directly, and never re-reads
`2.relational.model.psychometrics`, `6.cardiac.coherence`, `7.multidimensional.database` or
`9.knowledge.graph`. Never re-computes a `CDIx` or `CDIh` value -- only pairs and freezes what the
two sibling skills already froze.

## Database structure

`hypotheses_non_fingo_curvature_depth_index_compare_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_CDI_COMPARE_RUN` | 1 row per execution | Which `GDX_HNF_CDI_RUN` and `GDX_HNF_CDIH_RUN` were paired, how many persons paired, how many excluded on each side |
| `GDX_HNF_CDI_COMPARE_VALUE` | 1 row per (compare run, paired person) | That person's own real `CDI_VALUE` and `CDIH_VALUE`, side by side |

Deliberately does **not** store a rank, a Pearson r, or a "representative person" flag --
lightweight, deterministic statistics of these two already-frozen numbers, left to
`F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH` to compute at render time (the same posture this folder's
other GRAPH skills already take toward histogram mean/median and per-feature RMS contribution
ranking -- never stored by the compute layer that froze the raw numbers underneath them).

Apply this DDL once (after both F4 DDLs: `hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql`
and `hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql`, this folder) before
this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_CURV_DEPTH_KPI_COMPARE_MODEL/scripts
npm install                                              # once, installs node-firebird
node generate_curvature_depth_compare.js --sample       # sanity check: prints the worked numeric example, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

node generate_curvature_depth_compare.js --study <slug> --dry-run     # real run: logs the pairing, writes nothing
node generate_curvature_depth_compare.js --study <slug>               # real run: writes the comparison
node generate_curvature_depth_compare.js --study <slug> --cdi-run-id <id> --cdih-run-id <id>  # specific runs instead of each study's latest
```

- `--study <slug>` required outside `--sample` -- the same slug F1/F2/F3/F4/F4-alternative use.
- `--cdi-run-id <id>` optional -- a specific `GDX_HNF_CDI_RUN.ID_CDI_RUN` instead of the study's
  latest. Errors if that run belongs to a different study.
- `--cdih-run-id <id>` optional -- a specific `GDX_HNF_CDIH_RUN.ID_CDIH_RUN` instead of the
  study's latest. Errors if that run belongs to a different study.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes the pairing (paired/excluded counts) and logs it, writing no row.
- `--sample` prints this project's own worked numeric example (`CDIx ~= 0.1732` vs.
  `CDIh ~= 0.1458`, section 7.1 above) -- never connects to Firebird, never writes anything.

## Current status

**Implemented and validated end-to-end** against this project's own study 1 (423 cadets,
`ID_STUDY=1`): paired `ID_CDI_RUN=3` (`UNWEIGHTED`, `STUDY_COHORT` reference) against
`ID_CDIH_RUN=4` (`WEIGHTED`, `LATENT_COHORT` reference, PCA latent run) -- 422 paired persons, 0
excluded from either side (both runs share the same complete-case set for this study).

## What this skill will never do

- **Never computes `CDIx` or `CDIh`** -- that stays `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`'s and
  `F4_CURV_DEPTH_KPI_LATENT_SPACE`'s own job respectively; this skill only reads their
  already-frozen rows back.
- **Never computes or stores a Pearson r, a rank, or a "representative person"** -- those are
  `F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH`'s own render-time job, over the rows this skill freezes.
- **Never imputes, defaults, or silently drops a person** missing from one of the two source runs
  -- excluded persons are counted on the run row, never hidden.
- **Never updates an existing `GDX_HNF_CDI_COMPARE_RUN` in place.** Re-pairing the same two source
  runs always creates a new run row, exactly like every other `*_RUN` table in this folder.
- **Never renders an HTML page or any other visualization** -- that is
  `F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH`'s own, separate job.

## Files in this skill

- `../../hypotheses_non_fingo_curvature_depth_index_compare_model_firebird25.sql` -- DDL for the
  two `GDX_HNF_CDI_COMPARE_*` tables this skill writes (must already be applied, together with
  both F4 DDLs and at least one `GDX_HNF_CDI_RUN` and one `GDX_HNF_CDIH_RUN` for the study, before
  this skill's first run)
- `scripts/generate_curvature_depth_compare.js` -- resolves the chosen `GDX_HNF_CDI_RUN` and
  `GDX_HNF_CDIH_RUN`, pairs their complete-case persons by `ID_PERSON`, and writes the
  `GDX_HNF_CDI_COMPARE_*` rows (Node.js + `node-firebird`, no native client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
