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
  interval_frames = 90,            -- SCHONEND: alle ~1,5s prüfen → flüssigstes Spiel (HP/Team-Update dafür minimal verzögert)
  trainer_name    = "Trainer",
  scan_chunk      = 0x8000,        -- Bytes pro Frame beim Auto-Scan (klein → ruckelfrei)
  -- Aktuelle Map-/Location-ID: Main-RAM-Offset (u16). Standard nil → currentLocation
  -- bleibt null. Adresse mit find_location (siehe unten) finden, hier eintragen.
  -- Sobald gesetzt, loggt das Script die ID bei jedem Ortswechsel → IDs in LOCATIONS
  -- eintragen. currentLocationId wird dann immer geliefert, der Name nur bei Mapping.
  location_addr   = 0x010D8E,
  -- Kalibrierhilfe: findet die Location-Adresse per Differenz-Suche (Tasten 1/2/3 im
  -- Emu-Fenster, Anleitung erscheint in der Lua-Console). Aktivieren → Script neu laden.
  find_location   = false,
  -- Kalibrier-Hilfe: einmaliges Loggen der Spitznamen-Rohwerte des 1. Pokemon in
  -- die BizHawk-Konsole (Lua Console). Damit lässt sich der Zeichensatz exakt
  -- prüfen/fixen. Aktivieren → Script neu laden → Zeile + echten Namen melden.
  debug           = false,
  -- PERF/DEBUG: misst pro Sekunde Lua-Durchlaufzeiten, Reads, Writes & FPS in die
  -- Lua-Console. Standard AUS (keine Verhaltensänderung).
  perf            = false,
  -- DIAGNOSE-Testmodus (zur Eingrenzung des Ruckelns), aktiviert automatisch perf:
  --   0 = aus (normal)
  --   1 = liest das Team, schreibt aber NICHTS (Variante 2: Datei-Write komplett aus)
  --   2 = schreibt höchstens alle 5 s (Variante 3: minimaler Sync)
  test_mode       = 0,
  -- DIAGNOSE-Profiler: misst jede Kernfunktion einzeln (n/total/avg/max), Bericht
  -- alle 5 s in die Lua-Console. Standard AUS. Erst messen, dann optimieren.
  profile         = false,
}

-- Profiler/Testmodus lassen sich OHNE Datei-Bearbeitung aktivieren — per
-- Umgebungsvariable, die der Companion an BizHawk weiterreicht:
--   SOULLINK_PROFILE = 1        → Per-Funktions-Profiler an
--   SOULLINK_TEST_MODE = 1 | 2  → Diagnose-Testmodus (1 = kein Write, 2 = alle 5 s)
-- Gesetzte ENV-Werte haben Vorrang vor den CONFIG-Defaults oben. So genügt ein
-- Companion-Update + ein Schalter (ENV) — niemand muss diese Datei bearbeiten.
do
  local p = os.getenv("SOULLINK_PROFILE")
  if p == "1" or p == "true" then CONFIG.profile = true end
  local tm = tonumber(os.getenv("SOULLINK_TEST_MODE") or "")
  if tm ~= nil then CONFIG.test_mode = tm end
end

-- ── Entwickler-Diagnose-Log ──────────────────────────────────────────────────
-- Wenn der Companion SOULLINK_DEVLOG=<Logs-Ordner> setzt (nur auf der Entwickler-
-- Maschine), schreibt die Lua automatisch eine current.log: Session-Header, die
-- Perf-Werte, Scan-/Cache-Events und [WARN]-Marker — Pfade anonymisiert. Bei
-- normalen Nutzern ist die Variable NICHT gesetzt → kein Logging, kein Overhead.
-- Rotation/Archiv/Pruning übernimmt der Companion VOR dem Start (current.log ist
-- beim Start frisch); hier wird nur angehängt.
local LUA_REV = "1.0.15"
local DEVLOG_DIR = (function() local d = os.getenv("SOULLINK_DEVLOG"); return (d and d ~= "") and d or nil end)()
local DEV_VERSION = os.getenv("SOULLINK_VERSION") or "?"
local function anonPath(s) return s and (tostring(s):gsub("[Cc]:[/\\][Uu]sers[/\\][^/\\]+", "C:\\Users\\<USER>")) or s end
local function _writeLine(file, line)
  local f = io.open(DEVLOG_DIR .. "/" .. file, "a")
  if f then f:write(string.format("[%s] %s\n", os.date("%Y-%m-%d %H:%M:%S"), anonPath(tostring(line)))); f:close() end
end
-- devlog(line[, channel]) — current.log holds the FULL unified stream (so a single
-- upload is enough); channel additionally tees into a focused view:
--   "perf" → performance.log · "sync" → sync.log · "err" → errors.log
local function devlog(line, channel)
  if not DEVLOG_DIR then return end
  _writeLine("current.log", line)
  if channel == "perf" then _writeLine("performance.log", line)
  elseif channel == "sync" then _writeLine("sync.log", line)
  elseif channel == "err" then _writeLine("errors.log", line) end
end
if DEVLOG_DIR then
  CONFIG.perf = true   -- leichte Perf-Zeile (FPS/Reads/Writes) ins Log; der schwere
                       -- Per-Funktions-Profiler bleibt opt-in via SOULLINK_PROFILE
  devlog("===== SoulLink Dev-Session =====")
  devlog(string.format("Companion v%s · Lua-Rev %s · Spiel=%s · Intervall=%d Frames · TestMode=%d",
    DEV_VERSION, LUA_REV, CONFIG.game, CONFIG.interval_frames, CONFIG.test_mode))
end

-- Messzähler für Performance-/Testmodus.
local PERF = { reads = 0, emits = 0, writes = 0, build_s = 0, build_max = 0, write_s = 0, write_max = 0, t0 = os.clock() }
-- Mess-/Logausgabe an, sobald perf ODER ein Testmodus aktiv ist.
local PERF_ON = CONFIG.perf or (CONFIG.test_mode or 0) > 0

-- Gen-4 Block-Reihenfolge (Permutation per ((PID>>13)&0x1F)%24)
local ORDERS = {
  "ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC",
  "BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA",
  "CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA",
}

