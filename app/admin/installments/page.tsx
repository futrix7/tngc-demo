"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog"
import { CollectDialog, type CollectibleInstallment } from "@/components/admin/collect-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  remainingBalance: number
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

function unwrapFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const statusConfig: Record<string, { className: string; icon: React.ElementType }> = {
  Paid: { className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  Pending: { className: "bg-amber-500/15 text-amber-600", icon: Clock },
  Partial: { className: "bg-sky-500/15 text-sky-600", icon: CheckCircle2 },
  Overdue: { className: "bg-red-500/15 text-red-600", icon: AlertTriangle },
}

function localDateValue(date: Date, includeDay = true) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return includeDay ? `${year}-${month}-${day}` : `${year}-${month}`
}

export default function InstallmentsPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [periodType, setPeriodType] = useState("all")
  const [periodValue, setPeriodValue] = useState(() => localDateValue(new Date(), false))
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [stats, setStats] = useState([
    { label: "Page collected", value: "₹0", color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Page outstanding", value: "₹0", color: "text-amber-600 dark:text-amber-400" },
    { label: "Page overdue", value: "₹0", color: "text-red-600 dark:text-red-400" },
    { label: "Page collected this month", value: "₹0", color: "text-foreground" },
  ])
  const perPage = 10

  const [collecting, setCollecting] = useState<CollectibleInstallment | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [unmarkingId, setUnmarkingId] = useState<string | null>(null)
  const [confirmUnmark, setConfirmUnmark] = useState<Installment | null>(null)
  const [unmarkReason, setUnmarkReason] = useState("")
  const requestId = useRef(0)
  const manualFetchKey = useRef<string | null>(null)

  const fetchInstallments = useCallback(async (
    page = 1,
    searchTerm = search,
    selectedStatus = filter,
    selectedPeriod = periodType,
    selectedPeriodValue = periodValue,
  ) => {
    const activeRequest = ++requestId.current
    setLoading(true)

    let query = supabase
      .from("fee_installments")
      .select("*, fees!inner(id, student_id, course_slug, students!inner(full_name, branch_id))", { count: "exact" })
      // PostgreSQL's descending status order gives Pending, Partial, then Paid.
      // Keep due dates ascending within each status so open lines are seen first.
      .order("status", { ascending: false })
      .order("due_date", { ascending: true })

    const safeSearch = searchTerm.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
    if (safeSearch) {
      query = query.or(`label.ilike.%${safeSearch}%,fees.course_slug.ilike.%${safeSearch}%,fees.students.full_name.ilike.%${safeSearch}%`)
    }
    if (selectedStatus === "confirm") {
      const claimIds: string[] = []
      let offset = 0
      while (true) {
        const { data: claims, error: claimsError } = await supabase
          .from("payments")
          .select("installment_id")
          .eq("status", "Pending")
          .not("installment_id", "is", null)
          .range(offset, offset + 999)
        if (claimsError) {
          console.error("Error fetching pending installment claims:", claimsError)
          setLoading(false)
          return false
        }
        claimIds.push(...(claims ?? []).map((claim) => claim.installment_id).filter(Boolean) as string[])
        if (!claims || claims.length < 1000) break
        offset += 1000
      }
      const uniqueClaimIds = [...new Set(claimIds)]
      if (uniqueClaimIds.length === 0) {
        setInstallments([])
        setTotalCount(0)
        setLoading(false)
        return true
      }
      query = query.in("id", uniqueClaimIds)
    } else if (selectedStatus === "pending") {
      query = query.in("status", ["Pending", "Partial"])
    } else if (selectedStatus === "partial" || selectedStatus === "paid") {
      query = query.eq("status", selectedStatus === "paid" ? "Paid" : "Partial")
    }
    if (selectedPeriod === "date" && selectedPeriodValue) query = query.eq("due_date", selectedPeriodValue)
    if (selectedPeriod === "month" && selectedPeriodValue) {
      const [year, month] = selectedPeriodValue.split("-").map(Number)
      const lastDay = new Date(year, month, 0).getDate()
      query = query.gte("due_date", `${selectedPeriodValue}-01`).lte("due_date", `${selectedPeriodValue}-${String(lastDay).padStart(2, "0")}`)
    }
    if (selectedPeriod === "quarter" && selectedPeriodValue) {
      const [year, quarter] = selectedPeriodValue.split("-Q").map(Number)
      const firstMonth = (quarter - 1) * 3 + 1
      const from = `${year}-${String(firstMonth).padStart(2, "0")}-01`
      const lastDay = new Date(year, firstMonth + 2, 0).getDate()
      const to = `${year}-${String(firstMonth + 2).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      query = query.gte("due_date", from).lte("due_date", to)
    }

    const { data: rows, error, count } = await query.range((page - 1) * perPage, page * perPage - 1)

    if (error) {
      console.error("Error fetching installments:", error)
      setLoading(false)
      return false
    }

    if (activeRequest !== requestId.current) return true
    setTotalCount(count ?? 0)

    if (!rows || rows.length === 0) {
      setInstallments([])
      setLoading(false)
      return true
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

    const studentIds = [...new Set(rows
      .map((r) => unwrapFirst(r.fees)?.student_id ?? null)
      .filter(Boolean))] as string[]
    const courseSlugs = [...new Set(rows
      .map((r) => unwrapFirst(r.fees)?.course_slug ?? null)
      .filter(Boolean))] as string[]

    const [studentsRes, coursesRes] = await Promise.all([
      supabase.from("students").select("id, full_name, branch_id").in("id", studentIds),
      supabase.from("courses").select("slug, name, short_name").in("slug", courseSlugs),
    ])

    const studentsMap: Record<string, StudentMapEntry> = Object.fromEntries((studentsRes.data || []).map((s) => [s.id, s]))
    const coursesMap: Record<string, string> = Object.fromEntries((coursesRes.data || []).map((c) => [c.slug, c.short_name || c.name]))

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
      const fee = unwrapFirst(row.fees)
      const studentInfo = fee ? unwrapFirst(fee.students as StudentMapEntry[] | StudentMapEntry | null) : null
      const studentId = fee?.student_id ?? "N/A"
      const courseSlug = fee?.course_slug ?? ""
      // installment_no is stored, not counted from row order. It used to be
      // derived from how many rows had been seen for the fee, which silently
      // renumbered a schedule whenever the query's ordering changed.
      const student = studentsMap[studentId] ?? (studentInfo ? { full_name: studentInfo.full_name ?? null, branch_id: studentInfo.branch_id ?? null } : null)
      const branchName = student ? (branchesMap[student.branch_id ?? ""] || "N/A") : "N/A"
      const courseName = coursesMap[courseSlug] || courseSlug || "N/A"
      const ledgerPaid = paidByInstallment[row.id] ?? 0
      const pendingClaim = pendingByInstallment[row.id]
      const paidAmount = Math.min(row.amount, row.status === "Paid" ? Math.max(ledgerPaid, row.amount) : ledgerPaid)
      const balance = Math.max(0, Number((row.amount - paidAmount).toFixed(2)))
      const pendingClaimAmount = Math.min(balance, pendingClaim?.amount ?? 0)
      const remainingBalance = Math.max(0, Number((balance - pendingClaimAmount).toFixed(2)))

      return {
        id: row.id,
        feeId,
        studentId,
        studentName: student?.full_name ?? "Unknown",
        course: courseName,
        label: row.label,
        installmentNo: row.installment_no ?? 0,
        amount: row.amount,
        paidAmount,
        balance,
        remainingBalance,
        pendingClaimAmount,
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
    const pendingAmount = parsed.reduce((sum, i) => sum + i.remainingBalance, 0)
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const thisMonthAmount = (payments ?? [])
      .filter((payment) => payment.status === "Paid" && payment.payment_date.startsWith(thisMonth))
      .reduce((sum, payment) => sum + payment.amount, 0)

    // Overdue counts only the outstanding balance on installments past due.
    const today = now.toISOString().split("T")[0]
    const overdueAmount = parsed
      .filter((i) => i.remainingBalance > 0 && i.dueDate < today)
      .reduce((sum, i) => sum + i.remainingBalance, 0)

    setStats([
      { label: "Page collected", value: `₹${totalCollected.toLocaleString("en-IN")}`, color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Page outstanding", value: `₹${pendingAmount.toLocaleString("en-IN")}`, color: "text-amber-600 dark:text-amber-400" },
      { label: "Page overdue", value: `₹${overdueAmount.toLocaleString("en-IN")}`, color: "text-red-600 dark:text-red-400" },
      { label: "Page collected this month", value: `₹${thisMonthAmount.toLocaleString("en-IN")}`, color: "text-foreground" },
    ])

    setLoading(false)
    return true
  }, [filter, periodType, periodValue, perPage, search])

  useEffect(() => {
    const request = { currentPage, search, filter, periodType, periodValue }
    const requestKey = JSON.stringify(request)
    const timer = setTimeout(() => {
      if (manualFetchKey.current === requestKey) {
        manualFetchKey.current = null
        return
      }
      void fetchInstallments(currentPage, search, filter, periodType, periodValue)
    }, 250)
    return () => clearTimeout(timer)
  }, [currentPage, fetchInstallments, filter, periodType, periodValue, search])

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

  const handleExport = async () => {
    setExporting(true)
    const csvRows: unknown[][] = [["Student", "Student ID", "Course", "Installment", "Amount", "Paid", "Awaiting Verification", "Balance", "Due Date", "Paid Date", "Status", "Branch"]]
    const safeSearch = search.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")

    try {
      let claimIds: string[] | null = null
      if (filter === "confirm") {
        claimIds = []
        let claimOffset = 0
        while (true) {
          const { data, error } = await supabase.from("payments").select("installment_id")
            .eq("status", "Pending").not("installment_id", "is", null).range(claimOffset, claimOffset + 999)
          if (error) throw error
          claimIds.push(...(data ?? []).map((payment) => payment.installment_id).filter(Boolean) as string[])
          if (!data || data.length < 1000) break
          claimOffset += 1000
        }
      }

      let offset = 0
      while (true) {
        let query = supabase.from("fee_installments")
          .select("id, fee_id, label, installment_no, amount, due_date, paid_date, status, fees!inner(student_id, course_slug, students!inner(full_name, branch_id))")
          .order("status", { ascending: false })
          .order("due_date", { ascending: true })
        if (safeSearch) query = query.or(`label.ilike.%${safeSearch}%,fees.course_slug.ilike.%${safeSearch}%,fees.students.full_name.ilike.%${safeSearch}%`)
        if (claimIds) query = claimIds.length ? query.in("id", claimIds) : query.eq("id", "")
        else if (filter === "pending") query = query.in("status", ["Pending", "Partial"])
        else if (filter === "paid" || filter === "partial") query = query.eq("status", filter === "paid" ? "Paid" : "Partial")
        if (periodType === "date" && periodValue) query = query.eq("due_date", periodValue)
        if (periodType === "month" && periodValue) {
          const [year, month] = periodValue.split("-").map(Number)
          const lastDay = new Date(year, month, 0).getDate()
          query = query.gte("due_date", `${periodValue}-01`).lte("due_date", `${periodValue}-${String(lastDay).padStart(2, "0")}`)
        }
        if (periodType === "quarter" && periodValue) {
          const [year, quarter] = periodValue.split("-Q").map(Number)
          const firstMonth = (quarter - 1) * 3 + 1
          const lastDay = new Date(year, firstMonth + 2, 0).getDate()
          query = query.gte("due_date", `${year}-${String(firstMonth).padStart(2, "0")}-01`)
            .lte("due_date", `${year}-${String(firstMonth + 2).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`)
        }
        const { data: rows, error } = await query.range(offset, offset + 999)
        if (error) throw error
        if (!rows || rows.length === 0) break

        const ids = rows.map((row) => row.id)
        const feeRows = rows.map((row) => unwrapFirst(row.fees)).filter(Boolean) as Array<{ student_id: string; course_slug: string; students?: { full_name: string | null; branch_id: string | null } | Array<{ full_name: string | null; branch_id: string | null }> | null }>
        const slugs = [...new Set(feeRows.map((fee) => fee.course_slug).filter(Boolean))] as string[]
        const branchIds = [...new Set(feeRows
          .map((fee) => unwrapFirst(fee.students as { full_name: string | null; branch_id: string | null }[] | { full_name: string | null; branch_id: string | null } | null)?.branch_id ?? null)
          .filter(Boolean))] as string[]
        const [paymentsResult, coursesResult, branchesResult] = await Promise.all([
          supabase.from("payments").select("installment_id, amount, status").in("installment_id", ids).in("status", ["Paid", "Pending"]),
          slugs.length ? supabase.from("courses").select("slug, name, short_name").in("slug", slugs) : Promise.resolve({ data: [] as { slug: string; name: string; short_name: string }[], error: null }),
          branchIds.length ? supabase.from("branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
        ])
        if (paymentsResult.error || coursesResult.error || branchesResult.error) throw new Error("Unable to load export details")
        const paidById = new Map<string, number>()
        const pendingById = new Map<string, number>()
        for (const payment of paymentsResult.data ?? []) {
          if (!payment.installment_id) continue
          if (payment.status === "Paid") {
            paidById.set(payment.installment_id, (paidById.get(payment.installment_id) ?? 0) + Number(payment.amount))
          } else if (payment.status === "Pending") {
            pendingById.set(payment.installment_id, (pendingById.get(payment.installment_id) ?? 0) + Number(payment.amount))
          }
        }
        const coursesBySlug = new Map((coursesResult.data ?? []).map((course) => [course.slug, course.short_name || course.name]))
        const branchesById = new Map((branchesResult.data ?? []).map((branch) => [branch.id, branch.name]))
        for (const row of rows) {
          const fee = unwrapFirst(row.fees)
          const studentInfo = fee ? unwrapFirst(fee.students as { full_name: string | null; branch_id: string | null }[] | { full_name: string | null; branch_id: string | null } | null) : null
          const amount = Number(row.amount)
          const paidAmount = Math.min(amount, row.status === "Paid" ? Math.max(paidById.get(row.id) ?? 0, amount) : paidById.get(row.id) ?? 0)
          const balance = Math.max(0, Number((amount - paidAmount).toFixed(2)))
          const awaitingAmount = Math.min(balance, pendingById.get(row.id) ?? 0)
          const remainingBalance = Math.max(0, Number((balance - awaitingAmount).toFixed(2)))
          csvRows.push([
            studentInfo?.full_name ?? "Unknown",
            fee?.student_id ?? "",
            coursesBySlug.get(fee?.course_slug ?? "") ?? fee?.course_slug ?? "",
            row.label,
            amount,
            paidAmount,
            awaitingAmount,
            remainingBalance,
            row.due_date,
            row.paid_date ?? "",
            awaitingAmount > 0 ? "Awaiting verification" : balance === 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Pending",
            branchesById.get(studentInfo?.branch_id ?? "") ?? "",
          ])
        }
        if (rows.length < 1000) break
        offset += 1000
      }

      if (csvRows.length === 1) {
        toast("Nothing to export", { variant: "destructive" })
        return
      }
      const csvCell = (value: unknown) => {
        const text = String(value ?? "")
        const safeText = /^[=+@-]/.test(text) ? `'${text}` : text
        return `"${safeText.replace(/"/g, '""')}"`
      }
      const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }))
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `installments-${new Date().toISOString().split("T")[0]}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting installments:", error)
      toast("Unable to export installments. Please try again.", { variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / perPage)
  const paginated = installments

  const quarterOptions = Array.from({ length: 16 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - index * 3)
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return { value: `${date.getFullYear()}-Q${quarter}`, label: `Q${quarter} ${date.getFullYear()}` }
  })
  const installmentFilterFields: FilterField[] = [
    {
      key: "period",
      label: "Due-date period",
      type: "select",
      defaultValue: "all",
      options: [
        { value: "all", label: "All dates" },
        { value: "month", label: "Specific month" },
        { value: "date", label: "Specific date" },
        { value: "quarter", label: "Specific quarter" },
      ],
    },
    { key: "month", label: "Month", type: "month", defaultValue: "", showWhen: { key: "period", value: "month" } },
    { key: "date", label: "Due date", type: "date", defaultValue: "", showWhen: { key: "period", value: "date" } },
    {
      key: "quarter",
      label: "Quarter",
      type: "select",
      defaultValue: "",
      options: quarterOptions,
      showWhen: { key: "period", value: "quarter" },
    },
  ]

  async function applyInstallmentFilters(values: FilterValues) {
    const nextStatus = filter
    const nextPeriod = values.period || "all"
    const nextValue = nextPeriod === "date" ? values.date || ""
      : nextPeriod === "month" ? values.month || ""
        : nextPeriod === "quarter" ? values.quarter || "" : ""
    const request = { currentPage: 1, search, filter: nextStatus, periodType: nextPeriod, periodValue: nextValue }
    manualFetchKey.current = JSON.stringify(request)
    setFilter(nextStatus)
    setPeriodType(nextPeriod)
    setPeriodValue(nextValue)
    setCurrentPage(1)
    if (!await fetchInstallments(1, search, nextStatus, nextPeriod, nextValue)) throw new Error("Installment filter request failed")
  }

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

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-tight text-muted-foreground sm:truncate">{stat.label}</p>
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
                Showing {paginated.length} of {totalCount.toLocaleString()} matching installments
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student or course..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                  className="w-full pl-8 sm:w-64 lg:w-72"
                />
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <FilterDialog
                  title="Filter installments"
                  description="Filter installments by due date."
                  fields={installmentFilterFields}
                  values={{
                    period: periodType,
                    month: periodType === "month" ? periodValue : "",
                    date: periodType === "date" ? periodValue : "",
                    quarter: periodType === "quarter" ? periodValue : "",
                  }}
                  onApply={applyInstallmentFilters}
                  onClear={applyInstallmentFilters}
                />
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                  <Download className="h-4 w-4" />
                  <span>{exporting ? "Preparing..." : "Export"}</span>
                </Button>
              </div>
            </div>
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => {
              if (!value) return
              setFilter(value)
              setCurrentPage(1)
            }}
            className="mt-4"
          >
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-fit">
              <TabsTrigger className="min-w-fit px-3" value="all">All</TabsTrigger>
              <TabsTrigger className="min-w-fit px-3" value="pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>

        <CardContent className="space-y-4">
          <div className="space-y-3 xl:hidden">
            {paginated.map((inst) => {
              const cfg = statusConfig[inst.status]
              const Icon = cfg.icon
              const isFullyPaid = inst.paidAmount >= inst.amount
              return (
                <article
                  key={inst.id}
                  className={cn(
                    "relative space-y-3 overflow-hidden rounded-lg border bg-card p-3 pl-4 sm:p-4 sm:pl-5",
                    "before:absolute before:inset-y-[20%] before:left-0 before:w-1 before:rounded-full",
                    isFullyPaid ? "before:bg-emerald-500" : "before:bg-amber-500"
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inst.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">{inst.course}</p>
                    </div>
                    {inst.pendingPaymentIds.length > 0 ? (
                      <Badge variant="secondary" className="shrink-0 gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <Clock className="size-3" />
                        Awaiting review
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className={cn("shrink-0 gap-1", cfg.className)}>
                        <Icon className="size-3" />
                        {inst.status}
                      </Badge>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium">{inst.label}</p>
                    {inst.pendingPaymentIds.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        ₹{inst.pendingClaimAmount.toLocaleString("en-IN")} payment awaiting confirmation
                      </p>
                    )}
                    {inst.pendingReference && (
                      <p className="truncate text-xs text-muted-foreground" title={inst.pendingReference}>
                        {inst.pendingReference}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-y py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Amount</p>
                      <p className="truncate text-sm font-medium">₹{inst.amount.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Paid</p>
                      <p className="truncate text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        ₹{inst.paidAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        {inst.pendingClaimAmount > 0 ? "Due after confirmation" : "Still due"}
                      </p>
                      <p className="truncate text-sm font-semibold">₹{inst.remainingBalance.toLocaleString("en-IN")}</p>
                      {inst.pendingClaimAmount > 0 && (
                        <p className="truncate text-[10px] text-muted-foreground">
                          ₹{inst.pendingClaimAmount.toLocaleString("en-IN")} awaiting
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span>Due: {inst.dueDate}</span>
                    <span>Paid: {inst.paidDate ?? "—"}</span>
                  </div>

                  <div className="flex min-h-10 items-center justify-end gap-2 border-t pt-2">
                    {inst.pendingPaymentIds.length > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 gap-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
                        onClick={() => handleConfirmClaim(inst)}
                        disabled={verifyingId !== null}
                        title="Confirm this student payment"
                      >
                        {verifyingId === inst.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Confirm
                      </Button>
                    ) : inst.status !== "Paid" && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10"
                        onClick={() => setCollecting({
                          id: inst.id,
                          student: inst.studentName,
                          label: inst.label,
                          title: inst.course,
                          amount: inst.amount,
                          balance: inst.balance,
                          settleAll: true,
                        })}
                        title="Collect payment against this installment"
                        aria-label={`Collect payment from ${inst.studentName}`}
                      >
                        <Banknote className="size-4 text-emerald-600" />
                      </Button>
                    )}
                    {(inst.status === "Paid" || inst.status === "Partial") && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10"
                        onClick={() => setConfirmUnmark(inst)}
                        title="Reverse verified payments"
                        aria-label={`Reverse verified payments for ${inst.studentName}`}
                        disabled={unmarkingId === inst.id}
                      >
                        {unmarkingId === inst.id
                          ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          : <RotateCcw className="size-4 text-amber-600" />}
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
            {paginated.length === 0 && (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border text-center">
                <Clock className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No installments found</p>
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto xl:block">
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
                const isFullyPaid = inst.paidAmount >= inst.amount
                return (
                  <TableRow
                    key={inst.id}
                  >
                    <TableCell
                      className={cn(
                        "relative before:absolute before:inset-y-[20%] before:left-0 before:w-1 before:rounded-full",
                        isFullyPaid ? "before:bg-emerald-500" : "before:bg-amber-500"
                      )}
                    >
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
                            ₹{inst.pendingClaimAmount.toLocaleString("en-IN")} payment awaiting confirmation
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
                    <TableCell className="font-semibold">
                      ₹{inst.remainingBalance.toLocaleString("en-IN")}
                      {inst.pendingClaimAmount > 0 && (
                        <span className="block whitespace-nowrap text-xs font-normal text-muted-foreground">
                          ₹{inst.pendingClaimAmount.toLocaleString("en-IN")} awaiting confirmation
                        </span>
                      )}
                    </TableCell>
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
                            className="h-10 gap-2 border-emerald-600/30 px-3 text-sm text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
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
                            onClick={() => setCollecting({
                              id: inst.id,
                              student: inst.studentName,
                              label: inst.label,
                              title: inst.course,
                              amount: inst.amount,
                              balance: inst.balance,
                              settleAll: true,
                            })}
                            title="Collect payment against this installment"
                          >
                            <Banknote className="size-4 text-emerald-600" />
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
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Page {currentPage} of {totalPages || 1}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <CollectDialog
        installment={collecting}
        onOpenChange={(open) => { if (!open) setCollecting(null) }}
        onCollected={() => { void fetchInstallments() }}
      />
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
