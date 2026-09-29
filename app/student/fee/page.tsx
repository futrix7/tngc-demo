"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Award, BookOpen, CheckCircle2, Clock, CreditCard, ExternalLink, Loader2, Plus, ShieldQuestion, XCircle } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { AWAITING_VERIFICATION, PAYMENT_REJECTED } from "@/lib/payment-status"
import { UpiPayBlock } from "@/components/student/upi-pay-block"

interface Installment {
  id: string
  ids: string[]
  payableIds: string[]
  label: string
  amount: number
  paidAmount: number
  balance: number
  payableBalance: number
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending" | "Partial"
  /** True while a payment claim for it sits with the institute, unreviewed. */
  awaitingVerification: boolean
}

interface Extra {
  label: string
  amount: number
  status: "Paid" | "Pending"
}

interface FeeData {
  course: string
  courseSlugs: string[]
  certifiableCourseSlugs: string[]
  totalFee: number
  paid: number
  pending: number
  installments: Installment[]
  extras: Extra[]
}

interface AvailableCourse {
  slug: string
  name: string
  fee: number
}

/** One row per enrolled course — register_student() writes one fees row each. */
interface FeeRow {
  id: string
  course_slug: string | null
  total_fee: number
  paid_amount: number
  pending_amount: number
}

const fallbackFeeDetails: FeeData = {
  course: "Course",
  courseSlugs: [],
  certifiableCourseSlugs: [],
  totalFee: 0,
  paid: 0,
  pending: 0,
  installments: [],
  extras: [],
}

