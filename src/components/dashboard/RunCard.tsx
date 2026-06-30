import { useRef } from 'react'
import { Play, ArrowRight, Loader2, Users, Clock, Zap, Radio } from 'lucide-react'
import type { RunVM } from '../../hooks/useMyRuns'
import type { LocalRun } from '../../lib/profiles'
import { auraForDex, particlesFor, dexForRun, artUrl } from './runAura'
import RunMenu, { type RunMenuActions } from './RunMenu'

// One AAA run card: a layered diorama (themed glow + fog + light-ray + particles) with
// the Pokémon overflowing the frame, cursor parallax, real info chips and epic buttons.
export default function RunCard({ vm, latest, busy, lr, editionLabel, relTime, onPlay, onTracker, menu }: {
  vm: RunVM; latest: boolean; busy: boolean; lr?: LocalRun
  editionLabel: (e?: string | null) => string
  relTime: (iso: string) => string
  onPlay: () => void; onTracker: () => void; menu: RunMenuActions
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dex = dexForRun(vm.run.id)
  const aura = auraForDex(dex)
  const particles = particlesFor(vm.run.id, aura)

  // Cursor parallax → CSS vars consumed by the artwork & glow (transform only, cheap).
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3))
    el.style.setProperty('--my', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3))
  }
  const onLeave = () => { const el = ref.current; if (!el) return; el.style.setProperty('--mx', '0'); el.style.setProperty('--my', '0') }

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className="runcard group anim-fade-up"
      style={{
        ['--glow' as string]: aura.glow, ['--fog' as string]: aura.fog, ['--ray' as string]: aura.ray,
        border: `1px solid ${latest ? 'rgba(255,60,60,0.40)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: latest ? '0 22px 60px -24px rgba(204,0,0,0.75)' : '0 16px 46px -30px rgba(0,0,0,0.9)',
      }}>
      {/* clipped atmosphere layers */}
      <div className="rc-bg" style={{ background: 'linear-gradient(135deg, rgba(22,22,31,0.92), rgba(12,12,18,0.94))' }}>
        <div className="rc-ray" />
        <div className="rc-fog" />
        <div className="rc-glow" />
        {particles.map((p, i) => (
          <span key={i} className="rc-p" style={{ left: p.left, bottom: p.bottom, width: p.w, height: p.h, ['--c' as string]: aura.particle, ['--d' as string]: p.d, ['--delay' as string]: p.delay, ['--o' as string]: p.o }} />
        ))}
      </div>

      {/* the hero, overflowing the frame */}
      <div className="rc-artwrap">
        <img src={artUrl(dex)} alt="" loading="lazy" draggable={false} className="rc-art" />
      </div>

      {/* content */}
      <div className="relative p-6" style={{ zIndex: 2 }}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-white font-black text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{vm.run.name}</span>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <span className="text-xs font-bold text-slate-100 bg-black/30 border border-white/10 rounded-full px-3 py-1 backdrop-blur-sm">{editionLabel(vm.run.game)}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-green-300 bg-green-500/15 border border-green-500/25 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Aktiv</span>
              {latest && <span className="text-[11px] font-black uppercase tracking-wide text-pk-yellow bg-pk-yellow/15 border border-pk-yellow/30 rounded-full px-2.5 py-1">Zuletzt gespielt</span>}
            </div>
            <div className="flex items-center gap-3.5 mt-3.5 text-slate-300/90 text-sm flex-wrap">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {vm.players.map((p) => p.name).join(' & ')}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {relTime(vm.lastActivity)}</span>
              {lr?.seed != null
                ? <><span className="font-mono flex items-center gap-1 text-slate-400"><Zap className="w-3.5 h-3.5" /> {lr.seed}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-300/90"><Radio className="w-3.5 h-3.5" /> LiveSync bereit</span></>
                : <span className="text-amber-400/90">hier noch nicht eingerichtet</span>}
            </div>
          </div>
          <RunMenu {...menu} />
        </div>

        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <button onClick={onPlay} disabled={busy} className="btn-epic inline-flex items-center gap-2 px-6 py-3 text-[15px]">
            {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Play className="w-[18px] h-[18px]" />} {lr ? 'Weiterspielen' : 'Spielen'}
          </button>
          <button onClick={onTracker} className="btn-soft inline-flex items-center gap-2 px-5 py-3 text-[15px]">Nur Tracker <ArrowRight className="w-[18px] h-[18px]" /></button>
        </div>
      </div>
    </div>
  )
}
