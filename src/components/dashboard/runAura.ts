// Per-Pokémon "aura" so every run card feels unique: a themed glow/fog/light-ray +
// particle colour & motion that matches the creature's element (Glurak → Glut/Rauch,
// Lucario → blaue Aura, Dragoran → Wind, Mewtu → Psycho, Darkrai → Schatten …).
// Driven by the dex number the dashboard already derives per run (RUN_ART), so it stays
// deterministic and stable per run.

export type AuraKind = 'ember' | 'bubble' | 'spark' | 'mote' | 'smoke' | 'leaf' | 'frost'
export interface Aura {
  glow: string   // radial glow behind the Pokémon + drop-shadow colour
  fog: string    // soft drifting fog tint
  ray: string    // slow light-ray colour
  particle: string
  kind: AuraKind
}

const T = {
  fire:     { glow: 'rgba(255,120,40,0.50)',  fog: 'rgba(255,90,30,0.10)',   ray: 'rgba(255,175,80,0.55)',  particle: 'rgba(255,160,60,0.95)',  kind: 'ember'  as AuraKind },
  water:    { glow: 'rgba(40,160,255,0.48)',  fog: 'rgba(40,140,255,0.10)',  ray: 'rgba(130,210,255,0.5)',  particle: 'rgba(140,212,255,0.95)', kind: 'bubble' as AuraKind },
  grass:    { glow: 'rgba(60,210,120,0.45)',  fog: 'rgba(50,200,110,0.09)',  ray: 'rgba(150,240,175,0.5)',  particle: 'rgba(150,240,170,0.92)', kind: 'leaf'   as AuraKind },
  dragon:   { glow: 'rgba(120,140,255,0.50)', fog: 'rgba(110,130,255,0.10)', ray: 'rgba(185,200,255,0.55)', particle: 'rgba(185,205,255,0.92)', kind: 'mote'   as AuraKind },
  ice:      { glow: 'rgba(120,225,255,0.50)', fog: 'rgba(150,225,255,0.10)', ray: 'rgba(210,240,255,0.6)',  particle: 'rgba(215,242,255,0.95)', kind: 'frost'  as AuraKind },
  psychic:  { glow: 'rgba(210,90,255,0.50)',  fog: 'rgba(190,80,255,0.10)',  ray: 'rgba(230,150,255,0.55)', particle: 'rgba(232,150,255,0.95)', kind: 'mote'   as AuraKind },
  fairy:    { glow: 'rgba(255,140,220,0.48)', fog: 'rgba(255,140,215,0.10)', ray: 'rgba(255,185,232,0.55)', particle: 'rgba(255,185,230,0.95)', kind: 'spark'  as AuraKind },
  shadow:   { glow: 'rgba(150,80,255,0.42)',  fog: 'rgba(90,60,150,0.16)',   ray: 'rgba(150,110,210,0.4)',  particle: 'rgba(175,140,225,0.85)', kind: 'smoke'  as AuraKind },
  electric: { glow: 'rgba(255,210,60,0.50)',  fog: 'rgba(255,210,60,0.09)',  ray: 'rgba(255,235,130,0.6)',  particle: 'rgba(255,232,120,0.98)', kind: 'spark'  as AuraKind },
  aura:     { glow: 'rgba(70,140,255,0.50)',  fog: 'rgba(60,130,255,0.10)',  ray: 'rgba(150,185,255,0.55)', particle: 'rgba(150,185,255,0.95)', kind: 'mote'   as AuraKind },
} as const

// dex → element (the cinematic line-up the dashboard uses for RUN_ART).
const DEX: Record<number, keyof typeof T> = {
  6: 'fire', 257: 'fire', 392: 'fire', 663: 'fire',
  9: 'water', 130: 'water', 260: 'water', 350: 'water', 230: 'water', 658: 'water',
  3: 'grass', 254: 'grass',
  149: 'dragon', 445: 'dragon', 373: 'dragon', 612: 'dragon',
  131: 'ice', 461: 'ice',
  448: 'aura',
  94: 'shadow', 248: 'shadow',
  282: 'fairy', 700: 'fairy',
  475: 'psychic',
}

export function auraForDex(dex: number): Aura { return T[DEX[dex] ?? 'aura'] }

// Cinematic, fully-evolved/legendary line-up → each run gets a stable, distinct "hero"
// (deterministic per run id). Official-artwork CDN.
export const RUN_DEX = [6, 9, 3, 149, 130, 131, 448, 94, 257, 392, 248, 260, 254, 282, 445, 373, 350, 230, 461, 475, 612, 700, 663, 658]
export function dexForRun(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return RUN_DEX[h % RUN_DEX.length]
}
export const artUrl = (dex: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`

// Deterministic particle field per run (stable across re-renders). Returns inline-style
// objects for a handful of particles whose size/position/speed vary by aura kind.
export interface Particle { left: string; bottom: string; w: number; h: number; d: string; delay: string; o: string }
export function particlesFor(seed: string, a: Aura, count = 9): Particle[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000 }
  const big = a.kind === 'smoke', tiny = a.kind === 'spark' || a.kind === 'frost'
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const base = big ? 7 : tiny ? 2 : 4
    const size = base + Math.round(rnd() * (big ? 8 : tiny ? 2 : 4))
    out.push({
      left: `${48 + rnd() * 46}%`,                 // mostly under the Pokémon (right side)
      bottom: `${4 + rnd() * 30}%`,
      w: size, h: size,
      d: `${(tiny ? 3.5 : big ? 9 : 6) + rnd() * 4}s`,
      delay: `${rnd() * 6}s`,
      o: (big ? 0.32 : tiny ? 0.85 : 0.6).toFixed(2),
    })
  }
  return out
}
