// AAA launcher-style atmosphere (Riot/Valorant/Diablo-grade). Pure CSS/SVG,
// GPU-only (transform/opacity) — no images, no canvas, no JS, no Pokémon figures.
// Layered for depth: dark base → nebulae → energy lines → giant faint Pokéball +
// slow counter-rotating rings → star dust + particles + flares → vignette. Each
// layer drifts at a slightly different, very slow pace. It is a pure background
// layer (z-0, pointer-events:none) → never affects layout or interaction.
export default function AtmosphereBackground() {
  return (
    <div className="atmo fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* L1 · dark base + faint red(left)/blue(right) energy */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(58% 68% at 20% 84%, rgba(120,18,30,0.18) 0%, transparent 60%)',
          'radial-gradient(58% 68% at 82% 18%, rgba(20,52,150,0.18) 0%, transparent 60%)',
          'radial-gradient(120% 120% at 50% 48%, #090A11 0%, #06070B 68%, #050509 100%)',
        ].join(', '),
      }} />

      {/* L2 · drifting nebulae */}
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

      {/* L5 · star dust, floating particles, subtle flares */}
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

      {/* L6 · vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 36%, rgba(0,0,0,0.86) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)' }} />
    </div>
  )
}
