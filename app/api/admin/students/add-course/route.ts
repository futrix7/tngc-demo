import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import {
  checkAmountAgainstTotal,
  checkAmountSplitAgainst,
  parseAmountSplit,
  parsePaymentAmount,
} from "@/lib/amount-split"

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course enrollment is unavailable right now." }, { status: 503 })
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
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : ""
  // The course total is owned by the catalog. A caller may supply how that price
  // is scheduled and an optional amount actually collected now, but not a new
  // total fee.
  const installmentSplit = parseAmountSplit(body.installmentAmounts)
  const paidNow = parsePaymentAmount(body.paymentAmount)
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "upi"
  const paymentReference = typeof body.paymentReference === "string" ? body.paymentReference.trim() : ""
  if (!studentId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug)) {
    return NextResponse.json({ error: "Choose a valid student and course." }, { status: 400 })
  }
  if (installmentSplit.error) {
    return NextResponse.json({ error: installmentSplit.error }, { status: 400 })
  }
  if (paidNow.error) {
    return NextResponse.json({ error: paidNow.error }, { status: 400 })
  }

  if (paidNow.amount && !/^(upi|cash|bank)$/.test(paymentMethod)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("fee_numeric, status")
    .eq("slug", courseSlug)
    .maybeSingle()

  if (courseError) {
    console.error("[admin student course] course lookup failed:", courseError.message)
    return NextResponse.json({ error: "Unable to validate the selected course." }, { status: 503 })
  }
  if (!course || course.status !== "active") {
    return NextResponse.json({ error: "The selected course is no longer available." }, { status: 400 })
  }

  const totalFee = Number(course.fee_numeric)
  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    return NextResponse.json({ error: "The selected course does not have a valid catalog fee." }, { status: 409 })
  }

  const scheduleError = checkAmountSplitAgainst(installmentSplit.amounts, totalFee)
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError }, { status: 400 })
  }

  const paymentError = checkAmountAgainstTotal(paidNow.amount, totalFee)
  if (paymentError) {
    return NextResponse.json({ error: paymentError }, { status: 400 })
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, status")
    .eq("id", studentId)
    .maybeSingle()

  if (studentError || !student) {
    if (studentError) console.error("[admin student course] student lookup failed:", studentError.message)
    return NextResponse.json({ error: "This student could not be found." }, { status: 404 })
  }
  if (student.status === "Inactive") {
    return NextResponse.json({ error: "Activate this student before adding a course." }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin.rpc("enroll_student_in_course", {
    p_course_slug: courseSlug,
    p_student_id: student.id,
    p_total_fee_override: null,
    p_installment_amounts: installmentSplit.amounts,
    p_payment_amount: null,
    p_verified_by: auth.userId,
  })

  if (error) {
    return failureResponse(
      describeRpcFailure(error, "admin/students/add-course", "We couldn't add that course. Nothing was changed.")
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  const feeId = typeof row?.fee_id === "string" ? row.fee_id : ""

  function paymentRecordingFailure(reason: string) {
    console.error(`[admin student course] ${reason}`)
    return NextResponse.json(
      {
        error: "The course was added, but the payment could not be recorded as received. Check this student's Installments page before collecting again.",
        courseAdded: true,
        paymentRecorded: false,
      },
      { status: 500 }
    )
  }

  if (paidNow.amount !== null) {
    if (!feeId) {
      return paymentRecordingFailure("enrollment RPC did not return a fee ID for the paid course")
    }

    const { data: paymentRows, error: paymentError } = await supabaseAdmin.rpc("record_fee_payment", {
      p_fee_id: feeId,
      p_amount: paidNow.amount,
      p_method: paymentMethod,
      p_description: paymentReference,
      p_status: "Paid",
      p_receipt_no: "",
      p_verified_by: auth.userId,
    })

    if (paymentError) {
      return paymentRecordingFailure(paymentError.message)
    }

    const recordedTotal = Number(
      ((Array.isArray(paymentRows) ? paymentRows : []).reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0
      )).toFixed(2)
    )
    if (recordedTotal !== paidNow.amount) {
      return paymentRecordingFailure(
        `fee ${feeId} recorded ₹${recordedTotal} as paid; expected ₹${paidNow.amount}`
      )
    }
  }

  return NextResponse.json({
    success: true,
    courseSlug: row?.course_slug ?? courseSlug,
    totalFee: Number(row?.total_fee ?? totalFee),
    initialPaymentAmount: paidNow.amount ?? 0,
    paymentStatus: paidNow.amount === null ? null : "Paid",
  })
}
