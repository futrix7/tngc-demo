"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsTrigger, TabsList } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Download, Search, CreditCard, ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { paymentStatusLabel } from "@/lib/payment-status"
import { UpiPayBlock } from "@/components/student/upi-pay-block"
import { Loader2 } from "lucide-react"

interface Payment {
  id: string
  date: string
  amount: number
  mode: string
  status: "Paid" | "Pending" | "Overdue" | "Rejected"
  for: string
  receiptNo: string
}

const statusConfig: Record<string, string> = {
  Paid: "bg-emerald-500/15 text-emerald-600",
  Pending: "bg-amber-500/15 text-amber-600",
  Overdue: "bg-red-500/15 text-red-600",
  // Muted: a refused or reversed claim is not an outstanding debt, it is simply
  // not money received. Red here would read as a warning the student must clear,
  // when what they need to do is pay the installment again.
  Rejected: "bg-muted text-muted-foreground",
}

export default function StudentPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState("")
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  useEffect(() => {
    async function fetchPayments() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: student } = await supabase
          .from("students")
          .select("id, full_name")
          .eq("user_id", user.id)
          .single()

        if (!student) return

        setStudentName(student.full_name)

        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("student_id", student.id)
          .order("payment_date", { ascending: false })

        if (data) {
          setPayments(
            data.map((p) => ({
              id: p.id,
              date: p.payment_date,
              amount: p.amount,
              mode: p.method,
              status: p.status as Payment["status"],
              for: p.description || "Fee Payment",
              receiptNo: p.receipt_no || "—",
            }))
          )
        }
      } catch (err) {
        console.error("Failed to fetch payments:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPayments()
  }, [])

  const filtered = useMemo(() => {
    let result = filter === "all" ? payments : payments.filter((p) => p.status.toLowerCase() === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) => p.for.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      )
    }
    return result
  }, [filter, search, payments])

  const totalPaid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter((p) => p.status === "Pending").reduce((s, p) => s + p.amount, 0)

  // The tab only appears when there is something in it: a "Rejected" filter on
  // an account that has never had a claim refused is an empty screen with no
  // way to understand why it is there.
  const rejectedCount = payments.filter((p) => p.status === "Rejected").length

  const downloadReceipt = (p: Payment) => {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${p.id}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #1a202c; }
  .receipt { max-width: 480px; margin: 0 auto; border: 2px dashed #16a34a; padding: 32px; background: #fff; }
  .brand { text-align: center; margin-bottom: 20px; }
  .brand h2 { margin: 0; color: #16a34a; letter-spacing: 1px; }
  .brand p { margin: 4px 0 0; font-size: 11px; color: #718096; }
  .title { text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; font-size: 13px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .row span:first-child { color: #718096; }
  .amount { font-size: 15px; }
  .amount span:last-child { font-weight: 700; color: #16a34a; }
  .divider { border-top: 1px dashed #cbd5e0; margin: 12px 0; }
  .thanks { text-align: center; font-size: 11px; color: #718096; margin-top: 16px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      <h2>TNGC Computers</h2>
      <p>The New Generation Computers</p>
      <p>Ramanthapur, Hyderabad</p>
    </div>
    <div class="title">Payment Receipt</div>
    <div class="row"><span>Receipt No</span><span>${p.receiptNo}</span></div>
    <div class="row"><span>Payment ID</span><span>${p.id}</span></div>
    <div class="row"><span>Student</span><span>${studentName || "—"}</span></div>
    <div class="row"><span>Date</span><span>${p.date}</span></div>
    <div class="row"><span>Description</span><span>${p.for}</span></div>
    <div class="divider"></div>
    <div class="row amount"><span>Amount Paid</span><span>₹${p.amount.toLocaleString("en-IN")}</span></div>
    <div class="row"><span>Payment Method</span><span>${p.mode}</span></div>
    <div class="row"><span>Status</span><span>${paymentStatusLabel(p.status)}</span></div>
    <div class="divider"></div>
    <div class="thanks">Thank you for your payment!</div>
  </div>
  <script>window.onload = function () { window.print(); }</script>
</body>
</html>`

    const win = window.open("", "_blank", "width=520,height=760")
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <Link href="/student/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back to Profile
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Payments</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">View your payment history</p>
        </div>
        <Link href="/student/fee" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors h-7">
          <CreditCard className="size-4" />
          Make a Payment
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">Awaiting verification</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600">₹{totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/*
        How to pay, on the page a student lands on after being told they owe
        something. The amount is left off the QR deliberately: this figure is the
        total still owed across every course, and a QR that pre-fills the wrong
        number is worse than one that asks.
      */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
              <span>How to pay</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-4">
              <UpiPayBlock
                note="After you pay, enter the UPI reference on the fee page so our team can verify it."
              />
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by description or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v ?? "all")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="pending">Awaiting verification</TabsTrigger>
          {rejectedCount > 0 && (
            <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No payments match your search.
            </CardContent>
          </Card>
        )}
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs sm:text-sm font-medium truncate">{p.for}</p>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusConfig[p.status]}`}>{paymentStatusLabel(p.status)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.date} &middot; {p.mode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm sm:text-base font-bold">₹{p.amount.toLocaleString()}</p>
                  {p.status === "Paid" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] gap-1 mt-0.5"
                      onClick={() => setReceiptPayment(p)}
                    >
                      <Download className="size-3" />
                      Receipt
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptPayment} onOpenChange={(open) => { if (!open) setReceiptPayment(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>Review and download your receipt.</DialogDescription>
          </DialogHeader>

          {receiptPayment && (
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-primary">TNGC</h3>
                <p className="text-[11px] text-muted-foreground">Technical & Non-Technical General College</p>
                <p className="text-xs font-semibold">PAYMENT RECEIPT</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt No</span>
                  <span className="font-medium">{receiptPayment.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment ID</span>
                  <span className="font-medium">{receiptPayment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student Name</span>
                  <span className="font-medium">{studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{receiptPayment.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">{receiptPayment.for}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-emerald-600">₹{receiptPayment.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium">{receiptPayment.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary" className={`text-[10px] ${statusConfig[receiptPayment.status]}`}>{paymentStatusLabel(receiptPayment.status)}</Badge>
                </div>
              </div>

              <div className="border-t border-dashed pt-3 text-center">
                <p className="text-[10px] text-muted-foreground">Thank you for your payment!</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptPayment(null)}>Close</Button>
            <Button
              onClick={() => {
                if (receiptPayment) downloadReceipt(receiptPayment)
                setReceiptPayment(null)
              }}
              className="gap-1.5"
            >
              <Download className="size-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
