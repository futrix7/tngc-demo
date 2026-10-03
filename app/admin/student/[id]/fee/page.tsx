"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Clock, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
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
}

const statusStyles: Record<Installment["status"], string> = {
  Paid: "bg-emerald-500/15 text-emerald-600",
  Partial: "bg-sky-500/15 text-sky-600",
  Pending: "bg-amber-500/15 text-amber-600",
}

export default function StudentFeePage() {
  const student = useStudent()
  const [totalFee, setTotalFee] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchFee = useCallback(async () => {
    if (!student) return
    setLoading(true)
    setError("")

    const { data: feesRows, error: feesError } = await supabase
      .from("fees").select("id, total_fee, course_slug").eq("student_id", student.id)

    if (feesError) {
      console.error("[student fee] fee lookup failed:", feesError.message)
      setError("This student's fee record could not be loaded.")
      setLoading(false)
      return
    }

    const currentFees = feesRows ?? []
    setTotalFee(currentFees.reduce((sum, fee) => sum + Number(fee.total_fee ?? 0), 0))
    setInstallments([])

    if (currentFees.length > 0) {
      const feeIds = currentFees.map((fee) => fee.id)
      const courseSlugs = [...new Set(currentFees.map((fee) => fee.course_slug).filter(Boolean))] as string[]
      const [instResult, coursesResult] = await Promise.all([
        supabase
          .from("fee_installments").select("id, label, amount, due_date, paid_date, status, fee_id")
          .in("fee_id", feeIds).order("due_date", { ascending: true }),
        courseSlugs.length
          ? supabase.from("courses").select("slug, name").in("slug", courseSlugs)
          : Promise.resolve({ data: [] as { slug: string; name: string }[], error: null }),
      ])

      if (instResult.error || coursesResult.error) {
        const lookupError = instResult.error ?? coursesResult.error
        console.error("[student fee] schedule lookup failed:", lookupError?.message)
        setError("This student's installment schedule could not be loaded.")
        setLoading(false)
        return
      }

      const instRows = instResult.data ?? []

      // Derived from the ledger rather than read off the stored status, so a part
      // payment shows as `Partial` with the real figure still owing. The stored
      // `Partial` used to be collapsed into `Pending` here, which reported the
      // full installment as unpaid and hid every part payment this student had
      // ever made.
      const { data: payRows, error: paymentsError } = await supabase
        .from("payments")
        .select("installment_id, amount, status")
        .eq("student_id", student.id)
        .eq("status", "Paid")

      if (paymentsError) {
        console.error("[student fee] payment lookup failed:", paymentsError.message)
        setError("This student's payment totals could not be loaded.")
        setLoading(false)
        return
      }

      const paidBy: Record<string, number> = {}
      for (const payment of payRows ?? []) {
        if (!payment.installment_id) continue
        paidBy[payment.installment_id] = (paidBy[payment.installment_id] ?? 0) + Number(payment.amount)
      }
      setPaidAmount((payRows ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0))

      const slugByFee = new Map(feesRows.map((f) => [f.id, f.course_slug]))
      const nameBySlug = new Map((coursesResult.data ?? []).map((c) => [c.slug, c.name]))

      setInstallments(instRows.map((row) => {
        const amount = Number(row.amount)
        const linePaid = Math.min(amount, paidBy[row.id] ?? 0)
        const slug = slugByFee.get(row.fee_id) ?? ""
        return {
          id: row.id,
          label: row.label,
          course: nameBySlug.get(slug) ?? slug ?? "Course",
          amount,
          paidAmount: linePaid,
          balance: Math.max(0, Number((amount - linePaid).toFixed(2))),
          dueDate: row.due_date,
          paidDate: row.paid_date,
          status: linePaid >= amount ? "Paid" : linePaid > 0 ? "Partial" : "Pending",
        }
      }))
    } else {
      setPaidAmount(0)
    }

    setLoading(false)
  }, [student])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchFee()
  }, [fetchFee])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const pendingFee = totalFee - paidAmount
  const paidPct = totalFee > 0 ? Math.round((paidAmount / totalFee) * 100) : 0

  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  // Grouped by course so a student on two courses does not see one undifferentiated
  // list of "Installment 1 of 4" rows belonging to different fees.
  const grouped = installments.reduce<Record<string, Installment[]>>((acc, inst) => {
    ;(acc[inst.course] ??= []).push(inst)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      {totalFee === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No fees have been recorded for this student yet. Add a course from the profile header to start fee and payment tracking.
          </CardContent>
        </Card>
      )}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Fee</p>
              <p className="text-2xl sm:text-3xl font-bold">₹{totalFee.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-muted-foreground">Paid</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">₹{paidAmount.toLocaleString()}</p>
            </div>
          </div>
          <Progress value={paidPct} className="h-2 sm:h-2.5 mb-1.5 sm:mb-2" />
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">{paidPct}% paid</span>
            <span className="text-amber-600 font-medium">₹{pendingFee.toLocaleString()} remaining</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Installment Schedule</h3>
          <div className="space-y-5">
            {Object.entries(grouped).map(([course, rows]) => (
              <div key={course} className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{course}</p>
                {rows.map((inst) => {
                  const overdue = inst.balance > 0 && inst.dueDate < todayIso
                  return (
                    <div key={inst.id} className="flex flex-col gap-3 rounded-lg border border-border p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        {inst.status === "Paid" ? (
                          <CheckCircle2 className="size-4 sm:size-5 text-emerald-600 shrink-0" />
                        ) : overdue ? (
                          <AlertTriangle className="size-4 sm:size-5 text-red-600 shrink-0" />
                        ) : (
                          <Clock className="size-4 sm:size-5 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-medium sm:text-sm">{inst.label}</p>
                          <p className="break-words text-[11px] text-muted-foreground">
                            Due: {inst.dueDate}{inst.paidDate ? ` · Paid: ${inst.paidDate}` : ""}
                            {overdue ? " · Overdue" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:ml-3 sm:justify-end">
                        {/* The figure owed, not the figure scheduled. On a partly
                            paid line these differ, and showing the scheduled one
                            was how a part payment came to look unpaid. */}
                        <div className="text-right">
                          <p className="text-xs font-bold sm:text-sm">
                            ₹{(inst.balance > 0 ? inst.balance : inst.amount).toLocaleString()}
                          </p>
                          {inst.balance > 0 && inst.paidAmount > 0 && (
                            <p className="text-[11px] text-muted-foreground">of ₹{inst.amount.toLocaleString()}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className={cn("shrink-0 text-[10px]", statusStyles[inst.status])}>
                          {inst.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {installments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No installment data available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
