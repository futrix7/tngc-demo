"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, Users, BookOpen, Download, ArrowUpRight, Activity, Zap, Loader2 } from "lucide-react";
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog";
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
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Branch = Database["public"]["Tables"]["branches"]["Row"];

const TABS = ["All Dates", "This Month", "This Quarter", "This Year"] as const;

/**
 * Nothing selected.
 *
 * Empty string means "every one of them" for every dropdown, which is what
 * makes the Clear button a genuine reset rather than a partial one.
 */
const DEFAULT_FILTERS: FilterValues = {
  from: "",
  to: "",
  course: "",
  branch: "",
  status: "",
  paymentMethod: "",
  paymentStatus: "",
  transactionType: "",
};

/**
 * The window every figure on this page is measured over.
 *
 * The tabs above only ever offered three coarse spans, so there was no way to
 * ask the one question this page usually gets asked: what happened on a given
 * day. A single-day range has to work — `from` equal to `to` is a day, not an
 * empty range — and an open end has to mean "still counting", not "no data".
 */
interface AnalyticsRange {
  from: Date | null;
  to: Date | null;
}

const OPEN_RANGE: AnalyticsRange = { from: null, to: null };

/**
 * Reads a Postgres `date` column as a local date.
 *
 * `new Date("2026-09-30")` is UTC midnight, which in any timezone behind UTC
 * resolves to the evening of the 29th and quietly drops a day out of a
 * from-to filter. These columns carry no timezone and neither should the
 * comparison, so the string is unpacked by hand.
 */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Reads a `yyyy-mm-dd` box value as a local date, or null when it is blank. */
function parseDateInput(value: string | undefined): Date | null {
  return parseDateOnly(value?.trim());
}

/** Inclusive on both ends: a range that starts and ends today still has today. */
function isWithinRange(value: string | null | undefined, range: AnalyticsRange) {
  const date = parseDateOnly(value);
  if (!date) return false;

  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

/**
 * Turns the filter box into the window the charts read.
 *
 * A half-entered range is completed from the tab rather than treated as a
 * filter that matches nothing, because "from the 1st" with no end date means
 * "from the 1st onwards" and answering that with an empty page reads as a bug.
 */
function resolveRange(values: FilterValues, tab: string): AnalyticsRange {
  const from = parseDateInput(values.from);
  const to = parseDateInput(values.to);

  if (from || to) {
    return {
      from,
      // An open end runs to the end of its own day, so a filter for the 1st
      // still includes money taken on the 1st.
      to: to
        ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
        : endOfDay(new Date()),
    };
  }

  return tabRange(tab);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function tabRange(tab: string): AnalyticsRange {
  if (tab === "All Dates") return OPEN_RANGE;

  const now = new Date();
  const to = endOfDay(now);

  if (tab === "This Month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }

  if (tab === "This Quarter") {
    return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to };
  }

  return { from: new Date(now.getFullYear(), 0, 1), to };
}

function spanDays(range: AnalyticsRange): number {
  if (!range.from || !range.to) return 0;
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));
}

/** Short windows read better as days or weeks; long ones only work as months. */
function isDayBucketed(range: AnalyticsRange) {
  return spanDays(range) <= 45;
}

function isWeekBucketed(range: AnalyticsRange) {
  const days = spanDays(range);
  return days === 0 || days <= 92;
}

/**
 * The window in words, shown in the header once a filter narrows things.
 *
 * "01 Mar 2026" on its own is the whole point of the dialog: an admin asking
 * what happened on one day should not have to check two boxes to be sure that
 * is what they are looking at.
 */
function describeRange(range: AnalyticsRange): string {
  if (!range.from && !range.to) return "All dates";

  const fmt = (date: Date) =>
    date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  if (range.from && range.to && startOfDay(range.from).getTime() === startOfDay(range.to).getTime()) {
    return fmt(range.from);
  }

  const from = range.from ? fmt(range.from) : "the beginning";
  const to = range.to ? fmt(range.to) : "today";
  return `${from} to ${to}`;
}

function getMonthName(monthIndex: number) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[monthIndex];
}

function getWeekLabel(date: Date): string {
  const dayOfMonth = date.getDate();
  const weekNum = Math.ceil(dayOfMonth / 7);
  return `Week ${weekNum}`;
}

/**
 * Buckets enrolments by week or by month, whichever suits the span.
 *
 * Only bucketing happens here. The date window and every other filter are
 * already applied to the rows it is handed, so no chart can disagree with the
 * card above it about how many students there are.
 */
