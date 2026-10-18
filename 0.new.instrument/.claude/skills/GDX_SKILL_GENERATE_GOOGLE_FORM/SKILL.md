---
name: GDX_SKILL_GENERATE_GOOGLE_FORM
description: Reads a study's instruments, items and response alternatives back out of Firebird (after GDX_SKILL_NEW_STUDY/GDX_SKILL_RECORD_NEW_STUDY have loaded it) and creates a real Google Form via the Forms API -- one section per instrument, one question per item -- writing new_study_intake/<slug>/google_form_map.json so GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS can later resolve responses back to exact database ids, and saving the form's edit/share links plus post-creation instructions into GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO for every instrument the form covers. Use when you want to collect a study's answers through a Google Form link instead of (or alongside) the GDX_SKILL_EXPORT_NEW_STUDY xlsx workflow.
---

# GDX_SKILL_GENERATE_GOOGLE_FORM

Alternative third stage of the "onboard a new instrument" pipeline, parallel to and fully
independent of `GDX_SKILL_EXPORT_NEW_STUDY` -- see
`GDX_HUMAN/0.new.instrument/Google_Forms_Integration_Plan.md` for the design rationale (Option A:
Forms API, chosen over a Sheets-only adapter).

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_* rows exist
        |
        +---------------------------------------------------------------+
        |                                                                |
        v                                                                v
GDX_SKILL_EXPORT_NEW_STUDY (untouched, separate pipeline)   GDX_SKILL_GENERATE_GOOGLE_FORM (this skill)
        |                                                                |
        v                                                                v
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS (untouched)                GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS
```

This skill and its sibling `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` are **fully self-contained** --
their own folders, scripts, `package.json`, `.env`. Neither imports from nor modifies
`GDX_SKILL_EXPORT_NEW_STUDY` or `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`; this script re-implements its
own copy of the same read queries instead.

## What it does

Given `--study <slug>`:

1. Reads `new_study_intake/<slug>/intake.json` to know which instruments belong to this study, and
   resolves each one's `GDX_PSY_INSTRUMENT` row by `(NAME, VERSION)` -- erroring out if it isn't
   found (run `GDX_SKILL_RECORD_NEW_STUDY` first).
2. For each instrument, reads its `GDX_PSY_INSTRUMENT_ITEM` rows (in `ITEM_ORDER`) and each item's
   `GDX_PSY_ITEM_ALTERNATIVE` rows.
3. Creates a Google Form (`forms.create` + `forms.batchUpdate`):
   - Form title = the study's title.
   - A **Participant Information** section -- short-answer questions for Full Name, External
     Identifier/Code, Birth Date, Gender, Education Level, Consent Given (Y/N). Full Name and
     External Identifier are marked required (same two fields
     `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` will insist on later) -- the Forms equivalent of the xlsx
     pipeline's "Participant" sheet.
   - **One page-break section per instrument** (title = instrument name, description =
     `DESCRIPTION`/`INSTRUCTIONS` when present).
   - **One question per item**, in `ITEM_ORDER`: a `RADIO` choice question when the item has
     alternatives (options = each alternative's `LABEL`, verbatim, never retyped or paraphrased),
     otherwise a paragraph text question. `REQUIRED` maps straight to the question's `required` flag.
4. Captures the `questionId` Google assigns to every created question (returned in the
   `batchUpdate` response's `replies[i].createItem.questionId`, matched back by array position to
   what was requested) and writes:

   **`new_study_intake/<slug>/google_form_map.json`** -- `{ formId, formEditUrl,
   formResponderUrl, studyTitle, studySlug, studyId, generatedAt, participantFieldMap, itemMap,
   alternativeMap }`. This file plays exactly the role the xlsx pipeline's hidden META sheet
   plays: it is the one thing `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` trusts to resolve a response
   back to the right `GDX_PSY_*` rows, never re-matching by the question's visible text. It
   carries **no secret** -- commit it alongside `intake.json`. Losing it means responses already
   collected can no longer be resolved.
5. Prints the Form's edit link, shareable responder link, and the post-creation instructions
   (send the Share link to participants, then run `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`) -- and
   writes that exact same block to `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO` (BLOB SUB_TYPE TEXT,
   added by `0.new.instrument/google_form_instrument_field_firebird25.sql`) for every instrument
   row this form has a section for. One form covers every instrument in the study, so every one
   of its instruments gets the identical block -- the responder link is what you send to
   participants.

This skill reads from and writes to Firebird: it reads the study/instrument/item/alternative rows
(never writes them), and after a real (non-dry-run) Form is created, it writes the same
edit/share-link report into `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO` for each instrument the form
covers. It also writes to Google (creates the Form) and to local disk (`google_form_map.json`).

## `GDX_PSY_INSTRUMENT.GOOGLE_FORM_INFO`

A `BLOB SUB_TYPE TEXT` column on `GDX_PSY_INSTRUMENT` (2.relational.model.psychometrics), added by
the one-time migration `0.new.instrument/google_form_instrument_field_firebird25.sql`. It exists so
this skill's result -- today only ever printed to the terminal -- has a permanent home next to the
instrument it was generated for, instead of living only in shell scrollback.

- **Written only on a real run** (never on `--dry-run`, which touches neither Google nor Firebird
  writes). NULL until a Form has actually been generated for that instrument.
- **Content**: the exact same text block the script prints after creating the Form -- the form's
  edit URL, its responder/share URL, the `google_form_map.json` path it wrote, the
  questions-mapped counts, the "send the Share link to participants / then run
  `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS --study <slug>`" instructions, the `google_form_map.json`
  no-secrets/don't-lose-it note, and a `Generated at:` timestamp. Console output and this column
  are built from one shared string in the script, so they can never drift apart.
- **One form, every instrument it covers**: a Form has one page-break section per instrument in
  the study, so the identical block is written to every instrument row that Form generated a
  section for -- never split or paraphrased per instrument.
- **Overwritten, not appended**, on every real run -- regenerating a Form for the same study
  replaces each covered instrument's `GOOGLE_FORM_INFO` with the new block (new `formId`, new
  links). The old Form itself is not deleted from Google by this skill; only the DB column is
  replaced.
- **Pre-existing databases**: a database created before this column existed needs the migration
  run once (`ALTER TABLE GDX_PSY_INSTRUMENT ADD GOOGLE_FORM_INFO BLOB SUB_TYPE TEXT`) before this
  skill's write step will succeed.

## One-time authorization

The Forms API requires a real Google account's consent -- it does **not** support service
accounts for creating or reading Forms. This is a one-time step; after it, the script runs
silently (refresh token cached locally, no browser again).

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project.
2. Enable the **Google Forms API** for that project (APIs & Services -> Library).
3. Configure the OAuth consent screen (External is fine; it can stay in "Testing" status -- add
   your own Google account as a test user; no verification needed at this scale).
4. Create an **OAuth 2.0 Client ID** of type **Desktop app** (APIs & Services -> Credentials). Copy
   its Client ID and Client Secret into `.env` (`GOOGLE_OAUTH_CLIENT_ID` /
   `GOOGLE_OAUTH_CLIENT_SECRET`). "Desktop app" is the right type specifically because it is
   pre-authorized by Google for any `http://127.0.0.1:<port>` redirect (RFC 8252) -- no redirect
   URI needs registering by hand, which is what lets this script's own tiny local HTTP server
   complete the flow without extra console configuration.
