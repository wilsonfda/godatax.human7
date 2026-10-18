# Google Forms Integration Plan — GDX_SKILL_EXPORT_NEW_STUDY

Status: **built.** Both skills below exist at
`0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM/` and
`0.new.instrument/.claude/skills/GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS/`, dependencies installed,
every request/response shape verified against the installed `googleapis` package's own type
definitions (not just memory), and the database-reading half dry-run-tested end to end against
real studies in `GODATAX7HPH.GDB` (including the 58-item POMS instrument). The one piece that
could **not** be tested here is the actual Forms API round trip itself (creating a real Form,
completing the one-time OAuth consent) — that needs your own Google account and browser; see
"One-time authorization" in each skill's `SKILL.md` for the setup steps, then run
`--dry-run` first as usual.

Grounded in a full read of `GDX_SKILL_EXPORT_NEW_STUDY` and `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS`'s
`SKILL.md` files and actual scripts (`export_new_study.js`, `load_new_study_answers.js`) — the two
new skills below are designed to read the exact same `GDX_PSY_*` data those two already read/write,
just through a Google Form instead of an `.xlsx` file, and as **fully independent, self-contained
skills** (their own folders, scripts, `package.json`, `.env`) — they do not call into, import, or
modify `GDX_SKILL_EXPORT_NEW_STUDY` or `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` at runtime. Those two
existing skills and the xlsx pipeline stay exactly as they are.

## 1. Goal

Given a study's slug/code (the same one `GDX_SKILL_NEW_STUDY` / `GDX_SKILL_RECORD_NEW_STUDY`
already use), generate a real Google Form — one question per registered item, built straight from
the `GDX_PSY_*` catalog — that can be linked and sent to anyone, and later pull the responses back
into the exact same database tables the xlsx pipeline writes to.

## 2. The two new skills

```
GDX_SKILL_NEW_STUDY
        |
        v
GDX_SKILL_RECORD_NEW_STUDY        -- GDX_PSY_* rows exist
        |
        +-------------------------------------------------------+
        |                                                        |
        v                                                        v
GDX_SKILL_EXPORT_NEW_STUDY (unchanged)             GDX_SKILL_GENERATE_GOOGLE_FORM  (NEW)
        |                                           --study <slug>
        v                                                        |
GDX_SKILL_LOAD_NEW_STUDY_ANSWERS (unchanged)                      v
                                                    GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS  (NEW)
                                                     --study <slug>
```

Both new skills take `--study <slug>` — same slug convention as every other skill in this
pipeline (`new_study_intake/<slug>/intake.json` must already exist, i.e. `GDX_SKILL_RECORD_NEW_STUDY`
must already have run for this study).

### 2.1 `GDX_SKILL_GENERATE_GOOGLE_FORM`

**What it does**, given `--study <slug>`:

1. Reads `new_study_intake/<slug>/intake.json` for the study title and the list of instruments
   (same file, same fields `GDX_SKILL_EXPORT_NEW_STUDY` already reads — this skill re-implements
   that read itself, independently, rather than importing the other skill's code).
2. Resolves `GDX_PSY_STUDY` by `TITLE`, then each instrument's `GDX_PSY_INSTRUMENT` row by
   `(NAME, VERSION)` — errors out clearly if a study/instrument isn't found yet (same failure mode
   `GDX_SKILL_EXPORT_NEW_STUDY` already has).
3. For each instrument, reads its `GDX_PSY_INSTRUMENT_ITEM` rows (in `ITEM_ORDER`) and each item's
   `GDX_PSY_ITEM_ALTERNATIVE` rows — the identical query shape `export_new_study.js`'s
   `loadInstrumentItems()` uses, re-implemented in this skill's own script.
