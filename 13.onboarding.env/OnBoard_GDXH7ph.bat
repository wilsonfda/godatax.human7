@echo off
echo ============================================================
echo  GoDataX Human7 (GDXH7ph) - Configuracao inicial
echo ============================================================
echo.
echo  Este script vai preparar seu computador para trabalhar no
echo  projeto GoDataX Human7. Ele vai, nesta ordem:
echo.
echo    1. Instalar o Git (se ainda nao estiver instalado)
echo    2. Instalar o Claude Code (ferramenta de linha de comando)
echo    3. Pedir para voce fazer login na sua conta Claude
echo       (vai abrir uma janela no seu navegador)
echo    4. Baixar (clonar) o projeto GoDataX Human7 do GitHub
echo    5. Preparar o projeto para uso no Claude Code
echo.
echo  Requisitos: conexao com a internet e uma conta Claude
echo  (Pro, Max, Team, Enterprise ou Console).
echo.
echo  O processo pode levar alguns minutos. Nao feche esta janela
echo  ate ver a mensagem de conclusao.
echo ============================================================
echo.
pause

REM Double-click launcher for OnBoard_GDXH7ph.ps1.
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
