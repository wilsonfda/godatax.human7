<#
.SYNOPSIS
  Creates a local Firebird 2.5 database file by calling the Firebird C API
  directly through GDS32.DLL (P/Invoke) -- no Firebird Server/Guardian
  service, no node-firebird, no network wire protocol involved.

.DESCRIPTION
  GDS32.DLL in this same folder is a 32-bit Firebird 2.5.3 client/engine
  library. It cannot load on its own: it is missing its runtime companions
  (MSVCR80.dll, icuuc30.dll, icuin30.dll, icudt30.dll, firebird.msg), which
  this skill folder also ships alongside it for exactly that reason -- see
  SKILL.md for how they were sourced. Windows resolves a DLL's own
  dependencies from the directory it was loaded from, so all of these files
  must stay siblings of GDS32.DLL.

  This script:
    1. Re-launches itself under 32-bit PowerShell if started from a 64-bit
       host (GDS32.DLL is x86-only; a 64-bit process cannot load it).
    2. Calls isc_dsql_execute_immediate with a bare local path (no host
       prefix) to CREATE DATABASE -- this is the call that creates the
       .gdb file and attaches to it, returning a database handle.
    3. Splits the DDL script into individual statements with a small
       tokenizer that tracks single-quoted strings and BEGIN/END nesting
       depth (trigger bodies contain semicolons that must NOT be treated
       as statement separators).
    4. Runs every statement inside one transaction and commits at the end;
       on any failure it rolls back, detaches, deletes the partially
       created .gdb file (it is this run's own throwaway artifact) and
       reports which statement failed.

.PARAMETER DdlPath
  Path to the DDL script to execute. Defaults to
  godatax_human_full_ddl_no_gdx_ead_firebird25.sql in this skill's root
  folder (13.on.bording.env).

.PARAMETER DbPath
  Path to the .gdb file to create. Defaults to GoDataX7Hph.gdb in this
  skill's root folder.

.PARAMETER User / .PARAMETER Password
  Owner credentials for the new database. Default to Firebird's standard
  SYSDBA/masterkey -- this is a brand-new local file this script itself
  creates, not a shared/remote account, so there is no secret to protect
  here (unlike the GDX_HUMAN_FB_* variables used elsewhere in this repo).

.PARAMETER Force
  Delete an existing file at -DbPath before creating a fresh one. Without
  this switch the script refuses to run if the target file already exists.

.PARAMETER DryRun
  Parse and count the statements in the DDL script (grouped by kind) and
  exit without touching any database file.

.EXAMPLE
  .\up_firebird_db.ps1 -DryRun

.EXAMPLE
  .\up_firebird_db.ps1 -Force
#>
[CmdletBinding()]
param(
    [string]$DdlPath,
    [string]$DbPath,
    [string]$User = 'SYSDBA',
    [string]$Password = 'masterkey',
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------
# 0. Re-launch under 32-bit PowerShell if needed (GDS32.DLL is x86-only)
# ---------------------------------------------------------------------
if ([Environment]::Is64BitProcess) {
    $x86Powershell = Join-Path $env:WINDIR 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
    if (-not (Test-Path $x86Powershell)) {
        throw "This script must run under 32-bit PowerShell (GDS32.DLL is a 32-bit DLL), and $x86Powershell was not found."
    }
    $passThroughArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $MyInvocation.MyCommand.Path)
    foreach ($key in $PSBoundParameters.Keys) {
        $value = $PSBoundParameters[$key]
        if ($value -is [switch]) {
            if ($value.IsPresent) { $passThroughArgs += "-$key" }
        } else {
            $passThroughArgs += "-$key"
            $passThroughArgs += "$value"
        }
    }
    Write-Host "Re-launching under 32-bit PowerShell ($x86Powershell)..."
    & $x86Powershell @passThroughArgs
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------------
# 1. Resolve paths
# ---------------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir)))
# .../13.on.bording.env/.claude/skills/GDX_SKILL_UP_FIREBIRD_DB/scripts -> up 4 -> 13.on.bording.env

if (-not $DdlPath) { $DdlPath = Join-Path $SkillRoot 'godatax_human_full_ddl_no_gdx_ead_firebird25.sql' }
if (-not $DbPath) { $DbPath = Join-Path $SkillRoot 'GoDataX7Hph.gdb' }

$DllPath = Join-Path $SkillRoot 'GDS32.DLL'
$requiredCompanions = @('GDS32.DLL', 'msvcr80.dll', 'icuuc30.dll', 'icuin30.dll', 'icudt30.dll', 'firebird.msg')
$missing = $requiredCompanions | Where-Object { -not (Test-Path (Join-Path $SkillRoot $_)) }
if ($missing.Count -gt 0) {
    throw "Missing required file(s) next to GDS32.DLL in $SkillRoot : $($missing -join ', '). See SKILL.md for where these came from."
}

if (-not (Test-Path $DdlPath)) {
    throw "DDL script not found: $DdlPath"
}

# ---------------------------------------------------------------------
# 2. P/Invoke wrapper + statement splitter
# ---------------------------------------------------------------------
$src = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class Fb {
    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int isc_dsql_execute_immediate(int[] status, ref int db_handle, ref int tr_handle, ushort length, string statement, ushort dialect, IntPtr sqlda);

    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall)]
    public static extern int isc_start_transaction(int[] status, ref int tr_handle, short dbCount, ref int db_handle, short tpbLen, byte[] tpb);

    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall)]
    public static extern int isc_commit_transaction(int[] status, ref int tr_handle);

    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall)]
    public static extern int isc_rollback_transaction(int[] status, ref int tr_handle);

    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall)]
    public static extern int isc_detach_database(int[] status, ref int db_handle);

    [DllImport(@"$DllPath", CallingConvention = CallingConvention.StdCall)]
    public static extern int isc_interprete(byte[] buffer, ref IntPtr pvector);

    public static string DecodeStatus(int[] status) {
        var handle = GCHandle.Alloc(status, GCHandleType.Pinned);
        try {
            IntPtr p = handle.AddrOfPinnedObject();
            var msgs = new List<string>();
            var buf = new byte[512];
            while (true) {
                int rc = isc_interprete(buf, ref p);
                if (rc == 0) break;
                int len = Array.IndexOf(buf, (byte)0);
                if (len < 0) len = buf.Length;
                msgs.Add(Encoding.ASCII.GetString(buf, 0, len));
            }
            return string.Join(" || ", msgs);
        } finally {
            handle.Free();
        }
    }

    // True only for a message that is empty, or the harmless placeholder
    // this build emits even on outright success (observed on CREATE
    // DATABASE -- see SKILL.md "Known quirk"). Anything else is a real error.
    public static bool IsBenign(string decoded) {
        if (string.IsNullOrEmpty(decoded)) return true;
        return decoded.Trim().Equals("unknown ISC error 0", StringComparison.OrdinalIgnoreCase);
    }

    // Splits a Firebird DDL script into individual statements. Tracks
    // single-quoted string literals (with '' escaping) and BEGIN/END
    // nesting depth so semicolons inside trigger/procedure bodies are not
    // treated as statement terminators. Strips -- line comments.
    public static List<string> SplitStatements(string sql) {
        var result = new List<string>();
        var sb = new StringBuilder();
        bool inString = false;
        int depth = 0;
        int i = 0;
        int n = sql.Length;
        while (i < n) {
            char c = sql[i];
            if (inString) {
                sb.Append(c);
                if (c == '\'') {
                    if (i + 1 < n && sql[i + 1] == '\'') { sb.Append(sql[i + 1]); i += 2; continue; }
                    inString = false;
                }
                i++;
                continue;
            }
            if (c == '\'') { inString = true; sb.Append(c); i++; continue; }
            if (c == '-' && i + 1 < n && sql[i + 1] == '-') {
                while (i < n && sql[i] != '\n') i++;
                continue;
            }
            if (char.IsLetter(c) && (i == 0 || !(char.IsLetterOrDigit(sql[i - 1]) || sql[i - 1] == '_'))) {
                int j = i;
                while (j < n && (char.IsLetterOrDigit(sql[j]) || sql[j] == '_')) j++;
                string word = sql.Substring(i, j - i);
                string upper = word.ToUpperInvariant();
                if (upper == "BEGIN") depth++;
                else if (upper == "END" && depth > 0) depth--;
                sb.Append(word);
                i = j;
                continue;
            }
            if (c == ';' && depth == 0) {
                string stmt = sb.ToString().Trim();
                if (stmt.Length > 0) result.Add(stmt);
                sb.Clear();
                i++;
                continue;
            }
            sb.Append(c);
            i++;
        }
        string last = sb.ToString().Trim();
        if (last.Length > 0) result.Add(last);
        return result;
    }
}
"@
Add-Type -TypeDefinition $src -Language CSharp

