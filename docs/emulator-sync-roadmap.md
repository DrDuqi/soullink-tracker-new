# Emulator Live-Sync — Roadmap (Event-Erkennung)

Ziel: Der Nutzer lässt nur **BizHawk + Lua** laufen und sieht im Browser live,
was im Spiel passiert — irgendwann inkl. automatischer Encounter-/SoulLink-Logik.
Alles **additiv & nicht-destruktiv**; bestehende Encounters/SoulLinks/Team/Realtime
bleiben unangetastet, **keine** blinden DB-Writes 2×/s.

## Erledigt
- **Phase 1** — Auto-Detect der Spieler-Party (Save-Block-Count-Header), Datei-Sync,
  Live-Panel auf der Run-Seite, kein Flackern.
- **Phase 2** — Reichere Team-Daten: `moves`, `heldItem`, `ability`, `nature`
  (zuverlässig), `nickname` (best-effort), Anzeige im Panel. Unzuverlässige Werte
  (`metLocation`/`metLevel`) sind sauber `null` und dokumentiert.

## Phase 3 — Aktuelle Route erkennen
- **Daten:** aktuelle Karten-/Location-ID aus dem RAM (DPPt: „current map header"
  bzw. Location-Feld). ID → Name über eine **per-Edition Location-Tabelle**.
- **Mapping:** Location-Name auf die bestehenden `lib/routes.ts`-Namen abbilden.
- **Zu verifizieren:** RAM-Offset der aktuellen Map-ID (per RAM-Search, analog zur
  Party); vollständige Map-ID→Name-Tabelle für Platinum (später weitere Editionen).
- **Output:** Feld `location` im JSON (zusätzlich zum Team).

## Phase 4 — Wilden Encounter erkennen
- **Daten:** Battle-Status-Flag + Battle-Typ (wild vs. Trainer) aus dem RAM.
  Die Gegner-Party (Slot 0 = wildes Pokémon) ist im selben 236-Byte-Format lesbar
  (der Scanner findet sie bereits; sie ist nur **nicht** count-verankert → so sauber
  vom Spieler trennbar).
- **Logik:** Übergang „kein Kampf → wilder Kampf" → Event `wild_encounter`
  { speciesId, level, location } (Route aus Phase 3).
- **Zu verifizieren:** RAM-Offsets für Battle-Flag/-Typ; Adresse der Gegner-Party
  (oder Heuristik „nicht-verankerter gültiger Run").

## Phase 5 — Fang / Besiegt erkennen
- **Daten:** Party-Count + Box-Belegung beobachten.
- **Logik:** nach einem wilden Kampf:
  - Party-Count **+1** oder neuer Box-Eintrag der wilden Spezies → `caught`.
  - Kampf endet ohne neuen Eintrag, Gegner-KP = 0 → `defeated`; sonst `fled`.
- **Output:** Event `encounter_result` { speciesId, location, result }.
- **Hinweis:** rein lesend; die App entscheidet, ob daraus ein Encounter angelegt
  wird (bewusste Aktion / Bestätigung), **kein** automatischer Dauer-Write.

## Phase 6 — Automatischer SoulLink-Vorschlag (mit Partnerdaten)
- **Voraussetzung:** Phase 3–5 + beide Spieler online (bestehendes Realtime/Request-System).
- **Logik:** Erkennt die App für **dieselbe Route** je einen frischen Encounter bei
  beiden Spielern, schlägt sie einen SoulLink vor (Vorbefüllung des bestehenden
  `link`-Requests — der Partner bestätigt wie gewohnt). Routen-Match nutzt die
  vorhandene `route_match_type`-Logik.
- **Nicht-destruktiv:** nur ein **Vorschlag** + bestehender Bestätigungs-Flow;
  nichts wird automatisch verlinkt oder überschrieben.

## Technische Leitplanken
- **RAM-Offsets** werden wie bei der Party über Prüf-/Anker-Merkmale oder RAM-Search
  verifiziert — keine hartkodierten Rate-Werte ohne Validierung.
- **Transport:** weiterhin lokale Datei + Dev-Endpoint; für Produktion/Partner-Sync
  später Supabase (`migration_v11_emulator_sync.sql`, bereits vorbereitet) mit RLS &
  **debounced** Writes nur bei echten Zustandswechseln (nicht 2×/s).
- **Mehrere Editionen:** `PROFILES`/Tabellen pro Spiel erweitern (FireRed/Emerald/
  HeartGold/Black), Frontend bleibt spielagnostisch.
