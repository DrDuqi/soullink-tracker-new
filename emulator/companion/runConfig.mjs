// Per-run BizHawk config — the core of run isolation.
//
// BizHawk stores SaveRAM, save states, screenshots and cheats in folders that are
// SHARED across all ROMs of a system (./SaveRAM, ./State, …), keyed only by ROM
// basename. That let data from other runs surface (e.g. loading a stray save state,
// or a basename collision). To make a run a real sandbox, we launch EmuHawk with
// `--config=<run>/EmuHawkConfig.ini` whose path entries point those four folders
// INTO the run's own folder. A run's State folder then only ever holds that run's
// states — cross-run contamination is structurally impossible.
//
// We clone the user's base config so their controls/cores/hotkeys are preserved and
// only redirect the save-related paths; we also enable periodic SaveRAM autosave so
// an in-game save survives an unclean close, and we never auto-load a save STATE.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

// The four path types that hold per-run data → redirected into the run folder.
const TYPE_DIR = { 'Save RAM': 'SaveRAM', 'Savestates': 'State', 'Screenshots': 'Screenshots', 'Cheats': 'Cheats' }

/**
 * Write (or refresh) a run's isolated EmuHawk config and return its absolute path.
 * Returns null when there's no base config to clone → caller launches without
 * --config (shared folders, old behaviour) instead of failing.
 */
export function ensureRunBizhawkConfig({ runId, bizhawkPath, runDir, legacySaveName }) {
  if (!bizhawkPath || !runDir) return null
  const baseCfg = join(dirname(bizhawkPath), 'config.ini')
  if (!existsSync(baseCfg)) return null
  let cfg
  try { cfg = JSON.parse(readFileSync(baseCfg, 'utf8')) } catch { return null }

  // Per-run subfolders for each save-related type.
  const dirs = {}
  for (const [type, sub] of Object.entries(TYPE_DIR)) {
    const d = join(runDir, sub)
    try { mkdirSync(d, { recursive: true }) } catch { /* ignore */ }
    dirs[type] = d
  }

  // Redirect every matching path entry (all systems) to the run folder. Leave Base/
  // ROM/Firmware/Lua/Tools alone so shared install resources (firmware!) still resolve.
  try {
    const paths = cfg?.PathEntries?.Paths
    if (Array.isArray(paths)) for (const p of paths) { if (p && dirs[p.Type]) p.Path = dirs[p.Type] }
  } catch { /* ignore — fall through to writing what we have */ }

  // In-game SaveRAM is the canonical save: flush it automatically (survives an
  // unclean close) and keep a backup. Never auto-load/save a save STATE slot — the
  // SoulLink workflow must never depend on emulator snapshots.
  cfg.AutosaveSaveRAM = true
  cfg.BackupSaveram = true
  cfg.AutoLoadLastSaveSlot = false
  cfg.AutoSaveLastSaveSlot = false

  // One-time migration: an existing run's SaveRAM may still sit in the OLD shared
  // location (BizHawk/NDS/SaveRAM/<saveName>). Copy it into the run folder once so
  // switching to per-run paths never loses current progress.
  if (legacySaveName) {
    const oldSave = join(dirname(bizhawkPath), 'NDS', 'SaveRAM', legacySaveName)
    const newSave = join(dirs['Save RAM'], legacySaveName)
    try {
      if (existsSync(oldSave) && !existsSync(newSave)) {
        copyFileSync(oldSave, newSave)
        if (existsSync(oldSave + '.bak')) copyFileSync(oldSave + '.bak', newSave + '.bak')
      }
    } catch { /* ignore */ }
  }

  const out = join(runDir, 'EmuHawkConfig.ini')
  try { writeFileSync(out, JSON.stringify(cfg, null, 2)) } catch { return null }
  return out
}
