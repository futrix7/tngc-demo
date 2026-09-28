"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, BookOpen, Download, ArrowUpRight, Activity, Calendar, Zap, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ExportDialog } from "@/components/admin/export-dialog";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { tooltipStyle, axisStyle, gridStyle, CHART_PALETTE } from "@/lib/chart-theme";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Course = Database["public"]["Tables"]["courses"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Branch = Database["public"]["Tables"]["branches"]["Row"];

const TABS = ["This Month", "This Quarter", "This Year"] as const;

function getMonthName(monthIndex: number) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[monthIndex];
}

function getWeekLabel(date: Date): string {
  const dayOfMonth = date.getDate();
  const weekNum = Math.ceil(dayOfMonth / 7);
  return `Week ${weekNum}`;
}

function computeEnrollmentTrends(students: Student[], activeTab: string) {
  const now = new Date();
  if (activeTab === "This Month") {
    const grouped: Record<string, number> = {};
    students.forEach((s) => {
      const d = new Date(s.enrollment_date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        const label = getWeekLabel(d);
        grouped[label] = (grouped[label] || 0) + 1;
      }
    });
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];
    return weeks.map((w) => ({ month: w, value: grouped[w] || 0 }));
  }
  if (activeTab === "This Quarter") {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const grouped: Record<string, number> = {};
    students.forEach((s) => {
      const d = new Date(s.enrollment_date);
      if (Math.floor(d.getMonth() / 3) * 3 === quarterMonth && d.getFullYear() === now.getFullYear()) {
        const label = getMonthName(d.getMonth());
        grouped[label] = (grouped[label] || 0) + 1;
      }
    });
    return [0, 1, 2].map((i) => ({ month: getMonthName(quarterMonth + i), value: grouped[getMonthName(quarterMonth + i)] || 0 }));
  }
  const grouped: Record<string, number> = {};
  students.forEach((s) => {
    const d = new Date(s.enrollment_date);
    if (d.getFullYear() === now.getFullYear()) {
      const label = getMonthName(d.getMonth());
      grouped[label] = (grouped[label] || 0) + 1;
    }
  });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((m) => ({ month: m, value: grouped[m] || 0 }));
}

function computeTabTotals(students: Student[], activeTab: string) {
  const now = new Date();
  const filtered = students.filter((s) => {
    const d = new Date(s.enrollment_date);
    if (activeTab === "This Month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (activeTab === "This Quarter") {
      return Math.floor(d.getMonth() / 3) * 3 === Math.floor(now.getMonth() / 3) * 3 && d.getFullYear() === now.getFullYear();
    }
    return d.getFullYear() === now.getFullYear();
  });
  return filtered.length;
}

function computeBranchData(students: Student[], branches: Branch[]) {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const grouped: Record<string, number> = {};
  students.forEach((s) => {
    if (s.branch_id) {
      const name = branchMap.get(s.branch_id) || s.branch_id;
      grouped[name] = (grouped[name] || 0) + 1;
    }
  });
  return Object.entries(grouped)
    .map(([name, students]) => ({ name, students }))
    .sort((a, b) => b.students - a.students);
}

function computeRevenueTrend(transactions: Transaction[]) {
  const now = new Date();
  const grouped: Record<string, { revenue: number; expenses: number }> = {};
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  months.forEach((m) => (grouped[m] = { revenue: 0, expenses: 0 }));

  transactions.forEach((t) => {
    const d = new Date(t.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()) {
      const label = getMonthName(d.getMonth());
      if (t.type === "income") grouped[label].revenue += t.amount;
      else grouped[label].expenses += t.amount;
    }
  });

  return months.slice(0, now.getMonth()).map((m) => ({
    month: m,
    revenue: Math.round((grouped[m].revenue / 100000) * 10) / 10,
    expenses: Math.round((grouped[m].expenses / 100000) * 10) / 10,
  }));
}

