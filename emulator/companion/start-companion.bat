@echo off
setlocal
REM ──────────────────────────────────────────────────────────────────────────
REM  start-companion.bat — Doppelklick startet den SoulLink Companion.
REM  Der Companion verbindet die Online-Website mit BizHawk/Lua auf diesem PC.
REM  Voraussetzung: Node.js ist installiert (https://nodejs.org, LTS).
REM  Fenster offen lassen, dann auf der Website „Lua-Sync verbinden" klicken.
REM ──────────────────────────────────────────────────────────────────────────

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden.
  echo Bitte Node.js LTS installieren: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo Starte SoulLink Companion ...
node "%~dp0server.mjs"

echo.
echo Der Companion wurde beendet.
pause
endlocal
