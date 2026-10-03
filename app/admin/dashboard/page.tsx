"use client";

import { useState, useEffect, useCallback } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { tooltipStyle, axisStyle, gridStyle } from "@/lib/chart-theme";
import { useAuthState } from "@/hooks/use-auth";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  confirmed: "default",
  pending: "secondary",
  partial: "outline",
  rejected: "destructive",
  overdue: "destructive",
  waitlisted: "outline",
};

/** Days shown on the daily collection chart. */
const DAILY_WINDOW = 14;

type GlanceRow = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type DashboardData = {
  totalStudents: number;
  studentGrowth: string;
  activeCourses: number;
  newCoursesThisQuarter: number;
  feeSnapshot: { collectedThisMonth: number; outstanding: number; dueSoon: number };
  todayStats: {
    admissions: number;
    collected: number;
    collectedCount: number;
    spent: number;
    pendingClaims: number;
    pendingFiledToday: number;
    overdue: number;
  };
  dailyCollections: { day: string; label: string; amount: number }[];
  enrollmentTrends: { month: string; students: number }[];
  courseEnrollment: { course: string; enrollments: number }[];
  recentEnrollments: {
    id: string;
    name: string;
    course: string;
    branch: string;
    date: string;
    status: string;
  }[];
  todaysPayments: {
    key: string;
    name: string;
    amount: number;
    method: string;
    status: string;
    time: string;
  }[];
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session, loading } = useAuthState();
  const [data, setData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const fetchDashboardData = useCallback(async () => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "Failed to load dashboard data.");
      }
      const json: unknown = await res.json();
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new Error("The dashboard returned an empty or invalid response.");
      }
      setData(json as DashboardData);
      setDashboardError("");
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setDashboardError(error instanceof Error ? error.message : "Failed to load dashboard data.");
    } finally {
      setDashboardLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!loading && session?.access_token) {
      void Promise.resolve().then(fetchDashboardData);
    }
  }, [fetchDashboardData, loading, session]);

  if (loading || !session?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dashboardLoading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {dashboardError || "Dashboard data is unavailable."}
          </p>
          <Button
            onClick={() => {
              setDashboardLoading(true);
              setDashboardError("");
              void fetchDashboardData();
            }}
            disabled={dashboardLoading}
          >
            {dashboardLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { totalStudents, studentGrowth, activeCourses, newCoursesThisQuarter, feeSnapshot, todayStats, dailyCollections, enrollmentTrends, courseEnrollment, recentEnrollments, todaysPayments } = data;

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
                        key={enrollment.id}
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
                          <Badge variant={statusVariant[enrollment.status] ?? "outline"}>
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
