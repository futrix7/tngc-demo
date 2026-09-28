import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  )
}

/**
 * Browser client shared by every client component.
 *
 * Storage is cookies rather than localStorage so proxy.ts can read and refresh
 * the session before a protected page renders. Placeholder keys keep the module
 * importable, so a missing env var surfaces as a handled request error in the
 * UI instead of a blank screen at import time.
 *
 * NOT parameterised with `Database` from types/database.ts, on purpose. Doing so
 * is what this file should eventually do — it is the only thing that would have
 * caught the finance dashboard selecting payments.branch_id before that column
 * existed. But types/database.ts is hand-maintained and does not yet describe the
 * app's actual queries: its table entries declare no `Relationships`, so the
 * nested selects the portal relies on (fees(...), students(...)) resolve to
 * `never` and produce 505 type errors across 30 files. Wiring it up needs a real
 * regeneration against the live project, not edits by hand:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * Until then, a query for a column that does not exist fails at runtime as a
 * silent empty result — so every query must handle `.error` explicitly. None of
 * them may fall back to `|| []`.
 */
export const supabase = createBrowserClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseAnonKey || "supabase-anon-key-not-configured"
)
