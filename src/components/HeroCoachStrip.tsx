import { Sparkles, ArrowRight } from 'lucide-react'

// The SoulGuide preview IN THE HERO — one short, natural line (the coach's headline).
// The full explanation lives in the SoulGuide tab; clicking here opens it. Phase 3's live
// AI feeds the same `headline` string, so nothing here changes.
export default function HeroCoachStrip({ headline, onOpen }: { headline: string; onOpen?: () => void }) {
  return (
    <button onClick={onOpen} className="mt-4 pt-4 border-t border-white/10 w-full flex items-center gap-2.5 text-left group">
      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-pk-red/80 shrink-0 inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> SoulGuide
      </span>
      <span className="text-slate-200 text-sm truncate flex-1 min-w-0">{headline}</span>
      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0" />
    </button>
  )
}
