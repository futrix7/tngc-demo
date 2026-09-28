import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthRole } from "@/lib/auth/roles"

export type AdminLookup =
  | { ok: true; isAdmin: boolean }
  /**
   * The lookup itself failed. Callers must not read this as "not an admin": a
   * database blip is not a verdict, and treating it as one would either lock a
   * real administrator out or, worse, hide the failure entirely.
   */
  | { ok: false; error: string }

/**
 * Single source of truth for "does this account have admin access?".
 *
 * This check existed in three places that had already drifted apart — the role
 * resolver, the admin login page, and the server-side request authenticator.
 * They must agree: two of them deciding differently about the same user is how
 * someone ends up signed in but refused by every page.
 *
 * The `admins` row is the whole definition of admin access. That is the
 * invariant the RLS policies in supabase.sql are built on, and it
 * is also why no client can create one for itself any more.
 */
export async function lookupAdmin(
  client: SupabaseClient,
  userId: string
): Promise<AdminLookup> {
  const { data, error } = await client
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, isAdmin: Boolean(data) }
}

/**
 * Resolves which portal an authenticated user belongs to.
 *
 * Admins are checked first so a user who somehow has rows in both tables keeps
 * staff access. Returns "none" when the account is valid but not yet linked to
 * a student or admin profile, which is a state the UI must explain rather than
 * treat as a failed sign-in.
 */
export async function resolveRole(
  client: SupabaseClient,
  userId: string
): Promise<AuthRole | "none"> {
  const admin = await lookupAdmin(client, userId)

  if (!admin.ok) {
    console.error("[auth] admins lookup failed:", admin.error)
  }

  if (admin.ok && admin.isAdmin) return "admin"

  const { data: student, error: studentError } = await client
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (studentError) {
    console.error("[auth] students lookup failed:", studentError.message)
  }

  return student ? "student" : "none"
}
