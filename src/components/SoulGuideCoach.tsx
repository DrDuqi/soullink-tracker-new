import { Sparkles } from 'lucide-react'
import type { CoachReport, CoachTone } from '../lib/coach/coach'

// The COACH half of the SoulGuide — pure natural language, no tables or charts.
// It reads the CoachReport (interpretation layer) and speaks. Phase 3's live AI feeds
// the exact same CoachReport shape, so this component never changes.
const TONE: Record<CoachTone, string> = { info: '#94a3b8', good: '#4ade80', warn: '#fbbf24', tip: '#c084fc' }

export default function SoulGuideCoach({ report }: { report: CoachReport }) {
  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'linear-gradient(180deg, rgba(204,0,0,0.06), rgba(255,255,255,0.02))' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(204,0,0,0.16)', color: '#ff6b6b' }}>
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <div className="text-white font-black text-base leading-none">SoulGuide</div>
          <div className="text-slate-500 text-[11px] mt-1">denkt gerade für dich mit</div>
        </div>
      </div>

      <p className="text-slate-200 text-sm leading-relaxed mb-4">{report.intro}</p>

      <div className="space-y-2.5">
        {report.lines.map((l, i) => {
          const c = TONE[l.tone]
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: `${c}10`, border: `1px solid ${c}26` }}>
              <span className="text-base leading-none mt-0.5 shrink-0">{l.icon}</span>
              <p className="text-slate-200 text-[13px] leading-relaxed">{l.text}</p>
            </div>
          )
        })}
      </div>

      <p className="text-slate-600 text-[10px] mt-4 leading-relaxed">
        Deterministische Einschätzung auf Basis deiner Team-Analyse. In Phase 3 übernimmt hier der Live-Coach.
      </p>
    </div>
  )
}
