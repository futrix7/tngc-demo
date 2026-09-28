import { NextResponse } from "next/server"
import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
  findUserIdByEmail,
  revokeAllSessions,
} from "@/lib/supabase-admin"
import { respondWithFailure } from "@/lib/api-response"

const MIN_PASSWORD_LENGTH = 8

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number."
  }
  return null
}

/**
 * Sets a new password for an account in a single server-side step, using the
 * service-role key.
 *
 * SECURITY: this endpoint is unauthenticated and takes only an email address
 * and a new password. Anyone who knows an account's email address can therefore
 * set that account's password. The only thing standing in front of a mass
 * takeover is the registration throttle on `/api/register` — there is no
 * ownership proof here. Restore an emailed verification code before exposing
 * this to the public internet.
 *
 * Password strength is validated before the account is touched, so a rejected
 * password never reaches Supabase.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[reset-password] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "Password reset is unavailable right now. Please contact the institute." },
      { status: 503 }
    )
  }

  let body: { email?: unknown; password?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const { email, password } = body

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "New password is required" }, { status: 400 })
  }

  const weak = passwordProblem(password)
  if (weak) {
    return NextResponse.json({ error: weak }, { status: 400 })
  }

  const trimmedEmail = email.trim()

  try {
    const lookup = await findUserIdByEmail(trimmedEmail)

    if (lookup.status === "absent") {
      return NextResponse.json(
        { error: "No account exists for that email address." },
        { status: 404 }
      )
    }

    if (lookup.status === "exhausted" || lookup.status === "error") {
      // Reported as a server fault rather than "no such user": the lookup gave up,
      // which is a different problem the caller can retry and an operator can fix.
      return NextResponse.json(
        { error: "We couldn't verify that account. Please try again in a moment." },
        { status: 503 }
      )
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(lookup.userId, { password })

    if (error) {
      console.error("[reset-password] updateUserById failed:", error.message)
      return NextResponse.json(
        { error: "We couldn't update your password. Please try again." },
        { status: 500 }
      )
    }

    // The password change alone does not end existing sessions, so a refresh
    // token captured before the reset would still work. Revoke them all; the user
    // is about to sign in again anyway.
    await revokeAllSessions(lookup.userId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return respondWithFailure(err, "reset-password/update")
  }
}
