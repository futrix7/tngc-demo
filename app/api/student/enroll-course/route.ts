import { NextResponse } from "next/server"
import { authenticateStudentRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import { checkAmountSplitAgainst, parseAmountSplit } from "@/lib/amount-split"

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course enrollment is unavailable right now." }, { status: 503 })
  }

  const auth = await authenticateStudentRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { courseSlug?: unknown; installmentAmounts?: unknown }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as { courseSlug?: unknown; installmentAmounts?: unknown }
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : ""
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug)) {
    return NextResponse.json({ error: "Choose a valid course." }, { status: 400 })
  }

  // A student enrolling may lay the new fee out themselves — at most three
  // amounts, their own figures — or leave it as one line for the whole fee.
  const installmentSplit = parseAmountSplit(body.installmentAmounts)
  if (installmentSplit.error) {
    return NextResponse.json({ error: installmentSplit.error }, { status: 400 })
  }

  // No payment is taken here on purpose. A student enrolling online is claiming a
  // schedule, not handing money over, and a self-recorded payment would let
  // anyone mark a fee settled from a browser. They pay from the fee page
  // afterwards, which files a claim the institute still has to verify.

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

  const scheduleError = checkAmountSplitAgainst(
    installmentSplit.amounts,
    Number(course.fee_numeric ?? 0)
  )
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("enroll_student_in_course", {
      p_user_id: auth.userId,
      p_course_slug: courseSlug,
      p_installment_amounts: installmentSplit.amounts,
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
      installments: installmentSplit.amounts?.length ?? 1,
    })
  } catch (error) {
    console.error("[student/enroll-course] crashed:", error)
    return NextResponse.json(
      { error: "We couldn't add that course. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}