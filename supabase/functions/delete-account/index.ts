// Supabase Edge Function: permanently delete the calling user's account.
//
// The browser client cannot delete an auth user (that needs the service-role key),
// so the "Account löschen" button in the profile calls this function. It verifies
// the caller's JWT, removes their profile row, then deletes the auth user.
//
// Deploy once:
//   supabase functions deploy delete-account
// The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are provided by Supabase
// automatically for deployed functions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
    if (!jwt) return json({ error: 'unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)
    const uid = data.user.id

    await admin.from('profiles').delete().eq('user_id', uid)
    const { error: delErr } = await admin.auth.admin.deleteUser(uid)
    if (delErr) return json({ error: delErr.message }, 500)

    return json({ ok: true }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
