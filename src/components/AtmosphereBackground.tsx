import { useEffect, useMemo, useRef } from 'react'

// AAA launcher backdrop — ONE cohesive cinematic scene (not floating PNGs on a gradient).
// A volcanic warm LEFT (Charizard rising from lava — glow, embers, ash, smoke), a stormy
// cool RIGHT (Rayquaza in the sky — lightning, energy motes, mist), and a calm cosmic
// CENTER (giant moon, god-rays, starfield) where the two worlds meet. Built from layered
// gradients + SVG terrain + graded official artwork + particle systems across several
// parallax depth layers. Pure transform/opacity/filter (GPU only); a pure background
// layer (z-0, pointer-events:none) → never affects layout or interaction. Reduced-motion
// and the "Hintergrundeffekte deaktivieren" flag (handled in AppShell) switch it off.

type Slot = 'volcano' | 'sky' | 'ground' | 'back'
interface Mon { id: number; slot: Slot; glow: string; flip?: boolean }

// Per-slot framing (epic, partly off-frame), grading + parallax depth, matched to the
// light of its zone so each creature reads as part of the world, not a sticker.
const SLOTS: Record<Slot, { pos: React.CSSProperties; size: string; op: number; blur: number; bright: number; sat: number; rot: string; pl: number; pt: number }> = {
  volcano: { pos: { left: '-9%',  bottom: '-8%' }, size: 'min(680px,50vw)', op: 0.62, blur: 0.5, bright: 0.74, sat: 1.05, rot: '0deg',   pl: 7, pt: 5 },   // Charizard — rises from the lava (left)
  sky:     { pos: { right: '-11%', top: '-10%' },  size: 'min(900px,64vw)', op: 0.42, blur: 1.2, bright: 0.60, sat: 0.95, rot: '-8deg',  pl: 5, pt: 4 },   // Rayquaza — arcs across the storm (upper right)
  ground:  { pos: { right: '3%',   bottom: '-5%' }, size: 'min(360px,26vw)', op: 0.50, blur: 0.7, bright: 0.50, sat: 0.95, rot: '0deg',   pl: 9, pt: 6 },   // Lucario — grounded on the foreground rock (bottom right)
  back:    { pos: { top: '2%',     left: '40%' },   size: 'min(420px,30vw)', op: 0.16, blur: 3.4, bright: 0.40, sat: 0.55, rot: '0deg',   pl: 2, pt: 2 },
}

// Edition-aware cast (same epic composition; only the legendaries + their glow swap).
const SETS: Record<string, Mon[]> = {
  default:  [ { id: 6,   slot: 'volcano', glow: 'rgba(255,110,40,0.55)', flip: true }, { id: 384, slot: 'sky', glow: 'rgba(70,200,150,0.5)' }, { id: 448, slot: 'ground', glow: 'rgba(80,150,255,0.5)' } ], // Charizard · Rayquaza · Lucario
  platinum: [ { id: 487, slot: 'sky', glow: 'rgba(190,60,230,0.5)' }, { id: 483, slot: 'volcano', glow: 'rgba(120,170,255,0.5)', flip: true }, { id: 484, slot: 'ground', glow: 'rgba(220,60,150,0.5)' } ], // Giratina · Dialga · Palkia
  hgss:     [ { id: 250, slot: 'volcano', glow: 'rgba(255,150,40,0.55)', flip: true }, { id: 249, slot: 'sky', glow: 'rgba(120,170,255,0.5)' }, { id: 245, slot: 'ground', glow: 'rgba(70,200,210,0.5)' } ], // Ho-Oh · Lugia · Suicune
  bw:       [ { id: 643, slot: 'volcano', glow: 'rgba(255,180,90,0.5)', flip: true }, { id: 644, slot: 'sky', glow: 'rgba(90,120,255,0.5)' }, { id: 646, slot: 'ground', glow: 'rgba(120,200,230,0.45)' } ], // Reshiram · Zekrom · Kyurem
  xy:       [ { id: 717, slot: 'sky', glow: 'rgba(220,50,60,0.5)' }, { id: 716, slot: 'volcano', glow: 'rgba(90,170,255,0.5)', flip: true } ], // Yveltal · Xerneas
  sv:       [ { id: 1007, slot: 'volcano', glow: 'rgba(230,70,50,0.55)', flip: true }, { id: 1008, slot: 'sky', glow: 'rgba(155,80,230,0.5)' } ], // Koraidon · Miraidon
}
function setFor(game?: string): Mon[] {
  const g = (game || '').toLowerCase()
  if (/platin|platinum|diamant|perl/.test(g)) return SETS.platinum
  if (/heart|soul|hg|ss|gold|silber/.test(g)) return SETS.hgss
  if (/schwarz|wei|black|white|einall|unova/.test(g)) return SETS.bw
  if (/karmes|purpur|scarlet|violet|paldea/.test(g)) return SETS.sv
  if (/kalos|^x$|^y$| x | y |x\/y/.test(g)) return SETS.xy
  return SETS.default
}
const ART = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
const MASK = 'radial-gradient(125% 130% at 50% 40%, #000 52%, transparent 88%)'

