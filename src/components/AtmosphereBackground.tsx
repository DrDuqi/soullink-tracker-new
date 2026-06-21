import { useEffect, useRef } from 'react'

// AAA-gaming atmosphere background (Riot/Blizzard-grade). It is purely a visual
// layer: fixed, z-0, pointer-events:none → it NEVER affects layout, sizes,
// positions or interaction. Dark base + red(left)/blue(right) energy, a huge
// faint Pokéball with slow energy rings, dark Pokémon silhouettes, drifting fog,
// a lightweight canvas ember field, mouse parallax and a vignette.
//
// Performance: transform/opacity-only CSS animations (GPU), a capped canvas
// particle field, RAF-throttled parallax, pauses when the tab is hidden, and a
// full prefers-reduced-motion fallback.

// Dark silhouettes — left = red energy (Charizard, Gengar), right = blue
// (Lucario, Mewtu). Official artwork rendered as pure-black silhouettes + glow,
// loaded from the PokéAPI CDN (cached, not bundled → no large local assets).
type Sil = { id: number; pos: React.CSSProperties; size: number; glow: string; op: number; px: number; py: number; dur: number; alt: boolean }
const SILHOUETTES: Sil[] = [
  { id: 6,   pos: { bottom: '-70px', left: '-100px' }, size: 480, glow: '#ff2a2a', op: 0.52, px: 28, py: 16, dur: 13, alt: false }, // Charizard
  { id: 94,  pos: { top: '36%',      left: '-50px'  }, size: 240, glow: '#ff3b6b', op: 0.42, px: 22, py: 13, dur: 16, alt: true  }, // Gengar
  { id: 448, pos: { bottom: '-60px', right: '-80px' }, size: 430, glow: '#36a3ff', op: 0.52, px: 28, py: 16, dur: 15, alt: true  }, // Lucario
  { id: 150, pos: { top: '-60px',    right: '-40px' }, size: 380, glow: '#7c8cff', op: 0.40, px: 18, py: 24, dur: 18, alt: false }, // Mewtu
]
const ART = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function AtmosphereBackground() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Mouse parallax → CSS vars (--mx/--my), RAF-throttled ───────────────────
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

  // ── Canvas ember field — capped, hidden-aware, reduced-motion aware ────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0, running = true
    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; c: string }
    const COLORS = ['rgba(204,0,0,', 'rgba(56,140,255,', 'rgba(255,176,64,']
    let parts: P[] = []
    const spawn = (): P => {
      const s = Math.random()
      return { x: Math.random() * w, y: h + Math.random() * h, r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.25, vy: -(0.12 + Math.random() * 0.5),
        a: 0.08 + Math.random() * 0.38, c: COLORS[s < 0.5 ? 0 : s < 0.85 ? 1 : 2] }
    }
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      parts = Array.from({ length: Math.min(70, Math.round((w * h) / 24000)) }, spawn)
    }
    const frame = () => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy
        if (p.y < -12) Object.assign(p, spawn(), { y: h + 12 })
        ctx.beginPath(); ctx.fillStyle = p.c + p.a.toFixed(3) + ')'
        ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => { running = !document.hidden; if (running && !raf) frame() }
    resize(); frame()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <div ref={rootRef} className="atmo fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Dark base + red(left)/blue(right) energy */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(58% 80% at 6% 80%, rgba(204,0,0,0.17) 0%, transparent 60%)',
          'radial-gradient(58% 80% at 94% 20%, rgba(40,120,255,0.15) 0%, transparent 60%)',
          'radial-gradient(50% 60% at 50% 120%, rgba(150,30,40,0.10) 0%, transparent 60%)',
          'linear-gradient(180deg, #0c0c14 0%, #08080c 55%, #060609 100%)',
        ].join(', '),
      }} />

      {/* Drifting fog */}
      <div className="atmo-fog" style={{ background: 'radial-gradient(40% 50% at 28% 38%, rgba(120,150,255,0.055), transparent 60%)', animationDuration: '32s' }} />
      <div className="atmo-fog" style={{ background: 'radial-gradient(46% 56% at 74% 66%, rgba(204,0,0,0.06), transparent 60%)', animationDuration: '44s', animationDirection: 'reverse' }} />

      {/* Huge faint Pokéball + slow energy rings (parallax depth) */}
      <div className="atmo-center" style={{ ['--d' as string]: 9 } as React.CSSProperties}>
        <div className="atmo-ring" style={{ width: 'min(82vh,860px)', height: 'min(82vh,860px)', animationDuration: '120s' }} />
        <div className="atmo-ring" style={{ width: 'min(60vh,640px)', height: 'min(60vh,640px)', animationDuration: '90s', animationDirection: 'reverse', borderColor: 'rgba(56,140,255,0.055)' }} />
        <svg viewBox="0 0 100 100" className="atmo-ball" style={{ width: 'min(66vh,700px)', height: 'min(66vh,700px)' }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3,50 H97" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="50" cy="50" r="5" fill="currentColor" />
        </svg>
      </div>

      {/* Dark Pokémon silhouettes (parallax outer, float inner) */}
      {SILHOUETTES.map((s) => (
        <div key={s.id} className="atmo-sil" style={{ ...s.pos, width: s.size, height: s.size, ['--px' as string]: `${s.px}px`, ['--py' as string]: `${s.py}px` } as React.CSSProperties}>
          <div className="atmo-sil-float" style={{ animation: `${s.alt ? 'pkArtFloatAlt' : 'pkArtFloat'} ${s.dur}s ease-in-out infinite` }}>
            <img src={ART(s.id)} alt="" draggable={false} className="atmo-sil-img"
              style={{ opacity: s.op, filter: `brightness(0) drop-shadow(0 0 24px ${s.glow}) drop-shadow(0 0 56px ${s.glow})` }} />
          </div>
        </div>
      ))}

      {/* Ember particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette → focus the centre */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(0,0,0,0.72) 100%)' }} />
    </div>
  )
}
