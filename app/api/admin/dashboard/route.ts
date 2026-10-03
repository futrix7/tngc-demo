import { NextResponse } from "next/server"
import { authenticateAdminRequest, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase-admin"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAILY_WINDOW = 14

function getLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`
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
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
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
    const todayStr = getLocalDateStr(now)
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

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
      supabaseAdmin.from("courses").select("id, slug, name, created_at, status"),
      supabaseAdmin
        .from("payments")
        .select("id, student_id, student_name, amount, status, method, payment_date, created_at"),
      supabaseAdmin.from("branches").select("id, name"),
      supabaseAdmin.from("fees").select("total_fee, paid_amount, pending_amount"),
      supabaseAdmin.from("fee_installments").select("amount, due_date, status"),
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

    const branchMap = new Map(branches.map((b) => [b.id, b.name]))
    const courseMap = new Map(courses.map((c) => [c.slug, c.name]))

    // --- Stat Cards ---
    const totalStudents = students.length

    const thisMonthCount = students.filter((s) => {
      if (!s.enrollment_date) return false
      const d = new Date(s.enrollment_date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
    const lastMonthCount = students.filter((s) => {
      if (!s.enrollment_date) return false
      const d = new Date(s.enrollment_date)
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
    }).length
    const growthPct = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : 0
    const studentGrowth = `${growthPct >= 0 ? "+" : ""}${growthPct}% from last month`

    const activeCourseList = courses.filter((c) => c.status === "active")
    const activeCourses = activeCourseList.length
    const quarterStart = new Date(thisYear, Math.floor(thisMonth / 3) * 3, 1)
    const newCourses = courses.filter((c) => new Date(c.created_at) >= quarterStart)
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

    const dueThrough = new Date(now)
    dueThrough.setDate(dueThrough.getDate() + 7)
    const dueThroughStr = getLocalDateStr(dueThrough)
    const dueSoon = installments
      .filter(
        (installment) =>
          installment.status !== "Paid" && installment.due_date >= todayStr && installment.due_date <= dueThroughStr
      )
      .reduce((sum, installment) => sum + Number(installment.amount), 0)
    const overdue = installments
      .filter((installment) => installment.status !== "Paid" && dayOf(installment.due_date) < todayStr)
      .reduce((sum, installment) => sum + Number(installment.amount), 0)

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
    const monthKey = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`
    const collectedThisMonth = payments
      .filter((payment) => payment.status === "Paid" && payment.payment_date?.startsWith(monthKey))
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    const outstanding = fees.reduce(
      (sum, fee) => sum + Number(fee.pending_amount ?? Math.max(0, fee.total_fee - fee.paid_amount)),
      0
    )
    const feeSnapshot = { collectedThisMonth, outstanding, dueSoon }

    // --- Daily collections (last 14 days) ---
    const dailyCollections: { day: string; label: string; amount: number }[] = []
    for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = getLocalDateStr(d)
      const amount = payments
        .filter((p) => p.status === "Paid" && dayOf(p.payment_date) === key)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      dailyCollections.push({
        day: String(d.getDate()),
        label: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`,
        amount,
      })
    }

    // --- Enrollment Trends (last 6 months) ---
    const monthLabels: { label: string; key: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      monthLabels.push({ label: MONTHS[d.getMonth()], key: getMonthKey(d) })
    }
    const enrollmentTrends = monthLabels.map(({ label, key }) => {
      const count = students.filter((s) => {
        if (!s.enrollment_date) return false
        const ed = new Date(s.enrollment_date)
        return getMonthKey(ed) === key
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