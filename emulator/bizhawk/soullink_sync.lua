--[[============================================================================
  SoulLink Tracker — BizHawk Emulator Live-Sync  (Pokémon Platinum / NDS)

  VOLLAUTOMATISCH: findet die Party-Adresse selbst (Speicher-Scan + Prüfsummen-
  Validierung), liest das Team und sendet es per HTTP an die Website. Keine
  manuelle RAM-Suche, keine Eingaben. KEINE ROM-/Save-Dateien, KEINE Supabase.

  Ablauf: BizHawk → Platinum laden → dieses Script in der Lua Console starten.
          Es scannt automatisch, findet das Team und sendet es live.

  Voraussetzung: BizHawk 2.8+ (Lua 5.4 / NLua — native Bit-Operatoren).
============================================================================]]--

local CONFIG = {
  game            = "platinum",
  output          = "http",        -- "http" (Website) | "file" | "console"
  http_url        = "http://localhost:5173/api/emulator-sync",
  file_path       = "soullink_team.json",
  interval_frames = 30,            -- ~2x pro Sekunde
  trainer_name    = "Trainer",
  scan_chunk      = 0x20000,       -- Bytes pro Frame beim Auto-Scan (Performance)
}

-- Gen-4 Block-Reihenfolge (Permutation per ((PID>>13)&0x1F)%24)
local ORDERS = {
  "ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC",
  "BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA",
  "CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA",
}

local PROFILES = {
  platinum  = { gen = 4, domain = "Main RAM", mon_size = 236, max_species = 493, party_addr = nil },
  heartgold = { gen = 4, domain = "Main RAM", mon_size = 236, max_species = 493, party_addr = nil },
}

local STATUS_BITS = { [0x08]="psn", [0x10]="brn", [0x20]="frz", [0x40]="par", [0x80]="tox" }
local function statusToStr(w)
  if (w & 0x07) ~= 0 then return "slp" end
  for bit, name in pairs(STATUS_BITS) do if (w & bit) ~= 0 then return name end end
  return "ok"
end

-- ── Byte-Array-Helfer (1-indiziert; off = 0-basierter Byte-Offset) ──────────
local function u16(a, off) return a[off + 1] + a[off + 2] * 0x100 end
local function u32(a, off) return a[off + 1] + a[off + 2] * 0x100 + a[off + 3] * 0x10000 + a[off + 4] * 0x1000000 end

-- Validiert einen Gen-4-Party-Mon ab Array-Offset o. Nutzt die Prüfsumme als
-- starken Filter → praktisch keine Fehltreffer. Gibt Mon-Tabelle oder nil.
local function validateGen4(a, o, maxSpecies)
  local pid = u32(a, o)
  if pid == 0 then return nil end
  local storedChk = u16(a, o + 6)

  -- Hauptblöcke (0x08..0x87): 64 Words entschlüsseln (Seed = Checksumme) + summieren
  local seed = storedChk
  local words = {}
  local sum = 0
  for i = 0, 63 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    local key = (seed >> 16) & 0xFFFF
    local w = u16(a, o + 8 + i * 2) ~ key
    words[i] = w
    sum = (sum + w) & 0xFFFF
  end
  if sum ~= storedChk then return nil end                 -- ← starker Prüfsummen-Filter

  local order = ((pid >> 13) & 0x1F) % 24
  local posA = ORDERS[order + 1]:find("A") - 1
  local species = words[posA * 16]
  if species < 1 or species > maxSpecies then return nil end

  -- Party-Block (0x88..): Seed = PID
  seed = pid
  local pd = {}
  for i = 0, 4 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    local key = (seed >> 16) & 0xFFFF
    pd[i] = u16(a, o + 0x88 + i * 2) ~ key
  end
  local level, curHp, maxHp = pd[2] & 0xFF, pd[3], pd[4]
  if level < 1 or level > 100 then return nil end
  if maxHp < 1 or maxHp > 1000 or curHp > maxHp then return nil end

  return { speciesId = species, level = level, hp = curHp, maxHp = maxHp,
           status = statusToStr(pd[0]), fainted = (curHp == 0) }
end

-- ── Auto-Detect: Speicher in Frame-Chunks scannen ───────────────────────────
local DET = { running = false, base = 0, found = {}, size = 0 }

