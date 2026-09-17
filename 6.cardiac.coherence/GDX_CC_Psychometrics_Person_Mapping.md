# GDX_HUMAN — Linking Cardiac-Coherence Participants to a Psychometric Study

> Documents how `6.cardiac.coherence/` (Movesense MD ECG/HRV capture) relates to
> `2.relational.model.psychometrics/` (the `GDX_PSY_*` schema), and how
> **GDX_SKILL_LOAD_CC_MAPS_DB** (`.claude/skills/GDX_SKILL_LOAD_CC_MAPS_DB/`) keeps that relation in
> sync, one new study at a time.

## 1. The two schemas share one person identity, not two

`GDX_CC_PERSON` (this folder's `gdx_coerencia_cardiaca_fb25_ddl.sql`) is not an independent person
catalog. Since `7.multidimensional.database/godatax_human_dw_fk_gdx_cc_person_firebird25.sql` was
applied, it carries a real foreign key:

```
GDX_CC_PERSON.ID_PERSON  --FK-->  DW_DIM_PERSON.ID_PERSON
```

and `DW_DIM_PERSON.ID_PERSON` is, by construction (see the DW ETL script,
`7.multidimensional.database/godatax_human_dw_etl_firebird25.sql`, section 2), an unmodified copy of
`GDX_PSY_PERSON.ID_PERSON`. In practice this means:

- A `GDX_CC_PERSON` row can only be created for an `ID_PERSON` that **already exists** in
  `GDX_PSY_PERSON` (via its `DW_DIM_PERSON` mirror).
- The two tables are not two records of the same human linked by a lookup — they use the exact same
  id. There is nothing to "map" between `GDX_CC_PERSON` and `GDX_PSY_PERSON`; that identity already
  holds.

## 2. What is actually missing: which study a cardiac-coherence person belongs to

`GDX_CC_PERSON` and `GDX_CC_SESSION` have **no `ID_STUDY` column at all** — a cardiac-coherence
capture is not scoped to any particular psychometric study by the schema itself. The fact that a
person belongs to a given study is recorded on the psychometrics side, in

```sql
GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, EXPERIMENTAL_GROUP, ENTRY_DATE, CONSENT)
```

(`2.relational.model.psychometrics/psychometrics_model_firebird25.sql`). So "associating a
cardiac-coherence participant with the new study" concretely means: insert the
`GDX_PSY_STUDY_PARTICIPANT` row for that `(ID_STUDY, ID_PERSON)` pair — not writing anything into
`GDX_CC_PERSON` or `GDX_PSY_PERSON`, which already agree on identity per §1.

## 3. GDX_SKILL_LOAD_CC_MAPS_DB

Third pipeline step alongside `GDX_SKILL_LOAD_SEPT_MAPS_DB`
(`3.septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/`), run independently and in
either order after `GDX_SKILL_RECORD_NEW_STUDY`:

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_STUDY row exists
        |
        v
GDX_SKILL_LOAD_CC_MAPS_DB    -- node load_cc_maps.js --study <slug>
                                 reads that SAME intake.json for the study's ID_STUDY, finds
                                 cardiac-coherence participants with no study yet, and inserts
                                 their GDX_PSY_STUDY_PARTICIPANT association
```

### Scope rule

Because `GDX_CC_PERSON`/`GDX_CC_SESSION` carry no `ID_STUDY` (§2), the skill cannot read "belongs to
this new study" off the schema — it applies one explicit rule instead of inferring it per run. A
cardiac-coherence person is treated as belonging to the study passed via `--study` when **both**:

1. It has at least one row in `GDX_CC_SESSION` (real captured data, not just a registered-but-unused
   `GDX_CC_PERSON` row), and
2. It has **no `GDX_PSY_STUDY_PARTICIPANT` row for any study yet** (a brand-new participant, not
   already claimed by an earlier study).

This is a deliberate simplification: it is correct for the common case (a batch of new participants
recruited together for one new study), but it means a participant who has *already* taken part in an
earlier study is never picked up automatically for a later one, even if that is genuinely intended —
that case needs a manual `GDX_PSY_STUDY_PARTICIPANT` insert with the right `ID_STUDY`, not a change to
this skill's default rule (see its `SKILL.md` for the same caveat).

### What it never does

- Never writes to `GDX_CC_PERSON`, `GDX_CC_SESSION`, or `GDX_PSY_PERSON` — the only table it inserts
  into is `GDX_PSY_STUDY_PARTICIPANT`.
- Never invents `CONSENT`. The cardiac-coherence schema has no consent field, so every inserted row
  gets `CONSENT = 0` (not confirmed); a human must update it once real consent is confirmed.
- Never reassigns or duplicates an existing study association.

See `GDX_SKILL_LOAD_CC_MAPS_DB/SKILL.md` for the exact algorithm and how to run it
(`node load_cc_maps.js --study <slug> --dry-run`, then without `--dry-run` to apply).

## 4. Open gap

There is currently no skill that loads new `GDX_PSY_PERSON` rows for people who show up first as
cardiac-coherence participants (the reverse of `2.relational.model.psychometrics/samples.SQL/`
`04_load_persons_participants.sql`, which loaded `GDX_PSY_PERSON` from the historical `.sav` file).
Today, a person must already exist in `GDX_PSY_PERSON` before a `GDX_CC_PERSON` row referencing the
same id can be created (enforced by `FK_GDX_CC_PERSON_DW_PERSON`, §1) — `GDX_SKILL_LOAD_CC_MAPS_DB`
only links an *existing* person to a study, it does not register a new one.
