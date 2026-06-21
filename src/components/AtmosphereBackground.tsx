import { useEffect, useRef } from 'react'

// AAA launcher-style atmosphere (Riot/Valorant/Diablo-grade) WITH cinematic
// Pokémon. Pure CSS/SVG + a few CDN-cached official artworks heavily colour-graded
// (dark, dramatic rim-light, depth blur, soft alpha masks) so they read as part of
// the world — never black silhouettes or hard cut-out stickers. GPU-only
// (transform/opacity/filter). It is a pure background layer (z-0,
// pointer-events:none) → it never affects layout, sizes, positions or interaction.

type Slot = 'left' | 'right' | 'bottomLeft' | 'back'
interface Mon { id: number; slot: Slot; glow: string; flip?: boolean }

// Per-slot framing (epic, partly off-frame), grading + parallax depth.
const SLOTS: Record<Slot, { pos: React.CSSProperties; size: string; op: number; blur: number; bright: number; sat: number; pl: number; pt: number }> = {
  left:       { pos: { left: '-7%',  top: '8%' },     size: 'min(640px,48vw)', op: 0.50, blur: 0.6, bright: 0.62, sat: 0.90, pl: 4, pt: 3 },
  right:      { pos: { right: '-5%', bottom: '-4%' }, size: 'min(560px,42vw)', op: 0.50, blur: 0.6, bright: 0.62, sat: 0.95, pl: 4, pt: 3 },
  bottomLeft: { pos: { left: '-4%',  bottom: '-7%' }, size: 'min(380px,30vw)', op: 0.44, blur: 1.1, bright: 0.50, sat: 1.00, pl: 3, pt: 4 },
  back:       { pos: { top: '-12%',  right: '5%' },   size: 'min(820px,60vw)', op: 0.20, blur: 3.0, bright: 0.42, sat: 0.50, pl: 2, pt: 2 },
}