4. Builds the Form via the **Forms API** (`forms.create` + `forms.batchUpdate`):
   - Form title = study title.
   - A **"Participant Info"** section at the top — short-answer questions for Full Name, External
     Identifier/Code, Birth Date, Gender, Education Level, Consent Given (Y/N) — the Forms
     equivalent of the xlsx "Participant" sheet, same fields.
   - **One section per instrument** (section title = instrument name; section description =
     `DESCRIPTION`/`INSTRUCTIONS` when present, same as the note row `buildInstrumentSheet()`
     writes today).
   - **One question per item**, in `ITEM_ORDER`: a `RADIO` choice question when the item has
     alternatives (options = each alternative's `LABEL`, verbatim, never retyped), otherwise a
     short-answer/paragraph text question. `required` is set from
     `GDX_PSY_INSTRUMENT_ITEM.REQUIRED`.
5. **Captures the `questionId`** Google assigns to each question the instant it's created (it comes
   back in the `batchUpdate` response, in each `createItem` reply — see §3 for exactly how) and
   writes it, together with the matching `GDX_PSY_*` ids, to a new file:

   **`new_study_intake/<slug>/google_form_map.json`**
   ```json
   {
     "formId": "1FAIpQLSe...",
     "formEditUrl": "https://docs.google.com/forms/d/<formId>/edit",
     "formResponderUrl": "https://docs.google.com/forms/d/e/<formId>/viewform",
     "studyTitle": "...",
     "studySlug": "...",
     "studyId": 7,
     "generatedAt": "2026-10-17T...",
     "participantFieldMap": {
       "<questionId>": "fullName"
     },
     "itemMap": {
       "<questionId>": {
         "ID_ITEM": 481, "ID_INSTRUMENT": 14, "INSTRUMENT_NAME": "...",
         "ITEM_ORDER": 3, "REQUIRED": 1
       }
     },
     "alternativeMap": {
       "<questionId>": [
         { "choiceText": "Not at all", "ID_ALTERNATIVE": 2201, "NUMERIC_VALUE": 1 }
       ]
     }
   }
   ```
   This file plays **exactly the role the hidden META sheet plays today** — it is the one thing
   `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS` trusts. Unlike `.env`, **it holds no secret** — it's safe
   (and important) to commit alongside `intake.json`: losing it means responses already collected
   can no longer be resolved back to the right database rows, so it's operational data, not a
   credential.
6. Prints the Form's edit link and responder (shareable) link at the end — that responder link is
   what you send to participants.
7. `--dry-run`: resolves everything from the database and prints what *would* be created
   (instrument count, item count, question types) without calling any Forms API write endpoint.

### 2.2 `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`

**What it does**, given `--study <slug>` (and `--dry-run` as usual):

1. Reads `new_study_intake/<slug>/google_form_map.json` to get the `formId` and the three maps
   above. Errors clearly if that file doesn't exist (run `GDX_SKILL_GENERATE_GOOGLE_FORM` first).
2. Calls `forms.responses.list` for that `formId` — one entry per submission, each with its own
   `responseId` and an `answers` object keyed by `questionId`.
