import { useMemo } from 'react'

// Subtle, performant background atmosphere for the dashboard: two drifting nebulae,
// two parallax star layers, slow god-ray flares and a field of floating motes — all
// transform/opacity only. Wrapped in `.atmo` so Settings → "Effekte aus" (html.no-fx)
// and prefers-reduced-motion can switch it off globally.
export default function DashboardAtmosphere() {
  const motes = useMemo(() =>
    Array.from({ length: 16 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${20 + Math.random() * 80}%`,
      d: `${16 + Math.random() * 20}s`,
      delay: `${Math.random() * 18}s`,
      s: 0.7 + Math.random() * 1.2,
    })), [])
  return (
    <div className="atmo pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="atmo-neb atmo-neb-r" />
      <div className="atmo-neb atmo-neb-b" />
      <div className="atmo-neb atmo-neb-c" />
      <div className="atmo-stars atmo-stars-1" />
      <div className="atmo-stars atmo-stars-2" />
      <div className="atmo-flare atmo-flare-r" />
      <div className="atmo-flare atmo-flare-b" />
      <div className="atmo-flare atmo-flare-c" />
      {motes.map((m, i) => (
        <span key={i} className="atmo-p" style={{ left: m.left, top: m.top, animationDuration: m.d, animationDelay: m.delay, transform: `scale(${m.s})` }} />
      ))}
    </div>
  )
}
