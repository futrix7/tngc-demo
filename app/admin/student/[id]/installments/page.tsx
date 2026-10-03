"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  IndianRupee,
  CheckCircle2,
  Clock,
  Loader2,
  Banknote,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { supabase } from "@/lib/supabase"
import { localDate } from "@/lib/local-date"
import { useToast } from "@/components/ui/sonner"
import { useStudent } from "../layout"

interface Installment {
  id: string
  label: string
  course: string
  amount: number
  paidAmount: number
  balance: number
  remainingBalance: number
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending" | "Partial"
  feeId: string
  pendingPaymentIds: string[]
  pendingClaimAmount: number
  pendingReference: string
  availableToSplit: number
}

interface CollectionRecord {
  id: string
  installmentLabel: string
  amount: number
  collectedDate: string
  method: string
}

const statusStyles: Record<Installment["status"], string> = {
  Paid: "bg-emerald-500/15 text-emerald-600",
  Partial: "bg-sky-500/15 text-sky-600",
  Pending: "bg-amber-500/15 text-amber-600",
}

export default function StudentInstallmentsPage() {
  const student = useStudent()
  const { toast } = useToast()
  const [installments, setInstallments] = useState<Installment[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [totalFee, setTotalFee] = useState(0)
  const [collected, setCollected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [unmarkingId, setUnmarkingId] = useState<string | null>(null)
  const [addInstallmentOpen, setAddInstallmentOpen] = useState(false)
  const [installmentDialogMode, setInstallmentDialogMode] = useState<"add" | "collect-all">("add")
  const [collectAllMethod, setCollectAllMethod] = useState("cash")
  const [collectAllReference, setCollectAllReference] = useState("")
  const [collectingAll, setCollectingAll] = useState(false)
  const [sourceInstallmentId, setSourceInstallmentId] = useState("")
  const [newInstallmentLabel, setNewInstallmentLabel] = useState("Additional installment")
  const [newInstallmentAmount, setNewInstallmentAmount] = useState("")
  const [newInstallmentDueDate, setNewInstallmentDueDate] = useState(localDate())
  const [addingInstallment, setAddingInstallment] = useState(false)

  const fetchData = useCallback(async () => {
    if (!student) return

    setLoading(true)
    setLoadError("")

    const { data: feesRows, error: feesError } = await supabase
      .from("fees").select("id, total_fee, course_slug").eq("student_id", student.id)

    if (feesError) {
      console.error("[student installments] fee lookup failed:", feesError.message)
      setLoadError("This student's fee schedule could not be loaded.")
      setLoading(false)
      return
    }

    const currentFees = feesRows ?? []
    const fTotal = currentFees.reduce((sum, fee) => sum + Number(fee.total_fee ?? 0), 0)
    setTotalFee(fTotal)

    if (currentFees.length > 0) {
      const feeIds = currentFees.map((fee) => fee.id)
      const courseSlugs = [...new Set(currentFees.map((fee) => fee.course_slug).filter(Boolean))] as string[]

      const [instResult, coursesResult] = await Promise.all([
        supabase
          .from("fee_installments").select("id, label, amount, due_date, paid_date, status, fee_id")
          .in("fee_id", feeIds).order("due_date", { ascending: true }),
        courseSlugs.length
          ? supabase.from("courses").select("slug, name, short_name").in("slug", courseSlugs)
          : Promise.resolve({ data: [] as { slug: string; name: string; short_name: string }[], error: null }),
      ])

      if (instResult.error || coursesResult.error) {
        const error = instResult.error ?? coursesResult.error
        console.error("[student installments] schedule lookup failed:", error?.message)
        setLoadError("This student's installment schedule could not be loaded.")
        setInstallments([])
        setLoading(false)
        return
      }

      const instRows = instResult.data ?? []

      // The progress shown on each line is computed from the ledger, not read off
      // fee_installments.status. A part payment lands on the installment as
      // `Partial`, and the stored `Pending` used to be collapsed into "nothing
      // paid" here — so a student who had handed over ₹2,000 of ₹6,000 was shown
      // a full ₹6,000 still owed.
      const { data: payRows, error: installmentPaymentsError } = instRows.length
        ? await supabase
          .from("payments")
          .select("id, installment_id, amount, status, description")
          .in("installment_id", instRows.map((row) => row.id))
          .in("status", ["Paid", "Pending"])
        : { data: [] as { id: string; installment_id: string | null; amount: number; status: string; description: string | null }[] }

      if (installmentPaymentsError) {
        console.error("[student installments] installment payment lookup failed:", installmentPaymentsError.message)
        setLoadError("This student's installment payment details could not be loaded.")
        setLoading(false)
        return
      }

      const { data: historyRows, error: historyError } = await supabase
        .from("payments")
        .select("id, amount, payment_date, method, description")
        .eq("student_id", student.id)
        .eq("status", "Paid")
        .order("payment_date", { ascending: false })

      if (historyError) {
        console.error("[student installments] payment lookup failed:", historyError.message)
        setLoadError("This student's payment totals could not be loaded.")
        setLoading(false)
        return
      }

      setCollected((historyRows ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0))
      setCollections((historyRows ?? []).map((payment) => ({
        id: payment.id,
        installmentLabel: payment.description ?? "Fee Payment",
        amount: payment.amount,
        collectedDate: payment.payment_date,
        method: payment.method,
      })))

      const paidBy: Record<string, number> = {}
      const claimedBy: Record<string, { amount: number; ids: string[]; reference: string }> = {}
      for (const payment of payRows ?? []) {
        const key = payment.installment_id
        if (!key) continue
        if (payment.status === "Paid") {
          paidBy[key] = (paidBy[key] ?? 0) + Number(payment.amount)
        } else {
          const claim = claimedBy[key] ?? { amount: 0, ids: [], reference: "" }
          claim.amount += Number(payment.amount)
          claim.ids.push(payment.id)
          claim.reference = claim.reference || payment.description || ""
          claimedBy[key] = claim
        }
      }

      const slugByFee = new Map(currentFees.map((fee) => [fee.id, fee.course_slug]))
      const nameBySlug = new Map((coursesResult.data ?? []).map((c) => [c.slug, c.short_name || c.name]))

      setInstallments(instRows.map((row) => {
        const amount = Number(row.amount)
        const paidAmount = Math.min(amount, paidBy[row.id] ?? 0)
        const claim = claimedBy[row.id]
        return {
          id: row.id,
          label: row.label,
          course: nameBySlug.get(slugByFee.get(row.fee_id) ?? "") ?? slugByFee.get(row.fee_id) ?? "Course",
          amount,
          paidAmount,
          balance: Math.max(0, Number((amount - paidAmount).toFixed(2))),
          remainingBalance: Math.max(
            0,
            Number((amount - paidAmount - Math.min(amount - paidAmount, claim?.amount ?? 0)).toFixed(2))
          ),
          dueDate: row.due_date,
          paidDate: row.paid_date,
          status: paidAmount >= amount ? "Paid" : paidAmount > 0 ? "Partial" : "Pending",
          feeId: row.fee_id,
          pendingPaymentIds: claim?.ids ?? [],
          pendingClaimAmount: claim?.amount ?? 0,
          pendingReference: claim?.reference ?? "",
          availableToSplit: claim?.ids.length
            ? 0
            : Math.max(0, Number((amount - paidAmount).toFixed(2))),
        }
      }))
    }

    if (currentFees.length === 0) {
      setCollected(0)
      setInstallments([])
      setCollections([])
    }

    setLoading(false)
  }, [student])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchData()
  }, [fetchData])

  /**
   * A student's own claim, confirmed or refused.
   *
   * This screen had no way to act on a claim at all: the student filed one from
   * their own fee page, it sat as `Pending`, and the only place it could be
   * approved was the institute-wide installments list. Approving moves the money
   * onto the fee balance and flips the schedule line, so the counter and the
   * detail view have to agree.
   */
  async function handleReview(inst: Installment, approve: boolean) {
    if (inst.pendingPaymentIds.length === 0 || reviewingId) return
    setReviewingId(inst.id)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const res = await fetch("/api/installments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentIds: inst.pendingPaymentIds, approve }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; amount?: number }

      if (!res.ok) {
        toast(json.error ?? "We couldn't record that decision. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      if (approve) {
        toast(`Confirmed ₹${Number(json.amount ?? inst.pendingClaimAmount).toLocaleString("en-IN")} claimed against ${inst.label}.`, { variant: "success" })
      } else {
        toast(`Claim of ₹${inst.pendingClaimAmount.toLocaleString("en-IN")} against ${inst.label} was rejected. It can be paid again.`, { variant: "success" })
      }
      setLoading(true)
      fetchData()
    } catch {
      toast("We couldn't record that decision. Nothing was changed — please try again.", {
        variant: "destructive",
      })
    } finally {
      setReviewingId(null)
    }
  }

  async function handleUnmark(inst: Installment) {
    if (unmarkingId) return
    setUnmarkingId(inst.id)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const res = await fetch("/api/installments/unmark", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ installmentId: inst.id, reason: "Reversed from the student's installments" }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast(json.error ?? "We couldn't reverse that installment. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      toast(`₹${inst.paidAmount.toLocaleString("en-IN")} reversed on ${inst.label} and added back to the balance.`, {
        variant: "success",
      })
      setLoading(true)
      fetchData()
    } catch {
      toast("We couldn't reverse that installment. Nothing was changed — please try again.", {
        variant: "destructive",
      })
    } finally {
      setUnmarkingId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const open = installments.filter((i) => i.balance > 0)
  const overdue = open.filter((i) => i.remainingBalance > 0 && i.dueDate < todayIso)
  const paid = installments.filter((i) => i.balance === 0)
  const awaiting = installments.filter((i) => i.pendingPaymentIds.length > 0)
  const awaitingAmount = installments.reduce((sum, installment) => sum + installment.pendingClaimAmount, 0)
  const pendingAmount = Math.max(0, totalFee - collected - awaitingAmount)
  const collectAllAmount = Number(
    installments.reduce((sum, installment) => sum + installment.availableToSplit, 0).toFixed(2)
  )
  const hasFractionalCollectibleBalance = open.some(
    (installment) => installment.availableToSplit > 0 && !Number.isInteger(installment.availableToSplit)
  )

  const grouped = open.reduce<Record<string, Installment[]>>((acc, inst) => {
    ;(acc[inst.course] ??= []).push(inst)
    return acc
  }, {})
  const splitSources = open.filter((inst) => inst.availableToSplit > 0)
  const selectedSplitSource = splitSources.find((inst) => inst.id === sourceInstallmentId)
  const splitAmountValue = Number(newInstallmentAmount)
  const splitAmountError = newInstallmentAmount.trim() === ""
    ? "Enter the amount to move into the new installment."
    : !Number.isFinite(splitAmountValue) || splitAmountValue <= 0
      ? "Enter an amount greater than zero."
      : Math.abs(splitAmountValue * 100 - Math.round(splitAmountValue * 100)) > 0.0001
        ? "Use no more than two decimal places."
        : selectedSplitSource && splitAmountValue >= selectedSplitSource.availableToSplit
          ? `The amount must be less than ₹${selectedSplitSource.availableToSplit.toLocaleString("en-IN")} so the source installment remains open.`
          : null

  function openAddInstallment() {
    const firstSource = splitSources[0]
    if (!firstSource) return
    setInstallmentDialogMode("add")
    setSourceInstallmentId(firstSource.id)
    setNewInstallmentLabel("Additional installment")
    setNewInstallmentAmount("")
    setNewInstallmentDueDate(localDate())
    setAddInstallmentOpen(true)
  }

  async function handleAddInstallment() {
    if (!student || !selectedSplitSource || addingInstallment || splitAmountError) return
    setAddingInstallment(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/add-installment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: student.id,
          feeId: selectedSplitSource.feeId,
          sourceInstallmentId: selectedSplitSource.id,
          label: newInstallmentLabel.trim(),
          amount: Number(splitAmountValue.toFixed(2)),
          dueDate: newInstallmentDueDate,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string; label?: string }
      if (!response.ok) {
        toast(result.error ?? "We couldn't add that installment. Nothing was changed.", { variant: "destructive" })
        return
      }

      toast(`${result.label ?? newInstallmentLabel} added to ${selectedSplitSource.course}. The course fee total is unchanged.`, {
        variant: "success",
      })
      setAddInstallmentOpen(false)
      await fetchData()
    } catch (error) {
      console.error("[student installments] add installment failed:", error)
      toast("We couldn't add that installment. Nothing was changed.", { variant: "destructive" })
    } finally {
      setAddingInstallment(false)
    }
  }

  async function handleCollectAll() {
    if (!student || collectingAll || collectAllAmount <= 0) return
    setCollectingAll(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/installments/collect-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: student.id,
          method: collectAllMethod,
          reference: collectAllReference.trim(),
        }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        amount?: number
        count?: number
      }

      if (!response.ok) {
        toast(result.error ?? "We couldn't collect the outstanding fees. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      toast(
        `Collected ₹${Number(result.amount ?? collectAllAmount).toLocaleString("en-IN")} across ${result.count ?? 0} installment${result.count === 1 ? "" : "s"}.`,
        { variant: "success" }
      )
      setAddInstallmentOpen(false)
      setCollectAllReference("")
      await fetchData()
    } catch (error) {
      console.error("[student installments] collect all failed:", error)
      toast("We couldn't collect the outstanding fees. Nothing was changed — please try again.", {
        variant: "destructive",
        duration: 10000,
      })
    } finally {
      setCollectingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 min-[420px]:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <IndianRupee className="size-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">₹{totalFee.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Fee</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 text-center">
            <Banknote className="size-6 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">₹{collected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Collected</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 text-center">
            <Clock className="size-6 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">₹{pendingAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Outstanding{overdue.length > 0 && ` · ${overdue.length} overdue`}
            </p>
          </CardContent>
        </Card>
      </div>
      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      {/* Claims the student filed that are still waiting on the institute */}
      {awaiting.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold">Claims awaiting confirmation</h3>
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs">
                {awaiting.length}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              The student says this money has already been sent. Confirm it only once the money has
              actually reached the institute; rejecting it makes the amount payable again.
            </p>
            <div className="space-y-2.5">
              {awaiting.map((inst) => (
                <div key={inst.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-medium sm:text-sm">{inst.label} · {inst.course}</p>
                    <p className="break-words text-[11px] text-muted-foreground">
                      Claimed ₹{inst.pendingClaimAmount.toLocaleString("en-IN")}
                      {inst.pendingReference && ` · ${inst.pendingReference}`}
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 gap-2 border-emerald-600/30 text-sm text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
                      onClick={() => handleReview(inst, true)}
                      disabled={reviewingId !== null}
                    >
                      {reviewingId === inst.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 gap-2 text-sm"
                      onClick={() => handleReview(inst, false)}
                      disabled={reviewingId !== null}
                    >
                      <AlertTriangle className="size-4 text-destructive" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding schedule, grouped by course */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Outstanding Installments</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">{open.length}</Badge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openAddInstallment}
                disabled={splitSources.length === 0}
              >
                <Plus className="size-4" />
                Add installment
              </Button>
            </div>
          </div>
          {student?.isLegacyImport && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <p>
                The CSV course is historical only. Use <span className="font-medium">Add Course</span> to create
                an active fee schedule, then use <span className="font-medium">Add installment</span> here for extra installments.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {Object.entries(grouped).map(([course, rows]) => (
              <div key={course} className="space-y-2.5">
                <p className="break-words text-xs font-semibold uppercase tracking-wide text-muted-foreground">{course}</p>
                {rows.map((inst) => {
                  const isOverdue = inst.dueDate < todayIso
                  return (
                    <div key={inst.id} className={cn(
                      "flex min-w-0 flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                      isOverdue
                        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isOverdue
                          ? <AlertTriangle className="size-4 sm:size-5 text-red-600 shrink-0" />
                          : <Clock className="size-4 sm:size-5 text-amber-600 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-medium sm:text-sm">{inst.label}</p>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="size-3" />
                            Due: {inst.dueDate}
                            {isOverdue && <span className="ml-1 font-medium text-red-600">Overdue</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                        <div className="text-right">
                          <p className="text-sm font-bold">₹{inst.remainingBalance.toLocaleString()} still due</p>
                          {(inst.paidAmount > 0 || inst.pendingClaimAmount > 0) && (
                            <p className="text-[11px] text-muted-foreground">
                              ₹{inst.paidAmount.toLocaleString()} paid
                              {inst.pendingClaimAmount > 0 &&
                                ` · ₹${inst.pendingClaimAmount.toLocaleString()} awaiting verification`}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className={cn("text-[10px]", statusStyles[inst.status])}>
                          {inst.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {open.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">All installments are paid!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paid Installments */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Paid Installments</h3>
            <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-600">{paid.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {paid.map((inst) => (
              <div key={inst.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CheckCircle2 className="size-4 sm:size-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-xs font-medium sm:text-sm">{inst.label} · {inst.course}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Paid: {inst.paidDate ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                  <p className="text-sm font-bold">₹{inst.amount.toLocaleString()}</p>
                  {/* A part payment leaves a line on `Partial`, so the reverse
                      action has to be offered there too — not only on lines the
                      institute has fully settled. */}
                  {inst.paidAmount > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleUnmark(inst)}
                      disabled={unmarkingId !== null}
                      title="Reverse verified payments on this line"
                    >
                      {unmarkingId === inst.id
                        ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        : <RotateCcw className="size-4 text-amber-600" />}
                    </Button>
                  )}
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-600">Paid</Badge>
                </div>
              </div>
            ))}
            {paid.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No paid installments yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Collection History */}
      {collections.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 sm:p-5 pb-0">
              <h3 className="text-sm font-semibold">Collection History</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>For</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-xs">
                      {c.installmentLabel}
                      <span className="mt-1 block break-words text-[11px] font-normal text-muted-foreground sm:hidden">
                        {c.collectedDate || "Date unavailable"} · {c.method || "Method unavailable"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{c.collectedDate}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{c.method}</TableCell>
                    <TableCell className="font-medium text-xs">₹{c.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={addInstallmentOpen}
        onOpenChange={(open) => {
          if (!addingInstallment && !collectingAll) setAddInstallmentOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {installmentDialogMode === "add" ? "Add an installment" : "Pay all outstanding"}
            </DialogTitle>
            <DialogDescription>
              {installmentDialogMode === "add"
                ? "Split part of an unpaid schedule line into a new due date. This does not change the course fee total; verified payments and pending student claims stay assigned to the original line."
                : "Collect all currently payable balances across this student’s courses in one transaction. Claims awaiting review are excluded."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={installmentDialogMode === "add" ? "secondary" : "ghost"}
              onClick={() => setInstallmentDialogMode("add")}
              disabled={collectingAll || addingInstallment}
            >
              Add installment
            </Button>
            <Button
              type="button"
              size="sm"
              variant={installmentDialogMode === "collect-all" ? "secondary" : "ghost"}
              onClick={() => setInstallmentDialogMode("collect-all")}
              disabled={collectingAll || addingInstallment || collectAllAmount <= 0}
            >
              <Banknote className="size-4" />
              Pay all outstanding
            </Button>
          </div>

          {installmentDialogMode === "add" ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="splitSource">Split from</Label>
                  <Select value={sourceInstallmentId} onValueChange={(value) => setSourceInstallmentId(value ?? "")}>
                    <SelectTrigger id="splitSource">
                      <SelectValue placeholder="Choose an outstanding installment" />
                    </SelectTrigger>
                    <SelectContent>
                      {splitSources.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.course} · {inst.label} · available ₹{inst.availableToSplit.toLocaleString("en-IN")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newInstallmentLabel">New installment label</Label>
                  <Input
                    id="newInstallmentLabel"
                    maxLength={100}
                    value={newInstallmentLabel}
                    onChange={(event) => setNewInstallmentLabel(event.target.value)}
                    placeholder="e.g. Installment 4"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newInstallmentAmount">Amount to split</Label>
                    <Input
                      id="newInstallmentAmount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      max={selectedSplitSource ? selectedSplitSource.availableToSplit : undefined}
                      value={newInstallmentAmount}
                      onChange={(event) => setNewInstallmentAmount(event.target.value)}
                      aria-invalid={Boolean(splitAmountError)}
                    />
                    {splitAmountError && <p className="text-xs text-destructive">{splitAmountError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newInstallmentDueDate">New due date</Label>
                    <Input
                      id="newInstallmentDueDate"
                      type="date"
                      value={newInstallmentDueDate}
                      onChange={(event) => setNewInstallmentDueDate(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddInstallmentOpen(false)} disabled={addingInstallment}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleAddInstallment()}
                  disabled={
                    addingInstallment
                    || !selectedSplitSource
                    || !newInstallmentLabel.trim()
                    || !newInstallmentDueDate
                    || Boolean(splitAmountError)
                  }
                >
                  {addingInstallment ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                  {addingInstallment ? "Adding..." : "Add installment"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total to collect</p>
                  <p className="mt-1 text-2xl font-bold">₹{collectAllAmount.toLocaleString("en-IN")}</p>
                </div>
                {hasFractionalCollectibleBalance && (
                  <p className="text-sm text-destructive">
                    One or more outstanding balances include paise. Payments must be whole rupees, so
                    settle those balances individually after adjusting the schedule.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="collectAllMethod">Payment method</Label>
                  <Select value={collectAllMethod} onValueChange={(value) => setCollectAllMethod(value ?? "cash")}>
                    <SelectTrigger id="collectAllMethod">
                      <SelectValue placeholder="Choose a payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectAllReference">Reference / note (optional)</Label>
                  <Input
                    id="collectAllReference"
                    maxLength={200}
                    value={collectAllReference}
                    onChange={(event) => setCollectAllReference(event.target.value)}
                    placeholder="Receipt or transaction reference"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddInstallmentOpen(false)}
                  disabled={collectingAll}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCollectAll}
                  disabled={collectingAll || collectAllAmount <= 0 || hasFractionalCollectibleBalance}
                >
                  {collectingAll ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                  {collectingAll ? "Collecting..." : "Confirm collection"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
