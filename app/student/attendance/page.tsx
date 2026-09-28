"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Check,
  X,
  Minus,
  Flame,
  TrendingUp,
  CalendarDays,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { QueryError } from "@/components/student/data-state"

interface WeeklyDay {
  day: string
  date: string
  status: string
  in: string
  out: string
}

interface MonthlyRow {
  month: string
  present: number
  absent: number
  late: number
  leave: number
  total: number
  pct: number
}

interface RecentLogRow {
  date: string
  day: string
  status: "Present" | "Absent" | "Late" | "Leave"
  in: string
  out: string
  hours: string
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Present: { icon: Check, color: "text-emerald-600", bg: "bg-emerald-500/15" },
  Absent: { icon: X, color: "text-red-600", bg: "bg-red-500/15" },
  Late: { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/15" },
  Leave: { icon: Minus, color: "text-blue-600", bg: "bg-blue-500/15" },
  // Nothing has been marked yet, which is not the same fact as "did not turn
  // up". Rendering that as Absent turns an untouched register into a week of
  // red crosses.
  Unmarked: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, "0")
  const day = d.getDate().toString().padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const match = String(iso).match(/(\d{1,2}):(\d{2})/)
  if (match) {
    const h = parseInt(match[1], 10)
    const m = match[2]
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${m} ${ampm}`
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, "0")
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatHours(hours: number | null): string {
  if (!hours) return "—"
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${monthNames[d.getMonth()]}`
}

function getDayOfWeek(dateStr: string): string {
  return dayNames[new Date(dateStr).getDay()]
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
}

export default function StudentAttendance() {
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState("recent")
  const [courseName, setCourseName] = useState("Course")
  const [branchName, setBranchName] = useState("")
  const [todayStatus, setTodayStatus] = useState<{ status: string; date: string; day: string; timeIn: string | null; timeOut: string | null } | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([])
  const [recentLog, setRecentLog] = useState<RecentLogRow[]>([])
  const [streak, setStreak] = useState(0)
  const [weekHighlight, setWeekHighlight] = useState<boolean[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      setLoadError(null)
      // Reset rather than overwritten below: a retry after today's row was
      // removed would otherwise keep showing the previous answer.
      setTodayStatus(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, course_slug, branch_id")
        .eq("user_id", user.id)
        .single()

      if (studentError || !student) {
        setLoadError(studentError?.message ?? "No student record is linked to this account")
        setLoading(false)
        return
      }

      if (student.course_slug) {
        setCourseName(student.course_slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()))
      }

      // Read from the branch row. This line used to name "Ramanthapur" for
      // every student regardless of where they actually study, which is a
      // wrong fact about the reader printed under their own attendance.
      const { data: branch } = student.branch_id
        ? await supabase.from("branches").select("name").eq("id", student.branch_id).maybeSingle()
        : { data: null }
      setBranchName(branch?.name ?? student.branch_id ?? "")

      const { data: records, error: recordsError } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student.id)
        .order("date", { ascending: false })

      // Distinguished from "no records": this page's entire content is derived
      // from `records`, so swallowing the error left a full week of "Absent" and
      // a 0% streak — an accusation, rendered from a request that never landed.
      if (recordsError) {
        console.error("[attendance] records lookup failed:", recordsError.message)
        setLoadError(recordsError.message)
        setLoading(false)
        return
      }

      // An empty register is a state of the record, not a failure and not a
      // reason to hide the page: the counters should read zero rather than the
      // screen collapsing into "nothing here yet", which reads as though the
      // institute has no attendance system at all.
      const rows = records ?? []
      const registerFilled = rows.length > 0

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = formatDateKey(today)
      const todayRecord = rows.find((r) => r.date === todayStr)
      if (todayRecord) {
        setTodayStatus({
          status: todayRecord.status,
          date: formatDateFull(todayRecord.date),
          day: getDayOfWeek(todayRecord.date),
          timeIn: todayRecord.time_in,
          timeOut: todayRecord.time_out,
        })
      }

      const startOfWeek = new Date(today)
      const dayOfWeek = startOfWeek.getDay()
      startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      startOfWeek.setHours(0, 0, 0, 0)

      const weekDays: WeeklyDay[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek)
        d.setDate(d.getDate() + i)
        const dateStr = formatDateKey(d)
        const rec = rows.find((r) => r.date === dateStr)
        const isSunday = d.getDay() === 0
        weekDays.push({
          day: dayNames[d.getDay()],
          date: formatDateShort(dateStr),
          status:
            isSunday && !rec
              ? "Holiday"
              : rec
                ? rec.status
                : registerFilled
                  ? "Absent"
                  : "Unmarked",
          in: rec?.time_in ? formatTime(rec.time_in) : "—",
          out: rec?.time_out ? formatTime(rec.time_out) : "—",
        })
      }
      setWeeklyData(weekDays)

