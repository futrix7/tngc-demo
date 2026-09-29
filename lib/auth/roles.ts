export type AuthRole = "admin" | "student"

/** Canonical sign-in page for each portal. */
export const ROLE_LOGIN: Record<AuthRole, string> = {
  admin: "/auth/admin/login",
  student: "/auth/user/login",
}

/** Canonical landing page for each portal. Never point a signed-in user at a login page. */
export const ROLE_HOME: Record<AuthRole, string> = {
  admin: "/admin/dashboard",
  student: "/student/profile",
}

/**
 * Portal that owns a protected path, or null when the path is public.
 * This is the single source of truth shared by proxy, layouts and the client
 * guard, so a route can never be protected under one role and linked from another.
 */
export function portalForPath(pathname: string): AuthRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin"
  if (pathname === "/student" || pathname.startsWith("/student/")) return "student"
  return null
}

export function isAuthPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/")
}

function safeNextPath(next: string | null): string {
  if (!next) return ""
  // Only same-origin absolute paths, so a crafted ?next= cannot bounce a signed-in
  // user to an external site through the login redirect.
  if (!next.startsWith("/") || next.startsWith("//")) return ""
  return next
}

/** Builds the sign-in URL for a portal, preserving where the user was heading. */
export function buildLoginUrl(origin: string, role: AuthRole, next?: string | null): URL {
  const url = new URL(ROLE_LOGIN[role], origin)
  const target = safeNextPath(next ?? null)
  if (target) url.searchParams.set("next", target)
  return url
}

/**
 * Resolves the post-login destination. A `next` param is only honoured when it
 * belongs to the portal the user actually signed into, otherwise a student
 * carrying `?next=/admin/payments` would be sent into the admin area.
 */
export function resolvePostLoginPath(role: AuthRole, next?: string | null): string {
  const target = safeNextPath(next ?? null)
  if (target && portalForPath(target) === role) return target
  return ROLE_HOME[role]
}
