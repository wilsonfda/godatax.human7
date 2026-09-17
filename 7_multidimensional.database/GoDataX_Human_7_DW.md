# GoDataX Human 7 DW — Multidimensional Model

> Generated 2026-09-10, updated 2026-09-17. Location: `GDX_HUMAN/7_multidimensional.database/`
>
> Scripts documented here:
> - `godatax_human_dw_model_firebird25.sql` — star-schema DDL (11 dimensions + 3 facts)
> - `godatax_human_dw_etl_firebird25.sql` — whole-database, one-shot ETL (plain SQL, same-database);
>   see section 8 for why it is not the tool for loading a newly onboarded study into a live DW
> - `.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/` — per-study, insert-if-missing loader (Node.js);
>   see section 8
>
> The first two scripts were applied and run end-to-end against the live `godatax.human` Firebird database during development; the row counts in §5 are real, not estimated.

## 1. Purpose

A single analytical (star-schema) layer relating every perspective already modeled as separate OLTP schemas under `GDX_HUMAN`:

| Folder | Schema | Perspective |
|---|---|---|
| `2_relational.model.psychometrics` | `GDX_PSY_*` | Psychometric / psychological |
| `3_septenary.constitution` | `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_SEPT_LEVEL_PSY_MAP` | Metaphysical |
| `4_kundalini.chakras` | `GDX_PSY_CHAKRA` | Energetic |
| `5_five.ways.tomas.aquino` | `GDX_TA_WAY`, `GDX_TA_WAY_SEPT_MAP` | Metaphysical |
| `6_cardiac.coherence` | `GDX_CC_*` | Physiological |

Each of these is a separate, independently-evolving OLTP schema. The DW does not replace them — it is a read-oriented copy, reshaped as a star schema, that lets a single query cross perspectives (e.g. "for people whose Hardiness-Challenge score is high, and whose corresponding septenary level is Buddhic, what chakra and which of Aquinas's Five Ways share that same level?").

## 2. The one rule that shapes the whole design: `GDX_PSY_PERSON` is central

Per explicit instruction, **`GDX_PSY_PERSON` is the single, central person table for the entire DW.** `DW_DIM_PERSON` is sourced from it alone — there is no second, redundant person dimension for the cardiac-coherence side.

`GDX_CC_PERSON` remains its own OLTP table in its own schema (folder 6), with its own `PK_GDX_CC_PERSON`/`GEN_GDX_CC_PERSON` — that has not changed. What changed, in an earlier step of this same project, is that `GDX_CC_PARTICIPANT`/`PARTICIPANT_ID` were renamed to `GDX_CC_PERSON`/`ID_PERSON` specifically so that, going forward, `GDX_CC_SESSION.ID_PERSON` is understood to point into the **same person key space** as `GDX_PSY_PERSON.ID_PERSON`. The DW's ETL enforces this as a **data contract**, not by merging the two OLTP tables:

```sql
-- DW_DIM_SESSION only loads a session if its person already exists centrally:
WHERE EXISTS (SELECT 1 FROM DW_DIM_PERSON P WHERE P.ID_PERSON = S.ID_PERSON)
```

Sessions belonging to a `GDX_CC_PERSON.ID_PERSON` that has no matching row in `GDX_PSY_PERSON` are silently excluded from the DW (not FK-violated, not guessed at) — see §6 for what this looked like in practice during testing.

**Now enforced at the database level, not just by the ETL.** `godatax_human_dw_fk_gdx_cc_person_firebird25.sql` (this folder) adds:

```sql
ALTER TABLE GDX_CC_PERSON
  ADD CONSTRAINT FK_GDX_CC_PERSON_DW_PERSON
  FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON (ID_PERSON);
```

From this point on, Firebird itself rejects any `GDX_CC_PERSON` row whose `ID_PERSON` doesn't already exist in `DW_DIM_PERSON` — verified directly:

```
INSERT INTO GDX_CC_PERSON (ID_PERSON, EXTERNAL_CODE) VALUES (999999, 'SHOULD-FAIL');
-- Violation of FOREIGN KEY constraint "FK_GDX_CC_PERSON_DW_PERSON" ...
-- Problematic key value is ("ID_PERSON" = 999999)
```

