"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { isAwaitingVerification, isRejected, paymentStatusLabel } from "@/lib/payment-status"
import { useStudent } from "../layout"
import { getInstallmentPaymentTotals, getRemainingInstallmentBalance } from "@/lib/payment-balances"
import { PaymentReceiptButton } from "@/components/shared/payment-receipt-button"
import { PrintButton } from "@/components/shared/print-button"
import { buildStudentStatement } from "@/lib/fee-print"
import type { PrintReport } from "@/lib/print-report"

interface Payment {
  id: string
  date: string
  amount: number
  mode: string
  status: string
  for: string
  course: string
  /** The schedule line this money landed on, when it landed on one. */
  installment: string
  remainingBalance: number | null
  receiptNumber: string | null
  receiptSerial: number
  feeAmount: number
  paidToDate: number
  awaitingVerification: number
  balanceDue: number
  verifiedAt: string | null
}

/**
 * One presentation for every stored status.
 *
 * `p.status === "Paid" ? "Paid" : "Pending"` was wrong in a way that mattered: a
 * claim the institute had already refused is a terminal decision, and showing it
 * as "Pending" told the counter it was still waiting to be reviewed — so a student
 * whose claim was rejected looked like a student who had simply not been looked
 * at yet. The words are shared with the student's own fee page so the two cannot
 * drift.
 */
function statusClassName(status: string): string {
  if (status === "Paid") return "bg-emerald-500/15 text-emerald-600"
  if (isRejected(status)) return "bg-red-500/15 text-red-600"
  if (isAwaitingVerification(status)) return "bg-amber-500/15 text-amber-600"
  return "bg-muted text-muted-foreground"
}

