---
name: GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS
description: Pulls every response from the Google Form GDX_SKILL_GENERATE_GOOGLE_FORM created for a study (via the Forms API), resolves each answer through that skill's google_form_map.json, and inserts into GDX_PSY_PERSON / GDX_PSY_STUDY_PARTICIPANT / GDX_PSY_APPLICATION / GDX_PSY_ITEM_RESPONSE -- safe to re-run, already-loaded responses are skipped. Use after GDX_SKILL_GENERATE_GOOGLE_FORM has created the Form and participants have started answering it.
---

# GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS

Alternative fourth stage of the "onboard a new instrument" pipeline, parallel to and fully
independent of `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` -- see
`GDX_HUMAN/0.new.instrument/Google_Forms_Integration_Plan.md` for the design.

```
GDX_SKILL_GENERATE_GOOGLE_FORM --study <slug>   -- creates the Form, writes google_form_map.json
        |
        v
GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS (this skill) --study <slug>   -- pulls responses, writes DB rows
```

Fully self-contained, same as its sibling: own folder, own scripts, own `package.json`/`.env`.
Does not import from or modify `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` or
`GDX_SKILL_GENERATE_GOOGLE_FORM` -- it only *reads* the file the latter writes
(`new_study_intake/<slug>/google_form_map.json`).

## What it writes -- and what it deliberately does not

Given `--study <slug>`, this skill inserts the same FK chain
`GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` writes, independently implemented:

| Table | When |
|---|---|
| `GDX_PSY_PERSON` | Resolved first by this exact response's own `GDX_PSY_APPLICATION.CONTEXT` tag (safe re-run), then by the typed "External Identifier / Code"; otherwise a new person is created. The typed code is **not** trusted as `EXTERNAL_IDENTIFIER` for a new person -- free text can collide with someone else's code -- so the new, already-unique `ID_PERSON` becomes `EXTERNAL_IDENTIFIER` instead. An existing person's `NAME` is never overwritten, even if the response disagrees. **Consent = No** (see below) on a brand-new person additionally withholds the real "Full Name": `NAME` is stored as `Participant <ID_PERSON>` instead -- only at creation time, never retroactively on an already-known person. |
| `GDX_PSY_STUDY_PARTICIPANT` | Found by `(ID_STUDY, ID_PERSON)`; inserted only if not found. `CONSENT` comes from the "Consent Given (Y/N)" answer -- never invented -- and defaults to `0` (not confirmed) if left blank. `ANONYMOUS_CODE` follows the same new-person collision-proofing as `EXTERNAL_IDENTIFIER` above (the typed code only for an existing/matched person, `ID_PERSON` for a brand-new one). |
| `GDX_PSY_APPLICATION` | One per instrument that has any answered question in a given response. |
| `GDX_PSY_ITEM_RESPONSE` | One per answered item, matched to its `GDX_PSY_ITEM_ALTERNATIVE` when the item has alternatives. |

A response missing either "Full Name" or "External Identifier / Code" is skipped **entirely** --
never invented, same rule the xlsx loader applies.

**Out of scope on purpose**, same boundary `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` already draws: this
skill loads what the respondent actually answered -- it does not compute
`GDX_PSY_VARIABLE_RESULT` / `GDX_PSY_CONSTRUCT_RESULT` / `GDX_PSY_INDICATOR_RESULT`. Scoring is a
separate concern (formulas, reverse-scoring, norms) that doesn't belong bundled into this read/write
pipeline.

## Source of truth: `google_form_map.json`, not the Form's visible text

`GDX_SKILL_GENERATE_GOOGLE_FORM` writes `new_study_intake/<slug>/google_form_map.json`, carrying
every question's Google-assigned `questionId` mapped to the exact `GDX_PSY_*` ids it represents.
This skill reads ids back from that file -- it does **not** re-resolve instrument/item names
against the current database, and it does **not** match by the question's visible title or
description. If that file is missing, run `GDX_SKILL_GENERATE_GOOGLE_FORM --study <slug>` first.

## Answer matching rules (never guesses)

- Each item question is already uniquely identified by its `questionId` -- no text matching
  involved for *which item* an answer belongs to.
- For an item **with** alternatives (a `RADIO` choice question): the Forms API returns the exact
  text of the option the respondent picked (choice options have no stable id of their own, unlike
  the question). That text is matched, case-insensitively and trimmed, against the small,
  exact-verbatim option list recorded for that item in `alternativeMap` at Form-creation time
  (typically 2-20 choices) -- not against the whole database. No match -> the response is
  **skipped** and reported under "UNMATCHED answers (needs a human)".
- For an item **without** alternatives (a paragraph text question): the answer is stored as
  `TEXT_VALUE`; if it happens to parse cleanly as a number, `NUMERIC_VALUE` is also populated (a
  mechanical parse, not an inference).
- A required item (`REQUIRED = 1` in `itemMap`) left blank is reported under "MISSING required
  answers" -- the application is still created with whatever was answered.

## Idempotency -- safe to re-run

Every `GDX_PSY_APPLICATION` this skill inserts is tagged in its `CONTEXT` column with
`GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS:<formId>:<responseId>`. Re-running finds that tag and reports
the instrument as "already loaded" for that response, skipping it -- new responses submitted since
the last run are picked up normally, nothing already loaded is re-inserted or duplicated.

## One-time authorization

Same Forms API OAuth requirement as `GDX_SKILL_GENERATE_GOOGLE_FORM` -- see that skill's SKILL.md
"One-time authorization" section for the Google Cloud Console steps (Desktop app OAuth client).
Point this skill's `GOOGLE_OAUTH_TOKEN_PATH` at the same token file that skill produced (see
`.env.example`) to reuse the one-time consent instead of authorizing twice.

## Running it

```
cd 0.new.instrument/.claude/skills/GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS/scripts
npm install                 # once, installs node-firebird + googleapis
# copy ../.env.example to ../.env and fill in the Firebird and Google OAuth values
node load_google_form_answers.js --study <slug> --dry-run   # see what would happen
node load_google_form_answers.js --study <slug>             # apply it
```

Read the summary before trusting a run is complete: `UNMATCHED answers` and `MISSING required
answers` are gaps that need a human to look at the actual Form response, not something this skill
resolves on its own.

## Files in this skill

- `scripts/load_google_form_answers.js` -- reads `--study <slug>`'s `google_form_map.json`, pulls
  responses via the Forms API, and runs the insert logic (Node.js + `node-firebird` + `googleapis`)
- `scripts/google_auth.js` -- local OAuth2 bootstrap (consent flow + token cache), identical copy
  of `GDX_SKILL_GENERATE_GOOGLE_FORM`'s, duplicated rather than shared per this project's
  self-contained-skill convention
- `scripts/package.json`
- `.env.example` -- connection + OAuth client variable template (no secrets)