// Edition-aware casts — falls back to the strong default set.
const SETS: Record<string, Mon[]> = {
  default: [
    { id: 6,   slot: 'left',       glow: 'rgba(255,70,40,0.5)',  flip: true },  // Charizard
    { id: 448, slot: 'right',      glow: 'rgba(70,150,255,0.5)' },              // Lucario
    { id: 94,  slot: 'bottomLeft', glow: 'rgba(150,70,220,0.5)' },              // Gengar
    { id: 384, slot: 'back',       glow: 'rgba(60,170,180,0.4)' },              // Rayquaza
  ],
  platinum: [
    { id: 487, slot: 'left',       glow: 'rgba(190,60,230,0.5)' },  // Giratina
    { id: 483, slot: 'right',      glow: 'rgba(80,150,255,0.5)' },  // Dialga
    { id: 484, slot: 'bottomLeft', glow: 'rgba(220,60,150,0.5)' },  // Palkia
    { id: 491, slot: 'back',       glow: 'rgba(120,60,190,0.4)' },  // Darkrai
  ],
  hgss: [
    { id: 250, slot: 'left',       glow: 'rgba(255,150,40,0.5)' },  // Ho-Oh
    { id: 249, slot: 'right',      glow: 'rgba(80,150,255,0.5)' },  // Lugia
    { id: 245, slot: 'bottomLeft', glow: 'rgba(70,200,210,0.5)' },  // Suicune
  ],
  bw: [
    { id: 643, slot: 'left',  glow: 'rgba(190,205,235,0.5)' },      // Reshiram
    { id: 644, slot: 'right', glow: 'rgba(80,120,255,0.5)' },       // Zekrom
    { id: 646, slot: 'back',  glow: 'rgba(90,160,205,0.4)' },       // Kyurem
  ],
  xy: [
    { id: 716, slot: 'left',  glow: 'rgba(80,150,255,0.5)' },       // Xerneas
    { id: 717, slot: 'right', glow: 'rgba(220,50,60,0.5)' },        // Yveltal
  ],
  sv: [
    { id: 1007, slot: 'left',  glow: 'rgba(230,60,60,0.5)' },       // Koraidon
    { id: 1008, slot: 'right', glow: 'rgba(155,70,230,0.5)' },      // Miraidon
  ],
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
const MASK = 'radial-gradient(125% 130% at 50% 38%, #000 50%, transparent 86%)'

export default function AtmosphereBackground({ game }: { game?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mons = setFor(game)

  // Very subtle mouse parallax (2–4px), RAF-throttled, sets --mx/--my.
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
      {/* L1 · dark base + faint red(left)/blue(right) energy */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(58% 68% at 20% 84%, rgba(120,18,30,0.18) 0%, transparent 60%)',
          'radial-gradient(58% 68% at 82% 18%, rgba(20,52,150,0.18) 0%, transparent 60%)',
          'radial-gradient(120% 120% at 50% 48%, #090A11 0%, #06070B 68%, #050509 100%)',
        ].join(', '),
      }} />

      {/* L2 · drifting volumetric nebulae */}
      <div className="atmo-neb atmo-neb-r" />
      <div className="atmo-neb atmo-neb-b" />
      <div className="atmo-neb atmo-neb-c" />

      {/* L3 · thin energy lines */}
      <svg className="atmo-lines" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <path d="M-120,240 C420,110 980,180 1740,30" fill="none" stroke="rgba(70,185,215,0.07)" strokeWidth="1" />
        <path d="M-120,540 C520,660 1120,560 1740,780" fill="none" stroke="rgba(190,45,65,0.06)" strokeWidth="1" />
        <path d="M-120,710 C600,770 1040,690 1740,840" fill="none" stroke="rgba(45,95,205,0.06)" strokeWidth="1" />
      </svg>

      {/* L4 · giant faint Pokéball + counter-rotating energy rings */}
      <div className="atmo-core">
        <div className="atmo-ring" style={{ width: 'clamp(460px,54vw,1040px)', animationDuration: '150s' }}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="99" fill="none" stroke="rgba(70,185,215,0.10)" strokeWidth="0.35" strokeDasharray="5 11" /></svg>
        </div>
        <div className="atmo-ring atmo-rev" style={{ width: 'clamp(380px,44vw,860px)', animationDuration: '112s' }}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="99" fill="none" stroke="rgba(190,45,65,0.10)" strokeWidth="0.45" strokeDasharray="2 16" /></svg>
        </div>
        <div className="atmo-ring" style={{ width: 'clamp(300px,34vw,680px)', animationDuration: '92s' }}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="99" fill="none" stroke="rgba(45,95,205,0.11)" strokeWidth="0.5" strokeDasharray="44 150" /></svg>
        </div>
        <svg className="atmo-ball" viewBox="0 0 100 100" style={{ width: 'clamp(420px,46vw,920px)' }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <line x1="6" y1="50" x2="38" y2="50" stroke="currentColor" strokeWidth="0.5" />
          <line x1="62" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <circle cx="50" cy="50" r="5.5" fill="none" stroke="currentColor" strokeWidth="0.4" />
        </svg>
      </div>

      {/* L6 · cinematic Pokémon (graded official artwork, blended into the scene) */}
      {mons.map((m) => {
        const s = SLOTS[m.slot]
        return (
          <div key={m.id} className="atmo-mon" style={{ ...s.pos, width: s.size, ['--pl' as string]: `${s.pl}px`, ['--pt' as string]: `${s.pt}px` } as React.CSSProperties}>
            <img src={ART(m.id)} alt="" draggable={false} style={{
              opacity: s.op,
              transform: m.flip ? 'scaleX(-1)' : undefined,
              filter: `brightness(${s.bright}) contrast(1.18) saturate(${s.sat}) drop-shadow(0 0 26px ${m.glow}) drop-shadow(0 0 60px ${m.glow}) blur(${s.blur}px)`,
              maskImage: MASK, WebkitMaskImage: MASK,
            }} />
          </div>
        )
      })}

      {/* L7+L8 · star dust + floating particles */}
      <div className="atmo-stars atmo-stars-1" />
      <div className="atmo-stars atmo-stars-2" />
      <span className="atmo-p" style={{ left: '18%', top: '34%', animationDuration: '34s' }} />
      <span className="atmo-p" style={{ left: '74%', top: '24%', animationDuration: '46s', animationDelay: '6s' }} />
      <span className="atmo-p" style={{ left: '55%', top: '66%', animationDuration: '40s', animationDelay: '3s' }} />
      <span className="atmo-p" style={{ left: '32%', top: '78%', animationDuration: '52s', animationDelay: '9s' }} />
      <span className="atmo-p" style={{ left: '86%', top: '70%', animationDuration: '44s', animationDelay: '2s' }} />
      <div className="atmo-flare atmo-flare-r" />
      <div className="atmo-flare atmo-flare-b" />
      <div className="atmo-flare atmo-flare-c" />

      {/* L9 · readability overlay (keeps the UI clearly in front) + vignette */}
      <div className="absolute inset-0" style={{ background: 'rgba(6,7,11,0.18)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 34%, rgba(0,0,0,0.84) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)' }} />
    </div>
  )
}
