import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import { normalizeIndianPhone } from "@/lib/phone"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  const authorization = await authenticateAdminRequest(request)
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Student updates are unavailable right now." }, { status: 503 })
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

  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : ""
  const studentId = text("id")
  const fullName = text("name")
  const email = text("email").toLowerCase()
  const phone = normalizeIndianPhone(text("phone"))
  const fatherPhoneInput = text("fatherPhone")
  const fatherPhone = fatherPhoneInput ? normalizeIndianPhone(fatherPhoneInput) : null
  const dateOfBirth = text("dateOfBirth")
  const enrollmentDate = text("enrollmentDate")
  const gender = text("gender")

  if (!studentId || !fullName) {
    return NextResponse.json({ error: "Student id and name are required." }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid 10-digit student phone number." }, { status: 400 })
  }
  if (fatherPhoneInput && !fatherPhone) {
    return NextResponse.json({ error: "Enter a valid 10-digit father/guardian phone number or leave it blank." }, { status: 400 })
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address or leave it blank." }, { status: 400 })
  }
  if (gender && !["male", "female", "other"].includes(gender)) {
    return NextResponse.json({ error: "Choose a valid gender option." }, { status: 400 })
  }
  for (const [label, value] of [["date of birth", dateOfBirth], ["enrollment date", enrollmentDate]] as const) {
    if (value && (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`)))) {
      return NextResponse.json({ error: `Enter a valid ${label}.` }, { status: 400 })
    }
  }

  const { data: student, error: studentLookupError } = await supabaseAdmin
    .from("students")
    .select("id, user_id, full_name, phone")
    .eq("id", studentId)
    .maybeSingle()
  if (studentLookupError) {
    console.error("[admin student edit] student lookup failed:", studentLookupError.message)
    return NextResponse.json({ error: "Unable to load student details." }, { status: 500 })
  }
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 })

  const { data: matchingStudents, error: duplicateCheckError } = await supabaseAdmin
    .from("students")
    .select("id")
    .in("phone", [phone.nationalNumber, phone.e164])
    .neq("id", studentId)
    .limit(1)
  if (duplicateCheckError) {
    console.error("[admin student edit] phone duplicate check failed:", duplicateCheckError.message)
    return NextResponse.json({ error: "Unable to validate the student phone number." }, { status: 500 })
  }
  if (matchingStudents?.length) {
    return NextResponse.json(
      { error: "Another student is already registered with this phone number." },
      { status: 409 }
    )
  }

  const phoneChanged = normalizeIndianPhone(student.phone)?.nationalNumber !== phone.nationalNumber
  const authProfileChanged = phoneChanged || fullName !== student.full_name
  let previousAuthProfile: { phone: string | null; metadata: Record<string, unknown> } | null = null
  if (student.user_id && authProfileChanged) {
    const { data: authUser, error: userLookupError } = await supabaseAdmin.auth.admin.getUserById(student.user_id)
    if (userLookupError || !authUser.user) {
      console.error("[admin student edit] linked login lookup failed:", userLookupError?.message)
      return NextResponse.json({ error: "Could not update the student's linked login profile." }, { status: 500 })
    }
    previousAuthProfile = {
      phone: authUser.user.phone ?? null,
      metadata: authUser.user.user_metadata ?? {},
    }
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(student.user_id, {
      ...(phoneChanged ? { phone: phone.e164, phone_confirm: true } : {}),
      user_metadata: {
        ...authUser.user.user_metadata,
        full_name: fullName,
        phone: phone.nationalNumber,
      },
    })
    if (authUpdateError) {
      console.error("[admin student edit] linked login update failed:", authUpdateError.message)
      const duplicate = phoneChanged && /already|exists|registered/i.test(authUpdateError.message)
      return NextResponse.json(
        { error: duplicate ? "This phone number is already used by another login account." : "Could not update the student's linked login profile." },
        { status: duplicate ? 409 : 500 }
      )
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({
      full_name: fullName,
      email: email || null,
      phone: phone.nationalNumber,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      address: text("address") || null,
      father_name: text("fatherName") || null,
      father_phone: fatherPhone?.nationalNumber ?? null,
      mother_name: text("motherName") || null,
      batch_time: text("batchTime") || null,
      enrollment_date: enrollmentDate || null,
    })
    .eq("id", studentId)

  if (updateError) {
    if (student.user_id && previousAuthProfile) {
      const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(student.user_id, {
        ...(phoneChanged && previousAuthProfile.phone
          ? { phone: previousAuthProfile.phone, phone_confirm: true }
          : {}),
        user_metadata: previousAuthProfile.metadata,
      })
      if (rollbackError) {
        console.error("[admin student edit] linked login rollback failed:", rollbackError.message)
      }
    }
    console.error("[admin student edit] update failed:", updateError.message)
    return NextResponse.json({ error: "Could not save the student details." }, { status: 500 })
  }

  return NextResponse.json({
    student: {
      id: studentId,
      name: fullName,
      email: email || null,
      phone: phone.nationalNumber,
      dateOfBirth,
      gender,
      address: text("address"),
      fatherName: text("fatherName"),
      fatherPhone: fatherPhone?.nationalNumber ?? "",
      motherName: text("motherName"),
      batchTime: text("batchTime"),
      enrollmentDate,
    },
  })
}
