import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Records money received at the counter against a single installment.
 *
 * The browser used to do this as three separate writes — mark the installment
 * paid, move the fee balance, insert the payment — and when the last of those
 * was refused the dialog reported "Installment marked paid, but the payment could
 * not be recorded", leaving the money counted as collected on the installments
 * and fee screens while being absent from the finance dashboard. One transaction
 * here means that state cannot be produced.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/mark-paid] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "This action is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { installmentId?: unknown; method?: unknown; reference?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const installmentId = typeof body.installmentId === "string" ? body.installmentId.trim() : ""

  if (!UUID_PATTERN.test(installmentId)) {
    return NextResponse.json({ error: "That installment could not be identified." }, { status: 400 })
  }

  const method = typeof body.method === "string" ? body.method.trim() : "cash"
  const reference = typeof body.reference === "string" ? body.reference.trim() : ""

  if (!/^(upi|cash|bank)$/.test(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("mark_installment_paid", {
      p_installment_id: installmentId,
      p_method: method,
      p_reference: reference,
    })

    if (error) {
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/mark-paid",
          "We couldn't record that payment. Nothing was changed — please try again."
        )
      )
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { payment_id?: string; amount?: number }
      | undefined

    return NextResponse.json({
      success: true,
      paymentId: row?.payment_id ?? null,
      amount: Number(row?.amount ?? 0),
    })
  } catch (err) {
    console.error("[installments/mark-paid] crashed:", err)
    return NextResponse.json(
      { error: "We couldn't record that payment. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}
