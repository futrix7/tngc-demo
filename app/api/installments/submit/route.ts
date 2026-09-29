import { NextResponse } from "next/server"
import {
  authenticateStudentRequest,
  supabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabase-admin"
import { checkRate, RateLimiterUnavailableError } from "@/lib/rate-limit"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

const MAX_ATTEMPTS = 20
const WINDOW_MS = 60 * 60 * 1000

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A student claims to have paid one or more installments.
 *
 * Allocates a custom amount across selected installment balances, files Pending
 * payment rows and stops there. Nothing about the
 * fee balance changes: the student asserting they paid is not the institute
 * confirming receipt, and the earlier "Pay now" button used to conflate the two,
 * which is how a student could mark themselves paid from a browser. The balance
 * moves in verify_installment_payments(), which only an admin can reach.
 *
 * The three-installment-position cap is enforced in the RPC by installment
 * number, so a multi-course selection can include one row per course. "Pay all remaining" is not a
 * special case here — it is simply a longer id list, and it is deliberately
 * allowed to exceed three, because refusing to settle a student's whole
 * outstanding balance in one go is the opposite of what the button says it does.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/submit] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "Payments are unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateStudentRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { installmentIds?: unknown; method?: unknown; reference?: unknown; payAll?: unknown; amount?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const method = typeof body.method === "string" ? body.method.trim() : "upi"
  const reference = typeof body.reference === "string" ? body.reference.trim() : ""
  const payAll = body.payAll === true
  const amount = typeof body.amount === "number" ? body.amount : Number.NaN

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a payment amount greater than zero." }, { status: 400 })
  }

  if (!/^(upi|cash|bank)$/.test(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  let installmentIds: string[] = Array.isArray(body.installmentIds)
    ? body.installmentIds.filter((v): v is string => typeof v === "string" && UUID_PATTERN.test(v))
    : []

  // "Pay all remaining" arrives as a flag rather than a long id list, so the
  // outstanding set is resolved here against the database rather than trusted
  // from the client.
  if (payAll) {
    const { data, error } = await supabaseAdmin
      .from("fee_installments")
      .select("id, fee_id, status, fees!inner(student_id)")
      .eq("fees.student_id", auth.studentId)
      .in("status", ["Pending", "Partial"])

    if (error) {
      console.error("[installments/submit] outstanding lookup failed:", error.message)
      return NextResponse.json(
        { error: "We couldn't read your outstanding installments. Please try again." },
        { status: 500 }
      )
    }

    // Excludes installments that already have a claim in flight. They are not
    // outstanding in any meaningful sense, and re-claiming one would be rejected
    // by the RPC -- taking the whole "pay everything" transaction down with it
    // because one installment happened to be mid-verification.
    const candidateIds = (data ?? []).map((r) => r.id as string)

    let claimedIds: string[] = []

    if (candidateIds.length > 0) {
      const { data: claims, error: claimError } = await supabaseAdmin
        .from("payments")
        .select("installment_id")
        .in("installment_id", candidateIds)
        .eq("status", "Pending")

      if (claimError) {
        console.error("[installments/submit] claim lookup failed:", claimError.message)
        return NextResponse.json(
          { error: "We couldn't read your outstanding installments. Please try again." },
          { status: 500 }
        )
      }

      claimedIds = (claims ?? [])
        .map((r) => r.installment_id as string)
        .filter((v): v is string => typeof v === "string")
    }

    const claimed = new Set(claimedIds)
    installmentIds = candidateIds.filter((id) => !claimed.has(id))
  }

  if (installmentIds.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one installment to pay." },
      { status: 400 }
    )
  }

  try {
    const rate = await checkRate(`installment-submit:${auth.userId}`, MAX_ATTEMPTS, WINDOW_MS)

    if (!rate.allowed) {
      const mins = Math.max(1, Math.ceil(rate.retryInSec / 60))
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
        { status: 429 }
      )
    }
  } catch (err) {
    // Fails closed: without a throttle a student could file claims for every
    // installment they have, and each one is a row an admin has to reconcile.
    if (err instanceof RateLimiterUnavailableError) {
      console.error(`[installments/submit] ${err.message}`)
    } else {
      console.error("[installments/submit] rate limit failed:", err)
    }
    return NextResponse.json(
      { error: "Payments are unavailable right now. Please try again." },
      { status: 503 }
    )
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("submit_installment_payments", {
      p_user_id: auth.userId,
      p_installment_ids: installmentIds,
      p_method: method,
      p_reference: reference,
      p_pay_all: payAll,
      p_amount: amount,
    })

    if (error) {
      // 22023 and 42501 are the RPC's own validation and ownership refusals —
      // already-paid, already-claimed, not this student's installment. Those are
      // the student's problem to fix, so they are reported as-is rather than
      // flattened into "try again". describeRpcFailure keeps that behaviour and
      // additionally names the case where `supabase.sql` simply has not been
      // applied, which a retry cannot fix.
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/submit",
          "We couldn't record your payment. Nothing was charged — please try again."
        )
      )
    }

    // The RPC returns the column as `amount`; reading `installment_amount` here
    // silently yielded 0 for every row, so a successful multi-installment claim
    // reported "₹0 recorded" back to the student.
    const rows = (Array.isArray(data) ? data : []).map((r) => ({
      amount: Number((r as { amount?: number }).amount ?? 0),
      label: (r as { installment_label?: string }).installment_label ?? "",
    }))

    const total = rows.reduce((sum, r) => sum + r.amount, 0)

    return NextResponse.json({
      success: true,
      count: new Set(rows.map((row) => row.label)).size,
      amount: total,
      // Named explicitly because "awaiting verification" is the state the whole
      // flow now rests on, and the student must not read a filed claim as a
      // settled balance.
      status: "Pending",
    })
  } catch (err) {
    console.error("[installments/submit] crashed:", err)
    return NextResponse.json(
      { error: "We couldn't record your payment. Nothing was charged — please try again." },
      { status: 500 }
    )
  }
}
