---
name: GDX_SKILL_UPDATE_WEB
description: Pushes the GDX_HUMAN instrument/construct/variable/item catalog, the septenary-constitution levels, chakras, Thomas Aquinas's Five Ways, the 33 virtues, and every mapping table between them (GDX_PSY_SEPT_LEVEL_PSY_MAP, GDX_PSY_CHAKRA_VAR_MAP, GDX_TA_WAY_SEPT_MAP, GDX_VT_VARIABLE_VIRTUE_MAP, DW_BRIDGE_VARIABLE_*), from the local GODATAX7HPH.GDB (13.onboarding.env) to the shared firebird.godatax.com database. Never touches participant data. For the mapping tables, NUMBER_CONFIRMATIONS only increments when the push's origin IP differs from the IP already recorded in CONFIRMATION_BY -- the same origin confirming again does not inflate the count. Use when the user asks to publish/sync/update the local instrument catalog to the web database.
---

# GDX_SKILL_UPDATE_WEB

Before doing any real work, this skill checks that the logged-in Claude account's email is registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and `GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) — not registered tells you to register at the GoDataX.Com portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

The project now authors its instrument/construct/variable/mapping catalog **locally**, in
`13.onboarding.env/GODATAX7HPH.GDB`. This skill is the one-way push that keeps the shared web
database (`firebird.godatax.com`) in sync with that local copy -- local is always the source of
truth for content; the web database is the read target everyone else's tooling points at.

## Scope -- exactly what gets pushed, and what never does

The table list is a fixed, explicit allowlist in `scripts/tables.js`, **not** a prefix match --
unlike the sibling skill `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`, which deliberately picks up any new
table matching a prefix. Here the opposite is the safety property: this skill writes to a shared
database, so which tables it may touch must stay a conscious decision.

**Plain catalog/reference tables** (`CATALOG_TABLES` -- upsert by primary key, local always wins
on content, no confirmation bookkeeping because these tables have no
`NUMBER_CONFIRMATIONS`/`CONFIRMATION_BY` columns):

`GDX_PSY_INSTRUMENT`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_VARIABLE`, `GDX_PSY_INSTRUMENT_ITEM`,
`GDX_PSY_INSTRUMENT_CONSTRUCT`, `GDX_PSY_ITEM_ALTERNATIVE`, `GDX_PSY_INDICATOR`,
`GDX_PSY_EVALUATOR`, `GDX_PSY_ACTION`, `GDX_PSY_PSYCHOMETRIC_PROPERTY`,
`GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`, `GDX_VT_VIRTUE`,
`DW_DIM_SEPTENARY_LEVEL`, `DW_DIM_CHAKRA`, `DW_DIM_FIVE_WAY`, `DW_DIM_VIRTUE`,
`DW_DIM_INSTRUMENT`, `DW_DIM_CONSTRUCT`, `DW_DIM_VARIABLE`, `DW_DIM_ITEM`,
`DW_BRIDGE_VARIABLE_VIRTUE`, `DW_BRIDGE_VARIABLE_CHAKRA`, `DW_BRIDGE_VARIABLE_WAY`

**Interpretation/mapping tables** (`CONFIRMATION_TABLES` -- same content upsert, plus the
IP-based confirmation rule below):

`GDX_PSY_SEPT_LEVEL_PSY_MAP` (variable ↔ septenary level), `GDX_PSY_CHAKRA_VAR_MAP`
(variable ↔ chakra), `GDX_TA_WAY_SEPT_MAP` (Aquinas's Way ↔ septenary level, with its own
`ID_VARIABLE` extension), `GDX_VT_VARIABLE_VIRTUE_MAP` (variable ↔ virtue). Each of these carries
`NUMBER_CONFIRMATIONS INTEGER DEFAULT 0` and `CONFIRMATION_BY VARCHAR(160)` in the DDL
(`13.onboarding.env/godatax_human_full_ddl_no_gdx_ead_firebird25.sql`).

**Never pushed, on purpose** -- anything that identifies or carries data about a real participant:
`GDX_PSY_STUDY*`, `GDX_PSY_PERSON`, `GDX_PSY_APPLICATION`, `GDX_PSY_OBSERVATION`,
`GDX_PSY_EVALUATION*`, every `GDX_PSY_*_RESULT` and `GDX_PSY_ITEM_RESPONSE`, all of `GDX_CC_*`
(cardiac-coherence sessions/samples are per-person), `DW_DIM_PERSON`, `DW_DIM_SESSION`, and every
`DW_FACT_*` table. Passing `--tables=` is validated against the allowlist -- naming an
out-of-scope table is a hard error, not a silent skip.

## The confirmation rule (mapping tables only)

For `GDX_PSY_SEPT_LEVEL_PSY_MAP` / `GDX_PSY_CHAKRA_VAR_MAP` / `GDX_TA_WAY_SEPT_MAP` /
`GDX_VT_VARIABLE_VIRTUE_MAP`, per row (matched by primary key, `ID_MAPPING`):

1. Every content column (everything except the PK, `NUMBER_CONFIRMATIONS`, `CONFIRMATION_BY`)
   syncs local → web unconditionally when it differs -- local is always authoritative for content.
2. The row doesn't exist yet on the web → insert it, with `NUMBER_CONFIRMATIONS = 1` and
   `CONFIRMATION_BY` set to this run's origin IP (the association's first confirmation).
3. The row exists and `CONFIRMATION_BY` on the web differs from this run's origin IP →
   `NUMBER_CONFIRMATIONS` goes up by exactly 1 and `CONFIRMATION_BY` is overwritten with the new
   origin IP -- an independent source has now confirmed the same association.
4. The row exists and `CONFIRMATION_BY` already equals this run's origin IP → the confirmation
   pair is left untouched (no +1) -- the same origin re-running the sync is not a new
   confirmation, even if some unrelated content column changed and got updated under rule 1.

"Origin IP" is this machine's current public IP address, auto-detected at the start of every run
(`scripts/origin.js`, via `api.ipify.org` with `icanhazip.com` as fallback) unless
`GDX_SYNC_ORIGIN_IP` is set in `.env`. There is no silent fallback if neither IP-echo service is
reachable and no override is set -- the run fails outright rather than guessing an origin, since a
wrong guess would corrupt the confirmation count.

## Running it

```
cd 9.knowledge.graph/.claude/skills/GDX_SKILL_UPDATE_WEB/scripts
npm install                      # once: installs node-firebird
# copy ../.env.example to ../.env and fill in GDX_WEB_FB_PASSWORD
# (and GDX_LOCAL_FB_PASSWORD if this machine's local db isn't the default
# SYSDBA/masterkey from GDX_SKILL_UP_FIREBIRD_DB) -- never commit the real .env

