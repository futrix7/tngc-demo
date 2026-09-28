"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ShieldAlert, LogOut, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthRole, useAuthState, ROLE_HOME, ROLE_LOGIN, type AuthRole } from "@/hooks/use-auth"
import { isSupabaseConfigured } from "@/lib/supabase"

type AuthGuardProps = {
  role: AuthRole
  children: React.ReactNode
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  )
}

export function AuthGuard({ role, children }: AuthGuardProps) {
  const router = useRouter()
  const { session, loading, signOut } = useAuthState()
  const { role: resolvedRole, loading: roleLoading } = useAuthRole(session?.user?.id, !loading)
  const loginPath = ROLE_LOGIN[role]

  useEffect(() => {
    if (!loading && !session) {
      router.replace(loginPath)
    }
  }, [loading, session, loginPath, router])

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldAlert className="size-7 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold">Service unavailable</CardTitle>
            <CardDescription>
              The database connection isn&apos;t configured. Add the Supabase keys to
              <span className="font-medium text-foreground"> .env.local</span> and restart the dev server.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading || (session && roleLoading)) {
    return <FullScreenLoader label="Checking your session..." />
  }

  if (!session) {
    return <FullScreenLoader label="Redirecting to sign in..." />
  }

  if (resolvedRole !== role) {
    // Send them straight to the portal they actually belong to, not to that
    // portal's login page (which would just bounce them back here).
    const destination = resolvedRole === "student" || resolvedRole === "admin" ? ROLE_HOME[resolvedRole] : null

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <ShieldAlert className="size-7 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-xl font-bold">
              {resolvedRole === "none" ? "No portal access" : "Wrong portal"}
            </CardTitle>
            <CardDescription>
              {resolvedRole === "none"
                ? "Your account is signed in, but it isn't linked to a student or admin profile yet. Contact the institute to get it activated."
                : `You're signed in as a ${resolvedRole}. This page is only for ${role} accounts.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {destination && (
              <Link href={destination} className="block">
                <Button className="h-10 w-full gap-2">
                  Go to {resolvedRole} portal
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              className="h-10 w-full gap-2"
              onClick={async () => {
                await signOut()
                router.replace(loginPath)
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
