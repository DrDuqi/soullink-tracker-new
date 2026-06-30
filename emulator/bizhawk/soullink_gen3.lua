--[[============================================================================
  SoulLink Tracker — BizHawk Live-Sync  ·  GEN 3 / GBA
  (Pokémon FireRed / LeafGreen / Emerald / Ruby / Sapphire)

  STRICTLY separate from the Gen4 engine (soullink_sync.lua). Gen3 uses a completely
  different layout: 100-byte party mons, a 48-byte data section split into four 12-byte
  substructures whose ORDER is PID%24, XOR-encrypted with key = PID ⨁ OT-ID, a 16-bit
  data checksum, and the species stored as a Gen3 INTERNAL index (converted to national
  dex here). Robust: every read is nil-safe, every frame is pcall-wrapped, and the party
  is found by validating the known RAM address with a budgeted EWRAM scan as fallback.

  Writes the SAME JSON shape as the Gen4 engine so the tracker ingests both identically;
  data Gen3 can't provide yet is emitted as null (unsupported), never as a wrong value.
============================================================================]]--

local LUA_REV = "gen3-1.0.0"

local CONFIG = {
  game     = (os.getenv("SOULLINK_GAME") or "firered"):lower(),
  domain   = os.getenv("SOULLINK_DOMAIN") or "System Bus",
  interval_frames = 90,            -- ~1.5 s; gentle on the emulator
  trainer_name    = "Trainer",
}

-- Known gPlayerParty addresses (System-Bus absolute). A randomizer edits ROM data, not
-- the engine's RAM layout, so these hold for randomized ROMs too. Validated each launch;
-- a budgeted EWRAM scan covers any revision/edge case.
local PARTY_ADDR = {
  firered = 0x02024284, leafgreen = 0x02024284, emerald = 0x020244EC,
  ruby = 0x03004360, sapphire = 0x03004360,
}
local MON_SIZE, PARTY_MAX, MAX_SPECIES = 100, 6, 411   -- internal index up to 411
local EWRAM_LO, EWRAM_HI = 0x02000000, 0x02040000       -- 256 KB EWRAM scan window

-- ── nil-safe little-endian reads ────────────────────────────────────────────
local function U16(a, i) return (a[i] or 0) + (a[i + 1] or 0) * 0x100 end
local function U32(a, i)
  return (a[i] or 0) + (a[i + 1] or 0) * 0x100 + (a[i + 2] or 0) * 0x10000 + (a[i + 3] or 0) * 0x1000000
end
local function readArray(addr, len)
  local arr
  local ok = pcall(function() arr = memory.read_bytes_as_array(addr, len, CONFIG.domain) end)
  if not ok or type(arr) ~= "table" then return nil, 0 end
  return arr, (arr[0] ~= nil) and 0 or 1
end
local function safeU32(addr)
  local v; pcall(function() v = memory.read_u32_le(addr, CONFIG.domain) end); return v
end

-- ── Gen3 internal species index → national dex ──────────────────────────────
-- 1..251 are identical; 277..411 are the Hoenn mons in internal order (national
-- 252..386 in a non-sequential mapping). 252..276 are unused.
local HOENN = {
  [277]=252,[278]=253,[279]=254,[280]=255,[281]=256,[282]=257,[283]=258,[284]=259,[285]=260,
  [286]=261,[287]=262,[288]=263,[289]=264,[290]=265,[291]=266,[292]=267,[293]=268,[294]=269,
  [295]=270,[296]=271,[297]=272,[298]=273,[299]=274,[300]=275,[301]=290,[302]=291,[303]=292,
  [304]=276,[305]=277,[306]=285,[307]=286,[308]=327,[309]=278,[310]=279,[311]=283,[312]=284,
  [313]=320,[314]=321,[315]=300,[316]=301,[317]=352,[318]=343,[319]=344,[320]=299,[321]=324,
  [322]=302,[323]=339,[324]=340,[325]=370,[326]=341,[327]=342,[328]=349,[329]=350,[330]=318,
  [331]=319,[332]=328,[333]=329,[334]=330,[335]=296,[336]=297,[337]=309,[338]=310,[339]=322,
  [340]=323,[341]=363,[342]=364,[343]=365,[344]=331,[345]=332,[346]=361,[347]=362,[348]=337,
  [349]=338,[350]=298,[351]=325,[352]=326,[353]=311,[354]=312,[355]=303,[356]=307,[357]=308,
  [358]=333,[359]=334,[360]=360,[361]=355,[362]=356,[363]=315,[364]=287,[365]=288,[366]=289,
  [367]=316,[368]=317,[369]=357,[370]=293,[371]=294,[372]=295,[373]=366,[374]=367,[375]=368,
  [376]=359,[377]=353,[378]=354,[379]=336,[380]=335,[381]=369,[382]=304,[383]=305,[384]=306,
  [385]=351,[386]=313,[387]=314,[388]=345,[389]=346,[390]=347,[391]=348,[392]=280,[393]=281,
  [394]=282,[395]=371,[396]=372,[397]=373,[398]=374,[399]=375,[400]=376,[401]=377,[402]=378,
  [403]=379,[404]=382,[405]=383,[406]=384,[407]=380,[408]=381,[409]=385,[410]=386,[411]=358,
}
local function nationalDex(internal)
  if internal >= 1 and internal <= 251 then return internal end
  return HOENN[internal] or internal
