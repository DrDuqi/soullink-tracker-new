import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly with an actionable message instead of cryptic "Invalid URL"
  // errors deep inside the data layer.
  throw new Error(
    'Supabase-Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein ' +
    '(lokal in .env, in Produktion in den Vercel Project Settings → Environment Variables).',
  )
}

// Abort hung HTTP requests so the UI never spins forever on a dropped/slow
// connection. Realtime uses WebSockets and is unaffected by this wrapper.
const REQUEST_TIMEOUT_MS = 20_000
const fetchWithTimeout: typeof fetch = (input, init) => {
  // Respect an explicitly provided signal (don't clobber caller-side aborts).
  if (init?.signal) return fetch(input, init)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Identity comes exclusively from Supabase Auth and persists across reloads.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles the OAuth redirect (Google) when enabled
  },
  global: { fetch: fetchWithTimeout },
})