# ---------------------------------------------------------------------
# 3. Parse the DDL script
# ---------------------------------------------------------------------
$ddlText = Get-Content -Raw -Path $DdlPath
$statements = [Fb]::SplitStatements($ddlText)

$kinds = @{}
foreach ($s in $statements) {
    $head = ($s -replace '\s+', ' ').Trim()
    $key =
        if ($head -match '^(?i)CREATE\s+TABLE')            { 'CREATE TABLE' }
        elseif ($head -match '^(?i)CREATE\s+SEQUENCE')      { 'CREATE SEQUENCE' }
        elseif ($head -match '^(?i)CREATE\s+INDEX')         { 'CREATE INDEX' }
        elseif ($head -match '^(?i)CREATE\s+UNIQUE\s+INDEX'){ 'CREATE UNIQUE INDEX' }
        elseif ($head -match '^(?i)CREATE\s+TRIGGER')       { 'CREATE TRIGGER' }
        elseif ($head -match '^(?i)CREATE\s+PROCEDURE')     { 'CREATE PROCEDURE' }
        elseif ($head -match '^(?i)CREATE\s+VIEW')          { 'CREATE VIEW' }
        elseif ($head -match '^(?i)ALTER\s+TABLE.*PRIMARY\s+KEY') { 'ADD PRIMARY KEY' }
        elseif ($head -match '^(?i)ALTER\s+TABLE.*ADD\s+CONSTRAINT.*UNIQUE') { 'ADD UNIQUE' }
        elseif ($head -match '^(?i)ALTER\s+TABLE.*CHECK')   { 'ADD CHECK' }
        elseif ($head -match '^(?i)ALTER\s+TABLE.*FOREIGN\s+KEY') { 'ADD FOREIGN KEY' }
        else { 'OTHER' }
    if (-not $kinds.ContainsKey($key)) { $kinds[$key] = 0 }
    $kinds[$key]++
}

