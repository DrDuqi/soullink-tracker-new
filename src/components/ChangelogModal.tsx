import { ScrollText, Sparkles, Wrench, ArrowUpCircle, ExternalLink } from 'lucide-react'
import { CHANGELOG, type ChangeType } from '../lib/changelog'
import { LINKS } from '../lib/appInfo'
import { useSettings } from '../store/settingsStore'
import Modal from './Modal'

const META: Record<ChangeType, { label: string; color: string; icon: React.ReactNode }> = {
  new:     { label: 'Neu',         color: '#22C55E', icon: <Sparkles className="w-3 h-3" /> },
  improve: { label: 'Verbessert',  color: '#FFCB05', icon: <ArrowUpCircle className="w-3 h-3" /> },
  fix:     { label: 'Behoben',     color: '#60A5FA', icon: <Wrench className="w-3 h-3" /> },
}

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  const language = useSettings((s) => s.language)
  const fmt = (d: string) => new Date(d).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Modal onClose={onClose} title="Changelog" icon={<ScrollText className="w-5 h-5 text-pk-red" />} maxWidth="max-w-xl"
      footer={
        <a href={LINKS.changelog} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm font-bold transition-colors">
          <ExternalLink className="w-4 h-4" /> Auf GitHub ansehen
        </a>
      }>
      <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-6 py-6 space-y-7">
        {CHANGELOG.map((e, i) => (
          <div key={e.version} className="relative pl-6">
            {/* timeline rail */}
            <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-pk-red" style={{ boxShadow: '0 0 10px var(--color-pk-red)' }} />
            {i < CHANGELOG.length - 1 && <span className="absolute left-[4px] top-4 bottom-[-28px] w-px bg-[#2e2e42]" />}
            <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
              <span className="text-white font-black text-lg">v{e.version}</span>
              {e.title && <span className="text-pk-red font-bold text-sm">{e.title}</span>}
              <span className="text-slate-600 text-xs ml-auto">{fmt(e.date)}</span>
            </div>
            <ul className="space-y-2.5">
              {e.changes.map((c, j) => {
                const m = META[c.type]
                return (
                  <li key={j} className="flex items-start gap-2.5">
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md mt-0.5" style={{ color: m.color, background: `${m.color}1a` }}>
                      {m.icon} {m.label}
                    </span>
                    <span className="text-slate-300 text-sm leading-relaxed">{c.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
