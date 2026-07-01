import { Sparkles } from 'lucide-react'

// Reserved SoulGuide slot in the hero. Phase 3 (live AI) will feed richer, live hints
// through the SAME `hints` prop — no layout change needed then. For now it surfaces a
// couple of deterministic coach lines (or a placeholder) so the space + API already exist.
export interface CoachHint {
  text: string
  tone?: 'info' | 'good' | 'warn'
}

const TONE: Record<NonNullable<CoachHint['tone']>, string> = {
  info: '#94a3b8',
  good: '#4ade80',
  warn: '#fbbf24',
}

export default function HeroCoachStrip({ hints }: { hints: CoachHint[] }) {
  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      <div className="flex items-center gap-2 mb-2.5 text-[11px] font-black uppercase tracking-[0.22em] text-pk-red/80">
        <Sparkles className="w-3.5 h-3.5" /> SoulGuide
      </div>
      {hints.length === 0 ? (
        <p className="text-slate-500 text-xs">Dein Live-Coach meldet sich hier, während du spielst.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {hints.map((h, i) => {
            const c = TONE[h.tone ?? 'info']
            return (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: `${c}14`, color: c, border: `1px solid ${c}33` }}>
                {h.text}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
