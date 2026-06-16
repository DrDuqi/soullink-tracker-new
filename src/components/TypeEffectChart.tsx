import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { ALL_TYPES, getTypeMatchups } from '../lib/type-chart'
import { getTypeColor, TYPE_NAMES_DE } from '../lib/pokemon-api'

function TypePill({ type, small }: { type: string; small?: boolean }) {
  const de = TYPE_NAMES_DE[type] ?? type
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold text-white ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ background: getTypeColor(type) }}
    >
      {de}
    </span>
  )
}

function Row({ label, types, color }: { label: string; types: string[]; color: string }) {
  if (types.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => <TypePill key={t} type={t} small />)}
      </div>
    </div>
  )
}

interface Props {
  collapsible?: boolean
  defaultOpen?: boolean
}

export default function TypeEffectChart({ collapsible = true, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [selected, setSelected] = useState<string | null>(null)

  const matchups = selected ? getTypeMatchups(selected) : null

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-white/3 transition-colors' : ''}`}
        style={{ background: '#1c1c26' }}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Typ-Effektivität</span>
          <span className="text-slate-600 text-[10px]">Gen 1-5</span>
        </div>
        {collapsible && (
          open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>

      {open && (
        <div className="p-3 space-y-3" style={{ background: '#161620' }}>
          {/* Instruction */}
          {!selected && (
            <p className="text-slate-600 text-[10px] text-center pt-1">Typ auswählen um Matchups zu sehen</p>
          )}

          {/* Type grid */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => {
              const isSelected = selected === t
              return (
                <button
                  key={t}
                  onClick={() => setSelected(isSelected ? null : t)}
                  className="rounded-full font-bold text-[10px] px-2 py-0.5 text-white transition-all"
                  style={{
                    background: isSelected ? getTypeColor(t) : `${getTypeColor(t)}55`,
                    outline: isSelected ? `2px solid ${getTypeColor(t)}` : 'none',
                    outlineOffset: '2px',
                  }}
                >
                  {TYPE_NAMES_DE[t] ?? t}
                </button>
              )
            })}
          </div>

          {/* Matchup details */}
          {selected && matchups && (
            <div
              className="rounded-xl p-3 space-y-2.5 border"
              style={{ background: `${getTypeColor(selected)}08`, borderColor: `${getTypeColor(selected)}30` }}
            >
              {/* Title */}
              <div className="flex items-center gap-2 mb-1">
                <TypePill type={selected} />
                <span className="text-slate-400 text-[10px]">Matchup-Details</span>
              </div>

              {/* Offensive section */}
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-[#2e2e42] pb-1">
                ⚔ Angriff
              </div>
              <div className="space-y-2">
                <Row label="Sehr effektiv gegen (×2)"   types={matchups.superVs}    color="#4ade80" />
                <Row label="Kaum effektiv gegen (×½)"  types={matchups.notVeryVs}  color="#fbbf24" />
                <Row label="Keine Wirkung gegen (×0)"  types={matchups.noEffectVs} color="#f87171" />
                {matchups.superVs.length === 0 && matchups.notVeryVs.length === 0 && matchups.noEffectVs.length === 0 && (
                  <p className="text-slate-600 text-[10px]">Gegen alle Typen normal.</p>
                )}
              </div>

              {/* Defensive section */}
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-[#2e2e42] pb-1 pt-1">
                🛡 Verteidigung
              </div>
              <div className="space-y-2">
                <Row label="Schwach gegen (×2)"       types={matchups.weakTo}      color="#f87171" />
                <Row label="Resistent gegen (×½)"     types={matchups.resistantTo} color="#4ade80" />
                <Row label="Immun gegen (×0)"         types={matchups.immuneTo}    color="#a78bfa" />
                {matchups.weakTo.length === 0 && matchups.resistantTo.length === 0 && matchups.immuneTo.length === 0 && (
                  <p className="text-slate-600 text-[10px]">Keine besonderen Verteidigungseigenschaften.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
