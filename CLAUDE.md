# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**GDX_HUMAN 7** (GoDataX Human) is a research and data-engineering project built around one real
psychometric study — *"Predictors of Adaptability to Military Higher Education"* (423 military
cadets) — expanded into a relational model, four philosophical/esoteric interpretive bridges
(Septenary Constitution, Kundalini chakras, Aquinas's Five Ways, Virtology), physiological
(cardiac-coherence/HRV) data, a star-schema data warehouse, a Neo4j knowledge graph, two graph-ML
models, and an LLM agent over that graph. It is a documentation + SQL + Node.js/Python automation
repository, not a compiled application: there is **no CI, no build step, no repo-wide test
suite**. Main branch is `master`.

Nearly all automation is implemented as **Claude Code skills** (`.claude/skills/<NAME>/SKILL.md`),
one set per numbered top-level folder. The two entry-point documents, read in full before making
non-trivial changes, are `GDX_HUMAN7_INTRODUCTORY_DOCUMENTATION.md` (short orientation) and
`GDX_HUMAN7_DEVELOPMENT_KIT.md` (full reference: skills catalog, schema deep-dives, logical
architecture diagram). Do not restate their content elsewhere — update them instead when the
architecture changes.

This repo is one of several sibling GoDataX projects that live under a common parent folder on
disk (an enterprise CTP platform repo, a marketing-site repo) but are otherwise unrelated,
independent git repositories — nothing above this repo's own root is part of it.

## Folder map (numbering = dependency order; each folder consumes lower-numbered ones)

```
0.new.instrument/                  generic pipeline to onboard a NEW study/instrument from scratch
1.output.ibm.spss.statistics/      the historical study's source .sav + its data documentation
2.relational.model.psychometrics/  GDX_PSY_* schema (core of everything) + the already-loaded study
3.septenary.constitution/          interpretive bridge: instruments x 7 theosophical bodies/levels
4.kundalini.chakras/                interpretive bridge: 7 chakras x septenary constitution
5.five.ways.tomas.aquino/           interpretive bridge: Aquinas's 5 ways x septenary constitution
6.cardiac.coherence/                physiological (ECG/HRV) data linked to the same person identity
7.multidimensional.database/        data warehouse (star schema) unifying folders 2-6
8.gdx.dashboards/                   self-contained HTML dashboards reading the DW
9.knowledge.graph/                  export of the relational schema to Neo4j + LLM agent setup skill
10.gdx.machine.learning/            2 graph ML models (link prediction, community detection) over Neo4j
11.gdx.llm.agent.mcp/               system prompt for the LLM assistant over the knowledge graph
12.gdx.virtology/                   knowledge base of 33 virtues + variable->virtue link suggestions
13.onboarding.env/                  local Firebird DB bootstrap (GDS32.DLL direct, no server) + onboarding script
14.metaphysical.measuring.instrument/  OT7 metaphysical instrument, association maps to the other bridges
15.environmental.anomalous.phenomena/  GDX_PH_* schema for environmental/anomalous phenomena sensing
```

Each numbered folder is close to self-contained: its own `.claude/skills/`, its own `.md` docs,
its own `*_firebird25.sql`. **Skill discovery in Claude Code is not recursive** — it searches
`.claude/skills/` upward from the current working directory, not downward — so opening a session
at the repo root does not surface skills nested inside e.g. `2.relational.model.psychometrics/`.
`cd` into the specific numbered folder before invoking that folder's skill, or `/add-dir <folder>`
per folder needed in one session.

## Common thread: one person identity

A design decision cuts across folders 2, 6, 7 and 9: there is **exactly one** person identity in
the whole project, `GDX_PSY_PERSON.ID_PERSON`. `DW_DIM_PERSON` is a faithful copy of it;
`GDX_CC_PERSON.ID_PERSON` is a direct FK into it (never a parallel catalog); the Neo4j graph
inherits the same id as `gdx_key`. Today only one person (`SPSS-784`) has both psychometric and
cardiac-coherence data.

## Commands

There is no root-level install/build/test — everything runs inside a specific skill's `scripts/`
folder. The repo-wide pattern, used by nearly every database-writing skill:

```bash
cd <numbered-folder>/.claude/skills/<SKILL_NAME>/scripts
npm install                                    # once, if the skill uses node-firebird/neo4j-driver
# copy ../.env.example to ../.env and fill in the password, or export the vars directly
node <script>.js --dry-run [--study <slug>]    # see what would happen, writes nothing
node <script>.js [--study <slug>]              # apply it — confirm with a human first
```

- `--dry-run` is supported by essentially every write-capable skill — always run it first.
- `--study <slug>` scopes a run to one study; required by every skill built/updated since
  2026-09-17/18 (dashboards, DW loader, knowledge-graph export, link suggestions).
- The two `10.gdx.machine.learning/` skills are read-only against Neo4j; they never touch
  Firebird directly.
- Some generation scripts (e.g. `2.relational.model.psychometrics/.claude/skills/GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/generate_load_scripts.py`)
  are Python and must be run from the repo root since their default `--sav`/`--out-dir` paths are
  relative to the current working directory, not the script's own location — check each
  `SKILL.md` rather than assuming Node vs. Python or the invocation directory.
- `13.onboarding.env/` has a standalone path with no Firebird server/wire protocol: the
  `GDX_SKILL_UP_FIREBIRD_DB` skill builds `GODATAX7HPH.GDB` directly via `GDS32.DLL` from
  `godatax_human_full_ddl_no_gdx_ead_firebird25.sql`, driven by `OnBoard_GDXH7ph.ps1`/`.bat`.

### Environment variables (never hardcode credentials — repo-wide rule)

```bash
# Firebird (godatax.human) — GDX_PSY_*/GDX_TA_*/GDX_CC_*/DW_*/GDX_PH_*
GDX_HUMAN_FB_HOST=127.0.0.1
GDX_HUMAN_FB_PORT=3050
GDX_HUMAN_FB_DATABASE=/firebird/godatax.gdb
GDX_HUMAN_FB_USER=godatax1
GDX_HUMAN_FB_PASSWORD=

# Neo4j (AuraDB) — knowledge-graph export + the two ML skills only
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=

# Firebird web target (firebird.godatax.com) — GDX_SKILL_UPDATE_WEB, and now required by every
# skill's entry script via the account registration gate (_shared/account_gate/)
GDX_WEB_FB_HOST=firebird.godatax.com
GDX_WEB_FB_PORT=3050
GDX_WEB_FB_DATABASE=/firebird/godatax.gdb
GDX_WEB_FB_USER=
GDX_WEB_FB_PASSWORD=
```

Only `.env.example` is committed; `.env` is gitignored everywhere (pattern has no leading slash,
so it matches at any depth — every skill's own `.env`). `.gitignore` also excludes `*.gdb`/`*.fdb`
(the database files hold real data, not just credentials), `Neo4j-*-Created-*.txt`,
`google_token.json`, `client_secret_*.json`, and generic key/credential file patterns.

## Working in this codebase

- **Never invent missing data.** A gap is documented as a gap (e.g. unidentified `.sav` columns,
  "no suggestion (review)" in virtology link suggestions), never filled with a guess.
- **Empirical finding != interpretive reading.** Folders 3-5 and 12 explicitly flag that relating
  a psychometric instrument to a chakra, a Thomistic way, or a virtue is a conceptual organizing
  tool, not a scientific or doctrinal claim. Preserve that distinction in any new doc or output;
  `11.gdx.llm.agent.mcp/prompt.instruction.txt` encodes the same rule for the LLM agent (never
  present a metaphysical correspondence as a validated causal relation, never diagnose).
- **Idempotency and reversibility.** Write-capable skills guard against duplicate loads ("already
  loaded" checks) and never delete data to "fix" something — a correction is made by loading the
  missing real data, not by inserting a made-up value or truncating a table.
- **Account registration gate.** Every skill's entry script (folders 0-16) calls the shared
  `_shared/account_gate/check_account_registration.js` before doing real work: it checks whether
  the logged-in Claude Code account's email (`~/.claude.json` -> `oauthAccount.emailAddress`) has
  a row in `GDX_EAD_USERS.EMAIL` on the shared `firebird.godatax.com` database. Not registered ->
  the skill stops and tells the user to register at the GoDataX.Com portal; `firebird.godatax.com`
  unreachable -> the skill stops with a "no internet connection" error. See
  `GDX_HUMAN7_DEVELOPMENT_KIT.md` §11 for the full design.
- **Filled-in participant questionnaires are never committed** — only `intake.json` and the SQL
  generated from it (see `0.new.instrument/New_Instrument_Onboarding_Process.md`).
- **Table/column naming**: `GDX_<DOMAIN>_<ENTITY>` in `UPPER_SNAKE_CASE` (e.g. `GDX_PSY_PERSON`,
  `GDX_TA_WAY`, `GDX_CC_PERSON`, `DW_DIM_PERSON`); Neo4j node/relationship labels derive from the
  same tables via introspection of Firebird's `RDB$` catalog (one node per table, one edge per FK),
  not a hand-maintained mapping.
- A few older `SKILL.md` files reference paths with a `GDX_HUMAN/` prefix (e.g.
  `GDX_HUMAN/2.relational.model.psychometrics/...`) left over from before this repository was
  split out on its own — the numbered folders are directly at this repo's root; treat that prefix
  as stale and resolve paths from the actual root instead.
- Documentation and SQL comments mix Portuguese and English depending on the file's origin — match
  the surrounding file's language rather than forcing one.
