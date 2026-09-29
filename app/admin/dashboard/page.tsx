"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, BookOpen, UserPlus, TrendingUp, MapPin, Loader2, IndianRupee, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { tooltipStyle, axisStyle, gridStyle, CHART_PALETTE } from "@/lib/chart-theme";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending: "secondary",
  waitlisted: "outline",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [studentGrowth, setStudentGrowth] = useState("");
  const [activeCourses, setActiveCourses] = useState(0);
  const [newCoursesThisQuarter, setNewCoursesThisQuarter] = useState(0);
  const [feeSnapshot, setFeeSnapshot] = useState({ collectedThisMonth: 0, outstanding: 0, dueSoon: 0 });
  const [enrollmentTrends, setEnrollmentTrends] = useState<{ month: string; students: number }[]>([]);
  const [courseEnrollment, setCourseEnrollment] = useState<{ course: string; enrollments: number }[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { name: string; course: string; branch: string; date: string; status: string }[]
  >([]);
  const [branchRevenue, setBranchRevenue] = useState<{ branch: string; revenue: number }[]>([]);

  async function fetchDashboardData() {
    try {
      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const [studentsRes, coursesRes, paymentsRes, branchesRes, feesRes, installmentsRes] = await Promise.all([
        supabase.from("students").select("id, full_name, course_slug, branch_id, enrollment_date, status"),
        supabase.from("courses").select("id, slug, name, created_at, status"),
        supabase.from("payments").select("id, student_id, amount, status, payment_date"),
        supabase.from("branches").select("id, name"),
        supabase.from("fees").select("total_fee, paid_amount, pending_amount"),
        supabase.from("fee_installments").select("amount, due_date, status"),
      ]);

      const students = getSafeRows(studentsRes, "students");
      const courses = getSafeRows(coursesRes, "courses");
      const payments = getSafeRows(paymentsRes, "payments");
      const branches = getSafeRows(branchesRes, "branches");
      const fees = getSafeRows(feesRes, "fees");
      const installments = getSafeRows(installmentsRes, "fee installments");

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

      const monthKey = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`;
      const collectedThisMonth = payments
        .filter((payment) => payment.status === "Paid" && payment.payment_date?.startsWith(monthKey))
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = fees.reduce(
        (sum, fee) => sum + Number(fee.pending_amount ?? Math.max(0, fee.total_fee - fee.paid_amount)),
        0
      );
      const dueThrough = new Date(now);
      dueThrough.setDate(dueThrough.getDate() + 30);
      const dueThroughStr = getLocalDateStr(dueThrough);
      const dueSoon = installments
        .filter((installment) => installment.status !== "Paid" && installment.due_date >= todayStr && installment.due_date <= dueThroughStr)
        .reduce((sum, installment) => sum + Number(installment.amount), 0);
      setFeeSnapshot({ collectedThisMonth, outstanding, dueSoon });

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

      // --- Branch Revenue ---
      // Verified payments only. Every status was being counted before, so an
      // unverified claim and a reversed one both showed up as branch income.
      const branchRevenueMap = new Map<string, number>();
      const studentMap = new Map(students.map((s) => [s.id, s]));
      payments.forEach((p) => {
        if (p.status !== "Paid") return;
        const student = studentMap.get(p.student_id);
        const branchId = student?.branch_id;
        const branchName = branchId ? branchMap.get(branchId) : null;
        if (branchName) {
          branchRevenueMap.set(branchName, (branchRevenueMap.get(branchName) || 0) + p.amount);
        }
      });
      const branchRevData = Array.from(branchRevenueMap.entries())
        .map(([branch, revenue]) => ({
          branch,
          revenue: Math.round((revenue / 100000) * 10) / 10,
        }))
        .sort((a, b) => b.revenue - a.revenue);
      setBranchRevenue(branchRevData);

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
      title: "Active Courses",
      value: String(activeCourses),
      icon: BookOpen,
      description: `${newCoursesThisQuarter} new this quarter`,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Collected This Month",
      value: `₹${feeSnapshot.collectedThisMonth.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      description: "Verified payments",
      color: "text-sky-600",
      bgColor: "bg-sky-500/10",
    },
    {
      title: "Outstanding Fees",
      value: `₹${feeSnapshot.outstanding.toLocaleString("en-IN")}`,
      icon: Wallet,
      description: `₹${feeSnapshot.dueSoon.toLocaleString("en-IN")} due in 30 days`,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
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
        <p className="text-xs text-muted-foreground">Welcome back, Admin</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.title}</p>
              <p className="text-sm font-bold shrink-0">{stat.value}</p>
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
        {/* Branch Revenue Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Branch Revenue
            </CardTitle>
            <CardDescription className="text-xs">Revenue contribution (in ₹L)</CardDescription>
          </CardHeader>
          <CardContent>
            {branchRevenue.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No revenue data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={branchRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="branch"
                    label={({ name, value }) => `${name}: ₹${value}L`}
                  >
                    {branchRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Fee Snapshot
            </CardTitle>
            <CardDescription className="text-xs">Verified collection and upcoming dues</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-sm text-muted-foreground">Collected this month</span>
              <span className="text-sm font-semibold">₹{feeSnapshot.collectedThisMonth.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-sm text-muted-foreground">Outstanding balance</span>
              <span className="text-sm font-semibold">₹{feeSnapshot.outstanding.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Due in next 30 days</span>
              <span className="text-sm font-semibold">₹{feeSnapshot.dueSoon.toLocaleString("en-IN")}</span>
            </div>
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

      </div>
    </div>
  );
}
