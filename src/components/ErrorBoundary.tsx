import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

/** Catches render-time errors anywhere below it and shows a themed fallback
 *  instead of a blank white screen — essential for a public production app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    // Surface in the console for production debugging.
    console.error('[ErrorBoundary]', err, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen pokeball-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-[#1c1c26] border border-[#2e2e42] rounded-3xl p-8 shadow-2xl">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-white font-black text-xl mb-2">Etwas ist schiefgelaufen</h1>
          <p className="text-slate-400 text-sm mb-5">
            Die App ist auf einen unerwarteten Fehler gestoßen. Lade die Seite neu, um fortzufahren.
          </p>
          {this.state.message && (
            <p className="text-slate-600 text-xs font-mono mb-5 break-words bg-black/30 rounded-lg p-3">
              {this.state.message}
            </p>
          )}
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
            Seite neu laden
          </button>
          <a href="/" className="block mt-3 text-slate-500 text-sm hover:text-white transition-colors">
            Zur Startseite
          </a>
        </div>
      </div>
    )
  }
}