Write-Host "Parsed $($statements.Count) statements from $DdlPath"
$kinds.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host ("  {0,-20} {1}" -f $_.Key, $_.Value) }

if ($DryRun) {
    Write-Host "Dry run only -- no database touched."
    exit 0
}

# ---------------------------------------------------------------------
# 4. Target file check
# ---------------------------------------------------------------------
if (Test-Path $DbPath) {
    if ($Force) {
        Write-Host "Removing existing $DbPath (-Force)..."
        Remove-Item $DbPath -Force
    } else {
        throw "$DbPath already exists. Re-run with -Force to overwrite it."
    }
}

# ---------------------------------------------------------------------
# 5. CREATE DATABASE
# ---------------------------------------------------------------------
$status = New-Object int[] 20
[int]$db = 0
[int]$tr = 0
$createStmt = "CREATE DATABASE '$DbPath' USER '$User' PASSWORD '$Password'"
Write-Host "Creating database: $DbPath"
$createLen = [uint16]([System.Text.Encoding]::ASCII.GetByteCount($createStmt))
[Fb]::isc_dsql_execute_immediate($status, [ref]$db, [ref]$tr, $createLen, $createStmt, 3, [IntPtr]::Zero) | Out-Null

if ($db -eq 0) {
    $msg = [Fb]::DecodeStatus($status)
    throw "CREATE DATABASE failed: $msg"
}
Write-Host "Database created and attached (handle=$db)."

# ---------------------------------------------------------------------
# 6. Start transaction, run every statement, commit
# ---------------------------------------------------------------------
function Cleanup-PartialDatabase($dbHandle, $path) {
    $st = New-Object int[] 20
    if ($dbHandle -ne 0) { [Fb]::isc_detach_database($st, [ref]$dbHandle) | Out-Null }
    if (Test-Path $path) {
        Write-Host "Deleting partially created $path ..."
        Remove-Item $path -Force -ErrorAction SilentlyContinue
    }
}

$trStatus = New-Object int[] 20
[Fb]::isc_start_transaction($trStatus, [ref]$tr, 1, [ref]$db, 0, $null) | Out-Null
if ($tr -eq 0) {
    $msg = [Fb]::DecodeStatus($trStatus)
    Cleanup-PartialDatabase $db $DbPath
    throw "isc_start_transaction failed: $msg"
}

$count = 0
foreach ($stmt in $statements) {
    $count++
    Write-Verbose "-> [$count] $($stmt.Substring(0, [Math]::Min(80, $stmt.Length)))"
    $execStatus = New-Object int[] 20
    $stmtLen = [uint16]([System.Text.Encoding]::ASCII.GetByteCount($stmt))
    $rc = [Fb]::isc_dsql_execute_immediate($execStatus, [ref]$db, [ref]$tr, $stmtLen, $stmt, 3, [IntPtr]::Zero)
    $decoded = [Fb]::DecodeStatus($execStatus)
    if ($rc -ne 0 -or -not [Fb]::IsBenign($decoded)) {
        Write-Host "FAILED at statement $count/$($statements.Count):"
        Write-Host $stmt
        Write-Host "Error: $decoded"
        $rbStatus = New-Object int[] 20
        [Fb]::isc_rollback_transaction($rbStatus, [ref]$tr) | Out-Null
        Cleanup-PartialDatabase $db $DbPath
        throw "DDL execution stopped at statement $count/$($statements.Count). See output above."
    }
    if ($count % 25 -eq 0 -or $count -eq $statements.Count) {
        Write-Host "  [$count/$($statements.Count)] ..."
    }
}

$commitStatus = New-Object int[] 20
[Fb]::isc_commit_transaction($commitStatus, [ref]$tr) | Out-Null
$commitMsg = [Fb]::DecodeStatus($commitStatus)
if (-not [Fb]::IsBenign($commitMsg)) {
    Cleanup-PartialDatabase $db $DbPath
    throw "COMMIT failed: $commitMsg"
}

$detachStatus = New-Object int[] 20
[Fb]::isc_detach_database($detachStatus, [ref]$db) | Out-Null

$fileInfo = Get-Item $DbPath
Write-Host ""
Write-Host "SUCCESS: $($statements.Count) statements executed."
Write-Host "Database file: $DbPath ($($fileInfo.Length) bytes)"
