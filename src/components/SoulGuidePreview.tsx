import { Sparkles, ArrowRight } from 'lucide-react'
import type { TeamAnalysisData } from '../hooks/useTeamAnalysis'
import type { CoachReport } from '../lib/coach/coach'

// Compact dock preview — score + the coach's one-line headline + a way into the SoulGuide tab.
// It never shows the full analysis; that lives in the SoulGuide.
export default function SoulGuidePreview({ data, report, onOpen }: { data: TeamAnalysisData; report: CoachReport; onOpen: () => void }) {
  const { analysis, verdict, empty } = data

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
        {!empty && (
          <div className="flex items-center gap-2">
            <span className="text-pk-yellow text-sm leading-none">{'★'.repeat(analysis.stars)}<span className="text-slate-600">{'☆'.repeat(5 - analysis.stars)}</span></span>
            <span className="text-[10px] font-bold ml-auto" style={{ color: verdict.c }}>{verdict.label}</span>
          </div>
        )}

        {/* The coach's whisper */}
        <p className="text-slate-200 text-[13px] leading-relaxed">{report.headline}</p>

        <button
          onClick={onOpen}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: 'var(--color-pk-red)' }}
        >
          SoulGuide öffnen <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
