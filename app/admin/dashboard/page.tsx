"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Users,
  BookOpen,
  UserPlus,
  TrendingUp,
  Loader2,
  IndianRupee,
  Wallet,
  CalendarDays,
  Banknote,
  ListChecks,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { tooltipStyle, axisStyle, gridStyle } from "@/lib/chart-theme";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  confirmed: "default",
  pending: "secondary",
  partial: "outline",
  rejected: "destructive",
  overdue: "destructive",
  waitlisted: "outline",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Days shown on the daily collection chart. */
const DAILY_WINDOW = 14;

function formatDate(dateStr: string): string {
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
  }
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

/** Date columns come back as `YYYY-MM-DD`; compare them as text, never via `new Date`. */
function dayOf(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function getSafeRows<T>(result: { data: T[] | null; error: { message?: string } | null }, label: string): T[] {
  if (result.error) {
    console.error(`[admin dashboard] ${label} query failed:`, result.error.message || result.error);
    return [];
  }

  return result.data ?? [];
}

const STATUS_MAP: Record<string, string> = {
  Active: "confirmed",
  Pending: "pending",
  Inactive: "waitlisted",
};

type GlanceRow = { label: string; value: string; icon: typeof Users };

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [studentGrowth, setStudentGrowth] = useState("");
  const [activeCourses, setActiveCourses] = useState(0);
  const [newCoursesThisQuarter, setNewCoursesThisQuarter] = useState(0);
  const [feeSnapshot, setFeeSnapshot] = useState({ collectedThisMonth: 0, outstanding: 0, dueSoon: 0 });
  const [todayStats, setTodayStats] = useState({
    admissions: 0,
    collected: 0,
    collectedCount: 0,
    spent: 0,
    pendingClaims: 0,
    pendingFiledToday: 0,
    overdue: 0,
  });
  const [dailyCollections, setDailyCollections] = useState<{ day: string; label: string; amount: number }[]>([]);
  const [enrollmentTrends, setEnrollmentTrends] = useState<{ month: string; students: number }[]>([]);
  const [courseEnrollment, setCourseEnrollment] = useState<{ course: string; enrollments: number }[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { name: string; course: string; branch: string; date: string; status: string }[]
  >([]);
  const [todaysPayments, setTodaysPayments] = useState<
    { key: string; name: string; amount: number; method: string; status: string; time: string }[]
  >([]);

  async function fetchDashboardData() {
    try {
      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const [studentsRes, coursesRes, paymentsRes, branchesRes, feesRes, installmentsRes, transactionsRes] =
        await Promise.all([
          supabase.from("students").select("id, full_name, course_slug, branch_id, enrollment_date, status"),
          supabase.from("courses").select("id, slug, name, created_at, status"),
          supabase
            .from("payments")
            .select("id, student_id, student_name, amount, status, method, payment_date, created_at"),
          supabase.from("branches").select("id, name"),
          supabase.from("fees").select("total_fee, paid_amount, pending_amount"),
          supabase.from("fee_installments").select("amount, due_date, status"),
          supabase.from("transactions").select("amount, type, date"),
        ]);

      const students = getSafeRows(studentsRes, "students");
      const courses = getSafeRows(coursesRes, "courses");
      const payments = getSafeRows(paymentsRes, "payments");
      const branches = getSafeRows(branchesRes, "branches");
      const fees = getSafeRows(feesRes, "fees");
      const installments = getSafeRows(installmentsRes, "fee installments");
      const transactions = getSafeRows(transactionsRes, "transactions");

      const branchMap = new Map(branches.map((b) => [b.id, b.name]));
      const courseMap = new Map(courses.map((c) => [c.slug, c.name]));

      // --- Stat Cards ---
      setTotalStudents(students.length);

      const thisMonthCount = students.filter((s) => {
        const d = new Date(s.enrollment_date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length;
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthCount = students.filter((s) => {
        const d = new Date(s.enrollment_date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }).length;
      const growthPct = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : 0;
      setStudentGrowth(`${growthPct >= 0 ? "+" : ""}${growthPct}% from last month`);

      const activeCourseList = courses.filter((c) => c.status === "active");
      setActiveCourses(activeCourseList.length);
      const quarterStart = new Date(thisYear, Math.floor(thisMonth / 3) * 3, 1);
      const newCourses = courses.filter((c) => new Date(c.created_at) >= quarterStart);
      setNewCoursesThisQuarter(newCourses.length);

      // --- Today ---
      const admissionsToday = students.filter((s) => dayOf(s.enrollment_date) === todayStr).length;

      const todaysRows = payments.filter((p) => dayOf(p.payment_date) === todayStr);
      const collectedToday = todaysRows
        .filter((p) => p.status === "Paid")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingFiledToday = todaysRows.filter((p) => p.status === "Pending").length;
      const pendingClaims = payments.filter((p) => p.status === "Pending").length;
      const spentToday = transactions
        .filter((t) => t.type === "expense" && dayOf(t.date) === todayStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const dueThrough = new Date(now);
      dueThrough.setDate(dueThrough.getDate() + 7);
      const dueThroughStr = getLocalDateStr(dueThrough);
      const dueSoon = installments
        .filter(
          (installment) =>
            installment.status !== "Paid" && installment.due_date >= todayStr && installment.due_date <= dueThroughStr
        )
        .reduce((sum, installment) => sum + Number(installment.amount), 0);
      const overdue = installments
        .filter((installment) => installment.status !== "Paid" && dayOf(installment.due_date) < todayStr)
        .reduce((sum, installment) => sum + Number(installment.amount), 0);

      setTodayStats({
        admissions: admissionsToday,
        collected: collectedToday,
        collectedCount: todaysRows.filter((p) => p.status === "Paid").length,
        spent: spentToday,
        pendingClaims,
        pendingFiledToday,
        overdue,
      });

      // --- Month totals behind the money cards ---
      const monthKey = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;
      const collectedThisMonth = payments
        .filter((payment) => payment.status === "Paid" && payment.payment_date?.startsWith(monthKey))
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = fees.reduce(
        (sum, fee) => sum + Number(fee.pending_amount ?? Math.max(0, fee.total_fee - fee.paid_amount)),
        0
      );
      setFeeSnapshot({ collectedThisMonth, outstanding, dueSoon });

      // --- Daily collections (last 14 days) ---
      const dailySeries: { day: string; label: string; amount: number }[] = [];
      for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = getLocalDateStr(d);
        const amount = payments
          .filter((p) => p.status === "Paid" && dayOf(p.payment_date) === key)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        dailySeries.push({
          day: String(d.getDate()),
          label: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`,
          amount,
        });
      }
      setDailyCollections(dailySeries);

      // --- Enrollment Trends (last 6 months) ---
      const monthLabels: { label: string; key: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(thisYear, thisMonth - i, 1);
        monthLabels.push({ label: MONTHS[d.getMonth()], key: getMonthKey(d) });
      }
      const trends = monthLabels.map(({ label, key }) => {
        const count = students.filter((s) => {
          const ed = new Date(s.enrollment_date);
          return getMonthKey(ed) === key;
        }).length;
        return { month: label, students: count };
      });
      setEnrollmentTrends(trends);

      // --- Course Enrollment ---
      const courseCountMap = new Map<string, number>();
      students.forEach((s) => {
        if (s.course_slug) {
          courseCountMap.set(s.course_slug, (courseCountMap.get(s.course_slug) || 0) + 1);
        }
      });
      const courseEnrollData = Array.from(courseCountMap.entries())
        .map(([slug, count]) => ({
          course: courseMap.get(slug) || slug,
          enrollments: count,
        }))
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 6);
      setCourseEnrollment(courseEnrollData);

      // --- Recent Enrollments ---
      const recent = [...students]
        .sort((a, b) => new Date(b.enrollment_date).getTime() - new Date(a.enrollment_date).getTime())
        .slice(0, 5)
        .map((s) => ({
          name: s.full_name,
          course: courseMap.get(s.course_slug || "") || s.course_slug || "N/A",
          branch: branchMap.get(s.branch_id || "") || "N/A",
          date: formatDate(s.enrollment_date),
          status: STATUS_MAP[s.status] || s.status.toLowerCase(),
        }));
      setRecentEnrollments(recent);

      // --- Payments received today ---
      setTodaysPayments(
        [...todaysRows]
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
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: "Total Students",
      value: totalStudents.toLocaleString(),
      icon: Users,
      description: studentGrowth,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Admissions Today",
      value: String(todayStats.admissions),
      icon: UserPlus,
      description: "New students enrolled today",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Collected Today",
      value: `₹${todayStats.collected.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      description: `${todayStats.collectedCount} payment${todayStats.collectedCount === 1 ? "" : "s"} received`,
      color: "text-sky-600",
      bgColor: "bg-sky-500/10",
    },
    {
      title: "Spent Today",
      value: `₹${todayStats.spent.toLocaleString("en-IN")}`,
      icon: Banknote,
      description: "Expenses recorded today",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      title: "Outstanding Fees",
      value: `₹${feeSnapshot.outstanding.toLocaleString("en-IN")}`,
      icon: Wallet,
      description: `₹${todayStats.overdue.toLocaleString("en-IN")} overdue now`,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Active Courses",
      value: String(activeCourses),
      icon: BookOpen,
      description: `${newCoursesThisQuarter} new this quarter`,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  const glanceRows: GlanceRow[] = [
    {
      label: "Admissions today",
      value: String(todayStats.admissions),
      icon: UserPlus,
    },
    {
      label: "Collected today",
      value: `₹${todayStats.collected.toLocaleString("en-IN")}`,
      icon: IndianRupee,
    },
    {
      label: "Collected this month",
      value: `₹${feeSnapshot.collectedThisMonth.toLocaleString("en-IN")}`,
      icon: CalendarDays,
    },
    {
      label: "Awaiting verification",
      value: `${todayStats.pendingClaims} (${todayStats.pendingFiledToday} today)`,
      icon: ListChecks,
    },
    {
      label: "Overdue now",
      value: `₹${todayStats.overdue.toLocaleString("en-IN")}`,
      icon: Clock,
    },
    {
      label: "Due in next 7 days",
      value: `₹${feeSnapshot.dueSoon.toLocaleString("en-IN")}`,
      icon: Wallet,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          Welcome back, Admin — here is how today is going ({new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`size-4 ${stat.color}`} />
                  </span>
                  <p className="truncate text-[11px] text-muted-foreground">{stat.title}</p>
                </div>
                <p className="text-sm font-bold shrink-0">{stat.value}</p>
              </div>
              <p className="truncate pl-10 text-[11px] text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Student Enrollment Trends
            </CardTitle>
            <CardDescription className="text-xs">Monthly enrollment over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={enrollmentTrends}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="students" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorStudents)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Course Enrollment
            </CardTitle>
            <CardDescription className="text-xs">Top 6 courses by student count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={courseEnrollment}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="course" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="enrollments" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Daily Collections
            </CardTitle>
            <CardDescription className="text-xs">
              Money received each day over the last {DAILY_WINDOW} days (verified payments only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyCollections.every((entry) => entry.amount === 0) ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No collections in the last {DAILY_WINDOW} days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyCollections}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="day" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.label ?? ""}
                    formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Collected"]}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Today at a Glance
            </CardTitle>
            <CardDescription className="text-xs">Where the day stands right now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {glanceRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <row.icon className="size-4 shrink-0" />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="text-sm font-semibold shrink-0">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Enrollments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" />
                  Recent Enrollments
                </CardTitle>
                <CardDescription className="text-xs">Latest student registrations</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/student")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                No recent enrollments yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Course</th>
                      <th className="hidden pb-3 pr-4 md:table-cell">Branch</th>
                      <th className="hidden pb-3 pr-4 sm:table-cell">Date</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEnrollments.map((enrollment) => (
                      <tr
                        key={`${enrollment.name}-${enrollment.date}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                              {enrollment.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            <span className="font-medium">{enrollment.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {enrollment.course}
                        </td>
                        <td className="hidden py-3 pr-4 text-muted-foreground md:table-cell">
                          {enrollment.branch}
                        </td>
                        <td className="hidden py-3 pr-4 text-muted-foreground sm:table-cell">
                          {enrollment.date}
                        </td>
                        <td className="py-3 text-right">
                          <Badge variant={statusVariant[enrollment.status]}>
                            {enrollment.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments received today */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IndianRupee className="h-4 w-4" />
                  Payments Today
                </CardTitle>
                <CardDescription className="text-xs">Every payment logged today</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/payments")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todaysPayments.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-center text-sm text-muted-foreground">
                No payments recorded yet today
              </div>
            ) : (
              <ul className="space-y-3">
                {todaysPayments.map((payment) => (
                  <li
                    key={payment.key}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{payment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.method} · {payment.time}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold">
                        ₹{payment.amount.toLocaleString("en-IN")}
                      </span>
                      <Badge variant={statusVariant[payment.status] ?? "outline"} className="text-[10px]">
                        {payment.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
