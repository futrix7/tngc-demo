import { NextResponse } from "next/server"
import { isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { respondWithFailure } from "@/lib/api-response"
import { isSchemaDriftError } from "@/lib/db-errors"

const MIN_PASSWORD_LENGTH = 8
const MAX_COURSES = 6

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Removes the credential created moments ago, so a failed enrolment leaves
 * nothing behind.
 *
 * Without it the next attempt is refused as "already registered" and the student
 * signs in successfully to a portal that has no student record for them — a state
 * no page can recover from. A failure here is the one error in this route that
 * needs a human, so it is logged rather than swallowed.
 */
async function discardOrphanAccount(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    console.error(
      `[register] could not delete the half-registered account ${userId}: ${error.message}. ` +
        "Delete it by hand (Supabase dashboard -> Authentication) or this address is stuck: " +
        "every later attempt will be refused as already registered."
    )
  }
}

type Parsed = {
  email: string
  password: string
  fullName: string
  phone: string
  fatherName: string
  fatherPhone: string
  branchId: string
  courseSlugs: string[]
  presentStatus: string
  signature: string
  paymentReference: string
  /** Which of the three installments are being settled at registration. */
  paidInstallments: number[]
  customPaymentAmount: number | null
}

/**
 * Validates the whole payload before any credential is created.
 *
 * Returns either the cleaned values or a user-facing message, so a bad request
 * never reaches Supabase and never leaves a half-built account behind.
 */
function parseBody(body: Record<string, unknown>): { ok: true; data: Parsed } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

  const email = str(body.email).toLowerCase()
  const password = typeof body.password === "string" ? body.password : ""
  const fullName = str(body.fullName)
  const phone = str(body.phone)
  const fatherName = str(body.fatherName)
  const fatherPhone = str(body.fatherPhone)
  const branchId = str(body.branchId)
  const presentStatus = str(body.presentStatus)
  const signature = str(body.signature)
  const paymentReference = str(body.paymentReference)
  const rawCustomPaymentAmount = body.customPaymentAmount
  const customPaymentAmount =
    typeof rawCustomPaymentAmount === "number" && Number.isFinite(rawCustomPaymentAmount)
      ? rawCustomPaymentAmount
      : null

  // Which installments of the three-part schedule are being paid now. Clamped to
  // the real range and de-duplicated rather than trusted: this reaches an RPC
  // that files one payment row per entry, so a crafted list would file claims
  // for installments that do not exist.
  const paidInstallments = Array.isArray(body.paidInstallments)
    ? [...new Set(body.paidInstallments.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 3
      ))]
    : [1]

  const rawCourses = Array.isArray(body.courseSlugs) ? body.courseSlugs.filter((s): s is string => typeof s === "string") : []
  const courseSlugs = rawCourses.map((s) => s.trim()).filter(Boolean)

  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter a valid email address." }

  if (rawCustomPaymentAmount !== undefined && rawCustomPaymentAmount !== null && customPaymentAmount === null) {
    return { ok: false, error: "Enter a valid custom payment amount." }
  }
  if (customPaymentAmount !== null && customPaymentAmount <= 0) {
    return { ok: false, error: "Custom payment must be greater than zero." }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Password must contain at least one letter and one number." }
  }

  if (!fullName) return { ok: false, error: "Full name is required." }
  if (!fatherName) return { ok: false, error: "Father's or husband's name is required." }
  if (!/^\d{10}$/.test(phone)) return { ok: false, error: "Enter a valid 10-digit mobile number." }
  if (fatherPhone && !/^\d{10}$/.test(fatherPhone)) {
    return { ok: false, error: "Enter a valid 10-digit alternate mobile number." }
  }
  if (!presentStatus) return { ok: false, error: "Select your present status." }
  if (!branchId) return { ok: false, error: "Select your branch." }

  if (courseSlugs.length === 0) return { ok: false, error: "Select at least one course." }
  if (courseSlugs.length > MAX_COURSES) {
    return { ok: false, error: `You can enrol in at most ${MAX_COURSES} courses at once.` }
  }
  if (new Set(courseSlugs).size !== courseSlugs.length) {
    return { ok: false, error: "The same course was selected twice." }
  }

  // The signature must match the name being enrolled, or it is not a signature.
  if (!signature || signature.toLowerCase() !== fullName.toLowerCase()) {
    return { ok: false, error: "Type your full name exactly as a signature." }
  }

  return {
    ok: true,
    data: {
      email,
      password,
      fullName,
      phone,
      fatherName,
      fatherPhone,
      branchId,
      courseSlugs,
      presentStatus,
      signature,
      paymentReference,
      paidInstallments,
      customPaymentAmount,
    },
  }
}

