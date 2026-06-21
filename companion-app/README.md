# SoulLink Companion (Windows-App)

Eine eigenständige Windows-Anwendung, damit der Nutzer **nie ein Terminal** öffnen
oder `npm run companion` eingeben muss. Workflow wie Discord/Steam:

> **Installer ausführen → Companion startet automatisch im Hintergrund (Tray-Icon)
> → Website öffnen → „Lua-Sync verbinden" → fertig.**

Die App ist nur eine **Hülle** um den bestehenden, getesteten Companion: sie
importiert dieselbe `emulator/companion/server.mjs` und startet sie auf
`127.0.0.1:8787`. Die Website erkennt sie automatisch (kein Code-Unterschied zur
`npm run companion`-Variante).

## Funktionen
- **Tray-Icon** (kein Fenster, läuft im Hintergrund) mit Menü: *Status · Website
  öffnen · Mit Windows starten · Beenden*.
- **Optionaler Autostart** beim Windows-Login (Häkchen im Tray, jederzeit umstellbar).
- **Einzelinstanz** – ein zweiter Start meldet nur „läuft bereits".
- **Auto-Update** vorbereitet (electron-updater gegen GitHub Releases).
- **Lua wird mitgeliefert** und beim Start in einen beschreibbaren Ordner
  (`%APPDATA%/SoulLink Companion`) kopiert – der Nutzer sucht/kopiert nie etwas.

## Bauen

**Empfohlen (zuverlässig): per GitHub Actions.** Der Installer-Schritt von
electron-builder entpackt `winCodeSign`, das macOS-Symlinks enthält — das braucht
unter Windows das **Symlink-Recht** (Entwicklermodus oder Admin). CI-Runner haben
das, ein normaler Shell-Build nicht.

- **Actions-Tab → „Build SoulLink Companion" → Run workflow** → lädt den Installer
  als Artefakt hoch (kein Release).
- **Version-Tag `vX.Y.Z` pushen** → baut **und** veröffentlicht ein öffentliches
  GitHub Release mit angehängtem Installer (`SoulLink-Companion-Setup.exe`). Die
  App-Version wird automatisch aus dem Tag übernommen. Das ist die Quelle für den
  Website-Download (`releases/latest/download/…`) und die Auto-Updates.

```bash
git tag v1.0.0 && git push origin v1.0.0      # erstes Release
git tag v1.0.1 && git push origin v1.0.1      # jedes weitere Release
```

**Lokal bauen** (nur mit Symlink-Recht):
```bash
cd companion-app
npm install            # lädt Electron (einmalig groß)
npm run dist           # → dist/SoulLink Companion Setup <version>.exe
```
> Schlägt der lokale Build mit „Cannot create symbolic link" fehl: einmalig
> **Windows-Entwicklermodus** aktivieren (Einstellungen → Datenschutz & Sicherheit
> → Für Entwickler → Entwicklermodus AN) **oder** das Terminal als Administrator
> öffnen, dann `npm run dist` erneut. CI umgeht das komplett.

**Sofort nutzbar ohne Installer:** Der bereits gebaute Ordner
`dist/win-unpacked/` enthält `SoulLink Companion.exe` — direkt doppelklickbar
(läuft im Tray, alles gebündelt). Ideal zum Testen, bis der Installer via CI steht.

## Veröffentlichen / Updates (später, Phase 5)
- `npm run dist` lädt den Installer in `dist/`. Für **Auto-Updates** den Installer
  + `latest.yml` als **GitHub Release** unter `DrDuqi/soullink-tracker-new`
  hochladen (oder `electron-builder --publish always` mit `GH_TOKEN`).
- **Code-Signing** (Authenticode-Zertifikat) entfernt die Windows-SmartScreen-
  Warnung „Unbekannter Herausgeber". Bis dahin: „Weitere Informationen → Trotzdem
  ausführen". Zertifikat über `win.certificateFile`/`certificatePassword` einbinden.

## Architektur-Notiz
`main.cjs` setzt vor dem Start `SOULLINK_LUA` (beschreibbare Lua-Kopie) und
`SOULLINK_COMPANION_CONFIG` (gespeicherte Pfade in `userData`) und ruft dann
`startCompanion()` aus der gemeinsamen `server.mjs` auf. Dadurch bleibt die
Companion-Logik an **einer** Stelle.