export default function StudentFee() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [feeDetails, setFeeDetails] = useState<FeeData>(fallbackFeeDetails)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [awaitingVerification, setAwaitingVerification] = useState<{
    count: number
    amount: number
  } | null>(null)
  /**
   * Claims the institute refused. Kept as raw rows rather than resolved labels
   * because this fetch deliberately runs before the schedule is loaded, so a
   * student who has no fee rows yet still learns a claim of theirs was turned
   * down instead of finding a balance that moved for no visible reason.
   */
  const [rejectedClaims, setRejectedClaims] = useState<{
    amount: number
    installmentId: string | null
  }[]>([])

  const paidPct = feeDetails.totalFee > 0 ? Math.round((feeDetails.paid / feeDetails.totalFee) * 100) : 0
  const extrasTotal = feeDetails.extras.reduce((sum, e) => sum + e.amount, 0)

  const [payOpen, setPayOpen] = useState(false)
  const [method, setMethod] = useState("upi")
  const [reference, setReference] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paid, setPaid] = useState(false)
  const [paying, setPaying] = useState(false)
  const [selectedInstallmentKeys, setSelectedInstallmentKeys] = useState<string[]>([])
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([])
  const [selectedCourseSlug, setSelectedCourseSlug] = useState("")
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    const fetchFeeData = async () => {
      setLoading(true)
      setLoadError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, course_slug, full_name, branch_id")
        .eq("user_id", user.id)
        .single()

      if (studentError) {
        console.error("[fee] student lookup failed:", studentError.message)
        setLoadError("We couldn't load your fee details. Please refresh the page.")
        setLoading(false)
        return
      }

      if (!student) { setLoading(false); return }

      setStudentId(student.id)

      // Every enrolled course has its own fees row, so this is a list. It used to
      // be read with .single(), which fails outright the moment a student enrols
      // in two courses — the form allows six — and left the page showing zeros
      // with a "Pay now" button that did nothing, because the single id it had
      // held was never set.
      const { data: feeRowsResult, error: feesError } = await supabase
        .from("fees")
        .select("id, course_slug, total_fee, paid_amount, pending_amount")
        .eq("student_id", student.id)

      if (feesError) {
        console.error("[fee] fees lookup failed:", feesError.message)
        setLoadError("We couldn't load your fee details. Please refresh the page.")
        setLoading(false)
        return
      }

      const rows = (feeRowsResult ?? []) as FeeRow[]

      // Read before the early return below, so a student with no fees rows yet
      // still learns that money is already with the institute. This is the page
      // that decides whether to pay again, and its "Pay Now" button is driven by
      // `pending_amount` — which does not move until an admin reconciles the
      // payment. Without this the student sees a full balance due for a fee they
      // have already paid for, and pays twice.
      const { data: pendingPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("student_id", student.id)
        .eq("status", AWAITING_VERIFICATION)

      // Assigned unconditionally. Guarding on length left the banner in place
      // after the last claim was reconciled, telling the student money was with
      // the institute when it had already been credited or refused.
      setAwaitingVerification(
        pendingPayments && pendingPayments.length > 0
          ? {
              count: pendingPayments.length,
              amount: pendingPayments.reduce(
                (sum: number, p: { amount: number }) => sum + Number(p.amount),
                0
              ),
            }
          : null
      )

      // A refused claim is not a settled balance and not a claim in flight — the
      // installment is payable again, and the student needs to be told that is
      // why the amount came back.
      const { data: rejectedPayments } = await supabase
        .from("payments")
        .select("amount, installment_id")
        .eq("student_id", student.id)
        .eq("status", PAYMENT_REJECTED)

      setRejectedClaims(
        (rejectedPayments ?? []).map((p: { amount: number; installment_id: string | null }) => ({
          amount: Number(p.amount),
          installmentId: p.installment_id ?? null,
        }))
      )

      if (rows.length === 0) { setLoading(false); return }

      const feeIds = rows.map((r) => r.id)

      const [installmentsRes, extrasRes] = await Promise.all([
        supabase.from("fee_installments").select("*").in("fee_id", feeIds),
        supabase.from("fee_extras").select("*").in("fee_id", feeIds),
      ])

      for (const failure of [installmentsRes.error, extrasRes.error]) {
        if (failure) console.error("[fee] schedule lookup failed:", failure.message)
      }

      // Which installments already have an unreviewed claim against them. Without
      // this the student could pay the same installment twice: the second claim
      // would be filed, and verifying both would credit the fee row twice.
      const claimedIds = new Set<string>()

      if (pendingPayments && pendingPayments.length > 0) {
        const { data: claimedRows } = await supabase
          .from("payments")
          .select("installment_id")
          .eq("student_id", student.id)
          .eq("status", AWAITING_VERIFICATION)
          .not("installment_id", "is", null)

        for (const row of claimedRows ?? []) {
          if (row.installment_id) claimedIds.add(row.installment_id as string)
        }
      }

      const { data: settledPayments, error: settledPaymentsError } = await supabase
        .from("payments")
        .select("installment_id, amount")
        .eq("student_id", student.id)
        .eq("status", "Paid")
        .not("installment_id", "is", null)

      if (settledPaymentsError) {
        console.error("[fee] settled payment lookup failed:", settledPaymentsError.message)
        setLoadError("We couldn't load your payment balances. Please refresh the page.")
        setLoading(false)
        return
      }

      const paidByInstallment: Record<string, number> = {}
      for (const payment of settledPayments ?? []) {
        if (!payment.installment_id) continue
        paidByInstallment[payment.installment_id] =
          (paidByInstallment[payment.installment_id] ?? 0) + Number(payment.amount)
      }

      const individualInstallments: Installment[] = (installmentsRes.data ?? [])
        .map((i) => {
          const amount = Number(i.amount)
          const ledgerPaid = paidByInstallment[i.id] ?? 0
          const paidAmount = Math.min(amount, i.status === "Paid" ? Math.max(ledgerPaid, amount) : ledgerPaid)
          const balance = Math.max(0, Number((amount - paidAmount).toFixed(2)))

          return {
            id: i.id as string,
            ids: [i.id as string],
            payableIds: balance > 0 && !claimedIds.has(i.id as string) ? [i.id as string] : [],
            label: i.label,
            amount,
            paidAmount,
            balance,
            payableBalance: balance > 0 && !claimedIds.has(i.id as string) ? balance : 0,
            dueDate: i.due_date,
            paidDate: i.paid_date,
            status: balance === 0 ? "Paid" as const : paidAmount > 0 ? "Partial" as const : "Pending" as const,
            awaitingVerification: claimedIds.has(i.id as string),
          }
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      const groupedInstallments = new Map<string, Installment>()
      for (const installment of individualInstallments) {
        const installmentNumber = installment.label.match(/(\d+)\s*$/)?.[1]
        const groupKey = installmentNumber ? `installment-${installmentNumber}` : installment.label
        const existing = groupedInstallments.get(groupKey)

        if (!existing) {
          groupedInstallments.set(groupKey, {
            ...installment,
            id: groupKey,
            label: installmentNumber ? `Installment ${installmentNumber}` : installment.label,
          })
          continue
        }

        existing.ids.push(...installment.ids)
        existing.payableIds.push(...installment.payableIds)
        existing.amount += installment.amount
        existing.paidAmount += installment.paidAmount
        existing.balance += installment.balance
        existing.payableBalance += installment.payableBalance
        existing.awaitingVerification ||= installment.awaitingVerification
        existing.dueDate = existing.dueDate < installment.dueDate ? existing.dueDate : installment.dueDate
        if (installment.paidDate && (!existing.paidDate || installment.paidDate > existing.paidDate)) {
          existing.paidDate = installment.paidDate
        }
        existing.status = existing.balance === 0 ? "Paid" : existing.paidAmount > 0 ? "Partial" : "Pending"
      }

      const installments = [...groupedInstallments.values()]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.label.localeCompare(b.label))

      const extras: Extra[] = (extrasRes.data ?? []).map((e) => ({
        label: e.label,
        amount: e.amount,
        status: e.status === "Paid" ? "Paid" : "Pending",
      }))

      // Named from the fee rows rather than students.course_slug, which only ever
      // holds the first course of the enrolment.
      const slugs = [...new Set(rows.map((r) => r.course_slug).filter((s): s is string => Boolean(s)))]

      let courseName = "Course"
      if (slugs.length > 0) {
        const { data: courseRows, error: courseError } = await supabase
          .from("courses")
          .select("slug, name")
          .in("slug", slugs)

        if (courseError) {
          console.error("[fee] course lookup failed:", courseError.message)
        } else if (courseRows && courseRows.length > 0) {
          courseName = courseRows.map((c) => c.name).join(", ")
        }
      }

      const totalFee = rows.reduce((sum, r) => sum + Number(r.total_fee), 0)
      const totalPaid = rows.reduce((sum, r) => sum + Number(r.paid_amount), 0)
      const totalPending = rows.reduce((sum, r) => sum + Number(r.pending_amount), 0)
      const schedulesByFee = new Map<string, string[]>()
      for (const installment of installmentsRes.data ?? []) {
        const statuses = schedulesByFee.get(installment.fee_id) ?? []
        statuses.push(installment.status)
        schedulesByFee.set(installment.fee_id, statuses)
      }
      const certifiableCourseSlugs = rows
        .filter((fee) => {
          if (!fee.course_slug || Number(fee.pending_amount) > 0) return false
          const statuses = schedulesByFee.get(fee.id) ?? []
          return statuses.length > 0 && statuses.every((status) => status === "Paid")
        })
        .map((fee) => fee.course_slug as string)

      setFeeDetails({
        course: courseName,
        courseSlugs: slugs,
        certifiableCourseSlugs,
        totalFee,
        paid: totalPaid,
        pending: totalPending,
        installments,
        extras,
      })

      setLoading(false)
    }

    fetchFeeData()
  }, [refreshKey])

  async function openEnrollmentDialog() {
    setEnrollOpen(true)
    setLoadingCourses(true)
    setSelectedCourseSlug("")

    const { data, error } = await supabase
      .from("courses")
      .select("slug, name, fee_numeric")
      .eq("status", "active")
      .order("name")

    if (error) {
      console.error("[fee] available course lookup failed:", error.message)
      toast("We couldn't load available courses. Please try again.", { variant: "destructive" })
      setAvailableCourses([])
    } else {
      const enrolled = new Set(feeDetails.courseSlugs)
      setAvailableCourses(
        (data ?? [])
          .filter((course) => !enrolled.has(course.slug))
          .map((course) => ({ slug: course.slug, name: course.name, fee: Number(course.fee_numeric) || 0 }))
      )
    }

    setLoadingCourses(false)
  }

  async function handleAddCourse() {
    if (enrolling || !selectedCourseSlug) return
    setEnrolling(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/student/enroll-course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseSlug: selectedCourseSlug }),
      })
      const result = (await response.json()) as { error?: string; totalFee?: number }

      if (!response.ok) {
        toast(result.error ?? "We couldn't add that course.", { variant: "destructive" })
        return
      }

      const courseName = availableCourses.find((course) => course.slug === selectedCourseSlug)?.name
      toast(`${courseName ?? "Course"} added. Its installment schedule is ready.`, { variant: "success" })
      setEnrollOpen(false)
      setSelectedCourseSlug("")
      setRefreshKey((key) => key + 1)
    } catch {
      toast("We couldn't add that course. Please try again.", { variant: "destructive" })
    } finally {
      setEnrolling(false)
    }
  }

  const isOverdue = (dueDate: string) => {
    const d = new Date(dueDate)
    return d < new Date()
  }

  /** Outstanding installments a student can still pay, in schedule order. */
  const payableInstallments = feeDetails.installments.filter(
    (i) => i.payableBalance > 0 && !i.awaitingVerification
  )

  /**
   * Refused claims, resolved to installment names. The payment rows only carry
   * the installment id, and the schedule is the sole place that turns it back
   * into something a student recognises — so the lookup lives here, after
   * `feeDetails` is filled, rather than in the fetch.
   *
   * Counted by distinct installment rather than by payment row: someone whose
   * claim was refused twice for the same installment still owes it once.
   */
  const rejectedLabels = [
    ...new Set(
      rejectedClaims
        .map((c) => c.installmentId)
        .filter((id): id is string => Boolean(id))
        .map((id) => feeDetails.installments.find((i) => i.ids.includes(id))?.label)
        .filter((label): label is string => Boolean(label))
    ),
  ]
  const rejectedTotal = rejectedClaims.reduce((sum, c) => sum + c.amount, 0)

  const selectedInstallments = payableInstallments
    .filter((i) => selectedInstallmentKeys.includes(i.id))
  const selectedIds = selectedInstallments.flatMap((i) => i.payableIds)
  const selectedTotal = selectedInstallments
    .reduce((sum, i) => sum + i.payableBalance, 0)
  const allPayableTotal = payableInstallments.reduce((sum, i) => sum + i.payableBalance, 0)
  const displayedPaymentAmount = paymentAmount.trim()
    ? Number(paymentAmount)
    : selectedTotal > 0 ? selectedTotal : allPayableTotal

  const MAX_SELECTED = 3

  function toggleInstallment(key: string) {
    setPaymentAmount("")
    setSelectedInstallmentKeys((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key)
      if (prev.length >= MAX_SELECTED) {
        toast(`You can pay up to ${MAX_SELECTED} installments at a time.`, { variant: "warning" })
        return prev
      }
      return [...prev, key]
    })
  }

  async function handlePay(payAll = false) {
    if (paying || !studentId) return

    if (!payAll && selectedInstallmentKeys.length === 0) {
      toast("Select at least one installment to pay.", { variant: "warning" })
      return
    }

    const availableBalance = payAll ? allPayableTotal : selectedTotal
    const amount = paymentAmount.trim() ? Number(paymentAmount) : availableBalance
    if (!Number.isFinite(amount) || amount <= 0 || amount > availableBalance) {
      toast(`Enter an amount up to ₹${availableBalance.toLocaleString("en-IN")} for this selection.`, { variant: "warning" })
      return
    }

    setPaying(true)

    try {
      // The endpoint verifies the session server-side and resolves the
      // outstanding set itself when payAll is set, rather than trusting a list
      // of ids from the browser.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        setPaying(false)
        return
      }

      const res = await fetch("/api/installments/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          installmentIds: payAll ? undefined : selectedIds,
          payAll,
          amount,
          method,
          reference,
        }),
      })

      const json = (await res.json()) as { error?: string; count?: number; amount?: number }

      if (!res.ok) {
        toast(json.error ?? "We couldn't record your payment. Nothing was charged.", {
          variant: "destructive",
        })
        setPaying(false)
        return
      }

      // The claim is filed, not settled. Say so plainly — the balance only moves
      // once the institute verifies the reference.
      toast(
        `₹${(json.amount ?? 0).toLocaleString("en-IN")} claimed for ${json.count} installment${json.count === 1 ? "" : "s"}. Awaiting verification.`,
        { variant: "success", duration: 6000 }
      )

      setSelectedInstallmentKeys([])
      setReference("")
      setPaymentAmount("")
      setPaid(true)
      setTimeout(() => {
        setPayOpen(false)
        setTimeout(() => {
          setPaid(false)
          setPaying(false)
        }, 300)
      }, 1800)
    } catch {
      setPaying(false)
      toast("We couldn't record your payment. Nothing was charged — please try again.", {
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:px-8 lg:py-10">
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:px-8 lg:py-10">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Fee Details</h1>
          <p className="text-sm lg:text-base text-muted-foreground">{feeDetails.course}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEnrollmentDialog}>
            <Plus className="size-4" />
            Add Course
          </Button>
          <Link href="/student/profile/payments" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">View Payment History</span>
            <span className="sm:hidden">History</span>
          </Link>
          {feeDetails.certifiableCourseSlugs.length > 0 && (
            <Link href="/student/profile/certificates" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
              <Award className="size-4" />
              <span>Request Certificate</span>
            </Link>
          )}
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  className="gap-1.5 px-3 py-2 text-sm h-auto"
                  disabled={feeDetails.pending <= 0}
                />
              }
            >
              <CreditCard className="size-4" />
              Pay Now
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] max-h-[85dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Make a Payment</DialogTitle>
              </DialogHeader>
              {paid ? (
                <div className="py-8 text-center space-y-3">
                  <div className="size-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="size-8 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-emerald-600">Payment submitted!</p>
                  <p className="text-sm text-muted-foreground">
                    Our team will verify your reference and your balance will update.
                  </p>
                </div>
              ) : payableInstallments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {feeDetails.installments.length === 0
                    ? "You have no installment schedule yet."
                    : "Every installment is either paid or already awaiting verification."}
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Choose up to three installment positions</Label>

                    <div className="space-y-2">
                      {payableInstallments.map((inst) => {
                        const checked = selectedInstallmentKeys.includes(inst.id)
                        const atCap = !checked && selectedInstallmentKeys.length >= MAX_SELECTED
                        return (
                          <label
                            key={inst.id}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                              checked
                                ? "border-primary bg-primary/5"
                                : atCap
                                  ? "cursor-not-allowed border-border opacity-50"
                                  : "cursor-pointer border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={atCap}
                                onChange={() => toggleInstallment(inst.id)}
                                className="size-4 accent-primary"
                              />
                              <div>
                                <p className="text-sm font-medium">{inst.label}</p>
                                <p className="text-xs text-muted-foreground">Due {inst.dueDate}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold">
                              ₹{inst.payableBalance.toLocaleString("en-IN")}
                            </p>
                          </label>
                        )
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      You can pay any amount up to the selected balance. It is applied in due-date order.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Custom amount</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={allPayableTotal}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder={`Up to ₹${(selectedTotal || allPayableTotal).toLocaleString("en-IN")}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to pay the full selected balance. With no selection, this amount is applied across all outstanding installments.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pay-reference">UPI reference (optional)</Label>
                    <Input
                      id="pay-reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Enter the transaction ID"
                    />
                    <p className="text-xs text-muted-foreground">
                      This helps us verify your payment faster. We check it by hand.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <div className="space-y-2">
                      {[
                        { value: "upi", label: "UPI" },
                        { value: "cash", label: "Cash" },
                        { value: "bank", label: "Bank Transfer" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="method"
                            value={opt.value}
                            checked={method === opt.value}
                            onChange={(e) => setMethod(e.target.value)}
                            className="accent-primary"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Only for UPI: a QR to scan or a number to read out is
                      meaningless when the student is walking into the institute
                      with cash, or transferring from a bank branch. */}
                  {method === "upi" && (
                    <UpiPayBlock
                      amount={displayedPaymentAmount > 0 ? displayedPaymentAmount : null}
                      note="Pay the amount above, then confirm. Our team verifies the reference before the balance updates."
                    />
                  )}

                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      onClick={() => handlePay(false)}
                      disabled={paying || selectedInstallmentKeys.length === 0 || displayedPaymentAmount > selectedTotal}
                    >
                      {paying ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="size-4" />
                          Pay ₹{displayedPaymentAmount.toLocaleString("en-IN")}
                          {selectedInstallmentKeys.length > 0 && ` (${selectedInstallmentKeys.length})`}
                        </>
                      )}
                    </Button>

                    {payableInstallments.length > MAX_SELECTED && selectedInstallmentKeys.length === 0 && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handlePay(true)}
                        disabled={paying || displayedPaymentAmount > allPayableTotal}
                      >
                        <CheckCircle2 className="size-4" />
                        Pay all outstanding (₹{displayedPaymentAmount.toLocaleString("en-IN")})
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
            <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] max-h-[85dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Enroll in another course</DialogTitle>
                <DialogDescription>
                  Add a course to your student account. Its fee and installment schedule will appear here.
                </DialogDescription>
              </DialogHeader>

              {loadingCourses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableCourses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No additional active courses are available right now.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="additional-course">Course</Label>
                    <select
                      id="additional-course"
                      value={selectedCourseSlug}
                      onChange={(event) => setSelectedCourseSlug(event.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Choose a course</option>
                      {availableCourses.map((course) => (
                        <option key={course.slug} value={course.slug}>
                          {course.name} — ₹{course.fee.toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCourseSlug && (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      {availableCourses.find((course) => course.slug === selectedCourseSlug)?.name} will be added with a three-installment schedule.
                    </p>
                  )}

                  <Button className="w-full gap-2" onClick={handleAddCourse} disabled={enrolling || !selectedCourseSlug}>
                    {enrolling ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                    {enrolling ? "Adding course..." : "Add Course"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Verification */}
      {awaitingVerification && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldQuestion className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {awaitingVerification.count === 1 ? "Payment" : "Payments"} awaiting verification
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                &nbsp;&#8377;{awaitingVerification.amount.toLocaleString("en-IN")} is already with us
                and is counted in the remaining balance below. Our team checks every UPI reference
                by hand. Please wait for it to clear before paying this amount again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refusal — sits above the balance because it explains why an amount the
          student thought was cleared is due again. Without it the installment
          silently becomes payable a second time and reads as a double charge. */}
      {rejectedClaims.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <XCircle className="size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">
                {rejectedClaims.length === 1
                  ? "Payment refused"
                  : `${rejectedClaims.length} payments refused`}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                &nbsp;&#8377;{rejectedTotal.toLocaleString("en-IN")} was not accepted, so no money
                was counted and it is due again. Nothing is owed twice — the installments below can
                be paid again with a reference our team can check.
              </p>
              {rejectedLabels.length > 0 && (
                <p className="mt-1 text-xs sm:text-sm font-medium">{rejectedLabels.join(", ")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      <Card className="bg-linear-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6">
            <div>
              <p className="text-sm lg:text-base text-muted-foreground">Total Fee</p>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">₹{feeDetails.totalFee.toLocaleString()}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm lg:text-base text-muted-foreground">Paid</p>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-emerald-600 tracking-tight">₹{feeDetails.paid.toLocaleString()}</p>
            </div>
          </div>
          <Progress value={paidPct} className="h-2.5 lg:h-3 mb-2" />
          <div className="flex justify-between text-sm lg:text-base">
            <span className="text-muted-foreground">{paidPct}% paid</span>
            <span className="text-amber-600 font-medium">₹{feeDetails.pending.toLocaleString()} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Installments */}
      <Card>
        <CardContent className="p-5 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 lg:mb-6">Installment Schedule</h2>
          <div className="space-y-3">
            {feeDetails.installments.map((inst) => (
              <div
                key={inst.id}
                className={`flex items-center justify-between rounded-xl border p-3 sm:p-4 lg:p-5 ${
                  inst.awaitingVerification ? "border-amber-500/40 bg-amber-500/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {inst.status === "Paid" ? (
                    <CheckCircle2 className="size-5 lg:size-6 text-emerald-600 shrink-0" />
                  ) : inst.status === "Partial" ? (
                    <CheckCircle2 className="size-5 lg:size-6 text-sky-600 shrink-0" />
                  ) : inst.awaitingVerification ? (
                    <ShieldQuestion className="size-5 lg:size-6 text-amber-600 shrink-0" />
                  ) : (
                    <Clock className="size-5 lg:size-6 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-medium truncate">{inst.label}</p>
                    <p className="text-xs lg:text-sm text-muted-foreground truncate">
                      Due: {inst.dueDate}{inst.paidDate ? ` · Last payment: ${inst.paidDate}` : ""}
                    </p>
                    {inst.paidAmount > 0 && inst.balance > 0 && (
                      <p className="text-[11px] lg:text-xs text-muted-foreground mt-0.5">
                        ₹{inst.paidAmount.toLocaleString("en-IN")} paid · ₹{inst.balance.toLocaleString("en-IN")} remaining
                      </p>
                    )}
                    {inst.awaitingVerification && (
                      <p className="text-[11px] lg:text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                        Payment received — awaiting verification
                      </p>
                    )}
                    {!inst.awaitingVerification && inst.status !== "Paid" && isOverdue(inst.dueDate) && (
                      <p className="text-[11px] lg:text-xs text-red-600 font-medium mt-0.5">Overdue</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm lg:text-base font-bold">₹{inst.balance.toLocaleString("en-IN")}</p>
                  {inst.balance < inst.amount && (
                    <p className="text-[10px] text-muted-foreground">of ₹{inst.amount.toLocaleString("en-IN")}</p>
                  )}
                  {inst.awaitingVerification ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] lg:text-xs bg-amber-500/15 text-amber-600"
                    >
                      Awaiting verification
                    </Badge>
                  ) : inst.status !== "Paid" && isOverdue(inst.dueDate) ? (
                    <Badge variant="destructive" className="text-[10px] lg:text-xs">Overdue</Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] lg:text-xs ${
                        inst.status === "Paid"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : inst.status === "Partial"
                            ? "bg-sky-500/15 text-sky-600"
                            : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {inst.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {feeDetails.installments.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No installment schedule yet. Contact the institute to set one up.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extras */}
      <Card>
        <CardContent className="p-5 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 lg:mb-6">Additional Charges</h2>
          <div className="space-y-3">
            {feeDetails.extras.map((extra, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3 sm:p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <p className="text-sm lg:text-base font-medium">{extra.label}</p>
                </div>
                <p className="text-sm lg:text-base font-bold">₹{extra.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm lg:text-base">
              <span className="text-muted-foreground">Extras Total</span>
              <span className="font-bold">₹{extrasTotal.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