The FK points at `DW_DIM_PERSON` specifically (not at `GDX_PSY_PERSON` directly), since `DW_DIM_PERSON.ID_PERSON` is an unmodified copy of `GDX_PSY_PERSON.ID_PERSON` and this is the BI/DW-facing connection the constraint was asked for. One consequence worth naming: `DW_DIM_PERSON` is no longer a purely read-only reporting copy — it must be loaded (via the ETL) before any `GDX_CC_PERSON` row can be inserted, and it can no longer be freely truncated/reloaded without first considering `GDX_CC_PERSON`'s dependency on it (see §7, item 4).

## 3. Star schema

### Dimensions

| Table | Source | Key reused from source? |
|---|---|---|
| `DW_DIM_PERSON` | `GDX_PSY_PERSON` + `GDX_PSY_STUDY_PARTICIPANT` + `GDX_PSY_STUDY` | Yes — `ID_PERSON` |
| `DW_DIM_INSTRUMENT` | `GDX_PSY_INSTRUMENT` | Yes — `ID_INSTRUMENT` |
| `DW_DIM_CONSTRUCT` | `GDX_PSY_CONSTRUCT` | Yes — `ID_CONSTRUCT` |
| `DW_DIM_VARIABLE` | `GDX_PSY_VARIABLE` (+ instrument via bridge, + septenary level via reconciliation) | Yes — `ID_VARIABLE` |
| `DW_DIM_ITEM` | `GDX_PSY_INSTRUMENT_ITEM` | Yes — `ID_ITEM` |
| `DW_DIM_SEPTENARY_LEVEL` | `GDX_PSY_SEPTENARY_LEVEL` | Yes — `ID_SEPTENARY_LEVEL` |
| `DW_DIM_CHAKRA` | `GDX_PSY_CHAKRA` | Yes — `ID_CHAKRA` |
| `DW_DIM_FIVE_WAY` | `GDX_TA_WAY` (+ level via `GDX_TA_WAY_SEPT_MAP`) | Yes — `ID_WAY` |
| `DW_DIM_DEVICE` | `GDX_CC_DEVICE` | Yes — `DEVICE_ID` |
| `DW_DIM_SESSION` | `GDX_CC_SESSION`, filtered to known persons | Yes — `SESSION_ID` |
| `DW_DIM_DATE` | generated, 2020-01-01..2030-12-31 | No — only generated dimension; `DATE_KEY = -1` is the reserved "no date" member used by every psychometric fact row (the `.sav` carries no calendar date) |

No dimension key is reinvented where the source already has a clean `BIGINT` primary key — reusing it avoids a redundant parallel ID space, in the same spirit as the "no redundancy" rule for person.

### Facts (every metric lives here, never in a dimension)

| Table | Grain | Metrics |
|---|---|---|
| `DW_FACT_PSY_ITEM_RESPONSE` | (person, item) | `NUMERIC_VALUE` — raw questionnaire response |
| `DW_FACT_PSY_VARIABLE_RESULT` | (person, variable) | `RAW_SCORE`, `STANDARDIZED_SCORE`, `PERCENTILE` — computed dimension score |
| `DW_FACT_CC_HRV_WINDOW` | (person, session, window) | `RMSSD_MS`, `SDNN_MS`, `COHERENCE_INDEX`, `MEAN_HEART_RATE_BPM`, `MEAN_RR_MS`, `RESPIRATORY_RATE`, `ARTIFACT_PERCENTAGE`, `VALID_BEAT_COUNT`, `WINDOW_SECONDS` |

Raw per-sample cardiac data (`GDX_CC_RR_INTERVAL`, `GDX_CC_ECG_SAMPLE`, `GDX_CC_MOTION`) is intentionally **not** in the DW — it's sensor-level granularity (thousands of rows per session) with no analytical counterpart in the other perspectives. `GDX_CC_HRV_WINDOW` is already the aggregated metric at the right grain to relate to a psychometric score or a session.

