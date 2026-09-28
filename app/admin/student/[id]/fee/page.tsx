"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useStudent } from "../layout"

interface Installment {
  label: string
  amount: number
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending"
}

export default function StudentFeePage() {
  const student = useStudent()
  const [totalFee, setTotalFee] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      const { data: feesRows } = await supabase
        .from("fees").select("id, total_fee, paid_amount").eq("student_id", student!.id)

      if (feesRows && feesRows.length > 0) {
        const fTotal = feesRows.reduce((sum, f) => sum + (f.total_fee ?? 0), 0)
        const fPaid = feesRows.reduce((sum, f) => sum + (f.paid_amount ?? 0), 0)
        setTotalFee(fTotal)
        setPaidAmount(fPaid)

        const feeIds = feesRows.map((f) => f.id)
        const { data: instRows } = await supabase
          .from("fee_installments").select("label, amount, due_date, paid_date, status")
          .in("fee_id", feeIds).order("due_date", { ascending: true })

        if (instRows) {
          setInstallments(instRows.map((i) => ({
            label: i.label,
            amount: i.amount,
            dueDate: i.due_date,
            paidDate: i.paid_date,
            status: i.status === "Paid" ? "Paid" : "Pending",
          })))
        }
      }
      setLoading(false)
    }
    fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const pendingFee = totalFee - paidAmount
  const paidPct = totalFee > 0 ? Math.round((paidAmount / totalFee) * 100) : 0

  return (
    <div className="space-y-4">
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
          <div className="space-y-2.5">
            {installments.map((inst, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2.5 sm:p-3">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  {inst.status === "Paid" ? (
                    <CheckCircle2 className="size-4 sm:size-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="size-4 sm:size-5 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{inst.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Due: {inst.dueDate}{inst.paidDate ? ` · Paid: ${inst.paidDate}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs sm:text-sm font-bold">₹{inst.amount.toLocaleString()}</p>
                  <Badge variant="secondary" className={cn("text-[10px]", inst.status === "Paid" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                    {inst.status}
                  </Badge>
                </div>
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