3. For each response:
   - Resolves the **Participant Info** answers via `participantFieldMap` (same semantics as
     `readParticipant()` in the existing loader: Full Name + External Identifier are required and
     never invented; everything else is optional).
   - For each item question, looks up `itemMap[questionId]` to get the exact `ID_ITEM` /
     `ID_INSTRUMENT` / `ITEM_ORDER` — **no text matching needed for this step**, the `questionId`
     already uniquely identifies the item (see §3's nuance on choice answers).
   - Writes the same chain `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` writes, independently implemented:

     | Table | When |
     |---|---|
     | `GDX_PSY_PERSON` | Found by `EXTERNAL_IDENTIFIER`; inserted only if not found. Name never overwritten. |
     | `GDX_PSY_STUDY_PARTICIPANT` | Found by `(ID_STUDY, ID_PERSON)`; inserted only if not found. |
     | `GDX_PSY_APPLICATION` | One per instrument that has any answered question in this response. |
     | `GDX_PSY_ITEM_RESPONSE` | One per answered item. |

4. **Idempotency**: tags `GDX_PSY_APPLICATION.CONTEXT` with
   `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS:<formId>:<responseId>` — re-running is safe, already-loaded
   `(formId, responseId, instrument)` combinations are skipped, never duplicated. (Note this is
   *per response*, a bit finer-grained than the xlsx loader's per-*filename* tag, since Forms
   naturally gives every submission its own id.)
5. Reports `UNMATCHED answers` / `MISSING required answers`, same spirit and same "never guess, let
   a human look" philosophy as the existing loader.
6. **Out of scope for v1** (matching the existing loader's own documented scope boundary):
   computing `GDX_PSY_VARIABLE_RESULT` / construct-level scores. Could be added later following the
   same `SCORE_FORMULAS` pattern if/when wanted — not part of this first build.

## 3. The one real nuance in how matching works

`questionId` uniquely and permanently identifies **which item** a question is (captured once at
creation, never re-resolved by text — this is the whole point). But the Forms API does **not**
assign a stable id to each individual *choice option* the way it does to the question itself — a
chosen `RADIO` answer comes back from `forms.responses.list` as the literal text the respondent
selected (e.g. `"Not at all"`), not an id.

So resolving *which alternative* was picked still involves one text comparison — but it is a **safe,
narrow** one: it's matched against `alternativeMap[questionId]`, i.e. only among the small,
exact-verbatim set of choices recorded for *that already-identified* item (typically 2–20 options),
not against the whole database. The respondent could only ever have picked one of those exact
strings (it's a radio button, not free text), so this is nothing like the open-ended name-matching
risk that a Sheets/xlsx-header approach would have. Worth stating plainly rather than glossing over.

## 4. File layout (both skills fully self-contained, same conventions as every existing skill here)

```
0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM/
  SKILL.md
  .env.example
  scripts/
    generate_google_form.js
    package.json

0.new.instrument/.claude/skills/GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS/
  SKILL.md
  .env.example
  scripts/
    load_google_form_answers.js
    package.json
```

Each `.env.example` carries **both** the usual Firebird connection vars (same as every other skill
here — both new skills talk to the database directly, one to read the catalog, one to write
responses) **and** the new Google OAuth vars:

```
# Firebird (same database as every other GDX_HUMAN skill)
GDX_HUMAN_FB_HOST=localhost
GDX_HUMAN_FB_PORT=3050
GDX_HUMAN_FB_DATABASE=C:/Wilson/GoDataX/GDX_HUMAN7/13.onboarding.env/GODATAX7HPH.GDB
GDX_HUMAN_FB_USER=SYSDBA
GDX_HUMAN_FB_PASSWORD=

# Google OAuth client (Forms API) -- see SKILL.md "One-time authorization" section
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_TOKEN_PATH=./google_token.json
```

`google_token.json` (the refresh token saved after the one-time browser consent) is gitignored, same
treatment as `.env` itself. **Design choice to confirm with you:** `GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`'s
`.env` can either point `GOOGLE_OAUTH_TOKEN_PATH` at the *same* token file
`GDX_SKILL_GENERATE_GOOGLE_FORM` produced (one consent click total, shared token, simplest for you
day-to-day) or do its own separate one-time consent (fully independent credential, two clicks
instead of one, strictly more isolated). Since "independent" in your instruction read as *independent
of the existing xlsx skills*, not independent of each other, I'd default to the shared-token option
unless you'd rather keep them fully separate — flag if you want the latter.

## 5. What does **not** change

- `psychometrics_model_firebird25.sql`, the `GDX_PSY_*` schema, `GDX_SKILL_NEW_STUDY`,
  `GDX_SKILL_RECORD_NEW_STUDY`, `GDX_SKILL_EXPORT_NEW_STUDY`, `GDX_SKILL_LOAD_NEW_STUDY_ANSWERS` —
  none of these are touched, imported from, or modified. This is a parallel, additive path.
- Cost: $0 (Forms/Sheets/Drive APIs are free tier, no billing account needed — see prior discussion).
  Setup cost is the one-time OAuth consent click, same as already explained.

## 6. Decisions made while building (no objection raised, so these defaults were used)

1. **Shared OAuth token** — both skills' `.env.example` point at the same token file by default
   (`GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS`'s `GOOGLE_OAUTH_TOKEN_PATH` points at
   `GDX_SKILL_GENERATE_GOOGLE_FORM`'s, via relative path) — one consent click, not two. Change
   either `.env`'s path if you'd rather keep them fully separate.
2. **Consent/identity** — self-reported External Identifier, exactly mirroring the xlsx flow's
   "Participant" sheet (now a "Participant Information" section at the top of the Form). Full
   Name and External Identifier/Code are required questions; everything else optional.
3. **One Form per study** — all of a study's instruments become page-break sections within a
   single Form, same grouping as one xlsx workbook per study.
4. **Scoring (`GDX_PSY_VARIABLE_RESULT`) is out of scope for this v1**, same as stated in §2.2 —
   not built. Say so if you want it added, following the existing `SCORE_FORMULAS` pattern.

## 7. What's left — entirely on your side

Everything code-side is done. What remains needs your own Google account:

1. Follow "One-time authorization" in `GDX_SKILL_GENERATE_GOOGLE_FORM/SKILL.md` — create/reuse a
   Google Cloud project, enable the Forms API, create a **Desktop app** OAuth client, put its
   Client ID/Secret in both skills' `.env` files.
2. `cd 0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM/scripts && node generate_google_form.js --study <slug> --dry-run` to sanity-check against a real study, then drop `--dry-run` to actually create the Form (this is the step that opens the one-time browser consent).
3. Send the printed responder link to participants.
4. Once there are responses, `cd ../../GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS/scripts && node load_google_form_answers.js --study <slug> --dry-run`, then without `--dry-run` to write them into the database.
