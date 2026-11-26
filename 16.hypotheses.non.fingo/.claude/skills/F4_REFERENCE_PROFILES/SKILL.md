---
name: F4_REFERENCE_PROFILES
description: Implements this folder's reference-profiles layer on top of F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own output -- for a given study, annotates the three reference bases that layer already freezes (personal baseline, population/cohort, instrument norm) with structured provenance it does not record on its own (which stratification defined a population/cohort group, which instrument/manual/validation population backs a norm), and pairs, person by person, one PERSONAL_BASELINE-scored GDX_HNF_CDI_RUN with one STUDY_COHORT/POPULATION_REFERENCE-scored GDX_HNF_CDI_RUN evaluated against the SAME GDX_HNF_FEATURE_SPACE_RUN, freezing the two parallel indices (CDIpersonal, CDIpopulation) side by side without ever fusing them into one score. Writes GDX_HNF_REFPROF_STRATUM/GDX_HNF_REFPROF_NORM_SOURCE/GDX_HNF_REFPROF_DUAL_RUN/GDX_HNF_REFPROF_DUAL_VALUE (hypotheses_non_fingo_reference_profiles_model_firebird25.sql, this folder) via scripts/generate_reference_profiles.js --study <slug> [--personal-cdi-run-id <id> --population-cdi-run-id <id>] | [--reference-set-id <id> --stratum VAR=VALUE] | [--reference-set-id <id> --norm-source <path>]. Use when the user asks about the three reference bases and their sense (what each one answers), a baseline-vs-population comparison, a stratified or documented reference, or the "two parallel indices" for a GDX_HUMAN study. Does NOT compute CDIx itself or build a reference set's own center value (that stays F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own job) and does NOT compute the latent-space variant.
---

# F4_REFERENCE_PROFILES

Implements this folder's **reference-profiles** layer: the question every Curvature Depth Index
value in this project depends on -- **distance to what?** -- made auditable as first-class,
structured rows instead of free-text notes, built directly on top of what
**F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS** already computes and freezes.

This skill does not recompute a reference center or a CDI value. It **annotates** three already-
frozen reference bases with provenance that layer has no structured place for, and **pairs** two
already-frozen CDI runs -- one scored against a person's own history, one scored against a group --
so both indices can be read side by side without being merged into one number.

## Three reference bases -- already built, this layer only documents two of them further

`F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` already builds and freezes all three bases discussed here
(plus a fourth, `instrument_norm`, overlapping the third) into `GDX_HNF_CDI_REFERENCE_SET`/
`GDX_HNF_CDI_REFERENCE_VALUE`. This skill's own job for each one:

### 1. Personal baseline

The mean (or median) of one person's own earliest `m` real sessions of `z(t)`:

```
z_j_base = (1/m) * sum_s=1..m z_j(t_s)
```

**Already fully built and stored** (`REFERENCE_TYPE='PERSONAL_BASELINE'`), including the full
per-session, per-feature breakdown behind it (`GDX_HNF_CDI_VALUE_DETAIL` of a run scored against
it). This skill adds **no new table** for this basis -- it is read back, unchanged, only as one
half of the "two parallel indices" pairing below; never persisted a second time.

### 2. Population reference (and study cohort)

The mean of `z(t)` actually realized across a group -- the full complete-case sample of one run
(`study_cohort`) or an explicitly identified, possibly stratified subset (`population_reference`):

```
z_j_pop(t) = [ x_j(t) - mu_j,pop ] / sigma_j,pop        (same z-score shape, population parameters)
```

Standing at the population mean in z-scores (zero) is **not** evidence of an "optimal state" --
being at the center of a distribution says nothing about health, virtue, or spiritual development;
it only locates a profile relative to a chosen group. **Already built and stored** by the same two
tables, but with no structured place to record *which* covariate defined the group. This skill adds
`GDX_HNF_REFPROF_STRATUM` for exactly that -- see "Database structure" below.

### 3. Normative reference (instrument norm)

Values taken from an instrument's own manual or validation study. A psychometric percentile, a
physiological interval and an ordinal category are **not** automatically comparable to one another
-- each instrument's own unit must be preserved and the transformation into the common space
documented. **Already built and stored** (`REFERENCE_TYPE='INSTRUMENT_NORM'`), but with no
structured place to record which manual, instrument version, validation population or unit kind
backs it. This skill adds `GDX_HNF_REFPROF_NORM_SOURCE` for exactly that.

## Separation between normalization and reference (governance principle, not a new table)