5. Run the script once (see below). It prints a URL -- open it, sign in, approve access. The
   script's local listener catches the redirect automatically and saves the token to
   `GOOGLE_OAUTH_TOKEN_PATH`. Every run after that is silent.

No billing account or paid tier is involved -- the Forms API is part of Google's free API tier at
any realistic usage level for this project (see `Google_Forms_Integration_Plan.md` for the cost
discussion).

## Running it

```
cd 0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM/scripts
npm install                 # once, installs node-firebird + googleapis
# copy ../.env.example to ../.env and fill in both the Firebird and Google OAuth values
node generate_google_form.js --study <slug> --dry-run   # sanity check first
node generate_google_form.js --study <slug>              # creates the real Form
```

`--intake-dir <path>` overrides the default `new_study_intake/<slug>/` location it reads
`intake.json` from and where it writes `google_form_map.json`.

`--dry-run` resolves everything from the database and prints instrument/item counts and question
types without calling any Forms API write endpoint or touching local files.

## The one real matching nuance (read before trusting the loader)

`questionId` uniquely and permanently identifies **which item** a question is -- captured once at
creation, never re-resolved by text. But the Forms API does not assign a stable id to each
individual choice option the way it does to the question itself: a chosen `RADIO` answer comes back
from the API as the literal text the respondent selected, not an id. `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`
therefore does one text comparison per answered choice question -- but only within that
already-identified item's own small, exact-verbatim option list recorded in `alternativeMap`
(typically 2-20 choices), not against the whole database. See that skill's own `SKILL.md` for how
it reports an unmatched answer rather than guessing.

## Files in this skill

- `scripts/generate_google_form.js` -- reads `--study <slug>`'s instruments/items/alternatives
  from Firebird and creates the Google Form (Node.js + `node-firebird` + `googleapis`)
- `scripts/google_auth.js` -- local OAuth2 bootstrap (consent flow + token cache), duplicated in
  `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` rather than shared, per this project's self-contained-skill
  convention
- `scripts/package.json`
- `.env.example` -- connection + OAuth client variable template (no secrets)
- `../../../google_form_instrument_field_firebird25.sql` (i.e. `0.new.instrument/google_form_instrument_field_firebird25.sql`)
  -- the one-time `ALTER TABLE GDX_PSY_INSTRUMENT ADD GOOGLE_FORM_INFO BLOB SUB_TYPE TEXT`
  this skill's writes depend on; run it once against a database that predates this column
