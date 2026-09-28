import { NextResponse, type NextRequest } from "next/server"
import { refreshSession } from "@/lib/supabase/proxy"
import { resolveRole } from "@/lib/auth/resolve-role"
import {
  ROLE_HOME,
  buildLoginUrl,
  isAuthPath,
  portalForPath,
} from "@/lib/auth/roles"

/**
 * Route protection that runs before any page renders.
 *
 * The client-side AuthGuard is a UX affordance: it ships to the browser, so
 * anything it hides is still fetchable by an anonymous visitor. This proxy is
 * the actual boundary. It is not sufficient on its own either — the Next.js data
 * security guide is explicit that every Server Function and route handler must
 * re-check authorisation — but it closes the "paste the dashboard URL" gap and
 * removes the flash of private content while the session loads.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const portal = portalForPath(pathname)
  const onAuthPage = isAuthPath(pathname)

  // Nothing to enforce on public pages, and a Supabase round trip per asset
  // request would be wasteful, so bail before touching the session.
  if (!portal && !onAuthPage) return NextResponse.next({ request })

  const { response, user, client } = await refreshSession(request)

  if (!user) {
    if (portal) {
      return NextResponse.redirect(buildLoginUrl(request.url, portal, `${pathname}${search}`))
    }
    return response
  }

  // A signed-in visitor has no business on a sign-in or registration page.
  // Sending them to the portal they belong to also avoids the redirect loop of
  // guard-bounces-to-login-bounces-back.
  //
  // An account with no profile is the exception: it has no portal to go to, and
  // the auth pages are where the sign-out control lives, so it stays reachable.
  if (onAuthPage && client) {
    const role = await resolveRole(client, user.id)
    if (role !== "none") {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
    }
  }

  if (portal && client) {
    const role = await resolveRole(client, user.id)
    if (role !== "none" && role !== portal) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
    }
  }

  return response
}

export const config = {
  /**
   * Only the two portals and the auth pages are matched. A negative pattern is
   * not used because a narrower matcher is easier to reason about: adding a
   * third protected area means adding it here, which fails loudly rather than
   * silently leaving it open.
   */
  matcher: ["/admin/:path*", "/student/:path*", "/auth/:path*"],
}
