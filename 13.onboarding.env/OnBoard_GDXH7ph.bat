@echo off
REM Double-click launcher for OnBoard_GDXH7ph.ps1.
REM
REM What this does and what it needs from you is documented once, in
REM on.bording.txt (this same folder) -- not repeated here as a static
REM banner, since OnBoard_GDXH7ph.ps1 itself already prints a live
REM "==> ..." message before each step as it runs, including the Neo4j
REM instructions. Read on.bording.txt first if you want the full picture
REM before double-clicking this file.
REM
REM .ps1 files are not directly runnable by double-click on Windows (the
REM default file association just opens them in a text editor), and even
REM from a terminal, PowerShell's default execution policy blocks an
REM unsigned local script. This .bat wraps the exact invocation needed to
REM get around both: PowerShell itself IS double-click runnable, and
REM -ExecutionPolicy Bypass applies only to this one process, not the
REM machine's permanent policy.
REM
REM %~dp0 resolves to this .bat file's own folder (with a trailing
REM backslash) regardless of the current working directory or where this
REM folder is copied to, so this launcher and the .ps1 it calls can be
REM moved/copied together as a pair.
REM
REM %* forwards any arguments this .bat was called with (e.g. -TargetDir)
REM straight through to the .ps1.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0OnBoard_GDXH7ph.ps1" %*

echo.
echo Press any key to close this window . . .
pause >nul
