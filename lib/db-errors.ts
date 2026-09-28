/**
 * Detects the "you have not run the migration yet" family of Postgres errors.
 *
 * PostgREST reports a missing table as SQLSTATE 42P01, and a missing column as
 * 42703. Without this, an unrun migration surfaces to the user as a generic
 * "something went wrong", which sends them to retry a request that can never
 * succeed. Callers use it to answer 503 with an actionable message instead.
 */
export function isMissingSchemaObject(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42P01" || error.code === "42703") return true
  return /does not exist|schema cache/i.test(error.message ?? "")
}

/**
 * Raised when Supabase is reachable but the tables this feature depends on are
 * absent, i.e. supabase.sql has not been applied.
 */
export class SupabaseSchemaMissingError extends Error {
  constructor(public readonly table: string, cause?: unknown) {
    super(
      `The Supabase table "${table}" does not exist. Apply supabase.sql in the Supabase SQL editor.`
    )
    this.name = "SupabaseSchemaMissingError"
    this.cause = cause
  }
}

/** Wraps a failed Supabase query, promoting an unrun migration to a typed error. */
export function assertSchemaPresent(
  table: string,
  error: { code?: string; message?: string } | null
): void {
  if (isMissingSchemaObject(error)) {
    throw new SupabaseSchemaMissingError(table, error)
  }
  if (error) {
    throw new Error(error.message || `Supabase request failed while touching "${table}"`)
  }
}

/**
 * Codes that mean "the database is not the shape this code was written against",
 * for a failure that came back inside a function body rather than from a query of
 * ours. 42883 is undefined_function, PGRST202/204 are PostgREST's equivalents, and
 * 42501 is insufficient_privilege — which for a service-role call means the GRANT
 * section of the migration never ran.
 */
const SCHEMA_DRIFT_CODES = new Set(["42703", "42P01", "42883", "42501", "PGRST202", "PGRST204"])

/**
 * Whether a failed RPC is schema drift rather than bad input.
 *
 * Worth separating because the two need opposite responses. Drift is an operator
 * problem: no retry can fix it, and telling the user to "please try again" sends
 * them round a loop that can only end the same way. Bad input is the caller's to
 * fix. This is the `register_student` case in particular — its body names
 * `payments.branch_id`, so a database from before that column existed fails on
 * every single call with a message that names neither the table nor the cause.
 */
export function isSchemaDriftError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code && SCHEMA_DRIFT_CODES.has(error.code)) return true
  return (
    isMissingSchemaObject(error) ||
    /register_student|function .* does not exist|permission denied for function/i.test(error.message ?? "")
  )
}