node sync_web.js --dry-run                              # counts only, writes nothing
node sync_web.js --tables=GDX_PSY_INSTRUMENT,GDX_PSY_VARIABLE   # scoped real run
node sync_web.js                                        # full push, every allowlisted table
```

Each run prints, per table: rows read locally, how many were inserted/updated/left unchanged on
the web, and -- for the four mapping tables -- how many got a `+1` confirmation versus how many
were skipped because the same origin had already confirmed them. A totals line follows the
per-table breakdown.

## Files in this skill

- `scripts/tables.js` -- the explicit table allowlist (`CATALOG_TABLES` / `CONFIRMATION_TABLES`);
  edit this, not `sync_web.js`, when a new in-scope table needs to be added
- `scripts/introspect.js` -- reads a table's columns (with BLOB detection) and primary key from
  Firebird's `RDB$` catalog, against the local connection (both databases are assumed to share the
  same schema, since the web database was built from the same DDL)
- `scripts/origin.js` -- resolves the run's origin IP (`GDX_SYNC_ORIGIN_IP` override, or
  `api.ipify.org`/`icanhazip.com`)
- `scripts/sync_web.js` -- connects to both databases, applies the per-table upsert rule, prints
  the summary; supports `--dry-run` and `--tables=T1,T2,...`
- `.env.example` -- connection variable template (no secrets)
- `.env` -- real credentials, gitignored, not committed

## What it will never do

- **Never touches a participant-data table.** The allowlist in `tables.js` is the only thing
  `sync_web.js` will read from or write to; `--tables=` is checked against it and refuses anything
  not on the list. On top of the allowlist, every table name is also checked against an explicit
  denylist (`FORBIDDEN_TABLES`/`FORBIDDEN_PREFIXES` in `tables.js`, enforced by
  `assertNotParticipantTable()`) before anything is read or written -- so even a future edit that
  mistakenly added a participant table to `CATALOG_TABLES`/`CONFIRMATION_TABLES` would still make
  the run fail outright instead of silently pushing participant data.
- **Never hardcodes Firebird credentials.** Both connections come from `.env` only (see
  `.env.example`), matching the convention already established by
  `GDX_SKILL_GODATAX_HUMAN7_BY_SPU/.env.example` for this repo's other cross-database skill.
- **Never pulls from the web back to local.** This is a one-way push; local authoring is the only
  source of truth this skill writes from.
