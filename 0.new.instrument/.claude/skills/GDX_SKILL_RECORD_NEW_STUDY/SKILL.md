---
name: GDX_SKILL_RECORD_NEW_STUDY
description: Reads the intake JSON produced by GDX_SKILL_NEW_STUDY, generates the corresponding Firebird 2.5 load scripts (GDX_PSY_STUDY, GDX_PSY_PHENOMENON, GDX_PSY_CONSTRUCT, GDX_PSY_VARIABLE, GDX_PSY_INDICATOR, GDX_PSY_INSTRUMENT, GDX_PSY_INSTRUMENT_ITEM, GDX_PSY_ITEM_ALTERNATIVE, GDX_PSY_INDICATOR_ITEM), and can execute them against a live Firebird database (godatax.human, 2.relational.model.psychometrics). Use right after GDX_SKILL_NEW_STUDY has written a validated new_study_intake/<slug>/intake.json, to actually persist the new study/instrument/scale into the database.
---

# GDX_SKILL_RECORD_NEW_STUDY

Two-stage skill, second half of the "onboard a new instrument" pipeline (see
`GDX_SKILL_NEW_STUDY`'s `SKILL.md` for the first half):

1. **Generate** (Python, zero dependencies) — reads an `intake.json` and writes
   `01_new_study.sql` + one `02_new_instrument_NN_<slug>.sql` per instrument into the same folder.
2. **Execute** (Node.js + `node-firebird`) — runs those scripts against the target Firebird
   database over the wire protocol (no native client library required).

## Why this looks different from GDX_SKILL_LOAD_RLT_MODEL_DB's scripts

That sibling skill's `01_load_study.sql` .. `08_adjust_sequences.sql` hardcode every surrogate key
(`ID_STUDY = 1`, `ID_INSTRUMENT` 1-11, ...) because they load one frozen historical dataset once.
This skill has to stay safe to run **repeatedly, against a database that may already have other
studies and instruments in it** — it never knows in advance what the next free id is. So instead:

- Every `GDX_PSY_*` row is inserted **without** specifying its id column; the trigger already in
  `psychometrics_model_firebird25.sql` (`BI_GDX_PSY_*`) assigns it from the matching
  `SEQ_GDX_PSY_*` sequence.
- Wherever a child row needs the id a parent row just got (e.g. `GDX_PSY_INSTRUMENT_ITEM` needs the
  `ID_INSTRUMENT` that was just created), the generated file is a single Firebird 2.5
  `EXECUTE BLOCK ... END` statement that captures it with `RETURNING ID_X INTO :V_ID_X` and reuses
  that variable for every child insert in the same block. This is why `execute_new_study.js` cannot
  reuse the sibling's naive "split the file on every `;`" runner — an `EXECUTE BLOCK` has semicolons
  and quotes inside it that are not statement boundaries. It sends the whole block as one statement
  instead (see `parseFile` in `execute_new_study.js`).
- `01_new_study.sql` looks the study up by `TITLE` first and only inserts if missing — safe to run
  again for a second instrument under the same study. `02_new_instrument_*.sql` looks
  `GDX_PSY_PHENOMENON`/`GDX_PSY_CONSTRUCT` up **by name** first (reused if `GDX_SKILL_NEW_STUDY`'s
  interview correctly pointed at an existing phenomenon/construct), but always inserts a fresh
  `GDX_PSY_INSTRUMENT` row and everything under it — that row **is** the new thing being onboarded,
  so a genuine duplicate (same `NAME` + `VERSION`) is deliberately left to fail loudly on Firebird's
  own `UNIQUE` constraint rather than being silently skipped.

## Step 1 — generate

```
python GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts/generate_new_study_scripts.py \
  GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json
```

This re-validates the intake file first (by loading `GDX_SKILL_NEW_STUDY`'s `validate_intake.py`
from the sibling skill folder) and refuses to generate anything if it finds a problem — fix the
intake file (or send the user back to `GDX_SKILL_NEW_STUDY`) rather than patching the generated SQL
by hand. Output goes next to the intake file unless `--out-dir <dir>` is given.

**Read the generated `.sql` before running it.** In particular check:

- Every `EXECUTE BLOCK` starts with the right `DECLARE VARIABLE` list and nothing references a
  variable that was never declared (the generator derives these mechanically from
  `constructs`/`variables` in the intake file — if a name has a typo there, the SQL will fail fast
  in Firebird with a clear "variable unknown" error, not silently misfile data).
- Item statement text, response alternatives and `REVERSED` flags read back correctly — this is the
  actual scientific content of the instrument; a mistake here is a data-quality bug, not a syntax
  one, and neither this script nor Firebird can catch it for you.
- Each `INSERT INTO GDX_PSY_VARIABLE` row's `VARIABLE_TYPE` is the one you expect. It comes from
  `intake.json`'s `study.study_type` (`'PSYCHOLOGICAL'` for a `PSYCHOMETRIC` study, `'METAPHYSICS'`
  for a `METAPHYSICOMETRIC` one — asked as the very first question by `GDX_SKILL_NEW_STUDY`), unless
  a given `variables[].variable_type` overrode it for a mixed study. The generator also prints this
  default to stdout (`study_type=... -> default VARIABLE_TYPE=...`) and repeats it as a comment at
  the top of every `02_new_instrument_*.sql` file.

