import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAILY_WINDOW = 14
const TIME_ZONE = "Asia/Kolkata"

function getDatePartsInIST(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: value("year"), month: value("month"), day: value("day") }
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function dateKeyInIST(date: Date): string {
  const { year, month, day } = getDatePartsInIST(date)
  return dateKey(year, month, day)
}

function getMonthKeyFromDateKey(value: string): string {
  return value.slice(0, 7)
}

function dayOf(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const parts = dateStr.split("T")[0].split("-")
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number)
    return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
  }
  const d = new Date(dateStr)
  const { year, month, day } = getDatePartsInIST(d)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-IN", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" })
}

const STATUS_MAP: Record<string, string> = {
  Active: "confirmed",
  Pending: "pending",
  Inactive: "waitlisted",
}

export async function GET(request: Request) {
  const auth = await authenticateAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Dashboard data is unavailable right now." }, { status: 503 })
  }

  try {
    const now = new Date()
    const todayStr = dateKeyInIST(now)
    const [thisYear, thisMonthNumber] = todayStr.split("-").map(Number)
    const thisMonth = thisMonthNumber - 1

    const [
      studentsRes,
      coursesRes,
      paymentsRes,
      branchesRes,
      feesRes,
      installmentsRes,
      transactionsRes,
    ] = await Promise.all([
      supabaseAdmin.from("students").select("id, full_name, course_slug, branch_id, enrollment_date, status"),
      supabaseAdmin.from("courses").select("id, slug, name, short_name, created_at, status"),
      supabaseAdmin
        .from("payments")
        .select("id, student_id, student_name, amount, status, method, payment_date, created_at, installment_id"),
      supabaseAdmin.from("branches").select("id, name"),
      supabaseAdmin.from("fees").select("total_fee, paid_amount, pending_amount"),
      supabaseAdmin.from("fee_installments").select("id, amount, due_date, status"),
      supabaseAdmin.from("transactions").select("amount, type, date"),
    ])

    for (const res of [studentsRes, coursesRes, paymentsRes, branchesRes, feesRes, installmentsRes, transactionsRes]) {
      if (res.error) {
        console.error("[admin dashboard] query failed:", res.error.message)
        return NextResponse.json({ error: "Failed to load dashboard data." }, { status: 502 })
      }
    }

    const students = studentsRes.data ?? []
    const courses = coursesRes.data ?? []
    const payments = paymentsRes.data ?? []
    const branches = branchesRes.data ?? []
    const fees = feesRes.data ?? []
    const installments = installmentsRes.data ?? []
    const transactions = transactionsRes.data ?? []
    const paidByInstallment = new Map<string, number>()
    const pendingByInstallment = new Map<string, number>()
    for (const payment of payments) {
      if (!payment.installment_id) continue
      if (payment.status === "Paid") {
        paidByInstallment.set(
          payment.installment_id,
          (paidByInstallment.get(payment.installment_id) ?? 0) + Number(payment.amount)
        )
      } else if (payment.status === "Pending") {
        pendingByInstallment.set(
          payment.installment_id,
          (pendingByInstallment.get(payment.installment_id) ?? 0) + Number(payment.amount)
        )
      }
    }
    const remainingOnInstallment = (installment: (typeof installments)[number]) => {
      if (installment.status === "Paid") return 0
      const paid = paidByInstallment.get(installment.id) ?? 0
      const balance = Math.max(0, Number(installment.amount) - paid)
      return Math.max(0, balance - (pendingByInstallment.get(installment.id) ?? 0))
    }

    const branchMap = new Map(branches.map((b) => [b.id, b.name]))
    const courseMap = new Map(courses.map((c) => [c.slug, c.short_name || c.name]))

    // --- Stat Cards ---
    const totalStudents = students.length

    const thisMonthCount = students.filter((s) => {
      if (!s.enrollment_date) return false
      return getMonthKeyFromDateKey(dayOf(s.enrollment_date)) === `${thisYear}-${String(thisMonthNumber).padStart(2, "0")}`
    }).length
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
    const lastMonthCount = students.filter((s) => {
      if (!s.enrollment_date) return false
      return getMonthKeyFromDateKey(dayOf(s.enrollment_date)) === `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}`
    }).length
    const growthPct = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : 0
    const studentGrowth = `${growthPct >= 0 ? "+" : ""}${growthPct}% from last month`

    const activeCourseList = courses.filter((c) => c.status === "active")
    const activeCourses = activeCourseList.length
    const quarterStartMonth = Math.floor(thisMonth / 3) * 3 + 1
    const quarterStartKey = `${thisYear}-${String(quarterStartMonth).padStart(2, "0")}`
    const newCourses = courses.filter((c) => getMonthKeyFromDateKey(dateKeyInIST(new Date(c.created_at))) >= quarterStartKey)
    const newCoursesThisQuarter = newCourses.length

    // --- Today ---
    const admissionsToday = students.filter((s) => dayOf(s.enrollment_date) === todayStr).length

    const todaysRows = payments.filter((p) => dayOf(p.payment_date) === todayStr)
    const collectedToday = todaysRows
      .filter((p) => p.status === "Paid")
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const pendingFiledToday = todaysRows.filter((p) => p.status === "Pending").length
    const pendingClaims = payments.filter((p) => p.status === "Pending").length
    const spentToday = transactions
      .filter((t) => t.type === "expense" && dayOf(t.date) === todayStr)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const [todayYear, todayMonth, todayDay] = todayStr.split("-").map(Number)
    const dueThroughDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + 7))
    const dueThroughStr = dateKey(
      dueThroughDate.getUTCFullYear(),
      dueThroughDate.getUTCMonth() + 1,
      dueThroughDate.getUTCDate()
    )
    const dueSoon = installments
      .filter(
        (installment) =>
          installment.status !== "Paid" && installment.due_date >= todayStr && installment.due_date <= dueThroughStr
      )
      .reduce((sum, installment) => sum + remainingOnInstallment(installment), 0)
    const overdue = installments
      .filter((installment) => installment.status !== "Paid" && dayOf(installment.due_date) < todayStr)
      .reduce((sum, installment) => sum + remainingOnInstallment(installment), 0)

    const todayStats = {
      admissions: admissionsToday,
      collected: collectedToday,
      collectedCount: todaysRows.filter((p) => p.status === "Paid").length,
      spent: spentToday,
      pendingClaims,
      pendingFiledToday,
      overdue,
    }

    // --- Month totals behind the money cards ---
    const monthKey = `${thisYear}-${String(thisMonthNumber).padStart(2, "0")}`
    const collectedThisMonth = payments
      .filter((payment) => payment.status === "Paid" && payment.payment_date?.startsWith(monthKey))
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    const grossOutstanding = fees.reduce(
      (sum, fee) => sum + Number(fee.pending_amount ?? Math.max(0, fee.total_fee - fee.paid_amount)),
      0
    )
    const pendingClaimAmount = payments
      .filter((payment) => payment.status === "Pending")
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    const outstanding = Math.max(0, grossOutstanding - pendingClaimAmount)
    const feeSnapshot = { collectedThisMonth, outstanding, dueSoon }

    // --- Daily collections (last 14 days) ---
    const dailyCollections: { day: string; label: string; amount: number }[] = []
    for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay - i))
      const key = dateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      const amount = payments
        .filter((p) => p.status === "Paid" && dayOf(p.payment_date) === key)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      dailyCollections.push({
        day: String(d.getUTCDate()),
        label: `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`,
        amount,
      })
    }

    // --- Enrollment Trends (last 6 months) ---
    const monthLabels: { label: string; key: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(thisYear, thisMonth - i, 1))
      const key = dateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
      monthLabels.push({ label: MONTHS[d.getUTCMonth()], key: getMonthKeyFromDateKey(key) })
    }
    const enrollmentTrends = monthLabels.map(({ label, key }) => {
      const count = students.filter((s) => {
        if (!s.enrollment_date) return false
        return getMonthKeyFromDateKey(dayOf(s.enrollment_date)) === key
      }).length
      return { month: label, students: count }
    })

    // --- Course Enrollment ---
    const courseCountMap = new Map<string, number>()
    students.forEach((s) => {
      if (s.course_slug) {
        courseCountMap.set(s.course_slug, (courseCountMap.get(s.course_slug) || 0) + 1)
      }
    })
    const courseEnrollment = Array.from(courseCountMap.entries())
      .map(([slug, count]) => ({
        course: courseMap.get(slug) || slug,
        enrollments: count,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 6)

    // --- Recent Enrollments ---
    const recentEnrollments = [...students]
      .sort((a, b) => new Date(b.enrollment_date ?? 0).getTime() - new Date(a.enrollment_date ?? 0).getTime())
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.full_name,
        course: courseMap.get(s.course_slug || "") || s.course_slug || "N/A",
        branch: branchMap.get(s.branch_id || "") || "N/A",
        date: formatDate(s.enrollment_date),
        status: s.status ? STATUS_MAP[s.status] || s.status.toLowerCase() : "not set",
      }))

    // --- Payments received today ---
    const todaysPayments = [...todaysRows]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 6)
      .map((p, index) => ({
        key: `${p.id}-${index}`,
        name: p.student_name,
        amount: Number(p.amount),
        method: (p.method || "cash").toUpperCase(),
        status: p.status.toLowerCase(),
        time: formatTime(p.created_at),
      }))

    return NextResponse.json({
      totalStudents,
      studentGrowth,
      activeCourses,
      newCoursesThisQuarter,
      feeSnapshot,
      todayStats,
      dailyCollections,
      enrollmentTrends,
      courseEnrollment,
      recentEnrollments,
      todaysPayments,
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json({ error: "Failed to load dashboard data." }, { status: 500 })
  }
}