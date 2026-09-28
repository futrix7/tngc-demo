"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, Shield } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { useAuthState } from "@/hooks/use-auth"
import { resolvePostLoginPath } from "@/lib/auth/roles"
import { lookupAdmin } from "@/lib/auth/resolve-role"
import { describeAuthError, describeDbError, type AuthErrorInfo } from "@/lib/errors"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"

export default function AdminLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, loading: sessionLoading } = useAuthState()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<AuthErrorInfo | null>(null)

  // Read at the point of use rather than mirrored into state: the search params
  // never change while the page is mounted, and syncing them would cost an
  // extra render on every sign-in page load.
  const readNextPath = () => new URLSearchParams(window.location.search).get("next")

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill) setEmail(prefill)
  }, [])

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      router.replace(resolvePostLoginPath("admin", readNextPath()))
    }
  }, [sessionLoading, isAuthenticated, router])

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
      const bootstrapResponse = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const bootstrapData = await bootstrapResponse.json().catch(() => ({}))

      if (!bootstrapResponse.ok) {
        const message = bootstrapData.error || "We couldn't prepare admin sign-in. Please try again."
        const info: AuthErrorInfo = {
          message,
          recovery: "contact-support",
          alreadyRegistered: false,
        }
        setFormError(info)
        toast(message, { variant: "destructive" })
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        const info = describeAuthError(error)
        setFormError(info)
        toast(info.message, { variant: "destructive" })
        return
      }

      const userId = data.user?.id
      if (!userId) {
        toast("We couldn't sign you in. Please try again.", { variant: "destructive" })
        return
      }

      const admin = await lookupAdmin(supabase, userId)

      if (!admin.ok) {
        // A failed lookup is not the same as "not an admin" — don't sign them out.
        const info = describeDbError(admin.error, "We couldn't verify your admin access. Please try again.")
        setFormError(info)
        toast(info.message, { variant: "destructive" })
        return
      }

      if (!admin.isAdmin) {
        await supabase.auth.signOut()
        const info: AuthErrorInfo = {
          message: "This account doesn't have admin access.",
          recovery: "contact-support",
          alreadyRegistered: false,
        }
        setFormError(info)
        toast(info.message, {
          variant: "destructive",
          description: "Ask an existing administrator to grant you access.",
        })
        return
      }

      toast("Signed in to the admin panel", { variant: "success" })
      router.replace(resolvePostLoginPath("admin", readNextPath()))
      router.refresh()
    } catch (err) {
      console.error("[auth] admin login crashed:", err)
      const info = describeAuthError(err)
      setFormError(info)
      toast(info.message, { variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || sessionLoading

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <Shield className="size-7 text-amber-600 dark:text-amber-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription>Sign in to admin dashboard</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
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

          <div className="mt-6 text-center">
            <Link
              href="/auth/user/login"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Back to student login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
