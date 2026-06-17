# Emulator Live-Sync — Technisches Konzept

Optionaler zweiter Eingabemodus neben der **manuellen Eingabe**. Sicher, additiv,
schrittweise. Nichts Bestehendes wird verändert.

## 1. Architektur & Datenfluss (3 Phasen)

```
  BizHawk (EmuHawk)                Dev-Endpoint                 Frontend
  ┌────────────────┐   JSON POST   ┌──────────────────┐  poll   ┌────────────────┐
  │ soullink_sync  │ ───────────►  │ /api/emulator-   │ ◄────── │ /emulator-sync │
  │ .lua           │  (1x/Sek.)    │ sync (in-memory) │  GET    │ Testanzeige    │
  └────────────────┘               └──────────────────┘         └────────────────┘
        Phase 1: console/file            Phase 2                    Phase 2
                                                       Phase 3 ► Supabase (emulator_live, RLS, Realtime)
```

- **Phase 1:** Lua liest die Party, gibt sie in der Konsole oder als
  `soullink_team.json` aus. *Keine* Netzwerk-/DB-Zugriffe.
- **Phase 2:** Lua sendet die JSON per HTTP an einen **lokalen** Endpoint
  (`/api/emulator-sync`, dev-only Vite-Middleware – nur bei `npm run dev`, nicht
  im Build). Das Frontend pollt den Endpoint und zeigt Status + letztes Team.
- **Phase 3 (vorbereitet, nicht aktiv):** Statt/zusätzlich zum lokalen Endpoint
  schreibt ein eingeloggter Nutzer seinen Snapshot nach Supabase
  (`emulator_live`), abgesichert per RLS; der Partner erhält ihn via Realtime.

## 2. Datei-/Ordnerstruktur

| Pfad | Phase | Zweck |
| --- | --- | --- |
| `emulator/bizhawk/soullink_sync.lua` | 1/2 | Lua-Prototyp (Party auslesen, console/file/http) |
| `emulator/bizhawk/README.md` | 1 | BizHawk-Setup, Party-Adresse finden |
| `emulator/dev-sync-server/server.mjs` | 2 | Standalone-Endpoint (Alternative zum Vite-Plugin) |
| `vite.config.ts` → `emulatorSyncPlugin()` | 2 | dev-only `/api/emulator-sync` (POST speichert, GET liefert) |
| `src/lib/emulatorSync.ts` | 2 | gemeinsame TS-Typen (`EmulatorPayload`, …) |
| `src/pages/EmulatorSyncTest.tsx` | 2 | Frontend-Testanzeige, Route `/emulator-sync` |
| `docs/emulator-sync-concept.md` | – | dieses Dokument |
| `supabase/migration_v11_emulator_sync.sql` | 3 | vorbereitete Tabelle + RLS + Realtime (**nicht ausführen**) |

## 3. BizHawk-NDS-Speicherzugriff (geprüft)

- BizHawk unterstützt NDS-Speicher sauber über die **`memory`**-Lua-API:
  `memory.usememorydomain(name)`, `memory.read_u16_le`, `memory.read_u32_le`,
  `memory.readbyte`, `memory.getmemorydomainlist()`.
- Relevante Domain für DS: **`Main RAM`** (4 MB ARM9-WRAM, Basis `0x02000000`).
  Adressen werden als **Offset innerhalb der Domain** gelesen
  (`Domain-Offset = Absolutadresse − 0x02000000`).
- GBA (FireRed/Emerald): Domain **`System Bus`** (oder `EWRAM`/`IWRAM`).
- **Bit-Operatoren & 64-bit Integer:** Das Script nutzt native `& | ~ << >>`
  → benötigt **BizHawk 2.8+ mit Lua 5.4 (NLua)**.

## 4. Pokémon-Datenstruktur & Offsets (Generationsunterschiede)

Die Party liegt als Array von `mon_size`-Byte-Blöcken im RAM.

