"use client"

import { useCallback, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { resolveRole } from "@/lib/auth/resolve-role"
import { type AuthRole } from "@/lib/auth/roles"
import { describeAuthError, type AuthErrorInfo } from "@/lib/errors"

export { ROLE_HOME, ROLE_LOGIN, resolvePostLoginPath } from "@/lib/auth/roles"
export type { AuthRole }

export type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  isAuthenticated: boolean
  signOut: () => Promise<{ ok: boolean; error?: AuthErrorInfo }>
}

export function useAuthState(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  // Starts "loading" when Supabase is configured, because until getSession()
  // resolves we genuinely do not know whether a session exists — and reporting
  // "not loading, no session" for one paint makes a guard redirect before the
  // answer arrives. When Supabase is NOT configured there is nothing to wait for,
  // so it starts settled; leaving it pending would disable the login pages'
  // submit buttons forever, since the effect below returns early in that case.
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [configured] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error("[auth] getSession failed:", error.message)
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  /**
   * Signs the user out and drops local session state.
   *
   * Returns a result rather than throwing so a UI can tell the user when sign-out
   * did not actually happen, instead of redirecting them to a login page while
   * their cookie is still valid. The local state is only cleared on success —
   * clearing it on failure would render the portal as signed-out while Supabase
   * still considers them signed in, which is the more confusing of the two
   * failure modes.
   */
  const signOut = useCallback(async (): Promise<{ ok: boolean; error?: AuthErrorInfo }> => {
    if (!isSupabaseConfigured) {
      return { ok: true }
    }

    const { error } = await supabase.auth.signOut({ scope: "local" })

    if (error) {
      console.error("[auth] signOut failed:", error.message)
      return { ok: false, error: describeAuthError(error) }
    }

    setSession(null)
    return { ok: true }
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    configured,
    isAuthenticated: Boolean(session),
    signOut,
  }
}

/**
 * Resolves which portal the signed-in user belongs to.
 *
 * Returns "none" when the account exists in auth but has no profile. The result
 * is keyed by user id so a late response for a previous user can never be shown
 * against the current one.
 */
export function useAuthRole(userId: string | undefined, enabled = true) {
  const [resolved, setResolved] = useState<{ forUser: string; role: AuthRole | "none" } | null>(null)

  useEffect(() => {
    // No reset on the way out: `resolved` is keyed by user id, so a stale entry
    // simply stops matching once userId clears and the hook reports null.
    if (!enabled || !userId) return

    let active = true

    resolveRole(supabase, userId)
      .then((role) => {
        if (active) setResolved({ forUser: userId, role })
      })
      .catch((err) => {
        console.error("[auth] role lookup failed:", err)
        if (active) setResolved({ forUser: userId, role: "none" })
      })

    return () => {
      active = false
    }
  }, [userId, enabled])

  const isResolved = Boolean(resolved && resolved.forUser === userId)
  const loading = enabled && Boolean(userId) && !isResolved

  return {
    role: isResolved ? resolved!.role : null,
    loading,
  }
}
