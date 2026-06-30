# Dashboard-Hintergründe

Fertige 16:9-Artworks, die der Companion als Vollbild-Hintergrund hinter der UI anzeigt
(`background-size: cover`, zentriert, responsive, ohne Verzerrung). Lege die Dateien hier
ab — sie werden über `/backgrounds/dashboard/<name>.webp` ausgeliefert.

| Datei            | Wird verwendet für        |
|------------------|---------------------------|
| `default.webp`   | Fallback (immer nötig)    |
| `fire-red.webp`  | Pokémon Feuerrot          |
| `emerald.webp`   | Pokémon Smaragd           |
| `platinum.webp`  | Pokémon Platin            |

- Format: **WebP**, Seitenverhältnis **16:9**, empfohlen **2560×1440** (mind. 1920×1080).
- Fehlt die Edition-Datei, wird automatisch `default.webp` genutzt; fehlt auch diese,
  bleibt der dunkle Basis-Hintergrund sichtbar (kein Fehler).
- Weitere Editionen später: Datei ablegen + einen Eintrag in `EDITION_BG`
  (`src/components/AtmosphereBackground.tsx`) ergänzen.