| Gen | Spiele | `mon_size` | Spezies | Party-Daten (Level/KP/Status) | Block-Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| 3 | FireRed, Emerald | 100 B | im Growth-Block (XOR `PID^OTID`) | **unverschlüsselt** ab `0x50` | `PID % 24` |
| 4 | Platinum, HeartGold | 236 B | Growth-Block (LCG, Seed = Checksumme) | **verschlüsselt** (LCG, Seed = PID) ab `0x88` | `((PID>>13)&0x1F) % 24` |
| 5 | Black/White | 220 B | wie Gen 4 | wie Gen 4 | wie Gen 4 |

**Platinum (Gen 4) konkret** — pro Mon ab `base`:
- `0x00` PID (u32), `0x06` Checksumme (u16)
- `0x08..0x87` = 4 Blöcke (Growth/Attacks/EVs/Misc) à 32 B, **LCG-verschlüsselt**
  (Seed = Checksumme), Reihenfolge per `((PID>>13)&0x1F)%24`.
  → **Spezies** = erstes u16 des Growth-Blocks.
- `0x88..` Party-Block, **LCG-verschlüsselt** (Seed = PID):
  `0x88` Status (u32) · `0x8C` Level · `0x8E` aktuelle KP · `0x90` max. KP.

Die LCG-Entschlüsselung (`seed = seed*0x41C64E6D + 0x6073; key = seed>>16`) ist in
`soullink_sync.lua` für Gen 3/4(/5) implementiert.

> **Party-Adresse (`party_addr`)**: wird **automatisch erkannt** — kein manuelles
> RAM-Suchen. Das Script scannt `Main RAM` in Frame-Häppchen und akzeptiert einen
> Kandidaten nur, wenn die **Pokémon-Prüfsumme** stimmt (starker Filter) plus
> Spezies/Level/KP plausibel sind; die Party ist der längste zusammenhängende
> 236-Byte-Lauf gültiger Mons. Bei DPPt-Save-Block-Wechsel wird automatisch neu
> gescannt. Details siehe `emulator/bizhawk/README.md`.

## 5. Mehrere Spiele unterstützen

`PROFILES` in der Lua mappt `game → { gen, domain, party_addr, mon_size, max_species }`.
Neues Spiel = neuer Profil-Eintrag + verifizierte Adresse. Vorbereitet:
- **FireRed / Emerald** (Gen 3, GBA, `System Bus`)
- **Platinum / HeartGold** (Gen 4, NDS, `Main RAM`)
- **Black** (Gen 5, NDS — wie Gen 4, andere `mon_size`/Charmap/Adresse)

Frontend ist spielagnostisch: es nutzt die `speciesId` (Sprites/Namen via
bestehende `pokemon-api`).

## 6. Zuverlässigkeit — was sicher ist, was geprüft werden muss

**Zuverlässig lesbar (nach korrekter `party_addr`):**
- Spezies-ID, Level, aktuelle/maximale KP, Status, „kampfunfähig" (KP=0).
- Entschlüsselung & Blockreihenfolge sind deterministisch/standardisiert.

**Noch zu verifizieren / spielabhängig:**
- **`party_addr`**: jetzt **automatisch** (Prüfsummen-Scan) — kein manueller Schritt mehr.
- **Spielername**: separater RAM-Bereich + Gen-spezifische Zeichentabelle →
  aktuell `CONFIG.trainer_name` manuell; RAM-Auslesen als TODO markiert.
- **`comm.httpPost`** Verfügbarkeit je BizHawk-Build → sonst `output="file"`.
- **Gen 5 (Black)** `mon_size`/Charmap final prüfen, sobald aktiv getestet.
- Spezies-IDs aus **randomized** ROMs sind weiterhin gültige Dex-IDs (Randomizer
  verschiebt die Party-RAM-Struktur nicht).

## 7. Sicherheit (Phase 3)
- Nur **eingeloggte** Nutzer schreiben, und nur ihre **eigene** Zeile
  (`user_id = auth.uid()` + `is_run_member(run_id)`), siehe `migration_v11`.
- **Keine** ROM-/Save-Dateien — ausschließlich Spielstatus-Felder.
- Lesen offen (wie übrige Tabellen) → Realtime bleibt unverändert stabil.
- Manuelle Eingabe bleibt voll funktionsfähig; Live-Sync ist **optional**.