## Step 2 — execute against the database

Connection is read entirely from environment variables (see `.env.example` in this skill folder,
same database/credentials as `GDX_SKILL_LOAD_RLT_MODEL_DB` / `GDX_SKILL_NEW_STUDY`) — **never
hardcode host/user/password**.

```
cd GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node execute_new_study.js --dir ../../../../new_study_intake/<slug> --dry-run   # sanity check
node execute_new_study.js --dir ../../../../new_study_intake/<slug>            # real load
```

**Before running the real (non-dry-run) load against the live database, confirm with the user
first** — this is a write to a shared remote system. A dry run and a one-line summary (instrument
count, item count, from step 1's output) is enough context for the user to say go/no-go.

### Safety behavior already built into `execute_new_study.js`

- **Preflight schema check** — refuses to run if any `GDX_PSY_*` table is missing (tells the user to
  apply `psychometrics_model_firebird25.sql` first). It does **not** apply the DDL itself.
- **Dry-run** — `--dry-run` parses every file, connects, runs the preflight check, and counts
  statements, but executes nothing.
- **Never deletes/truncates anything.** A failed run leaves whatever committed before the failure
  in place (each `EXECUTE BLOCK` is its own transaction) — re-running after fixing the problem will
  hit the `01_new_study.sql` idempotency guard for the study and, for the instrument, either succeed
  (if the previous run's `INSERT INTO GDX_PSY_INSTRUMENT` never committed) or fail loudly on the
  `UNIQUE (NAME, VERSION)` constraint (if it did) — in the latter case, the fix is a manual decision
  by the user (bump the version, or clean up the partial instrument by hand), not something to
  script around.

## Step 3 — septenary-level mapping (optional next step)

Once the real load has committed, the new study's variables can be linked to the seven-level
septenary constitution (`3.septenary.constitution/`) with **GDX_SKILL_LOAD_SEPT_MAPS_DB**, passing
the same intake slug:

```
node GDX_HUMAN/3.septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/load_sept_maps.js \
  --study <slug> --dry-run
```

That skill reads this same `new_study_intake/<slug>/intake.json`, resolves it against the rows this
skill just created, and creates `GDX_PSY_SEPT_LEVEL_PSY_MAP` rows **only for this study** — see its
own `SKILL.md` for details. Not every study needs this (it is a philosophical/interpretive overlay,
not part of the core psychometrics schema), so only point the user at it if they want that mapping.

If the study's participants also have cardiac-coherence sessions recorded
(`6.cardiac.coherence/`), **GDX_SKILL_LOAD_CC_MAPS_DB** links them to this study's
`GDX_PSY_STUDY_PARTICIPANT`, passing the same slug:

```
node GDX_HUMAN/6.cardiac.coherence/.claude/skills/GDX_SKILL_LOAD_CC_MAPS_DB/scripts/load_cc_maps.js \
  --study <slug> --dry-run
```

See its own `SKILL.md` for the scope rule (only cardiac-coherence persons with a recorded session
and no study yet are associated).

## Step 4 — collect and load participant answers

Once the study has real instruments loaded, **GDX_SKILL_EXPORT_NEW_STUDY** (same `.claude/skills/`
folder) reads them back out of Firebird and writes a blank `.xlsx` questionnaire to send to
participants; **GDX_SKILL_LOAD_NEW_STUDY_ANSWERS** then loads each filled-in copy back into
`GDX_PSY_PERSON` / `GDX_PSY_STUDY_PARTICIPANT` / `GDX_PSY_APPLICATION` / `GDX_PSY_ITEM_RESPONSE`:

```
node GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts/export_new_study.js \
  --study <slug>
# ... duplicate the file per participant, send it out, wait for filled copies back ...
node GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_ANSWERS/scripts/load_new_study_answers.js \
  --file <path-to-filled.xlsx> --dry-run
```

See `New_Instrument_Onboarding_Process.md` §6 for the full contract (the workbook's hidden META
sheet, answer-matching rules, idempotency) and each skill's own `SKILL.md` for details.

## Step 5 — make the study queryable in the multidimensional DW

Once the study has instruments, participants and (optionally) septenary/cardiac-coherence data
loaded, **GDX_SKILL_LOAD_NEW_STUDY_DW** (`7.multidimensional.database/`) loads that one study into
the star schema documented in `GoDataX_Human_7_DW.md`, insert-if-missing and safe to run again later:

```
node GDX_HUMAN/7.multidimensional.database/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_DW/scripts/load_new_study_dw.js \
  --study <slug> --dry-run
```

See its own `SKILL.md` and `GoDataX_Human_7_DW.md` §8 for how it differs from the folder's existing
whole-database, one-shot ETL.

## Files in this skill

- `scripts/generate_new_study_scripts.py` — stage 1 (pure Python, no dependencies; imports
  `validate_intake.py` from the sibling `GDX_SKILL_NEW_STUDY` skill rather than duplicating it)
- `scripts/execute_new_study.js` + `scripts/package.json` — stage 2 (Node.js + node-firebird)
- `.env.example` — connection variable template (no secrets)
