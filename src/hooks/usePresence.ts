import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Online presence per run via Supabase Realtime. A player counts as online while
// they have the run open; Realtime auto-drops them (presence "leave") when they
// close the run or the connection dies — no extra heartbeat needed. Touches no
// tables / RLS, so it cannot affect any existing data flow.
export function usePresence(runId: string | null, me: { playerId: string; name: string } | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())
  const myId = me?.playerId ?? ''
  const myName = me?.name ?? ''

  useEffect(() => {
    if (!runId || !myId) return
    const channel = supabase.channel(`presence:run:${runId}`, { config: { presence: { key: myId } } })

    function sync() {
      const state = channel.presenceState()
      setOnline(new Set(Object.keys(state)))   // keys = the present players' ids
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ playerId: myId, name: myName, at: Date.now() })
      })

    return () => { supabase.removeChannel(channel) }
  }, [runId, myId, myName])

  return online
}
