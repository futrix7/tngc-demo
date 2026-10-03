import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { normalizeIndianPhone } from "@/lib/phone"
import {
  checkAmountAgainstTotal,
  checkAmountSplitAgainst,
  parseAmountSplit,
  parsePaymentAmount,
} from "@/lib/amount-split"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function discardOrphanAccount(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) console.error("[admin student registration] orphan cleanup failed:", error.message)
}

async function findUnlinkedAuthAccount(phone: string, email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { user: null, error }

  const user = data.users.find((candidate) =>
    candidate.phone === phone || (email && candidate.email?.toLowerCase() === email)
  )
  if (!user) return { user: null, error: null }

  const [{ count: studentCount, error: studentError }, { count: adminCount, error: adminError }, { count: teacherCount, error: teacherError }] = await Promise.all([
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("admins").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ])

  if (studentError || adminError || teacherError) {
    return { user: null, error: studentError ?? adminError ?? teacherError }
  }

  return {
    user: studentCount || adminCount || teacherCount ? null : user,
    error: null,
  }
}

export async function POST(request: Request) {
  const authorization = await authenticateAdminRequest(request)
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Student registration is unavailable right now." }, { status: 503 })
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

  const text = (value: unknown) => typeof value === "string" ? value.trim() : ""
  const email = text(body.email).toLowerCase()
  const fullName = text(body.fullName)
  const phone = text(body.phone)
  const normalizedPhone = normalizeIndianPhone(phone)
  const alternatePhone = text(body.alternatePhone)
  const fatherName = text(body.fatherName)
  const fatherPhone = text(body.fatherPhone)
  const courseSlug = text(body.courseSlug)
  const totalFee = Number(body.totalFee)
  // One split, one figure. The first breaks the fee into the schedule the student
  // will see; the second is a single number for what is physically in the hand
  // today. Neither is worked out for the administrator — see lib/amount-split.ts.
  const installmentSplit = parseAmountSplit(body.installmentAmounts)
  const paidNow = parsePaymentAmount(body.paymentAmount)
  const paymentMethod = text(body.paymentMethod).toLowerCase() || "cash"
  const paymentReference = text(body.paymentReference)
  // The administrator chooses the login password. Blank falls back to the
  // long-standing default — the student's own 10-digit number — so an
  // enrolment without a chosen password still leaves a usable login behind.
  const password = text(body.password) || normalizedPhone?.nationalNumber || ""

  if (email && !EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  if (!fullName || !fatherName) return NextResponse.json({ error: "Student and father/guardian names are required." }, { status: 400 })
  if (!normalizedPhone) return NextResponse.json({ error: "Enter a valid 10-digit student phone number." }, { status: 400 })
  if (alternatePhone && !/^\d{10}$/.test(alternatePhone)) return NextResponse.json({ error: "Enter a valid 10-digit alternate phone number." }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: "The login password must be at least 6 characters." }, { status: 400 })
  if (fatherPhone && !/^\d{10}$/.test(fatherPhone)) return NextResponse.json({ error: "Enter a valid 10-digit father/guardian phone number." }, { status: 400 })
  if (!courseSlug) return NextResponse.json({ error: "Select a course." }, { status: 400 })
  if (!Number.isFinite(totalFee) || totalFee <= 0) return NextResponse.json({ error: "Enter a valid course fee." }, { status: 400 })
  if (installmentSplit.error) return NextResponse.json({ error: installmentSplit.error }, { status: 400 })
  if (paidNow.error) return NextResponse.json({ error: paidNow.error }, { status: 400 })
  if (!/^(upi|cash|bank)$/.test(paymentMethod)) return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })

  const scheduleError = checkAmountSplitAgainst(installmentSplit.amounts, totalFee)
  if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 })

  const paymentError = checkAmountAgainstTotal(paidNow.amount, totalFee)
  if (paymentError) return NextResponse.json({ error: paymentError }, { status: 400 })

  const { data: courseResult, error: courseError } = await supabaseAdmin.from("courses").select("slug").eq("slug", courseSlug).maybeSingle()
  if (courseError) {
    console.error("[admin student registration] catalogue lookup failed:", courseError.message)
    return NextResponse.json({ error: "Unable to validate the selected course." }, { status: 503 })
  }
  if (!courseResult) {
    return NextResponse.json({ error: "The selected course is no longer available." }, { status: 400 })
  }

  const { data: existingStudent, error: studentLookupError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("phone", normalizedPhone.nationalNumber)
    .limit(1)
    .maybeSingle()

  if (studentLookupError) {
    console.error("[admin student registration] existing student lookup failed:", studentLookupError.message)
    return NextResponse.json({ error: "Unable to check whether this phone is already registered." }, { status: 503 })
  }
  if (existingStudent) {
    return NextResponse.json({ error: "A student is already registered with this phone number." }, { status: 409 })
  }

  const createUserInput = {
    ...(email ? { email, email_confirm: true } : {}),
    phone: normalizedPhone.e164,
    phone_confirm: true,
    password,
    user_metadata: { full_name: fullName, phone: normalizedPhone.nationalNumber },
  }
  let userId: string
  let createdNewUser = false

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserInput)
  if (created.user) {
    userId = created.user.id
    createdNewUser = true
  } else {
    const duplicate = /already registered|already been registered|already exists|already been confirmed|phone number.*already|email.*already/i.test(createError?.message ?? "")
    if (!duplicate) {
      return NextResponse.json({ error: "Could not create the student login." }, { status: 500 })
    }

    const existingAccount = await findUnlinkedAuthAccount(normalizedPhone.e164, email)
    if (existingAccount.error) {
      console.error("[admin student registration] existing Auth account lookup failed:", existingAccount.error.message)
      return NextResponse.json({ error: "Unable to check the existing login account." }, { status: 503 })
    }
    if (!existingAccount.user) {
      return NextResponse.json(
        { error: "An account with this phone number or email already exists." },
        { status: 409 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingAccount.user.id,
      createUserInput
    )
    if (updateError || !updated.user) {
      console.error("[admin student registration] orphan Auth account recovery failed:", updateError?.message)
      return NextResponse.json({ error: "Could not prepare the existing student login." }, { status: 500 })
    }
    userId = updated.user.id
  }

  const { data, error } = await supabaseAdmin.rpc("register_student", {
    p_user_id: userId,
    p_full_name: fullName,
    p_email: email || null,
    p_phone: normalizedPhone.nationalNumber,
    p_father_name: fatherName,
    p_father_phone: fatherPhone,
    p_course_slugs: [courseSlug],
    p_present_status: "Student",
    p_signature: fullName,
    p_payment_method: paymentMethod || "cash",
    p_payment_description: paymentReference || "Student account created by administrator",
    p_installment_amounts: installmentSplit.amounts,
    p_payment_amount: paidNow.amount,
    p_total_fee_override: totalFee,
    p_alternate_phone: alternatePhone || null,
  })

  if (error) {
    if (createdNewUser) await discardOrphanAccount(userId)
    console.error("[admin student registration] enrollment transaction failed:", error.message)
    return NextResponse.json({ error: "Could not save the student and fee schedule. No account was left behind." }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ success: true, studentId: row?.student_id ?? null, totalFee: row?.total_fee ?? totalFee })
}
