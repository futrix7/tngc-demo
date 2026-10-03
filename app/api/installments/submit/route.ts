import { NextResponse } from "next/server"
import {
  authenticateStudentRequest,
  supabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabase-admin"
import { checkRate, RateLimiterUnavailableError } from "@/lib/rate-limit"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import { parsePaymentAmount } from "@/lib/amount-split"

const MAX_ATTEMPTS = 20
const WINDOW_MS = 60 * 60 * 1000

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A student claims to have handed over one amount against one course fee.
 *
 * That is the whole request: a course, a figure, how they paid and a reference if
 * they have one. Nothing about the schedule is asked of them, because deciding
 * how their own money is divided is not their job — and the schedule already
 * says when the rest is due. The figure is theirs alone: no share is worked out
 * for them, no box is pre-filled, and nothing about it is adjusted on the way in.
 *
 * The claim is filed, not settled. A student asserting they paid is not the
 * institute confirming receipt, and the earlier "Pay now" button used to
 * conflate the two, which is how a student could mark themselves paid from a
 * browser. No balance moves here; that happens in verify_installment_payments(),
 * which only an admin can reach.
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

  let body: {
    feeId?: unknown
    method?: unknown
    reference?: unknown
    amount?: unknown
  }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
    }
    body = parsed as { feeId?: unknown; method?: unknown; reference?: unknown; amount?: unknown }
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const method = typeof body.method === "string" ? body.method.trim() : "upi"
  const reference = typeof body.reference === "string" ? body.reference.trim() : ""

  if (!/^(upi|cash|bank)$/.test(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }
  if (reference.length > 200) {
    return NextResponse.json({ error: "Payment reference must be 200 characters or fewer." }, { status: 400 })
  }
  const feeId = typeof body.feeId === "string" ? body.feeId.trim() : ""

  if (!UUID_PATTERN.test(feeId)) {
    return NextResponse.json({ error: "Choose a course to pay towards." }, { status: 400 })
  }

  const claimed = parsePaymentAmount(body.amount)
  if (claimed.error || claimed.amount === null) {
    return NextResponse.json(
      { error: claimed.error ?? "Enter the amount you are paying." },
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
    // Fails closed: without a throttle a student could file claims all day, and
    // each one is a row an admin has to reconcile.
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
    const { data, error } = await supabaseAdmin.rpc("submit_fee_payment", {
      p_user_id: auth.userId,
      p_fee_id: feeId,
      p_amount: claimed.amount,
      p_method: method,
      p_reference: reference,
    })

    if (error) {
      // 22023 and 42501 are the RPC's own validation and ownership refusals —
      // nothing left to pay, this is not their fee. Those are the student's
      // problem to fix, so they are reported as-is rather than flattened into
      // "try again". describeRpcFailure keeps that behaviour and additionally
      // names the case where `supabase.sql` has not been applied yet, which a
      // retry cannot fix.
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/submit",
          "We couldn't record your payment. Nothing was charged — please try again."
        )
      )
    }

    // The figure is echoed back exactly as claimed rather than recomputed from the
    // rows it landed on, so the student is told the number they typed.
    const rows = (Array.isArray(data) ? data : []).map((r) => ({
      amount: Number((r as { amount?: number }).amount ?? 0),
      label: (r as { installment_label?: string }).installment_label ?? "",
    }))

    return NextResponse.json({
      success: true,
      count: rows.length,
      amount: Number(claimed.amount.toFixed(2)),
      // Named explicitly because "awaiting verification" is the state the whole
      // flow now rests on, and a filed claim must not read as a settled balance.
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