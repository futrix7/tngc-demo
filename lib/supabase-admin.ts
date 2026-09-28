import "server-only"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Server-only client used to create accounts and set passwords.
 * Requires SUPABASE_SERVICE_ROLE_KEY, which must never be exposed to the browser.
 */
export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey)

export const supabaseAdmin = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  serviceRoleKey || "supabase-service-role-key-not-configured",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

export type UserLookup =
  | { status: "found"; userId: string }
  /** No account carries this address. Distinct from `exhausted` on purpose. */
  | { status: "absent" }
  /**
   * The scan hit its page cap without a verdict. Treated as a server error, never
   * as "no such user": a password reset that silently reported "no account
   * exists" for the 2,001st user was both wrong and unactionable.
   */
  | { status: "exhausted"; scanned: number }
  | { status: "error"; detail: string }

const USER_PAGE_SIZE = 1000
const USER_PAGE_CAP = 100

/**
 * Looks a user up by email address.
 *
 * Supabase's admin API has no getUserByEmail, so this pages through the user
 * list. That is O(n) and only acceptable for a project of this size, which is
 * why the caller must distinguish "not found" from "gave up looking" — see
 * {@link UserLookup}.
 */
export async function findUserIdByEmail(email: string): Promise<UserLookup> {
  const target = email.trim().toLowerCase()

  for (let page = 1; page <= USER_PAGE_CAP; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: USER_PAGE_SIZE,
    })

    if (error) {
      console.error("[auth] listUsers failed:", error.message)
      return { status: "error", detail: error.message }
    }

    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target)
    if (match) return { status: "found", userId: match.id }

    // A short page is the last page.
    if (data.users.length < USER_PAGE_SIZE) return { status: "absent" }
  }

  console.error(
    `[auth] findUserIdByEmail gave up after ${USER_PAGE_CAP * USER_PAGE_SIZE} users. ` +
      "Raise USER_PAGE_CAP or the institute is past the practical size for this lookup."
  )
  return { status: "exhausted", scanned: USER_PAGE_CAP * USER_PAGE_SIZE }
}

/**
 * Revokes every refresh token a user holds, ending all their sessions.
 *
 * Called after a password reset. Without it, a password reset only helps the
 * person who triggered it: a session cookie stolen beforehand stays valid until
 * it expires on its own, because changing a password does not invalidate
 * existing sessions by default.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(userId, "global")

  if (error) {
    // The password is already changed, so this is not worth failing the request
    // over — but it must be logged, because it means a stolen session may
    // survive. An operator can force it with the same call.
    console.error(`[auth] global sign-out failed for ${userId}:`, error.message)
  }
}

export type AdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 500; error: string }

/**
 * Server-side authorisation for admin-only endpoints.
 *
 * The client-side AuthGuard is a UX affordance, not a security boundary: it runs
 * in the browser, so anything it protects is already downloadable by an
 * anonymous visitor. Endpoints that expose admin data must check the bearer
 * token here, then confirm the account actually has a row in `admins`.
 */
export async function authenticateAdminRequest(request: Request): Promise<AdminAuthResult> {
  if (!isSupabaseAdminConfigured) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return { ok: false, status: 500, error: "This area is unavailable right now." }
  }

  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""

  if (!token) {
    return { ok: false, status: 401, error: "Sign in to continue." }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Your session has expired. Please sign in again." }
  }

  const { count, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", data.user.id)

  if (adminError) {
    console.error("[auth] admin lookup failed:", adminError.message)
    return { ok: false, status: 500, error: "This area is unavailable right now." }
  }

  if (!count) {
    return { ok: false, status: 403, error: "This area is restricted to administrators." }
  }

  return { ok: true, userId: data.user.id }
}

export type StudentAuthResult =
  | { ok: true; userId: string; studentId: string }
  | { ok: false; status: 401 | 403 | 500; error: string }

/**
 * Server-side authorisation for student-owned endpoints.
 *
 * Returns the student's own record id alongside the auth user id, so a caller
 * never has to accept a student id from the request body. The installment RPCs
 * are service_role only and take a p_user_id rather than reading the caller's
 * identity, so passing that id in from the browser unchecked would let anyone
 * file a payment claim against another student — the RPC would faithfully check
 * ownership against whatever identity it was handed.
 *
 * A session that is not linked to a students row is a 403, not a 404: the
 * account exists and is signed in, it just has no enrolment behind it.
 */
export async function authenticateStudentRequest(request: Request): Promise<StudentAuthResult> {
  if (!isSupabaseAdminConfigured) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return { ok: false, status: 500, error: "This area is unavailable right now." }
  }

  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""

  if (!token) {
    return { ok: false, status: 401, error: "Sign in to continue." }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Your session has expired. Please sign in again." }
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle()

  if (studentError) {
    console.error("[auth] student lookup failed:", studentError.message)
    return { ok: false, status: 500, error: "This area is unavailable right now." }
  }

  if (!student) {
    return {
      ok: false,
      status: 403,
      error: "No student enrollment is linked to this account.",
    }
  }

  return { ok: true, userId: data.user.id, studentId: student.id }
}
