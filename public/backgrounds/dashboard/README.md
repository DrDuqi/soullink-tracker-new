# Dashboard-Hintergründe (zufällig)

Fertige 16:9-Artworks, die der Companion als Vollbild-Hintergrund hinter der UI anzeigt
(`background-size: cover`, zentriert, `no-repeat`, responsive). Beim Öffnen des Dashboards
bzw. App-Start wird **zufällig eines** der vorhandenen Bilder gewählt und bleibt für die
Ansicht gleich — **keine** Bindung an die Edition.

## So fügst du Bilder hinzu
1. Lege deine `.webp`-Artworks in **diesen Ordner** (`public/backgrounds/dashboard/`).
2. Trage die Dateinamen in **`manifest.json`** ein (das ist die Zufalls-Quelle), z. B.:
   ```json
   ["gengar.webp", "charizard.webp", "pikachu.webp"]
   ```
3. Fehlt ein im Manifest gelisteter Datei, wird sie automatisch übersprungen.
   Ist keine Datei vorhanden, wird `default.webp` genutzt.

Aktuell erwartet das Manifest: `gengar.webp`, `charizard.webp`, `pikachu.webp`
(plus optional `default.webp` als Fallback). Format: **WebP**, **16:9**, empfohlen
**2560×1440** (mind. 1920×1080).

Hinweis: Die hochgeladenen Bilder müssen manuell hier abgelegt werden (mit genau diesen
Dateinamen) — der Code bindet sie dann automatisch zufällig ein.
