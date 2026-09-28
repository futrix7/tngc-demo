"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { useAuthState } from "@/hooks/use-auth"
import { ROLE_LOGIN, type AuthRole } from "@/lib/auth/roles"
import { useToast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

/**
 * Sign-out control for a portal.
 *
 * The admin portal had no sign-out at all: the sidebar had twelve navigation
 * links and no account menu, and the only sign-out-adjacent surface in the whole
 * app was the student settings page — which a signed-in admin cannot reach,
 * because proxy.ts bounces anyone with a role away from /auth/*. An admin who
 * wanted to hand the machine over had to clear cookies by hand.
 *
 * Sends the user to their own portal's sign-in page rather than "/", so they land
 * somewhere that makes sense for their role instead of the marketing homepage.
 */
export function SignOutButton({
  role,
  className,
}: {
  role: AuthRole
  className?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { signOut } = useAuthState()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    if (busy) return
    setBusy(true)

    try {
      const result = await signOut()

      if (!result.ok) {
        // Do not navigate: the cookie is still valid, so bouncing to the login
        // page would only bounce straight back.
        toast(result.error?.message ?? "We couldn't sign you out. Please try again.", {
          variant: "destructive",
        })
        return
      }

      router.replace(ROLE_LOGIN[role])
      router.refresh()
    } catch (err) {
      console.error("[auth] sign-out crashed:", err)
      toast("We couldn't sign you out. Please try again.", { variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-60",
        className
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {busy ? "Signing out..." : "Sign Out"}
    </button>
  )
}
