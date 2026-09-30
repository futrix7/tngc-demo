import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import { parseSingleAmount } from "@/lib/amount-split"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Records money received at the counter against a course fee.
 *
 * This is the part-payment path, and it is the one the app did not have.
 * `mark-paid` settles one installment in full: the amount is the installment's
 * own balance and nothing else. That covers a student paying the exact figure on
 * a due line and nothing else, so the two things an institute actually meets —
 * handing over less than the line, and paying a lump sum covering the first
 * installment and part of the second — had no route at all. An admin reaching
 * for the browser console, or editing `fees.paid_amount` by hand, was the only
 * way to record either.
 *
 * The figure is the administrator's own, and record_fee_payment() settles it
 * against the oldest open schedule line first so each row keeps showing honest
 * progress. It is one transaction: the ledger rows, the installment statuses and
 * the fee balance all move together or none of them do.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/collect] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "This action is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: {
    feeId?: unknown
    installmentId?: unknown
    amount?: unknown
    method?: unknown
    reference?: unknown
    status?: unknown
    paymentDate?: unknown
  }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
    }
    body = parsed as typeof body
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const installmentId =
    typeof body.installmentId === "string" ? body.installmentId.trim() : ""
  const feeId = typeof body.feeId === "string" ? body.feeId.trim() : ""

  if (!UUID_PATTERN.test(feeId) && !UUID_PATTERN.test(installmentId)) {
    return NextResponse.json(
      { error: "That installment could not be identified." },
      { status: 400 }
    )
  }

  const method = typeof body.method === "string" ? body.method.trim() : "cash"
  if (!/^(upi|cash|bank)$/.test(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  // `Partial` and `Overdue` are not recordable states. A payment is either money
  // that has arrived or money somebody says they have sent; `Partial` describes an
  // installment once a part payment lands on it — which the RPC derives itself —
  // and `Overdue` is a property of a due date rather than of a receipt. The old
  // Record Payment sheet offered all four and wrote them straight to the enum, so
  // a payment could be filed as "Overdue" and never settle anything.
  const status = typeof body.status === "string" ? body.status.trim() : "Paid"
  if (!/^(Paid|Pending)$/.test(status)) {
    return NextResponse.json(
      { error: "A payment can only be recorded as Paid or Pending." },
      { status: 400 }
    )
  }

  // Optional, and only ever in the past: a receipt dated tomorrow is money the
  // institute has not received, and every month-to-date report would count it. The
  // database refuses a future date as well; this keeps the message readable.
  const paymentDate = typeof body.paymentDate === "string" ? body.paymentDate.trim() : ""
  if (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return NextResponse.json(
      { error: "Enter the payment date as YYYY-MM-DD." },
      { status: 400 }
    )
  }
  if (paymentDate && paymentDate > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: "A payment cannot be dated in the future." },
      { status: 400 }
    )
  }

  const reference =
    typeof body.reference === "string" ? body.reference.trim() : ""

  const collected = parseSingleAmount(body.amount)
  if (collected.error || collected.amount === null) {
    return NextResponse.json(
      { error: collected.error ?? "Enter an amount greater than zero." },
      { status: 400 }
    )
  }

  // An installment id is resolved to its fee here rather than being handed to the
  // RPC, so the route's contract is the same either way: one course fee, one
  // figure. record_fee_payment() then decides which schedule lines it lands on.
  let targetFeeId = feeId

  if (!targetFeeId) {
    const { data: installment, error } = await supabaseAdmin
      .from("fee_installments")
      .select("fee_id")
      .eq("id", installmentId)
      .maybeSingle()

    if (error) {
      console.error("[installments/collect] installment lookup failed:", error.message)
      return NextResponse.json(
        { error: "That installment could not be identified." },
        { status: 400 }
      )
    }

    if (!installment) {
      return NextResponse.json(
        { error: "That installment could not be identified." },
        { status: 400 }
      )
    }

    targetFeeId = installment.fee_id
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("record_fee_payment_at", {
      p_fee_id: targetFeeId,
      p_amount: collected.amount,
      p_method: method,
      p_description: reference || "Received at the institute",
      p_status: status,
      p_receipt_no: null,
      // The signed-in admin's own account id, so the ledger records who took the
      // money. Passing a free-text note here, as this once did, attributed every
      // verified payment to whatever the admin happened to type.
      p_verified_by: auth.userId,
      p_payment_date: paymentDate || null,
    })

    if (error) {
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/collect",
          "We couldn't record that payment. Nothing was changed — please try again."
        )
      )
    }

    // One figure in, possibly several rows out: the RPC splits across the oldest
    // open schedule lines. Reporting the split back is what lets the caller say
    // "₹5,000 received — Installment 1 settled, ₹2,000 towards Installment 2"
    // instead of a bare success.
    const rows = (Array.isArray(data) ? data : []).map((row) => ({
      paymentId: (row as { payment_id?: string }).payment_id ?? null,
      installmentId: (row as { installment_id?: string }).installment_id ?? null,
      label: (row as { installment_label?: string }).installment_label ?? "",
      amount: Number((row as { amount?: number }).amount ?? 0),
    }))

    const settled = rows.reduce((sum, row) => sum + row.amount, 0)

    // A figure smaller than the amount claimed means the RPC stopped early —
    // every open line is covered and there is nothing left to take. That is a
    // real answer, not a failure, so it is reported as a shortfall rather than a
    // success for the full amount.
    if (rows.length === 0 || settled + 0.005 < collected.amount) {
      return NextResponse.json(
        {
          error: settled > 0
            ? `Only ₹${settled.toLocaleString("en-IN")} could be applied. ₹${(collected.amount - settled).toLocaleString("en-IN")} is not outstanding on this course.`
            : "There is nothing outstanding on this course to collect.",
          settled,
          rows,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      amount: settled,
      count: rows.length,
      rows,
    })
  } catch (err) {
    console.error("[installments/collect] crashed:", err)
    return NextResponse.json(
      { error: "We couldn't record that payment. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}
