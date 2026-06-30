# Dashboard-Hintergründe (Datenbank 2.0)

Datengetriebenes Hintergrundsystem. Der Companion **scannt diesen Ordner automatisch**,
analysiert jedes neue Bild **einmal** (Helligkeit/Kontrast → passende Overlay-/Vignette-/
Panel-Werte) und persistiert die Werte. Bekannte Bilder werden nie erneut analysiert.

## Neues Bild hinzufügen (ohne Codeänderung)
1. `.webp` (empfohlen, 16:9, ~2560×1440) in **diesen Ordner** legen — fertig.
   Es wird automatisch erkannt, beim ersten Anzeigen analysiert und erscheint in der
   Galerie + im Zufallspool.
2. Optional: in `manifest.json` einen **Anzeigenamen/Tags** hinterlegen (sonst wird der
   Name aus dem Dateinamen abgeleitet):
   ```json
   [
     { "id": "gengar", "file": "gengar.webp", "name": "Gengar", "tags": ["ghost","dark"] }
   ]
   ```
   `manifest.json` ist nur ein Seed — Dateien ohne Eintrag werden trotzdem erkannt.

## Wo liegen die analysierten Werte?
Die berechneten `overlay`/`vignette`/`panelOpacity`/`brightness`/`contrast`/`tags` schreibt
der Companion in `…/SoulLink Companion/backgrounds.json` (userData, beschreibbar) — die
ausgelieferte `manifest.json` bleibt unberührt.

## Verhalten (Einstellungen → Darstellung → Hintergrund)
- **Zufällig** (alle / nur Favoriten) — beim App-Start eines wählen, Session über stabil,
  Re-Roll beim nächsten Start. **Bild auswählen** — Galerie mit Vorschau, Name, Favoriten-
  Stern, Hover-Zoom/Glow; Klick übernimmt sofort.
- Lesbarkeit pro Bild automatisch: helles Bild → stärkeres Overlay/Vignette/dunklere Glass-
  Panels; dunkles Bild → leichter. Darstellung: `cover`/`center`/`no-repeat`, vollbild,
  responsiv, ohne Verzerrung.

## Fallbacks
- `manifest.json` fehlt/kaputt → wird ignoriert + geloggt, Ordner-Scan trägt; ganz ohne
  Bilder → `default.webp`.
- Eintrag ohne Datei → übersprungen + Warnung. Die App läuft immer weiter.