-- scan_lo/scan_hi = the Main-RAM window where the Gen-4 party actually lives
-- (Platinum party ≈ 0x27Exxx). The auto-scan checks THIS window first → finds the
-- party in a few frames instead of sweeping all ~4 MB (which caused the freezes).
-- A full-RAM scan still runs as a one-time fallback if the window comes up empty.
local PROFILES = {
  platinum  = { gen = 4, domain = "Main RAM", mon_size = 236, max_species = 493, party_addr = nil, scan_lo = 0x200000, scan_hi = 0x300000 },
  heartgold = { gen = 4, domain = "Main RAM", mon_size = 236, max_species = 493, party_addr = nil, scan_lo = 0x200000, scan_hi = 0x300000 },
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
  if PERF_ON then PERF.reads = PERF.reads + 1 end
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

local function safeU16(addr)
  local v
  pcall(function() v = memory.read_u16_le(addr) end)
  return v
end

-- Location-ID → lesbarer Name (pro Edition). NOCH NICHT VERVOLLSTÄNDIGT:
-- verifizierte Platinum-Location-IDs hier eintragen (per find_location ermittelt).
-- Solange eine ID nicht gemappt ist, wird im JSON nur die ID geliefert
-- (currentLocationName = null) — das Frontend füllt dann KEINE Route automatisch
-- vor (kein Fehl-Match). NUR sicher beobachtete IDs eintragen — nichts raten!
--
-- Vorgehen: find_location → Adresse finden → location_addr setzen → auf jeder
-- Route stehen, die geloggte "[location] ID=NN" ablesen und unten als
-- [NN] = "Route 205" eintragen. Der Name MUSS exakt zu einem Eintrag der
-- Encounter-Checkliste passen (siehe src/lib/routes.ts → Sinnoh), z. B.:
--   "Route 201" .. "Route 230", "Jubelstadt", "Erzelingen", "Ewigenau",
--   "Fleetburg", "Herzhofen", "Weideburg", "Schleiede", "Blizzach", "Sandgem",
--   "Zweiblattdorf", "See der Wahrheit" usw.  matchRoute() normalisiert tolerant.
local LOCATIONS = {
  platinum = {
    -- [<beobachtete ID>] = "Route 205",
    -- [<beobachtete ID>] = "Jubelstadt",
  },
}
local function locationName(game, id)
  local t = LOCATIONS[game]
  return (t and id ~= nil and t[id]) or nil
end

-- ── Kalibrierhilfe: Location-Adresse EINDEUTIG bestimmen ─────────────────────
-- RAM-Suche nach genau dem u16-Wert, der pro Gebiet konstant, zwischen Gebieten
-- verschieden ist und bei Rückkehr exakt denselben Wert wieder annimmt — also
-- die echte Map-/Location-ID (kein geratenes Mapping). BELIEBIG viele Gebiete,
-- vier Tasten:
--   [1] = NEUES Gebiet markieren (Gebiet zur Historie hinzufügen)
--   [2] = RÜCKKEHR: ich stehe in einem SCHON markierten Gebiet
--   [3] = STABILITÄT: danach ~2,5s im AKTUELLEN Gebiet UMHERLAUFEN
--   [4] = ABSCHLUSS: beste verbleibende Adresse automatisch wählen
--   [0] = alles zurücksetzen
-- Filter laufen automatisch und ergänzen sich:
--   – Injektivität ([1]): ein neues Gebiet darf NICHT denselben Wert wie ein früheres
--     haben → killt zufällige Treffer (eine echte Orts-ID ist pro Gebiet eindeutig).
--   – Konsistenz ([2]): bei Rückkehr MUSS der Wert wieder einem früheren Gebiet
--     entsprechen → killt Zähler/Spielzeit/RNG (steigen monoton, kehren nie zurück).
--   – Stabilität ([3]): Wert darf sich beim Umherlaufen IM Gebiet NICHT ändern →
--     killt X/Y-Position, Blickrichtung, Animations-/Schrittzähler (alles, was sich
--     innerhalb desselben Gebiets ändert, aber pro Mess-Snapshot zufällig passte).
-- Bei genau 1 Verhalten (identischer Werte-Vektor) setzt das Script location_addr
-- selbst; sonst wählt [4] deterministisch die am stärksten unterscheidende Adresse.
local LF = { addr = {}, slots = {}, nareas = 0, prev = {}, stab = nil }  -- slots[a][i] = Wert von Kandidat i in Gebiet a
local LOC_last = nil       -- zuletzt geloggte Location-ID (für Änderungs-Log)

local function lfDown(keys, names)
  for _, n in ipairs(names) do if keys[n] then return true end end
  return false
end
local function lfEdge(keys, names)
  return lfDown(keys, names) and not lfDown(LF.prev, names)
end

local function lfDomainSize(profile)
  local sz = 0
  pcall(function() sz = memory.getmemorydomainsize(profile.domain) end)
  if sz == 0 then pcall(function() sz = memory.getmemorydomainsize() end) end
  return sz
end

local function lfReset()
  LF.addr, LF.slots, LF.nareas, LF.stab = {}, {}, 0, nil
  console.log("[locfind] Zurueckgesetzt. Auf einem Gebiet stehen und [1] (neues Gebiet) druecken.")
end

-- Erst-Aufnahme: alle kleinen u16-Werte (plausible Map-IDs) als Kandidaten.
local function lfInit(profile)
  local size = lfDomainSize(profile)
  LF.addr, LF.slots, LF.nareas, LF.stab = {}, {}, 0, nil
  local base = 0
  while base < size do
    local readlen = math.min(CONFIG.scan_chunk + 2, size - base)
    local arr, bi = readArray(base, readlen)
    if arr then
      local maxo, o = readlen - 2, 0
      while o <= maxo do
        local v = (arr[bi + o] or 0) + (arr[bi + o + 1] or 0) * 0x100
        if v >= 1 and v <= 0x3FF then LF.addr[#LF.addr + 1] = base + o end
        o = o + 2
      end
    end
    base = base + math.min(CONFIG.scan_chunk, size - base)
  end
  console.log(string.format("[locfind] Basis: %d Kandidaten. [1] = neues Gebiet, [2] = Rueckkehr, [0] = Reset.", #LF.addr))
end

-- Überlebende (per keepIdx in die alten Arrays) neu aufbauen; optional Wert fürs neue Gebiet.
local function lfRebuild(keepIdx, newAreaIdx, keepCur)
  local na, nslots = {}, {}
  for a = 1, LF.nareas do nslots[a] = {} end
  if newAreaIdx then nslots[newAreaIdx] = {} end
  for k = 1, #keepIdx do
    local i = keepIdx[k]
    na[k] = LF.addr[i]
    for a = 1, LF.nareas do nslots[a][k] = LF.slots[a][i] end
    if newAreaIdx then nslots[newAreaIdx][k] = keepCur[k] end
  end
  LF.addr, LF.slots = na, nslots
  if newAreaIdx then LF.nareas = newAreaIdx end
end

-- location_addr endgültig setzen (sofort aktiv + Datei für Reloads).
local function lfAutoSet(pick, reason)
  CONFIG.location_addr = pick; LOC_last = nil
  local f = io.open("soullink_location_addr.txt", "w")
  if f then f:write(string.format("%s location_addr = 0x%X\n", CONFIG.game, pick)); f:close() end
  console.log(string.format("[locfind] location_addr = 0x%X ist AKTIV (%s). Fuer Reloads in CONFIG eintragen.", pick, reason))
  console.log("[locfind] Jetzt jede Route ablaufen — '[location] ID=NN' je Route in LOCATIONS eintragen.")
end

-- Auswertung nach jedem Filter: nach Werte-Vektor (= Verhalten) gruppieren.
-- Genau 1 Verhalten → eindeutig → auto-setzen. Sonst Gruppen + Optionen zeigen.
local function lfReport(action)
  local groups, order = {}, {}
  for k = 1, #LF.addr do
    local parts = {}
    for a = 1, LF.nareas do parts[a] = tostring(LF.slots[a][k]) end
    local key = table.concat(parts, ",")
    local g = groups[key]
    if not g then groups[key] = { addr = LF.addr[k], rep = k, count = 1 }; order[#order + 1] = key
    else g.count = g.count + 1; if LF.addr[k] < g.addr then g.addr = LF.addr[k] end end
  end
  local distinct = #order
  console.log(string.format("[locfind] %s · %d Gebiet(e) · %d Kandidaten · %d Verhalten.",
    action, LF.nareas, #LF.addr, distinct))

  if #LF.addr >= 1 and LF.nareas >= 2 and distinct == 1 then
    local pick = LF.addr[1]
    for k = 2, #LF.addr do if LF.addr[k] < pick then pick = LF.addr[k] end end
    lfAutoSet(pick, string.format("eindeutiges Verhalten · %d Adresse(n) identisch", #LF.addr))
  elseif distinct >= 2 and distinct <= 14 then
    for _, key in ipairs(order) do
      local g = groups[key]
      local vec = {}
      for a = 1, LF.nareas do vec[#vec + 1] = string.format("G%d=%s", a, tostring(LF.slots[a][g.rep])) end
      console.log(string.format("   0x%X  [%s]  (%d Adresse(n))", g.addr, table.concat(vec, " "), g.count))
    end
    console.log("   → Mehr unterscheiden: [3]=im Gebiet UMHERLAUFEN (killt Positions-/Animationswerte),")
    console.log("     [1]=neues Gebiet, [2]=Rueckkehr — oder [4]=beste Adresse automatisch waehlen.")
  elseif #LF.addr == 0 then
    console.log("   → 0 Kandidaten (zu aggressiv gefiltert?). [0] = Reset und neu starten.")
  else
    console.log("   → Noch viele Verhalten. [1]/[2] weiter, [3] umherlaufen, dann [4] zum Abschliessen.")
  end
end

-- [1] NEUES Gebiet: aufnehmen + Injektivität (kein früheres Gebiet hat denselben Wert).
local function lfNewArea(profile)
  if #LF.addr == 0 then lfInit(profile) end
  local a = LF.nareas + 1
  local keepIdx, keepCur = {}, {}
  for i = 1, #LF.addr do
    local cur = safeU16(LF.addr[i])
    local keep = (cur ~= nil and cur >= 0 and cur <= 0x3FF)
    if keep and a > 1 then
      for a2 = 1, LF.nareas do if LF.slots[a2][i] == cur then keep = false; break end end
    end
    if keep then keepIdx[#keepIdx + 1] = i; keepCur[#keepCur + 1] = cur end
  end
  lfRebuild(keepIdx, a, keepCur)
  lfReport("Neues Gebiet")
end

-- [2] RÜCKKEHR: aktueller Wert MUSS einem bereits erfassten Gebiet entsprechen.
local function lfRevisit()
  if #LF.addr == 0 or LF.nareas == 0 then
    console.log("[locfind] Erst mit [1] ein Gebiet aufnehmen."); return
  end
  local keepIdx = {}
  for i = 1, #LF.addr do
    local cur = safeU16(LF.addr[i])
    local keep = false
    if cur ~= nil then
      for a = 1, LF.nareas do if LF.slots[a][i] == cur then keep = true; break end end
    end
    if keep then keepIdx[#keepIdx + 1] = i end
  end
  lfRebuild(keepIdx)               -- kein neues Gebiet, nur filtern
  lfReport("Rueckkehr")
end

-- [3] Stabilität: startet ein Mehr-Frame-Fenster. Der Spieler LÄUFT im aktuellen
-- Gebiet umher; jeder Kandidat, dessen Wert sich dabei ändert, fliegt raus
-- (X/Y-Position, Blickrichtung, Animations-/Schrittzähler tun das, eine Map-ID nicht).
local function lfStabBegin()
  if #LF.addr == 0 then console.log("[locfind] Erst mit [1] ein Gebiet aufnehmen."); return end
  local base = {}
  for i = 1, #LF.addr do base[i] = safeU16(LF.addr[i]) end
  LF.stab = { base = base, changed = {}, frames = 150 }   -- ~2,5s bei 60 fps
  console.log("[locfind] Stabilitaet: jetzt ~2,5s im AKTUELLEN Gebiet UMHERLAUFEN (Gebiet NICHT verlassen)…")
end

-- [4] Abschluss: deterministisch die beste Adresse wählen — meiste verschiedene
-- Werte über die Gebiete (am stärksten unterscheidend), Gleichstand → kleinste Adresse.
local function lfFinalize()
  if #LF.addr == 0 then console.log("[locfind] Keine Kandidaten."); return end
  local bestK, bestD = 1, -1
  for k = 1, #LF.addr do
    local seen, d = {}, 0
    for a = 1, LF.nareas do local v = LF.slots[a][k]; if not seen[v] then seen[v] = true; d = d + 1 end end
    if d > bestD or (d == bestD and LF.addr[k] < LF.addr[bestK]) then bestK, bestD = k, d end
  end
  lfAutoSet(LF.addr[bestK], string.format("beste Wahl: %d versch. Werte ueber %d Gebiete", bestD, LF.nareas))
end

local function lfStep()
  local keys
  local ok = pcall(function() keys = input.get() end)
  if not ok or type(keys) ~= "table" then return end
  -- Laufendes Stabilitäts-Fenster: jeden Frame prüfen, am Ende filtern.
  if LF.stab then
    for i = 1, #LF.addr do
      local cur = safeU16(LF.addr[i])
      if cur ~= LF.stab.base[i] then LF.stab.changed[i] = true end
    end
    LF.stab.frames = LF.stab.frames - 1
    if LF.stab.frames <= 0 then
      local keepIdx = {}
      for i = 1, #LF.addr do if not LF.stab.changed[i] then keepIdx[#keepIdx + 1] = i end end
      LF.stab = nil
      lfRebuild(keepIdx)
      lfReport("Stabilitaet (Bewegung)")
    end
    LF.prev = keys
    return
  end
  local profile = PROFILES[CONFIG.game]
  if lfEdge(keys, {"Number0", "NumberPad0"}) then lfReset() end
  if lfEdge(keys, {"Number1", "NumberPad1"}) then lfNewArea(profile) end
  if lfEdge(keys, {"Number2", "NumberPad2"}) then lfRevisit() end
  if lfEdge(keys, {"Number3", "NumberPad3"}) then lfStabBegin() end
  if lfEdge(keys, {"Number4", "NumberPad4"}) then lfFinalize() end
  LF.prev = keys
end

-- Loggt die Location-ID bei jedem Wechsel (nur wenn location_addr gesetzt) →
-- Route ↔ ID festhalten und in LOCATIONS eintragen.
local function logLocationChange()
  if not CONFIG.location_addr then return end
  local lid = safeU16(CONFIG.location_addr)
  if lid ~= LOC_last then
    LOC_last = lid
    local nm = locationName(CONFIG.game, lid)
    console.log(string.format("[location] ID=%s  name=%s", tostring(lid), nm or "(noch nicht gemappt)"))
  end
end

-- ── Auto-Detect: Speicher in Frame-Chunks scannen ───────────────────────────
local DET = { running = false, base = 0, found = {}, size = 0, fails = 0, nextAt = 0, missStreak = 0,
              lo = 0, hi = 0, windowed = false, fullFallback = false }
-- So viele aufeinanderfolgende fehlgeschlagene Lead-Mon-Reads (je ~0,5s), bevor ein
-- erneuter Scan ausgelöst wird. Transiente Fehlversuche lösen damit KEINEN Scan aus.
local MISS_LIMIT = 20   -- ~10s

-- Back-off: ohne gefundenes Team (z. B. während der Starterauswahl) immer SELTENER
-- erneut prüfen → kein Dauerscan, kaum Last. ~5s, 10s, 20s, 40s, dann gedeckelt 60s.
local function retryDelay(fails)
  return math.floor(math.min(3600, 300 * 2 ^ math.min(math.max(fails, 1) - 1, 4)))
end

local saveCachedAddr   -- Persistenter Party-Cache (erst NACH OUT_FILE definiert)

local function detectStart(profile, hint)
  DET.running = true; DET.found = {}; DET.earlyStop = false
  DET.lastSig = nil                       -- nach (Neu-)Scan die nächste Party wieder senden
  profile.party_addr = nil; profile.team_size = nil
  local sz
  pcall(function() sz = memory.getmemorydomainsize(profile.domain) end)
  if not sz then pcall(function() sz = memory.getmemorydomainsize() end) end
  DET.size = sz or 0
  -- Scan-Fenster wählen: erst der Kernbereich (Hinweis = zuletzt bekannte Adresse,
  -- sonst die bekannte Gen-4-Region) → Party in wenigen Frames gefunden, kein Freeze.
  -- Voll-Scan nur als Fallback (DET.fullFallback), wenn das Fenster nichts findet.
  if DET.fullFallback or DET.size == 0 then
    DET.lo, DET.hi, DET.windowed = 0, DET.size, false
  elseif hint and hint > 0 then
    DET.lo = math.max(0, hint - 0x40000); DET.hi = math.min(DET.size, hint + 0x40000); DET.windowed = true
  elseif profile.scan_lo then
    DET.lo = math.min(profile.scan_lo, DET.size); DET.hi = math.min(profile.scan_hi, DET.size); DET.windowed = true
  else
    DET.lo, DET.hi, DET.windowed = 0, DET.size, false
  end
  DET.base = DET.lo
  if DET.fails == 0 then    -- nur beim ersten Versuch ankündigen (kein Spam beim Warten)
    console.log(string.format("[scan] Suche Party %s ... (0x%X..0x%X von %d KB)",
      DET.windowed and "im Kernbereich" or "vollstaendig", DET.lo, DET.hi, DET.size // 1024))
  end
  if DET.size == 0 then
    console.log("[scan] Domain '" .. profile.domain .. "' nicht lesbar. Verfügbar: "
      .. table.concat(memory.getmemorydomainlist(), ", "))
  end
end

-- Inkrementeller, ZEIT-BUDGETIERTER Scan: pro Frame wird nur so viel gescannt, wie
-- ins Frame-Budget (s. unten) passt (kleine 1-KB-Teilschritte). So entsteht NIE ein
-- 30–50ms-Block pro Frame — egal wie schnell der PC ist. Gibt true zurück, wenn
-- fertig. Wirft NIE: bei fehlgeschlagenem Read wird der Teilschritt übersprungen.
local SCAN_SUB = 0x400            -- 1 KB pro Teilschritt (feine Granularität → sehr dünn)
local function detectStep(profile)
  if DET.size <= 0 then return true end
  local hi = DET.hi or DET.size
  -- Erste Suche zügig (ein vorhandenes Team schnell finden); Wiederhol-Scans ohne
  -- Team (z. B. Starterauswahl) extra dünn → keine spürbaren Mikro-Freezes.
  local budget = (DET.fails == 0) and 0.0025 or 0.0010
  local t0 = os.clock()
  while DET.base < hi do
    local remaining = hi - DET.base
    local chunkLen = math.min(SCAN_SUB, remaining)
    -- + mon_size Überlappung, damit ein an der Teilschritt-Grenze beginnender Mon komplett ist
    local readLen = math.min(chunkLen + profile.mon_size, remaining)
    local arr, bi = readArray(DET.base, readLen)
    if arr then
      local maxO = readLen - profile.mon_size     -- nur Offsets, an denen ein ganzer Mon passt
      local lastO = math.min(chunkLen - 1, maxO)
      local o = 0
      while o <= lastO do
        local mon = validateGen4(arr, bi + o, profile.max_species)
        if mon then
          local a = DET.base + o
          DET.found[#DET.found + 1] = { addr = a, hp = mon.hp }
          -- Anker-Header (u32 @ addr-4 = 1..6) ⇒ mit hoher Sicherheit die Spieler-Party.
          -- Dann den Scan SOFORT beenden statt den restlichen RAM weiter zu entschlüsseln
          -- — das ist der eigentliche Freeze-Killer (Treffer meist schon im ersten Drittel).
          if a >= 4 then
            local cnt = safeU32(a - 4)
            if cnt and cnt >= 1 and cnt <= 6 then DET.earlyStop = true end
          end
        end
        o = o + 4
      end
    end
    DET.base = DET.base + chunkLen                 -- IMMER weiterrücken (auch bei Read-Fehler)
    if DET.earlyStop then DET.base = hi; break end -- Party gefunden → fertig (kein Weiterscannen)
    if (os.clock() - t0) >= budget then break end          -- Frame-Budget erschöpft → Rest nächster Frame
  end
  return DET.base >= hi
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

  -- Bewertung: der LÄNGSTE Lauf gültiger Party-Mon IST die Spieler-Party. Der
  -- Save-Block-Count-Header (u32 @ addr-4 = 1..6) ist nur noch ein BONUS, KEINE
  -- Pflicht mehr — manche ROMs/Save-Layouts (u. a. randomisiert) haben ihn nicht
  -- an dieser Stelle, was sonst zu endlosem Neuscan + Ruckeln führte. validateGen4
  -- ist extrem streng (Prüfsumme + Party-Stats); Box-Mon haben keine Party-Stats
  -- → Fehltreffer praktisch ausgeschlossen.
  local best, bestScore = nil, -1
  for _, r in ipairs(runs) do
    local count = (r.addr >= 4) and safeU32(r.addr - 4) or nil
    local anchored = (count ~= nil and count >= 1 and count <= 6)
    r.team = anchored and count or r.len
    local score = r.len * 100                                   -- längster Lauf gewinnt
    if anchored then
      score = score + 1000                                      -- echter Save-Block-Header → klarer Favorit
      if count == r.len then score = score + 500 end
      local clean = true
      for k = count, 5 do if (safeU32(r.addr + k * profile.mon_size) or 0) ~= 0 then clean = false; break end end
      if clean then score = score + 300 end
    end
    if r.hp and r.hp > 0 then score = score + 10 end            -- lebende Lead-Mon
    console.log(string.format("[scan] Kandidat @ 0x%X · %d Mon · count(-4)=%s · anchor=%s · score=%d",
      r.addr, r.len, tostring(count), tostring(anchored), score))
    if score > bestScore then best, bestScore = r, score end
  end

  if best then
    profile.party_addr = best.addr
    profile.team_size  = best.team
    profile.last_addr  = best.addr            -- Hinweis für eine spätere, schnelle Wieder-Erkennung
    console.log(string.format("[scan] OK Spieler-Party @ 0x%X · %d Pokemon%s",
      best.addr, best.team, bestScore >= 1000 and " (Header bestaetigt)" or " (laengster Lauf)"))
    devlog(string.format("Party gefunden @ 0x%X · %d Mon · %s", best.addr, best.team, bestScore >= 1000 and "Header" or "laengster Lauf"), "sync")
    if saveCachedAddr then saveCachedAddr(best.addr, best.team) end   -- persistent → nächster Start ohne Scan
  else
    profile.party_addr = nil; profile.team_size = nil
    -- Kein Team vorhanden (z. B. Starterauswahl): freundlich + selten melden, NICHT spammen.
    local now = os.clock()
    if (now - (DET.waitMsgAt or -100)) > 12 then
      DET.waitMsgAt = now
      console.log("[scan] Noch kein Team gefunden – warte auf dein erstes Pokemon. (Seltener, ruckelfreier Re-Check.)")
      devlog("[WARN] Kein Team gefunden — Re-Scan (z. B. Starterauswahl, oder Core/Domain pruefen)", "err")
    end
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

-- Billige Änderungs-Signatur der GANZEN Party aus ROHEN Bytes (KEINE Entschlüsselung):
-- pro Slot PID (0x00) + Block-Checksumme (0x06, ändert sich bei Block-Änderungen wie
-- Spezies/Attacken/Item/Spitzname) + die Party-Stat-Words (0x88/0x8C/0x8E, ändern sich
-- bei HP/Level/Status). Ändert sich nichts → identische Signatur → kein teures buildJson.
local function partySig(arr, bi, profile)
  local p = {}
  for s = 0, 5 do
    local b = bi + s * profile.mon_size
    p[#p + 1] = U32(arr, b) .. "." .. U16(arr, b + 6) .. "." ..
                U16(arr, b + 0x88) .. "." .. U16(arr, b + 0x8C) .. "." .. U16(arr, b + 0x8E)
  end
  return table.concat(p, "|")
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
local _dbgNickDone = false
-- strict=true  (Scan / Identitäts-Suche): verwirft bei Prüfsummen- ODER Range-Fehler.
-- strict=false (bekannte Party-Slots): die party_addr wurde vom Scan bereits
--   verifiziert → ein Slot mit pid≠0 und plausibler species IST ein Team-Mitglied.
--   Prüfsumme/Level/HP werden dann best-effort gelesen (geklemmt statt verworfen),
--   damit ein echtes Pokémon (z. B. frisch gefangenes) NIE aus dem Team fällt.
local function readMonRich(a, s, maxSpecies, strict)
  if strict == nil then strict = true end
  local pid = U32(a, s)
  if pid == 0 then return nil end                        -- leerer Slot → immer überspringen
  local chk = U16(a, s + 6)
  local seed, sum = chk, 0
  local w = {}
  for i = 0, 63 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    w[i] = U16(a, s + 8 + i * 2) ~ ((seed >> 16) & 0xFFFF)
    sum = (sum + w[i]) & 0xFFFF
  end
  if strict and sum ~= chk then return nil end           -- Prüfsumme nur im Scan harter Filter

  local ord = ORDERS[((pid >> 13) & 0x1F) % 24 + 1]
  local pA = (ord:find("A") - 1) * 16    -- Growth
  local pB = (ord:find("B") - 1) * 16    -- Attacks
  local pC = (ord:find("C") - 1) * 16    -- Misc/Condition (Nickname @ 0x48)

  local species = w[pA + 0]
  if species < 1 or species > maxSpecies then return nil end

  -- Einmalige Kalibrier-Ausgabe für den Spitznamen-Zeichensatz (Block C).
  if CONFIG.debug and not _dbgNickDone then
    _dbgNickDone = true
    local hex = {}
    for i = 0, 10 do hex[#hex + 1] = string.format("%04X", w[pC + i] or 0) end
    console.log("[SoulLink debug] Spitzname-Rohwerte (Block C): " .. table.concat(hex, " "))
    console.log("[SoulLink debug] Decode-Versuch: " .. tostring(decodeNick(w, pC)))
    console.log("[SoulLink debug] -> Diese 2 Zeilen + den echten Namen des 1. Pokemon melden = Zeichensatz wird exakt kalibriert.")
  end

  seed = pid
  local pd = {}
  for i = 0, 4 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    pd[i] = U16(a, s + 0x88 + i * 2) ~ ((seed >> 16) & 0xFFFF)
  end
  local level, curHp, maxHp = pd[2] & 0xFF, pd[3], pd[4]
  if strict then
    if level < 1 or level > 100 then return nil end
    if maxHp < 1 or maxHp > 1000 or curHp > maxHp then return nil end
  else
    -- best-effort für die bereits verifizierte Party: klemmen statt verwerfen
    if level < 1 then level = 1 elseif level > 100 then level = 100 end
    if maxHp < 0 then maxHp = 0 end
    if curHp < 0 then curHp = 0 end
    if maxHp > 0 and curHp > maxHp then curHp = maxHp end
  end

  return {
    speciesId = species, level = level, hp = curHp, maxHp = maxHp,
    status = statusToStr(pd[0]), fainted = (curHp == 0),
    pid = pid,                                    -- stabile Identität (überlebt Entwicklung)
    heldItemId = w[pA + 1],
    abilityId  = (w[pA + 6] >> 8) & 0xFF,        -- 0x0D
    natureId   = pid % 25,                        -- Gen 4: Wesen aus PID
    nickname   = decodeNick(w, pC),
    move1 = w[pB + 0], move2 = w[pB + 1], move3 = w[pB + 2], move4 = w[pB + 3],
    metLocationId = nil, metLocationName = nil, metLevel = nil,   -- Roadmap (Block D: Offsets je Edition noch unverifiziert)
  }
end

local function readMonRichAt(profile, slot)
  if not profile.party_addr then return nil end
  local arr, bi = readArray(profile.party_addr + slot * profile.mon_size, profile.mon_size)
  if not arr then return nil end
  return readMonRich(arr, bi, profile.max_species, false)   -- bekannte Party → lenient (nie ein echtes Mon verwerfen)
end

-- JSON-Helfer
local function jnum(v) return v == nil and "null" or tostring(v) end
local function jstr(s)
  if s == nil then return "null" end
  return '"' .. s:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
end

-- Slot-Diagnose: gibt einen lesbaren Status-String zurück, der exakt zeigt, WARUM
-- ein Slot bei STRIKTER Validierung scheitern würde (Prüfsumme / species / level /
-- maxHp / curHp). buildJson nutzt das für übersprungene Slots im Pipeline-Log.
local function diagSlot(profile, slot)
  if not profile.party_addr then return "kein party_addr" end
  local addr = profile.party_addr + slot * profile.mon_size
  local arr, bi = readArray(addr, profile.mon_size)
  if not arr then return string.format("Speicher unlesbar @ 0x%X", addr) end
  local pid = U32(arr, bi)
  if pid == 0 then return string.format("leer (pid=0 @ 0x%X)", addr) end
  local chk = U16(arr, bi + 6)
  local seed, sum, w = chk, 0, {}
  for i = 0, 63 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    w[i] = U16(arr, bi + 8 + i * 2) ~ ((seed >> 16) & 0xFFFF)
    sum = (sum + w[i]) & 0xFFFF
  end
  if sum ~= chk then
    return string.format("FAIL Pruefsumme: pid=0x%08X chk=%04X sum=%04X @ 0x%X", pid, chk, sum, addr)
  end
  local ord = ORDERS[((pid >> 13) & 0x1F) % 24 + 1]
  local pA = (ord:find("A") - 1) * 16
  local species = w[pA]
  seed = pid
  local pd = {}
  for i = 0, 4 do
    seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
    pd[i] = U16(arr, bi + 0x88 + i * 2) ~ ((seed >> 16) & 0xFFFF)
  end
  local level, curHp, maxHp = pd[2] & 0xFF, pd[3], pd[4]
  if species < 1 or species > profile.max_species then
    return string.format("FAIL species=%d ausserhalb 1..%d  pid=0x%08X", species, profile.max_species, pid)
  elseif level < 1 or level > 100 then
    return string.format("FAIL level=%d ausserhalb 1..100  species=%d  pid=0x%08X", level, species, pid)
  elseif maxHp < 1 or maxHp > 1000 then
    return string.format("FAIL maxHp=%d ausserhalb 1..1000  species=%d lv=%d  pid=0x%08X", maxHp, species, level, pid)
  elseif curHp > maxHp then
    return string.format("FAIL curHp=%d > maxHp=%d  species=%d lv=%d  pid=0x%08X", curHp, maxHp, species, level, pid)
  end
  return string.format("OK  species=%-3d  pid=0x%08X  lv=%-3d  hp=%d/%d  addr=0x%X",
    species, pid, level, curHp, maxHp, addr)
end

local _lastBuildKey = nil
local function buildJson(profile)
  local parts = {}
  local diag = {}                          -- pro Slot: lesbarer Status (Übernahme oder Grund)
  local got = 0
  -- Immer alle 6 Slots prüfen. Leere/freigegebene Slots sind in Gen 4 komplett genullt
  -- (pid == 0 → readMonRich gibt nil zurück → wird übersprungen). So werden auch
  -- neu gefangene Pokémon sofort gezeigt, ohne dass team_size korrekt aktualisiert
  -- sein muss (die Zahl bei party_addr-4 ist nicht immer der echte Live-Party-Zähler).
  for slot = 0, 5 do
    local m = readMonRichAt(profile, slot)
    if m then
      got = got + 1
      diag[#diag + 1] = string.format("Slot %d: ✓ species=%d pid=0x%08X lv=%d", slot + 1, m.speciesId, m.pid, m.level)
      parts[#parts + 1] = string.format(
        '{"slot":%d,"speciesId":%d,"pid":%s,"level":%d,"hp":%d,"maxHp":%d,"status":"%s","fainted":%s,'
        .. '"nickname":%s,"natureId":%s,"abilityId":%s,"heldItemId":%s,'
        .. '"moveIds":[%d,%d,%d,%d],"metLocationId":%s,"metLocationName":%s,"metLevel":%s}',
        slot + 1, m.speciesId, jnum(m.pid), m.level, m.hp, m.maxHp, m.status, tostring(m.fainted),
        jstr(m.nickname), jnum(m.natureId), jnum(m.abilityId), jnum(m.heldItemId),
        m.move1, m.move2, m.move3, m.move4, jnum(m.metLocationId), jstr(m.metLocationName), jnum(m.metLevel))
    else
      diag[#diag + 1] = string.format("Slot %d: – %s", slot + 1, diagSlot(profile, slot))
    end
  end
  -- Pipeline-Diagnose: NUR bei Änderung loggen (kein 2x/Sekunde-Spam).
  local key = table.concat(diag, " | ")
  if key ~= _lastBuildKey then
    _lastBuildKey = key
    console.log(string.format("[buildJson] party_addr=0x%X · team_size=%s · %d Pokemon ins team-Array:",
      profile.party_addr or 0, tostring(profile.team_size), got))
    for _, line in ipairs(diag) do console.log("   " .. line) end
  end
  -- Aktueller Ort (optional, via CONFIG.location_addr; sonst null)
  local locId = CONFIG.location_addr and safeU16(CONFIG.location_addr) or nil
  local locName = locationName(CONFIG.game, locId)
  return string.format(
    '{"game":"%s","trainer":"%s","capturedAt":%d,"currentLocationId":%s,"currentLocationName":%s,"team":[%s]}',
    CONFIG.game, CONFIG.trainer_name, os.time() * 1000, jnum(locId), jstr(locName), table.concat(parts, ","))
end

-- Zielpfad bestimmen: ENV (vom Companion gesetzt → lokaler AppData-Ordner) >
-- CONFIG.file_path > automatisch neben dem Script (Dev) > relativ.
local function resolveOutFile()
  local env = os.getenv("SOULLINK_TEAM_FILE")
  if env and env ~= "" then return env end
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

-- Persistenter Party-Adress-Cache (neben der Team-Datei). Nach der ERSTEN
-- erfolgreichen Erkennung wird die Adresse gespeichert; beim nächsten Start wird
-- sie nur noch validiert → KEIN Scan mehr (auch über Neustarts hinweg).
local PARTY_CACHE = (OUT_FILE:match("^(.*[/\\])") or "") .. "soullink_party_addr.txt"
saveCachedAddr = function(addr, team)   -- weist die oben deklarierte local zu
  local f = io.open(PARTY_CACHE, "w")
  if f then f:write(string.format("%s %d %d\n", CONFIG.game, addr, team or 0)); f:close() end
end
local function loadCachedAddr(profile)
  local f = io.open(PARTY_CACHE, "r"); if not f then return false end
  local line = f:read("*l"); f:close()
  if not line then return false end
  local g, a = line:match("^(%S+)%s+(%d+)")
  if g ~= CONFIG.game or not a then return false end
  -- Cache-Adresse ÜBERNEHMEN und KEINEN Start-Scan auslösen. Die tolerante
  -- Sync-Phase validiert sie laufend: ein vorübergehend fehlschlagender Read (Start
  -- mitten im Kampf/Menü) verwirft den Cache NICHT mehr; gesendet wird ohnehin nur
  -- bei erfolgreichem Read (kein Müll). Erst bei dauerhaftem Fehlschlag wird neu
  -- gesucht. → Nach dem ersten Erfolg: nie wieder ein Scan beim Start.
  profile.party_addr = tonumber(a)
  profile.last_addr = tonumber(a)          -- Hinweis für eine schnelle Wieder-Erkennung
  DET.missStreak = 0
  if readMon(profile, 0) then
    console.log(string.format("[scan] Party-Adresse aus Cache @ 0x%X — kein Scan noetig.", profile.party_addr))
    devlog(string.format("Cache-Hit: Party-Adresse @ 0x%X (kein Scan)", profile.party_addr), "sync")
  else
    console.log(string.format("[scan] Party-Adresse aus Cache @ 0x%X — wird im Spiel validiert.", profile.party_addr))
    devlog(string.format("Cache-Adresse @ 0x%X — wird im Spiel validiert", profile.party_addr), "sync")
  end
  return true
end

-- Atomarer Write: erst .tmp schreiben, dann über die Zieldatei umbenennen, damit
-- der Companion nie eine halbfertige Datei liest. Windows: rename scheitert über
-- eine existierende Datei → vorher entfernen; Fallback = direkter Write.
local function atomicWrite(path, data)
  local tmp = path .. ".tmp"
  local f = io.open(tmp, "w")
  if not f then
    local g = io.open(path, "w"); if g then g:write(data); g:close() end
    return
  end
  f:write(data); f:close()
  os.remove(path)
  if not os.rename(tmp, path) then
    local g = io.open(path, "w"); if g then g:write(data); g:close() end
    os.remove(tmp)
  end
end

local httpWarned = false
local _lastWrittenCount = -1
local _lastSig = nil          -- Inhalts-Signatur des zuletzt GESCHRIEBENEN JSON
local _lastWriteAt = -100     -- os.clock() des letzten Writes (Debounce)
local _slowWarnedAt = -100    -- Rate-Limit für die "Write zu langsam"-Warnung
local MIN_WRITE_INTERVAL = 0.4   -- s: nicht häufiger schreiben (Debounce); wird beim nächsten Emit nachgeholt
local SLOW_WRITE_MS = 50         -- ab hier gilt ein Write als zu langsam → Hinweis

-- Schreibt NUR bei echter Inhaltsänderung (volatiler capturedAt-Zeitstempel wird
-- ignoriert), atomar, debounced und mit Dauer-Messung. Im Stillstand entsteht so
-- KEIN Datei-I/O mehr → kein Emulator-Ruckeln durch Defender/Indexer/Cloud-Hooks.
local function emit(json)
  if CONFIG.test_mode == 1 then return end             -- Variante 2: gar nicht schreiben (nur Reads laufen)
  local sig = json:gsub('"capturedAt":%-?%d+', '')     -- volatilen Zeitstempel ausblenden
  if sig == _lastSig then return end                    -- nichts geändert → NICHT schreiben
  local now = os.clock()
  local minIv = (CONFIG.test_mode == 2) and 5.0 or MIN_WRITE_INTERVAL   -- Variante 3: höchstens alle 5 s
  if (now - _lastWriteAt) < minIv then return end       -- Debounce (nächster Emit holt es nach)
  _lastSig = sig
  _lastWriteAt = now

  local t0 = os.clock()
  atomicWrite(OUT_FILE, json)
  local ms = (os.clock() - t0) * 1000
  if PERF_ON then
    PERF.writes = PERF.writes + 1
    PERF.write_s = PERF.write_s + ms
    if ms > PERF.write_max then PERF.write_max = ms end
  end
  if ms > SLOW_WRITE_MS and (now - _slowWarnedAt) > 5 then
    _slowWarnedAt = now
    console.log(string.format(
      "[sync] WARN: Datei-Write dauerte %.0f ms. Tipp: SoulLink-Companion-AppData-Ordner in Windows Defender als Ausnahme hinzufuegen. Ziel=%s", ms, OUT_FILE))
    devlog(string.format("[WARN] Datei-Write langsam: %.0f ms (Ziel=%s)", ms, anonPath(OUT_FILE)), "err")
  end

  local _, n = json:gsub('"slot":', '')
  if n ~= _lastWrittenCount then
    _lastWrittenCount = n
    console.log(string.format("[writeJson] %d Pokemon nach %s geschrieben", n, OUT_FILE))
  end
  if CONFIG.output == "console" then console.log(json); return end
  if CONFIG.output ~= "http" then return end
  local ok = pcall(function()
    if comm.httpSetPostUrl then pcall(comm.httpSetPostUrl, CONFIG.http_url) end
    local sent = pcall(comm.httpPost, CONFIG.http_url, json)
    if not sent then comm.httpPost(json) end
  end)
  if not ok and not httpWarned then
    httpWarned = true
    console.log("[sync] comm.httpPost nicht verfuegbar — Daten liegen in " .. OUT_FILE)
  end
end

-- ── Init ────────────────────────────────────────────────────────────────────
local profile = PROFILES[CONFIG.game]
assert(profile, "Unbekanntes Spiel: " .. tostring(CONFIG.game))
pcall(function() memory.usememorydomain(profile.domain) end)

console.log("SoulLink Sync gestartet · Spiel=" .. CONFIG.game .. " · Output=" .. CONFIG.output)
if CONFIG.find_location then
  console.log("[locfind] AKTIV — Location-Adresse bestimmen (beliebig viele Gebiete):")
  console.log("[locfind]   [1] = NEUES Gebiet · [2] = RUECKKEHR · [3] = STABILITAET (umherlaufen) · [4] = ABSCHLUSS · [0] = Reset")
  console.log("[locfind]   Ablauf: 3-4 Gebiete je [1] → zu fruheren zurueck + [2] → bleibt es haengen: [3] (im")
  console.log("[locfind]   Gebiet umherlaufen) → wiederholen. Bei '1 Verhalten' auto; sonst [4] = beste Adresse.")
  console.log("[locfind]   Tasten IM EMULATOR-Fenster (nicht in der Lua-Console).")
end
if CONFIG.location_addr then
  console.log(string.format("[location] location_addr = 0x%X gesetzt — IDs werden bei Wechsel geloggt.", CONFIG.location_addr))
end
-- Erst den persistenten Cache versuchen (sofort, kein Scan); nur scannen, wenn keine
-- gültige Adresse gespeichert ist.
pcall(function() memory.usememorydomain(profile.domain) end)
if not loadCachedAddr(profile) then
  devlog("[WARN] Party-Adresse NICHT aus Cache — Voll-Scan beim Start", "err")
  detectStart(profile)
end

-- Ein Frame Arbeit (wird vom Loop in pcall ausgeführt)
-- (memory.usememorydomain wird EINMAL bei Init gesetzt — nicht mehr pro Frame, das
--  war 60 unnötige API-Aufrufe/s; die Domain bleibt über den Lauf konstant.)
local function stepOnce(frame)
  if CONFIG.find_location then lfStep() end                  -- Kalibrierhilfe (nur Lesen + Log)
  if frame % CONFIG.interval_frames == 0 then logLocationChange() end
  -- PERF: alle 60 Frames die Messwerte ausgeben + Fenster zurücksetzen. Da der
  -- Report FRAME-getaktet ist, ist FPS = 60/dt die ECHTE Emulationsgeschwindigkeit
  -- (Lua-Last + Emulation zusammen). 60 = flüssig, deutlich darunter = Ruckeln.
  if PERF_ON and frame > 0 and frame % 60 == 0 then
    local dt = os.clock() - PERF.t0
    local fps = dt > 0 and (60 / dt) or 0
    local line = string.format(
      "[perf] FPS~%.0f · Mode=%d · Writes=%d (uebersprungen=%d) · Reads=%d · buildJson O%.1f/max%.1f ms · Datei-Write O%.1f/max%.1f ms · Ziel=%s",
      fps, CONFIG.test_mode or 0, PERF.writes, PERF.emits - PERF.writes, PERF.reads,
      PERF.emits > 0 and PERF.build_s / PERF.emits or 0, PERF.build_max,
      PERF.writes > 0 and PERF.write_s / PERF.writes or 0, PERF.write_max, OUT_FILE)
    console.log(line)
    -- Dev-Log: Perf-Zeile ~alle 5s, FPS-Einbruch sofort als [WARN] (Pfad anonymisiert).
    if DEVLOG_DIR then
      if frame % 300 == 0 then devlog((line:gsub("· Ziel=.*$", "")), "perf") end
      if fps < 50 then devlog(string.format("[WARN] FPS niedrig: %.0f (Soll 60)", fps), "err") end
      if PERF.write_max > 50 then devlog(string.format("[WARN] Datei-Write Ausreisser: %.0f ms", PERF.write_max), "err") end
    end
    PERF.reads, PERF.emits, PERF.writes, PERF.build_s, PERF.build_max, PERF.write_s, PERF.write_max, PERF.t0 = 0, 0, 0, 0, 0, 0, 0, os.clock()
  end
  if DET.running then
    if detectStep(profile) then
      detectFinish(profile)
      if profile.party_addr then
        DET.fails = 0; DET.fullFallback = false                  -- gefunden → Zähler zurücksetzen
      elseif DET.windowed and not DET.fullFallback then
        -- Kernbereich leer → EINMAL sofort vollständig scannen (kein Back-off, kein Fail).
        DET.fullFallback = true
        detectStart(profile)
      else
        DET.fullFallback = false
        DET.fails = DET.fails + 1
        DET.nextAt = frame + retryDelay(DET.fails)               -- Back-off: immer seltener neu scannen
      end
    end
  elseif not profile.party_addr then
    -- Wieder-Erkennung startet beim zuletzt bekannten Ort (winziges Fenster → kein Freeze).
    if frame >= (DET.nextAt or 0) then detectStart(profile, profile.last_addr) end
  else
    if frame % CONFIG.interval_frames == 0 then
      -- EIN Bulk-Read der ganzen Party dient ZWEI Zwecken: Gültigkeitsprüfung (Lead-Mon)
      -- UND billige Änderungserkennung (partySig, ohne Entschlüsselung). Das teure
      -- buildJson (Entschlüsseln aller 6 Slots + JSON) läuft NUR bei echter Änderung →
      -- im Stillstand/Laufen praktisch keine Last (kein Mikro-Freeze).
      local arr, bi = readArray(profile.party_addr, 6 * profile.mon_size)
      local lead = arr and validateGen4(arr, bi, profile.max_species) or nil
      if lead then
        DET.missStreak = 0                        -- gültiger Read → Fehlserie zurücksetzen
        local sig = partySig(arr, bi, profile)
        if sig ~= DET.lastSig then                -- nur bei ECHTER Änderung weiterarbeiten
          DET.lastSig = sig
          local count = safeU32(profile.party_addr - 4)
          if count and count >= 1 and count <= 6 then profile.team_size = count end
          if PERF_ON then
            local t1 = os.clock(); local json = buildJson(profile); local t2 = os.clock()
            PERF.emits = PERF.emits + 1
            local b = (t2 - t1) * 1000
            PERF.build_s = PERF.build_s + b; if b > PERF.build_max then PERF.build_max = b end
            emit(json)          -- misst die Schreibdauer selbst (nur bei echter Änderung)
          else
            emit(buildJson(profile))
          end
        end
      else
        -- EINZELNER Fehlversuch (Kampf/Menü/Übergang/Save-Block) → letzten guten Stand
        -- behalten und NICHT sofort neu scannen (genau das verursachte die Freezes).
        -- Erst bei ANHALTENDEM Fehlschlag (~MISS_LIMIT Checks ≈ 10s) ist die Party
        -- wirklich weg → dann genau EINMAL neu suchen.
        DET.missStreak = (DET.missStreak or 0) + 1
        if DET.missStreak >= MISS_LIMIT then
          DET.missStreak = 0
          console.log("[sync] Party-Adresse dauerhaft ungueltig — suche einmal neu ...")
          devlog("[WARN] Party-Adresse verloren (anhaltend) — Neu-Scan ausgeloest", "err")
          detectStart(profile, profile.party_addr)   -- Hinweis: zuletzt bekannte Adresse → schnelles Fenster
        end
      end
    end
  end
end

-- ── DIAGNOSE-Profiler (CONFIG.profile) ───────────────────────────────────────
-- Misst JEDE Kernfunktion einzeln (n/total/avg/max). Wrappt die bereits
-- definierten locals; da Lua-Closures dieselbe Upvalue-Zelle teilen, werden auch
-- verschachtelte Aufrufe (stepOnce → buildJson → readMonRichAt → readArray …)
-- automatisch erfasst. Bericht alle 5 s, kumulativ → nach ~60 s stabil.
local PROF = {}
local PROF_t0 = os.clock()
local function profAdd(label, ms)
  local e = PROF[label]; if not e then e = { n = 0, sum = 0, max = 0 }; PROF[label] = e end
  e.n = e.n + 1; e.sum = e.sum + ms; if ms > e.max then e.max = ms end
end
if CONFIG.profile then
  local function wrap(label, fn)
    return function(...)
      local t = os.clock()
      local r = table.pack(fn(...))
      profAdd(label, (os.clock() - t) * 1000)
      return table.unpack(r, 1, r.n)
    end
  end
  readArray     = wrap('readArray(memRead)',    readArray)
  safeU16       = wrap('safeU16(memRead)',      safeU16)
  safeU32       = wrap('safeU32(memRead)',      safeU32)
  readMonRich   = wrap('readMonRich(decrypt)',  readMonRich)
  readMonRichAt = wrap('readMonRichAt(read+dec)', readMonRichAt)
  buildJson     = wrap('buildJson(team+JSON)',  buildJson)
  emit          = wrap('emit(write+sig)',       emit)
  detectStart   = wrap('detectStart(scaninit)', detectStart)
  detectStep    = wrap('detectStep(scan)',      detectStep)
  stepOnce      = wrap('stepOnce(TOTAL/frame)', stepOnce)
  console.log('[profile] AKTIV — Messung laeuft, Bericht alle 5 s. Bitte ~60 s normal spielen.')
end
local function profReport(frameNo)
  local dt = os.clock() - PROF_t0
  if dt <= 0 then return end
  local rows = {}
  for label, e in pairs(PROF) do rows[#rows + 1] = { label = label, n = e.n, sum = e.sum, max = e.max } end
  table.sort(rows, function(a, b) return a.sum > b.sum end)
  local head = string.format('===== [profile] %.0fs · Frames=%d · FPS~%.1f (Soll 60) =====', dt, frameNo, frameNo / dt)
  console.log(head); devlog(head, "perf")
  for _, r in ipairs(rows) do
    local row = string.format('  %-24s n=%-7d total=%9.1f ms  avg=%7.3f ms  max=%7.1f ms',
      r.label, r.n, r.sum, r.n > 0 and r.sum / r.n or 0, r.max)
    console.log(row); devlog(row, "perf")
  end
end

-- ── Loop (stürzt nie ab) ─────────────────────────────────────────────────────
local frame = 0
while true do
  local ok, err = pcall(stepOnce, frame)
  if not ok then console.log("[sync] Frame uebersprungen: " .. tostring(err)) end
  if CONFIG.profile and frame > 0 and frame % 300 == 0 then profReport(frame) end
  frame = frame + 1
  emu.frameadvance()
end
