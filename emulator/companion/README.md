# SoulLink Companion (Online-Live-Sync)

Die **online** Website (`https://…vercel.app`) läuft im Browser-Sandbox und darf
**keine** lokalen Programme starten – also weder `EmuHawk.exe` öffnen, noch eine
ROM laden, noch das Lua-Script einbinden, noch lokale Dateien lesen. Das ist eine
Sicherheits­grenze des Browsers, kein Bug.

Der **Companion** ist ein winziger lokaler Prozess auf deinem PC, der genau das
für die Website übernimmt:

```
Online-Website  ⇄  Companion (127.0.0.1:8787)  ⇄  BizHawk + Lua  →  soullink_team.json
        ▲                                                                   │
        └──────────── Browser pollt Team & schreibt in Supabase  ◀──────────┘
```

* Der Companion **startet BizHawk**, **öffnet die ROM** und **lädt das Lua-Script**
  automatisch – genau wie bisher der Dev-Server (`npm run dev`), nur eben für die
  Online-Seite.
* Die **Sync-Daten** (Team/HP/Level/Attacken/Ort …) laufen unverändert: das Lua
  schreibt `emulator/bizhawk/soullink_team.json`, der Companion liest sie, dein
  **eingeloggter Browser** schreibt sie in dieselben Supabase-Tabellen wie immer.
* Der Companion braucht **keine** Run-ID, **keine** Supabase-Zugangsdaten und ist
  nur an `127.0.0.1` gebunden (nicht im Netzwerk erreichbar). Ziel ist immer der
  Run, der gerade in deinem Browser offen ist.

## Starten

**Voraussetzung:** [Node.js LTS](https://nodejs.org) installiert, und dieses Repo
liegt lokal (mit `emulator/bizhawk/soullink_sync.lua`).

Eine der beiden Varianten:

```bash
npm run companion
```

oder per Doppelklick:

```
emulator/companion/start-companion.bat
```

Du siehst dann:

```
SoulLink Companion läuft
  Health : http://127.0.0.1:8787/api/companion/health
```

**Fenster offen lassen.** Danach auf der Website im Live-Sync-Run auf
**„Lua-Sync verbinden"** klicken – der Companion startet BizHawk + ROM + Lua und
das Team erscheint live.

## Optionen (Umgebungsvariablen)

| Variable                     | Default                                  | Zweck                              |
|------------------------------|------------------------------------------|------------------------------------|
| `SOULLINK_COMPANION_PORT`    | `8787`                                   | Port des Companions                |
| `SOULLINK_ROOT`              | Repo-Wurzel (relativ zu dieser Datei)    | Basis für Pfad-Erkennung           |
| `SOULLINK_TEAM_FILE`         | `emulator/bizhawk/soullink_team.json`    | abweichender Pfad der Team-Datei   |

## Browser-Unterstützung

Der Zugriff `https://…vercel.app` → `http://127.0.0.1:8787` nutzt **Private
Network Access**. Unterstützt: **Chrome** und **Edge** (empfohlen). In Firefox /
Safari kann der Zugriff auf localhost von einer HTTPS-Seite blockiert sein – dort
funktioniert der lokale Dev-Modus (`npm run dev`) weiterhin wie gehabt.

## Verhältnis zum Dev-Server

* **Lokal entwickeln** (`npm run dev`): unverändert. Die Endpunkte kommen vom
  Vite-Plugin (gleiche Origin), der Companion wird **nicht** gebraucht.
* **Online** (Vercel): die Website spricht stattdessen den Companion auf
  `127.0.0.1:8787` an. Gleiche Endpunkte, gleiche Logik.

> `emulator/dev-sync-server/server.mjs` (Port 8787, nur `/api/emulator-sync`) ist
> der ältere reine Sync-Server. Der Companion ersetzt ihn für den Online-Einsatz
> und kann zusätzlich erkennen + starten.
