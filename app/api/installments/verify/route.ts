import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

const MAX_IDS = 60

/**
 * The admin decision on a student's payment claim.
 *
 * This is the step that was missing from the app entirely, and its absence is
 * what "verification completed but nothing updated" meant in practice: an admin
 * could set a payment to Paid in the finance view, but nothing connected that to
 * the installment it paid for or to fees.paid_amount, so the student's fee page
 * went on showing the money as owed.
 *
 * Both the status flip and the settlement happen inside one transaction, so a
 * student who reloads sees a consistent fee page rather than a half-applied one.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/verify] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "Verification is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { paymentIds?: unknown; approve?: unknown; note?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const paymentIds = Array.isArray(body.paymentIds)
    ? body.paymentIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : []

  if (paymentIds.length === 0) {
    return NextResponse.json({ error: "Select at least one payment." }, { status: 400 })
  }

  if (paymentIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Verify at most ${MAX_IDS} payments at a time.` },
      { status: 400 }
    )
  }

  // Rejection is the default: `approve` must be an explicit true, so a malformed
  // or missing flag settles a claim rather than leaving it in limbo.
  const approve = body.approve === true
  const note = typeof body.note === "string" ? body.note.trim() : ""

  // The audit column records who decided, and that is the signed-in admin's own
  // account id -- not the note. Passing the note here, as this did before, meant
  // every verified payment was attributed to whatever the admin typed in an
  // optional field, and to a bare "admin" whenever the field was left blank.
  const reviewer = auth.userId

  try {
    const { data, error } = await supabaseAdmin.rpc("verify_installment_payments", {
      p_payment_ids: paymentIds,
      p_approved: approve,
      p_verified_by: reviewer,
      p_note: note,
    })

    if (error) {
      // Rejection and approval go through this same branch, and a failure here
      // used to be reported as a generic 500 telling the admin to try again.
      // That was unreachable for the cases that actually occur: a database
      // without the 'Rejected' enum member, or an RPC the migration has not
      // created yet. Neither can be fixed by retrying, so they are described
      // instead — see describeRpcFailure().
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/verify",
          "We couldn't record that decision. Nothing was changed — please try again."
        )
      )
    }

    const rows = Array.isArray(data) ? data : []

    return NextResponse.json({
      success: true,
      approved: approve,
      // Counted from the rows the RPC settled, not from the request, so the
      // number reflects what actually changed.
      settled: rows.length,
      amount: rows.reduce((sum, r) => sum + Number((r as { amount?: number }).amount ?? 0), 0),
    })
  } catch (err) {
    console.error("[installments/verify] crashed:", err)
    return NextResponse.json(
      { error: "We couldn't record that decision. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}
