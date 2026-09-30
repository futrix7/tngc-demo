import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import { isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { normalizeIndianPhone } from "@/lib/phone"
import { checkRate } from "@/lib/rate-limit"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Students sign in with their phone number, but the project has the phone (SMS)
 * provider disabled, so GoTrue answers every phone sign-in with "Phone logins
 * are disabled". This route takes the phone + password the user typed, finds the
 * account behind that number, and completes the sign-in from the server using
 * an email address instead — the email provider is enabled and needs no SMS.
 *
 * The address is only a sign-in handle for GoTrue. Students never see it, and
 * it is minted lazily for accounts that were created phone-only.
 */
const STUDENT_LOGIN_EMAIL_SUFFIX = "@students.tngc.in"

/** Failed and successful attempts both count: the limit is on guesses per number. */
const LOGIN_ATTEMPT_LIMIT = 8
const LOGIN_WINDOW_MS = 15 * 60 * 1000

type PendingCookie = { name: string; value: string; options: CookieOptions }

/**
 * Cookie attributes Next's response API understands.
 *
 * @supabase/ssr hands back `Partial<SerializeOptions>`, which also carries an
 * `encode` function that means nothing once the value is already written, so
 * the list is copied rather than the object spread wholesale.
 */
function toResponseCookieOptions(options: CookieOptions) {
  // SerializeOptions types sameSite as boolean too; the response cookie API
  // only accepts the three keywords, so collapse the boolean form here.
  const sameSite =
    options.sameSite === true ? "strict" : options.sameSite === false ? "lax" : options.sameSite

  return {
    ...(options.domain !== undefined ? { domain: options.domain } : {}),
    ...(options.expires !== undefined ? { expires: options.expires } : {}),
    ...(options.httpOnly !== undefined ? { httpOnly: options.httpOnly } : {}),
    ...(options.maxAge !== undefined ? { maxAge: options.maxAge } : {}),
    ...(options.path !== undefined ? { path: options.path } : {}),
    ...(sameSite !== undefined ? { sameSite } : {}),
    ...(options.secure !== undefined ? { secure: options.secure } : {}),
  }
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured || !supabaseUrl || !supabaseAnonKey) {
    console.error("[auth] sign-in needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY")
    return fail("Sign-in is unavailable right now.", 503)
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("Malformed request body.", 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return fail("Malformed request body.", 400)
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  const normalizedPhone = normalizeIndianPhone(phone)
  if (!normalizedPhone) return fail("Enter a valid 10-digit mobile number.", 400)
  if (!password) return fail("Password is required.", 400)

  // Throttled before the credential check so a guessing loop cannot race the
  // lookup. A limiter outage must not lock everyone out of the app, so it is
  // logged and the sign-in continues — this route already fails closed without
  // the service key.
  try {
    const verdict = await checkRate(
      `login:${normalizedPhone.nationalNumber}`,
      LOGIN_ATTEMPT_LIMIT,
      LOGIN_WINDOW_MS
    )
    if (!verdict.allowed) {
      const minutes = Math.max(1, Math.ceil(verdict.retryInSec / 60))
      return fail(
        `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        429
      )
    }
  } catch (err) {
    console.error("[auth] login throttle unavailable:", err instanceof Error ? err.message : err)
  }

  // phone is not unique by constraint, so take the newest enrolment rather than
  // letting maybeSingle() throw on a duplicate.
  const { data: students, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, user_id, full_name, phone")
    .eq("phone", normalizedPhone.nationalNumber)
    .order("created_at", { ascending: false })
    .limit(1)

  if (studentError) {
    console.error("[auth] student lookup failed:", studentError.message)
    return fail("We couldn't sign you in right now. Please try again.", 500)
  }

  const student = students?.[0]

  if (!student || !student.user_id) {
    return fail("No login is linked to this phone number. Ask the administrator to set one up.", 401)
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(student.user_id)

  if (userError || !userData.user) {
    console.error("[auth] auth user lookup failed:", userError?.message)
    return fail("No login is linked to this phone number. Ask the administrator to set one up.", 401)
  }

  let loginEmail = (userData.user.email ?? "").trim()

  if (!loginEmail) {
    loginEmail = `${normalizedPhone.nationalNumber}${STUDENT_LOGIN_EMAIL_SUFFIX}`
    const { error: attachError } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
      email: loginEmail,
      email_confirm: true,
    })

    if (attachError) {
      console.error("[auth] attaching a login address failed:", attachError.message)
      return fail("We couldn't prepare your sign-in. Ask the administrator to reset your password.", 500)
    }
  }

  // Cookie-backed client so the session it creates lands on the response the
  // browser is about to receive, exactly like a normal Supabase sign-in.
  const pendingCookies: PendingCookie[] = []
  const pendingHeaders: [string, string][] = []

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet, headers) => {
        for (const cookie of cookiesToSet) pendingCookies.push(cookie)
        // Cache headers travel with the first write: a cached response could
        // hand one student's session token to somebody else.
        for (const [name, value] of Object.entries(headers)) pendingHeaders.push([name, value])
      },
    },
  })

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: loginEmail,
    password,
  })

  if (signInError) {
    console.error("[auth] password sign-in failed:", signInError.message)

    if (/email logins are disabled/i.test(signInError.message)) {
      return fail("Email sign-in is disabled on this Supabase project. Enable the Email provider.", 503)
    }

    if (/invalid login credentials/i.test(signInError.message)) {
      return fail("Incorrect phone number or password.", 401)
    }

    return fail("We couldn't sign you in right now. Please try again.", 500)
  }

  if (pendingCookies.length === 0) {
    console.error("[auth] sign-in returned no session cookies")
    return fail("We couldn't sign you in right now. Please try again.", 500)
  }

  const response = NextResponse.json({ ok: true, name: student.full_name })

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, toResponseCookieOptions(options))
  }

  for (const [name, value] of pendingHeaders) {
    response.headers.set(name, value)
  }

  return response
}
