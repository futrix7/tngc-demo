"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog"
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
  remainingBalance: number | null
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
  const [exportRows, setExportRows] = useState<Record<string, string | number>[]>([])
  const [exporting, setExporting] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState({ status: "all", from: "", to: "" })
  const [payments, setPayments] = useState<Payment[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [weeklyData, setWeeklyData] = useState<WeeklyDatum[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentsError, setPaymentsError] = useState(false)
  const requestId = useRef(0)
  const manualFetchKey = useRef<string | null>(null)
  const rowsPerPage = 8

  const fetchPayments = useCallback(async (page: number, search: string, selectedFilters: typeof filters) => {
    const activeRequest = ++requestId.current
    setLoading(true)
    const safeTerm = search.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
    let query = supabase
      .from("payments")
      .select("id, student_name, course_slug, amount, payment_date, method, status, description, installment_id", { count: "exact" })
      .order("payment_date", { ascending: false })
    if (selectedFilters.status !== "all") query = query.eq("status", selectedFilters.status)
    if (selectedFilters.from) query = query.gte("payment_date", selectedFilters.from)
    if (selectedFilters.to) query = query.lte("payment_date", selectedFilters.to)
    if (safeTerm) query = query.or(`student_name.ilike.%${safeTerm}%,id.ilike.%${safeTerm}%,course_slug.ilike.%${safeTerm}%`)

    const { data: paymentsData, error, count } = await query.range((page - 1) * rowsPerPage, page * rowsPerPage - 1)
    if (error) {
      console.error("Error fetching payments:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      if (activeRequest === requestId.current) {
        setPaymentsError(true)
        setPayments([])
        setTotalCount(0)
        setLoading(false)
      }
      return false
    }
    if (activeRequest !== requestId.current) return true
    setPaymentsError(false)

    const slugs = [...new Set((paymentsData ?? []).map((payment) => payment.course_slug).filter(Boolean))] as string[]
    const installmentIds = [
      ...new Set((paymentsData ?? []).map((payment) => payment.installment_id).filter(Boolean)),
    ] as string[]
    const [coursesResult, installmentsResult] = await Promise.all([
      slugs.length
        ? supabase.from("courses").select("slug, name, short_name").in("slug", slugs)
        : Promise.resolve({ data: [] as { slug: string; name: string; short_name: string }[], error: null }),
      installmentIds.length
        ? supabase.from("fee_installments").select("id, fee_id").in("id", installmentIds)
        : Promise.resolve({ data: [] as { id: string; fee_id: string }[], error: null }),
    ])
    if (coursesResult.error || installmentsResult.error) {
      console.error("Error fetching payment details:", coursesResult.error ?? installmentsResult.error)
      if (activeRequest === requestId.current) setLoading(false)
      return false
    }

    const feeIds = [...new Set((installmentsResult.data ?? []).map((row) => row.fee_id).filter(Boolean))]
    const { data: feeRows, error: feesError } = feeIds.length
      ? await supabase.from("fees").select("id, pending_amount").in("id", feeIds)
      : { data: [] as { id: string; pending_amount: number | null }[], error: null }
    if (feesError) {
      console.error("Error fetching payment balances:", feesError.message)
      if (activeRequest === requestId.current) setLoading(false)
      return false
    }

    const { data: feeInstallments, error: feeInstallmentsError } = feeIds.length
      ? await supabase.from("fee_installments").select("id, fee_id").in("fee_id", feeIds)
      : { data: [] as { id: string; fee_id: string }[], error: null }
    if (feeInstallmentsError) {
      console.error("Error fetching payment installment balances:", feeInstallmentsError.message)
      if (activeRequest === requestId.current) setLoading(false)
      return false
    }

    const feeInstallmentIds = (feeInstallments ?? []).map((installment) => installment.id)
    const { data: pendingClaims, error: pendingClaimsError } = feeInstallmentIds.length
      ? await supabase
        .from("payments")
        .select("installment_id, amount")
        .eq("status", "Pending")
        .in("installment_id", feeInstallmentIds)
      : { data: [] as { installment_id: string | null; amount: number }[], error: null }
    if (pendingClaimsError) {
      console.error("Error fetching pending payment balances:", pendingClaimsError.message)
      if (activeRequest === requestId.current) setLoading(false)
      return false
    }

    const courseMap = new Map((coursesResult.data ?? []).map((course) => [course.slug, course.short_name || course.name]))
    const feeByInstallment = new Map((installmentsResult.data ?? []).map((row) => [row.id, row.fee_id]))
    const feeByInstallmentId = new Map((feeInstallments ?? []).map((row) => [row.id, row.fee_id]))
    const pendingByFee = new Map<string, number>()
    for (const claim of pendingClaims ?? []) {
      const feeId = claim.installment_id ? feeByInstallmentId.get(claim.installment_id) : undefined
      if (feeId) pendingByFee.set(feeId, (pendingByFee.get(feeId) ?? 0) + Number(claim.amount))
    }
    const balanceByFee = new Map((feeRows ?? []).map((fee) => [
      fee.id,
      Math.max(0, Number((Number(fee.pending_amount ?? 0) - (pendingByFee.get(fee.id) ?? 0)).toFixed(2))),
    ]))
    setPayments((paymentsData ?? []).map((payment) => {
      const feeId = payment.installment_id ? feeByInstallment.get(payment.installment_id) : undefined
      return {
      id: payment.id,
      studentName: payment.student_name,
      course: payment.course_slug ? courseMap.get(payment.course_slug) ?? payment.course_slug : "N/A",
      amount: `₹${Number(payment.amount).toLocaleString("en-IN")}`,
      amountRaw: Number(payment.amount),
      remainingBalance: feeId ? balanceByFee.get(feeId) ?? null : null,
      date: new Date(payment.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      method: payment.method,
      status: payment.status as PaymentStatus,
      reference: payment.description ?? "",
      }
    }))
    setTotalCount(count ?? 0)
    setLoading(false)
    return true
  }, [rowsPerPage])

  useEffect(() => {
    const request = { currentPage, searchQuery, filters, reloadKey }
    const requestKey = JSON.stringify(request)
    const timer = setTimeout(() => {
      if (manualFetchKey.current === requestKey) {
        manualFetchKey.current = null
        return
      }
      void fetchPayments(currentPage, searchQuery, filters)
    }, 250)
    return () => clearTimeout(timer)
  }, [currentPage, fetchPayments, filters, reloadKey, searchQuery])

  useEffect(() => {
    async function fetchMonthlyCollections() {
      const now = new Date()
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
      const to = now.toISOString().slice(0, 10)
      const { data } = await supabase
        .from("payments")
        .select("payment_date, amount")
        .eq("status", "Paid")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: true })
        .limit(1000)
      const weekMap = new Map<number, number>()
      for (const payment of data ?? []) {
        const week = getWeekNumber(payment.payment_date)
        weekMap.set(week, (weekMap.get(week) ?? 0) + Number(payment.amount))
      }
      setWeeklyData(Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]).map(([week, amount]) => ({ week: `Week ${week}`, amount })))
    }
    fetchMonthlyCollections()
  }, [reloadKey])

  const totalPages = Math.ceil(totalCount / rowsPerPage)
  const paginatedPayments = payments

  const paymentFilterFields: FilterField[] = [
    {
      key: "status",
      label: "Payment status",
      type: "select",
      defaultValue: "all",
      options: [
        { value: "all", label: "All statuses" },
        ...(["Paid", "Pending", "Partial", "Overdue", "Rejected"] as PaymentStatus[]).map((status) => ({ value: status, label: status })),
      ],
    },
    { key: "from", label: "From date", type: "date", defaultValue: "" },
    { key: "to", label: "To date", type: "date", defaultValue: "" },
  ]

  async function applyPaymentFilters(values: FilterValues) {
    const nextFilters = { status: values.status || "all", from: values.from || "", to: values.to || "" }
    const requestKey = JSON.stringify({ currentPage: 1, searchQuery, filters: nextFilters, reloadKey })
    manualFetchKey.current = requestKey
    setCurrentPage(1)
    setFilters(nextFilters)
    if (!await fetchPayments(1, searchQuery, nextFilters)) throw new Error("Payment fetch failed")
  }

  async function handleExport() {
    setExporting(true)
    const safeTerm = searchQuery.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
    const rows: { id: string; student_name: string; course_slug: string | null; amount: number; payment_date: string; method: string; status: string }[] = []
    let offset = 0

    try {
      while (true) {
        let query = supabase
          .from("payments")
          .select("id, student_name, course_slug, amount, payment_date, method, status")
          .order("payment_date", { ascending: false })
        if (filters.status !== "all") query = query.eq("status", filters.status)
        if (filters.from) query = query.gte("payment_date", filters.from)
        if (filters.to) query = query.lte("payment_date", filters.to)
        if (safeTerm) query = query.or(`student_name.ilike.%${safeTerm}%,id.ilike.%${safeTerm}%,course_slug.ilike.%${safeTerm}%`)
        const { data, error } = await query.range(offset, offset + 999)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < 1000) break
        offset += 1000
      }

      const slugs = [...new Set(rows.map((row) => row.course_slug).filter(Boolean))] as string[]
      const { data: courseRows } = slugs.length
        ? await supabase.from("courses").select("slug, name, short_name").in("slug", slugs)
        : { data: [] as { slug: string; name: string; short_name: string }[] }
      const courseNames = new Map((courseRows ?? []).map((row) => [row.slug, row.short_name || row.name]))
      setExportRows(rows.map((row) => ({
        ID: row.id,
        Student: row.student_name,
        Course: row.course_slug ? courseNames.get(row.course_slug) ?? row.course_slug : "N/A",
        Amount: `₹${Number(row.amount).toLocaleString("en-IN")}`,
        Date: new Date(row.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        Method: row.method,
        Status: row.status,
      })))
      setExportOpen(true)
    } catch (error) {
      console.error("Error exporting filtered payments:", error)
    } finally {
      setExporting(false)
    }
  }

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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Preparing..." : "Export"}
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
                Showing {paginatedPayments.length} of {totalCount.toLocaleString()} matching payments
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  className="w-full pl-8 sm:w-72"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <FilterDialog
                title="Filter payments"
                description="Choose a payment status and payment-date range."
                fields={paymentFilterFields}
                values={filters}
                onApply={applyPaymentFilters}
                onClear={applyPaymentFilters}
              />
            </div>
          </div>
        </CardHeader>
        {paymentsError && (
          <CardContent>
            <p role="alert" className="text-sm text-destructive">
              Payments could not be loaded. Please refresh the page or try again later.
            </p>
          </CardContent>
        )}
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
                    <TableCell className="text-right">
                      <span className="font-medium">{payment.amount}</span>
                      {payment.remainingBalance !== null && (payment.status === "Paid" || payment.status === "Pending") && (
                        <span className="block whitespace-nowrap text-xs font-normal text-muted-foreground">
                          {payment.remainingBalance > 0
                            ? `₹${payment.remainingBalance.toLocaleString("en-IN")} still due`
                            : "No balance still due"}
                        </span>
                      )}
                    </TableCell>
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
        rows={exportRows}
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
