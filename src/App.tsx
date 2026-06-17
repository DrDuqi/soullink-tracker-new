import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ToastContainer from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// Route-level code splitting: the landing page no longer ships the heavy
// run view (modals, analysis engine, …) and vice-versa.
const HomePage = lazy(() => import('./pages/HomePage'))
const RunPage = lazy(() => import('./pages/RunPage'))
const EmulatorSyncTest = lazy(() => import('./pages/EmulatorSyncTest'))

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
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/run/:runId" element={<RunPage />} />
                {/* Optional emulator live-sync test page (prototype). */}
                <Route path="/emulator-sync" element={<EmulatorSyncTest />} />
                {/* Unknown paths fall back to the landing page instead of a blank screen. */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <ToastContainer />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
