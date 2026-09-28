"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CalendarCheck,
  Wallet,
  Award,
  Clock,
  Bell,
  Loader2,
  ShieldQuestion,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { initials, lastName } from "@/lib/name"
import { AWAITING_VERIFICATION } from "@/lib/payment-status"
import { announcementTargetsFor } from "@/lib/announcement-scope"
import { EmptyState, QueryError } from "@/components/student/data-state"

interface FeeRow {
  paid_amount: number
}

interface AnnouncementRow {
  title: string
  published_date: string
  priority: string
}

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true)
  const [studentInfo, setStudentInfo] = useState<{
    name: string
    id: string
    course: string
    branch: string
  } | null>(null)
  const [stats, setStats] = useState<
    { label: string; value: string; icon: typeof CalendarCheck; color: string; bg: string; href: string }[]
  >([])
  const [recentNotices, setRecentNotices] = useState<AnnouncementRow[]>([])
  const [awaitingVerification, setAwaitingVerification] = useState<{
    count: number
    amount: number
    oldestDate: string
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [failedSections, setFailedSections] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single()

      // The only read that can fail the whole page. Everything below is
      // supplementary, so a failure there degrades one card rather than the
      // dashboard. Without this the catch-less `data` destructure turned a
      // permissions or network failure into `student === null`, which rendered
      // "No student data found" — telling a student their record is missing when
      // it was there a second ago and the request simply failed.
      if (studentError || !student) {
        setLoadError(studentError?.message ?? "No student record is linked to this account")
        setLoading(false)
        return
      }

      const { data: course } = student.course_slug
        ? await supabase
            .from("courses")
            .select("name")
            .eq("slug", student.course_slug)
            .maybeSingle()
        : { data: null }

      const { data: branch } = student.branch_id
        ? await supabase
            .from("branches")
            .select("name")
            .eq("id", student.branch_id)
            .maybeSingle()
        : { data: null }

      const { data: fees, error: feesError } = await supabase
        .from("fees")
        .select("paid_amount")
        .eq("student_id", student.id)

      // A failed supplementary read must not become a zero. Every figure below is
      // a claim about a student's record, and a silent `?? 0` turns a dropped
      // connection into "you have paid nothing" — the one number on this page a
      // student would act on. Collected and reported as a dash instead.
      const failed: string[] = []
      if (feesError) {
        console.error("[dashboard] fees lookup failed:", feesError.message)
        failed.push("fees")
      }

      const totalPaid = fees?.reduce((sum: number, f: FeeRow) => sum + f.paid_amount, 0) ?? 0

      // Money the student has already sent but the institute has not yet
      // confirmed. register_student() files the registration payment as `Pending`
      // precisely because a UPI reference is checked by a person, and until that
      // happens `fees.paid_amount` stays at zero — so without this the dashboard
      // reads "Fee Paid ₹0" to someone who has already paid, which reads as a
      // wrong balance rather than as money in transit.
      const { data: pendingPayments } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .eq("student_id", student.id)
        .eq("status", AWAITING_VERIFICATION)

      if (pendingPayments && pendingPayments.length > 0) {
        setAwaitingVerification({
          count: pendingPayments.length,
          amount: pendingPayments.reduce(
            (sum: number, p: { amount: number }) => sum + Number(p.amount),
            0
          ),
          oldestDate: pendingPayments[pendingPayments.length - 1]?.payment_date ?? "",
        })
      }

      const { count: attendanceCount, error: presentError } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .eq("status", "Present")

      const { count: totalDays, error: totalDaysError } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)

      const { count: certCount, error: certError } = await supabase
        .from("certificates")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)

      // Any one of these is a stat card, not the page, so it degrades on its own
      // rather than blanking the dashboard. A failed count is the same trap as a
      // failed sum: `?? 0` would report 0% attendance or 0 certificates.
      for (const [name, err] of [
        ["attendance", presentError ?? totalDaysError],
        ["certificates", certError],
      ] as const) {
        if (err) {
          console.error(`[dashboard] ${name} count failed:`, err.message)
          failed.push(name)
        }
      }

      // Scoped the same way as the announcements page: the target audience this
      // student belongs to, and only notices published since they enrolled. The
      // LIMIT is applied by the server, so these are five notices that are
      // actually theirs rather than five rows that were then discarded.
      let noticesQuery = supabase
        .from("announcements")
        .select("title, published_date, priority")
        .in("target", announcementTargetsFor(student.course_slug ?? null))
        .order("published_date", { ascending: false })
        .limit(5)

      if (student.enrollment_date) {
        noticesQuery = noticesQuery.gte("published_date", student.enrollment_date)
      }

      const { data: announcements, error: noticesError } = await noticesQuery

      if (noticesError) {
        console.error("[dashboard] notices lookup failed:", noticesError.message)
        failed.push("notices")
      }

      const attendancePct =
        totalDays && totalDays > 0
          ? Math.round(((attendanceCount ?? 0) / totalDays) * 100)
          : 0

      const courseName = course?.name ?? student.course_slug ?? "Course"
      const branchName = branch?.name ?? student.branch_id ?? ""

      setStudentInfo({
        name: student.full_name ?? "Student",
        id: student.id,
        course: courseName,
        branch: branchName,
      })

      // "—" rather than 0 for a read that failed. See the comment on `failed`:
      // a dash is visibly not-a-number, and a zero is a claim.
      const dash = "—"

      setStats([
        {
          label: "Attendance",
          value: failed.includes("attendance") ? dash : `${attendancePct}%`,
          icon: CalendarCheck, color: "text-emerald-600", bg: "bg-emerald-500/10", href: "/student/attendance",
        },
        {
          label: "Fee Paid",
          value: failed.includes("fees") ? dash : `₹${totalPaid.toLocaleString("en-IN")}`,
          icon: Wallet, color: "text-violet-600", bg: "bg-violet-500/10", href: "/student/fee",
        },
        {
          label: "Certificates",
          value: failed.includes("certificates") ? dash : String(certCount ?? 0),
          icon: Award, color: "text-amber-600", bg: "bg-amber-500/10", href: "/student/profile/certificates",
        },
        {
          label: "Hours",
          value: failed.includes("attendance") ? dash : String(totalDays ?? 0),
          icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10", href: "/student/profile/payments",
        },
      ])

      if (failed.length > 0) setFailedSections(failed)

      setRecentNotices(
        (announcements ?? []).map((a: AnnouncementRow) => ({
          title: a.title,
          published_date: a.published_date,
          priority: a.priority,
        }))
      )

      setLoading(false)
    }

    fetchData()
  }, [attempt])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // Checked before `!studentInfo`, because a failed read also leaves
  // studentInfo null. Reporting the failure is the whole point: the alternative
  // is "No student data found", which is a claim about the student's account.
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <QueryError
          what="your dashboard"
          detail={loadError}
          onRetry={() => {
            setLoadError(null)
            setAttempt((n) => n + 1)
          }}
        />
      </div>
    )
  }

  if (!studentInfo) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <EmptyState
          title="No student record linked to this account"
          description="Your sign-in worked, but there is no student record attached to it yet. If you have just registered, your enrollment may still be being set up — contact the institute."
        />
      </div>
    )
  }

  // Greeted by surname. `lastName` returns "" for a blank name rather than
  // picking a fallback of its own, so the two fallbacks are applied here where
  // the portal's own wording for an unknown student lives.
  const greetingName = lastName(studentInfo.name) || studentInfo.name || "Student"

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Welcome */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-12 sm:size-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-base sm:text-lg font-bold shrink-0">
              {initials(studentInfo.name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Welcome, {greetingName}!</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{studentInfo.course} &middot; {studentInfo.branch}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification */}
      {awaitingVerification && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ShieldQuestion className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {awaitingVerification.count === 1 ? "Payment" : "Payments"} awaiting verification
                </p>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  &nbsp;&#8377;{awaitingVerification.amount.toLocaleString("en-IN")} submitted
                  {awaitingVerification.oldestDate ? ` on ${awaitingVerification.oldestDate}` : ""}. Our team
                  checks every UPI reference by hand, so your fee balance updates once it clears
                  &mdash; it is not missing.
                </p>
                <Link
                  href="/student/profile/payments"
                  className="mt-2 inline-flex text-xs sm:text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  View payment status
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-2.5 mb-2">
                  <div className={`size-8 sm:size-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`size-4 sm:size-5 ${s.color}`} />
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Notices */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              <h2 className="text-sm sm:text-base font-semibold">Recent Notices</h2>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {failedSections.includes("notices") ? "unavailable" : `${recentNotices.length} new`}
            </Badge>
          </div>

          {/* A failed notices read and a genuine absence of notices are different
              facts, and "0 new" asserts the second. */}
          {failedSections.includes("notices") ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              We couldn&apos;t load notices right now. This is temporary — the rest of your
              dashboard is unaffected.
            </p>
          ) : recentNotices.length === 0 ? (
            <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
              No notices right now.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {recentNotices.map((notice, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2.5 sm:p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium truncate">{notice.title}</p>
                    <p className="text-[11px] text-muted-foreground">{notice.published_date}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] ml-2 shrink-0",
                      notice.priority === "high" && "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}
                  >
                    {notice.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
