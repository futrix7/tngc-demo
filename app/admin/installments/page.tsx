"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface Installment {
  id: string
  feeId: string
  studentId: string
  studentName: string
  course: string
  label: string
  installmentNo: number
  amount: number
  paidAmount: number
  balance: number
  pendingClaimAmount: number
  pendingPaymentIds: string[]
  pendingReference: string
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending" | "Partial"
  branch: string
  branchId: string | null
}

interface StudentMapEntry {
  full_name: string | null
  branch_id: string | null
}

const statusConfig: Record<string, { className: string; icon: React.ElementType }> = {
  Paid: { className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  Pending: { className: "bg-amber-500/15 text-amber-600", icon: Clock },
  Partial: { className: "bg-sky-500/15 text-sky-600", icon: CheckCircle2 },
  Overdue: { className: "bg-red-500/15 text-red-600", icon: AlertTriangle },
}

export default function InstallmentsPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [stats, setStats] = useState([
    { label: "Total Collected", value: "₹0", color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Pending", value: "₹0", color: "text-amber-600 dark:text-amber-400" },
    { label: "Overdue", value: "₹0", color: "text-red-600 dark:text-red-400" },
    { label: "This Month", value: "₹0", color: "text-foreground" },
  ])
  const perPage = 10

  const [payOpen, setPayOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [unmarkingId, setUnmarkingId] = useState<string | null>(null)
  const [confirmUnmark, setConfirmUnmark] = useState<Installment | null>(null)
  const [unmarkReason, setUnmarkReason] = useState("")

  const fetchInstallments = useCallback(async () => {
    setLoading(true)

    const { data: rows, error } = await supabase
      .from("fee_installments")
      .select("*, fees!inner(id, student_id, course_slug)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching installments:", error)
      setLoading(false)
      return
    }

    if (!rows || rows.length === 0) {
      setInstallments([])
      setLoading(false)
      return
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, installment_id, amount, payment_date, status, description")
      .in("status", ["Paid", "Pending"])
      .in("installment_id", rows.map((row) => row.id))

    if (paymentsError) {
      console.error("Error fetching installment payments:", paymentsError)
      setLoading(false)
      return
    }

    const paidByInstallment: Record<string, number> = {}
    const pendingByInstallment: Record<string, { amount: number; ids: string[]; reference: string }> = {}
    for (const payment of payments ?? []) {
      if (!payment.installment_id) continue

      if (payment.status === "Paid") {
        paidByInstallment[payment.installment_id] =
          (paidByInstallment[payment.installment_id] ?? 0) + payment.amount
      } else if (payment.status === "Pending") {
        const claim = pendingByInstallment[payment.installment_id] ?? { amount: 0, ids: [], reference: "" }
        claim.amount += payment.amount
        claim.ids.push(payment.id)
        claim.reference = claim.reference || payment.description || ""
        pendingByInstallment[payment.installment_id] = claim
      }
    }

    const studentIds = [...new Set(rows.map((r) => r?.fees?.student_id).filter(Boolean))] as string[]
    const courseSlugs = [...new Set(rows.map((r) => r?.fees?.course_slug).filter(Boolean))] as string[]

    const [studentsRes, coursesRes] = await Promise.all([
      supabase.from("students").select("id, full_name, branch_id").in("id", studentIds),
      supabase.from("courses").select("slug, name").in("slug", courseSlugs),
    ])

    const studentsMap: Record<string, StudentMapEntry> = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s]))
    const coursesMap: Record<string, string> = Object.fromEntries((coursesRes.data || []).map((c) => [c.slug, c.name]))

    const branchIds = [...new Set((studentsRes.data || []).map((s) => s.branch_id).filter(Boolean))] as string[]
    let branchesMap: Record<string, string> = {}
    if (branchIds.length > 0) {
      const { data: branchRows } = await supabase.from("branches").select("id, name").in("id", branchIds)
      if (branchRows) {
        branchesMap = Object.fromEntries(branchRows.map((b) => [b.id, b.name]))
      }
    }

    const parsed: Installment[] = rows.map((row) => {
      const feeId = row.fee_id
      // installment_no is stored, not counted from row order. It used to be
      // derived from how many rows had been seen for the fee, which silently
      // renumbered a schedule whenever the query's ordering changed.
      const student = studentsMap[row.fees?.student_id ?? ""]
      const branchName = student ? (branchesMap[student.branch_id ?? ""] || "N/A") : "N/A"
      const courseName = coursesMap[row.fees?.course_slug] || row.fees?.course_slug || "N/A"
      const ledgerPaid = paidByInstallment[row.id] ?? 0
      const pendingClaim = pendingByInstallment[row.id]
      const paidAmount = Math.min(row.amount, row.status === "Paid" ? Math.max(ledgerPaid, row.amount) : ledgerPaid)
      const balance = Math.max(0, Number((row.amount - paidAmount).toFixed(2)))

      return {
        id: row.id,
        feeId,
        studentId: row.fees?.student_id ?? "N/A",
        studentName: student?.full_name ?? "Unknown",
        course: courseName,
        label: row.label,
        installmentNo: row.installment_no ?? 0,
        amount: row.amount,
        paidAmount,
        balance,
        pendingClaimAmount: pendingClaim?.amount ?? 0,
        pendingPaymentIds: pendingClaim?.ids ?? [],
        pendingReference: pendingClaim?.reference ?? "",
        dueDate: row.due_date,
        paidDate: row.paid_date,
        status: balance === 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Pending",
        branch: branchName,
        branchId: student?.branch_id ?? null,
      }
    })

    setInstallments(parsed)

    const totalCollected = parsed.reduce((sum, i) => sum + i.paidAmount, 0)
    const pendingAmount = parsed.reduce((sum, i) => sum + i.balance, 0)
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const thisMonthAmount = (payments ?? [])
      .filter((payment) => payment.status === "Paid" && payment.payment_date.startsWith(thisMonth))
      .reduce((sum, payment) => sum + payment.amount, 0)

    // Overdue counts only the outstanding balance on installments past due.
    const today = now.toISOString().split("T")[0]
    const overdueAmount = parsed
      .filter((i) => i.balance > 0 && i.dueDate < today)
      .reduce((sum, i) => sum + i.balance, 0)

    setStats([
      { label: "Total Collected", value: `₹${totalCollected.toLocaleString("en-IN")}`, color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Pending", value: `₹${pendingAmount.toLocaleString("en-IN")}`, color: "text-amber-600 dark:text-amber-400" },
      { label: "Overdue", value: `₹${overdueAmount.toLocaleString("en-IN")}`, color: "text-red-600 dark:text-red-400" },
      { label: "This Month", value: `₹${thisMonthAmount.toLocaleString("en-IN")}`, color: "text-foreground" },
    ])

    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchInstallments()
  }, [fetchInstallments])

  async function handleConfirmClaim(inst: Installment) {
    if (inst.pendingPaymentIds.length === 0 || verifyingId) return
    setVerifyingId(inst.id)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/installments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentIds: inst.pendingPaymentIds, approve: true }),
      })
      const result = (await response.json()) as { error?: string; amount?: number; settled?: number }

      if (!response.ok) {
        toast(result.error ?? "We couldn't confirm this payment. Nothing was changed.", {
          variant: "destructive",
        })
        return
      }

      toast(
        `Confirmed ${inst.label} for ${inst.studentName}: ₹${Number(result.amount ?? inst.pendingClaimAmount).toLocaleString("en-IN")}.`,
        { variant: "success" }
      )
      fetchInstallments()
    } catch {
      toast("We couldn't confirm this payment. Nothing was changed — please try again.", {
        variant: "destructive",
      })
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleMarkPaid() {
    if (!payingId) return
    setPaying(true)

    const inst = installments.find((i) => i.id === payingId)
    if (!inst) {
      toast("Installment not found", { variant: "destructive" })
      setPaying(false)
      return
    }

    try {
      // The endpoint verifies the admin session server-side; without the token it
      // cannot tell an administrator from an anonymous visitor.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        setPaying(false)
        return
      }

      const res = await fetch("/api/installments/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ installmentId: payingId, method: "cash" }),
      })

      const json = (await res.json()) as { error?: string; amount?: number }

      if (!res.ok) {
        // "Nothing was changed" is now literally true: the payment, the
        // installment and the fee balance are written in one transaction, so
        // there is no half-finished state left behind to go and reconcile.
        toast(json.error ?? "We couldn't record that payment. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        setPaying(false)
        return
      }

      setPaying(false)
      toast(`${inst.label} fully paid with ₹${Number(json.amount ?? inst.balance).toLocaleString("en-IN")}`, {
        variant: "success",
      })
      setPayOpen(false)
      setPayingId(null)
      fetchInstallments()
    } catch {
      setPaying(false)
      toast("We couldn't record that payment. Nothing was changed — please try again.", {
        variant: "destructive",
        duration: 10000,
      })
    }
  }

  async function handleUnmark(inst: Installment, reason: string) {
    setUnmarkingId(inst.id)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        setUnmarkingId(null)
        return
      }

      const res = await fetch("/api/installments/unmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ installmentId: inst.id, reason }),
      })

      const json = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast(json.error ?? "We couldn't reverse that installment. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        setUnmarkingId(null)
        return
      }

      toast(`₹${inst.paidAmount.toLocaleString("en-IN")} was reversed and added back to ${inst.studentName}'s balance.`, {
        variant: "success",
      })
      setUnmarkingId(null)
      fetchInstallments()
    } catch {
      setUnmarkingId(null)
      toast("We couldn't reverse that installment. Nothing was changed — please try again.", {
        variant: "destructive",
      })
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast("Nothing to export", { variant: "destructive" })
      return
    }
    const header = ["Student", "Student ID", "Course", "Installment", "Amount", "Paid", "Balance", "Due Date", "Paid Date", "Status", "Branch"]
    const rows = [header, ...filtered.map((i) => [
      i.studentName,
      i.studentId,
      i.course,
      i.label,
      String(i.amount),
      String(i.paidAmount),
      String(i.balance),
      i.dueDate,
      i.paidDate ?? "",
      i.status,
      i.branch,
    ])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `installments-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = installments.filter((inst) => {
    const matchesSearch =
      inst.studentName.toLowerCase().includes(search.toLowerCase()) ||
      inst.studentId.toLowerCase().includes(search.toLowerCase()) ||
      inst.course.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || inst.status.toLowerCase() === filter
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Installments</h1>
          <p className="text-xs text-muted-foreground">Track and manage student installment payments</p>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-sm font-bold shrink-0", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Installment Records</h2>
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length} of {installments.length} installments
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student or course..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                  className="pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>
        </CardContent>

        <CardContent className="space-y-4">
          <Tabs value={filter} onValueChange={(v) => { setFilter(v ?? "all"); setCurrentPage(1) }}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="partial">Partial</TabsTrigger>
            </TabsList>
          </Tabs>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Course</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead className="hidden sm:table-cell">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                <TableHead className="hidden lg:table-cell">Paid Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((inst) => {
                const cfg = statusConfig[inst.status]
                const Icon = cfg.icon
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inst.studentName}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{inst.course}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{inst.course}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{inst.label}</span>
                        {inst.pendingPaymentIds.length > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            ₹{inst.pendingClaimAmount.toLocaleString("en-IN")} claimed · awaiting review
                          </p>
                        )}
                        {inst.pendingReference && (
                          <p className="max-w-48 truncate text-xs text-muted-foreground" title={inst.pendingReference}>
                            {inst.pendingReference}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-medium">₹{inst.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="hidden md:table-cell text-emerald-700 dark:text-emerald-400">₹{inst.paidAmount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="font-semibold">₹{inst.balance.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{inst.dueDate}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{inst.paidDate ?? "—"}</TableCell>
                    <TableCell>
                      {inst.pendingPaymentIds.length > 0 ? (
                        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          <Clock className="size-3" />
                          Awaiting review
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className={cn("gap-1", cfg.className)}>
                          <Icon className="size-3" />
                          {inst.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {inst.pendingPaymentIds.length > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-emerald-600/30 px-2 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
                            onClick={() => handleConfirmClaim(inst)}
                            disabled={verifyingId !== null}
                            title="Confirm this student payment"
                          >
                            {verifyingId === inst.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            Confirm
                          </Button>
                        ) : inst.status !== "Paid" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => { setPayingId(inst.id); setPayOpen(true) }}
                            title="Collect remaining balance"
                          >
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          </Button>
                        )}
                        {/* The reverse. Marking an installment paid used to be
                            the only direction available, so a payment that never
                            arrived could only be corrected by hand — and the
                            ledger row stayed counted as revenue. */}
                        {(inst.status === "Paid" || inst.status === "Partial") && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setConfirmUnmark(inst)}
                            title="Reverse verified payments"
                            disabled={unmarkingId === inst.id}
                          >
                            {unmarkingId === inst.id ? (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            ) : (
                              <RotateCcw className="size-4 text-amber-600" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No installments found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={payOpen} onOpenChange={(open) => { setPayOpen(open); if (!open) setPayingId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Confirm the remaining balance was received from the student?
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const installment = installments.find((item) => item.id === payingId)
            if (!installment) return null
            return (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{installment.studentName} — {installment.label}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installment amount</span>
                    <span>₹{installment.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already paid</span>
                    <span>₹{installment.paidAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Collect now</span>
                    <span>₹{installment.balance.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayOpen(false); setPayingId(null) }}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={paying} className="bg-emerald-600 hover:bg-emerald-700">
              {paying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirmUnmark}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmUnmark(null)
            setUnmarkReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-amber-600" />
              Mark as unpaid
            </DialogTitle>
            <DialogDescription>
              Use this when the payment was never received, or was marked paid by mistake.
            </DialogDescription>
          </DialogHeader>

          {confirmUnmark && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">
                {confirmUnmark.studentName} — {confirmUnmark.label}
              </p>
              <p className="mt-1 text-muted-foreground">
                ₹{confirmUnmark.paidAmount.toLocaleString("en-IN")} in verified payments will be
                reversed and credited back to this student&rsquo;s outstanding balance.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="unmarkReason">Reason</Label>
            <Input
              id="unmarkReason"
              value={unmarkReason}
              onChange={(e) => setUnmarkReason(e.target.value)}
              placeholder="e.g. UPI reference never received"
              autoFocus
            />
          </div>

          <p className="text-xs text-muted-foreground">
            The recorded payment is marked reversed rather than deleted, and this reason is
            written onto it, so the ledger still shows what was claimed and why it was
            withdrawn. It stops counting towards revenue immediately.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmUnmark(null); setUnmarkReason("") }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmUnmark) handleUnmark(confirmUnmark, unmarkReason.trim())
                setConfirmUnmark(null)
                setUnmarkReason("")
              }}
              disabled={!unmarkReason.trim() || unmarkingId === confirmUnmark?.id}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RotateCcw className="size-4" />
              Mark as unpaid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
