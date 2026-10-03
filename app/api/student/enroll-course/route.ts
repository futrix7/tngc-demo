import { NextResponse } from "next/server"
import { authenticateStudentRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import { checkAmountAgainstTotal, parsePaymentAmount } from "@/lib/amount-split"

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course enrollment is unavailable right now." }, { status: 503 })
  }

  const auth = await authenticateStudentRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: {
    courseSlug?: unknown
    paymentAmount?: unknown
    paymentMethod?: unknown
    paymentReference?: unknown
  }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as {
      courseSlug?: unknown
      paymentAmount?: unknown
      paymentMethod?: unknown
      paymentReference?: unknown
    }
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : ""
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug)) {
    return NextResponse.json({ error: "Choose a valid course." }, { status: 400 })
  }

  const payment = parsePaymentAmount(body.paymentAmount)
  if (payment.error) {
    return NextResponse.json({ error: payment.error }, { status: 400 })
  }

  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "upi"
  if (!/^(upi|cash|bank)$/.test(paymentMethod)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }
  const paymentReference =
    typeof body.paymentReference === "string" ? body.paymentReference.trim() : ""
  if (paymentReference.length > 200) {
    return NextResponse.json({ error: "Payment reference must be 200 characters or fewer." }, { status: 400 })
  }
  // The course has to be priced before the split can be checked against it —
  // create_fee_schedule refuses parts that do not add up, and finding that out
  // from a database error after the fact reads as a bug rather than a correction.
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("fee_numeric")
    .eq("slug", courseSlug)
    .eq("status", "active")
    .maybeSingle()

  if (courseError) {
    console.error("[student/enroll-course] course lookup failed:", courseError.message)
    return NextResponse.json({ error: "We couldn't check that course. Please try again." }, { status: 503 })
  }

  if (!course) {
    return NextResponse.json({ error: "That course is not available for enrollment." }, { status: 400 })
  }

  const amountError = checkAmountAgainstTotal(payment.amount, Number(course.fee_numeric ?? 0))
  if (amountError) {
    return NextResponse.json({ error: amountError }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("enroll_student_in_course", {
      p_user_id: auth.userId,
      p_course_slug: courseSlug,
      p_installment_amounts: null,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference,
      p_student_claim_amount: payment.amount,
    })

    if (error) {
      return failureResponse(
        describeRpcFailure(error, "student/enroll-course", "We couldn't add that course. Nothing was changed.")
      )
    }

    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
      success: true,
      courseSlug: row?.course_slug ?? courseSlug,
      totalFee: Number(row?.total_fee ?? 0),
      feeId: row?.fee_id ?? null,
      paymentClaimedAmount: payment.amount,
    })
  } catch (error) {
    console.error("[student/enroll-course] crashed:", error)
    return NextResponse.json(
      { error: "We couldn't add that course. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}