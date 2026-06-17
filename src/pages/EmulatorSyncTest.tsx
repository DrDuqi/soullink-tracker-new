import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Wifi, WifiOff, Loader2, AlertTriangle, Heart, Skull } from 'lucide-react'
import { getSpriteUrl } from '../lib/pokemon-api'
import { SYNC_ENDPOINT, STATUS_LABEL_DE } from '../lib/emulatorSync'
import type { EmulatorPayload, SyncEnvelope } from '../lib/emulatorSync'

type State = 'waiting' | 'connected' | 'error'

const FRESH_MS = 6000   // payload counts as "live" if received within this window
const POLL_MS = 1500

export default function EmulatorSyncTest() {
  const [state, setState] = useState<State>('waiting')
  const [payload, setPayload] = useState<EmulatorPayload | null>(null)
  const [receivedAt, setReceivedAt] = useState<number | null>(null)
  const [, force] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(SYNC_ENDPOINT, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const env = (await res.json()) as SyncEnvelope
        if (cancelled) return
        if (env.last) {
          setPayload(env.last.data)
          setReceivedAt(env.last.at)
          setState(Date.now() - env.last.at < FRESH_MS ? 'connected' : 'waiting')
        } else {
          setState('waiting')
        }
      } catch {
        if (!cancelled) setState('error')
      }
    }
    poll()
    timer.current = setInterval(poll, POLL_MS)
    const ticker = setInterval(() => force((n) => n + 1), 1000) // refresh "x s ago"
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current); clearInterval(ticker) }
  }, [])

  const team = payload?.team ?? []
  const ageS = receivedAt ? Math.max(0, Math.round((Date.now() - receivedAt) / 1000)) : null

  const banner = {
    connected: { icon: <Wifi className="w-5 h-5" />, text: 'Live Sync verbunden', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', bd: 'rgba(74,222,128,0.3)' },
    waiting:   { icon: <Loader2 className="w-5 h-5 animate-spin" />, text: 'Wartet auf Emulator…', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', bd: 'rgba(251,191,36,0.3)' },
    error:     { icon: <WifiOff className="w-5 h-5" />, text: 'Fehler beim Sync (Endpoint nicht erreichbar)', color: '#f87171', bg: 'rgba(248,113,113,0.1)', bd: 'rgba(248,113,113,0.3)' },
  }[state]

  return (
    <div className="min-h-screen pokeball-bg">
      <header className="border-b border-white/5 backdrop-blur-sm" style={{ background: 'rgba(17,17,22,0.9)' }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-white font-black text-lg leading-tight">Emulator Live-Sync · Test</h1>
            <p className="text-slate-500 text-xs">Prototyp · liest <code className="font-mono">{SYNC_ENDPOINT}</code></p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Status banner */}
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border" style={{ color: banner.color, background: banner.bg, borderColor: banner.bd }}>
          {banner.icon}
          <div className="flex-1">
            <div className="font-black text-sm">{banner.text}</div>
            {state !== 'error' && (
              <div className="text-xs opacity-70">
                {payload ? <>Spiel: {payload.game} · Trainer: {payload.trainer} · zuletzt empfangen {ageS}s her</> : 'Noch keine Daten empfangen.'}
              </div>
            )}
          </div>
        </div>

        {state === 'error' && (
          <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26] p-4 text-sm text-slate-400 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              Der lokale Sync-Endpoint antwortet nicht. Starte den Dev-Server (<code className="font-mono text-slate-300">npm run dev</code>),
              sodass <code className="font-mono text-slate-300">{SYNC_ENDPOINT}</code> verfügbar ist, oder starte den Standalone-Server
              unter <code className="font-mono text-slate-300">emulator/dev-sync-server</code>.
            </div>
          </div>
        )}

        {/* Last received team */}
        <div>
          <div className="text-slate-300 text-xs font-black uppercase tracking-widest mb-3">Zuletzt empfangenes Team</div>
          {team.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-[#2e2e42] text-slate-600 text-sm">
              Noch keine Teamdaten. Lade <code className="font-mono">soullink_sync.lua</code> in BizHawk und stelle den Output-Modus auf „http".
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {team.map((m) => (
                <div key={m.slot} className={`rounded-2xl border p-4 flex items-center gap-3 ${m.fainted ? 'border-red-900/40 bg-red-950/15 opacity-70' : 'border-[#2e2e42] bg-[#1c1c26]'}`}>
                  <img src={getSpriteUrl(m.speciesId)} alt="" className={`w-12 h-12 object-contain ${m.fainted ? 'grayscale' : ''}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold">#{m.speciesId}</span>
                      <span className="text-slate-500 text-xs">Slot {m.slot}</span>
                      {m.fainted ? <Skull className="w-3.5 h-3.5 text-red-400" /> : <Heart className="w-3.5 h-3.5 text-green-400" />}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">Lv {m.level} · KP {m.hp}/{m.maxHp}</div>
                    <div className="text-[11px] mt-1">
                      <span className="px-1.5 py-0.5 rounded font-bold" style={{ color: m.status === 'ok' ? '#64748b' : '#fbbf24', background: m.status === 'ok' ? 'rgba(100,116,139,0.12)' : 'rgba(251,191,36,0.12)' }}>
                        {STATUS_LABEL_DE[m.status]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-slate-600 text-xs">
          Diese Seite ist optional und beeinflusst die normale App nicht. Manuelle Eingabe & alle bestehenden Funktionen bleiben unverändert.
        </p>
      </main>
    </div>
  )
}
