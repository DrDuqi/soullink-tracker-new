import { Sparkles } from 'lucide-react'
import type { CoachReport, CoachTone, CoachMood } from '../lib/coach/coach'

// The COACH half of the SoulGuide — pure natural language, no tables or charts. It reads a
// CoachReport (produced by the active CoachProvider — rule-based today, LLM later) and speaks.
// The shape is provider-neutral, so swapping the AI backend never touches this component.
const TONE: Record<CoachTone, string> = { info: '#94a3b8', good: '#4ade80', warn: '#fbbf24', danger: '#f87171', tip: '#c084fc' }
const MOOD: Record<CoachMood, { color: string; label: string }> = {
  calm: { color: '#4ade80', label: 'ruhig' },
  alert: { color: '#fbbf24', label: 'aufmerksam' },
  urgent: { color: '#f87171', label: 'kritisch' },
}
const PROVIDER_LABEL: Record<string, string> = { 'rule-based': 'Regelbasierter Coach', openai: 'OpenAI-Coach', claude: 'Claude-Coach' }

export default function SoulGuideCoach({ report }: { report: CoachReport }) {
  const mood = MOOD[report.mood]
  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'linear-gradient(180deg, rgba(204,0,0,0.06), rgba(255,255,255,0.02))' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(204,0,0,0.16)', color: '#ff6b6b' }}>
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-black text-base leading-none">SoulGuide</div>
          <div className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex w-full h-full rounded-full opacity-60" style={{ background: mood.color }} />
              <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ background: mood.color }} />
            </span>
            beobachtet live · {mood.label}
          </div>
        </div>
      </div>

      <p className="text-slate-200 text-sm leading-relaxed mb-4">{report.intro}</p>

      <div className="space-y-2.5">
        {report.lines.map((l) => {
          const c = TONE[l.tone]
          return (
            <div key={l.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: `${c}10`, border: `1px solid ${c}26` }}>
              <span className="text-base leading-none mt-0.5 shrink-0">{l.icon}</span>
              <p className="text-slate-200 text-[13px] leading-relaxed">{l.text}</p>
            </div>
          )
        })}
      </div>

      <p className="text-slate-600 text-[10px] mt-4 leading-relaxed">
        {PROVIDER_LABEL[report.generatedBy] ?? report.generatedBy} · liest ausschließlich das Analyse-Ergebnis · KI-Anbieter später zuschaltbar.
      </p>
    </div>
  )
}
