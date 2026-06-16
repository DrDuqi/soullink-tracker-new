import { Bell, Link2, Skull, Check, X, Clock, AlertTriangle, AlertCircle, Star, ArrowRight, Heart } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useResolveRequest } from '../hooks/useRequests'
import type { RequestWithDetails, RouteMatchType } from '../types/database'

interface Props {
  requests: RequestWithDetails[]
  myPlayerId: string
}

export default function RequestsPanel({ requests, myPlayerId }: Props) {
  if (requests.length === 0) return null

  return (
    <div className="mb-6 anim-slide-d">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Bell className="w-5 h-5 text-pk-yellow" />
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-pk-red rounded-full text-[9px] flex items-center justify-center text-white font-black">
            {requests.length}
          </span>
        </div>
        <h2 className="text-white text-base font-black">Offene Anfragen</h2>
      </div>
      <div className="space-y-3">
        {requests.map((req, i) => (
          <div key={req.id} style={{ animationDelay: `${i * 0.07}s` }}>
            <RequestCard request={req} myPlayerId={myPlayerId} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EncounterMiniCard({ enc, label }: { enc: NonNullable<RequestWithDetails['encounter1']>; label: string }) {
  return (
    <div className="rounded-xl border border-[#2e2e42] bg-[#16161f] p-3">
      <div className="text-slate-500 text-[10px] mb-1.5">{label}</div>
      {enc.types && enc.types.length > 0 && (
        <div
          className="h-0.5 rounded-full mb-2"
          style={{
            background:
              enc.types.length === 2
                ? `linear-gradient(90deg, ${getTypeColor(enc.types[0])} 50%, ${getTypeColor(enc.types[1])} 50%)`
                : getTypeColor(enc.types[0]),
          }}
        />
      )}
      <div className="flex items-center gap-2">
        {enc.pokemon_id && <img src={getSpriteUrl(enc.pokemon_id)} className="w-12 h-12 object-contain" alt="" />}
        <div>
          <div className="text-white text-sm capitalize font-bold">{enc.nickname ?? enc.pokemon_name}</div>
          <div className="text-slate-500 text-xs">{enc.location}</div>
        </div>
      </div>
    </div>
  )
}

function RequestCard({ request, myPlayerId }: { request: RequestWithDetails; myPlayerId: string }) {
  const resolve = useResolveRequest()
  const isTarget = request.target_player_id === myPlayerId
  const isRequester = request.requested_by_player_id === myPlayerId

  if (request.request_type === 'link') {
    const e1 = request.encounter1
    const e2 = request.encounter2
    const rm = request.route_match_type as RouteMatchType | null

    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#CC000030' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-pk-red to-pk-yellow" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-pk-red/10 border border-pk-red/25 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-pk-red" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">
                <span className="text-pk-yellow">{request.requesterName}</span> möchte folgende Pokémon als Soul Link verbinden:
              </p>
              {rm === 'manual_exception' && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Ausnahme: Pokémon wurden auf verschiedenen Routen gefangen!
                </div>
              )}
              {rm === 'similar' && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-yellow-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Ähnliche Routen erkannt — möglicher Tippfehler.
                </div>
              )}
            </div>
          </div>

          {e1 && e2 && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <EncounterMiniCard enc={e1} label={request.requesterName} />
              <EncounterMiniCard enc={e2} label={request.targetName} />
            </div>
          )}

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            enc1Name={e1 ? (e1.nickname ?? e1.pokemon_name) : undefined}
            enc2Name={e2 ? (e2.nickname ?? e2.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  if (request.request_type === 'death') {
    const trigger = request.triggerEncounter
    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#f8717130' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-red-800 to-red-500" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
              <Skull className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-white text-sm font-bold">
              <span className="text-red-400">{request.requesterName}</span> meldet: Ein verlinktes Pokémon wurde besiegt.
              Dadurch würde auch dein Pokémon als besiegt markiert werden.
            </p>
          </div>

          {trigger && (
            <div className="flex items-center gap-4 rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-3 mb-4">
              {trigger.pokemon_id && (
                <img src={getSpriteUrl(trigger.pokemon_id)} className="w-14 h-14 object-contain grayscale" alt="" />
              )}
              <div>
                <div className="text-white text-base capitalize font-black">
                  {trigger.nickname ?? trigger.pokemon_name}
                  <span className="text-red-400 font-normal ml-2 text-sm">wurde besiegt</span>
                </div>
                <div className="text-slate-500 text-xs mt-1">{trigger.location}</div>
              </div>
            </div>
          )}

          <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
            ⚠ Bei Bestätigung werden beide verlinkten Pokémon sofort als „Besiegt" markiert.
          </div>

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            isDeath
            triggerName={trigger ? (trigger.nickname ?? trigger.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  if (request.request_type === 'team_sync') {
    const myEnc = request.encounter1
    const partnerEnc = request.encounter2

    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#4ade8030' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-green-700 to-pk-yellow" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-white text-sm font-bold">
              <span className="text-green-400">{request.requesterName}</span> möchte{' '}
              <span className="capitalize text-white">{myEnc?.nickname ?? myEnc?.pokemon_name ?? '?'}</span> ins Hauptteam aufnehmen.
              {partnerEnc && (
                <>
                  {' '}Dein verlinktes Pokémon{' '}
                  <span className="capitalize text-pk-yellow">{partnerEnc.nickname ?? partnerEnc.pokemon_name}</span>
                  {' '}würde ebenfalls aufgenommen werden.
                </>
              )}
            </p>
          </div>

          {myEnc && partnerEnc && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <EncounterMiniCard enc={myEnc} label={request.requesterName} />
              <EncounterMiniCard enc={partnerEnc} label={request.targetName} />
            </div>
          )}

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            isTeamSync
            enc1Name={myEnc ? (myEnc.nickname ?? myEnc.pokemon_name) : undefined}
            enc2Name={partnerEnc ? (partnerEnc.nickname ?? partnerEnc.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  if (request.request_type === 'team_remove') {
    const myEnc = request.encounter1
    const partnerEnc = request.encounter2

    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#ef444430' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-red-700 to-red-500" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
              <X className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-white text-sm font-bold">
              <span className="text-red-400">{request.requesterName}</span> möchte{' '}
              <span className="capitalize text-white">{myEnc?.nickname ?? myEnc?.pokemon_name ?? '?'}</span>{' '}
              aus dem Hauptteam entfernen.
              {partnerEnc && (
                <>
                  {' '}Dein verlinktes Pokémon{' '}
                  <span className="capitalize text-pk-yellow">{partnerEnc.nickname ?? partnerEnc.pokemon_name}</span>
                  {' '}würde ebenfalls entfernt werden.
                </>
              )}
            </p>
          </div>

          {myEnc && partnerEnc && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <EncounterMiniCard enc={myEnc} label={request.requesterName} />
              <EncounterMiniCard enc={partnerEnc} label={request.targetName} />
            </div>
          )}

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            isTeamRemove
            enc1Name={myEnc ? (myEnc.nickname ?? myEnc.pokemon_name) : undefined}
            enc2Name={partnerEnc ? (partnerEnc.nickname ?? partnerEnc.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  if (request.request_type === 'team_move') {
    const myEnc = request.encounter1
    const partnerEnc = request.encounter2
    const targetSlot = request.slot_position

    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#a855f730' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-purple-700 to-purple-400" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0">
              <ArrowRight className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-white text-sm font-bold">
              <span className="text-purple-400">{request.requesterName}</span> möchte{' '}
              <span className="capitalize text-white">{myEnc?.nickname ?? myEnc?.pokemon_name ?? '?'}</span>{' '}
              auf Slot {targetSlot} verschieben.
              {partnerEnc && (
                <>
                  {' '}Dein verlinktes Pokémon{' '}
                  <span className="capitalize text-pk-yellow">{partnerEnc.nickname ?? partnerEnc.pokemon_name}</span>
                  {' '}würde ebenfalls auf Slot {targetSlot} verschoben.
                </>
              )}
            </p>
          </div>

          {myEnc && partnerEnc && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {([{ enc: myEnc, label: request.requesterName }, { enc: partnerEnc, label: request.targetName }] as const).map(({ enc, label }) => (
                <div key={enc.id} className="rounded-xl border border-[#2e2e42] bg-[#16161f] p-3">
                  <div className="text-slate-500 text-[10px] mb-1.5">{label}</div>
                  {enc.types && enc.types.length > 0 && (
                    <div
                      className="h-0.5 rounded-full mb-2"
                      style={{
                        background:
                          enc.types.length === 2
                            ? `linear-gradient(90deg, ${getTypeColor(enc.types[0])} 50%, ${getTypeColor(enc.types[1])} 50%)`
                            : getTypeColor(enc.types[0]),
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    {enc.pokemon_id && <img src={getSpriteUrl(enc.pokemon_id)} className="w-12 h-12 object-contain" alt="" />}
                    <div>
                      <div className="text-white text-sm capitalize font-bold">{enc.nickname ?? enc.pokemon_name}</div>
                      <div className="text-slate-500 text-xs">{enc.location}</div>
                      {targetSlot != null && (
                        <div className="text-purple-400 text-xs mt-0.5">→ Slot {targetSlot}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            isTeamMove
            enc1Name={myEnc ? (myEnc.nickname ?? myEnc.pokemon_name) : undefined}
            enc2Name={partnerEnc ? (partnerEnc.nickname ?? partnerEnc.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  if (request.request_type === 'revive') {
    const myEnc = request.encounter1
    const partnerEnc = request.encounter2

    return (
      <div className="rounded-2xl border anim-slide-r" style={{ background: '#1c1c26', borderColor: '#22d3ee30' }}>
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-cyan-700 to-teal-500" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-white text-sm font-bold">
              <span className="text-cyan-400">{request.requesterName}</span> möchte{' '}
              <span className="capitalize text-white">{myEnc?.nickname ?? myEnc?.pokemon_name ?? '?'}</span>{' '}
              und{' '}
              <span className="capitalize text-pk-yellow">{partnerEnc?.nickname ?? partnerEnc?.pokemon_name ?? '?'}</span>{' '}
              wieder auf „Am Leben" setzen.
            </p>
          </div>

          {myEnc && partnerEnc && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <EncounterMiniCard enc={myEnc} label={request.requesterName} />
              <EncounterMiniCard enc={partnerEnc} label={request.targetName} />
            </div>
          )}

          <ActionRow
            isTarget={isTarget}
            isRequester={isRequester}
            request={request}
            resolve={resolve}
            isRevive
            enc1Name={myEnc ? (myEnc.nickname ?? myEnc.pokemon_name) : undefined}
            enc2Name={partnerEnc ? (partnerEnc.nickname ?? partnerEnc.pokemon_name) : undefined}
          />
        </div>
      </div>
    )
  }

  return null
}

function ActionRow({
  isTarget, isRequester, request, resolve,
  isDeath, isTeamSync, isTeamRemove, isTeamMove, isRevive,
  enc1Name, enc2Name, triggerName,
}: {
  isTarget: boolean
  isRequester: boolean
  request: RequestWithDetails
  resolve: ReturnType<typeof useResolveRequest>
  isDeath?: boolean
  isTeamSync?: boolean
  isTeamRemove?: boolean
  isTeamMove?: boolean
  isRevive?: boolean
  enc1Name?: string
  enc2Name?: string
  triggerName?: string
}) {
  if (isTarget) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => resolve.mutate({ request, action: 'rejected', enc1Name, enc2Name, triggerName })}
          disabled={resolve.isPending}
          className="btn-ghost flex-1 py-3 text-sm"
        >
          <X className="w-4 h-4 inline mr-1.5" /> Ablehnen
        </button>
        <button
          onClick={() => resolve.mutate({ request, action: 'accepted', enc1Name, enc2Name, triggerName })}
          disabled={resolve.isPending}
          className="flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          style={
            isDeath ? { background: '#991b1b', color: 'white' } :
            isTeamSync ? { background: '#15803d', color: 'white' } :
            isTeamRemove ? { background: '#991b1b', color: 'white' } :
            isTeamMove ? { background: '#7e22ce', color: 'white' } :
            isRevive ? { background: '#0e7490', color: 'white' } :
            { background: '#CC0000', color: 'white' }
          }
        >
          {isDeath ? <Skull className="w-4 h-4" /> :
           isTeamSync ? <Star className="w-4 h-4" /> :
           isTeamRemove ? <X className="w-4 h-4" /> :
           isTeamMove ? <ArrowRight className="w-4 h-4" /> :
           isRevive ? <Heart className="w-4 h-4" /> :
           <Check className="w-4 h-4" />}
          {isDeath ? 'Tod bestätigen' :
           isTeamSync ? 'Team-Aufnahme' :
           isTeamRemove ? 'Entfernen' :
           isTeamMove ? 'Verschieben' :
           isRevive ? 'Wiederbeleben' :
           'Akzeptieren'}
        </button>
      </div>
    )
  }
  if (isRequester) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-slate-500 text-sm">
        <Clock className="w-4 h-4" />
        Warte auf Antwort von {request.targetName}…
      </div>
    )
  }
  return null
}