Standardizing `z(t)` (freezing `mu`/`sigma`, F1's own job) and choosing what a CDI value is measured
**against** (freezing a reference center, F4's own job) are two independent decisions. It is
legitimate to standardize by population parameters yet compare the result to a personal mean of
earlier, equally standardized sessions -- but redefining `mu`/`sigma` on every session would
introduce a moving comparison point and destroy any longitudinal reading. This skill's own
contribution to that guarantee: the two `GDX_HNF_CDI_RUN` rows paired by `GDX_HNF_REFPROF_DUAL_RUN`
must be scored against the exact **same** `GDX_HNF_FEATURE_SPACE_RUN` -- otherwise a
personal-vs-population comparison would silently rest on two different frozen standardizations.

## Two parallel indices (the one real computation this skill owns)

```
CDIpersonal(t)   = dRMS( z(t), z_base )
CDIpopulation(t) = dRMS( z(t), z_pop-ref )
```

Both are already computed and frozen as two **separate** `GDX_HNF_CDI_RUN`/`GDX_HNF_CDI_VALUE` rows
by `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` (one scored against a `PERSONAL_BASELINE` reference set,
one against a `STUDY_COHORT`/`POPULATION_REFERENCE` reference set). This skill's own job is to pair
them, person by person, and freeze both real scalars side by side in `GDX_HNF_REFPROF_DUAL_VALUE` --
**never** a merged or averaged column. The two indices answer distinct questions -- personal change
over time vs. position relative to a chosen group -- and must not be fused into one score without
separate, explicit justification this schema does not supply on its own. A person present in only
one of the two source runs is excluded from the pairing and **counted**
(`EXCLUDED_PERSONAL_ONLY_COUNT`/`EXCLUDED_POPULATION_ONLY_COUNT`), never imputed.

## What it reads -- and deliberately does NOT re-read

```
GDX_HNF_CDI_REFERENCE_SET   -> which basis (REFERENCE_TYPE), which subject/source run, to attach
                                GDX_HNF_REFPROF_STRATUM/GDX_HNF_REFPROF_NORM_SOURCE rows to
GDX_HNF_CDI_RUN             -> the two runs to pair (ID_INPUT_FEATURE_RUN must match on both)
GDX_HNF_CDI_VALUE           -> the real CDIpersonal/CDIpopulation scalars to copy, per person
```

Never reads `GDX_HNF_CDI_VALUE_DETAIL`, `GDX_HNF_FEATURE_VALUE` or `GDX_HNF_FEATURE_DICTIONARY`
directly, and never re-reads `2.relational.model.psychometrics`, `6.cardiac.coherence`,
`7.multidimensional.database` or `9.knowledge.graph` -- "reading the relational/BI/graph sources"
for this layer is satisfied *transitively*, through F1's and F4's own already-frozen outputs, the
same posture every other skill in this folder already takes one layer down. Never recomputes a
reference center or a CDI value -- only annotates and pairs what the prior skill already froze.

## Database structure

`hypotheses_non_fingo_reference_profiles_model_firebird25.sql` (this folder) creates:

| Table | Grain | Purpose |
|---|---|---|
| `GDX_HNF_REFPROF_STRATUM` | 1 row per (reference set, stratifying variable) | Which covariate (age band, protocol, site, phase, ...) and which level defined a `STUDY_COHORT`/`POPULATION_REFERENCE` group |
| `GDX_HNF_REFPROF_NORM_SOURCE` | 1 row per `INSTRUMENT_NORM` reference set | Instrument/version, manual or validation study, validation population, unit kind, and the transformation into the common space |
| `GDX_HNF_REFPROF_DUAL_RUN` | 1 row per execution | Which `PERSONAL_BASELINE`-scored run and which `STUDY_COHORT`/`POPULATION_REFERENCE`-scored run were paired, how many persons paired, how many excluded on each side |
| `GDX_HNF_REFPROF_DUAL_VALUE` | 1 row per (dual run, paired person) | That person's own real `CDI_PERSONAL_VALUE` and `CDI_POPULATION_VALUE`, side by side -- never fused |

Deliberately does **not** duplicate `GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_REFERENCE_VALUE`/
`GDX_HNF_CDI_VALUE`/`GDX_HNF_CDI_VALUE_DETAIL` -- every reference center and every CDI scalar stays
exactly where `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` already freezes it; this layer only attaches
provenance by FK and copies already-real scalars for a chosen pairing.

Apply this DDL once (after `hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql`, this
folder's F4 schema, and at least one `GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_RUN` already produced
for the study) before this skill's first run.

## Running it

Before doing any real work, this skill checks that the logged-in Claude account's email is
registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) -- not registered tells you to register at the GoDataX.Com
portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

Normal path: run `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS` once with `--reference-type
personal_baseline` and once with `--reference-type study_cohort` (or `population_reference`),
**both against the same evaluated `GDX_HNF_FEATURE_SPACE_RUN`**, then use this skill to annotate
and/or pair the resulting `GDX_HNF_CDI_RUN` rows.

```bash
cd 16.hypotheses.non.fingo/.claude/skills/F4_REFERENCE_PROFILES/scripts
npm install                                                          # once, installs node-firebird
node generate_reference_profiles.js --sample                        # sanity check: the worked numeric example, no DB, writes nothing
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly

# Mode 3 (default) -- pair the two parallel indices. Run-ids optional: default to each study's
# latest run of the required reference type.
node generate_reference_profiles.js --study <slug> --dry-run
node generate_reference_profiles.js --study <slug>
node generate_reference_profiles.js --study <slug> --personal-cdi-run-id <id> --population-cdi-run-id <id>

# Mode 1 -- document which stratification defined a population/cohort reference set:
node generate_reference_profiles.js --study <slug> --reference-set-id <id> --stratum AGE_BAND=18-25 --stratum PROTOCOL=B

# Mode 2 -- document the provenance of an instrument-norm reference set:
node generate_reference_profiles.js --study <slug> --reference-set-id <id> --norm-source ./norm_source_example.json
```

Options:

- `--study <slug>` required outside `--sample` -- the same slug F1/F4 use.
- `--personal-cdi-run-id <id>` mode 3 only, optional. A specific `GDX_HNF_CDI_RUN.ID_CDI_RUN`
  whose reference set must resolve to `PERSONAL_BASELINE`. Defaults to the study's latest such run.
- `--population-cdi-run-id <id>` mode 3 only, optional. A specific `GDX_HNF_CDI_RUN.ID_CDI_RUN`
  whose reference set must resolve to `STUDY_COHORT`/`POPULATION_REFERENCE`. Defaults to the
  study's latest such run.
- `--reference-set-id <id>` required with `--stratum`/`--norm-source`, refused in mode 3.
- `--stratum VAR=VALUE` repeatable, mode 1 only. A variable already recorded for that reference
  set is refused -- stratification is frozen once written.
- `--norm-source <path>` mode 2 only. A JSON file: `{ "instrumentName", "instrumentVersion"
  (optional), "sourceDocument", "normPopulation" (optional), "languageOrCulture" (optional),
  "normUnitKind": "PERCENTILE"|"RAW_INTERVAL"|"ORDINAL_CATEGORY"|"STANDARD_SCORE"|"OTHER",
  "transformationNotes" (required) }`. Refused if the reference set already has a norm-source row.
- `--intake-dir <path>` optional override of the default `new_study_intake/<slug>/` location.
- `--dry-run` computes everything (resolution, pairing/annotation) and logs it, writing no row.
- `--sample` prints the worked numeric example (`CDIpersonal`/`CDIpopulation` on small,
  explicitly-labeled illustrative data) -- never connects to Firebird, never writes anything.

## Current status

**Implemented.** `scripts/generate_reference_profiles.js` runs all three modes described above
against real `GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_RUN`/`GDX_HNF_CDI_VALUE` rows. Not yet run
end-to-end against a live study in this environment -- validate with `--dry-run` first.

## What this skill will never do

- **Never computes `CDIx` or builds a reference set's own center value** -- that stays
  `F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS`'s own job; this skill only reads its already-frozen rows
  back.
- **Never fuses `CDIpersonal` and `CDIpopulation` into one score.** `GDX_HNF_REFPROF_DUAL_VALUE` has
  no merged/averaged column, by design -- the two indices answer different questions.
- **Never pairs two runs scored against two different `GDX_HNF_FEATURE_SPACE_RUN`s** (two different
  frozen standardizations) -- see "Separation between normalization and reference" above.
- **Never imputes, defaults, or silently drops a person** missing from one of the two paired runs --
  excluded persons are counted, never hidden.
- **Never invents a stratification covariate or a norm source.** A `GDX_HNF_REFPROF_STRATUM`/
  `GDX_HNF_REFPROF_NORM_SOURCE` row is written only when the real provenance is known and supplied;
  an unstratified or undocumented reference simply has no row here.
- **Never updates an existing `GDX_HNF_REFPROF_DUAL_RUN` in place.** Re-pairing the same two source
  runs always creates a new row, exactly like every other `*_RUN` table in this folder.
- **Never treats a reference-relative index as evidence of causality, a clinical condition, or a
  validated correspondence to a chakra, a Thomistic Way or a septenary level.**

## Files in this skill

- `../../hypotheses_non_fingo_reference_profiles_model_firebird25.sql` -- DDL for the four
  `GDX_HNF_REFPROF_*` tables this skill writes (must already be applied, together with this folder's
  F4 DDL and at least one `GDX_HNF_CDI_REFERENCE_SET`/`GDX_HNF_CDI_RUN` for the study, before this
  skill's first run)
- `scripts/generate_reference_profiles.js` -- resolves reference sets/CDI runs, validates the
  three modes' own invariants (reference type, matching `ID_INPUT_FEATURE_RUN`, no re-writing a
  frozen annotation), and writes the `GDX_HNF_REFPROF_*` rows (Node.js + `node-firebird`, no native
  client library required)
- `scripts/package.json`
- `.env.example` -- connection variable template (no secrets)
- `SKILL.md` -- this file
