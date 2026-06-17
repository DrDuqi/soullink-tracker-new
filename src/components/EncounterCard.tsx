import { useState } from 'react'
import { Skull, Heart, Box, HelpCircle, Trash2, ChevronDown, Link2, Eye, Star, Plus, Lock } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useUpdateEncounterStatus, useDeleteEncounter } from '../hooks/useEncounters'
import ConfirmDialog from './ConfirmDialog'
import type { Encounter, PokemonStatus } from '../types/database'

const STATUS_CFG: Record<PokemonStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  alive:   { label: 'Am Leben', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.3)',   icon: <Heart     className="w-3.5 h-3.5" /> },
  dead:    { label: 'Besiegt',  color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.3)',  icon: <Skull     className="w-3.5 h-3.5" /> },
  boxed:   { label: 'In Box',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.3)',   icon: <Box       className="w-3.5 h-3.5" /> },
  missing: { label: 'Vermisst', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', icon: <HelpCircle className="w-3.5 h-3.5" /> },
}

interface Props {
  encounter: Encounter
  isLinked?: boolean
  isInTeam?: boolean
  compact?: boolean
  onClick?: () => void
  draggable?: boolean
  // Permissions & context
  isMyEncounter?: boolean
  linkedInfo?: { name: string; playerName: string }
  /** Whether this Pokémon is allowed into the team (confirmed soul link, both alive). Default true. */
  teamEligible?: boolean
  /** Tooltip shown on the disabled team button when not eligible. */
  teamBlockReason?: string
  // Callbacks
  onAddToTeam?: () => void
  onDeathRequest?: () => void
  onReviveRequest?: () => void
  onNavigateToPairs?: () => void
}

