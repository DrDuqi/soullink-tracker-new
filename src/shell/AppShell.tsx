import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CompanionAuth from './CompanionAuth'
import UserMenu from '../components/UserMenu'
import { useAuth } from '../contexts/AuthContext'

// The Companion desktop shell: a persistent left Sidebar + a top account bar + a
// large work area (Outlet) that swaps content without remounting the navigation —
// like Steam / Discord / VS Code. Renders ONLY inside the Companion window. When
// the user isn't signed in (the 127.0.0.1 origin has no session), the work area
// shows the clean login instead of the routed page.
export default function AppShell() {
  const { user, loading } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0b0b10' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 flex items-center justify-end px-5 border-b border-[#1f1f2b]">
          {user && <UserMenu />}
        </header>
        <main className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Wird geladen…</div>
          ) : user ? (
            <Outlet />
          ) : (
            <CompanionAuth />
          )}
        </main>
      </div>
    </div>
  )
}
