---
name: GDX_SKILL_UP_FIREBIRD_DB
description: Creates a local Firebird database file (GoDataX7Hph.gdb) in 13.on.bording.env by executing godatax_human_full_ddl_no_gdx_ead_firebird25.sql through GDS32.DLL directly (P/Invoke against the Firebird C API), with no Firebird Server/Guardian service, no node-firebird, and no network wire protocol involved. Use when the user asks to (re)build the local GoDataX7Hph.gdb from the DDL script, or to stand up a fresh onboarding database in this folder.
---

# GDX_SKILL_UP_FIREBIRD_DB

Runs `godatax_human_full_ddl_no_gdx_ead_firebird25.sql` against a brand-new **local** Firebird database file, using only `GDS32.DLL` in this same folder — no Firebird Windows service, no `node-firebird`, no host/port.

## Usage

```powershell
# from anywhere -- the script resolves its own paths
C:\Wilson\GoDataX\GDX_HUMAN7\13.on.bording.env\.claude\skills\GDX_SKILL_UP_FIREBIRD_DB\scripts\up_firebird_db.ps1 -DryRun
C:\Wilson\GoDataX\GDX_HUMAN7\13.on.bording.env\.claude\skills\GDX_SKILL_UP_FIREBIRD_DB\scripts\up_firebird_db.ps1 -Force
```

