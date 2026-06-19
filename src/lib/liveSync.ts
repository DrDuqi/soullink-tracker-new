import { fetchPokemon, fetchMoveById, fetchItemName } from './pokemon-api'
import { matchRoute } from './routes'
import { getLearnedRoute } from './locationMap'
import type { PokemonBasic } from './pokemon-api'
import type { EmulatorMon } from './emulatorSync'
import type { Encounter, PokemonStatus } from '../types/database'

/**
 * Live-sync domain model.
 *
 * There is ONE encounter table; an encounter is either MANUAL or LIVE (emulator-
 * synced). The single discriminator is `emu_pid`: present ⇒ the row is driven by
 * the Lua live-sync, absent ⇒ a fully hand-edited encounter. Everything that needs
 * to know "is this live and which fields are locked?" goes through this module, so
 * adding a new live field or a new editable field is a one-line change here instead
 * of a new special-case sprinkled across components.
 */

/** Pre-fill handed to AddEncounterModal (manual add or emulator import). */
export interface EncounterPrefill {
  pokemon?: PokemonBasic
  nickname?: string | null
  status?: PokemonStatus
  moves?: (string | null)[]      // up to 4 move names → move_1..4
  note?: string                  // seeded into notes (e.g. level — no level column)
  emuPid?: string | null         // stable emulator identity → marks the row LIVE
  emuLocationId?: number | null  // current location id → optional id→route learning
  // Read-only live data shown in the import modal (from Lua, never editable):
  level?: number | null
  hp?: number | null
  maxHp?: number | null
  item?: string | null
}

/** Fields owned exclusively by Lua for a live encounter — read-only everywhere. */
export const LIVE_FIELDS = [
  'pokemon', 'evolution', 'level', 'exp', 'hp', 'status', 'moves',
  'ability', 'item', 'pid', 'team', 'box', 'shiny', 'gender', 'form',
] as const

/** Fields the user always controls (Lua does not need them). */
export const MANUAL_FIELDS = ['route', 'notes', 'nickname', 'death', 'soullink', 'tags'] as const

export const LIVE_SYNC_NOTICE = 'Dieses Pokémon wird live vom Emulator synchronisiert.'
export const LIVE_SYNC_DETAIL =
  'Art, Entwicklung, Level, HP, Status, Attacken, Fähigkeit, Item, Shiny, Geschlecht und Form kommen aus Lua und werden automatisch aktualisiert. Manuell änderbar bleiben Route, Spitzname, Notizen, Tod/Status und SoulLinks.'

/** An encounter is LIVE iff it carries the stable emulator PID. */
export function isLiveSynced(enc: Pick<Encounter, 'emu_pid'> | null | undefined): boolean {
  return !!enc?.emu_pid
}

/** What may the user edit on this encounter? Single source of truth for the UI. */
export interface EditPermissions {
  species: boolean   // change species / evolve / devolve
  moves: boolean
  ability: boolean
  item: boolean
  // Always-manual regardless of live state:
  nickname: boolean
  notes: boolean
  route: boolean
  status: boolean    // tracker status incl. death/boxed
}
export function editPermissions(enc: Pick<Encounter, 'emu_pid'> | null | undefined): EditPermissions {
  const live = isLiveSynced(enc)
  return {
    species: !live,
    moves: !live,
    ability: !live,
    item: !live,
    nickname: true,
    notes: true,
    route: true,
    status: true,
  }
}

export interface BuildPrefillOpts {
  game: string                       // RUN edition (decides the routes)
  currentLocationName: string | null
  currentLocationId: number | null
  suppressLocation: boolean          // emulator game ≠ run edition → no route / no learning
}

/**
 * Builds the import prefill + a suggested route from one live emulator mon.
 * Shared by the live panel and the team GhostSlot so the import behaves identically
 * everywhere. Route is OPTIONAL: learned id→route first, then a met/current-location
 * exact match; on mismatch (or no safe source) the route is left empty for manual pick.
 */
export async function buildLivePrefill(
  mon: EmulatorMon,
  opts: BuildPrefillOpts,
): Promise<{ prefill: EncounterPrefill; route?: string } | null> {
  const poke = await fetchPokemon(mon.speciesId)
  if (!poke) return null

  const ids = (mon.moveIds ?? []).filter((x) => x > 0)
  const mv = await Promise.all(ids.map((id) => fetchMoveById(id)))
  const item = mon.heldItemId ? await fetchItemName(mon.heldItemId) : null

  const route = opts.suppressLocation
    ? undefined
    : getLearnedRoute(opts.game, opts.currentLocationId) ??
      matchRoute(mon.metLocationName ?? opts.currentLocationName ?? null, opts.game) ??
      undefined

  const prefill: EncounterPrefill = {
    pokemon: poke,
    nickname: mon.nickname ?? null,
    status: mon.fainted ? 'dead' : 'alive',
    moves: mv.map((m) => m?.name ?? null),
    note: `Aus Emulator · Lv ${mon.level}`,
    emuPid: mon.pid != null ? String(mon.pid) : null,
    emuLocationId: opts.suppressLocation ? null : opts.currentLocationId ?? null,
    level: mon.level,
    hp: mon.hp,
    maxHp: mon.maxHp,
    item,
  }
  return { prefill, route }
}
