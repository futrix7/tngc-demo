import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export type SessionRefresh = {
  /** Response carrying any rotated auth cookies. Must be returned, not discarded. */
  response: NextResponse
  user: { id: string; email?: string } | null
  /**
   * Cookie-backed client for the current request. Exposed so authorisation
   * checks reuse the already-refreshed session instead of opening a second one.
   */
  client: SupabaseClient | null
}

/**
 * Reads the session from cookies and refreshes it if the access token has expired.
 *
 * Supabase stores the session in a cookie rather than localStorage precisely so
 * this can run before render: a request for a protected page is answered with a
 * redirect instead of a page that flashes private content and then bounces.
 *
 * Any refreshed cookies are written onto a fresh response. Callers must return
 * `response` on every path, otherwise a token rotation is silently dropped and
 * the user is signed out on their next request.
 */
export async function refreshSession(request: NextRequest): Promise<SessionRefresh> {
  if (!isSupabaseConfigured) {
    console.error(
      "[auth] Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    )
    return { response: NextResponse.next({ request }), user: null, client: null }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() revalidates the JWT with the auth server. getSession() would only
  // trust the cookie's contents, which is not a security check.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    // "Auth session missing!" is what getUser() returns when nobody is signed in,
    // which is the normal state for an anonymous visitor on a sign-in or
    // registration page — and those pages are matched by the proxy on purpose. It
    // is an answer, not a failure, so it must not be logged as one: a console full
    // of it buries the errors that matter and reads as a broken sign-in when the
    // only thing that happened is that no one is signed in yet.
    //
    // A missing session is also not a refresh failure. The two cases that are:
    // an expired token the auth server rejected, and a network fault.
    if (!/auth session missing/i.test(error.message)) {
      console.error("[auth] session refresh failed:", error.message)
    }
  }

  return { response, user: user ? { id: user.id, email: user.email ?? undefined } : null, client: supabase }
}