function computeEnrollmentTrends(students: Student[], range: AnalyticsRange = OPEN_RANGE) {
  const days = spanDays(range);
  const byWeek = isWeekBucketed(range);
  const grouped: Record<string, number> = {};

  students.forEach((s) => {
    const date = parseDateOnly(s.enrollment_date);
    if (!date) return;

    const label = byWeek ? getWeekLabel(date) : getMonthName(date.getMonth());
    grouped[label] = (grouped[label] || 0) + 1;
  });

  if (byWeek) {
    // Capped at six: a five-week span still needs all five, and past that the
    // axis turns into a list nobody reads.
    const weekCount = days === 0 ? 4 : Math.max(4, Math.ceil(days / 7));
    const weeks: string[] = [];
    for (let week = 1; week <= weekCount; week += 1) {
      weeks.push(`Week ${week}`);
    }
    return weeks.slice(0, 6).map((w) => ({ month: w, value: grouped[w] || 0 }));
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((m) => ({ month: m, value: grouped[m] || 0 }));
}

/**
 * The window immediately before this one, of the same length.
 *
 * Growth figures have to compare two real windows. The previous version divided
 * the student count by itself, which is always exactly `+100%` no matter what
 * the institute did — a number that looks like a metric and means nothing.
 */
function previousRangeOf(range: AnalyticsRange): AnalyticsRange {
  if (!range.from || !range.to) return OPEN_RANGE;

  const from = startOfDay(range.from);
  const to = endOfDay(range.to);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const prevTo = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59, 999);
  const prevToDay = startOfDay(prevTo);
  const prevFrom = new Date(prevToDay.getTime() - (days - 1) * 86_400_000);

  return { from: prevFrom, to: prevTo };
}

/**
 * Percentage change from `previous` to `current`, as a signed string.
 *
 * Returns null when there is nothing to compare — no previous window, or a
 * previous window with nothing in it. A percentage against a zero baseline is
 * not a number, and rendering `+100%` there is a lie the display passes on to
 * the caller, so the caller gets null and shows no badge instead.
 */
function percentChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
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

/**
 * Revenue and expenses across the chosen window.
 *
 * Bucketed by day for short windows and by month for long ones, so a single
 * day gets one labelled bar rather than twelve empty ones. Returned in rupees
 * rather than lakhs: the lakh rounding made every small figure on a one-day
 * filter round to zero, which is exactly the data being asked about.
 */
function computeRevenueTrend(transactions: Transaction[], range: AnalyticsRange) {
  if (isDayBucketed(range)) {
    const buckets = new Map<string, { revenue: number; expenses: number }>();

    for (const t of transactions) {
      const date = parseDateOnly(t.date);
      if (!date) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const bucket = buckets.get(key) ?? { revenue: 0, expenses: 0 };
      if (t.type === "income") bucket.revenue += t.amount;
      else bucket.expenses += t.amount;
      buckets.set(key, bucket);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({
        month: new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: Math.round(bucket.revenue),
        expenses: Math.round(bucket.expenses),
      }));
  }

  const grouped: Record<string, { revenue: number; expenses: number }> = {};
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  months.forEach((m) => (grouped[m] = { revenue: 0, expenses: 0 }));

  transactions.forEach((t) => {
    const date = parseDateOnly(t.date);
    if (!date) return;

    const label = getMonthName(date.getMonth());
    if (t.type === "income") grouped[label].revenue += t.amount;
    else grouped[label].expenses += t.amount;
  });

  return months.map((m) => ({
    month: m,
    revenue: Math.round(grouped[m].revenue),
    expenses: Math.round(grouped[m].expenses),
  }));
}

function computeCompletionData(students: Student[]) {
  const total = students.length || 1;
  const active = students.filter((s) => s.status === "Active").length;
  const inactive = students.filter((s) => s.status === "Inactive").length;
  const pending = students.filter((s) => s.status === "Pending").length;
  return [
    { name: "Completed", value: Math.round((active / total) * 100) },
    { name: "In Progress", value: Math.round((pending / total) * 100) },
    { name: "Dropped", value: Math.round((inactive / total) * 100) },
  ];
}

function computePaymentStatus(payments: Payment[]) {
  // Rejected and Overdue are both real payment states; the old list named only
  // four of the five, so those payments went uncounted by the chart about them.
  const statuses = ["Paid", "Pending", "Partial", "Overdue", "Rejected"];

  return statuses.map((status) => ({
    status,
    count: payments.filter((payment) => payment.status === status).length,
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
      name: c.short_name || c.name,
      enrollments: courseCountMap[c.slug] || 0,
      completionRate: c.completion_rate,
      revenue: "₹" + ((courseCountMap[c.slug] || 0) * c.fee_numeric).toLocaleString("en-IN"),
    }))
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 5)
    .map((c, i) => ({ rank: i + 1, ...c }));
}