// Deterministic PRNG so the particle field is stable across re-renders.
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

export default function AtmosphereBackground({ game }: { game?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mons = setFor(game)

  // Particle fields (biased per zone). Generated once.
  const fields = useMemo(() => {
    const r = rng(0x50415254)
    const embers = Array.from({ length: 16 }, () => ({ left: 2 + r() * 40, bottom: -2 + r() * 34, w: 2 + r() * 4, d: 5.5 + r() * 5, delay: r() * 8, dx: (r() * 2 - 1) * 26, o: (0.6 + r() * 0.4).toFixed(2) }))
    const ash = Array.from({ length: 12 }, () => ({ left: r() * 55, top: -4 + r() * 30, w: 2 + r() * 3, d: 11 + r() * 8, delay: r() * 10, dx: -(10 + r() * 40) }))
    const sparks = Array.from({ length: 8 }, () => ({ left: 4 + r() * 36, bottom: 2 + r() * 26, d: 2.4 + r() * 2.4, delay: r() * 6 }))
    const motes = Array.from({ length: 14 }, () => ({ left: 56 + r() * 42, top: 8 + r() * 70, w: 2 + r() * 4, d: 7 + r() * 6, delay: r() * 8, o: (0.55 + r() * 0.4).toFixed(2), green: r() > 0.5 }))
    const smoke = Array.from({ length: 5 }, () => ({ left: 2 + r() * 28, bottom: -6 + r() * 16, w: 120 + r() * 160, d: 9 + r() * 6, delay: r() * 7 }))
    return { embers, ash, sparks, motes, smoke }
  }, [])

  // Subtle mouse parallax (2–9px by layer), RAF-throttled → sets --mx/--my.
  useEffect(() => {
    const el = rootRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0, tx = 0, ty = 0
    const apply = () => { raf = 0; el.style.setProperty('--mx', tx.toFixed(3)); el.style.setProperty('--my', ty.toFixed(3)) }
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={rootRef} className="atmo fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* L0 · base sky: warm volcanic LEFT → cosmic CENTER → cool storm RIGHT */}
      <div className="absolute inset-0" style={{ background: [
        'radial-gradient(70% 80% at 12% 100%, rgba(150,40,18,0.30) 0%, transparent 58%)',   // volcano bloom (left/bottom)
        'radial-gradient(70% 80% at 90% 6%, rgba(18,70,120,0.28) 0%, transparent 56%)',      // storm bloom (right/top)
        'radial-gradient(40% 50% at 88% 70%, rgba(24,120,90,0.16) 0%, transparent 60%)',     // green energy (right)
        'linear-gradient(100deg, #1a0a07 0%, #120a0e 30%, #0a0810 50%, #08090f 66%, #08121a 100%)',
      ].join(', ') }} />

      {/* L1 · starfield + drifting nebulae (recoloured warm/cool) */}
      <div className="cine-layer" style={{ ['--d' as string]: '2px' }}>
        <div className="atmo-stars atmo-stars-1" />
        <div className="atmo-stars atmo-stars-2" />
        <div className="atmo-neb atmo-neb-r" />
        <div className="atmo-neb atmo-neb-b" />
        <div className="atmo-neb atmo-neb-c" />
      </div>

      {/* L2 · giant moon (cosmic centre) + halo */}
      <div className="cine-layer" style={{ ['--d' as string]: '3px' }}>
        <div className="cine-moon" style={{ top: '4%', left: '47%', width: 'clamp(260px,24vw,440px)', aspectRatio: '1',
          background: 'radial-gradient(circle at 42% 38%, #e8ecf6 0%, #c3cad9 30%, #8f97ab 60%, #5c6479 82%, #3a4053 100%)',
          opacity: 0.9 }} />
        <div className="absolute" style={{ top: '0%', left: '40%', width: 'clamp(360px,34vw,640px)', aspectRatio: '1',
          background: 'radial-gradient(circle, rgba(150,170,210,0.16), transparent 66%)', filter: 'blur(6px)' }} />
      </div>

      {/* L3 · god-ray light shafts from the upper centre */}
      <div className="cine-layer" style={{ ['--d' as string]: '4px' }}>
        <div className="cine-ray" style={{ left: '34%', width: '120px', ['--ray-rot' as string]: '12deg', ['--d' as string]: '13s', background: 'linear-gradient(180deg, rgba(200,215,255,0.5), transparent 72%)' }} />
        <div className="cine-ray" style={{ left: '52%', width: '180px', ['--ray-rot' as string]: '4deg', ['--d' as string]: '17s', background: 'linear-gradient(180deg, rgba(210,225,255,0.42), transparent 70%)' }} />
        <div className="cine-ray" style={{ left: '66%', width: '90px', ['--ray-rot' as string]: '-9deg', ['--d' as string]: '11s', background: 'linear-gradient(180deg, rgba(120,210,180,0.4), transparent 72%)' }} />
      </div>

      {/* L4 · volcanic glow + smoke (left) */}
      <div className="cine-layer" style={{ ['--d' as string]: '5px' }}>
        <div className="cine-volcano-glow" style={{ left: '-6%', bottom: '-14%', width: '46vw', height: '40vh',
          background: 'radial-gradient(circle, rgba(255,120,40,0.55) 0%, rgba(220,40,20,0.32) 38%, transparent 70%)' }} />
        {fields.smoke.map((s, i) => (
          <span key={i} className="cine-smoke" style={{ left: `${s.left}%`, bottom: `${s.bottom}%`, width: s.w, height: s.w, ['--d' as string]: `${s.d}s`, ['--delay' as string]: `${s.delay}s` }} />
        ))}
      </div>

      {/* L5 · terrain silhouettes (volcano left · storm peaks right · foreground rock) */}
      <svg className="cine-layer" style={{ ['--d' as string]: '6px' }} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9a3c" /><stop offset="0.5" stopColor="#ff5a1e" /><stop offset="1" stopColor="#8a1606" /></linearGradient>
          <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1014" /><stop offset="1" stopColor="#070509" /></linearGradient>
          <linearGradient id="peaks" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e1622" /><stop offset="1" stopColor="#060a10" /></linearGradient>
        </defs>
        {/* far storm peaks (right) */}
        <path d="M1600,900 V430 L1380,520 1230,360 1060,540 920,470 820,560 720,900 Z" fill="url(#peaks)" opacity="0.85" />
        {/* volcano massif (left) with a glowing crater rim */}
        <path d="M0,900 V470 L120,540 250,300 360,470 470,420 560,560 700,900 Z" fill="url(#ridge)" />
        <path d="M210,360 L250,300 296,372 268,392 232,392 Z" fill="url(#lava)" opacity="0.9" />
        {/* foreground rock shelf (bottom) — grounds the cast */}
        <path d="M0,900 V760 C260,690 520,820 820,775 C1120,730 1360,820 1600,750 V900 Z" fill="#050407" />
      </svg>

      {/* L6 · cinematic Pokémon (graded official artwork, blended into the scene) */}
      {mons.map((m) => {
        const s = SLOTS[m.slot]
        return (
          <div key={m.id} className="cine-mon" style={{ ...s.pos, width: s.size, zIndex: 6, ['--pl' as string]: `${s.pl}px`, ['--pt' as string]: `${s.pt}px`, ['--rot' as string]: s.rot } as React.CSSProperties}>
            <img src={ART(m.id)} alt="" draggable={false} style={{
              opacity: s.op,
              transform: `${m.flip ? 'scaleX(-1) ' : ''}rotate(${s.rot})`,
              filter: `brightness(${s.bright}) contrast(1.2) saturate(${s.sat}) drop-shadow(0 0 30px ${m.glow}) drop-shadow(0 0 70px ${m.glow}) blur(${s.blur}px)`,
              maskImage: MASK, WebkitMaskImage: MASK,
              animation: 'cineMon 9s ease-in-out infinite',
            }} />
          </div>
        )
      })}

      {/* L7 · storm lightning (right) */}
      <div className="cine-layer" style={{ ['--d' as string]: '5px', zIndex: 7 }}>
        <div className="cine-flash" style={{ ['--d' as string]: '8.5s', ['--delay' as string]: '0s', background: 'radial-gradient(60% 60% at 86% 16%, rgba(150,210,255,0.5), transparent 60%)' }} />
        <div className="cine-flash" style={{ ['--d' as string]: '12.5s', ['--delay' as string]: '5s', background: 'radial-gradient(55% 55% at 74% 26%, rgba(120,235,180,0.4), transparent 60%)' }} />
        <svg className="cine-bolt" style={{ left: '80%', top: '4%', width: '120px', ['--d' as string]: '8.5s', ['--delay' as string]: '0s' }} viewBox="0 0 60 200" xmlns="http://www.w3.org/2000/svg">
          <path d="M34,2 L14,96 L30,96 L8,198 L46,80 L28,80 Z" fill="rgba(190,225,255,0.95)" style={{ filter: 'drop-shadow(0 0 10px rgba(140,200,255,0.9))' }} />
        </svg>
        <svg className="cine-bolt" style={{ left: '66%', top: '10%', width: '90px', ['--d' as string]: '12.5s', ['--delay' as string]: '5s' }} viewBox="0 0 60 200" xmlns="http://www.w3.org/2000/svg">
          <path d="M30,2 L12,90 L26,90 L6,196 L48,76 L30,76 Z" fill="rgba(170,245,205,0.9)" style={{ filter: 'drop-shadow(0 0 10px rgba(120,230,170,0.85))' }} />
        </svg>
      </div>

      {/* L8 · particle systems (embers/ash/sparks LEFT · energy motes RIGHT) + mist */}
      <div className="cine-layer" style={{ ['--d' as string]: '8px', zIndex: 8 }}>
        {fields.embers.map((p, i) => <span key={'e' + i} className="cine-ember" style={{ left: `${p.left}%`, bottom: `${p.bottom}%`, width: p.w, height: p.w, ['--d' as string]: `${p.d}s`, ['--delay' as string]: `${p.delay}s`, ['--dx' as string]: `${p.dx}px`, ['--o' as string]: p.o }} />)}
        {fields.ash.map((p, i) => <span key={'a' + i} className="cine-ash" style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.w, height: p.w, ['--d' as string]: `${p.d}s`, ['--delay' as string]: `${p.delay}s`, ['--dx' as string]: `${p.dx}px` }} />)}
        {fields.sparks.map((p, i) => <span key={'s' + i} className="cine-spark" style={{ left: `${p.left}%`, bottom: `${p.bottom}%`, ['--d' as string]: `${p.d}s`, ['--delay' as string]: `${p.delay}s` }} />)}
        {fields.motes.map((p, i) => <span key={'m' + i} className="cine-mote" style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.w, height: p.w, ['--c' as string]: p.green ? 'rgba(120,235,170,0.7)' : 'rgba(130,210,255,0.7)', ['--d' as string]: `${p.d}s`, ['--delay' as string]: `${p.delay}s`, ['--o' as string]: p.o }} />)}
        <div className="cine-mist" style={{ left: '-10%', bottom: '14%', width: '70%', height: '160px', ['--d' as string]: '20s', background: 'linear-gradient(90deg, transparent, rgba(180,90,40,0.10) 40%, transparent)' }} />
        <div className="cine-mist" style={{ right: '-10%', top: '24%', width: '70%', height: '180px', ['--d' as string]: '26s', background: 'linear-gradient(90deg, transparent, rgba(60,120,150,0.10) 50%, transparent)' }} />
      </div>

      {/* L9 · readability — darken + vignette + edge gradients so panels stay crisp */}
      <div className="absolute inset-0" style={{ background: 'rgba(6,7,11,0.22)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 46%, transparent 30%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.86) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-32" style={{ background: 'linear-gradient(180deg, rgba(4,5,9,0.7), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(0deg, rgba(4,5,9,0.6), transparent)' }} />
    </div>
  )
}
