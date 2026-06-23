import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import CompanionAuth from './CompanionAuth'
import { useAuth } from '../contexts/AuthContext'

// The Companion desktop shell: a custom title bar on top, then a persistent left
// Sidebar + a large work area (Outlet) that swaps content without remounting the
// navigation — like Steam / Discord / VS Code. Renders ONLY inside the Companion
// window. Signed out (the 127.0.0.1 origin has no website session) → the clean
// login fills the work area and the sidebar is hidden (nothing to navigate yet).
export default function AppShell() {
  const { user, loading } = useAuth()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0b0b10' }}>
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
  )
}
