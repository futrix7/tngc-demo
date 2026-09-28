import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { findUserIdByEmail, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { respondWithFailure } from "@/lib/api-response"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function secretMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate, "utf8")
  const expectedBytes = Buffer.from(expected, "utf8")
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
}

export async function POST(request: Request) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!isSupabaseAdminConfigured || !email || !password || !EMAIL_PATTERN.test(email)) {
    console.error("[admin-auth] Supabase service role and valid ADMIN_EMAIL/ADMIN_PASSWORD must be configured")
    return NextResponse.json({ error: "Admin sign-in is not configured right now." }, { status: 503 })
  }

  let body: { email?: unknown; password?: unknown }

  try {
    const parsedBody: unknown = await request.json()
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsedBody as { email?: unknown; password?: unknown }
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const submittedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const submittedPassword = typeof body.password === "string" ? body.password : ""
  const emailMatches = secretMatches(submittedEmail, email)
  const passwordMatches = secretMatches(submittedPassword, password)

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: "Invalid admin email or password." }, { status: 401 })
  }

  try {
    const existingUser = await findUserIdByEmail(email)
    let userId: string

    if (existingUser.status === "found") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.userId, {
        password,
        email_confirm: true,
      })

      if (error) {
        console.error("[admin-auth] configured user update failed:", error.message)
        return NextResponse.json({ error: "We couldn't prepare admin sign-in." }, { status: 500 })
      }

      userId = existingUser.userId
    } else if (existingUser.status === "absent") {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "admin" },
      })

      if (error || !data.user) {
        console.error("[admin-auth] configured user creation failed:", error?.message ?? "No user returned")
        return NextResponse.json({ error: "We couldn't prepare admin sign-in." }, { status: 500 })
      }

      userId = data.user.id
    } else {
      console.error("[admin-auth] configured user lookup failed:", existingUser.status)
      return NextResponse.json({ error: "We couldn't prepare admin sign-in." }, { status: 503 })
    }

    const { data: admin, error: lookupError } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (lookupError) {
      console.error("[admin-auth] admin profile lookup failed:", lookupError.message)
      return NextResponse.json({ error: "We couldn't prepare admin sign-in." }, { status: 500 })
    }

    if (!admin) {
      const { error } = await supabaseAdmin.from("admins").insert({
        user_id: userId,
        full_name: process.env.ADMIN_NAME?.trim() || email.split("@")[0],
        email,
        role: "Administrator",
      })

      if (error) {
        console.error("[admin-auth] admin profile creation failed:", error.message)
        return NextResponse.json({ error: "We couldn't prepare admin sign-in." }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return respondWithFailure(err, "admin-auth/bootstrap")
  }
}