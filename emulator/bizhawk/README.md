# BizHawk Live-Sync — Pokémon Platinum (vollautomatisch)

Liest das Party-Team aus dem laufenden Spiel und sendet es live an die Website.
**Keine** manuelle RAM-Suche, **keine** Eingaben. **Keine** ROM-/Save-Dateien.

## Voraussetzungen
- **BizHawk 2.8+** (Lua 5.4 / NLua — native Bit-Operatoren)
- **Pokémon Platinum** geladen (NDS-Core melonDS oder DeSmuME)

## Ablauf (ohne manuelle Schritte, ohne Startparameter)
Übertragung erfolgt **datei-basiert** — das funktioniert mit BizHawk 2.11.x
**ohne** Kommandozeile/HTTP-Init. Das Script schreibt `soullink_team.json`
direkt **neben sich** (`emulator/bizhawk/`); der Dev-Server liest genau diese
Datei. Keine Pfad-Einrichtung nötig.

1. Website-Dev-Server starten: `npm run dev`.
2. Browser: `http://localhost:5173/emulator-sync` öffnen.
3. BizHawk → Platinum laden → **Tools → Lua Console** → `Script → Open` →
   `emulator/bizhawk/soullink_sync.lua` (aus diesem Repo-Ordner laden!).
4. Das Script meldet:
   ```
   SoulLink Sync gestartet · Spiel=platinum · Output=file
   [sync] Schreibe Team nach: …\emulator\bizhawk\soullink_team.json
   [scan] Suche Party automatisch ... (4096 KB)
   [scan] OK Party gefunden @ 0x???? · N Pokemon
   ```
   Danach erscheint das Team automatisch auf der Website („Live Sync verbunden").

> **Wichtig:** Lade die `.lua` aus dem Repo-Ordner `emulator/bizhawk/` (nicht
> kopieren), damit die JSON dort landet, wo der Dev-Server sie sucht. Falls du
> sie woanders ablegst: starte den Dev-Server mit `SOULLINK_TEAM_FILE=<pfad>`
> oder setze `CONFIG.file_path` im Script auf einen absoluten Pfad.

### HTTP (optional, neuere Setups)
`comm.httpPost` verlangt in BizHawk 2.11.x einen Startparameter (`--url_post`)
— daher ist **`output = "file"` der Standard**. Wer HTTP bewusst aktiviert hat,
kann `CONFIG.output = "http"` setzen; andernfalls bei `"file"` bleiben.

> Damit der Scan etwas findet, muss **mindestens ein Pokémon im Team** sein
> (am Spielanfang nach Erhalt des Starters). Ist das Team noch leer, scannt das
> Script alle 2 Sekunden erneut.

## Wie die automatische Erkennung funktioniert
Gen-4-Party-Daten sind im RAM verschlüsselt, aber jedes Pokémon trägt eine
**Prüfsumme**. Das Script scannt die Domain `Main RAM` in Frame-Häppchen,
entschlüsselt jeden Kandidaten und akzeptiert ihn nur, wenn

- die **Prüfsumme** stimmt (starker Filter → praktisch keine Fehltreffer),
- **Spezies** 1–493, **Level** 1–100, **0 < max. KP ≤ 1000**, aktuelle KP ≤ max. KP.

Aus allen Treffern wird der längste **zusammenhängende** Lauf (Abstand =
236 Byte) als Party gewählt und die Adresse gesetzt — und in
`soullink_party_addr.txt` notiert (nur zur Info).

DPPt wechselt beim Speichern den aktiven Save-Block, wodurch die Adresse
wandern kann. Das Script erkennt das (Validierung schlägt fehl) und **scannt
automatisch neu** — kein manueller Eingriff nötig.

## Output-Modi (`CONFIG.output`)
- `"http"` *(Standard)* — sendet an `CONFIG.http_url` (Website). Schreibt
  zusätzlich `soullink_team.json` als Backup.
- `"file"` — nur `soullink_team.json`.
- `"console"` — nur Lua-Konsole.

Falls `comm.httpPost` in deiner BizHawk-Version fehlt, meldet das Script dies
einmalig; die Daten liegen dann weiterhin in `soullink_team.json`.

## Weitere Spiele
`PROFILES` in `soullink_sync.lua` ist auf Platinum/HeartGold (Gen 4)
vorbereitet. Andere Editionen folgen nach Abschluss von Platinum.