function computeCompletionData(students: Student[], activeTab: string) {
  const now = new Date();
  const filtered = students.filter((s) => {
    const d = new Date(s.enrollment_date);
    if (activeTab === "This Month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (activeTab === "This Quarter") return Math.floor(d.getMonth() / 3) * 3 === Math.floor(now.getMonth() / 3) * 3 && d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear();
  });
  const total = filtered.length || 1;
  const active = filtered.filter((s) => s.status === "Active").length;
  const inactive = filtered.filter((s) => s.status === "Inactive").length;
  const pending = filtered.filter((s) => s.status === "Pending").length;
  return [
    { name: "Completed", value: Math.round((active / total) * 100) },
    { name: "In Progress", value: Math.round((pending / total) * 100) },
    { name: "Dropped", value: Math.round((inactive / total) * 100) },
  ];
}

function computeWeeklyAttendance(attendance: Attendance[]) {
  const dayMap: Record<string, { present: number; total: number }> = {
    Mon: { present: 0, total: 0 },
    Tue: { present: 0, total: 0 },
    Wed: { present: 0, total: 0 },
    Thu: { present: 0, total: 0 },
    Fri: { present: 0, total: 0 },
    Sat: { present: 0, total: 0 },
  };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  attendance.forEach((a) => {
    const d = new Date(a.date);
    const dayName = dayNames[d.getDay()];
    if (dayMap[dayName]) {
      dayMap[dayName].total++;
      if (a.status === "Present") dayMap[dayName].present++;
    }
  });

  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({
    day,
    rate: dayMap[day].total > 0 ? Math.round((dayMap[day].present / dayMap[day].total) * 100) : 0,
  }));
}

function computeTopCourses(students: Student[], courses: Course[]) {
  const courseCountMap: Record<string, number> = {};
  students.forEach((s) => {
    if (s.course_slug) {
      courseCountMap[s.course_slug] = (courseCountMap[s.course_slug] || 0) + 1;
    }
  });

  return courses
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      enrollments: courseCountMap[c.slug] || 0,
      completionRate: c.completion_rate,
      revenue: "₹" + ((courseCountMap[c.slug] || 0) * c.fee_numeric).toLocaleString("en-IN"),
    }))
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 5)
    .map((c, i) => ({ rank: i + 1, ...c }));
}