      const weekHighlights = weekDays.map((d) => d.status === "Present" || d.status === "Leave")
      setWeekHighlight(weekHighlights)

      const monthMap = new Map<string, { present: number; absent: number; late: number; leave: number; total: number }>()
      for (const rec of rows) {
        const d = new Date(rec.date)
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        if (!monthMap.has(key)) {
          monthMap.set(key, { present: 0, absent: 0, late: 0, leave: 0, total: 0 })
        }
        const entry = monthMap.get(key)!
        entry.total++
        if (rec.status === "Present") entry.present++
        else if (rec.status === "Absent") entry.absent++
        else if (rec.status === "Late") entry.late++
        else if (rec.status === "Leave") entry.leave++
      }

      const monthlyArr: MonthlyRow[] = Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        present: data.present,
        absent: data.absent,
        late: data.late,
        leave: data.leave,
        total: data.total,
        pct: data.total > 0 ? Math.round(((data.present + data.late) / data.total) * 100) : 0,
      }))
      setMonthlyData(monthlyArr)

      const logRows: RecentLogRow[] = rows.slice(0, 10).map((rec) => ({
        date: formatDateFull(rec.date),
        day: getDayOfWeek(rec.date),
        status: rec.status as "Present" | "Absent" | "Late" | "Leave",
        in: rec.time_in ? formatTime(rec.time_in) : "—",
        out: rec.time_out ? formatTime(rec.time_out) : "—",
        hours: formatHours(rec.hours),
      }))
      setRecentLog(logRows)

      let currentStreak = 0
      const todayMidnight = new Date(today)
      for (let i = 0; i < 365; i++) {
        const d = new Date(todayMidnight)
        d.setDate(d.getDate() - i)
        const dateStr = formatDateKey(d)
        const rec = rows.find((r) => r.date === dateStr)
        if (rec && rec.status === "Present") {
          currentStreak++
        } else {
          break
        }
      }
      setStreak(currentStreak)

      setLoading(false)
    }

    fetchAttendance()
  }, [attempt])

  const totalPresent = monthlyData.reduce((s, m) => s + m.present, 0)
  const totalAbsent = monthlyData.reduce((s, m) => s + m.absent, 0)
  const totalLate = monthlyData.reduce((s, m) => s + m.late, 0)
  const totalLeave = monthlyData.reduce((s, m) => s + m.leave, 0)
  const totalDays = totalPresent + totalAbsent + totalLate + totalLeave
  const overallPct = totalDays > 0 ? Math.round(((totalPresent + totalLate) / totalDays) * 100) : 0

  // Whether the register holds anything at all. Derived from the log rather
  // than tracked as its own flag: the log is the first ten rows of the same
  // query, so it is empty exactly when the register is.
  const hasRecords = recentLog.length > 0

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center py-20">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 lg:p-8">
        <h1 className="text-lg font-bold sm:text-xl">Attendance</h1>
        <QueryError
          what="your attendance records"
          detail={loadError}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-lg sm:text-xl font-bold">Attendance</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {courseName}
          {branchName && <> &middot; {branchName}</>}
        </p>
      </div>

      {/* An untouched register still gets a full page of zeros. This line says
          why they are zero, so a brand-new student does not read 0% as a
          verdict. */}
      {!hasRecords && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs sm:text-sm text-muted-foreground">
          Nothing has been marked for {courseName} yet. Your record starts appearing
          here as soon as a class is marked.
        </p>
      )}

      {/* Today's Status */}
      {todayStatus && (
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 sm:size-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="size-5 sm:size-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-600">Present Today</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">{todayStatus.date} &middot; {todayStatus.day}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>In: {todayStatus.timeIn ? formatTime(todayStatus.timeIn) : "—"}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="size-3" />
                  <span>Out: {todayStatus.timeOut ? formatTime(todayStatus.timeOut) : "—"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="inline-flex size-9 sm:size-10 items-center justify-center rounded-lg bg-primary/10 mb-1.5">
              <TrendingUp className="size-4 sm:size-5 text-primary" />
            </div>
            <p className="text-lg sm:text-xl font-bold">{overallPct}%</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Overall</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="inline-flex size-9 sm:size-10 items-center justify-center rounded-lg bg-emerald-500/10 mb-1.5">
              <Check className="size-4 sm:size-5 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-600">{totalPresent}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="inline-flex size-9 sm:size-10 items-center justify-center rounded-lg bg-red-500/10 mb-1.5">
              <X className="size-4 sm:size-5 text-red-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-red-600">{totalAbsent}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="inline-flex size-9 sm:size-10 items-center justify-center rounded-lg bg-amber-500/10 mb-1.5">
              <AlertTriangle className="size-4 sm:size-5 text-amber-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-amber-600">{totalLeave}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Leave</p>
          </CardContent>
        </Card>
      </div>

      {/* Streak */}
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 sm:size-11 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <Flame className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-semibold">Current Streak</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Keep it up!</p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-600">{streak} days</p>
          </div>
          <div className="mt-3 flex gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-7 sm:h-8 rounded-md flex items-center justify-center text-[10px] sm:text-[11px] font-medium",
                  i < weekHighlight.length && weekHighlight[i] ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                )}
              >
                {d}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <h2 className="text-sm sm:text-base font-semibold">This Week</h2>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weeklyData.map((d, i) => {
              const cfg = d.status === "Holiday" ? { bg: "bg-muted", color: "text-muted-foreground" } : statusConfig[d.status]
              return (
                <div key={i} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{d.day}</p>
                  <div className={cn("size-8 sm:size-9 mx-auto rounded-full flex items-center justify-center text-[10px] font-medium", cfg.bg, cfg.color)}>
                    {d.status === "Present" ? <Check className="size-3.5" /> : d.status === "Absent" ? <X className="size-3.5" /> : d.status === "Leave" ? <Minus className="size-3.5" /> : "—"}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">{d.date.split(" ")[0]}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Recent / Monthly */}
      <Tabs value={view} onValueChange={(v) => setView(v ?? "recent")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="recent">Recent Log</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "recent" && (
        <div className="space-y-2.5">
          {recentLog.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No classes have been marked yet.
            </p>
          )}
          {recentLog.map((day, i) => {
            const cfg = (day.status as string) === "Holiday" ? { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" } : statusConfig[day.status as keyof typeof statusConfig]
            const Icon = cfg.icon
            return (
              <Card key={i}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={cn("size-8 sm:size-9 rounded-full flex items-center justify-center", cfg.bg)}>
                        <Icon className={cn("size-4", cfg.color)} />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium">{day.date}</p>
                        <p className="text-[11px] text-muted-foreground">{day.day} &middot; {day.in !== "—" ? `${day.in} – ${day.out}` : "No record"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:inline">{day.hours}</span>
                      <Badge variant="secondary" className={cn("text-[10px]", cfg.bg, cfg.color)}>{day.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {view === "monthly" && (
        <div className="space-y-3">
          {monthlyData.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Monthly totals appear once attendance has been marked.
            </p>
          )}
          {monthlyData.map((m, i) => (
            <Card key={i}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{m.month}</p>
                  <p className={cn("text-sm font-bold", m.pct >= 85 ? "text-emerald-600" : m.pct >= 75 ? "text-amber-600" : "text-red-600")}>
                    {m.pct}%
                  </p>
                </div>
                <Progress value={m.pct} className="h-2 mb-2.5" />
                <div className="flex items-center gap-4 text-[11px] sm:text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Check className="size-3 text-emerald-600" />{m.present} present</span>
                  <span className="flex items-center gap-1"><Clock className="size-3 text-amber-600" />{m.late} late</span>
                  <span className="flex items-center gap-1"><X className="size-3 text-red-600" />{m.absent} absent</span>
                  <span className="flex items-center gap-1"><Minus className="size-3 text-blue-600" />{m.leave} leave</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
