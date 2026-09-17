---
name: GDX_SKILL_LOAD_RLT_MODEL_DB
description: Reads the GDX_HUMAN psychometrics .sav file, dynamically (re)generates the GDX_PSY_* load scripts (01_load_study.sql .. 08_adjust_sequences.sql) that follow psychometrics_model_firebird25.sql and SPSS_to_Firebird_Mapping.md, and can execute them against a live Firebird database (godatax.human). Use when the user asks to regenerate the psychometrics load scripts, refresh the SPSS data load, or load/sync the GDX_PSY_* tables into Firebird.
---

# GDX_SKILL_LOAD_RLT_MODEL_DB

Two-stage skill for the GDX_HUMAN psychometrics relational model:

1. **Generate** (Python) — reads `GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` fresh every time and writes `01_load_study.sql` … `08_adjust_sequences.sql` into `GDX_HUMAN/2.relational.model.psychometrics/`, matching the tables in `psychometrics_model_firebird25.sql` and the mapping in `SPSS_to_Firebird_Mapping.md`.
2. **Execute** (Node.js) — connects to the target Firebird database over the wire protocol (`node-firebird`, no native client library required) and runs those 8 scripts in order.

## What is dynamic vs. fixed

- **Dynamic (re-read every run):** the actual rows in the `.sav` — respondent IDs, raw item values, computed scores, curricular year. If the source file changes (more respondents, corrected values), re-running step 1 picks that up automatically.
- **Fixed (`scripts/catalog.py`):** which instrument each column belongs to, dimension names, and the English item wording. This cannot be derived from the `.sav` itself (it has no column labels — see `SPSS_to_Firebird_Mapping.md` §1); it was hand-extracted from the researcher's `.pptx`/`.docx`. `generate_load_scripts.py` cross-checks the `.sav`'s actual columns against this catalog on every run and **prints a warning instead of guessing** if it finds columns the catalog doesn't know about, or expected columns that vanished.

## Step 1 — regenerate the load scripts

```
python GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/generate_load_scripts.py
```

Run this from the repo root (`GoDataX.FrameWork`) — the default `--sav`/`--out-dir` paths are relative to the current working directory, not to the script's own location.

Optional flags: `--sav <path>` / `--out-dir <path>` to point at a different file/folder than the repo defaults.

Read the console output. If it prints `WARNING: columns ... the .sav does NOT have` or `columns found ... catalog does NOT know about`, **stop and tell the user** — do not silently extend `catalog.py` with a guessed mapping for new columns; that requires the same kind of manual source-document reading documented in `SPSS_to_Firebird_Mapping.md`.

## Step 2 — execute against the database

Connection is read entirely from environment variables (see `.env.example` in this skill folder) — **never hardcode host/user/password** in these scripts or anywhere else in the repo (this repeats existing CLAUDE.md guidance about not propagating hardcoded Firebird credentials).

```
cd GDX_HUMAN/2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts
npm install                 # once, installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_HUMAN_FB_PASSWORD, or export the vars directly
node execute_load.js --dry-run     # sanity check: connects, runs preflight checks, counts statements, writes nothing
node execute_load.js               # real load
```

**Before running the real (non-dry-run) load against the live database, confirm with the user first** — this is a write to a shared remote system that is not trivially reversible (the script never deletes/truncates anything, so undoing a bad load means manual cleanup on the server). A dry run and a one-line summary of what will be inserted (row counts from step 1's output) is enough context for the user to say go/no-go.

### Safety behavior already built into `execute_load.js`

- **Preflight schema check** — refuses to run if any `GDX_PSY_*` table is missing (tells the user to apply `psychometrics_model_firebird25.sql` first). It does **not** apply the DDL itself.
- **Idempotency guard** — refuses to run if `GDX_PSY_STUDY` already has `ID_STUDY = 1`, to avoid duplicate/partial loads. `--force` skips the guard but the script still never deletes anything; a genuine re-run will simply fail on the first PK/UNIQUE collision it reaches.
- **Resumable** — `--only <1-8>` runs a single file, for retrying just the step that failed after a partial load (e.g. after fixing a transient network error on file 06).
- **Batched commits** — the two bulk files (`06`, `07`, ~58k and ~8.9k statements) commit every 2000 statements instead of one giant transaction.

## Files in this skill

- `scripts/catalog.py` — fixed instrument/construct/variable/item catalog (edit only when the source `.pptx`/`.docx` documentation changes)
- `scripts/generate_load_scripts.py` — stage 1 (Python + pyreadstat)
- `scripts/execute_load.js` + `scripts/package.json` — stage 2 (Node.js + node-firebird)
- `.env.example` — connection variable template (no secrets)
