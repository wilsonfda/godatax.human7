# GDX_HUMAN — Onboarding a New Study / Instrument / Behavioral Scale

> Written 2026-09-17, updated 2026-09-17, documenting the four Claude Code skills created for this:
> `GDX_SKILL_NEW_STUDY`, `GDX_SKILL_RECORD_NEW_STUDY`, `GDX_SKILL_EXPORT_NEW_STUDY` and
> `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`, all living under `GDX_HUMAN/0.new.instrument/.claude/skills/`.

## 1. Why this exists

Until now, GDX_HUMAN's psychometrics relational model
(`2.relational.model.psychometrics/psychometrics_model_firebird25.sql`) had exactly one study
loaded into it: *"Predictors of Adaptability to Military Higher Education"*, via
`GDX_SKILL_LOAD_RLT_MODEL_DB` (see that skill's `SKILL.md`). That skill is purpose-built to read one
specific SPSS `.sav` export and a hand-extracted catalog of instrument/item metadata
(`scripts/catalog.py`) that only makes sense for that one dataset — it is not a general "add a new
study" tool, and was never meant to be one.

This document describes the four skills that fill that gap: a repeatable way to register a **new**
study, with **new** measurement instruments, **new** behavioral scales (constructs/dimensions),
**new** items and their response anchors, and the scoring weights (including reverse-scoring)
between items and dimensions — all grounded in the same `GDX_PSY_*` schema, without editing any
Python catalog by hand and without ever touching the one study that is already loaded — and then to
actually collect and load real participant answers against that new instrument, closing the loop from
"describe a new study" all the way to "participant responses are in `GDX_PSY_ITEM_RESPONSE`".

## 2. The four skills, at a glance

```
 a person describes a new study/instrument to Claude
                    |
                    v
 +----------------------------------+
 | GDX_SKILL_NEW_STUDY              |   conversational -- asks questions, does not write to the DB
 |  - reads the schema + the live   |
 |    catalog (check_catalog.js)    |
 |  - interviews the user, table    |
 |    by table                      |
 |  - writes + validates an intake  |
 |    JSON                          |
 +----------------------------------+
                    |
                    v
   new_study_intake/<slug>/intake.json      <-- the contract between the two skills
                    |
                    v
 +----------------------------------+
 | GDX_SKILL_RECORD_NEW_STUDY       |   generator + DB writer
 |  - re-validates intake.json      |
 |  - generates 01_new_study.sql +  |
 |    02_new_instrument_NN_*.sql    |
 |  - runs them against Firebird    |
 |    (dry-run first, then real)    |
 +----------------------------------+
                    |
                    v
   GDX_PSY_STUDY / GDX_PSY_PHENOMENON / GDX_PSY_CONSTRUCT / GDX_PSY_VARIABLE /
   GDX_PSY_INDICATOR / GDX_PSY_INSTRUMENT / GDX_PSY_INSTRUMENT_ITEM /
   GDX_PSY_ITEM_ALTERNATIVE / GDX_PSY_INDICATOR_ITEM   rows, ready to be used
                    |
                    v
 +----------------------------------+
 | GDX_SKILL_EXPORT_NEW_STUDY       |   reads Firebird, writes an .xlsx questionnaire
 |  - reads that study's            |
 |    instruments/items/alternatives|
 |  - writes a "Participant" sheet, |
 |    one sheet per instrument, and |
 |    a hidden META sheet with ids  |
 +----------------------------------+
                    |
                    v
   GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx   <-- send one filled copy per participant
                    |
                    v
 +----------------------------------+
 | GDX_SKILL_LOAD_NEW_STUDY_ANSWERS |   reads ONE filled .xlsx, writes to Firebird
 |  - trusts the workbook's own     |
 |    META sheet for ids            |
 |  - creates/reuses GDX_PSY_PERSON |
 |    + GDX_PSY_STUDY_PARTICIPANT   |
 |  - inserts GDX_PSY_APPLICATION + |
 |    GDX_PSY_ITEM_RESPONSE rows    |
 +----------------------------------+
                    |
                    v
   GDX_PSY_ITEM_RESPONSE rows, one participant's real answers, ready for scoring/analysis
```

Splitting the work into four skills mirrors the existing `GDX_SKILL_LOAD_RLT_MODEL_DB` shape
(generate, then execute) but adds a genuinely separate first stage — an **interview** — because
unlike a `.sav` file, a brand-new instrument has no machine-readable source at all: every field has
to come out of a conversation with the person who designed or is adapting the study. The last two
skills extend the same pipeline past "the instrument is defined" into "participants have actually
answered it", using a plain `.xlsx` file as the interchange format because that is what can be
emailed to and filled in by a non-technical participant without any tooling of their own.

## 3. What GDX_SKILL_NEW_STUDY actually asks, and why in that order

The interview walks the same foreign-key chain as the DDL, parent table before child table, so that
by the time a question is asked, everything it depends on already has an answer:

1. **The study** (`GDX_PSY_STUDY`) — title, objective, method, dates, status.
2. **Each instrument** (`GDX_PSY_INSTRUMENT`) — name, version (short — a year/edition tag, never the
   full citation, because `VERSION` is `VARCHAR(30)`), type, full description, instructions.
3. **The phenomenon it measures** (`GDX_PSY_PHENOMENON`) — checked against what is already
   cataloged first; a second instrument for an already-known phenomenon (e.g. a new hardiness scale)
   should reuse the existing phenomenon name, not create a near-duplicate.
4. **The construct(s)/behavioral scale(s)** (`GDX_PSY_CONSTRUCT`) — same reuse-by-name principle.
5. **The variable(s)/dimension(s) and their indicators** (`GDX_PSY_VARIABLE` + `GDX_PSY_INDICATOR`) —
   name, definition, measurement level, how the score is actually calculated, its direction (does a
   *higher* raw score mean *more* of the construct?), and its theoretical min/max.
6. **The response anchors** (`GDX_PSY_ITEM_ALTERNATIVE`) — asked once per distinct anchor set used
   in the instrument (e.g. one 1–5 "Never…Always" set for a whole 30-item scale), not once per item.
7. **Each item, in order** (`GDX_PSY_INSTRUMENT_ITEM` + `GDX_PSY_INDICATOR_ITEM`) — exact wording,
   which anchor set it uses, which dimension it feeds, its weight in that dimension's score, and
   whether it is reverse-scored.

Before asking anything, the skill runs `scripts/check_catalog.js` (Node.js + `node-firebird`,
read-only — every statement in it is a `SELECT`) against the live database, so the interview can
say "there is already a phenomenon called *Hardiness* — is this instrument measuring the same
thing?" instead of blindly asking for a name and risking a near-duplicate.

Anything the user genuinely doesn't know (item wording not finalized, scoring direction unclear,
reverse-keyed items not yet determined) is recorded as missing/`null` and flagged back to the user
explicitly — the skill is instructed to never guess and silently fill a gap, the same discipline
`SPSS_to_Firebird_Mapping.md` §3 and §6 document for the one study already loaded.

