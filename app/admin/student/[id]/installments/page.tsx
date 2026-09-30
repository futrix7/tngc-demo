"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"
import { cn } from "@/lib/utils"

import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { CollectDialog, type CollectibleInstallment } from "@/components/admin/collect-dialog"
import { useStudent } from "../layout"

interface Installment {
  id: string
  label: string
  course: string
  amount: number
  paidAmount: number
  balance: number
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending" | "Partial"
  feeId: string
  pendingPaymentIds: string[]
  pendingClaimAmount: number
  pendingReference: string
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

  const [collecting, setCollecting] = useState<CollectibleInstallment | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [unmarkingId, setUnmarkingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!student) return

    setLoading(true)

    const { data: feesRows } = await supabase
      .from("fees").select("id, total_fee, paid_amount, course_slug").eq("student_id", student.id)

    if (feesRows && feesRows.length > 0) {
      const fTotal = feesRows.reduce((s, f) => s + (f.total_fee ?? 0), 0)
      const fPaid = feesRows.reduce((s, f) => s + (f.paid_amount ?? 0), 0)
      setTotalFee(fTotal)
      setCollected(fPaid)

      const feeIds = feesRows.map((f) => f.id)
      const courseSlugs = [...new Set(feesRows.map((f) => f.course_slug).filter(Boolean))] as string[]

      const [instResult, coursesResult] = await Promise.all([
        supabase
          .from("fee_installments").select("id, label, amount, due_date, paid_date, status, fee_id")
          .in("fee_id", feeIds).order("due_date", { ascending: true }),
        courseSlugs.length
          ? supabase.from("courses").select("slug, name").in("slug", courseSlugs)
          : Promise.resolve({ data: [] as { slug: string; name: string }[], error: null }),
      ])

      const instRows = instResult.data ?? []

      // The progress shown on each line is computed from the ledger, not read off
      // fee_installments.status. A part payment lands on the installment as
      // `Partial`, and the stored `Pending` used to be collapsed into "nothing
      // paid" here — so a student who had handed over ₹2,000 of ₹6,000 was shown
      // a full ₹6,000 still owed.
      const { data: payRows } = instRows.length
        ? await supabase
          .from("payments")
          .select("id, installment_id, amount, status, description")
          .in("installment_id", instRows.map((row) => row.id))
          .in("status", ["Paid", "Pending"])
        : { data: [] as { id: string; installment_id: string | null; amount: number; status: string; description: string | null }[] }

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

      const slugByFee = new Map(feesRows.map((f) => [f.id, f.course_slug]))
      const nameBySlug = new Map((coursesResult.data ?? []).map((c) => [c.slug, c.name]))

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
          dueDate: row.due_date,
          paidDate: row.paid_date,
          status: paidAmount >= amount ? "Paid" : paidAmount > 0 ? "Partial" : "Pending",
          feeId: row.fee_id,
          pendingPaymentIds: claim?.ids ?? [],
          pendingClaimAmount: claim?.amount ?? 0,
          pendingReference: claim?.reference ?? "",
        }
      }))
    }

    const { data: historyRows } = await supabase
      .from("payments").select("id, amount, payment_date, method, description")
      .eq("student_id", student.id)
      .eq("status", "Paid")
      .order("payment_date", { ascending: false })

    if (historyRows) {
      setCollections(historyRows.map((p) => ({
        id: p.id,
        installmentLabel: p.description ?? "Fee Payment",
        amount: p.amount,
        collectedDate: p.payment_date,
        method: p.method,
      })))
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
  const overdue = open.filter((i) => i.dueDate < todayIso)
  const paid = installments.filter((i) => i.balance === 0)
  const awaiting = installments.filter((i) => i.pendingPaymentIds.length > 0)
  const pendingAmount = totalFee - collected

  const grouped = open.reduce<Record<string, Installment[]>>((acc, inst) => {
    ;(acc[inst.course] ??= []).push(inst)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
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

      {/* Claims the student filed that are still waiting on the institute */}
      {awaiting.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
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
                <div key={inst.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{inst.label} · {inst.course}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Claimed ₹{inst.pendingClaimAmount.toLocaleString("en-IN")}
                      {inst.pendingReference && ` · ${inst.pendingReference}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Outstanding Installments</h3>
            <Badge variant="secondary" className="text-xs">{open.length}</Badge>
          </div>
          <div className="space-y-4">
            {Object.entries(grouped).map(([course, rows]) => (
              <div key={course} className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{course}</p>
                {rows.map((inst) => {
                  const isOverdue = inst.dueDate < todayIso
                  return (
                    <div key={inst.id} className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
                      isOverdue
                        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isOverdue
                          ? <AlertTriangle className="size-4 sm:size-5 text-red-600 shrink-0" />
                          : <Clock className="size-4 sm:size-5 text-amber-600 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate">{inst.label}</p>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="size-3" />
                            Due: {inst.dueDate}
                            {isOverdue && <span className="ml-1 font-medium text-red-600">Overdue</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="text-right">
                          <p className="text-sm font-bold">₹{inst.balance.toLocaleString()}</p>
                          {inst.paidAmount > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              of ₹{inst.amount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className={cn("text-[10px]", statusStyles[inst.status])}>
                          {inst.status}
                        </Badge>
                        <Button
                          size="lg"
                          className="gap-1.5 px-4"
                          onClick={() => setCollecting({
                            id: inst.id,
                            student: student?.name,
                            label: inst.label,
                            title: inst.course,
                            amount: inst.amount,
                            balance: inst.balance,
                            settleAll: true,
                          })}
                        >
                          <Banknote className="size-4" />
                          Collect
                        </Button>
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Paid Installments</h3>
            <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-600">{paid.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {paid.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CheckCircle2 className="size-4 sm:size-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{inst.label} · {inst.course}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Paid: {inst.paidDate ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
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
                    <TableCell className="font-medium text-xs">{c.installmentLabel}</TableCell>
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

      <CollectDialog
        installment={collecting}
        onOpenChange={(open) => { if (!open) setCollecting(null) }}
        onCollected={() => { setLoading(true); fetchData() }}
      />
    </div>
  )
}
