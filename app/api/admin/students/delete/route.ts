import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"

const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/**
 * Removes a student and everything attached to them.
 *
 * This ran in the browser with the anon key, which is why deleting a student
 * never really worked. RLS scopes `payments`, `fees` and `certificates` to the
 * student's own row, so those four deletes came back as permission errors — and
 * the handler discarded every one of them and reported "Student deleted
 * successfully" regardless. What the admin actually got was a student with no
 * fees and no payments still on file, and no indication that anything had failed.
 *
 * It also never removed the Supabase auth account. The student kept a working
 * login after their record was gone: the sign-in succeeded and every page
 * answered "no enrolment is linked to this account", with no way for the admin to
 * close the account from inside the app.
 *
 * The child rows are removed explicitly even though the schema cascades some of
 * them, because a partial failure has to be reported rather than assumed. The
 * auth user goes last — it is the one step that cannot be undone by re-creating a
 * row — so an aborted delete leaves the login intact and the attempt retryable.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[admin student delete] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "This action is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { studentId?: unknown }
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as typeof body
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : ""
  if (!STUDENT_ID_PATTERN.test(studentId)) {
    return NextResponse.json({ error: "That student could not be identified." }, { status: 400 })
  }

  const { data: student, error: lookupError } = await supabaseAdmin
    .from("students")
    .select("id, full_name, user_id")
    .eq("id", studentId)
    .maybeSingle()

  if (lookupError) {
    console.error("[admin student delete] student lookup failed:", lookupError.message)
    return NextResponse.json(
      { error: "We couldn't read that student. Nothing was changed." },
      { status: 500 }
    )
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 })
  }

  // Collected and reported rather than thrown on, so a partial failure names the
  // table that stopped it. A cascade would have removed fee_installments with the
  // fees row, but doing it here keeps the order explicit and the errors visible.
  const failed: string[] = []

  const { data: feeRows } = await supabaseAdmin
    .from("fees")
    .select("id")
    .eq("student_id", studentId)

  const feeIds = (feeRows ?? []).map((row) => row.id)

  if (feeIds.length > 0) {
    // fee_extras hangs off the fee, not the student, so it has to go before the
    // fees row does. Both are removed explicitly even though the schema cascades
    // them, because a partial failure has to be reported rather than assumed.
    for (const table of ["fee_installments", "fee_extras"]) {
      const { error } = await supabaseAdmin.from(table).delete().in("fee_id", feeIds)
      if (error) failed.push(table)
    }
  }

  for (const table of ["payments", "certificates", "fees"]) {
    const { error } = await supabaseAdmin.from(table).delete().eq("student_id", studentId)
    if (error) failed.push(table)
  }

  if (failed.length > 0) {
    console.error(`[admin student delete] ${studentId} failed on: ${failed.join(", ")}`)
    return NextResponse.json(
      {
        error: `This student could not be deleted. These records could not be removed: ${failed.join(", ")}. Nothing else was changed — please try again.`,
        failed,
      },
      { status: 500 }
    )
  }

  const { error: studentError } = await supabaseAdmin
    .from("students")
    .delete()
    .eq("id", studentId)

  if (studentError) {
    console.error("[admin student delete] student row delete failed:", studentError.message)
    return NextResponse.json(
      { error: "This student could not be deleted. Nothing was changed — please try again." },
      { status: 500 }
    )
  }

  // The login, last. If this fails the student is already off the books, which is
  // reported plainly: the orphaned account is a real problem but a different one
  // from a student who is still enrolled.
  let accountRemoved = true
  if (student.user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(student.user_id)
    if (authError) {
      accountRemoved = false
      console.error(
        `[admin student delete] auth user ${student.user_id} for ${studentId} not removed:`,
        authError.message
      )
    }
  }

  return NextResponse.json({ ok: true, accountRemoved })
}
