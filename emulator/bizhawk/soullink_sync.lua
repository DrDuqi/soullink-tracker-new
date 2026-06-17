--[[============================================================================
  SoulLink Tracker — BizHawk Emulator Live-Sync  (Pokémon Platinum / NDS)

  VOLLAUTOMATISCH: findet die Party-Adresse selbst (Speicher-Scan + Prüfsummen-
  Validierung), liest das Team und sendet es per HTTP an die Website. Keine
  manuelle RAM-Suche, keine Eingaben. KEINE ROM-/Save-Dateien, KEINE Supabase.

  Robust: jeder Speicherzugriff ist nil-sicher, jeder Frame ist in pcall gekapselt
  → das Script stürzt niemals mit einem nil-Wert ab, sondern scannt weiter.

  Voraussetzung: BizHawk 2.8+ (Lua 5.4 / NLua — native Bit-Operatoren).
============================================================================]]--

local CONFIG = {
  game            = "platinum",
  -- "file" (Standard, funktioniert ohne BizHawk-Startparameter) | "http" | "console"
  output          = "file",
  http_url        = "http://localhost:5173/api/emulator-sync",
  -- Leer = automatisch NEBEN diesem Script schreiben (emulator/bizhawk/soullink_team.json),
  -- sodass der Dev-Server die Datei ohne weitere Einrichtung findet.
  file_path       = "",
  interval_frames = 30,            -- ~2x pro Sekunde
  trainer_name    = "Trainer",
  scan_chunk      = 0x20000,       -- Bytes pro Frame beim Auto-Scan
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

-- ── nil-sichere Array-Zugriffe (i = absoluter Array-Index) ──────────────────
-- Fehlende/aus-dem-Bereich-Bytes werden als 0 behandelt → niemals nil-Arithmetik.
local function U16(a, i) return (a[i] or 0) + (a[i + 1] or 0) * 0x100 end
local function U32(a, i)
  return (a[i] or 0) + (a[i + 1] or 0) * 0x100 + (a[i + 2] or 0) * 0x10000 + (a[i + 3] or 0) * 0x1000000
end

-- Validiert einen Gen-4-Party-Mon. `s` = Array-Index des ersten Mon-Bytes.
-- Nutzt die Pokémon-Prüfsumme als starken Filter. Gibt Mon-Tabelle oder nil.
local function validateGen4(a, s, maxSpecies)
  local pid = U32(a, s)
  if pid == 0 then return nil end
  local storedChk = U16(a, s + 6)

  -- Hauptblöcke (0x08..0x87): 64 Words entschlüsseln (Seed = Checksumme) + summieren
  local seed, sum = storedChk, 0
  local words = {}
  for i = 0, 63 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    local key = (seed >> 16) & 0xFFFF
    local w = U16(a, s + 8 + i * 2) ~ key
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
    pd[i] = U16(a, s + 0x88 + i * 2) ~ key
  end
  local level, curHp, maxHp = pd[2] & 0xFF, pd[3], pd[4]
  if level < 1 or level > 100 then return nil end
  if maxHp < 1 or maxHp > 1000 or curHp > maxHp then return nil end

  return { speciesId = species, level = level, hp = curHp, maxHp = maxHp,
           status = statusToStr(pd[0]), fainted = (curHp == 0) }
end

-- Liest einen Speicherbereich als Byte-Array und erkennt die Index-Basis
-- (0- oder 1-indiziert, je nach BizHawk-Version). Gibt arr, baseIndex oder nil.
local function readArray(addr, len)
  local arr
  local ok = pcall(function() arr = memory.read_bytes_as_array(addr, len) end)
  if not ok or type(arr) ~= "table" then return nil, 0 end
  local bi = (arr[0] ~= nil) and 0 or 1
  return arr, bi
end

-- Einzelner u32-Lesezugriff (nil-sicher) für Header-/Anker-Prüfungen.
local function safeU32(addr)
  local v
  pcall(function() v = memory.read_u32_le(addr) end)
  return v
end

-- ── Auto-Detect: Speicher in Frame-Chunks scannen ───────────────────────────
local DET = { running = false, base = 0, found = {}, size = 0 }

local function detectStart(profile)
  DET.running = true; DET.base = 0; DET.found = {}
  profile.party_addr = nil; profile.team_size = nil
  local sz
  pcall(function() sz = memory.getmemorydomainsize(profile.domain) end)
  if not sz then pcall(function() sz = memory.getmemorydomainsize() end) end
  DET.size = sz or 0
  console.log(string.format("[scan] Suche Party automatisch ... (%d KB)", DET.size // 1024))
  if DET.size == 0 then
    console.log("[scan] Domain '" .. profile.domain .. "' nicht lesbar. Verfügbar: "
      .. table.concat(memory.getmemorydomainlist(), ", "))
  end
end

-- Liest einen Chunk und prüft jeden 4-Byte-Offset. Gibt true zurück wenn fertig.
-- Wirft NIE: bei fehlgeschlagenem Read wird der Chunk übersprungen.
local function detectStep(profile)
  if DET.size <= 0 then return true end
  local remaining = DET.size - DET.base
  local chunkLen = math.min(CONFIG.scan_chunk, remaining)
  if chunkLen <= 0 then return true end
  -- + mon_size Überlappung, damit ein an der Chunk-Grenze beginnender Mon komplett ist
  local readLen = math.min(chunkLen + profile.mon_size, remaining)
  local arr, bi = readArray(DET.base, readLen)
  if arr then
    local maxO = readLen - profile.mon_size      -- nur Offsets, an denen ein ganzer Mon passt
    local lastO = math.min(chunkLen - 1, maxO)
    local o = 0
    while o <= lastO do
      local mon = validateGen4(arr, bi + o, profile.max_species)
      if mon then DET.found[#DET.found + 1] = { addr = DET.base + o, hp = mon.hp } end
      o = o + 4
    end
  end
  DET.base = DET.base + chunkLen                  -- IMMER weiterrücken (auch bei Read-Fehler)
  return DET.base >= DET.size
end

-- Wählt die SPIELER-Party: der zusammenhängende Lauf, dem ein gültiger
-- Party-Count-Header (u32 bei addr-4, 1..6) vorausgeht (Save-Block-Signatur).
-- Gegner-Party, wilde Pokémon, Boxen und Battle-Puffer haben diesen Header nicht.
local function detectFinish(profile)
  DET.running = false
  table.sort(DET.found, function(x, y) return x.addr < y.addr end)

  -- zusammenhängende Läufe (Abstand = mon_size) bilden
  local runs, i = {}, 1
  while i <= #DET.found do
    local j = i
    while j + 1 <= #DET.found and (DET.found[j + 1].addr - DET.found[j].addr) == profile.mon_size do j = j + 1 end
    runs[#runs + 1] = { addr = DET.found[i].addr, len = j - i + 1, hp = DET.found[i].hp }
    i = j + 1
  end

  local best, bestScore = nil, 0
  for _, r in ipairs(runs) do
    local count = (r.addr >= 4) and safeU32(r.addr - 4) or nil
    local anchored = (count ~= nil and count >= 1 and count <= 6)
    r.team = anchored and count or r.len
    local score = 0
    if anchored then
      score = 1000                                              -- Save-Block-Party-Header vorhanden
      if count == r.len then score = score + 500 end            -- Count passt exakt zur Anzahl
      local clean = true                                        -- ungenutzte Slots im Save-Block sind 0
      for k = count, 5 do if (safeU32(r.addr + k * profile.mon_size) or 0) ~= 0 then clean = false; break end end
      if clean then score = score + 300 end
      if r.hp and r.hp > 0 then score = score + 10 end          -- lebende Lead-Mon
    end
    console.log(string.format("[scan] Kandidat @ 0x%X · %d Mon · count(-4)=%s · score=%d",
      r.addr, r.len, tostring(count), score))
    if score > bestScore then best, bestScore = r, score end
  end

  if best and bestScore >= 1000 then
    profile.party_addr = best.addr
    profile.team_size  = best.team
    console.log(string.format("[scan] OK Spieler-Party @ 0x%X · %d Pokemon", best.addr, best.team))
    local f = io.open("soullink_party_addr.txt", "w")
    if f then f:write(string.format("%s party_addr = 0x%X (team %d)\n", CONFIG.game, best.addr, best.team)); f:close() end
  else
    profile.party_addr = nil; profile.team_size = nil
    console.log("[scan] Keine eindeutige SPIELER-Party (Save-Block-Header) gefunden — neuer Versuch folgt.")
    console.log("[scan] Tipp: mind. 1 Pokemon im Team? Falls weiter falsch: obiges Kandidaten-Log senden.")
  end
end

-- ── Sync-Phase: Mon direkt lesen (nil-sicher) ───────────────────────────────
local function readMon(profile, slot)
  if not profile.party_addr then return nil end
  local base = profile.party_addr + slot * profile.mon_size
  local arr, bi = readArray(base, profile.mon_size)
  if not arr then return nil end
  return validateGen4(arr, bi, profile.max_species)
end

-- Gen-4 Western-Zeichensatz für Spitznamen (konservativ; A-Z/a-z/0-9/Space).
-- Bei unbekannten Zeichen → nil, damit nie „Müll" angezeigt wird (best-effort).
local function decodeNick(w, base)
  local out = {}
  for i = 0, 10 do
    local c = w[base + i] or 0xFFFF
    if c == 0xFFFF or c == 0 then break end
    local ch
    if     c == 0x0001                   then ch = " "
    elseif c >= 0x0002 and c <= 0x000B   then ch = string.char(48 + (c - 0x0002))   -- 0-9
    elseif c >= 0x000C and c <= 0x0025   then ch = string.char(65 + (c - 0x000C))   -- A-Z
    elseif c >= 0x0026 and c <= 0x003F   then ch = string.char(97 + (c - 0x0026))   -- a-z
    else return nil end
    out[#out + 1] = ch
  end
  if #out == 0 then return nil end
  return table.concat(out)
end

-- Voll-Auslesen eines Mons (nur für die ≤6 Team-Slots; nicht im Scan).
-- Zuverlässig: species, level, hp/maxHp, status, moves, heldItem, ability, nature.
-- Best-effort: nickname.  Noch null (Roadmap): metLocation/metLevel (Block-D-Offsets
-- je Edition unverifiziert) — bewusst null statt unsichere Werte.
local function readMonRich(a, s, maxSpecies)
  local pid = U32(a, s)
  if pid == 0 then return nil end
  local chk = U16(a, s + 6)
  local seed, sum = chk, 0
  local w = {}
  for i = 0, 63 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    w[i] = U16(a, s + 8 + i * 2) ~ ((seed >> 16) & 0xFFFF)
    sum = (sum + w[i]) & 0xFFFF
  end
  if sum ~= chk then return nil end

  local ord = ORDERS[((pid >> 13) & 0x1F) % 24 + 1]
  local pA = (ord:find("A") - 1) * 16    -- Growth
  local pB = (ord:find("B") - 1) * 16    -- Attacks
  local pC = (ord:find("C") - 1) * 16    -- Misc/Condition (Nickname @ 0x48)

  local species = w[pA + 0]
  if species < 1 or species > maxSpecies then return nil end

  seed = pid
  local pd = {}
  for i = 0, 4 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    pd[i] = U16(a, s + 0x88 + i * 2) ~ ((seed >> 16) & 0xFFFF)
  end
  local level, curHp, maxHp = pd[2] & 0xFF, pd[3], pd[4]
  if level < 1 or level > 100 then return nil end
  if maxHp < 1 or maxHp > 1000 or curHp > maxHp then return nil end

  return {
    speciesId = species, level = level, hp = curHp, maxHp = maxHp,
    status = statusToStr(pd[0]), fainted = (curHp == 0),
    heldItemId = w[pA + 1],
    abilityId  = (w[pA + 6] >> 8) & 0xFF,        -- 0x0D
    natureId   = pid % 25,                        -- Gen 4: Wesen aus PID
    nickname   = decodeNick(w, pC),
    move1 = w[pB + 0], move2 = w[pB + 1], move3 = w[pB + 2], move4 = w[pB + 3],
    metLocationId = nil, metLevel = nil,          -- Roadmap (Block D)
  }
end

local function readMonRichAt(profile, slot)
  if not profile.party_addr then return nil end
  local arr, bi = readArray(profile.party_addr + slot * profile.mon_size, profile.mon_size)
  if not arr then return nil end
  return readMonRich(arr, bi, profile.max_species)
end

-- JSON-Helfer
local function jnum(v) return v == nil and "null" or tostring(v) end
local function jstr(s)
  if s == nil then return "null" end
  return '"' .. s:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
end

local function buildJson(profile)
  local parts = {}
  for slot = 0, (profile.team_size or 6) - 1 do
    local m = readMonRichAt(profile, slot)
    if m then
      parts[#parts + 1] = string.format(
        '{"slot":%d,"speciesId":%d,"level":%d,"hp":%d,"maxHp":%d,"status":"%s","fainted":%s,'
        .. '"nickname":%s,"natureId":%s,"abilityId":%s,"heldItemId":%s,'
        .. '"moveIds":[%d,%d,%d,%d],"metLocationId":%s,"metLevel":%s}',
        slot + 1, m.speciesId, m.level, m.hp, m.maxHp, m.status, tostring(m.fainted),
        jstr(m.nickname), jnum(m.natureId), jnum(m.abilityId), jnum(m.heldItemId),
        m.move1, m.move2, m.move3, m.move4, jnum(m.metLocationId), jnum(m.metLevel))
    end
  end
  return string.format(
    '{"game":"%s","trainer":"%s","capturedAt":%d,"team":[%s]}',
    CONFIG.game, CONFIG.trainer_name, os.time() * 1000, table.concat(parts, ","))
end

-- Zielpfad bestimmen: explizit gesetzt > automatisch neben dem Script > relativ.
local function resolveOutFile()
  if CONFIG.file_path ~= nil and CONFIG.file_path ~= "" then return CONFIG.file_path end
  local dir
  pcall(function()
    local src = debug.getinfo(1, "S").source         -- "@C:\...\soullink_sync.lua"
    local p = src and src:match("^@(.*)$")
    if p then dir = p:match("^(.*[/\\])") end
  end)
  if dir then return dir .. "soullink_team.json" end
  return "soullink_team.json"                          -- Fallback: BizHawk-Arbeitsverzeichnis
end
local OUT_FILE = resolveOutFile()
console.log("[sync] Schreibe Team nach: " .. OUT_FILE)

local httpWarned = false
local function emit(json)
  local f = io.open(OUT_FILE, "w"); if f then f:write(json); f:close() end   -- primäre Datei (Live-Sync)
  if CONFIG.output == "console" then console.log(json); return end
  if CONFIG.output ~= "http" then return end
  local ok = pcall(function()
    if comm.httpSetPostUrl then pcall(comm.httpSetPostUrl, CONFIG.http_url) end
    local sent = pcall(comm.httpPost, CONFIG.http_url, json)
    if not sent then comm.httpPost(json) end
  end)
  if not ok and not httpWarned then
    httpWarned = true
    console.log("[sync] comm.httpPost nicht verfuegbar — Daten liegen in " .. CONFIG.file_path)
  end
end

-- ── Init ────────────────────────────────────────────────────────────────────
local profile = PROFILES[CONFIG.game]
assert(profile, "Unbekanntes Spiel: " .. tostring(CONFIG.game))
pcall(function() memory.usememorydomain(profile.domain) end)

console.log("SoulLink Sync gestartet · Spiel=" .. CONFIG.game .. " · Output=" .. CONFIG.output)
detectStart(profile)

-- Ein Frame Arbeit (wird vom Loop in pcall ausgeführt)
local function stepOnce(frame)
  pcall(function() memory.usememorydomain(profile.domain) end)
  if DET.running then
    if detectStep(profile) then detectFinish(profile) end
  elseif not profile.party_addr then
    if frame % 120 == 0 then detectStart(profile) end          -- alle ~2s neu versuchen
  else
    if frame % CONFIG.interval_frames == 0 then
      -- Anker erneut prüfen: gültiger Count-Header + lesbare Lead-Mon
      local count = safeU32(profile.party_addr - 4)
      if readMon(profile, 0) and count and count >= 1 and count <= 6 then
        profile.team_size = count
        emit(buildJson(profile))
      else
        console.log("[sync] Party-Adresse ungueltig (Save-Block-Wechsel?) — scanne neu ...")
        detectStart(profile)
      end
    end
  end
end

-- ── Loop (stürzt nie ab) ─────────────────────────────────────────────────────
local frame = 0
while true do
  local ok, err = pcall(stepOnce, frame)
  if not ok then console.log("[sync] Frame uebersprungen: " .. tostring(err)) end
  frame = frame + 1
  emu.frameadvance()
end
