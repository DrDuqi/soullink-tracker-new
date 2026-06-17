# BizHawk Live-Sync (Prototyp)

Liest das Party-Team aus dem laufenden Spiel und gibt es als Konsole / JSON-Datei
/ HTTP-POST aus. **Keine** Supabase-Schreibzugriffe, **keine** ROM-/Save-Dateien.

## Voraussetzungen
- **BizHawk 2.8+** (Lua 5.4 / NLua — wegen nativer Bit-Operatoren & 64-bit Integer)
- Geladenes Spiel (zuerst: **Pokémon Platinum**, NDS-Core melonDS oder DeSmuME)

## Laden
1. BizHawk → **Tools → Lua Console**.
2. `Script → Open` → `emulator/bizhawk/soullink_sync.lua`.
3. Ausgabe erscheint je nach `CONFIG.output` in der Lua-Konsole, in
   `soullink_team.json` (neben der BizHawk-EXE) oder per HTTP.

## Einmaliger Setup: Party-Adresse finden  ⚠️ erforderlich
Die Party-Adresse ist **ROM-/Versions-spezifisch** und steht im Script bewusst
auf `nil`, damit keine falschen Werte vorgegaukelt werden. So findest du sie:

**Methode A — RAM Search über die KP (empfohlen, zuverlässig)**
1. Notiere die **aktuelle KP** deines ersten Team-Pokémon (z. B. 24).
2. BizHawk → **Tools → RAM Search**, Domain auf **Main RAM** (NDS) bzw.
   **System Bus** (GBA), Datentyp **2 Byte**.
3. Suche nach dem KP-Wert; ändere die KP im Spiel (Kampf/Heilung) und suche
   erneut (`Search`), bis nur noch wenige Adressen übrig sind. Das ist die
   Adresse der **aktuellen KP** von Slot 1 (`curHp`).
4. Party-Adresse berechnen:
   - **Gen 4 (Platinum/HGSS):** `party_addr = curHp_addr − 0x8E`
   - **Gen 3 (FireRed/Emerald):** `party_addr = curHp_addr − 0x56`
   - **Gen 5 (Black):** `party_addr = curHp_addr − 0x8E`
5. Trage den Wert als **Offset innerhalb der gewählten Domain** ins jeweilige
   Profil in `soullink_sync.lua` (`PROFILES.<spiel>.party_addr`) ein.

**Methode B — Verifikations-Dump**
- Setze `CONFIG.dump_test_addr` auf einen Kandidaten und lade das Script: es
  druckt die ersten 6 Slots (Spezies/Level/KP/Status). Sind die Werte plausibel
  → Adresse ins Profil übernehmen, `dump_test_addr = nil` setzen.

> Tipp: AR-/Cheat-Datenbanken listen die Party-Adresse je Region. NDS-Werte sind
> oft als Absolutadresse `0x02xxxxxx` angegeben → **Domain-Offset = Adresse − 0x02000000**.

## Output-Modi (`CONFIG.output`)
- `"console"` — nur Lua-Konsole (Phase 1, schnellster Test).
- `"file"` — schreibt `soullink_team.json` (Phase 1).
- `"http"` — POST an `CONFIG.http_url` (Phase 2). Benötigt eine BizHawk-Version
  mit `comm.httpPost`. Falls nicht verfügbar: `"file"` nutzen und die Datei vom
  Dev-Server lesen lassen, oder BizHawk-HTTP in den Einstellungen aktivieren.

## Domains
- **NDS (Platinum/HGSS/Black):** `Main RAM`
- **GBA (FireRed/Emerald):** `System Bus`
- Verfügbare Domains listet das Script beim Start, falls die gewählte fehlt.
