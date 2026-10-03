/**
 * How a payment's verification state is presented to a student.
 *
 * `payments.status` is the `payment_status` enum: Paid | Pending | Partial |
 * Overdue | Rejected. A registration filed by register_student() lands as
 * `Pending`, because the student paid by UPI and supplied a transaction
 * reference that a human still has to check before any money counts as received.
 *
 * `Pending` is displayed as "Awaiting verification" wherever a student can see
 * it. The stored value is deliberately left alone: `Pending` is the enum's own
 * word for a claim in flight, and a student's claim is in flight whether or not
 * the portal has a prettier label for it.
 *
 * `Rejected` is the one value that needed adding to the enum, and it was not a
 * presentational change. A refused claim has to stop being `Pending`, because
 * `Pending` is exactly the state that blocks the student from paying that
 * installment again — a rejected claim parked there left the installment
 * permanently unpayable. It needs its own terminal status, and the student is
 * told plainly that it was refused and can be paid again.
 *
 * Every surface that shows a student's payment status goes through this module,
 * so the wording cannot drift between the dashboard, the fee page and the payment
 * history.
 */

/** The stored status that means a human still has to verify the payment. */
export const AWAITING_VERIFICATION = "Pending"

/** The stored status that means the institute refused the claim. */
export const PAYMENT_REJECTED = "Rejected"

/**
 * Whether a payment is sitting with the institute waiting to be verified.
 *
 * `Rejected` is explicitly not "awaiting": the decision has been made. Only
 * `Pending` means a human still has to act.
 */
export function isAwaitingVerification(status: string | null | undefined): boolean {
  return status === AWAITING_VERIFICATION
}

/** Whether a claim was refused, and so may be paid again. */
export function isRejected(status: string | null | undefined): boolean {
  return status === PAYMENT_REJECTED
}

/** Student-facing wording for a stored payment status. */
export function paymentStatusLabel(status: string | null | undefined): string {
  if (isAwaitingVerification(status)) return "Awaiting verification"
  if (isRejected(status)) return "Rejected — not received, please pay again"
  return status || "—"
}

/**
 * Colour family for a status, wherever it is printed or shown as a badge.
 *
 * Lives beside the wording so a ledger and a printed statement cannot drift
 * apart: `Paid` reads as received, `Pending` as money in flight, `Rejected` as
 * settled-but-refused rather than alarming. The values are the tones understood
 * by the print template (`lib/print-report.ts`).
 */
export type PaymentStatusTone = "positive" | "warning" | "negative" | "muted" | "info"

export function paymentStatusTone(status: string | null | undefined): PaymentStatusTone {
  if (status === "Paid") return "positive"
  if (isAwaitingVerification(status)) return "warning"
  if (status === "Partial") return "info"
  if (status === "Overdue") return "negative"
  return "muted"
}

/**
 * Compact wording for a status inside a table column.
 *
 * The student-facing sentence is right for a banner and too long for a cell on
 * a printed page, where the same status repeats on every row.
 */
export function paymentStatusCellLabel(status: string | null | undefined): string {
  if (isAwaitingVerification(status)) return "Awaiting verification"
  if (isRejected(status)) return "Rejected"
  return status || "—"
}
