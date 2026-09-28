import { NextResponse } from "next/server"
import { authenticateStudentRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course enrollment is unavailable right now." }, { status: 503 })
  }

  const auth = await authenticateStudentRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { courseSlug?: unknown }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as { courseSlug?: unknown }
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : ""
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug)) {
    return NextResponse.json({ error: "Choose a valid course." }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("enroll_student_in_course", {
      p_user_id: auth.userId,
      p_course_slug: courseSlug,
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
    })
  } catch (error) {
    console.error("[student/enroll-course] crashed:", error)
    return NextResponse.json(
      { error: "We couldn't add that course. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}