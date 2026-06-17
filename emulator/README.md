# Emulator Live-Sync (Prototyp)

Optionaler **zweiter Eingabemodus** für den SoulLink Tracker: liest das Team
direkt aus BizHawk statt manueller Eingabe. **Sicher & additiv** — die manuelle
Eingabe und alle bestehenden Funktionen bleiben unverändert.

```
emulator/
  bizhawk/
    soullink_sync.lua    ← Phase 1/2: Lua-Prototyp (Party auslesen → console/file/http)
    README.md            ← BizHawk-Setup + Party-Adresse finden
  dev-sync-server/
    server.mjs           ← Phase 2: Standalone-Endpoint (Alternative zum Vite-Plugin)
```

Weitere Bausteine im Projekt:
- **Lokaler Endpoint:** dev-only Vite-Middleware in `vite.config.ts`
  (`/api/emulator-sync`) — läuft nur bei `npm run dev`, **nicht** im Build.
- **Frontend-Testanzeige:** `src/pages/EmulatorSyncTest.tsx` → Route `/emulator-sync`.
- **Konzept & Details:** `docs/emulator-sync-concept.md`.
- **Phase-3-Vorbereitung (Supabase):** `supabase/migration_v11_emulator_sync.sql`
  (**noch nicht ausführen** — nur vorbereitet).

## Schnellstart (Phase 1 → 2)
1. **Phase 1:** `soullink_sync.lua` in BizHawk laden, Party-Adresse verifizieren
   (siehe `bizhawk/README.md`), `CONFIG.output = "console"` → Werte prüfen.
2. **Phase 2:** `npm run dev` starten. Im Lua-Script `CONFIG.output = "http"`,
   `http_url = "http://localhost:5173/api/emulator-sync"`. Im Browser
   `http://localhost:5173/emulator-sync` öffnen → Live-Status + Team.
   - Alternative ohne Vite: `node emulator/dev-sync-server/server.mjs` und
     `http_url` auf `http://localhost:8787/api/emulator-sync` setzen.

## Sicherheit / Datensparsamkeit
- Es werden **nur Spielstatus-Daten** übertragen (Spezies-ID, Level, KP, Status).
- **Keine** ROM-, **keine** Save-Dateien werden gelesen, gesendet oder gespeichert.
- Phase 3 (Supabase) schreibt nur für **eingeloggte** Nutzer und nur deren
  eigene Daten (RLS) — erst nach expliziter Freigabe.