## 4. The intake contract

Everything gathered is written to one JSON file:

```
GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json
```

Its shape is documented in
`.claude/skills/GDX_SKILL_NEW_STUDY/scripts/intake_schema.json`, with a small, complete worked
example (a fictitious 2-item "resilience" scale) in
`.claude/skills/GDX_SKILL_NEW_STUDY/scripts/new_study_intake.example.json`. In short:

```
{
  "study": { title, objective, method, start_date, end_date, status },
  "instruments": [
    {
      name, version, type, description, instructions,
      phenomenon_name, phenomenon_description,
      "constructs":  [ { name, domain, definition, weight_in_instrument } ],
      "variables":   [ { construct_name, name, ..., indicator_name, direction, min_value, max_value } ],
      "response_anchor_sets": [ { key, alternatives: [ {order, label, numeric_value} ] } ],
      "items":       [ { order, statement_text, response_type, anchor_set,
                          variable_name, reversed, weight, indicator_item_weight,
                          extra_variables? } ]
    }
  ]
}
```

`response_anchor_sets` exists purely so a 30-item Likert instrument states its 5 response labels
**once**, not 30 times — each item just points at an anchor-set key. `extra_variables` is the escape
hatch for the uncommon case of one item loading on more than one dimension.

`.claude/skills/GDX_SKILL_NEW_STUDY/scripts/validate_intake.py` checks this file structurally
(required fields, `VARCHAR` length limits copied straight from the DDL, so a name that is too long
is caught here instead of as a cryptic "string right truncation" error from Firebird) and
cross-referentially (every `item.variable_name` actually matches a declared variable, every
`item.anchor_set` actually matches a declared anchor set, no duplicate item/alternative orders,
`min_value <= max_value`, and so on). `GDX_SKILL_RECORD_NEW_STUDY`'s generator imports and re-runs
this exact validator before generating anything, rather than trusting that the file it was handed
is still good — it refuses to generate SQL for an invalid intake file.

