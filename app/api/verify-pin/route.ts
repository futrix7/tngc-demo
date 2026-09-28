import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { authenticateAdminRequest } from "@/lib/supabase-admin"
import { checkRate, RateLimiterUnavailableError } from "@/lib/rate-limit"

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

/** Constant-time compare so the PIN cannot be recovered by timing the endpoint. */
function pinMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, "utf8")
  const b = Buffer.from(expected, "utf8")

  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  // The length of a 6-digit PIN is not a secret.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Second-factor gate for the finance dashboard.
 *
 * This endpoint is reachable by anyone who can reach the app, so it verifies a
 * real admin session before it looks at the PIN. Without that check the PIN was
 * brute-forceable from the public internet.
 */
export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const expected = process.env.FINANCE_PIN?.trim()

  if (!expected) {
    console.error("[verify-pin] FINANCE_PIN is missing from .env.local")
    return NextResponse.json(
      { error: "The finance PIN gate is not configured." },
      { status: 503 }
    )
  }

  let body: { pin?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const pin = typeof body.pin === "string" ? body.pin.trim() : ""

  if (!/^\d{4,12}$/.test(pin)) {
    return NextResponse.json({ error: "Enter the 6-digit finance PIN." }, { status: 400 })
  }

  try {
    const rate = await checkRate(`finance-pin:${auth.userId}`, MAX_ATTEMPTS, WINDOW_MS)

    if (!rate.allowed) {
      const mins = Math.max(1, Math.ceil(rate.retryInSec / 60))
      return NextResponse.json(
        { error: `Too many incorrect attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
        { status: 429 }
      )
    }
  } catch (err) {
    if (err instanceof RateLimiterUnavailableError) {
      console.error(`[verify-pin] ${err.message}`)
      return NextResponse.json(
        { error: "The finance PIN gate is unavailable right now." },
        { status: 503 }
      )
    }
    console.error("[verify-pin] rate limit failed:", err)
    return NextResponse.json(
      { error: "The finance PIN gate is unavailable right now." },
      { status: 503 }
    )
  }

  if (pinMatches(pin, expected)) {
    return NextResponse.json({ valid: true })
  }

  return NextResponse.json({ valid: false, error: "Incorrect PIN." }, { status: 401 })
}