Every fact carries `ID_PERSON` directly (a standard fact-table FK, not a redundant copy of a dimensional attribute — a fact's grain always includes "who").

### How a psychometric fact reaches the metaphysical/energetic perspectives

`DW_FACT_PSY_VARIABLE_RESULT` → `DW_DIM_VARIABLE.ID_SEPTENARY_LEVEL` → `DW_DIM_SEPTENARY_LEVEL` → (`DW_DIM_CHAKRA` / `DW_DIM_FIVE_WAY`, both FK'd to the same level)

That single FK on `DW_DIM_VARIABLE` (not duplicated on the fact) is what lets one query relate a psychometric score to "its" chakra and "its" way of Aquinas at once. `DW_DIM_CHAKRA` and `DW_DIM_FIVE_WAY` have no fact of their own — they're pure reference dimensions, reached only by walking through the level.

## 4. ETL logic worth calling out

The ETL is plain SQL (`INSERT ... SELECT`), not a host-language script — source and target live in the same Firebird database, so there is no cross-database transport step to write. Two places needed real logic beyond a straight copy:

1. **Calendar generation** — an `EXECUTE BLOCK` loop inserts one row per day, 2020-01-01 through 2030-12-31.
2. **Septenary-level reconciliation for `DW_DIM_VARIABLE`** — `GDX_PSY_SEPT_LEVEL_PSY_MAP` (folder 3) was populated *before* the `GDX_PSY_VARIABLE` catalog existed, using only free-text labels like `"Vigor -> ENGAGvigor"`. Its `ID_VARIABLE` column is `NULL` on every row. The ETL parses each variable's own `.sav` column name out of `GDX_PSY_VARIABLE.OPERATIONAL_DEFINITION` (format `".sav column: ENGAGvigor (...)"`), then matches it against the mapping table with `VARIABLE_LABEL CONTAINING ('-> ' || :SAV_COL)`. This resolves the level **for the DW copy only** — `GDX_PSY_SEPT_LEVEL_PSY_MAP` itself is never written to.

## 5. Validated load (real run against `godatax.human`)

| Table | Rows |
|---|---|
| `DW_DIM_DATE` | 4,019 |
| `DW_DIM_PERSON` | 423 |
| `DW_DIM_INSTRUMENT` | 11 |
| `DW_DIM_CONSTRUCT` | 11 |
| `DW_DIM_SEPTENARY_LEVEL` | 7 |
| `DW_DIM_CHAKRA` | 7 |
| `DW_DIM_FIVE_WAY` | 5 |
| `DW_DIM_VARIABLE` | 21 (16 with a resolved septenary level) |
| `DW_DIM_ITEM` | 138 |
| `DW_DIM_DEVICE` | 1 |
| `DW_DIM_SESSION` | 5 |
| `DW_FACT_PSY_ITEM_RESPONSE` | 58,374 |
| `DW_FACT_PSY_VARIABLE_RESULT` | 8,882 |
| `DW_FACT_CC_HRV_WINDOW` | 5 |

## 6. Cardiac coherence sample data is now synchronized to a real `GDX_PSY_PERSON`

The synthetic cardiac-coherence demo data (`gdx_coerencia_cardiaca_dml_simulacao_fb25.sql`, folder 6) originally used `GDX_CC_PERSON.ID_PERSON = 101` — a standalone demo ID with no counterpart in `GDX_PSY_PERSON` (which ranges 784–1645). Per the central-person rule (§2), the ETL correctly excluded that data: `DW_DIM_SESSION`/`DW_FACT_CC_HRV_WINDOW` loaded as 0 rows. That was the intended behavior for an unsynchronized ID, not a bug — but it also meant the physiological perspective was never actually exercised end-to-end.

The source file was then edited to use `ID_PERSON = 784` instead of `101` throughout (the `GDX_CC_PERSON` insert, all 5 `GDX_CC_SESSION` inserts, and the trailing `SET GENERATOR GEN_GDX_CC_PERSON`), with a comment explaining the intentional sync to `GDX_PSY_PERSON.ID_PERSON = 784` (`EXTERNAL_IDENTIFIER 'SPSS-784'`). After reloading the OLTP data and re-running the ETL, both tables now populate for real:

```sql
SELECT P.EXTERNAL_IDENTIFIER, H.STRESS_CLASS, H.COHERENCE_INDEX, VR.RAW_SCORE, V.NAME, L.NAME
FROM DW_FACT_CC_HRV_WINDOW H
JOIN DW_DIM_PERSON P ON P.ID_PERSON = H.ID_PERSON
JOIN DW_FACT_PSY_VARIABLE_RESULT VR ON VR.ID_PERSON = H.ID_PERSON
JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = VR.ID_VARIABLE
LEFT JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
WHERE V.NAME = 'Vigor (Engagement)';
-- -> SPSS-784 | BASELINE  | 0.42 | 3.2 | Vigor (Engagement) | Vital/Etheric Body
-- -> SPSS-784 | ACTIVATED | 0.58 | 3.2 | Vigor (Engagement) | Vital/Etheric Body
-- -> SPSS-784 | RELAXED   | 0.91 | 3.2 | Vigor (Engagement) | Vital/Etheric Body
-- -> SPSS-784 | INCONCLUSIVE | 0.25 | 3.2 | Vigor (Engagement) | Vital/Etheric Body
-- -> SPSS-784 | STRESSED  | 0.12 | 3.2 | Vigor (Engagement) | Vital/Etheric Body
```

One query, one person, all four perspectives at once: physiological (coherence index / stress class per session), psychometric (Vigor raw score), and metaphysical/energetic (the Vital/Etheric Body septenary level that `Vigor` resolves to, reachable from there to its chakra too). This is the scenario the whole DW was built for.

**Still true for production data:** any *other* cardiac-coherence participant needs to be recorded with an `ID_PERSON` that already exists centrally — now enforced by the `FK_GDX_CC_PERSON_DW_PERSON` constraint itself (§2), not only by convention.

## 7. Known gaps / things a future revision should address

1. ~~`GDX_CC_SESSION.ID_PERSON` has no DB-level FK to `GDX_PSY_PERSON`~~ — **resolved.** `godatax_human_dw_fk_gdx_cc_person_firebird25.sql` added `FK_GDX_CC_PERSON_DW_PERSON` (`GDX_CC_PERSON.ID_PERSON` → `DW_DIM_PERSON.ID_PERSON`); see §2. This constrains `GDX_CC_PERSON` at insert time, which transitively constrains `GDX_CC_SESSION` (already FK'd to `GDX_CC_PERSON`).
2. `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s free-text `VARIABLE_LABEL` reconciliation is a `CONTAINING` substring match — it correctly leaves `EmocNeg` unresolved because that mapping row's label is `"Positive/Negative Emotions -> EmocPos / EmocNeg"` (the substring search only finds `-> EmocPos`, not `-> EmocNeg`); a future edit to that source label (e.g. splitting it into two rows) would let the ETL resolve it without any DW-side change.
3. `AnoOrg`, `SucProfFin`, `CondSocie`, `RedTap` are deliberately unresolved — they were excluded from the septenary mapping from the start (documented as contextual/environmental, not consciousness levels, in `SPSS_Septenary_Constitution_Mapping.md` §3).
4. Re-running the ETL is **not idempotent** — there is no "already loaded" guard on the DW tables (unlike `execute_load.js` for the psychometrics OLTP load). Reloading means truncating the `DW_*` tables first — and now, because of item 1's new FK, `DW_DIM_PERSON` specifically can no longer be truncated while any `GDX_CC_PERSON` row still references it; `GDX_CC_PERSON`/`GDX_CC_SESSION` (and their cascaded children) would need clearing first.
5. **`GDX_CC_SESSION.SESSION_ID` deliberately has no FK to `DW_DIM_SESSION`** (considered, rejected). Unlike person, `DW_DIM_SESSION` is populated *from* `GDX_CC_SESSION` itself (`INSERT INTO DW_DIM_SESSION ... SELECT ... FROM GDX_CC_SESSION`), so a `GDX_CC_SESSION → DW_DIM_SESSION` FK would be circular: a new session could never be inserted into `GDX_CC_SESSION` (its `SESSION_ID` wouldn't yet exist in `DW_DIM_SESSION`), and `DW_DIM_SESSION` can only learn that `SESSION_ID` by reading it back out of `GDX_CC_SESSION`. The reverse direction (`DW_DIM_SESSION.SESSION_ID → GDX_CC_SESSION.SESSION_ID`) would be structurally valid but adds no real protection beyond what the ETL's `SELECT ... FROM GDX_CC_SESSION` already guarantees by construction — so, for now, no FK was added either way. Session-level integrity is still indirectly covered: every `GDX_CC_SESSION` row's `ID_PERSON` is FK'd to `GDX_CC_PERSON`, which is now FK'd to `DW_DIM_PERSON` (item 1).
6. ~~Reloading the DW for a newly onboarded study means truncating everything and rebuilding from scratch~~ — **addressed for the ongoing case** by `GDX_SKILL_LOAD_NEW_STUDY_DW` (see section 8): a per-study, insert-if-missing loader that never truncates. This script (`godatax_human_dw_etl_firebird25.sql`) remains the right tool for building the DW from an empty state; it is not meant to be re-run against a live DW that already has other studies loaded.

## 8. `GDX_SKILL_LOAD_NEW_STUDY_DW` — incremental, per-study loading

The whole-database ETL above (`godatax_human_dw_etl_firebird25.sql`) is the right tool for building
the DW once, from an empty state, across every study that already exists in the OLTP schemas. It is
the wrong tool for the ongoing case — a new study being onboarded through
`GDX_HUMAN/0_new_instrument/`'s skill family (`GDX_SKILL_NEW_STUDY` → `GDX_SKILL_RECORD_NEW_STUDY` →
`GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`, optionally also `GDX_SKILL_LOAD_SEPT_MAPS_DB` and
`GDX_SKILL_LOAD_CC_MAPS_DB`) needs its data added to a DW that may already be populated with other
studies, without truncating any of it.

`GDX_SKILL_LOAD_NEW_STUDY_DW` (`.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/`, this folder) is that
tool: given `--study <slug>`, it loads exactly that study's rows into every dimension and fact above,
**insert-if-missing**, safe to run again later (e.g. after more participants answer, or after
`GDX_SKILL_LOAD_SEPT_MAPS_DB`/`GDX_SKILL_LOAD_CC_MAPS_DB` add more data for the same study) without
duplicating anything or touching any other study's rows.

Three design points worth calling out here, beyond what the skill's own `SKILL.md` documents:

- **Scope resolution mirrors `GDX_SKILL_LOAD_SEPT_MAPS_DB`.** `GDX_PSY_INSTRUMENT`/`CONSTRUCT`/
  `VARIABLE` have no `ID_STUDY` column (they are global catalogs), so the skill reads
  `new_study_intake/<slug>/intake.json` to know which ones belong to this study and resolves each by
  name. `GDX_PSY_APPLICATION.ID_STUDY` scopes the two psychometric facts directly; cardiac-coherence
  sessions (no `ID_STUDY` at all) are scoped through `GDX_PSY_STUDY_PARTICIPANT`, the same table
  `GDX_SKILL_LOAD_CC_MAPS_DB` populates.
- **The septenary-level reconciliation (section 4, item 2 above) now has two forms, not one.** The
  original ETL only knew the `.sav`-column form (`VARIABLE_LABEL CONTAINING '-> ' || SAV_COLUMN`),
  because every variable that existed when it was written came from the one historical `.sav` load.
  A variable onboarded via `GDX_SKILL_NEW_STUDY` has no `.sav` file at all, so
  `GDX_SKILL_LOAD_SEPT_MAPS_DB` keys its mapping by the variable's own name instead (see that skill's
  `SKILL.md` and `3_septenary.constitution/SPSS_Septenary_Constitution_Mapping.md` section 5).
  `GDX_SKILL_LOAD_NEW_STUDY_DW` reconciles with **both** forms — `.sav`-column match when there is
  one, an exact name match otherwise — or a new study's variables would simply never resolve a level
  in the DW even after `GDX_SKILL_LOAD_SEPT_MAPS_DB` had already mapped them in the OLTP table.
- **The DW's fact grain is `(person, item)` / `(person, variable)`, not `(person, item, application)`**
  (see the `UQ_DW_FACT_PSY_RESP` / `UQ_DW_FACT_PSY_VARRES` constraints in
  `godatax_human_dw_model_firebird25.sql`) — a pre-existing property of the star schema, not something
  this skill changes. If the same person already has a DW fact for an item/variable from a *different*
  `GDX_PSY_APPLICATION` (e.g. they took the same instrument again under a second study), this skill
  will not overwrite it; it reports the collision and leaves the existing fact as-is, since deciding
  which application's value should win the DW's single cell is an analytical/business decision, not
  something a loader should silently resolve.

Global reference dimensions with no natural study scope — `DW_DIM_DATE`, `DW_DIM_SEPTENARY_LEVEL`,
`DW_DIM_CHAKRA`, `DW_DIM_FIVE_WAY` — are bootstrapped once (insert-if-missing per row) and left
untouched by every later run, whichever study triggered it.