export default function EncounterCard({
  encounter, isLinked, isInTeam, compact, onClick, draggable,
  isMyEncounter = true, linkedInfo, teamEligible = true, teamBlockReason,
  onAddToTeam, onDeathRequest, onReviveRequest, onNavigateToPairs,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateStatus = useUpdateEncounterStatus()
  const deleteEncounter = useDeleteEncounter()
  const cfg = STATUS_CFG[encounter.status]
  const spriteUrl = encounter.pokemon_id ? getSpriteUrl(encounter.pokemon_id) : null
  const isDead = encounter.status === 'dead'

  async function setStatus(s: PokemonStatus) {
    setMenuOpen(false)
    if (s === 'dead' && isLinked && onDeathRequest) {
      onDeathRequest()
      return
    }
    // Linked dead Pokémon need partner confirmation to revive
    if (s === 'alive' && encounter.status === 'dead' && isLinked && onReviveRequest) {
      onReviveRequest()
      return
    }
    await updateStatus.mutateAsync({ id: encounter.id, status: s, runId: encounter.run_id })
  }

  async function doDelete() {
    await deleteEncounter.mutateAsync({ id: encounter.id, runId: encounter.run_id })
    setConfirmDelete(false)
  }

  const showAddToTeam = isMyEncounter && !isInTeam && !isDead && !!onAddToTeam

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${isDead ? 'border-red-900/40 bg-red-950/15 opacity-60' : 'border-[#2e2e42] bg-[#1c1c26]'} ${onClick ? 'cursor-pointer hover:border-slate-600' : ''}`}
        onClick={onClick}
        draggable={draggable && !isDead}
        onDragStart={draggable && !isDead ? (e) => {
          e.dataTransfer.setData('text/encounter-id', encounter.id)
          e.dataTransfer.effectAllowed = 'move'
        } : undefined}
      >
        {spriteUrl && (
          <img src={spriteUrl} alt={encounter.pokemon_name} className={`w-11 h-11 object-contain ${isDead ? 'grayscale' : ''}`} />
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold capitalize truncate ${isDead ? 'line-through text-slate-500' : 'text-white'}`}>
            {encounter.nickname ?? encounter.pokemon_name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-slate-500 text-xs">{encounter.location}</span>
            {linkedInfo && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: '#CC0000', background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.2)' }}
                onClick={(e) => { e.stopPropagation(); onNavigateToPairs?.() }}
              >
                ↔ {linkedInfo.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isInTeam && <Star className="w-3 h-3 text-pk-yellow" />}
          <span className="pk-badge flex items-center gap-1" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.icon} {cfg.label}
          </span>
          {showAddToTeam && (
            <button
              onClick={(e) => { e.stopPropagation(); if (teamEligible) onAddToTeam?.() }}
              disabled={!teamEligible}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
              style={teamEligible
                ? { background: 'rgba(204,0,0,0.12)', color: '#CC0000', border: '1px solid rgba(204,0,0,0.25)' }
                : { background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.25)' }}
              title={teamEligible ? 'Ins Hauptteam' : (teamBlockReason ?? 'Pokémon muss zuerst mit dem Partner verlinkt werden.')}
            >
              {teamEligible ? <Plus className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative pk-card anim-fade-up group ${menuOpen ? 'z-[300]' : ''} ${isDead ? 'pk-card-dead' : ''} ${isLinked ? 'anim-link-glow' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      draggable={draggable && !isDead}
      onDragStart={draggable && !isDead ? (e) => {
        e.dataTransfer.setData('text/encounter-id', encounter.id)
        e.dataTransfer.effectAllowed = 'move'
      } : undefined}
    >
      {/* Type accent bar */}
      {encounter.types && encounter.types.length > 0 && (
        <div
          className="h-1.5 rounded-t-[20px]"
          style={{ background: encounter.types.length === 2
            ? `linear-gradient(90deg, ${getTypeColor(encounter.types[0])} 50%, ${getTypeColor(encounter.types[1])} 50%)`
            : getTypeColor(encounter.types[0]) }}
        />
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Sprite */}
          <div
            className={`relative shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${isDead ? 'bg-slate-900/60' : 'bg-[#16161f]'} ${onClick ? 'group-hover:scale-105' : ''}`}
            onClick={onClick}
          >
            {spriteUrl ? (
              <img
                src={spriteUrl}
                alt={encounter.pokemon_name}
                className={`object-contain drop-shadow-lg ${isDead ? 'grayscale' : ''}`}
                style={{ width: 72, height: 72 }}
              />
            ) : (
              <span className="text-3xl">?</span>
            )}
            {isDead && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                <Skull className="w-7 h-7 text-red-400" />
              </div>
            )}
            {onClick && !isDead && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className={`font-black capitalize text-lg leading-tight ${isDead ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {encounter.nickname ?? encounter.pokemon_name}
                  </h3>
                  {isInTeam && <Star className="w-3.5 h-3.5 text-pk-yellow shrink-0" />}
                </div>
                {encounter.nickname && (
                  <div className="text-slate-500 text-xs capitalize mt-0.5">{encounter.pokemon_name}</div>
                )}
              </div>
              {isMyEncounter && (
                <button onClick={() => setConfirmDelete(true)} className="text-slate-600 hover:text-red-400 transition-colors p-1 hover:bg-red-400/10 rounded-lg shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-slate-500 text-xs mt-1.5 font-medium">{encounter.location}</div>

            {/* Soul Link partner badge */}
            {linkedInfo && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigateToPairs?.() }}
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-opacity hover:opacity-75"
                style={{ color: '#CC0000', background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.2)' }}
              >
                <Link2 className="w-2.5 h-2.5" />
                {linkedInfo.name} ({linkedInfo.playerName})
              </button>
            )}

            {encounter.types && encounter.types.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {encounter.types.map((t) => (
                  <span key={t} className="type-badge" style={{ background: getTypeColor(t) }}>{t}</span>
                ))}
              </div>
            )}

            {encounter.notes && (
              <div className="text-slate-400 text-xs mt-2 italic bg-white/5 rounded-lg px-2.5 py-1.5">
                {encounter.notes}
              </div>
            )}
          </div>
        </div>

        {/* Status + badges row */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {isMyEncounter ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold transition-all hover:opacity-80"
                style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                {cfg.icon} {cfg.label} <ChevronDown className="w-3 h-3" />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full mt-1 z-[200] bg-[#1c1c26] border border-[#2e2e42] rounded-2xl shadow-2xl overflow-hidden min-w-36">
                  {(Object.entries(STATUS_CFG) as [PokemonStatus, typeof STATUS_CFG[PokemonStatus]][]).map(([s, c]) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold hover:bg-white/5 transition-colors"
                      style={{ color: c.color }}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              {cfg.icon} {cfg.label}
            </span>
          )}

          {isLinked && !linkedInfo && (
            <span
              className="pk-badge flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ color: '#CC0000', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.3)' }}
              onClick={(e) => { e.stopPropagation(); onNavigateToPairs?.() }}
            >
              <Link2 className="w-3 h-3" /> SoulLink
            </span>
          )}

          {showAddToTeam && (
            <button
              onClick={(e) => { e.stopPropagation(); if (teamEligible) onAddToTeam?.() }}
              disabled={!teamEligible}
              title={teamEligible ? '' : (teamBlockReason ?? 'Pokémon muss zuerst mit dem Partner verlinkt werden.')}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:cursor-not-allowed"
              style={teamEligible
                ? { color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }
                : { color: '#64748b', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.25)' }}
            >
              {teamEligible ? <Star className="w-3 h-3" /> : <Lock className="w-3 h-3" />} Ins Team
            </button>
          )}

          {encounter.pokemon_id && (
            <span className="text-slate-600 text-xs font-mono ml-auto">#{String(encounter.pokemon_id).padStart(3, '0')}</span>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Pokémon entfernen?"
          message={<>Möchtest du <span className="text-white font-bold capitalize">{encounter.nickname ?? encounter.pokemon_name}</span> wirklich aus deinem Run entfernen?</>}
          note={'Das Pokémon wird aus „Meine Pokémon“ entfernt. Falls es mit einem Partner-Pokémon verlinkt ist, wird die Verlinkung ebenfalls entfernt.'}
          confirmLabel="Entfernen"
          danger
          busy={deleteEncounter.isPending}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
