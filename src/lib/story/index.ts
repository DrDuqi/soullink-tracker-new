import { useEffect, useMemo, useState } from 'react'
import { useEmuTeamStore } from '../../store/emuTeamStore'
import { getLearnedRoute } from '../locationMap'
import { platinum } from './platinum'
import type { Story } from './types'

export type { Story, StoryChapter, StoryTrainer, GymInfo, StoryItem } from './types'

// Registry. Add an edition by dropping in another Story and registering it here.
const STORIES: Story[] = [platinum]

// Accept emulator codes ("platinum") and German labels ("Pokémon Platin", "Platin").
const ALIASES: Record<string, string> = {
  platinum: 'platinum', platin: 'platinum', 'pokémon platin': 'platinum', 'pokemon platin': 'platinum',
}

export function getStory(game: string | null | undefined): Story | null {
  if (!game) return null
  const k = game.toLowerCase().trim()
  const key = ALIASES[k] ?? k
  return STORIES.find((s) => s.game === key) ?? null
}

export function supportedStories(): Story[] { return STORIES }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, '')

/** Find the chapter whose locations match the live location name (fuzzy). */
export function resolveChapterIndex(story: Story, locationName: string | null): number | null {
  if (!locationName) return null
  const target = norm(locationName)
  if (!target) return null
  for (let i = 0; i < story.chapters.length; i++) {
    if (story.chapters[i].locations.some((l) => {
      const n = norm(l)
      return n === target || target.includes(n) || n.includes(target)
    })) return i
  }
  return null
}

export interface StoryProgress {
  story: Story | null
  activeIndex: number
  detectedIndex: number | null   // null = live location not recognised / no sync
  locationName: string | null
  connected: boolean
  teamAvgLevel: number | null
  isManual: boolean              // true when the user navigated away from the live chapter
  setViewed: (i: number | null) => void
}

/** Live story progress: edition + current chapter derived from the emulator, with
 *  manual override that snaps back whenever the player actually moves in-game. */
export function useStoryProgress(runGame: string | null): StoryProgress {
  const emuGame = useEmuTeamStore((s) => s.game)
  const locationName = useEmuTeamStore((s) => s.currentLocationName)
  const locationId = useEmuTeamStore((s) => s.currentLocationId)
  const connected = useEmuTeamStore((s) => s.connected)
  const team = useEmuTeamStore((s) => s.team)

  const story = useMemo(() => getStory(emuGame) ?? getStory(runGame), [emuGame, runGame])
  // Prefer the name the Lua sends; fall back to the app's learned id → route map.
  const effectiveLocation = useMemo(
    () => locationName ?? getLearnedRoute(emuGame ?? '', locationId),
    [locationName, emuGame, locationId],
  )
  const detectedIndex = useMemo(() => (story ? resolveChapterIndex(story, effectiveLocation) : null), [story, effectiveLocation])

  const [viewed, setViewed] = useState<number | null>(null)
  // Auto-advance: when the detected chapter changes (player moved), follow it.
  useEffect(() => { if (detectedIndex != null) setViewed(null) }, [detectedIndex])

  const activeIndex = viewed ?? detectedIndex ?? 0
  const teamAvgLevel = team.length ? Math.round(team.reduce((a, m) => a + (m.level || 0), 0) / team.length) : null

  return {
    story, activeIndex, detectedIndex, locationName: effectiveLocation, connected, teamAvgLevel,
    isManual: viewed != null && viewed !== detectedIndex,
    setViewed,
  }
}
