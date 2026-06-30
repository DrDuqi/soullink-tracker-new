# Dashboard-Hintergründe

Die komplette Hintergrund-Galerie des Companions wird **ausschließlich** aus diesem Ordner
+ `manifest.json` erzeugt. Es ist **nichts** im Code fest verdrahtet — neue Bilder
erscheinen automatisch in der Galerie, im Zufallsmodus und sind auswählbar.

## Neues Bild hinzufügen (ohne Codeänderung)
1. `.webp` (empfohlen, 16:9, ~2560×1440) in **diesen Ordner** legen.
2. Dateinamen in **`manifest.json`** eintragen:
   ```json
   ["artwork01.webp", "artwork02.webp", "gengar.webp", "..."]
   ```
3. Fertig. Das Bild ist sofort in **Einstellungen → Darstellung → Hintergrund** verfügbar.

- Eine im Manifest gelistete, aber fehlende Datei wird automatisch übersprungen.
- `default.webp` ist optional (letzter Fallback, falls eine Datei fehlt).

## Verhalten (in den Einstellungen wählbar)
- **Zufällig** — beim App-Start wird genau ein Bild zufällig gewählt und bleibt die
  ganze Sitzung gleich (optional nur aus Favoriten). Re-Roll erst beim nächsten App-Start.
- **Bild auswählen** — Galerie mit Vorschau/Hover/Glow; Klick übernimmt das Bild sofort.
- **Favoriten** — pro Bild mit dem Stern markierbar; der Zufallsmodus kann auf Favoriten
  beschränkt werden.

Darstellung: `cover` / `center` / `no-repeat`, vollbild, responsiv, ~50 % dunkles
Overlay + dezente Vignette; das Glassmorphism der Panels bleibt unverändert.
