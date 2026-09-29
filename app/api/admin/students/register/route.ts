import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { normalizeIndianPhone } from "@/lib/phone"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function discardOrphanAccount(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) console.error("[admin student registration] orphan cleanup failed:", error.message)
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
  const fatherName = text(body.fatherName)
  const fatherPhone = text(body.fatherPhone)
  const courseSlug = text(body.courseSlug)
  const totalFee = Number(body.totalFee)
  const paidAmount = Number(body.paidAmount ?? 0)
  const paymentMethod = text(body.paymentMethod).toLowerCase() || "cash"
  const paymentReference = text(body.paymentReference)

  if (email && !EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  if (!fullName || !fatherName) return NextResponse.json({ error: "Student and father/guardian names are required." }, { status: 400 })
  if (!normalizedPhone) return NextResponse.json({ error: "Enter a valid 10-digit student phone number." }, { status: 400 })
  if (fatherPhone && !/^\d{10}$/.test(fatherPhone)) return NextResponse.json({ error: "Enter a valid 10-digit father/guardian phone number." }, { status: 400 })
  if (!courseSlug) return NextResponse.json({ error: "Select a course." }, { status: 400 })
  if (!Number.isFinite(totalFee) || totalFee <= 0) return NextResponse.json({ error: "Enter a valid course fee." }, { status: 400 })
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalFee) return NextResponse.json({ error: "The payment amount must be between 0 and the total fee." }, { status: 400 })

  const { data: courseResult, error: courseError } = await supabaseAdmin.from("courses").select("slug").eq("slug", courseSlug).maybeSingle()
  if (courseError) {
    console.error("[admin student registration] catalogue lookup failed:", courseError.message)
    return NextResponse.json({ error: "Unable to validate the selected course." }, { status: 503 })
  }
  if (!courseResult) {
    return NextResponse.json({ error: "The selected course is no longer available." }, { status: 400 })
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    ...(email ? { email, email_confirm: true } : {}),
    phone: normalizedPhone.e164,
    phone_confirm: true,
    password: normalizedPhone.nationalNumber,
    user_metadata: { full_name: fullName, phone: normalizedPhone.nationalNumber },
  })
  if (createError || !created.user) {
    const duplicate = /already registered|already been registered|already exists|already been confirmed/i.test(createError?.message ?? "")
    return NextResponse.json(
      { error: duplicate ? "An account with this email already exists." : "Could not create the student login." },
      { status: duplicate ? 409 : 500 }
    )
  }

  const { data, error } = await supabaseAdmin.rpc("register_student", {
    p_user_id: created.user.id,
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
    p_paid_installment_nos: [],
    p_installment_count: 3,
    p_custom_payment_amount: paidAmount > 0 ? paidAmount : null,
    p_total_fee_override: totalFee,
  })

  if (error) {
    await discardOrphanAccount(created.user.id)
    console.error("[admin student registration] enrollment transaction failed:", error.message)
    return NextResponse.json({ error: "Could not save the student and fee schedule. No account was left behind." }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ success: true, studentId: row?.student_id ?? null, totalFee: row?.total_fee ?? totalFee })
}
