---
name: GDX_SKILL_NEW_STUDY
description: Interviews the user to onboard a brand-new psychometric study, measurement instrument(s), behavioral scales (constructs/dimensions), items, response anchors and scoring weights for GDX_HUMAN, grounding every question in the live GDX_PSY_* schema and catalog (2.relational.model.psychometrics), then writes a structured intake JSON for GDX_SKILL_RECORD_NEW_STUDY to load into Firebird. Use when the user wants to register/add a new study, a new questionnaire/scale, or new items/anchors, before any data has been collected for it.
---

# GDX_SKILL_NEW_STUDY

Conversational, first-stage skill: turns "I have a new instrument I want to add" into a validated
intake file. It does not write to the database itself -- that is
**GDX_SKILL_RECORD_NEW_STUDY**'s job (see its `SKILL.md`, in the sibling skill folder).

```
you describe a new study/instrument
        |
        v
 GDX_SKILL_NEW_STUDY  (this skill)         -- interview, grounded in the live schema/catalog
        |
        v
 new_study_intake/<slug>/intake.json        -- the contract, validated
        |
        v
 GDX_SKILL_RECORD_NEW_STUDY                 -- generates + runs the SQL against Firebird
```

## Step 0 -- ground the interview in the real schema and the real catalog

Before asking the user anything, read:

1. `GDX_HUMAN/2.relational.model.psychometrics/psychometrics_model_firebird25.sql` -- the actual DDL.
   Every question you ask should map to a real column; do not invent fields the schema doesn't have,
   and do not skip a `NOT NULL` column.
2. `GDX_HUMAN/2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` -- how the one study
   already loaded was mapped table by table. Reuse the same structural reasoning (§5 of that
   document) for the new one.
3. `scripts/intake_schema.json` and `scripts/new_study_intake.example.json` in this skill folder --
   the exact shape you must produce, with a small worked example.

Then, **run the read-only catalog check** so the interview can reuse what already exists instead of
duplicating it:

```
cd GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_NEW_STUDY/scripts
npm install                 # once, installs node-firebird
# copy .env.example to .env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
# (reuse the same .env as GDX_SKILL_LOAD_RLT_MODEL_DB / GDX_SKILL_RECORD_NEW_STUDY if you have one)
node check_catalog.js
```