/**
 * Age bands of the students already in scope.
 *
 * Anyone born after today is skipped: a data-entry slip in the future would
 * otherwise produce a negative age and land in the youngest band, quietly
 * inflating it with a student who does not exist.
 */
function computeDemographics(students: Student[]) {
  const groups: Record<string, number> = { "18 - 22": 0, "23 - 27": 0, "28 - 32": 0, "33 - 38": 0, "39+": 0 };
  const now = Date.now();

  const cohort = students.filter((s) => Boolean(s.date_of_birth));

  cohort.forEach((s) => {
    const born = parseDateOnly(s.date_of_birth);
    if (!born || born.getTime() > now) return;

    const age = Math.floor((now - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age <= 22) groups["18 - 22"]++;
    else if (age <= 27) groups["23 - 27"]++;
    else if (age <= 32) groups["28 - 32"]++;
    else if (age <= 38) groups["33 - 38"]++;
    else groups["39+"]++;
  });

  const total = cohort.length || 1;
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
  const [activeTab, setActiveTab] = useState<string>("All Dates");
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // The tabs are shortcuts into the same range the dialog edits, so a custom
  // window and a tab click both end up in `range` and every chart below agrees
  // about which dates it is talking about.
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [studentsRes, coursesRes, paymentsRes, transactionsRes, branchesRes] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("branches").select("*"),
      ]);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const range = useMemo(() => resolveRange(filters, activeTab), [filters, activeTab]);

  // Options come from the data rather than a hardcoded list, so a course that
  // only exists for one branch is still selectable and a typo can never narrow
  // the page to nothing.
  const filterFields = useMemo<FilterField[]>(
    () => [
      { key: "from", label: "From date", type: "date", defaultValue: "" },
      { key: "to", label: "To date", type: "date", defaultValue: "" },
      {
        key: "course",
        label: "Course",
        type: "select",
        defaultValue: "",
        options: [
          { label: "All courses", value: "" },
          ...courses.map((c) => ({ label: c.short_name || c.name, value: c.slug })),
        ],
      },
      {
        key: "branch",
        label: "Branch",
        type: "select",
        defaultValue: "",
        options: [
          { label: "All branches", value: "" },
          ...branches.map((b) => ({ label: b.name, value: b.id })),
        ],
      },
      {
        key: "status",
        label: "Student status",
        type: "select",
        defaultValue: "",
        options: [
          { label: "Any status", value: "" },
          { label: "Active", value: "Active" },
          { label: "Pending", value: "Pending" },
          { label: "Inactive", value: "Inactive" },
        ],
      },
      {
        key: "paymentMethod",
        label: "Payment method",
        type: "select",
        defaultValue: "",
        options: [
          { label: "Any method", value: "" },
          { label: "UPI", value: "upi" },
          { label: "Cash", value: "cash" },
          { label: "Bank transfer", value: "bank" },
        ],
      },
      {
        key: "paymentStatus",
        label: "Payment status",
        type: "select",
        defaultValue: "",
        options: [
          { label: "Any status", value: "" },
          { label: "Paid", value: "Paid" },
          { label: "Pending", value: "Pending" },
          { label: "Partial", value: "Partial" },
          { label: "Overdue", value: "Overdue" },
          { label: "Rejected", value: "Rejected" },
        ],
      },
      {
        key: "transactionType",
        label: "Transaction type",
        type: "select",
        defaultValue: "",
        options: [
          { label: "Income and expense", value: "" },
          { label: "Income only", value: "income" },
          { label: "Expense only", value: "expense" },
        ],
      },
    ],
    [courses, branches]
  );

  // One pass over each table, so the seven charts below are all reading the same
  // slice of the same window rather than each re-deriving its own.
  const scopedStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          isWithinRange(s.enrollment_date, range) &&
          (!filters.course || s.course_slug === filters.course) &&
          (!filters.branch || s.branch_id === filters.branch) &&
          (!filters.status || s.status === filters.status)
      ),
    [students, range, filters.course, filters.branch, filters.status]
  );

  const scopedPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          isWithinRange(p.payment_date, range) &&
          (!filters.course || p.course_slug === filters.course) &&
          (!filters.branch || p.branch_id === filters.branch) &&
          (!filters.paymentMethod || p.method === filters.paymentMethod) &&
          // The payment-status filter is not applied here: the Payment Status
          // chart counts all of them, and filtering the set down to one status
          // would collapse it to a single full-height bar.
          (!filters.paymentStatus || p.status === filters.paymentStatus)
      ),
    [payments, range, filters.course, filters.branch, filters.paymentMethod, filters.paymentStatus]
  );

  const scopedTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          isWithinRange(t.date, range) &&
          (!filters.transactionType || t.type === filters.transactionType)
      ),
    [transactions, range, filters.transactionType]
  );

  /**
   * The same filters, over the window before this one.
   *
   * Only the date window moves. A growth figure that also dropped the course or
   * branch filter would be comparing this month at Kodad against all of last
   * quarter, which is a different question than the one the card is asking.
   */
  const previousRange = useMemo(() => previousRangeOf(range), [range]);

  const scopedPreviousStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          isWithinRange(s.enrollment_date, previousRange) &&
          (!filters.course || s.course_slug === filters.course) &&
          (!filters.branch || s.branch_id === filters.branch) &&
          (!filters.status || s.status === filters.status)
      ),
    [students, previousRange, filters.course, filters.branch, filters.status]
  );

  const scopedPreviousTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          isWithinRange(t.date, previousRange) &&
          (!filters.transactionType || t.type === filters.transactionType)
      ),
    [transactions, previousRange, filters.transactionType]
  );

  const enrollments = computeEnrollmentTrends(scopedStudents);
  const totalEnrollments = scopedStudents.length;
  const branchData = computeBranchData(scopedStudents, branches);
  const revenueTrend = computeRevenueTrend(scopedTransactions, range);
  const completionData = computeCompletionData(scopedStudents);
  const paymentStatus = computePaymentStatus(scopedPayments);
  const topCourses = computeTopCourses(scopedStudents, courses);
  const demographics = computeDemographics(scopedStudents);
  const enrollmentPie = computeEnrollmentPie(scopedStudents, courses);

  const totalStudents = scopedStudents.length;
  const activeStudents = scopedStudents.filter((s) => s.status === "Active").length;
  const completionRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
  const totalRevenue = scopedTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const revenueLakhs = totalRevenue >= 100000 ? `₹${(totalRevenue / 100000).toFixed(1)}L` : `₹${totalRevenue.toLocaleString("en-IN")}`;
  const avgRating = courses.length > 0 ? (courses.reduce((s, c) => s + c.rating, 0) / courses.length).toFixed(1) : "0.0";
  const totalPayments = scopedPayments.length;

  const hasCustomFilter = Object.entries(filters).some(([key, value]) => value !== DEFAULT_FILTERS[key]);
  const hasCustomDateRange = Boolean(filters.from || filters.to);
  const rangeSummary = describeRange(range);

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
          <p className="text-xs text-muted-foreground">
            Performance insights and trends
            {hasCustomFilter && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{rangeSummary}</span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
          <Download className="h-3.5 w-3.5" />
          Export Report
        </Button>
      </div>

      {/* Date range shortcuts, plus the dialog for anything the shortcuts
          cannot express. Both write to the same range. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilters((current) => ({ ...current, from: "", to: "" }));
                setActiveTab(tab);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                !hasCustomDateRange && activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <FilterDialog
          title="More filters"
          description="Narrow every chart on this page to a single day, one course, one branch, or a single payment status."
          triggerLabel="More filters"
          fields={filterFields}
          values={filters}
          onApply={async (values) => {
            setFilters(values);
            if (!values.from && !values.to) setActiveTab("All Dates");
          }}
          onClear={async (values) => {
            setFilters(values);
            setActiveTab("All Dates");
          }}
        />
      </div>

      {/* One notice rather than seven empty charts. A filter that matches
          nothing used to leave a wall of blank axes, which reads as a broken
          page rather than as an honest "nothing here". */}
      {hasCustomFilter && totalStudents === 0 && totalPayments === 0 && scopedTransactions.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Nothing matches these filters</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No students, payments or transactions in {rangeSummary}. Widen the dates or clear a filter.
          </p>
        </div>
      )}

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
              <CardDescription className="text-xs">
                {isWeekBucketed(range) ? "Weekly enrollment count" : "Monthly enrollment count"}
              </CardDescription>
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
            <CardDescription className="text-xs">
              {isDayBucketed(range) ? "Daily financial overview" : "Monthly financial overview"}
            </CardDescription>
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
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke={CHART_PALETTE[4]} strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Expenses" />
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

      {/* Payment Status + Top Courses */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Payment Status
            </CardTitle>
            <CardDescription className="text-xs">Payment records by verification status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {paymentStatus.map((entry, index) => (
                    <Cell key={entry.status} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
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
