"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle,
  ArrowLeft,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
} from "lucide-react"
import { useToast } from "@/components/ui/sonner"
import { ROLE_LOGIN, type AuthRole } from "@/hooks/use-auth"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"

const PORTAL_NAME: Record<AuthRole, string> = {
  admin: "the admin portal",
  student: "the student portal",
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * The shared password-reset wizard for both portals.
 *
 * SECURITY: there is no emailed verification code here. The form collects an
 * email and a new password and posts them straight to /api/reset-password,
 * which sets the password with the service-role key. Anyone who knows an
 * account's email address can therefore take that account over.
 */
export function ResetPasswordForm({ role }: { role: AuthRole }) {
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)

  const [updating, setUpdating] = useState(false)

  const [error, setError] = useState("")

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill) setEmail(prefill)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const trimmedEmail = email.trim()

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain at least one letter and one number.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setUpdating(true)

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "We couldn't update your password.")
        return
      }

      toast("Password updated", {
        variant: "success",
        description: `Sign in to ${PORTAL_NAME[role]} with your new password.`,
      })
      router.replace(ROLE_LOGIN[role])
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/50 px-3 py-8 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md sm:max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="size-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your account email and choose a new password
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-10 pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={updating}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="h-10 pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={updating}
                  required
                />
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  label="new password"
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                  disabled={updating}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters, including a letter and a number.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={confirmPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  className="h-10 pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={updating}
                  required
                />
                <PasswordVisibilityToggle
                  visible={confirmPasswordVisible}
                  label="confirm new password"
                  onToggle={() => setConfirmPasswordVisible((visible) => !visible)}
                  disabled={updating}
                />
              </div>
            </div>

            <Button type="submit" className="h-10 w-full gap-2" disabled={updating || !password || password !== confirmPassword}>
              {updating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href={ROLE_LOGIN[role]}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
