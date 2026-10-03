import { NextResponse } from "next/server"
import { describeRpcFailure, failureResponse } from "@/lib/api-response"
import { parseSingleAmount } from "@/lib/amount-split"
import {
  authenticateAdminRequest,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from "@/lib/supabase-admin"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Adding installments is unavailable right now." }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 })
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : ""
  const feeId = typeof body.feeId === "string" ? body.feeId.trim() : ""
  const sourceInstallmentId =
    typeof body.sourceInstallmentId === "string" ? body.sourceInstallmentId.trim() : ""
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : ""
  const rawAmount = typeof body.amount === "string" || typeof body.amount === "number"
    ? String(body.amount).trim()
    : ""
  const parsedAmount = parseSingleAmount(body.amount)

  if (!STUDENT_ID_PATTERN.test(studentId) || !UUID_PATTERN.test(feeId) || !UUID_PATTERN.test(sourceInstallmentId)) {
    return NextResponse.json({ error: "Choose a valid student fee and outstanding installment." }, { status: 400 })
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
    return NextResponse.json({ error: "Use a valid positive amount with no more than two decimal places." }, { status: 400 })
  }
  if (parsedAmount.error || parsedAmount.amount === null) {
    return NextResponse.json({ error: parsedAmount.error ?? "Enter an amount greater than zero." }, { status: 400 })
  }
  if (!label || label.length > 100) {
    return NextResponse.json({ error: "Enter an installment label of 1 to 100 characters." }, { status: 400 })
  }
  if (!isCalendarDate(dueDate)) {
    return NextResponse.json({ error: "Enter a valid installment due date." }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc("add_student_fee_installment", {
    p_student_id: studentId,
    p_fee_id: feeId,
    p_split_from_installment_id: sourceInstallmentId,
    p_amount: parsedAmount.amount,
    p_label: label,
    p_due_date: dueDate,
  })

  if (error) {
    return failureResponse(
      describeRpcFailure(
        error,
        "admin/students/add-installment",
        "We couldn't add that installment. Nothing was changed."
      )
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    success: true,
    installmentId: row?.new_installment_id ?? null,
    label: row?.new_installment_label ?? label,
    sourceRemaining: Number(row?.remaining_source_amount ?? 0),
  })
}
