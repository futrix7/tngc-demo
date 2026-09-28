import "server-only"

import { isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { assertSchemaPresent } from "@/lib/db-errors"

const LOG_TABLE = "rate_limit_log"

/**
 * Raised when Supabase is not configured, so route handlers can answer 503
 * instead of silently reporting a success that nothing was recorded for.
 */
export class RateLimiterUnavailableError extends Error {
  constructor() {
    super(
      "The rate limiter is unavailable: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local"
    )
    this.name = "RateLimiterUnavailableError"
  }
}

function assertLimiterAvailable(): void {
  if (!isSupabaseAdminConfigured) throw new RateLimiterUnavailableError()
}

export type RateVerdict = { allowed: boolean; retryInSec: number }

async function countSince(scope: string, since: number): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(LOG_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .gt("created_at", new Date(since).toISOString())

  assertSchemaPresent(LOG_TABLE, error)
  return count ?? 0
}

async function oldestSince(scope: string, since: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from(LOG_TABLE)
    .select("created_at")
    .eq("scope", scope)
    .gt("created_at", new Date(since).toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  assertSchemaPresent(LOG_TABLE, error)
  return data ? new Date(data.created_at).getTime() : null
}

/**
 * Sliding-window request throttle, backed by Postgres so the limit holds across
 * every server instance rather than resetting on each deploy.
 *
 * An allowed call is recorded; a rejected one is not, so a caller that is being
 * throttled does not push its own unlock further out.
 */
export async function checkRate(
  scope: string,
  limit: number,
  windowMs: number
): Promise<RateVerdict> {
  assertLimiterAvailable()

  const now = Date.now()
  const windowStart = now - windowMs

  const count = await countSince(scope, windowStart)

  if (count >= limit) {
    const oldest = (await oldestSince(scope, windowStart)) ?? now
    return {
      allowed: false,
      retryInSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  const { error } = await supabaseAdmin
    .from(LOG_TABLE)
    .insert({ scope, created_at: new Date(now).toISOString() })

  assertSchemaPresent(LOG_TABLE, error)

  // Opportunistic cleanup keeps the log bounded without needing a cron job.
  // Fire-and-forget: a failed purge must never fail a request that was allowed.
  void supabaseAdmin
    .from(LOG_TABLE)
    .delete()
    .lt("created_at", new Date(windowStart).toISOString())
    .then(({ error: purgeError }) => {
      if (purgeError) console.error("[rate-limit] purge failed:", purgeError.message)
    })

  return { allowed: true, retryInSec: 0 }
}

/**
 * Charges several scopes atomically enough for abuse control: every scope is
 * counted first, and only if all of them are under their limit is a row written
 * for each. A caller that is over any limit is not charged.
 */
export async function checkRateAcross(
  scopes: Array<{ scope: string; limit: number }>,
  windowMs: number
): Promise<RateVerdict> {
  assertLimiterAvailable()

  if (scopes.length === 0) return { allowed: true, retryInSec: 0 }

  const now = Date.now()
  const windowStart = now - windowMs

  const counts = await Promise.all(scopes.map((s) => countSince(s.scope, windowStart)))

  for (let i = 0; i < scopes.length; i++) {
    if (counts[i] < scopes[i].limit) continue

    const oldest = (await oldestSince(scopes[i].scope, windowStart)) ?? now
    return {
      allowed: false,
      retryInSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  const { error } = await supabaseAdmin
    .from(LOG_TABLE)
    .insert(
      scopes.map((s) => ({ scope: s.scope, created_at: new Date(now).toISOString() }))
    )

  assertSchemaPresent(LOG_TABLE, error)

  void supabaseAdmin
    .from(LOG_TABLE)
    .delete()
    .lt("created_at", new Date(windowStart).toISOString())
    .then(({ error: purgeError }) => {
      if (purgeError) console.error("[rate-limit] purge failed:", purgeError.message)
    })

  return { allowed: true, retryInSec: 0 }
}
