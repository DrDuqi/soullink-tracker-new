import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ToastContainer from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { useApplySettings } from './store/settingsStore'
import { IN_COMPANION_WINDOW } from './lib/companion'
import './index.css'

// Route-level code splitting: the landing page no longer ships the heavy
// run view (modals, analysis engine, …) and vice-versa.
const HomePage = lazy(() => import('./pages/HomePage'))
const RunPage = lazy(() => import('./pages/RunPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const ProfilesPage = lazy(() => import('./pages/ProfilesPage'))
// Companion desktop shell (only loaded inside the native window).
const AppShell = lazy(() => import('./shell/AppShell'))
const CompanionDashboard = lazy(() => import('./pages/companion/DashboardPage'))
const NewRunPage = lazy(() => import('./pages/companion/NewRunPage'))
const PresetsPage = lazy(() => import('./pages/companion/PresetsPage'))
const CompanionSettings = lazy(() => import('./pages/companion/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

function PageLoader() {
  return (
    <div className="min-h-screen pokeball-bg flex items-center justify-center">
      <div className="text-slate-400 text-lg">Wird geladen…</div>
    </div>
  )
}

export default function App() {
  useApplySettings()   // keep accent/theme/perf classes in sync with saved settings
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              {IN_COMPANION_WINDOW ? (
                // Native window: the desktop shell wraps every page (persistent
                // sidebar + account bar). No landing / marketing here.
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<CompanionDashboard />} />
                    <Route path="/new" element={<NewRunPage />} />
                    <Route path="/settings" element={<CompanionSettings />} />
                    <Route path="/presets" element={<PresetsPage />} />
                    <Route path="/setup" element={<SetupPage />} />
                    <Route path="/profiles" element={<ProfilesPage />} />
                    <Route path="/run/:runId" element={<RunPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              ) : (
                // Public website: landing + run views, unchanged.
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/setup" element={<SetupPage />} />
                  <Route path="/profiles" element={<ProfilesPage />} />
                  <Route path="/run/:runId" element={<RunPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </Suspense>
            <ToastContainer />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
