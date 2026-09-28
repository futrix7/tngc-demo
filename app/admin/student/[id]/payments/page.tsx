"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useStudent } from "../layout"

interface Payment {
  id: string
  date: string
  amount: number
  mode: string
  status: "Paid" | "Pending"
  for: string
}

export default function StudentPaymentsPage() {
  const student = useStudent()
  const [payments, setPayments] = useState<Payment[]>([])
  const [totalFee, setTotalFee] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      const { data: feesRows } = await supabase
        .from("fees").select("total_fee, paid_amount").eq("student_id", student!.id)
      if (feesRows && feesRows.length > 0) {
        setTotalFee(feesRows.reduce((s, f) => s + (f.total_fee ?? 0), 0))
        setPaidAmount(feesRows.reduce((s, f) => s + (f.paid_amount ?? 0), 0))
      }

      const { data: paymentRows } = await supabase
        .from("payments").select("id, amount, payment_date, method, status, description")
        .eq("student_id", student!.id).order("payment_date", { ascending: false })

      if (paymentRows) {
        setPayments(paymentRows.map((p) => ({
          id: p.id,
          date: p.payment_date,
          amount: p.amount,
          mode: p.method,
          status: p.status === "Paid" ? "Paid" : "Pending",
          for: p.description ?? "",
        })))
      }
      setLoading(false)
    }
    fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const pendingFee = totalFee - paidAmount

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">₹{paidAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600">₹{pendingFee.toLocaleString()}</p>
          </CardContent>
        </Card>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.for}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.mode}</TableCell>
                  <TableCell className="font-medium">₹{p.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px]", p.status === "Paid" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
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
