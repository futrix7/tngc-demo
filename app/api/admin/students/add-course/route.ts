import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

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
  const totalFee = Number(body.totalFee)
  const initialPaymentAmount = Number(body.initialPaymentAmount ?? 0)
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "upi"
  const paymentReference = typeof body.paymentReference === "string" ? body.paymentReference.trim() : ""
  if (!studentId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug)) {
    return NextResponse.json({ error: "Choose a valid student and course." }, { status: 400 })
  }
  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    return NextResponse.json({ error: "Enter a course fee greater than zero." }, { status: 400 })
  }
  if (!Number.isFinite(initialPaymentAmount) || initialPaymentAmount < 0 || initialPaymentAmount > totalFee) {
    return NextResponse.json({ error: `Initial payment must be between ₹0 and ₹${totalFee.toLocaleString("en-IN")}.` }, { status: 400 })
  }
  if (initialPaymentAmount > 0 && !/^(upi|cash|bank)$/.test(paymentMethod)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("user_id")
    .eq("id", studentId)
    .maybeSingle()

  if (studentError || !student?.user_id) {
    if (studentError) console.error("[admin student course] student lookup failed:", studentError.message)
    return NextResponse.json({ error: "This student has no linked login account." }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin.rpc("enroll_student_in_course", {
    p_user_id: student.user_id,
    p_course_slug: courseSlug,
    p_total_fee_override: totalFee,
    p_initial_payment_amount: initialPaymentAmount,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference,
    p_verified_by: auth.userId,
  })

  if (error) {
    return failureResponse(
      describeRpcFailure(error, "admin/students/add-course", "We couldn't add that course. Nothing was changed.")
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    success: true,
    courseSlug: row?.course_slug ?? courseSlug,
    totalFee: Number(row?.total_fee ?? totalFee),
    initialPaymentAmount,
  })
}