/**
 * Completes a student registration in one server-side step.
 *
 * The browser used to do all of this itself: signUp, count the table to mint an
 * id, then five more inserts. That had three problems. The id could collide with
 * a concurrent signup, because `count(*) + 1` is a read-then-write race. Any
 * insert could fail alone while the page reported success, leaving a student with
 * a login and no fee record. And the browser chose the price, from a hardcoded
 * map in the JavaScript bundle.
 *
 * Here the service-role key creates the account, and one Postgres transaction
 * writes the student, the per-course fee and installment rows, and the pending
 * payment. Either all of it exists or none of it does.
 *
 * The account is created with email_confirm: true, so the student can sign in
 * immediately with the password they just chose and there is no "check your
 * inbox to confirm" branch.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[register] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "Registration is unavailable right now. Please contact the institute." },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>

  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const parsed = parseBody(body)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { email, password, fullName, phone, fatherName, fatherPhone, branchId, courseSlugs, presentStatus, signature, paymentReference, paidInstallments, customPaymentAmount } =
    parsed.data

  // The branch and the courses are checked against the database rather than
  // trusted, so a hand-crafted request cannot enrol against a branch that does
  // not exist or invent a course slug.
  let validBranch = false
  let validCourses: string[] = []

  try {
    const [branchResult, courseResult] = await Promise.all([
      supabaseAdmin.from("branches").select("id").eq("id", branchId).maybeSingle(),
      supabaseAdmin.from("courses").select("slug").in("slug", courseSlugs),
    ])

    if (branchResult.error) {
      console.error("[register] branch lookup failed:", branchResult.error.message)
      return respondWithFailure(branchResult.error, "register/branch")
    }

    if (courseResult.error) {
      console.error("[register] course lookup failed:", courseResult.error.message)
      return respondWithFailure(courseResult.error, "register/courses")
    }

    validBranch = Boolean(branchResult.data)
    validCourses = (courseResult.data ?? []).map((c) => c.slug)
  } catch (err) {
    return respondWithFailure(err, "register/lookup")
  }

  if (!validBranch) {
    return NextResponse.json({ error: "Select a valid branch." }, { status: 400 })
  }

  if (validCourses.length !== courseSlugs.length) {
    return NextResponse.json(
      { error: "One of the selected courses is no longer available. Please pick again." },
      { status: 400 }
    )
  }

  let userId: string

  try {
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, present_status: presentStatus },
    })

    if (createError || !data.user) {
      const message = createError?.message ?? "Could not create the account"

      if (/already been registered|already exists|already been confirmed/i.test(message)) {
        return NextResponse.json(
          { error: "An account with this email already exists.", alreadyRegistered: true },
          { status: 409 }
        )
      }

      console.error("[register] createUser failed:", message)
      return NextResponse.json(
        { error: "We couldn't create your account. Please try again." },
        { status: 500 }
      )
    }

    userId = data.user.id
  } catch (err) {
    return respondWithFailure(err, "register/create-user")
  }

  try {
    const registrationArgs = {
      p_user_id: userId,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_father_name: fatherName,
      p_father_phone: fatherPhone,
      p_branch_id: branchId,
      p_course_slugs: courseSlugs,
      p_present_status: presentStatus,
      p_signature: signature,
      p_payment_method: "upi",
      // Which installments of the three-part schedule are being settled now. The
      // course is no longer one "Registration Fee" charge for the whole amount.
      p_paid_installment_nos: paidInstallments,
      p_payment_description: paymentReference
        ? `UPI reference: ${paymentReference}`
        : customPaymentAmount !== null
          ? `UPI custom payment: ₹${customPaymentAmount.toLocaleString("en-IN")}`
          : `UPI payment for installment${paidInstallments.length === 1 ? "" : "s"} ${paidInstallments.join(", ")}`,
      ...(customPaymentAmount !== null ? { p_custom_payment_amount: customPaymentAmount } : {}),
    }
    const { data, error: rpcError } = await supabaseAdmin.rpc("register_student", registrationArgs)

    if (rpcError) {
      // The transaction rolled back, so the only thing left behind is a login
      // with no student record. Remove it, or the person signs in successfully
      // and lands on a portal that refuses to show them anything.
      await discardOrphanAccount(userId)

      // Schema drift rather than anything the student did. The function body
      // names columns directly — payments.branch_id among them — so a database
      // that predates one of them fails on every call with a message that names
      // neither the table nor the column. No retry can clear that, so it must not
      // be reported as a transient failure the student can retry their way out of.
      if (isSchemaDriftError(rpcError)) {
        console.error(
          "[register] register_student failed against the current database schema. " +
            "Re-apply supabase.sql in the Supabase SQL editor — it is written to be safe " +
            "to re-run, and it is what adds the missing objects. Detail:",
          rpcError.message
        )
        return NextResponse.json(
          { error: "Registration setup needs an update. Please contact the institute before retrying." },
          { status: 503 }
        )
      }

      console.error("[register] register_student failed:", rpcError.message)
      return NextResponse.json(
        { error: "We couldn't save your enrollment. Nothing was charged — please try again." },
        { status: 500 }
      )
    }

    const row = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      success: true,
      studentId: row?.student_id ?? null,
      totalFee: row?.total_fee ?? null,
    })
  } catch (err) {
    // Same compensation on an unexpected throw: never leave a credentialed
    // account with no student record behind it.
    await discardOrphanAccount(userId)
    return respondWithFailure(err, "register/enroll")
  }
}