export default function StudentPaymentsPage() {
  const student = useStudent()
  const [payments, setPayments] = useState<Payment[]>([])
  const [totalFee, setTotalFee] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [awaitingAmount, setAwaitingAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    async function fetchPayments() {
      setError(null)

      const { data: feesRows, error: feesError } = await supabase
        .from("fees").select("course_slug, total_fee, paid_amount, pending_amount").eq("student_id", student!.id)
      if (feesError) {
        console.error("[student payments] fee lookup failed:", feesError.message)
        setError("This student's fee record could not be loaded.")
        setLoading(false)
        return
      }
      if (feesRows && feesRows.length > 0) {
        setTotalFee(feesRows.reduce((s, f) => s + (f.total_fee ?? 0), 0))
      } else {
        setTotalFee(0)
      }

      const { data: paymentRows, error: paymentsError } = await supabase
        .from("payments").select("id, receipt_no, receipt_serial, verified_at, amount, payment_date, method, status, description, installment_id, course_slug")
        .eq("student_id", student!.id).order("payment_date", { ascending: false })

      if (paymentsError) {
        console.error("[student payments] payment lookup failed:", paymentsError.message)
        setError("This student's payment history could not be loaded.")
        setLoading(false)
        return
      }
      setPaidAmount((paymentRows ?? [])
        .filter((payment) => payment.status === "Paid")
        .reduce((sum, payment) => sum + Number(payment.amount), 0))
      const pendingClaimAmount = (paymentRows ?? [])
        .filter((payment) => isAwaitingVerification(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
      setAwaitingAmount(pendingClaimAmount)
      const paymentTotals = getInstallmentPaymentTotals(
        (paymentRows ?? []).map((payment) => ({
          installment_id: payment.installment_id,
          amount: Number(payment.amount),
          status: payment.status,
        }))
      )

      // Which schedule line each payment settled. Without it the "Payment For"
      // column showed only the free-text description, which is blank on payments
      // the database wrote and was empty exactly when an admin most needs to know
      // which installment a part payment went towards.
      const installmentIds = [
        ...new Set((paymentRows ?? []).map((row) => row.installment_id).filter(Boolean)),
      ] as string[]
      const courseSlugs = [
        ...new Set((paymentRows ?? []).map((row) => row.course_slug).filter(Boolean)),
      ] as string[]

      const [installmentResult, courseResult] = await Promise.all([
        installmentIds.length
          ? supabase.from("fee_installments").select("id, label, amount").in("id", installmentIds)
          : Promise.resolve({ data: [] as { id: string; label: string; amount: number }[], error: null }),
        courseSlugs.length
          ? supabase.from("courses").select("slug, name, short_name").in("slug", courseSlugs)
          : Promise.resolve({ data: [] as { slug: string; name: string; short_name: string }[], error: null }),
      ])
      if (installmentResult.error) {
        console.error("[student payments] installment lookup failed:", installmentResult.error.message)
        setError("Payment records loaded, but their installment details could not be read.")
        setLoading(false)
        return
      }
      if (courseResult.error) {
        console.error("[student payments] course lookup failed:", courseResult.error.message)
        setError("Payment records loaded, but their course details could not be read.")
        setLoading(false)
        return
      }
      const installmentRows = installmentResult.data
      const labelById = new Map((installmentRows ?? []).map((row) => [row.id, row.label]))
      const amountById = new Map((installmentRows ?? []).map((row) => [row.id, Number(row.amount)]))
      const courseNameBySlug = new Map((courseResult.data ?? []).map((row) => [row.slug, row.short_name || row.name]))

      setPayments((paymentRows ?? []).map((p) => {
        const installmentAmount = p.installment_id
          ? amountById.get(p.installment_id)
          : undefined
        return {
          id: p.id,
          date: p.payment_date,
          amount: p.amount,
          mode: p.method,
          status: p.status,
          for: p.description ?? "",
          course: p.course_slug ? courseNameBySlug.get(p.course_slug) ?? p.course_slug : "",
          installment: p.installment_id ? labelById.get(p.installment_id) ?? "" : "",
          remainingBalance: p.installment_id && installmentAmount !== undefined
            ? getRemainingInstallmentBalance(
                installmentAmount,
                paymentTotals.get(p.installment_id)
              )
            : null,
          receiptNumber: p.receipt_no,
          receiptSerial: p.receipt_serial,
          feeAmount: Number(feesRows?.find((fee) => fee.course_slug === p.course_slug)?.total_fee ?? 0),
          paidToDate: Number(feesRows?.find((fee) => fee.course_slug === p.course_slug)?.total_fee ?? 0) -
            Number(feesRows?.find((fee) => fee.course_slug === p.course_slug)?.pending_amount ?? 0),
          awaitingVerification: (paymentRows ?? [])
            .filter((claim) => claim.course_slug === p.course_slug && isAwaitingVerification(claim.status))
            .reduce((sum, claim) => sum + Number(claim.amount), 0),
          balanceDue: Math.max(0,
            Number(feesRows?.find((fee) => fee.course_slug === p.course_slug)?.pending_amount ?? 0) -
            (paymentRows ?? [])
              .filter((claim) => claim.course_slug === p.course_slug && isAwaitingVerification(claim.status))
              .reduce((sum, claim) => sum + Number(claim.amount), 0)
          ),
          verifiedAt: p.verified_at,
        }
      }))

      setLoading(false)
    }
    fetchPayments()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const pendingFee = Math.max(0, totalFee - paidAmount - awaitingAmount)

  /**
   * This student's ledger as a printed sheet.
   *
   * Built from the rows already loaded rather than a second query, so the sheet
   * cannot print figures that disagree with the table above the button. The
   * schedule is derived per course from the same totals the receipts use, which
   * is what makes the printed balance match `fees.pending_amount`.
   */
  function buildStatement(): PrintReport {
    const byCourse = new Map<string, { total: number; paid: number; awaiting: number }>()
    for (const payment of payments) {
      const course = payment.course || "Fee"
      const entry = byCourse.get(course) ?? { total: 0, paid: 0, awaiting: 0 }
      entry.total = payment.feeAmount
      if (payment.status === "Paid") entry.paid = payment.paidToDate
      entry.awaiting = payment.awaitingVerification
      byCourse.set(course, entry)
    }

    return buildStudentStatement({
      title: "Payment Statement",
      subtitle: "Payments received and balances outstanding",
      studentName: student?.name ?? "Student",
      studentId: student?.id ?? null,
      installments: [...byCourse.entries()].map(([course, entry]) => ({
        course,
        label: `${course} fee`,
        dueDate: payments.find((p) => p.course === course)?.date ?? "",
        paidDate: entry.paid > 0 ? payments.find((p) => p.course === course)?.date ?? null : null,
        amount: entry.total,
        paidAmount: entry.paid,
        awaitingAmount: entry.awaiting,
        balance: Math.max(0, Number((entry.total - entry.paid - entry.awaiting).toFixed(2))),
        status: entry.total - entry.paid - entry.awaiting <= 0 ? "Paid" : entry.paid > 0 ? "Partial" : "Pending",
      })),
      payments: payments.map((p) => ({
        id: p.id,
        course: p.course,
        against: p.installment || p.for,
        date: p.date,
        amount: p.amount,
        method: p.mode,
        reference: p.for,
        status: p.status,
      })),
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">₹{paidAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Still due</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600">₹{pendingFee.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Awaiting verification</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600">₹{awaitingAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <PrintButton
          getReport={buildStatement}
          title="Print this student's full payment statement"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment For</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden sm:table-cell">Mode</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.installment || p.for || <span className="text-muted-foreground">—</span>}
                    {p.course && (
                      <span className="block max-w-64 break-words text-xs font-normal text-muted-foreground">
                        {p.course}
                      </span>
                    )}
                    {p.installment && p.for && (
                      <span className="block max-w-64 break-words text-xs font-normal text-muted-foreground">
                        {p.for}
                      </span>
                    )}
                    <span className="mt-1 block break-words text-[11px] font-normal text-muted-foreground sm:hidden">
                      {p.date || "Date unavailable"} · {p.mode || "Method unavailable"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.mode}</TableCell>
                  <TableCell className="font-medium">
                    ₹{p.amount.toLocaleString()}
                    {p.remainingBalance !== null && (
                      <span className="block whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                        ₹{p.remainingBalance.toLocaleString()} still due on this installment
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px]", statusClassName(p.status))}>
                      {paymentStatusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PaymentReceiptButton
                      receipt={{
                        kind: "payment",
                        documentNumber: p.receiptNumber || p.id,
                        receiptSerial: p.receiptSerial,
                        date: p.date,
                        status: p.status,
                        studentName: student?.name ?? "Student",
                        studentId: student?.id ?? "—",
                        studentPhone: student?.phone,
                        course: p.course || "N/A",
                        installment: p.installment || null,
                        feeAmount: p.feeAmount,
                        transactionAmount: p.amount,
                        paidToDate: p.paidToDate,
                        awaitingVerification: p.awaitingVerification,
                        balanceDue: p.balanceDue,
                        method: p.mode,
                        reference: p.for,
                        verifiedAt: p.verifiedAt,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <p className="text-muted-foreground">No payment records found.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
