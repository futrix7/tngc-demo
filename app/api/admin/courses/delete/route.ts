import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"

const COURSE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LINKED_TABLES = [
  { table: "students", label: "student records" },
  { table: "fees", label: "fees and installment schedules" },
  { table: "payments", label: "payment history" },
  { table: "certificates", label: "certificates" },
  { table: "videos", label: "course videos" },
] as const

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Course deletion is unavailable right now." }, { status: 503 })
  }

  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { courseId?: unknown; confirmationName?: unknown }
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as typeof body
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : ""
  const confirmationName = typeof body.confirmationName === "string" ? body.confirmationName.trim() : ""
  if (!COURSE_ID_PATTERN.test(courseId) || !confirmationName) {
    return NextResponse.json({ error: "Confirm the course name and select a valid course." }, { status: 400 })
  }

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, slug, name")
    .eq("id", courseId)
    .maybeSingle()

  if (courseError) {
    console.error("[admin course delete] course lookup failed:", courseError.message)
    return NextResponse.json({ error: "We couldn't verify this course. Nothing was changed." }, { status: 500 })
  }
  if (!course) {
    return NextResponse.json({ error: "This course no longer exists." }, { status: 404 })
  }
  if (confirmationName !== course.name) {
    return NextResponse.json({ error: "The course name did not match. Nothing was deleted." }, { status: 400 })
  }

  const references = await Promise.all(LINKED_TABLES.map(async ({ table, label }) => {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("course_slug", course.slug)

    return { table, label, count: count ?? 0, error }
  }))

  const failedChecks = references.filter((reference) => reference.error)
  if (failedChecks.length > 0) {
    for (const reference of failedChecks) {
      console.error(`[admin course delete] ${reference.table} reference check failed:`, reference.error?.message)
    }
    return NextResponse.json(
      { error: "We couldn't verify whether this course has linked records. Nothing was deleted." },
      { status: 500 }
    )
  }

  const linked = references.filter((reference) => reference.count > 0)
  if (linked.length > 0) {
    const details = linked.map((reference) => `${reference.count} ${reference.label}`).join(", ")
    return NextResponse.json(
      {
        error: `This course cannot be deleted because it has linked records (${details}). Its student, fee, payment, certificate, and video history has been kept unchanged.`,
      },
      { status: 409 }
    )
  }

  const { data: deletedCourse, error: deleteError } = await supabaseAdmin
    .from("courses")
    .delete()
    .eq("id", course.id)
    .eq("slug", course.slug)
    .select("id")
    .maybeSingle()

  if (deleteError) {
    console.error("[admin course delete] course removal failed:", deleteError.message)
    return NextResponse.json(
      { error: "This course could not be deleted. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
  if (!deletedCourse) {
    return NextResponse.json(
      { error: "This course changed or was already removed. Refresh the course list and try again." },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true })
}
