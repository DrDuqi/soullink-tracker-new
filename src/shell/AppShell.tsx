import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import CompanionAuth from './CompanionAuth'
import AtmosphereBackground from '../components/AtmosphereBackground'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../store/settingsStore'

// The Companion desktop shell: a custom title bar on top, then a persistent left
// Sidebar + a large work area (Outlet) that swaps content without remounting the
// navigation — like Steam / Discord / VS Code. Renders ONLY inside the Companion
// window. Signed out (the 127.0.0.1 origin has no website session) → the clean
// login fills the work area and the sidebar is hidden (nothing to navigate yet).
//
// The cinematic AtmosphereBackground (graded legendary artwork, drifting nebulae,
// energy rings, particles) sits BEHIND everything so the whole app reads like a
// premium Pokémon launcher rather than flat admin software. GPU-only + reduced-motion
// aware, so it never costs interaction or frames.
export default function AppShell() {
  const { user, loading } = useAuth()
  // OLED = true black (#000) + a barely-there atmosphere for the higher-contrast look;
  // Dark = the cinematic deep-space backdrop. "Hintergrundeffekte deaktivieren" removes
  // the atmosphere entirely — so both toggles have an immediate, visible effect.
  const oled = useSettings((s) => s.theme === 'oled')
  const disableBg = useSettings((s) => s.perf.disableBg)

  return (
    <div className="flex flex-col h-screen overflow-hidden relative" style={{ background: oled ? '#000000' : '#06070B' }}>
      {!disableBg && (
        <div aria-hidden="true" style={{ opacity: oled ? 0.4 : 1, transition: 'opacity .35s ease' }}>
          <AtmosphereBackground />
        </div>
      )}
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <TitleBar />
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Wird geladen…</div>
        ) : user ? (
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <main className="flex-1 overflow-y-auto min-h-0">
              <Outlet />
            </main>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <CompanionAuth />
          </div>
        )}
      </div>
    </div>
  )
}
