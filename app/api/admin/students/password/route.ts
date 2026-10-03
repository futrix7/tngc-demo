import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  revokeAllSessions,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import { normalizeIndianPhone } from "@/lib/phone"

const MIN_PASSWORD_LENGTH = 6

/**
 * Sets the login password for an existing student.
 *
 * The administrator owns the credentials: this is the counterpart to the
 * password field on the register sheet, for enrolments that already exist or
 * whose password has been forgotten. Accounts are created here too when the
 * student row predates the login account, so "set a password" always ends with
 * a working sign-in rather than half an account.
 */
export async function POST(request: Request) {
  const authorization = await authenticateAdminRequest(request)
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Password changes are unavailable right now." }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!studentId) return NextResponse.json({ error: "Student id is required." }, { status: 400 })
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `The login password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    )
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, user_id, full_name, phone, status")
    .eq("id", studentId)
    .maybeSingle()

  if (studentError) {
    console.error("[admin student password] student lookup failed:", studentError.message)
    return NextResponse.json({ error: "Unable to read this student right now." }, { status: 500 })
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 })
  }
  if (student.status === "Inactive") {
    return NextResponse.json({ error: "Activate this student before changing their login." }, { status: 409 })
  }

  const normalizedPhone = normalizeIndianPhone(student.phone)
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "This student has no valid 10-digit phone number to sign in with." },
      { status: 400 }
    )
  }

  if (student.user_id) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(student.user_id, {
      password,
    })

    if (updateError) {
      console.error("[admin student password] password update failed:", updateError.message)
      return NextResponse.json({ error: "Could not update the password. Please try again." }, { status: 500 })
    }

    // A changed password must end the sessions opened with the old one.
    await revokeAllSessions(student.user_id)
    return NextResponse.json({ ok: true, created: false })
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    phone: normalizedPhone.e164,
    phone_confirm: true,
    password,
    user_metadata: { full_name: student.full_name, phone: normalizedPhone.nationalNumber },
  })

  if (createError || !created.user) {
    console.error("[admin student password] account creation failed:", createError?.message)
    return NextResponse.json({ error: "Could not create the student login." }, { status: 500 })
  }

  const { error: linkError } = await supabaseAdmin
    .from("students")
    .update({ user_id: created.user.id })
    .eq("id", student.id)

  if (linkError) {
    // Leave no orphaned account behind: an unlinked auth user is invisible to
    // both the app and the next attempt to create one.
    const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    if (cleanupError) {
      console.error("[admin student password] orphan cleanup failed:", cleanupError.message)
    }
    console.error("[admin student password] linking failed:", linkError.message)
    return NextResponse.json({ error: "Could not link the login to this student." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created: true })
}
