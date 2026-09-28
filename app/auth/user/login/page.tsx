"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowRight, GraduationCap, Loader2, Lock, Mail, LogOut, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { useAuthRole, useAuthState, ROLE_HOME, resolvePostLoginPath } from "@/hooks/use-auth"
import { describeAuthError, type AuthErrorInfo } from "@/lib/errors"
import {
  readStudentRegistrationDraft,
  type StudentRegistrationDraft,
} from "@/lib/auth/student-registration-draft"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"

export default function UserLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { session, isAuthenticated, loading: sessionLoading, signOut } = useAuthState()
  const { role: accountRole, loading: roleLoading } = useAuthRole(
    session?.user?.id,
    isAuthenticated
  )

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<AuthErrorInfo | null>(null)
  const [pendingRegistrationDraft, setPendingRegistrationDraft] = useState<StudentRegistrationDraft | null>(null)

  // Read at the point of use rather than mirrored into state: the search params
  // never change while the page is mounted, and syncing them would cost an
  // extra render on every sign-in page load.
  const readNextPath = () => new URLSearchParams(window.location.search).get("next")

  // Prefill the email when arriving from the register page.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email")
    const draft = readStudentRegistrationDraft()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingRegistrationDraft(draft)
    if (prefill || draft?.email) setEmail(prefill || draft?.email || "")
  }, [])

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
    const next: { email?: string; password?: string } = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      next.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address"
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        const info = describeAuthError(error)
        setFormError(info)
        toast(info.message, {
          variant: "destructive",
          description: info.alreadyRegistered ? "Try signing in instead, or reset your password." : undefined,
        })
        return
      }

      if (!data.user) {
        const info: AuthErrorInfo = {
          message: "We couldn't sign you in. Please try again.",
          recovery: "retry",
          alreadyRegistered: false,
        }
        setFormError(info)
        toast(info.message, { variant: "destructive" })
        return
      }

      toast("Welcome back!", { variant: "success" })
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
  const matchingDraft = pendingRegistrationDraft?.email.toLowerCase() === email.trim().toLowerCase()
    ? pendingRegistrationDraft
    : null

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
              <span className="font-medium text-foreground">{session?.user?.email}</span>, but this email
              isn&apos;t linked to a student record yet. Contact the institute to activate it.
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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="size-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your student account</CardDescription>
        </CardHeader>

        <CardContent>
          {matchingDraft && (
            <div role="status" className="mb-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">Unfinished registration found</p>
              <p className="text-muted-foreground">
                {matchingDraft.fullName || matchingDraft.email}
                {matchingDraft.selectedCourseSlugs.length > 0 &&
                  ` · ${matchingDraft.selectedCourseSlugs.length} course${matchingDraft.selectedCourseSlugs.length === 1 ? "" : "s"} selected`}
                . Your details are saved on this device; your password is not saved.
              </p>
              <Link href="/auth/user/register" className="inline-block font-medium text-primary hover:underline">
                Resume registration
              </Link>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className="h-10 pl-10"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
                  }}
                  disabled={disabled}
                />
              </div>
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={
                    email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
                      ? `/auth/user/reset-password?email=${encodeURIComponent(email.trim())}`
                      : "/auth/user/reset-password"
                  }
                  className="text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
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
                  {formError.recovery === "reset" && (
                    <Link
                      href={`/auth/user/reset-password?email=${encodeURIComponent(email.trim())}`}
                      className="inline-block font-medium underline underline-offset-2"
                    >
                      Reset your password
                    </Link>
                  )}
                  {formError.recovery === "resend-confirmation" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { error: resendError } = await supabase.auth.resend({
                            type: "signup",
                            email: email.trim(),
                          })
                          if (resendError) throw resendError
                          toast("Confirmation email sent", { variant: "success" })
                        } catch (err) {
                          const info = describeAuthError(err)
                          toast(info.message, { variant: "destructive" })
                        }
                      }}
                      className="inline-block font-medium underline underline-offset-2"
                    >
                      Resend confirmation email
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" className="h-10 w-full gap-2" disabled={disabled}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/user/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
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
