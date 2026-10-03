import { NextResponse } from "next/server"
import { parseCSV } from "@/lib/csv"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_ROWS = 10_000
const DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/

function logDatabaseError(context: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[admin student import] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  })
}

export async function GET(request: Request) {
  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Legacy student records are unavailable right now." }, { status: 503 })
  }

  const params = new URL(request.url).searchParams
  const page = Number(params.get("page") ?? "1")
  const search = (params.get("search") ?? "").trim().slice(0, 80)

  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Page number is invalid." }, { status: 400 })
  }
  if (/[(),%]/.test(search)) {
    return NextResponse.json({ error: "Search contains unsupported characters." }, { status: 400 })
  }

  const pageSize = 10
  const offset = (page - 1) * pageSize
  let query = supabaseAdmin
    .from("students")
    .select(
      "id, legacy_original_id, full_name, father_name, branch_id, legacy_branch_label, phone, legacy_course_label, legacy_enrollment_time",
      { count: "exact" }
    )
    .eq("is_legacy_import", true)
    .order("legacy_enrollment_time", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,father_name.ilike.%${search}%,phone.ilike.%${search}%,legacy_original_id.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1)
  if (error) {
    logDatabaseError("legacy student lookup failed", error)
    const setupMessage = error.code === "PGRST205"
      ? "Supabase REST cannot see the converted student fields. Run the updated supabase-student-import.sql in the SQL Editor, then reload the API schema cache."
      : "Could not load converted CSV student profiles. Confirm the student conversion database setup has been applied."
    return NextResponse.json(
      {
        error: setupMessage,
        code: error.code,
      },
      { status: 500 }
    )
  }

  const studentIds = (data ?? []).map((row) => row.id)
  let feeRows: { student_id: string; course_slug: string | null }[] = []
  if (studentIds.length > 0) {
    const { data: fees, error: feeError } = await supabaseAdmin
      .from("fees")
      .select("student_id, course_slug")
      .in("student_id", studentIds)

    if (feeError) {
      logDatabaseError("legacy student enrollment lookup failed", feeError)
      return NextResponse.json(
        { error: "Imported students loaded, but their active courses could not be read.", code: feeError.code },
        { status: 500 }
      )
    }
    feeRows = fees ?? []
  }

  const branchIds = [...new Set((data ?? []).map((row) => row.branch_id).filter((id): id is string => Boolean(id)))]
  const courseSlugs = [...new Set(feeRows.map((fee) => fee.course_slug).filter((slug): slug is string => Boolean(slug)))]
  const [branchResult, courseResult] = await Promise.all([
    branchIds.length
      ? supabaseAdmin.from("branches").select("id, name").in("id", branchIds)
      : Promise.resolve({ data: [], error: null }),
    courseSlugs.length
      ? supabaseAdmin.from("courses").select("slug, name, short_name").in("slug", courseSlugs)
      : Promise.resolve({ data: [], error: null }),
  ])
  const { data: branches, error: branchError } = branchResult

  if (branchError) {
    logDatabaseError("legacy student branch lookup failed", branchError)
    return NextResponse.json(
      { error: "Legacy students loaded, but their branch names could not be read.", code: branchError.code },
      { status: 500 }
    )
  }

  const { data: courses, error: courseError } = courseResult
  if (courseError) {
    logDatabaseError("legacy student course lookup failed", courseError)
    return NextResponse.json(
      { error: "Imported students loaded, but their course names could not be read.", code: courseError.code },
      { status: 500 }
    )
  }

  const branchNames = new Map((branches ?? []).map((branch) => [branch.id, branch.name]))
  const courseNames = new Map((courses ?? []).map((course) => [course.slug, course.name || course.short_name]))
  const feesByStudent = new Map<string, Set<string>>()
  for (const fee of feeRows) {
    if (!fee.course_slug) continue
    const studentCourses = feesByStudent.get(fee.student_id) ?? new Set<string>()
    studentCourses.add(fee.course_slug)
    feesByStudent.set(fee.student_id, studentCourses)
  }

  return NextResponse.json({
    rows: (data ?? []).map((row) => ({
      id: row.id,
      originalId: row.legacy_original_id ?? "",
      name: row.full_name,
      fatherName: row.father_name ?? "",
      branch: row.branch_id
        ? branchNames.get(row.branch_id) ?? row.branch_id
        : row.legacy_branch_label ?? "",
      phone: row.phone ?? "",
      currentCourses: [...(feesByStudent.get(row.id) ?? [])]
        .map((slug) => courseNames.get(slug) ?? slug)
        .join(", "),
      previousCourse: row.legacy_course_label ?? "",
      enrollmentTime: row.legacy_enrollment_time,
      convertedStudentId: row.id,
    })),
    totalCount: count ?? 0,
  })
}