## 5. Why the generated SQL looks different from the existing `01_load_study.sql`..`08_*.sql`

The existing, already-loaded scripts (from `GDX_SKILL_LOAD_RLT_MODEL_DB`) hardcode every id
(`ID_STUDY = 1`, `ID_INSTRUMENT` 1–11, `ID_VARIABLE` 1–21, …) because they load one frozen,
already-known dataset exactly once. A general "add a new study" tool cannot do that: it has to stay
correct no matter what ids already exist in the live database, and it has to let a new instrument's
`GDX_PSY_INSTRUMENT_ITEM`/`GDX_PSY_ITEM_ALTERNATIVE`/`GDX_PSY_INDICATOR_ITEM` rows reference the ids
of the `GDX_PSY_INSTRUMENT`/`GDX_PSY_VARIABLE`/`GDX_PSY_INDICATOR` rows it *just inserted*, in the
same run.

`psychometrics_model_firebird25.sql` already has `BEFORE INSERT` triggers
(`BI_GDX_PSY_STUDY`, `BI_GDX_PSY_INSTRUMENT`, …) that assign a fresh id from the matching
`SEQ_GDX_PSY_*` sequence whenever a row is inserted with that id column left `NULL`. So every
`INSERT` generated by `GDX_SKILL_RECORD_NEW_STUDY` leaves the id column out entirely and lets the
trigger assign it — no hardcoded numbers, ever.

To let a child insert reference the id its parent row just got, each `02_new_instrument_*.sql` file
is generated as a single Firebird 2.5 `EXECUTE BLOCK ... END` statement: a small, disposable PSQL
procedure that declares one `BIGINT` variable per id it needs to remember, captures each new id with
`INSERT ... RETURNING ID_X INTO :V_ID_X`, and reuses that variable for every following statement
that needs it (a `GDX_PSY_INSTRUMENT_ITEM` insert reuses the same `:V_ID_ITEM` variable for that
item's own `GDX_PSY_ITEM_ALTERNATIVE` rows immediately below it, before moving to the next item and
overwriting it). This is why `execute_new_study.js` cannot reuse `execute_load.js`'s "split the file
on every semicolon" logic unchanged — an `EXECUTE BLOCK` is *one* DSQL statement full of internal
semicolons and quoted strings. `execute_new_study.js` detects a file starting with `EXECUTE BLOCK`
and sends it whole; anything else falls back to the original statement splitter.

`01_new_study.sql` is its own tiny `EXECUTE BLOCK` that looks the study up by `TITLE` first and only
inserts if missing — so registering a second instrument for the same, already-onboarded study does
not create a duplicate `GDX_PSY_STUDY` row. `GDX_PSY_PHENOMENON` and `GDX_PSY_CONSTRUCT` get the
same "look up by name, insert only if missing" treatment inside each instrument's `EXECUTE BLOCK`,
matching the reuse-by-name principle the interview already applied. `GDX_PSY_INSTRUMENT` itself is
always inserted fresh with no such guard: it **is** the new thing being onboarded, so a genuine
duplicate (same `NAME` + `VERSION`) is deliberately left to fail loudly on the schema's own
`UNIQUE (NAME, VERSION)` constraint instead of being silently skipped or silently duplicated.

## 6. Collecting and loading participant answers — `GDX_SKILL_EXPORT_NEW_STUDY` and `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`

Once step 4 below has loaded the instrument into `2.relational.model.psychometrics`, it exists but
has no respondents yet. These two skills close that loop, using a plain `.xlsx` workbook as the
interchange format — the one artifact a non-technical participant can open, fill in, and return
without any tooling of their own.

### 6.1 `GDX_SKILL_EXPORT_NEW_STUDY` — Firebird → `.xlsx`

Given `--study <slug>`, it reads that study's instruments back out of `GDX_PSY_INSTRUMENT` /
`GDX_PSY_INSTRUMENT_ITEM` / `GDX_PSY_ITEM_ALTERNATIVE` (resolving each instrument from
`intake.json` by `NAME`+`VERSION`, the same lookup `GDX_SKILL_RECORD_NEW_STUDY` used to create it)
and writes one workbook:

```
GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx
```

— skill name, then the study's human-readable title (sanitized to underscores), then a double
underscore, then the study's slug/code. Slugs are always lowercase/hyphen-separated (see §3's
`GDX_SKILL_NEW_STUDY` slug rule), so they can never contain `__`, keeping that boundary unambiguous.
The file is written next to `intake.json` by default.

The workbook has:

- a **Participant** sheet (filled in once): Full Name, External Identifier/Code, Birth Date, Gender,
  Education Level, Application Date, Consent Given (Y/N);
- **one sheet per instrument**, one row per item, in order, with the item's statement, response type,
  and a blank **Answer** column — a dropdown of that item's response alternatives when it has any
  (an Excel data-validation list), free text otherwise;
- a hidden **META** sheet recording the exact ids resolved at export time: `ID_STUDY` per study,
  and per item its `ID_INSTRUMENT`/`ID_ITEM`/`RESPONSE_TYPE`, and per alternative its `ID_ITEM`/
  `LABEL`/`NUMERIC_VALUE`/`ID_ALTERNATIVE`.

The META sheet is what makes the file self-contained: the loader below reads ids back from it
instead of re-resolving instrument/item/alternative *names* against the database, so a renamed,
emailed, or reopened-and-resaved copy of the file still loads correctly, and an answer can never be
silently matched to the wrong item or alternative. This skill only **reads** the database — it
writes nothing.

The exported file is a blank template for the **whole study**, not one participant's copy — duplicate
it once per participant before sending it out.

### 6.2 `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` — a filled `.xlsx` → Firebird

Given `--file <path-to-filled.xlsx>`, it inserts the full FK chain `GDX_PSY_ITEM_RESPONSE` needs
(see `GDX_PSY_RELATIONAL_MODEL.png` / `psychometrics_model_firebird25.sql`):

| Table | Rule |
|---|---|
| `GDX_PSY_PERSON` | found by `EXTERNAL_IDENTIFIER`; inserted only if not found; an existing person's `NAME` is never overwritten |
| `GDX_PSY_STUDY_PARTICIPANT` | found by `(ID_STUDY, ID_PERSON)`; inserted only if not found; `CONSENT` comes from the sheet's own field, defaulting to `0` (not confirmed) if left blank — never invented |
| `GDX_PSY_APPLICATION` | one per instrument sheet that has any answer filled in |
| `GDX_PSY_ITEM_RESPONSE` | one per answered item, matched to its `GDX_PSY_ITEM_ALTERNATIVE` when the item has alternatives |

**Deliberately out of scope:** computing `GDX_PSY_VARIABLE_RESULT` / `GDX_PSY_CONSTRUCT_RESULT` /
`GDX_PSY_INDICATOR_RESULT` (derived scores). This skill loads what the participant actually
answered — turning raw responses into a scored construct/variable value (indicator formulas,
reverse-scoring, norms) is a separate concern for a future skill.

**Never guesses an answer.** An item with alternatives whose typed/selected answer matches no
`LABEL` (case-insensitively) is skipped and reported under "UNMATCHED answers", not coerced to the
nearest option. A required item left blank is reported under "MISSING required answers", not
silently completed. Both require a human to look at the source file.

**Safe to re-run.** Every `GDX_PSY_APPLICATION` this skill inserts is tagged in its `CONTEXT` column
with `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS:<filename>`; re-running on the same file finds that tag and
skips the instrument instead of duplicating its responses.

**Trusts META, not the filename**, for every database id (see §6.1) — the filename is only
sanity-checked against META's `STUDY_SLUG` and a mismatch is logged as a harmless `NOTE`, never an
error, since a participant is free to rename their copy.

## 7. Running it end to end

```
# 1) interview (GDX_SKILL_NEW_STUDY)
#    - reads psychometrics_model_firebird25.sql, SPSS_to_Firebird_Mapping.md,
#      intake_schema.json / new_study_intake.example.json
#    - runs check_catalog.js against the live DB (optional but recommended)
#    - asks questions, writes new_study_intake/<slug>/intake.json
#    - validates it with validate_intake.py until it prints OK

# 2) generate (GDX_SKILL_RECORD_NEW_STUDY, stage 1)
python GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts/generate_new_study_scripts.py \
  GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json
#    -> writes 01_new_study.sql, 02_new_instrument_01_<slug>.sql, ... next to intake.json

# 3) review the generated .sql by hand (content, not just syntax)

# 4) execute (GDX_SKILL_RECORD_NEW_STUDY, stage 2)
cd GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_RECORD_NEW_STUDY/scripts
npm install                                  # once
node execute_new_study.js --dir ../../../../new_study_intake/<slug> --dry-run
# confirm with the user, then:
node execute_new_study.js --dir ../../../../new_study_intake/<slug>

# 5) export a blank questionnaire (GDX_SKILL_EXPORT_NEW_STUDY)
cd GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_EXPORT_NEW_STUDY/scripts
npm install                                  # once
node export_new_study.js --study <slug>
#    -> writes GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx next to intake.json

# 6) duplicate that file once per participant, send it out, wait for filled copies back

# 7) load each filled copy (GDX_SKILL_LOAD_NEW_STUDY_ANSWERS)
cd GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_LOAD_NEW_STUDY_ANSWERS/scripts
npm install                                  # once
node load_new_study_answers.js --file <path-to-participant-copy.xlsx> --dry-run
# confirm with the user, then:
node load_new_study_answers.js --file <path-to-participant-copy.xlsx>
```