function computeDemographics(students: Student[]) {
  const groups: Record<string, number> = { "18 - 22": 0, "23 - 27": 0, "28 - 32": 0, "33 - 38": 0, "39+": 0 };
  students.forEach((s) => {
    if (s.date_of_birth) {
      const age = Math.floor((Date.now() - new Date(s.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age <= 22) groups["18 - 22"]++;
      else if (age <= 27) groups["23 - 27"]++;
      else if (age <= 32) groups["28 - 32"]++;
      else if (age <= 38) groups["33 - 38"]++;
      else groups["39+"]++;
    }
  });
  const total = students.filter((s) => s.date_of_birth).length || 1;
  return Object.entries(groups).map(([ageGroup, count]) => ({
    ageGroup,
    percentage: Math.round((count / total) * 100),
  }));
}

function computeEnrollmentPie(students: Student[], courses: Course[]) {
  const longTerm = students.filter((s) => {
    const c = courses.find((co) => co.slug === s.course_slug);
    return c?.type === "long-term";
  }).length;
  const shortTerm = students.filter((s) => {
    const c = courses.find((co) => co.slug === s.course_slug);
    return c?.type === "short-term";
  }).length;
  const total = longTerm + shortTerm || 1;
  return [
    { name: "Long-Term", value: Math.round((longTerm / total) * 100) },
    { name: "Short-Term", value: Math.round((shortTerm / total) * 100) },
  ];
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<string>("This Month");
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [studentsRes, coursesRes, attendanceRes, paymentsRes, transactionsRes, branchesRes] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("attendance").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("branches").select("*"),
      ]);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (attendanceRes.data) setAttendance(attendanceRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const enrollments = computeEnrollmentTrends(students, activeTab);
  const totalEnrollments = computeTabTotals(students, activeTab);
  const branchData = computeBranchData(students, branches);
  const revenueTrend = computeRevenueTrend(transactions);
  const completionData = computeCompletionData(students, activeTab);
  const weeklyAttendance = computeWeeklyAttendance(attendance);
  const topCourses = computeTopCourses(students, courses);
  const demographics = computeDemographics(students);
  const enrollmentPie = computeEnrollmentPie(students, courses);

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "Active").length;
  const completionRate = students.length > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
  const totalRevenue = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const revenueLakhs = totalRevenue >= 100000 ? `₹${(totalRevenue / 100000).toFixed(1)}L` : `₹${totalRevenue.toLocaleString("en-IN")}`;
  const avgRating = courses.length > 0 ? (courses.reduce((s, c) => s + c.rating, 0) / courses.length).toFixed(1) : "0.0";
  const totalPayments = payments.length;

  const overallGrowth = totalStudents > 0 ? `+${Math.round((totalEnrollments / totalStudents) * 100)}%` : "+0%";
  const revenueGrowth = revenueTrend.length >= 2 ? `+${Math.round(((revenueTrend[revenueTrend.length - 1].revenue - revenueTrend[0].revenue) / (revenueTrend[0].revenue || 1)) * 100)}%` : "+0%";

  const data = {
    enrollments,
    total: totalEnrollments,
    growth: overallGrowth,
    completion: completionRate,
    revenue: revenueLakhs,
    revenueGrowth,
    avgRating,
    ratingCount: String(totalPayments),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">Performance insights and trends</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
          <Download className="h-3.5 w-3.5" />
          Export Report
        </Button>
      </div>

      {/* Date Range Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Student Growth", value: totalStudents.toLocaleString(), extra: data.growth },
          { label: "Completion Rate", value: `${data.completion}%`, extra: "+5.2%" },
          { label: "Revenue", value: data.revenue, extra: data.revenueGrowth },
          { label: "Avg Rating", value: `${data.avgRating} / 5`, extra: null },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <p className="text-sm font-bold">{stat.value}</p>
                {stat.extra && (
                  <span className="flex items-center text-[10px] font-medium text-emerald-600">
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    {stat.extra}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrollment Trends - AreaChart with gradient */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Enrollment Trends
              </CardTitle>
              <CardDescription className="text-xs">Monthly enrollment count</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 text-xs">
              <TrendingUp className="h-3 w-3" />
              {data.growth} overall
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.enrollments}>
              <defs>
                <linearGradient id="colorEnroll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorEnroll)" name="Enrollments" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="text-xs text-muted-foreground">Total enrollments</div>
            <div className="text-xs font-semibold">{data.total}</div>
          </div>
        </CardContent>
      </Card>

      {/* Pie + Bar row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Enrollment by Course Type - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Enrollment by Course Type
            </CardTitle>
            <CardDescription className="text-xs">Long-term vs short-term distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={enrollmentPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {enrollmentPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Branch Performance - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Branch Performance
            </CardTitle>
            <CardDescription className="text-xs">Student count across branches</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={branchData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="students" name="Students" radius={[4, 4, 0, 0]}>
                  {branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend + Course Completion */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Revenue vs Expenses
            </CardTitle>
            <CardDescription className="text-xs">Monthly financial overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PALETTE[4]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_PALETTE[4]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue (₹L)" />
                <Area type="monotone" dataKey="expenses" stroke={CHART_PALETTE[4]} strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Expenses (₹L)" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Course Completion Status
            </CardTitle>
            <CardDescription className="text-xs">Overall completion breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={completionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ value }) => `${value}%`}
                >
                  {completionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Attendance + Top Courses */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Weekly Attendance Rate
            </CardTitle>
            <CardDescription className="text-xs">Average attendance by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyAttendance}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="day" tick={axisStyle} />
                <YAxis domain={[0, 100]} tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="rate" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Top Performing Courses
            </CardTitle>
            <CardDescription className="text-xs">Ranked by enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCourses.map((course) => (
                <div key={course.rank} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      course.rank === 1 && "bg-amber-500",
                      course.rank === 2 && "bg-slate-400",
                      course.rank === 3 && "bg-amber-700",
                      course.rank > 3 && "bg-muted text-muted-foreground"
                    )}
                  >
                    {course.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{course.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{course.enrollments} enrolled</span>
                      <span>{course.completionRate}% completed</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">{course.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Demographics - 2-col layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Student Demographics
            </CardTitle>
            <CardDescription className="text-xs">Age group distribution across all branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-5">
              {demographics.map((demo) => (
                <div key={demo.ageGroup} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{demo.ageGroup}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{demo.percentage}%</span>
                  </div>
                  <div className="relative h-20">
                    <div className="absolute bottom-0 left-0 right-0 h-full rounded-lg bg-muted/50" />
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{ height: `${demo.percentage}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {Math.round((demo.percentage / 100) * totalStudents)} students
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Course Rankings
            </CardTitle>
            <CardDescription className="text-xs">By enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCourses.map((course) => (
                <div key={course.rank} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{course.name}</span>
                    <span className="text-xs font-semibold">{course.enrollments}</span>
                  </div>
                  <Progress value={topCourses[0] ? (course.enrollments / topCourses[0].enrollments) * 100 : 0} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={[
          ...topCourses.map((c) => ({
            Rank: c.rank,
            Course: c.name,
            Enrollments: c.enrollments,
            "Completion Rate": `${c.completionRate}%`,
            Revenue: c.revenue,
          })),
          ...enrollments.map((e) => ({
            Rank: "",
            Course: `${e.month} Enrollments`,
            Enrollments: e.value,
            "Completion Rate": "",
            Revenue: "",
          })),
        ]}
        filename="analytics-report"
      />
    </div>
  );
}
