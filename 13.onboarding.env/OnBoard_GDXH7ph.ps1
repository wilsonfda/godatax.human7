<#
.SYNOPSIS
  Onboarding bootstrap (plain script, not a Claude Code skill): installs the
  Claude Code CLI, logs in, clones godatax.human7, and runs /init inside it.

.DESCRIPTION
  Mirrors the first few manual steps already written down in
  13.onboarding.env\on.bording.txt ("instale o claude code client / loge com
  o claude / clone projecto"), as a single runnable PowerShell script instead
  of a checklist a person follows by hand.

  Steps, in order:
    1) Install Git for Windows (via winget) if it is not already on PATH --
       done first, before anything else, since the clone step later needs it.
    2) Install the Claude Code CLI (official native installer) if it is not
       already on PATH.
    3) Authenticate with Claude Code (claude auth login), skipped if already
       logged in, and skipped if ANTHROPIC_API_KEY is set in the environment
       (Claude Code picks that up on its own -- see
       https://code.claude.com/docs/en/setup#authenticate).
    4) git clone https://github.com/wilsonfda/godatax.human7.git into
       -TargetDir (default: a GoDataX\GDX_HUMAN7 folder under your user
       profile). Refuses to clone over an existing, non-empty, non-git
       directory -- never overwrites something already there.
    5) Run the built-in /init command (claude -p "/init") inside the cloned
       project to generate its CLAUDE.md.

  Login (step 3) and /init (step 5) both talk to Anthropic's servers and, for
  login, open a real browser window for you to complete the sign-in -- this
  script cannot finish those two steps silently without your input unless
  ANTHROPIC_API_KEY is already set.

.PARAMETER TargetDir
  Where to clone the project. Defaults to "$HOME\GoDataX\GDX_HUMAN7".

.PARAMETER RepoUrl
  The repository to clone. Defaults to the GDX_HUMAN7 project's own URL.

.EXAMPLE
  .\OnBoard_GDXH7ph.ps1
  .\OnBoard_GDXH7ph.ps1 -TargetDir D:\Projects\GDX_HUMAN7
#>

param(
  [string]$TargetDir = (Join-Path $HOME 'GoDataX\GDX_HUMAN7'),
  [string]$RepoUrl = 'https://github.com/wilsonfda/godatax.human7.git'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 1) Install Git for Windows, if not already on PATH -- first, before
#    anything else, since step 4 (clone) needs it.
# ---------------------------------------------------------------------------
Write-Step 'Checking for Git...'
$gitCmd = Get-Command git -ErrorAction SilentlyContinue

if (-not $gitCmd) {
  Write-Host 'Git not found on PATH -- installing Git for Windows via winget.'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw ("Git is not installed, and winget (Windows Package Manager) is not available to install " +
           "it automatically. Install Git for Windows manually " +
           "(https://git-scm.com/downloads/win) and re-run this script.")
  }
  winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements

  # winget updates the registry PATH value, but this already-running
  # PowerShell process does not automatically pick that up -- same fix as
  # the Claude Code install below: prepend the known install directory and
  # also try reloading PATH from the registry as a fallback.
  $gitInstallDir = 'C:\Program Files\Git\cmd'
  if (Test-Path $gitInstallDir) { $env:Path = "$gitInstallDir;$env:Path" }
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'User') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'Machine')

  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if (-not $gitCmd) {
    throw ("Git was installed, but 'git' is still not found on PATH in this session. Close this " +
           "PowerShell window, open a new one, and re-run this script -- the new PATH only takes " +
           "effect in a fresh session.")
  }
}

Write-Host "Git: $(git --version)"

# ---------------------------------------------------------------------------
# 2) Install Claude Code (native installer), if not already on PATH.
#    Official command, see https://code.claude.com/docs/en/setup#install-claude-code
# ---------------------------------------------------------------------------
Write-Step 'Checking for the Claude Code CLI...'
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue

if (-not $claudeCmd) {
  Write-Host 'Claude Code not found on PATH -- installing with the official native installer.'
  irm https://claude.ai/install.ps1 | iex

  # The native installer writes claude.exe under %USERPROFILE%\.local\bin and
  # updates the *user* PATH registry value, but this already-running
  # PowerShell process does not automatically pick that up. Prepend the known
  # install directory for the rest of this script, and also try reloading
  # PATH from the registry as a fallback.
  $installDir = Join-Path $env:USERPROFILE '.local\bin'
  if (Test-Path $installDir) { $env:Path = "$installDir;$env:Path" }
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'User') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'Machine')

  $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
  if (-not $claudeCmd) {
    throw ("Claude Code was installed, but 'claude' is still not found on PATH in this session. " +
           "Close this PowerShell window, open a new one, and re-run this script -- the new PATH " +
           "only takes effect in a fresh session.")
  }
}

Write-Host "Claude Code: $(claude --version)"

# ---------------------------------------------------------------------------
# 3) Log in, unless already authenticated or ANTHROPIC_API_KEY is set.
#    Official commands, see https://code.claude.com/docs/en/cli-reference
# ---------------------------------------------------------------------------
Write-Step 'Checking Claude Code authentication...'
$null = & claude auth status --text 2>&1
$alreadyLoggedIn = ($LASTEXITCODE -eq 0)

if ($alreadyLoggedIn) {
  Write-Host 'Already authenticated -- skipping login.'
}
elseif ($env:ANTHROPIC_API_KEY) {
  Write-Host 'ANTHROPIC_API_KEY is set in the environment -- Claude Code will use it automatically, skipping interactive login.'
}
else {
  Write-Host 'Opening the browser to sign in. Complete the sign-in flow there, then return to this window.'
  claude auth login
}

# ---------------------------------------------------------------------------
# 4) Clone the project. Never clones over an existing non-empty, non-git
#    directory -- that would risk overwriting someone's work. (Git itself is
#    already guaranteed present by step 1 above.)
# ---------------------------------------------------------------------------
Write-Step "Cloning $RepoUrl into `"$TargetDir`" ..."

if (Test-Path (Join-Path $TargetDir '.git')) {
  Write-Host ("`"$TargetDir`" is already a git repository -- skipping clone. " +
    "Run `"git -C '$TargetDir' pull`" if you want to update it instead.")
}
elseif ((Test-Path $TargetDir) -and ((Get-ChildItem -Path $TargetDir -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)) {
  throw ("Target directory `"$TargetDir`" already exists, is not empty, and is not a git repository -- " +
         "refusing to clone over it. Pass -TargetDir to choose a different location.")
}
else {
  $parent = Split-Path $TargetDir -Parent
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  git clone $RepoUrl $TargetDir
}

# ---------------------------------------------------------------------------
# 5) Run /init inside the cloned project to generate its CLAUDE.md.
#    There is no standalone "claude init" CLI subcommand (see
#    https://code.claude.com/docs/en/cli-reference) -- /init is a built-in
#    slash command, run here non-interactively via `claude -p "/init"`.
#    --permission-mode acceptEdits lets it write CLAUDE.md without a human
#    answering a permission prompt that can't appear in this non-interactive
#    run, without going as far as skipping every permission check.
# ---------------------------------------------------------------------------
Write-Step "Running /init inside `"$TargetDir`" ..."
Push-Location $TargetDir
try {
  claude -p --permission-mode acceptEdits '/init'
}
finally {
  Pop-Location
}

Write-Step 'Done.'
Write-Host "Project ready at `"$TargetDir`"."
Write-Host 'See on.bording.txt in this same folder for the remaining manual steps (Neo4j, GDX_SKILL_UP_FIREBIRD_DB, etc.).'