At the end of step 4, the new study/instrument/scale exists in `2.relational.model.psychometrics`
exactly like the one loaded by `GDX_SKILL_LOAD_RLT_MODEL_DB`. At the end of step 7, real participant
answers exist in `GDX_PSY_ITEM_RESPONSE`, linked through `GDX_PSY_APPLICATION` →
`GDX_PSY_STUDY_PARTICIPANT` → `GDX_PSY_PERSON`, ready for scoring/analysis — computing
`GDX_PSY_VARIABLE_RESULT`/`GDX_PSY_CONSTRUCT_RESULT`/`GDX_PSY_INDICATOR_RESULT` from those raw
responses remains future work outside the scope of these four skills.

## 8. What is committed vs. gitignored

- `new_study_intake/<slug>/intake.json` and the generated `.sql` **are meant to be committed** —
  they document what was asked for and what was loaded, the same way `samples.SQL/` documents the
  one `.sav` load. See `new_study_intake/README.md`.
- The **blank** `.xlsx` `GDX_SKILL_EXPORT_NEW_STUDY` writes (no participant data in it, only item
  text and metadata already in `intake.json`) can be committed alongside `intake.json` if useful as
  documentation of the exact form that was sent out.
- A **filled** copy of that `.xlsx` (a participant's name, birth date, gender, education level and
  answers) **must never be committed** — it is real personal data, not project documentation. Treat
  it the same as any other participant PII: keep it off the repository entirely, store it wherever
  the study's data-handling plan says raw response files belong, and delete/archive it per that plan
  once `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` has loaded it.
- Each skill's `.env` (real Firebird credentials) is **never committed** — only `.env.example`
  (no secrets) is. This repeats the existing repo-wide rule already documented for
  `GDX_SKILL_LOAD_RLT_MODEL_DB` and in the top-level `CLAUDE.md`.

## 9. Where everything lives

```
GDX_HUMAN/
  0.new.instrument/
    New_Instrument_Onboarding_Process.md        <- this document
    new_study_intake/
      README.md
      <slug>/intake.json, 01_new_study.sql, 02_new_instrument_NN_*.sql,        <- per onboarded study
             GDX_SKILL_EXPORT_NEW_STUDY_<StudyTitle>__<slug>.xlsx (blank template only)
    .claude/skills/
      GDX_SKILL_NEW_STUDY/                        <- interview -> intake.json
        SKILL.md
        scripts/intake_schema.json
        scripts/new_study_intake.example.json
        scripts/validate_intake.py
        scripts/check_catalog.js + package.json
        .env.example
      GDX_SKILL_RECORD_NEW_STUDY/                 <- intake.json -> Firebird
        SKILL.md
        scripts/generate_new_study_scripts.py
        scripts/execute_new_study.js + package.json
        .env.example
      GDX_SKILL_EXPORT_NEW_STUDY/                 <- Firebird -> blank .xlsx questionnaire
        SKILL.md
        scripts/export_new_study.js + package.json
        .env.example
      GDX_SKILL_LOAD_NEW_STUDY_ANSWERS/           <- filled .xlsx -> Firebird (GDX_PSY_ITEM_RESPONSE, ...)
        SKILL.md
        scripts/load_new_study_answers.js + package.json
        .env.example
  2.relational.model.psychometrics/
    psychometrics_model_firebird25.sql           <- the DDL all four skills target (unchanged location)
    SPSS_to_Firebird_Mapping.md                  <- reasoning behind the one study already loaded
    GDX_PSY_RELATIONAL_MODEL.png                 <- the diagram GDX_SKILL_LOAD_NEW_STUDY_ANSWERS's
                                                     FK chain (PERSON/STUDY_PARTICIPANT/APPLICATION/
                                                     ITEM_RESPONSE) is drawn from
    .claude/skills/
      GDX_SKILL_LOAD_RLT_MODEL_DB/                <- pre-existing, unrelated: loads the one .sav dataset
```
