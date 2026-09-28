"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ExportDialog } from "@/components/admin/export-dialog"
import { RecordPaymentSheet } from "@/components/admin/record-payment-sheet"
import { supabase } from "@/lib/supabase"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { tooltipStyle, axisStyle, gridStyle, CHART_PALETTE } from "@/lib/chart-theme"

type PaymentStatus = "Paid" | "Pending" | "Partial" | "Overdue" | "Rejected"

interface Payment {
  id: string
  studentName: string
  course: string
  amount: string
  amountRaw: number
  date: string
  method: string
  status: PaymentStatus
  /** What the student says they paid against — the UPI reference, if they gave one. */
  reference: string
}

interface WeeklyDatum {
  week: string
  amount: number
}

function statusConfig(status: PaymentStatus) {
  switch (status) {
    case "Paid":
      return { className: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/25", icon: CheckCircle2 }
    case "Pending":
      return { className: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/25", icon: Clock }
    case "Partial":
      return { className: "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 hover:bg-sky-500/25", icon: Receipt }
    case "Overdue":
      return { className: "bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/25", icon: XCircle }
    // A refused or reversed claim. Muted rather than red: nothing is outstanding
    // here, the claim simply did not stand up. It is already excluded from the
    // revenue figures, which sum status = 'Paid'.
    case "Rejected":
      return { className: "bg-muted text-muted-foreground hover:bg-muted", icon: XCircle }
  }
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7)
}

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyDatum[]>([])
  const [loading, setLoading] = useState(true)
  const rowsPerPage = 8

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, student_name, course_slug, amount, payment_date, method, status, description, installment_id, receipt_no")
        .order("payment_date", { ascending: false })
        
      if (paymentsError) {
        console.error("Error fetching payments:", paymentsError)
        setLoading(false)
        return
      }

      const { data: coursesData } = await supabase
        .from("courses")
        .select("slug, name")

      const courseMap = new Map<string, string>()
      if (coursesData) {
        coursesData.forEach((c) => courseMap.set(c.slug, c.name))
      }

      const mapped: Payment[] = (paymentsData || []).map((p) => ({
        id: p.id,
        studentName: p.student_name,
        course: p.course_slug ? (courseMap.get(p.course_slug) || p.course_slug) : "N/A",
        amount: `₹${Number(p.amount).toLocaleString("en-IN")}`,
        amountRaw: Number(p.amount),
        date: new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        method: p.method,
        status: p.status as PaymentStatus,
        // The student-facing claim, shown so an admin has the UPI reference in
        // front of them instead of having to open the database to check it.
        reference: p.description ?? "",
      }))

      setPayments(mapped)

      // Revenue is only what has actually been verified. This summed every row
      // the query returned, so a Pending claim and now a Rejected one both landed
      // in the chart as income — the dashboard reported money the institute had
      // not received, and unmarking an installment did not remove it either,
      // because its row was simply gone rather than reversed.
      const weekMap = new Map<number, number>()
      for (const p of paymentsData || []) {
        if (p.status !== "Paid") continue
        const wk = getWeekNumber(p.payment_date)
        weekMap.set(wk, (weekMap.get(wk) || 0) + Number(p.amount))
      }

      const weekLabels: Record<number, string> = { 1: "Week 1", 2: "Week 2", 3: "Week 3", 4: "Week 4", 5: "Week 5" }
      const wd: WeeklyDatum[] = Array.from(weekMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([wk, amt]) => ({ week: weekLabels[wk] || `Week ${wk}`, amount: amt }))
      setWeeklyData(wd)

      setLoading(false)
    }

    fetchData()
  }, [reloadKey])

  const filteredPayments = payments.filter(
    (p) =>
      p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.course.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.ceil(filteredPayments.length / rowsPerPage)
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading payments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-xs text-muted-foreground">Payment history and records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Weekly Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid {...gridStyle} vertical={false} />
              <XAxis dataKey="week" tick={axisStyle} />
              <YAxis tick={axisStyle} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Amount"]} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {weeklyData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                Showing {paginatedPayments.length} of {filteredPayments.length} payments
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  className="pl-8 w-64"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((payment) => {
                const cfg = statusConfig(payment.status)
                const Icon = cfg.icon
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">
                      {payment.id}
                      {payment.reference && (
                        <p className="max-w-48 truncate font-sans text-xs text-muted-foreground" title={payment.reference}>
                          {payment.reference}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{payment.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.course}</TableCell>
                    <TableCell className="text-right font-medium">{payment.amount}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.date}</TableCell>
                    <TableCell className="capitalize">{payment.method}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("gap-1", cfg.className)}>
                        <Icon className="h-3 w-3" />
                        {payment.status === "Pending"
                          ? "Awaiting verification"
                          : payment.status === "Rejected"
                            ? "Rejected / reversed"
                            : payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={payments.map((p) => ({
          ID: p.id,
          Student: p.studentName,
          Course: p.course,
          Amount: p.amount,
          Date: p.date,
          Method: p.method,
          Status: p.status,
        }))}
        filename="payments-report"
      />
      <RecordPaymentSheet
        open={recordOpen}
        onOpenChange={setRecordOpen}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />
    </div>
  )
}
