import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Reverses a paid installment — the money never arrived, or the mark was a
 * misclick.
 *
 * Before this existed the only way back was to edit the installment by hand, and
 * that left the payment row sitting in the ledger marked Paid, so the finance
 * dashboard went on counting revenue the institute never received. The RPC
 * reverses the linked ledger rows and credits the balance in the same
 * transaction, so the two can no longer disagree.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/unmark] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "This action is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { installmentId?: unknown; reason?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const installmentId = typeof body.installmentId === "string" ? body.installmentId.trim() : ""

  if (!UUID_PATTERN.test(installmentId)) {
    return NextResponse.json({ error: "That installment could not be identified." }, { status: 400 })
  }

  // Required, not optional. The reversal is written onto the ledger row, so an
  // unexplained "money never arrived" months later is at least traceable; defaulting
  // to an empty reason just reproduces the silent-mutation problem this replaces.
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""

  if (!reason) {
    return NextResponse.json(
      { error: "Give a reason for reversing this installment." },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("unmark_installment", {
      p_installment_id: installmentId,
      p_reason: reason,
      p_unmarked_by: auth.userId,
    })

    if (error) {
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/unmark",
          "We couldn't reverse that installment. Nothing was changed — please try again."
        )
      )
    }

    const row = (Array.isArray(data) ? data[0] : data) as { amount?: number } | undefined

    return NextResponse.json({
      success: true,
      amount: Number(row?.amount ?? 0),
    })
  } catch (err) {
    console.error("[installments/unmark] crashed:", err)
    return NextResponse.json(
      { error: "We couldn't reverse that installment. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}
