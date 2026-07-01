import { Sparkles, ArrowRight } from 'lucide-react'
import type { TeamAnalysisData } from '../hooks/useTeamAnalysis'

// Small dock card — a PREVIEW only. It never shows the full analysis; it points to the
// SoulGuide tab, which is the single place all analysis lives.
export default function SoulGuidePreview({ data, onOpen }: { data: TeamAnalysisData; onOpen: () => void }) {
  const { analysis, verdict, status, gym, risk, empty } = data

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1c1c26' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-pk-red" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">SoulGuide</span>
        </div>
        {!empty && <span className="text-[10px] font-bold tabular-nums" style={{ color: '#FFCB05' }}>{analysis.overall.toFixed(1)}/10</span>}
      </div>

      <div className="p-3 space-y-3" style={{ background: '#161620' }}>
        {empty ? (
          <p className="text-slate-500 text-xs text-center py-3">
            Noch kein Team. Nimm bestätigte SoulLinks ins Hauptteam auf — dann startet der SoulGuide.
          </p>
        ) : (
          <>
            {/* Score + Sterne + Verdikt */}
            <div className="rounded-xl px-3 py-3 flex items-center gap-3" style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.2)' }}>
              <div className="min-w-0">
                <div className="text-pk-yellow text-base leading-none tracking-wide">
                  {'★'.repeat(analysis.stars)}<span className="text-slate-600">{'☆'.repeat(5 - analysis.stars)}</span>
                </div>
                <div className="text-[10px] font-bold mt-1 truncate" style={{ color: verdict.c }}>{verdict.label}</div>
              </div>
              <div className="ml-auto text-right shrink-0">
                <div className="text-white font-black text-2xl leading-none">{analysis.overall.toFixed(1)}<span className="text-slate-500 text-sm"> / 10</span></div>
              </div>
            </div>

            {/* Kurzer Status */}
            <p className="text-slate-300 text-xs leading-snug">{status}</p>

            {/* Nächste Arena — kleiner Hinweis */}
            {gym && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 truncate">🏆 {gym.name}</span>
                <span className="ml-auto shrink-0 font-black px-2 py-0.5 rounded-full" style={{ color: risk.color, background: `${risk.color}1e`, border: `1px solid ${risk.color}55` }}>
                  {risk.dot} {risk.label}
                </span>
              </div>
            )}

            {/* Öffnet den einzigen Analyseort */}
            <button
              onClick={onOpen}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ background: 'var(--color-pk-red)' }}
            >
              SoulGuide öffnen <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
