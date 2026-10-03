import { NextResponse } from "next/server"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"

const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course removal is unavailable right now." }, { status: 503 })
  }

  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { studentId?: unknown; courseSlug?: unknown; confirmationName?: unknown }
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
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : ""
  const confirmationName = typeof body.confirmationName === "string" ? body.confirmationName.trim() : ""
  if (!STUDENT_ID_PATTERN.test(studentId) || !COURSE_SLUG_PATTERN.test(courseSlug) || !confirmationName) {
    return NextResponse.json(
      { error: "Confirm the course name and select a valid student course." },
      { status: 400 }
    )
  }

  const [{ data: student, error: studentError }, { data: course, error: courseError }] = await Promise.all([
    supabaseAdmin.from("students").select("id").eq("id", studentId).maybeSingle(),
    supabaseAdmin.from("courses").select("slug, name").eq("slug", courseSlug).maybeSingle(),
  ])

  if (studentError || courseError) {
    console.error("[admin student course removal] lookup failed:", studentError?.message ?? courseError?.message)
    return NextResponse.json({ error: "We couldn't verify this student course. Nothing was changed." }, { status: 500 })
  }
  if (!student) {
    return NextResponse.json({ error: "This student no longer exists." }, { status: 404 })
  }
  if (!course) {
    return NextResponse.json({ error: "This course no longer exists." }, { status: 404 })
  }
  if (confirmationName !== course.name) {
    return NextResponse.json({ error: "The course name did not match. Nothing was removed." }, { status: 400 })
  }

  const { error } = await supabaseAdmin.rpc("remove_student_course", {
    p_student_id: studentId,
    p_course_slug: courseSlug,
  })

  if (error?.code === "23503") {
    return NextResponse.json(
      { error: "This course has payment or certificate history, so it cannot be removed. Those records have been kept unchanged." },
      { status: 409 }
    )
  }
  if (error) {
    return failureResponse(
      describeRpcFailure(
        error,
        "admin/students/remove-course",
        "We couldn't remove this course. Nothing was changed."
      )
    )
  }

  return NextResponse.json({ success: true })
}