local function detectStart(profile)
  DET.running = true; DET.base = 0; DET.found = {}
  DET.size = memory.getmemorydomainsize(profile.domain)
  console.log(string.format("[scan] Suche Party automatisch … (%d KB)", DET.size // 1024))
end

-- Liest einen Chunk und prüft jeden 4-Byte-Offset. Gibt true zurück wenn fertig.
local function detectStep(profile)
  local chunkLen = math.min(CONFIG.scan_chunk, DET.size - DET.base)
  if chunkLen <= 0 then return true end
  -- + mon_size Überlappung, damit ein an der Chunk-Grenze beginnender Mon komplett ist
  local readLen = math.min(chunkLen + profile.mon_size, DET.size - DET.base)
  local arr = memory.read_bytes_as_array(DET.base, readLen, profile.domain)
  for o = 0, chunkLen - 1, 4 do
    local mon = validateGen4(arr, o, profile.max_species)
    if mon then DET.found[#DET.found + 1] = { addr = DET.base + o, hp = mon.hp } end
  end
  DET.base = DET.base + chunkLen
  return DET.base >= DET.size
end

-- Wählt aus allen gefundenen Mons den längsten zusammenhängenden Party-Lauf
-- (Abstand = mon_size). Setzt profile.party_addr.
local function detectFinish(profile)
  DET.running = false
  table.sort(DET.found, function(x, y) return x.addr < y.addr end)
  local best, bestLen, bestHp = nil, 0, 0
  local i = 1
  while i <= #DET.found do
    local j = i
    while j + 1 <= #DET.found and (DET.found[j + 1].addr - DET.found[j].addr) == profile.mon_size do j = j + 1 end
    local len = j - i + 1
    if len > bestLen or (len == bestLen and DET.found[i].hp > bestHp) then
      best, bestLen, bestHp = DET.found[i].addr, len, DET.found[i].hp
    end
    i = j + 1
  end
  if best then
    profile.party_addr = best
    console.log(string.format("[scan] ✓ Party gefunden @ 0x%X · %d Pokémon", best, bestLen))
    local f = io.open("soullink_party_addr.txt", "w")
    if f then f:write(string.format("%s party_addr = 0x%X (team %d)\n", CONFIG.game, best, bestLen)); f:close() end
  else
    console.log("[scan] Kein Team gefunden — läuft das Spiel mit einem Pokémon im Team? Neuer Versuch in Kürze.")
  end
end

-- ── Sync-Phase: Mon direkt aus dem Speicher lesen ───────────────────────────
local function readMon(profile, slot)
  local base = profile.party_addr + slot * profile.mon_size
  local arr = memory.read_bytes_as_array(base, profile.mon_size, profile.domain)
  return validateGen4(arr, 0, profile.max_species)
end

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
  return #parts, string.format(
    '{"game":"%s","trainer":"%s","capturedAt":%d,"team":[%s]}',
    CONFIG.game, CONFIG.trainer_name, os.time() * 1000, table.concat(parts, ","))
end

local httpWarned = false
local function emit(json)
  -- Backup-Datei immer schreiben
  local f = io.open(CONFIG.file_path, "w"); if f then f:write(json); f:close() end
  if CONFIG.output == "console" then console.log(json); return end
  if CONFIG.output ~= "http" then return end
  local ok = pcall(function()
    if comm.httpSetPostUrl then pcall(comm.httpSetPostUrl, CONFIG.http_url) end
    local sent = pcall(comm.httpPost, CONFIG.http_url, json)   -- httpPost(url, payload)
    if not sent then comm.httpPost(json) end                   -- ältere Signatur: httpPost(payload)
  end)
  if not ok and not httpWarned then
    httpWarned = true
    console.log("[sync] comm.httpPost nicht verfügbar — Daten liegen in " .. CONFIG.file_path)
  end
end

-- ── Init + Loop ─────────────────────────────────────────────────────────────
local profile = PROFILES[CONFIG.game]
assert(profile, "Unbekanntes Spiel: " .. tostring(CONFIG.game))
pcall(function() memory.usememorydomain(profile.domain) end)

console.log("SoulLink Sync gestartet · Spiel=" .. CONFIG.game .. " · Output=" .. CONFIG.output)
detectStart(profile)

local frame = 0
while true do
  if DET.running then
    -- Auto-Scan über mehrere Frames verteilt (Emulator bleibt bedienbar)
    if detectStep(profile) then detectFinish(profile) end
  elseif not profile.party_addr then
    -- nichts gefunden → in 2 s erneut scannen (z.B. Team war noch leer)
    if frame % 120 == 0 then detectStart(profile) end
  else
    if frame % CONFIG.interval_frames == 0 then
      -- Validieren: bei Save-Block-Wechsel (DPPt) wird die Adresse ungültig → neu scannen
      if readMon(profile, 0) then
        local _, json = buildJson(profile)
        emit(json)
      else
        console.log("[sync] Party-Adresse ungültig (Save-Block-Wechsel?) — scanne neu …")
        profile.party_addr = nil
        detectStart(profile)
      end
    end
  end
  frame = frame + 1
  emu.frameadvance()
end