type LegacyStudentInsert = {
  original_id: string
  first_name: string
  sur_name: string
  father_name: string | null
  branch_id: string | null
  mobile_no: string | null
  long_course: string | null
  short_course: string | null
  enrollment_time: string | null
  raw_branch_s: string | null
  raw_long_s: string | null
  raw_short_s: string | null
}

function getValue(row: Record<string, string>, ...names: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value])
  )
  for (const name of names) {
    const value = normalized.get(name.toLowerCase())
    if (value !== undefined) return value.trim()
  }
  return ""
}

function parseEnrollmentTime(value: string): string | null {
  if (!value) return null
  const match = DATE_PATTERN.exec(value)
  if (!match) return null

  const [, day, month, year, hour, minute] = match
  const dayNumber = Number(day)
  const monthNumber = Number(month)
  const yearNumber = Number(year)
  const hourNumber = Number(hour)
  const minuteNumber = Number(minute)
  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))

  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== dayNumber ||
    hourNumber > 23 ||
    minuteNumber > 59
  ) {
    return null
  }

  return `${year}-${month}-${day}T${hour}:${minute}:00+05:30`
}

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Import is unavailable right now." }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a CSV file to import." }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "File must have a .csv extension." }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "CSV file is empty." }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "CSV file must be smaller than 5 MB." }, { status: 413 })
    }

    let rows: Record<string, string>[]
    try {
      rows = parseCSV(await file.text())
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "CSV formatting is invalid." },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file has no student rows." }, { status: 400 })
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `CSV cannot contain more than ${MAX_ROWS} rows.` }, { status: 400 })
    }

    const { data: branches, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id, name, tag, is_primary")

    if (branchError) {
      logDatabaseError("branch lookup failed", branchError)
      return NextResponse.json({ error: "Could not load branches for the CSV import." }, { status: 500 })
    }

    const branchesByName = new Map<string, string>()
    for (const branch of branches ?? []) {
      branchesByName.set(branch.name.trim().toLowerCase(), branch.id)
      if (branch.tag) branchesByName.set(branch.tag.trim().toLowerCase(), branch.id)
    }
    const primaryBranchId = (branches ?? []).find((branch) => branch.is_primary)?.id ?? null

    const seenIds = new Set<string>()
    const errors: string[] = []
    const legacyRows: LegacyStudentInsert[] = rows.map((row, index) => {
      const sourceRowNumber = index + 2
      const originalId = getValue(row, "id") || String(index + 1)
      const firstName = getValue(row, "first_name_s", "first_name", "First Name")
      const surName = getValue(row, "sur_name_s", "sur_name", "Last Name")
      const fatherName = getValue(row, "father_name_s", "father_name", "Father Name")
      const branchRaw = getValue(row, "branch_s", "branch", "Branch")
      const mobileNo = getValue(row, "mobile_no_s", "mobile_no", "Phone")
      const longCourse = getValue(row, "long_s", "long", "Long Course")
      const shortCourse = getValue(row, "short_s", "short", "Short Course")
      const timeRaw = getValue(row, "time_s", "time", "Enrollment Time")
      const enrollmentTime = parseEnrollmentTime(timeRaw)

      if (!firstName || !surName) {
        errors.push(`Row ${sourceRowNumber}: first and last names are required.`)
      }
      if (timeRaw && !enrollmentTime) {
        errors.push(`Row ${sourceRowNumber}: enrollment time "${timeRaw}" is not a valid DD-MM-YYYY HH:mm value.`)
      }
      if (seenIds.has(originalId)) {
        errors.push(`Row ${sourceRowNumber}: duplicate source ID "${originalId}".`)
      }
      seenIds.add(originalId)

      const branchKey = branchRaw.toLowerCase()
      const branchId =
        branchesByName.get(branchKey) ??
        (branchRaw === "1" ? primaryBranchId : null)

      return {
        original_id: originalId,
        first_name: firstName,
        sur_name: surName,
        father_name: fatherName || null,
        branch_id: branchId,
        mobile_no: mobileNo || null,
        long_course: longCourse || null,
        short_course: shortCourse || null,
        enrollment_time: enrollmentTime,
        raw_branch_s: branchRaw || null,
        raw_long_s: longCourse || null,
        raw_short_s: shortCourse || null,
      }
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `CSV validation failed: ${errors.slice(0, 20).join(" ")}` },
        { status: 400 }
      )
    }

    const { error: importError } = await supabaseAdmin
      .from("student_legacy")
      .upsert(legacyRows, { onConflict: "original_id" })

    if (importError) {
      logDatabaseError("database import failed", importError)
      return NextResponse.json(
        { error: `Legacy student import failed. ${importError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      imported: legacyRows.length,
    })
  } catch (error) {
    console.error("[admin student import] failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 }
    )
  }
}