If this fails (no `.env`, DB unreachable), tell the user and ask whether to proceed offline
(interview still works, but you cannot warn about name collisions with existing phenomena/
constructs/instruments until `GDX_SKILL_RECORD_NEW_STUDY`'s own preflight check runs later).

## Step 1 -- interview, in this order

Ask about one table at a time, in the order below (it follows the FK chain in the DDL, parent
before child). Keep questions natural/conversational -- do not read column names at the user -- but
every answer you record must land in the field noted in parentheses. Skip a question and use a
sensible default only for the fields marked *(optional)*; everything else is required.

1. **The study** (`GDX_PSY_STUDY`)
   - Title *(TITLE, <=200 chars)*
   - What is it trying to find out? *(OBJECTIVE, optional)*
   - How will/was it be run -- design, sample, procedure? *(METHOD, optional)*
   - Start/end date if known *(START_DATE/END_DATE, optional, `YYYY-MM-DD`)*
   - Status: planned / already running / already completed *(STATUS, default `PLANNED`)*

2. **For each instrument/questionnaire being added** (`GDX_PSY_INSTRUMENT`)
   - Name, and check it against `check_catalog.js`'s instrument list -- if a very similar name
     already exists, ask the user to confirm this is genuinely a new instrument (a new version of
     an existing one is still a new `GDX_PSY_INSTRUMENT` row, per the schema's
     `UNIQUE (NAME, VERSION)`).
   - Version/edition, **short** -- a year or edition tag only, not a citation
     *(VERSION, <=30 chars -- see the truncation warning in the sibling skill's `catalog.py`)*.
   - Type: Likert scale / single item / semantic differential / visual analog / other *(TYPE)*.
   - Full authorship + description *(DESCRIPTION)*.
   - Instructions shown to the respondent *(INSTRUCTIONS, optional)*.

3. **The phenomenon this instrument measures** (`GDX_PSY_PHENOMENON`, database-wide unique name)
   - Check `check_catalog.js`'s phenomena list first -- if the same phenomenon is already cataloged
     (e.g. a second instrument for "Hardiness"), reuse its name exactly rather than creating a
     near-duplicate.
   - Name + one-line description.

4. **The construct(s)/behavioral scale(s)** (`GDX_PSY_CONSTRUCT`, database-wide unique name)
   - Usually one per instrument, but some instruments bundle more than one construct.
   - Name, domain (default `PSYCHOMETRIC_NEW` for a study not yet in production), definition.
   - Relative weight if this instrument combines multiple constructs into one score
     *(GDX_PSY_INSTRUMENT_CONSTRUCT.WEIGHT, default 1)*.

5. **The variable(s)/dimension(s) inside each construct** (`GDX_PSY_VARIABLE` + `GDX_PSY_INDICATOR`)
   - Name, description, operational definition, measurement level (nominal/ordinal/interval/ratio).
   - For the indicator (the actual calculation): a name (usually "`<Variable> (score)`"), how it's
     computed in words (mean of items? sum? something else -- `INDICATOR_TYPE`), the unit, the
     **direction** (does a *higher* raw score mean *more* of the construct, or less?), and the
     theoretical min/max of the score.

6. **The response anchors** (shared per instrument where possible, `GDX_PSY_ITEM_ALTERNATIVE`)
   - Ask once per distinct anchor set used in the instrument (most Likert instruments use exactly
     one 5- or 7-point set for every item) -- do not ask the same 5 labels once per item.
   - Ordered label + numeric value for each point (e.g. 1=Never ... 5=Always).

7. **Each item, in questionnaire order** (`GDX_PSY_INSTRUMENT_ITEM` + `GDX_PSY_INDICATOR_ITEM`)
   - Exact statement text (translate to English if the source is in another language, same
     convention as `SPSS_to_Firebird_Mapping.md` §2, but keep the original alongside it in your own
     working notes if the user gives it to you, in case they want it preserved).
   - Which response-anchor set it uses.
   - Which variable/dimension it feeds, its weight in that indicator's calculation, and whether it
     is **reverse-scored** (a "strongly agree" answer that counts *against* the dimension).
   - If an item genuinely loads on more than one dimension, capture the extra ones too
     (`extra_variables` in the intake shape) -- this is uncommon; do not force it if the user isn't
     sure. When unsure, prefer one item -> one dimension and note the ambiguity in the item's
     statement text or in your handoff summary, rather than guessing weights.

Do not silently invent item wording, anchors, or scoring direction the user hasn't actually given
you -- if something is unknown, record it as `null`/omit it and flag it explicitly in your summary
to the user, the same way `SPSS_to_Firebird_Mapping.md` §3 flags unconfirmed hypotheses instead of
guessing.

## Step 2 -- write and validate the intake file

Pick a short slug from the study title (lowercase, `-`-separated, e.g.
`workplace-resilience-pilot`). Write the gathered data to:

```
GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json
```

matching the shape in `scripts/intake_schema.json` (see `scripts/new_study_intake.example.json` for
a filled, minimal example). Then validate it:

```
python GDX_HUMAN/0.new.instrument/.claude/skills/GDX_SKILL_NEW_STUDY/scripts/validate_intake.py \
  GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json
```

Fix and re-run until it prints `OK`. Do not hand off a file that fails validation.

## Step 3 -- hand off

Tell the user the intake file is ready and named, summarize what was captured (instrument count,
item count, any gaps you flagged), and point them at **GDX_SKILL_RECORD_NEW_STUDY** to generate and
run the load scripts. Do not invoke that skill's DB-writing scripts yourself from here.

## Files in this skill

- `scripts/intake_schema.json` -- documentation of the intake contract (hand-checked by
  `validate_intake.py`, not a `jsonschema`-library schema).
- `scripts/new_study_intake.example.json` -- a small worked example covering every part of the shape.
- `scripts/validate_intake.py` -- structural + cross-reference validation, zero dependencies.
- `scripts/check_catalog.js` + `scripts/package.json` -- read-only Firebird catalog lookup (Node.js
  + node-firebird, same wire-protocol approach as `GDX_SKILL_LOAD_RLT_MODEL_DB`).
- `.env.example` -- connection variable template (no secrets; same database as the other two skills).
