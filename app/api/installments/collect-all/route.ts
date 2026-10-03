import { NextResponse } from "next/server"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[installments/collect-all] SUPABASE_SERVICE_ROLE_KEY is missing from .env.local")
    return NextResponse.json(
      { error: "This action is unavailable right now." },
      { status: 503 }
    )
  }

  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { studentId?: unknown; method?: unknown; reference?: unknown }
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
    }
    body = parsed as { studentId?: unknown; method?: unknown; reference?: unknown }
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 })
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : ""
  if (!studentId) {
    return NextResponse.json({ error: "Choose a student before collecting fees." }, { status: 400 })
  }

  const method = typeof body.method === "string" ? body.method.trim() : ""
  if (!/^(cash|upi|bank)$/.test(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })
  }

  const reference = typeof body.reference === "string" ? body.reference.trim() : ""

  try {
    const { data, error } = await supabaseAdmin.rpc("collect_all_student_fees", {
      p_student_id: studentId,
      p_method: method,
      p_description: reference || "Full outstanding balance collected",
      p_verified_by: auth.userId,
    })

    if (error) {
      return failureResponse(
        describeRpcFailure(
          error,
          "installments/collect-all",
          "We couldn't collect the outstanding fees. Nothing was changed — please try again."
        )
      )
    }

    const rows = (Array.isArray(data) ? data : []).map((row) => ({
      feeId: (row as { fee_id?: string }).fee_id ?? null,
      installmentId: (row as { installment_id?: string }).installment_id ?? null,
      label: (row as { installment_label?: string }).installment_label ?? "",
      amount: Number((row as { amount?: number }).amount ?? 0),
    }))
    const amount = Number(rows.reduce((total, row) => total + row.amount, 0).toFixed(2))

    if (rows.length === 0 || amount <= 0) {
      return NextResponse.json(
        { error: "There is no collectible outstanding balance. Payments awaiting review are excluded." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, amount, count: rows.length, rows })
  } catch (error) {
    console.error("[installments/collect-all] crashed:", error)
    return NextResponse.json(
      { error: "We couldn't collect the outstanding fees. Nothing was changed — please try again." },
      { status: 500 }
    )
  }
}
