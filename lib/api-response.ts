import { NextResponse } from "next/server"
import { SupabaseSchemaMissingError } from "@/lib/db-errors"

/**
 * Errors that mean "this feature is switched off right now" rather than
 * "something broke". They are matched by name so this module stays independent
 * of rate-limit and cannot create an import cycle with the routes.
 */
const UNAVAILABLE_ERROR_NAMES = new Set(["RateLimiterUnavailableError"])

const UNAVAILABLE_MESSAGE =
  "This feature is unavailable right now. Please contact the institute."

export type ApiFailure = { error: string; status: number; retryable: boolean }

/**
 * Maps a thrown error to the status and user-facing message a route should
 * return.
 *
 * The point of doing this centrally is that an unrun migration is an
 * operator-fixable 503 with an actionable log line, not a 500 that tells the
 * user to retry a request which can never succeed. Unknown errors still log the
 * full cause server-side but never leak internals to the client.
 */
export function describeApiFailure(err: unknown, context: string): ApiFailure {
  if (err instanceof SupabaseSchemaMissingError) {
    console.error(`[${context}] ${err.message}`)
    return {
      status: 503,
      error: `${UNAVAILABLE_MESSAGE} (database not migrated)`,
      retryable: false,
    }
  }

  if (err instanceof Error && UNAVAILABLE_ERROR_NAMES.has(err.name)) {
    console.error(`[${context}] ${err.message}`)
    return { status: 503, error: UNAVAILABLE_MESSAGE, retryable: false }
  }

  console.error(`[${context}] unexpected failure:`, err)
  return {
    status: 500,
    error: "Something went wrong on our end. Please try again.",
    retryable: true,
  }
}

/** Builds the JSON response for a failure described by {@link describeApiFailure}. */
export function failureResponse(failure: ApiFailure) {
  return NextResponse.json(
    { error: failure.error, retryable: failure.retryable },
    {
      status: failure.status,
      headers: failure.retryable ? { "Retry-After": "5" } : undefined,
    }
  )
}

/** Convenience wrapper: describe and respond in one call. */
export function respondWithFailure(err: unknown, context: string) {
  return failureResponse(describeApiFailure(err, context))
}

const MISSING_SCHEMA_MESSAGE =
  "The database is missing something this action needs. Apply supabase.sql in the Supabase SQL editor — it is safe to re-run — then try again."

const MISSING_ENUM_MESSAGE =
  "The database is missing the 'Rejected' payment status this action needs. Apply supabase.sql in the Supabase SQL editor — it is safe to re-run — then try again."

/**
 * SQLSTATEs that mean `supabase.sql` has not been applied since the code last
 * changed: a function, table or column the route depends on is not there. A
 * retry cannot fix any of them, so they become the non-retryable 503 the README
 * promises rather than "please try again".
 *
 * The case that mattered: `verify_installment_payments` writes `'Rejected'`
 * into the `payment_status` enum, and a database without that member refuses
 * the very first rejected claim. The route wrapped that in a generic 500, so an
 * admin was told to retry an operation that could never succeed and was handed
 * nothing to report.
 */
const MIGRATION_GAP_CODES: Record<string, string> = {
  "42883": MISSING_SCHEMA_MESSAGE,
  "42P01": MISSING_SCHEMA_MESSAGE,
  "42703": MISSING_SCHEMA_MESSAGE,
  "3F000": MISSING_SCHEMA_MESSAGE,
  PGRST202: MISSING_SCHEMA_MESSAGE,
}

/**
 * Maps an error returned by `supabaseAdmin.rpc()` to a status and message.
 *
 * `rpc()` reports Postgres failures as a value rather than throwing, so the
 * route has to interpret the SQLSTATE itself. Reads the code first: our own
 * `RAISE EXCEPTION ... USING ERRCODE` text is written for a person to act on and
 * is returned as a 400, a schema gap becomes a 503, and anything else keeps the
 * route's own wording with the SQLSTATE appended so the log and the toast agree
 * on which failure was seen.
 */
export function describeRpcFailure(
  error: { code?: string | null; message?: string | null },
  context: string,
  fallback: string
): ApiFailure {
  const code = (error.code ?? "").trim()
  const message = (error.message ?? "").trim()

  console.error(`[${context}] rpc failed (${code || "no sqlstate"}): ${message}`)

  // An invalid enum value surfaces as 22P02 whatever the label was, so the
  // message decides between "this enum member is missing" and a plain data
  // error, which is routed back as a 400 below.
  if (code === "22P02" && /rejected/i.test(message)) {
    return { status: 503, error: MISSING_ENUM_MESSAGE, retryable: false }
  }

  const schemaGap = MIGRATION_GAP_CODES[code]
  if (schemaGap) {
    return { status: 503, error: schemaGap, retryable: false }
  }

  if (code === "22023" || code === "42501") {
    return { status: 400, error: message || fallback, retryable: false }
  }

  // Unknown: the route's own wording, unchanged. The SQLSTATE and message are
  // already logged above, and README forbids surfacing internals — a code the
  // user cannot act on only turns a support report into a riddle.
  return { status: 500, error: fallback, retryable: true }
}
