"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, BookOpen, ClipboardCheck, UserPlus, TrendingUp, Clock, MapPin, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { tooltipStyle, axisStyle, gridStyle, CHART_PALETTE } from "@/lib/chart-theme";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending: "secondary",
  waitlisted: "outline",
};

const eventColors: Record<string, string> = {
  orientation: "bg-blue-500/10 text-blue-500",
  workshop: "bg-violet-500/10 text-violet-500",
  "field-trip": "bg-emerald-500/10 text-emerald-500",
  exam: "bg-amber-500/10 text-amber-500",
};

const priorityBadge: Record<string, "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
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
  const [attendanceToday, setAttendanceToday] = useState("0%");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [enrollmentTrends, setEnrollmentTrends] = useState<{ month: string; students: number }[]>([]);
  const [courseEnrollment, setCourseEnrollment] = useState<{ course: string; enrollments: number }[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { name: string; course: string; branch: string; date: string; status: string }[]
  >([]);
  const [branchRevenue, setBranchRevenue] = useState<{ branch: string; revenue: number }[]>([]);
  const [weeklyAttendance, setWeeklyAttendance] = useState<{ day: string; rate: number }[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ event: string; date: string; type: string }[]>([]);
  const [pendingTasks, setPendingTasks] = useState<{ task: string; priority: string }[]>([]);

  async function fetchDashboardData() {
    try {
      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const [
        studentsRes,
        coursesRes,
        attendanceRes,
        paymentsRes,
        eventsRes,
        tasksRes,
        branchesRes,
      ] = await Promise.all([
        supabase.from("students").select("id, full_name, course_slug, branch_id, enrollment_date, status"),
        supabase.from("courses").select("id, slug, name, created_at, status"),
        supabase.from("attendance").select("id, student_id, date, status"),
        supabase.from("payments").select("id, student_id, amount, status"),
        supabase.from("events").select("id, name, date, type").order("date"),
        supabase.from("pending_tasks").select("id, task, priority, completed").eq("completed", false),
        supabase.from("branches").select("id, name"),
      ]);

      const students = getSafeRows(studentsRes, "students");
      const courses = getSafeRows(coursesRes, "courses");
      const attendance = getSafeRows(attendanceRes, "attendance");
      const payments = getSafeRows(paymentsRes, "payments");
      const events = getSafeRows(eventsRes, "events");
      const tasks = getSafeRows(tasksRes, "pending_tasks");
      const branches = getSafeRows(branchesRes, "branches");

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

      const todayAttendance = attendance.filter((a) => a.date === todayStr);
      const presentToday = todayAttendance.filter((a) => a.status === "Present" || a.status === "Late").length;
      const totalToday = todayAttendance.length;
      const attendancePct = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 0;
      setAttendanceToday(`${attendancePct}%`);
      setAttendanceNote(attendancePct >= 85 ? "Above 85% target" : "Below 85% target");

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

      // --- Weekly Attendance ---
      const dayTotals = new Map<string, { present: number; total: number }>();
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => dayTotals.set(d, { present: 0, total: 0 }));
      attendance.forEach((a) => {
        const d = new Date(a.date + "T00:00:00");
        const dayIndex = d.getDay();
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayName = dayNames[dayIndex];
        const entry = dayTotals.get(dayName);
        if (entry) {
          entry.total++;
          if (a.status === "Present" || a.status === "Late") {
            entry.present++;
          }
        }
      });
      const weeklyData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => {
        const entry = dayTotals.get(day)!;
        return {
          day,
          rate: entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0,
        };
      });
      setWeeklyAttendance(weeklyData);

      // --- Upcoming Events ---
      const upcomingEvts = events
        .filter((e) => new Date(e.date) >= now)
        .slice(0, 4)
        .map((e) => ({
          event: e.name,
          date: formatDate(e.date),
          type: e.type,
        }));
      setUpcomingEvents(upcomingEvts);

      // --- Pending Tasks ---
      setPendingTasks(tasks.map((t) => ({ task: t.task, priority: t.priority })));
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
      title: "Attendance Today",
      value: attendanceToday,
      icon: ClipboardCheck,
      description: attendanceNote,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Weekly Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Weekly Attendance
            </CardTitle>
            <CardDescription className="text-xs">Avg attendance by day</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyAttendance.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No attendance data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyAttendance}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="day" tick={axisStyle} />
                  <YAxis domain={[0, 100]} tick={axisStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="rate" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Upcoming Events
            </CardTitle>
            <CardDescription className="text-xs">Next scheduled activities</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                No upcoming events
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={`${event.event}-${event.date}`} className="flex items-center gap-3">
                    <div className={cn("rounded-md px-2 py-1 text-xs font-medium", eventColors[event.type])}>
                      {event.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.event}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Pending Tasks
            </CardTitle>
            <CardDescription className="text-xs">Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                No pending tasks
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div key={task.task} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{task.task}</p>
                      <Badge variant={priorityBadge[task.priority]} className="mt-1 text-xs">
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