- `-DryRun` — parses and counts the DDL statements (by kind), touches nothing.
- `-Force` — deletes an existing `GoDataX7Hph.gdb` before recreating it. Without it, the script refuses to run if the file already exists.
- `-DdlPath <path>` / `-DbPath <path>` — override the defaults (`godatax_human_full_ddl_no_gdx_ead_firebird25.sql` / `GoDataX7Hph.gdb`, both resolved relative to this skill's root, `13.on.bording.env`).
- `-User` / `-Password` — owner of the new database. Default `SYSDBA` / `masterkey` (Firebird's own defaults). This is a throwaway local file the script itself creates, not a shared account, so there is no secret here to protect the way `GDX_HUMAN_FB_PASSWORD` is protected elsewhere in this repo.
- The script auto-relaunches itself under 32-bit PowerShell if invoked from a 64-bit host — `GDS32.DLL` is an x86-only DLL and cannot load into a 64-bit process.

On success it prints the statement count and the resulting file size. On any failure mid-script it rolls back the open transaction, detaches, **deletes the partially-created `.gdb` file** (it's this run's own just-created artifact, not pre-existing user data), and reports which statement (1-indexed, in DDL-file order) failed and why.

## Why GDS32.DLL alone isn't enough — and what had to be added next to it

`GDS32.DLL` as originally dropped into this folder is a 32-bit Firebird **2.5.3.26780** client/engine library, but it would not load at all (`DllNotFoundException` / `ERROR_MOD_NOT_FOUND`) until these companions were placed in the **same directory** (Windows resolves a DLL's own dependencies from the directory it was loaded from):

| File | Why | Sourced from |
|---|---|---|
| `msvcr80.dll` | Visual C++ 2005 CRT the DLL links against | `C:\Windows\WinSxS\x86_microsoft.vc80.crt_...` |
| `icuuc30.dll`, `icuin30.dll`, `icudt30.dll` | ICU 3.0 Unicode/collation libraries | local `Firebird_2_5\bin\bin\bin\` install |
| `firebird.msg` | Message-code table `isc_interprete` needs to render human-readable errors | local `Firebird_2_5\bin\bin\` install |

Without these five files (plus `GDS32.DLL` itself) sitting next to each other, nothing in this skill can work — this isn't a configuration choice, the DLL is simply not self-sufficient as a single file. If this folder is ever moved to a machine with no Firebird install to borrow these from, source a genuine "Firebird 2.5 Embedded for Windows (x86)" package instead and drop its `fbembed.dll`-derived companions here.

## Known quirk: benign warning cluster on `CREATE DATABASE`

The very first `isc_dsql_execute_immediate()` call that creates the database returns a non-empty ISC status vector (`status[0] == 1`, decoding to `"unknown ISC error 0"`) **even on outright success** — confirmed by re-attaching to the freshly created file afterward and getting a valid handle back. The script (`Fb.IsBenign` in `up_firebird_db.ps1`) treats a decoded message that is empty or exactly `"unknown ISC error 0"` as non-fatal, and uses the returned handle (non-zero = success) as the real signal — not the presence of *any* entry in the status vector. Any other decoded message is still treated as a hard failure.

## Known quirk: calling convention

`isc_dsql_execute_immediate` and friends in `GDS32.DLL` use the **`stdcall`** calling convention (classic Win32/Delphi-style ABI for this API), not `cdecl`. Declaring the P/Invoke signatures as `Cdecl` loads fine and even *works* for the first several dozen calls (stack misalignment accumulates one call at a time), then crashes the whole PowerShell process with no managed exception — it reproduced consistently at the 38th call (right at the first `CREATE TABLE`, after 37 `CREATE SEQUENCE` calls) during development. All `[DllImport]` declarations in `up_firebird_db.ps1` use `CallingConvention.StdCall`.

## Known quirk: don't interleave another Firebird connection to the same file

During development, running the local Firebird Windows service's `node-firebird` connection against the just-created `.gdb` (for verification), then immediately re-running this script with `-Force` against that same path, made the second run hang -- the PowerShell process pegged one CPU core for minutes with no progress (killed and confirmed via `Get-Process ... CPU`, not a normal blocking wait). Deleting the file and re-running in isolation (no other Firebird connection touching that path first) completed cleanly every time. If you need to inspect the database with another tool/connection right after running this script, detach/close that other connection fully before re-running this script with `-Force` against the same path.

## Verified end-to-end

A full run (348 statements: 37 sequences, 55 tables, 55 primary keys, 30 unique constraints, 39 check constraints, 70 foreign keys, 25 indexes, 37 triggers) completes cleanly and produces a working database — checked independently by pointing `node-firebird` at the resulting file through the *unrelated* local Firebird Windows service (`127.0.0.1:3050`, arbitrary absolute path) and: confirming the catalog counts match, confirming zero `GDX_EAD_*` tables exist, and round-tripping an `INSERT` into `GDX_PSY_STUDY` (its `BI_GDX_PSY_STUDY` trigger correctly assigned `ID_STUDY` from `SEQ_GDX_PSY_STUDY`) followed by cleanup.

**Open question, left for the user to confirm:** whether `GDS32.DLL`'s `CREATE DATABASE` call is a true embedded engine (fully self-contained) or silently routes through the already-running local `FirebirdServerDefaultInstance` / `FirebirdGuardianDefaultInstance` Windows services when given a bare local path. This session could not conclusively settle it — testing requires temporarily stopping those services, which needs an elevated PowerShell this session doesn't have. If that matters for your use case, stop both services (`Stop-Service FirebirdGuardianDefaultInstance -Force; Stop-Service FirebirdServerDefaultInstance -Force` as Administrator) and re-run `-Force` to see if it still works, then restart them.

## Files in this skill

- `scripts/up_firebird_db.ps1` — the whole skill: P/Invoke wrapper (`Fb` class, generated via `Add-Type`), a BEGIN/END-aware statement splitter (trigger bodies contain semicolons that are not statement terminators), and the create/execute/commit flow.
- No `.env` — nothing here is a secret; every parameter has a safe, overridable default (see Usage above).

## Prerequisites this skill depends on (in `13.on.bording.env`, not in this skill folder)

- `GDS32.DLL`, `msvcr80.dll`, `icuuc30.dll`, `icuin30.dll`, `icudt30.dll`, `firebird.msg` (see table above)
- `godatax_human_full_ddl_no_gdx_ead_firebird25.sql` — the DDL this skill executes (see `13.on.bording.env`'s own history for how it was generated — full schema of the live `godatax.human` Firebird database at `firebird.godatax.com`, excluding the self-contained `GDX_EAD_*` module)
