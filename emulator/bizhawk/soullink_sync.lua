--[[============================================================================
  SoulLink Tracker — BizHawk Emulator Live-Sync (PROTOTYP)
  Phase 1/2: liest das Party-Team aus und gibt es als Konsole / JSON-Datei /
  HTTP-POST aus. KEINE Supabase-Schreibzugriffe.

  Voraussetzungen:
    * BizHawk 2.8+ (Lua 5.4 / NLua — native Bit-Operatoren & 64-bit Integer)
    * Geladenes Spiel (zuerst: Pokémon Platinum, Nintendo DS)

  WICHTIG — einmaliger Setup-Schritt:
    Die Party-Adresse (party_addr) ist ROM-/Versions-spezifisch und muss
    EINMAL verifiziert werden (siehe emulator/bizhawk/README.md → "Adresse
    finden"). Setze unten CONFIG.dump_test_addr, prüfe die Konsolen-Ausgabe,
    trage den korrekten Wert ins jeweilige Profil ein und setze dump_test_addr
    wieder auf nil.
============================================================================]]--

local CONFIG = {
  game            = "platinum",   -- siehe PROFILES
  output          = "file",        -- "console" | "file" | "http"
  http_url        = "http://localhost:5173/api/emulator-sync",
  file_path       = "soullink_team.json",
  interval_frames = 60,            -- ~1x pro Sekunde bei 60 FPS
  trainer_name    = "Trainer",     -- optional manuell; RAM-Auslesen siehe README
  dump_test_addr  = nil,           -- z.B. 0x000C9E2C → einmaliger Verifikations-Dump
}

-- Gen-IV Block-Reihenfolge (Permutation per ((PID>>13)&0x1F)%24)
local ORDERS = {
  "ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC",
  "BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA",
  "CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA",
}

-- Per-Spiel-Profile. mon_size + Verschlüsselung hängen von der Generation ab.
-- Gen 3 (FRLG/Emerald): 100 Bytes, Party-Daten (Level/KP/Status) UNVERSCHLÜSSELT.
-- Gen 4/5 (Pt/HGSS/Black): 236 Bytes, Party-Block PID-verschlüsselt.
local PROFILES = {
  platinum  = { gen = 4, domain = "Main RAM", party_addr = nil, mon_size = 236, max_species = 493 },
  heartgold = { gen = 4, domain = "Main RAM", party_addr = nil, mon_size = 236, max_species = 493 },
  black     = { gen = 5, domain = "Main RAM", party_addr = nil, mon_size = 220, max_species = 649 },
  firered   = { gen = 3, domain = "System Bus", party_addr = nil, mon_size = 100, max_species = 386 },
  emerald   = { gen = 3, domain = "System Bus", party_addr = nil, mon_size = 100, max_species = 386 },
}

local STATUS_BITS = { [0x08]="psn", [0x10]="brn", [0x20]="frz", [0x40]="par", [0x80]="tox" }

local function statusToStr(word)
  if (word & 0x07) ~= 0 then return "slp" end      -- Schlaf-Counter (Bits 0-2)
  for bit, name in pairs(STATUS_BITS) do
    if (word & bit) ~= 0 then return name end
  end
  return "ok"
end

-- LCG-PRNG (Gen 3-5): seed = seed*0x41C64E6D + 0x6073 ; key = (seed>>16)&0xFFFF
local function nextKey(seed)
  seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
  return seed, (seed >> 16) & 0xFFFF
end

-- Liest u16-Words und entschlüsselt sie als zusammenhängenden Stream.
local function readDecryptedWords(addr, count, seed)
  local out = {}
  local key
  for i = 0, count - 1 do
    seed, key = nextKey(seed)
    out[i] = memory.read_u16_le(addr + i * 2) ~ key
  end
  return out
end

-- ── Gen 4/5 ───────────────────────────────────────────────────────────────
local function readMonGen45(base, maxSpecies)
  local pid = memory.read_u32_le(base + 0x00)
  local chk = memory.read_u16_le(base + 0x06)
  if pid == 0 then return nil end

  -- Hauptblöcke (0x08..0x87): 64 Words, Seed = Checksumme
  local blocks = readDecryptedWords(base + 0x08, 64, chk)
  local order  = ((pid >> 13) & 0x1F) % 24
  local ord    = ORDERS[order + 1]
  local posA   = ord:find("A") - 1                 -- 0-basierte Blockposition
  local species = blocks[posA * 16 + 0]            -- Block A (Growth), Word 0
  if species == 0 or species > maxSpecies then return nil end

  -- Party-Block (0x88..): Seed = PID
  local pdata = readDecryptedWords(base + 0x88, 6, pid)
  local status = pdata[0]                           -- 0x88 (u32, Status in Low-Bits)
  local level  = pdata[2] & 0xFF                    -- 0x8C
  local curHp  = pdata[3]                           -- 0x8E
  local maxHp  = pdata[4]                           -- 0x90
  if level < 1 or level > 100 then return nil end

  return { speciesId = species, level = level, hp = curHp, maxHp = maxHp,
           status = statusToStr(status), fainted = (curHp == 0) }
end

-- ── Gen 3 (FRLG/Emerald): Party-Daten unverschlüsselt, nur Spezies im Block ──
local function readMonGen3(base, maxSpecies)
  local pid  = memory.read_u32_le(base + 0x00)
  local otid = memory.read_u32_le(base + 0x04)
  if pid == 0 then return nil end
  local key  = pid ~ otid

  -- 4 Blöcke à 12 Bytes ab 0x20, XOR-Key = PID^OTID, Reihenfolge per PID%24
  local order = pid % 24
  local ord   = ORDERS[order + 1]
  local posG  = ord:find("A") - 1                   -- Growth-Block
  local gAddr = base + 0x20 + posG * 12
  local species = memory.read_u16_le(gAddr + 0) ~ (key & 0xFFFF)
  if species == 0 or species > maxSpecies then return nil end

  -- Party-Daten (unverschlüsselt) ab 0x50: 0x54 Level, 0x56 curHP, 0x58 maxHP, 0x50 Status
  local status = memory.read_u32_le(base + 0x50)
  local level  = memory.readbyte(base + 0x54)
  local curHp  = memory.read_u16_le(base + 0x56)
  local maxHp  = memory.read_u16_le(base + 0x58)
  if level < 1 or level > 100 then return nil end

  return { speciesId = species, level = level, hp = curHp, maxHp = maxHp,
           status = statusToStr(status), fainted = (curHp == 0) }
end

local function readMon(profile, slot)
  local base = profile.party_addr + slot * profile.mon_size
  if profile.gen == 3 then return readMonGen3(base, profile.max_species)
  else return readMonGen45(base, profile.max_species) end
end

-- ── JSON (flach, kein externes Lib nötig) ───────────────────────────────────
local function buildJson(profile)
  local parts = {}
  for slot = 0, 5 do
    local m = readMon(profile, slot)
    if m then
      parts[#parts + 1] = string.format(
        '{"slot":%d,"speciesId":%d,"level":%d,"hp":%d,"maxHp":%d,"status":"%s","fainted":%s}',
        slot + 1, m.speciesId, m.level, m.hp, m.maxHp, m.status, tostring(m.fainted))
    end
  end
  return string.format(
    '{"game":"%s","trainer":"%s","capturedAt":%d,"team":[%s]}',
    CONFIG.game, CONFIG.trainer_name, os.time() * 1000, table.concat(parts, ","))
end

local function emit(json)
  if CONFIG.output == "console" then
    console.log(json)
  elseif CONFIG.output == "file" then
    local f = io.open(CONFIG.file_path, "w"); if f then f:write(json); f:close() end
  elseif CONFIG.output == "http" then
    -- comm.httpPost benötigt BizHawk mit aktiviertem HTTP (siehe README)
    local ok = pcall(function() comm.httpPost(CONFIG.http_url, json) end)
    if not ok then console.log("[sync] httpPost fehlgeschlagen — siehe README") end
  end
end

-- ── Verifikations-Dump (einmalig zum Finden/Prüfen der Adresse) ─────────────
local function dumpTest(profile, addr)
  console.log("── Adress-Test @ " .. string.format("0x%X", addr) .. " ──")
  local saved = profile.party_addr
  profile.party_addr = addr
  for slot = 0, 5 do
    local m = readMon(profile, slot)
    if m then
      console.log(string.format("Slot %d: #%d Lv%d KP %d/%d %s",
        slot + 1, m.speciesId, m.level, m.hp, m.maxHp, m.status))
    else
      console.log("Slot " .. (slot + 1) .. ": (leer/ungültig)")
    end
  end
  profile.party_addr = saved
  console.log("Wenn die Werte plausibel sind: party_addr im Profil eintragen, dump_test_addr = nil setzen.")
end

-- ── Init ────────────────────────────────────────────────────────────────────
local profile = PROFILES[CONFIG.game]
assert(profile, "Unbekanntes Spiel: " .. tostring(CONFIG.game))

local ok = pcall(function() memory.usememorydomain(profile.domain) end)
if not ok then
  console.log("[sync] Memory-Domain '" .. profile.domain .. "' nicht verfügbar.")
  console.log("[sync] Verfügbare Domains: " .. table.concat(memory.getmemorydomainlist(), ", "))
end

console.log("SoulLink Sync gestartet · Spiel=" .. CONFIG.game .. " · Output=" .. CONFIG.output)

if CONFIG.dump_test_addr then
  dumpTest(profile, CONFIG.dump_test_addr)
end

if not profile.party_addr then
  console.log("[sync] party_addr ist nicht gesetzt. Bitte zuerst verifizieren (README → 'Adresse finden').")
end

-- ── Loop ────────────────────────────────────────────────────────────────────
local frame = 0
while true do
  if profile.party_addr and (frame % CONFIG.interval_frames == 0) then
    local okRun, json = pcall(buildJson, profile)
    if okRun then emit(json) end
  end
  frame = frame + 1
  emu.frameadvance()
end
