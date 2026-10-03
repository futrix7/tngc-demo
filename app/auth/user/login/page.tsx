"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowRight, GraduationCap, Loader2, Lock, Phone, LogOut, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { useAuthRole, useAuthState, ROLE_HOME, resolvePostLoginPath } from "@/hooks/use-auth"
import { describeAuthError, type AuthErrorInfo } from "@/lib/errors"
import { normalizeIndianPhone } from "@/lib/phone"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"

export default function UserLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { session, isAuthenticated, loading: sessionLoading, signOut } = useAuthState()
  const { role: accountRole, loading: roleLoading } = useAuthRole(
    session?.user?.id,
    isAuthenticated
  )

  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; password?: string }>({})
  const [formError, setFormError] = useState<AuthErrorInfo | null>(null)

  // Read at the point of use rather than mirrored into state: the search params
  // never change while the page is mounted, and syncing them would cost an
  // extra render on every sign-in page load.
  const readNextPath = () => new URLSearchParams(window.location.search).get("next")

  // Only students belong here. Resolve the role first so an admin or a
  // profile-less account gets a useful screen instead of a redirect loop
  // through the student dashboard and its guard.
  useEffect(() => {
    if (sessionLoading || roleLoading) return
    if (isAuthenticated && accountRole === "student") {
      router.replace(resolvePostLoginPath("student", readNextPath()))
    }
  }, [sessionLoading, roleLoading, isAuthenticated, accountRole, router])

  function validate() {
    const next: { phone?: string; password?: string } = {}

    if (!phone.trim()) {
      next.phone = "Phone number is required"
    } else if (!normalizeIndianPhone(phone)) {
      next.phone = "Enter a valid 10-digit mobile number"
    }

    if (!password) {
      next.password = "Password is required"
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!validate()) return

    setLoading(true)

    try {
      // Phone sign-in with SMS is disabled on this Supabase project, so the
      // number and password are verified by the server, which opens the session
      // for us. No OTP, no provider configuration, no "Phone logins are
      // disabled" — the form still asks for exactly what the student knows.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string; name?: string }

      if (!response.ok) {
        const info: AuthErrorInfo = {
          message: result.error || "We couldn't sign you in. Please try again.",
          recovery: "retry",
          alreadyRegistered: false,
        }
        setFormError(info)
        toast(info.message, { variant: "destructive" })
        return
      }

      // The session now lives in cookies; read it back so this page's auth
      // state (and the guard on the next page) agrees before we navigate.
      await supabase.auth.getSession()

      toast(result.name ? `Welcome back, ${result.name}!` : "Welcome back!", { variant: "success" })
      router.replace(resolvePostLoginPath("student", readNextPath()))
      router.refresh()
    } catch (err) {
      console.error("[auth] student login crashed:", err)
      const info = describeAuthError(err)
      setFormError(info)
      toast(info.message, { variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || sessionLoading

  // Already signed in, but not as a student. Show where to go instead of
  // redirecting to a dashboard whose guard would only bounce them back.
  if (isAuthenticated && !roleLoading && accountRole === "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <ShieldAlert className="size-7 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold">You&apos;re signed in as staff</CardTitle>
            <CardDescription>This is the student sign-in page. Your account has admin access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href={ROLE_HOME.admin} className="block">
              <Button className="h-10 w-full gap-2">
                Go to admin dashboard
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="h-10 w-full gap-2"
              onClick={async () => {
                await signOut()
                router.refresh()
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

  if (isAuthenticated && !roleLoading && accountRole === "none") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <ShieldAlert className="size-7 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold">No student account found</CardTitle>
            <CardDescription>
              You&apos;re signed in as{" "}
              <span className="font-medium text-foreground">{session?.user?.phone}</span>, but this phone
              number isn&apos;t linked to a student record yet. Contact the institute to activate it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="h-10 w-full gap-2"
              onClick={async () => {
                await signOut()
                router.refresh()
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-3 py-8 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md sm:max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="size-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in with your phone number and password</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={16}
                  placeholder="10-digit mobile number"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="h-10 pl-10"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: undefined }))
                  }}
                  disabled={disabled}
                />
              </div>
              {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
              <p className="text-xs text-muted-foreground">
                The password is the one your administrator set for you.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  className="h-10 pl-10 pr-10"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }))
                  }}
                  disabled={disabled}
                />
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  label="password"
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                  disabled={disabled}
                />
              </div>
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p>{formError.message}</p>
                </div>
              </div>
            )}

            <Button type="submit" className="h-10 w-full gap-2" disabled={disabled}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Wait...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <Link href="/" className="block">
              <Button type="button" variant="outline" className="h-10 w-full gap-2">
                Go to landing page
              </Button>
            </Link>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Staff member?{" "}
            <Link href="/auth/admin/login" className="font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Admin sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