end

-- ── substructure order (PID % 24) → byte offset of G/A/E/M within the 48-byte data ──
local ORDER = {
  "GAEM","GAME","GEAM","GEMA","GMAE","GMEA","AGEM","AGME","AEGM","AEMG","AMGE","AMEG",
  "EGAM","EGMA","EAGM","EAMG","EMGA","EMAG","MGAE","MGEA","MAGE","MAEG","MEGA","MEAG",
}

local STATUS_BITS = { [0x08]="psn", [0x10]="brn", [0x20]="frz", [0x40]="par", [0x80]="tox" }
local function statusToStr(w)
  if (w & 0x07) ~= 0 then return "slp" end
  for bit, name in pairs(STATUS_BITS) do if (w & bit) ~= 0 then return name end end
  return "ok"
end

-- Gen3 western nickname charset (best-effort; unknown char → stop).
local function decodeNick(a, s)
  local out = {}
  for i = 0, 9 do
    local c = a[s + i] or 0xFF
    local ch
    if c == 0xFF then break
    elseif c == 0x00 then ch = " "
    elseif c >= 0xA1 and c <= 0xAA then ch = string.char(48 + (c - 0xA1))      -- 0-9
    elseif c >= 0xBB and c <= 0xD4 then ch = string.char(65 + (c - 0xBB))      -- A-Z
    elseif c >= 0xD5 and c <= 0xEE then ch = string.char(97 + (c - 0xD5))      -- a-z
    else break end
    out[#out + 1] = ch
  end
  local s2 = table.concat(out):gsub("%s+$", "")
  return (#s2 > 0) and s2 or nil
end

-- Decrypt the 48-byte data block into 24 u16 words; verify the checksum. Returns the
-- decrypted word array + the four substructure base offsets (in u16 units), or nil.
local function decryptData(a, s, pid, otid, storedChk)
  local key = pid ~ otid
  local lo, hi = key & 0xFFFF, (key >> 16) & 0xFFFF
  local d, sum = {}, 0
  for w = 0, 11 do
    local raw = U16(a, s + 0x20 + w * 4) ~ lo
    local raw2 = U16(a, s + 0x20 + w * 4 + 2) ~ hi
    d[w * 2] = raw; d[w * 2 + 1] = raw2
    sum = (sum + raw + raw2) & 0xFFFF
  end
  if sum ~= storedChk then return nil end
  local ord = ORDER[(pid % 24) + 1]
  return d, {
    G = (ord:find("G") - 1) * 6, A = (ord:find("A") - 1) * 6,
    E = (ord:find("E") - 1) * 6, M = (ord:find("M") - 1) * 6,
  }
end

-- Validate a candidate party slot (STRICT: full checksum + ranges). Returns species
-- (internal) + base info, or nil. Used by the scanner.
local function validateGen3(a, s)
  local pid = U32(a, s); if pid == 0 then return nil end
  local otid = U32(a, s + 4)
  local d, off = decryptData(a, s, pid, otid, U16(a, s + 0x1C))
  if not d then return nil end
  local species = d[off.G + 0]
  if species < 1 or species > MAX_SPECIES then return nil end
  local level = a[s + 0x54] or 0
  local curHp, maxHp = U16(a, s + 0x56), U16(a, s + 0x58)
  if level < 1 or level > 100 then return nil end
  if maxHp < 1 or maxHp > 999 or curHp > maxHp then return nil end
  return { species = species }
end

-- Full read of a known party slot (lenient: the address is already verified, so clamp
-- instead of discarding → a freshly caught mon never drops out).
local function readMonRich(a, s)
  local pid = U32(a, s); if pid == 0 then return nil end
  local otid = U32(a, s + 4)
  local d, off = decryptData(a, s, pid, otid, U16(a, s + 0x1C))
  if not d then return nil end
  local internal = d[off.G + 0]
  if internal < 1 or internal > MAX_SPECIES then return nil end
  local level = a[s + 0x54] or 0
  local curHp, maxHp = U16(a, s + 0x56), U16(a, s + 0x58)
  if level < 1 then level = 1 elseif level > 100 then level = 100 end
  if maxHp > 0 and curHp > maxHp then curHp = maxHp end

  local heldItem = d[off.G + 1]
  local move1, move2, move3, move4 = d[off.A + 0], d[off.A + 1], d[off.A + 2], d[off.A + 3]
  -- Misc substructure: word0 = pokerus(lo) | metLocation(hi); word1(origins) bits0-6 = metLevel.
  local metLoc = (d[off.M + 0] >> 8) & 0xFF
  local metLvl = d[off.M + 1] & 0x7F
  local shiny = ((pid & 0xFFFF) ~ (pid >> 16) ~ (otid & 0xFFFF) ~ (otid >> 16)) < 8

  return {
    speciesId = nationalDex(internal), level = level, hp = curHp, maxHp = maxHp,
    fainted = (curHp == 0), statusRaw = U32(a, s + 0x50),
    pid = pid, heldItemId = heldItem, natureId = pid % 25,
    nickname = decodeNick(a, s + 0x08), shiny = shiny,
    move1 = move1, move2 = move2, move3 = move3, move4 = move4,
    metLocationId = metLoc, metLevel = (metLvl > 0) and metLvl or nil,
    -- Gen3 stores ability SLOT, not an ability id (needs a species DB) → unsupported.
    abilityId = nil, metLocationName = nil,
  }
end

-- ── party detection: known address first, budgeted EWRAM scan as fallback ────
local STATE = { addr = nil, lastKey = nil, scanBase = nil, missStreak = 0, nextAnnounce = 0 }

local function leadValid(addr)
  local a, bi = readArray(addr, MON_SIZE)
  return a and validateGen3(a, bi) ~= nil
end

local function tryKnownAddr()
  local a = PARTY_ADDR[CONFIG.game] or PARTY_ADDR.firered
  if leadValid(a) then STATE.addr = a; return true end
  return false
end

-- Incremental, time-budgeted scan of EWRAM for the longest run of valid party mons.
local function scanStep()
  if STATE.scanBase == nil then STATE.scanBase = EWRAM_LO; STATE.scanBest = nil; STATE.scanBestLen = 0 end
  local t0, budget = os.clock(), 0.0025
  while STATE.scanBase < EWRAM_HI - MON_SIZE do
    local a, bi = readArray(STATE.scanBase, MON_SIZE)
    if a and validateGen3(a, bi) then
      -- count the contiguous run of valid mons from here
      local len, p = 1, STATE.scanBase + MON_SIZE
      while len < PARTY_MAX do
        local a2, b2 = readArray(p, MON_SIZE)
        if not (a2 and validateGen3(a2, b2)) then break end
        len = len + 1; p = p + MON_SIZE
      end
      if len > STATE.scanBestLen then STATE.scanBestLen = len; STATE.scanBest = STATE.scanBase end
    end
    STATE.scanBase = STATE.scanBase + 4
    if (os.clock() - t0) >= budget then return false end
  end
  -- scan finished
  if STATE.scanBest then
    STATE.addr = STATE.scanBest
    console.log(string.format("[gen3] Party @ 0x%X (%d Mon, Scan).", STATE.addr, STATE.scanBestLen))
  end
  STATE.scanBase = nil
  return true
end

-- ── JSON ─────────────────────────────────────────────────────────────────────
local function jnum(v) return v == nil and "null" or tostring(v) end
local function jstr(s) if s == nil then return "null" end return '"' .. s:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"' end

local function buildJson()
  local parts, got = {}, 0
  for slot = 0, PARTY_MAX - 1 do
    local a, bi = readArray(STATE.addr + slot * MON_SIZE, MON_SIZE)
    local m = a and readMonRich(a, bi) or nil
    if m then
      got = got + 1
      local status = statusToStr(m.statusRaw or 0)
      parts[#parts + 1] = string.format(
        '{"slot":%d,"speciesId":%d,"pid":%s,"level":%d,"hp":%d,"maxHp":%d,"status":"%s","fainted":%s,'
        .. '"nickname":%s,"natureId":%s,"abilityId":%s,"heldItemId":%s,"shiny":%s,'
        .. '"moveIds":[%d,%d,%d,%d],"metLocationId":%s,"metLocationName":%s,"metLevel":%s}',
        slot + 1, m.speciesId, jnum(m.pid), m.level, m.hp, m.maxHp, status, tostring(m.fainted),
        jstr(m.nickname), jnum(m.natureId), jnum(m.abilityId), jnum(m.heldItemId), tostring(m.shiny),
        m.move1, m.move2, m.move3, m.move4, jnum(m.metLocationId), jstr(m.metLocationName), jnum(m.metLevel))
    end
  end
  return string.format(
    '{"game":"%s","trainer":"%s","capturedAt":%d,"currentLocationId":null,"currentLocationName":null,"team":[%s]}',
    CONFIG.game, CONFIG.trainer_name, os.time() * 1000, table.concat(parts, ",")), got
end

-- ── output file (env from the Companion; else next to this script) ───────────
local function resolveOutFile()
  local env = os.getenv("SOULLINK_TEAM_FILE")
  if env and env ~= "" then return env end
  local dir
  pcall(function()
    local src = debug.getinfo(1, "S").source
    local p = src and src:match("^@(.*)$")
    if p then dir = p:match("^(.*[/\\])") end
  end)
  return (dir or "") .. "soullink_team.json"
end
local OUT_FILE = resolveOutFile()
console.log(string.format("[gen3] SoulLink Gen3 %s · Spiel=%s · Domain=%s · Ziel=%s", LUA_REV, CONFIG.game, CONFIG.domain, OUT_FILE))

local function atomicWrite(path, data)
  local tmp = path .. ".tmp"
  local f = io.open(tmp, "w")
  if not f then local g = io.open(path, "w"); if g then g:write(data); g:close() end return end
  f:write(data); f:close()
  os.remove(path); local ok = os.rename(tmp, path)
  if not ok then local g = io.open(path, "w"); if g then g:write(data); g:close() end; os.remove(tmp) end
end

-- ── main loop ────────────────────────────────────────────────────────────────
local frame, lastKey = 0, nil
local function tick()
  -- ensure we have a party address (known → scan fallback)
  if not STATE.addr then
    if not tryKnownAddr() then
      if scanStep() and not STATE.addr then
        local now = os.clock()
        if now > STATE.nextAnnounce then
          STATE.nextAnnounce = now + 8
          console.log("[gen3] Noch kein Team gefunden — warte auf dein erstes Pokémon …")
        end
      end
      return
    end
  end
  -- validate the address still holds; re-detect if it stopped being a valid party
  if not leadValid(STATE.addr) then
    STATE.missStreak = STATE.missStreak + 1
    if STATE.missStreak > 8 then STATE.addr = nil; STATE.missStreak = 0 end
    return
  end
  STATE.missStreak = 0
  local json, got = buildJson()
  if json ~= lastKey then
    lastKey = json
    atomicWrite(OUT_FILE, json)
    console.log(string.format("[gen3] Team aktualisiert · %d Pokémon.", got))
  end
end

while true do
  frame = frame + 1
  if frame % CONFIG.interval_frames == 0 then pcall(tick) end
  emu.frameadvance()
end
