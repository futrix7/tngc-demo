"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Download,
  Trash2,
  Loader2,
  Wallet,
  PiggyBank,
  CreditCard,
  Lock,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/admin/export-dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/sonner";
import {
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { tooltipStyle, axisStyle, gridStyle, CHART_PALETTE } from "@/lib/chart-theme";
import { AddExpenseSheet } from "@/components/admin/add-expense-sheet";
import { Filter, RotateCcw } from "lucide-react";
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog";
import { DateFilterInput } from "@/components/admin/date-filter-input";

interface SummaryCard {
  title: string;
  value: string;
  icon: typeof IndianRupee;
  change: string;
  trend: "up" | "down";
  color: string;
  bgColor: string;
}

interface ExpenseItem {
  name: string;
  value: number;
  percentage: number;
}

interface FinanceRecord {
  date: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

interface PaymentMethodItem {
  name: string;
  value: number;
  percentage: number;
}

interface ExpenseTrendDatum {
  period: string;
  [category: string]: string | number;
}

interface RecentTransaction {
  id: string;
  date: string;
  dateValue: string;
  description: string;
  category: string;
  amount: string;
  type: "income" | "expense";
  teacherSalary: boolean;
}

type FinancePeriod = "month" | "quarter" | "year";
type CustomChartFilter =
  | { type: "month"; value: string }
  | { type: "dates"; from: string; to: string }
  | { type: "year"; value: string };

const FINANCE_PERIODS: { value: FinancePeriod; label: string; description: string }[] = [
  { value: "month", label: "Month", description: "Daily totals · current month" },
  { value: "quarter", label: "Quarter", description: "Monthly totals · latest 3 months" },
  { value: "year", label: "Year", description: "Monthly totals · current year" },
];

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateForUser(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function getFinanceBuckets(
  period: FinancePeriod,
  customFilter: CustomChartFilter | null,
  today = new Date()
) {
  const buckets: { key: string; label: string }[] = [];
  const granularity = customFilter?.type === "year" || period !== "month" ? "month" : "day";
  const start = customFilter
    ? customFilter.type === "month"
      ? new Date(Number(customFilter.value.slice(0, 4)), Number(customFilter.value.slice(5, 7)) - 1, 1)
      : customFilter.type === "year"
        ? new Date(Number(customFilter.value), 0, 1)
        : parseLocalDate(customFilter.from)
    : period === "month"
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : period === "quarter"
        ? new Date(today.getFullYear(), today.getMonth() - 2, 1)
        : new Date(today.getFullYear(), 0, 1);
  const end = customFilter
    ? customFilter.type === "month"
      ? new Date(start.getFullYear(), start.getMonth() + 1, 0)
      : customFilter.type === "year"
        ? new Date(start.getFullYear(), 11, 31)
        : parseLocalDate(customFilter.to)
    : period === "month"
      ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
      : period === "quarter"
        ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
        : new Date(today.getFullYear(), 11, 31);

  if (granularity === "day") {
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      buckets.push({
        key: toLocalDateKey(cursor),
        label: cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      });
    }
  } else {
    for (const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      cursor <= end;
      cursor.setMonth(cursor.getMonth() + 1)
    ) {
      buckets.push({
        key: monthKey(cursor),
        label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      });
    }
  }
  return buckets;
}

function getFinancePeriodKey(dateValue: string, granularity: "day" | "month"): string {
  const date = parseLocalDate(dateValue);
  return granularity === "day" ? toLocalDateKey(date) : monthKey(date);
}

function buildFinanceCharts(
  records: FinanceRecord[],
  period: FinancePeriod,
  customFilter: CustomChartFilter | null
) {
  const buckets = getFinanceBuckets(period, customFilter);
  const granularity = customFilter?.type === "year" || period !== "month" ? "month" : "day";
  const bucketKeys = new Set(buckets.map((bucket) => bucket.key));
  const chartRecords = records.filter((record) =>
    bucketKeys.has(getFinancePeriodKey(record.date, granularity))
  );
  const trendByKey = new Map(
    buckets.map((bucket) => [bucket.key, { period: bucket.label, revenue: 0, expenses: 0, net: 0 }])
  );
  const expenseTotals = new Map<string, number>();

  for (const record of chartRecords) {
    const key = getFinancePeriodKey(record.date, granularity);
    const trend = trendByKey.get(key);
    if (trend) {
      if (record.type === "income") trend.revenue += record.amount;
      else trend.expenses += record.amount;
    }

    if (record.type === "expense") {
      const category = record.category || "Other";
      expenseTotals.set(category, (expenseTotals.get(category) || 0) + record.amount);
    }
  }

  const topExpenseCategories = Array.from(expenseTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category]) => category);
  const expenseCategories = [
    ...topExpenseCategories,
    ...(expenseTotals.size > topExpenseCategories.length ? ["Other expenses"] : []),
  ];
  const expenseTrendByKey = new Map<string, ExpenseTrendDatum>(
    buckets.map((bucket) => [
      bucket.key,
      Object.fromEntries([
        ["period", bucket.label],
        ...expenseCategories.map((category) => [category, 0]),
      ]),
    ])
  );

  for (const record of chartRecords) {
    if (record.type !== "expense") continue;
    const key = getFinancePeriodKey(record.date, granularity);
    if (!bucketKeys.has(key)) continue;

    const category = topExpenseCategories.includes(record.category)
      ? record.category
      : "Other expenses";
    const bucket = expenseTrendByKey.get(key);
    if (bucket) bucket[category] = Number(bucket[category] || 0) + record.amount;
  }

  const trend = Array.from(trendByKey.values()).map((item) => ({
    ...item,
    net: item.revenue - item.expenses,
  }));

  return {
    trend,
    expenseTrend: Array.from(expenseTrendByKey.values()),
    expenseCategories,
  };
}

/**
 * Row counts offered by the Recent Transactions limit.
 *
 * Each step is a screenful or two of a table, and "All" is last and separate:
 * past a few hundred rows the table stops being a list to scan and becomes a
 * page that has to be exported instead.
 */
const TRANSACTION_LIMIT_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "all", label: "All" },
] as const;

function formatCurrencyINR(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function AdminFinancePage() {
  const { toast } = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; description: string } | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseItem[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodItem[]>([]);
  const [allTransactions, setAllTransactions] = useState<RecentTransaction[]>([]);
  /**
   * How many of the most recent transactions the table shows.
   *
   * This was a "View All" button flipping between a 10-row slice and the entire
   * ledger, which is not a limit anyone can work with: a month of entries meant
   * scrolling past hundreds of rows, and a quiet week meant the slice and the
   * full list were the same thing. `null` is the explicit "no limit" answer and
   * is still reachable, just on purpose.
   */
  const [transactionLimit, setTransactionLimit] = useState<number | null>(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateFilters, setDateFilters] = useState({ from: "", to: "" });
  const [financePeriod, setFinancePeriod] = useState<FinancePeriod>("month");
  const [chartFilterOpen, setChartFilterOpen] = useState(false);
  const [chartFilterType, setChartFilterType] = useState<CustomChartFilter["type"]>("month");
  const [chartMonth, setChartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");
  const [chartYear, setChartYear] = useState(String(new Date().getFullYear()));
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor(new Date().getFullYear() / 12) * 12
  );
  const [customChartFilter, setCustomChartFilter] = useState<CustomChartFilter | null>(null);
  const pendingFilterFetch = useRef<((success: boolean) => void) | null>(null);
  const filterFetchSucceeded = useRef(true);

  async function confirmDeleteExpense() {
    if (!expenseToDelete || deletingExpense) return;
    setDeletingExpense(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", expenseToDelete.id)
        .eq("type", "expense")
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[finance] expense deletion failed:", error.message);
        toast("Could not delete this expense. Please try again.", { variant: "destructive" });
        return;
      }
      if (!data) {
        toast("This expense was not found or could not be deleted.", { variant: "destructive" });
        return;
      }

      toast("Expense deleted successfully.", { variant: "success" });
      setExpenseToDelete(null);
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      console.error("[finance] expense deletion failed:", deleteError);
      toast("Could not delete this expense. Please try again.", { variant: "destructive" });
    } finally {
      setDeletingExpense(false);
    }
  }

  // Derived rather than snapshotted into its own state: a stored slice goes
  // stale the moment the limit changes or a new transaction arrives, which is
  // what left the table disagreeing with the "View All" button.
  const recentTransactions = useMemo(
    () =>
      transactionLimit === null
        ? allTransactions
        : allTransactions.slice(0, transactionLimit),
    [allTransactions, transactionLimit]
  );

  const handleVerify = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // The endpoint verifies the session server-side; without the token it
      // cannot tell an administrator from an anonymous visitor.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setError(true);
        return;
      }

      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.valid) {
        setAuthenticated(true);
        setPin("");
      } else {
        setError(true);
        setPin("");
      }
    } catch {
      setError(true);
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [pin]);

  useEffect(() => {
    if (!authenticated) return;

    let active = true;

    async function fetchFinanceData() {
      setDataLoading(true);
      filterFetchSucceeded.current = true;

      async function fetchTransactions() {
        const rows: { id: string; date: string; description: string; category: string; amount: number; type: "income" | "expense"; branch_id: string | null; teacher_id: string | null }[] = []
        let offset = 0
        while (true) {
          const query = supabase
            .from("transactions")
            .select("id, date, description, category, amount, type, branch_id, teacher_id")
            .order("date", { ascending: false })
          const result = await query.range(offset, offset + 999)
          if (result.error) return { data: null, error: result.error }
          rows.push(...(result.data ?? []))
          if (!result.data || result.data.length < 1000) break
          offset += 1000
        }
        return { data: rows, error: null }
      }

      async function fetchPayments() {
        const rows: { id: string; student_name: string; course_slug: string | null; amount: number; payment_date: string; method: string; status: string }[] = []
        let offset = 0
        while (true) {
          const query = supabase.from("payments").select("id, student_name, course_slug, amount, payment_date, method, status").order("payment_date", { ascending: false })
          const result = await query.range(offset, offset + 999)
          if (result.error) return { data: null, error: result.error }
          rows.push(...(result.data ?? []))
          if (!result.data || result.data.length < 1000) break
          offset += 1000
        }
        return { data: rows, error: null }
      }

      const [transactionsResult, paymentsResult, coursesResult] = await Promise.all([
        fetchTransactions(),
        fetchPayments(),
        supabase.from("courses").select("slug, name, short_name"),
      ]);

      // Keep query errors visible rather than rendering success-shaped empty charts.
      const failures = [
        transactionsResult.error,
        paymentsResult.error,
        coursesResult.error,
      ].filter((e): e is NonNullable<typeof e> => e !== null);

      if (failures.length > 0) {
        filterFetchSucceeded.current = false;
        if (!active) return;
        for (const failure of failures) {
          console.error("[finance] query failed:", failure.message);
        }
        setDataError(
          "Some finance data could not be loaded. This usually means the database schema is out of date — apply supabase.sql."
        );
        setDataLoading(false);
        return;
      }

      const transactions = transactionsResult.data || [];
      const payments = paymentsResult.data || [];

      const courseMap = new Map<string, string>();
      if (coursesResult.data) {
        coursesResult.data.forEach((c) => courseMap.set(c.slug, c.short_name || c.name));
      }

      const matchesDateFilter = (date: string) =>
        (!dateFilters.from || date >= dateFilters.from)
        && (!dateFilters.to || date <= dateFilters.to);
      const allVerifiedPayments = payments.filter((payment) => payment.status === "Paid");
      const allExpenseTransactions = transactions.filter((transaction) => transaction.type === "expense");
      setFinanceRecords([
        ...allVerifiedPayments.map((payment) => ({
          date: payment.payment_date,
          amount: Number(payment.amount),
          type: "income" as const,
          category: payment.method || "Other",
        })),
        ...allExpenseTransactions.map((transaction) => ({
          date: transaction.date,
          amount: Number(transaction.amount),
          type: "expense" as const,
          category: transaction.category || "Other",
        })),
      ]);
      const verifiedPayments = allVerifiedPayments.filter((payment) => matchesDateFilter(payment.payment_date));
      const expenseTransactions = allExpenseTransactions.filter((transaction) => matchesDateFilter(transaction.date));

      const totalIncome = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const netProfit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
      const profitStatus = netProfit >= 0;

      setSummaryCards([
        {
          title: "Total Revenue",
          value: formatCurrencyINR(totalIncome),
          icon: IndianRupee,
          change: "",
          trend: "up",
          color: profitStatus ? "text-emerald-500" : "text-red-500",
          bgColor: profitStatus ? "bg-emerald-500/10" : "bg-red-500/10",
        },
        {
          title: "Total Expenses",
          value: formatCurrencyINR(totalExpenses),
          icon: CreditCard,
          change: "",
          trend: "down",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
        },
        {
          title: "Net Profit",
          value: formatCurrencyINR(netProfit),
          icon: Wallet,
          change: "",
          trend: "up",
          color: profitStatus ? "text-emerald-500" : "text-red-500",
          bgColor: profitStatus ? "bg-emerald-500/10" : "bg-red-500/10",
        },
        {
          title: "Profit Margin",
          value: `${profitMargin}%`,
          icon: PiggyBank,
          change: "",
          trend: "up",
          color: profitStatus ? "text-emerald-500" : "text-red-500",
          bgColor: profitStatus ? "bg-emerald-500/10" : "bg-red-500/10",
        },
      ]);

      const expenseMap = new Map<string, number>();
      for (const transaction of expenseTransactions) {
        const category = transaction.category || "Other";
        expenseMap.set(category, (expenseMap.get(category) || 0) + Number(transaction.amount));
      }

      const totalExpenseAmt = Array.from(expenseMap.values()).reduce((sum, value) => sum + value, 0);
      const expenseItems: ExpenseItem[] = Array.from(expenseMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalExpenseAmt > 0 ? Math.round((value / totalExpenseAmt) * 100) : 0,
        }));
      setExpenseBreakdown(expenseItems);

      const paymentMethodMap = new Map<string, number>();
      for (const payment of verifiedPayments) {
        const method = payment.method || "Other";
        paymentMethodMap.set(method, (paymentMethodMap.get(method) || 0) + Number(payment.amount));
      }
      const totalPaymentMethods = Array.from(paymentMethodMap.values()).reduce((sum, amount) => sum + amount, 0);
      setPaymentMethodData(
        Array.from(paymentMethodMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({
            name,
            value,
            percentage: totalPaymentMethods > 0 ? Math.round((value / totalPaymentMethods) * 100) : 0,
          }))
      );

      const mergedIncomeRows: RecentTransaction[] = verifiedPayments.map((payment) => ({
        id: payment.id,
        dateValue: payment.payment_date,
        date: new Date(payment.payment_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        description: payment.student_name || "Course payment",
        category: (payment.course_slug && courseMap.get(payment.course_slug)) || "Course Fee",
        amount: formatCurrencyINR(Number(payment.amount)),
        type: "income",
        teacherSalary: false,
      }));

      const mergedExpenseRows: RecentTransaction[] = expenseTransactions.map((transaction) => ({
        id: transaction.id,
        dateValue: transaction.date,
        date: new Date(transaction.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        description: transaction.description || "Expense",
        category: transaction.category || "Other",
        amount: formatCurrencyINR(Number(transaction.amount)),
        type: "expense",
        teacherSalary:
          (transaction.teacher_id ?? null) !== null
          || transaction.description.startsWith("Teacher salary - "),
      }));

      const allTxns: RecentTransaction[] = [...mergedIncomeRows, ...mergedExpenseRows]
        .sort((a, b) => b.dateValue.localeCompare(a.dateValue));

      // Sorted newest first, so whichever limit is chosen always shows the most
      // recent entries rather than an arbitrary slice.
      setAllTransactions(allTxns);

      setDataLoading(false);
    }

    fetchFinanceData().catch((err) => {
      console.error("[finance] load crashed:", err);
      filterFetchSucceeded.current = false;
      if (!active) return;
      setDataError("We couldn't load the finance data. Please try again.");
      setDataLoading(false);
    }).finally(() => {
      if (!active) return;
      pendingFilterFetch.current?.(filterFetchSucceeded.current);
      pendingFilterFetch.current = null;
    });

    return () => {
      active = false;
    };
  }, [authenticated, dateFilters, refreshKey]);

  const { trend: trendData, expenseTrend, expenseCategories } = useMemo(
    () => buildFinanceCharts(financeRecords, financePeriod, customChartFilter),
    [financeRecords, financePeriod, customChartFilter]
  );
  const revenueAccent = "#22c55e";
  const expenseAccent = "#ef4444";
  const selectedPeriodDescription = customChartFilter?.type === "month"
    ? `Daily totals · ${parseLocalDate(`${customChartFilter.value}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
    : customChartFilter?.type === "dates"
      ? `${formatDateForUser(customChartFilter.from)} to ${formatDateForUser(customChartFilter.to)}`
      : customChartFilter?.type === "year"
        ? `Monthly totals · ${customChartFilter.value}`
        : FINANCE_PERIODS.find((period) => period.value === financePeriod)?.description ?? "";
  const financeFilterFields: FilterField[] = [
    { key: "from", label: "From date", type: "date", defaultValue: "" },
    { key: "to", label: "To date", type: "date", defaultValue: "" },
  ];

  async function applyFinanceFilters(values: FilterValues) {
    setDataLoading(true);
    setDataError(null);
    filterFetchSucceeded.current = true;
    setDateFilters({ from: values.from || "", to: values.to || "" });
    setRefreshKey((key) => key + 1);
    const succeeded = await new Promise<boolean>((resolve) => {
      pendingFilterFetch.current = resolve;
    });
    if (!succeeded) throw new Error("Finance filter request failed")
  }

  function applyChartFilter() {
    if (chartFilterType === "month") {
      if (!/^\d{4}-\d{2}$/.test(chartMonth)) {
        toast("Select a valid month.", { variant: "destructive" });
        return;
      }
      setCustomChartFilter({ type: "month", value: chartMonth });
      setFinancePeriod("month");
    } else if (chartFilterType === "dates") {
      if (!chartFrom || !chartTo || chartFrom > chartTo) {
        toast("Select a valid date range.", { variant: "destructive" });
        return;
      }
      setCustomChartFilter({ type: "dates", from: chartFrom, to: chartTo });
      setFinancePeriod("month");
    } else {
      const year = Number(chartYear);
      if (!Number.isInteger(year) || year < 1900 || year > 9999) {
        toast("Enter a valid year.", { variant: "destructive" });
        return;
      }
      setCustomChartFilter({ type: "year", value: String(year) });
      setFinancePeriod("year");
    }
    setChartFilterOpen(false);
  }

  function resetChartFilter() {
    setCustomChartFilter(null);
    setFinancePeriod("month");
    setChartFilterOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-xs text-muted-foreground">Financial overview for the selected period</p>
        </div>
        {authenticated && (
          <div className="flex items-center gap-2">
            <FilterDialog
              title="Filter finance"
              description="Choose a date range for revenue, expenses, and transactions."
              fields={financeFilterFields}
              values={dateFilters}
              onApply={applyFinanceFilters}
              onClear={applyFinanceFilters}
            />
            <Button variant="outline" className="gap-2" onClick={() => setExpenseOpen(true)}>
              <Wallet className="h-4 w-4" />
              Add Expense
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        )}
      </div>

      {/* OTP Gate */}
      {!authenticated && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl border bg-card shadow-lg">
              <div className="rounded-full bg-primary/10 p-3">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">Finance Access Protected</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit PIN to view financial data
                </p>
              </div>
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={(val) => { setPin(val); setError(false); }}
                onComplete={(val) => { setPin(val); }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              {error && (
                <p className="text-sm text-red-500">Incorrect PIN. Please try again.</p>
              )}
              <Button
                onClick={handleVerify}
                disabled={pin.length < 6 || loading}
                className="w-full"
              >
                {loading ? "Verifying..." : "Verify PIN"}
              </Button>
            </div>
          </div>

          {/* Blurred content behind */}
          <CardContent className="blur-sm select-none pointer-events-none">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {["Total Revenue", "Total Expenses", "Net Profit", "Profit Margin"].map((title) => (
                <Card key={title}>
                  <CardContent className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground truncate">{title}</p>
                    <p className="text-sm font-bold shrink-0">—</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 h-[350px] rounded-lg bg-muted/30" />
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="h-[300px] rounded-lg bg-muted/30" />
              <div className="h-[300px] rounded-lg bg-muted/30" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actual Content - shown after auth */}
      {authenticated && (
        <>
          {dataLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading financial data...</p>
            </div>
          ) : dataError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{dataError}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((stat) => (
                  <Card key={stat.title}>
                    <CardContent className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground truncate">{stat.title}</p>
                      <p className="text-sm font-bold shrink-0">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Cash flow trend */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Cash Flow Trend</CardTitle>
                      <CardDescription>{selectedPeriodDescription} · revenue, expenses, and net cash flow</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cash flow time period">
                      {FINANCE_PERIODS.map((period) => (
                        <Button
                          key={period.value}
                          type="button"
                          size="sm"
                          variant={financePeriod === period.value ? "default" : "outline"}
                          aria-pressed={financePeriod === period.value}
                          onClick={() => {
                            setCustomChartFilter(null);
                            setFinancePeriod(period.value);
                          }}
                        >
                          {period.label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant={customChartFilter ? "default" : "outline"}
                        className="gap-2"
                        onClick={() => setChartFilterOpen(true)}
                      >
                        <Filter className="size-4" />
                        Filter
                      </Button>
                      {customChartFilter && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Clear chart filter"
                          title="Clear chart filter"
                          onClick={resetChartFilter}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={trendData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={revenueAccent} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={revenueAccent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={expenseAccent} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={expenseAccent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="period" tick={axisStyle} />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          formatCurrencyINR(Number(value)),
                          String(name),
                        ]}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={revenueAccent}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Revenue"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke={expenseAccent}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExpenses)"
                        name="Expenses"
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        name="Net cash flow"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Dialog open={chartFilterOpen} onOpenChange={setChartFilterOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter cash flow chart</DialogTitle>
                    <DialogDescription>
                      Choose one month, a date range, or a full calendar year.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Chart filter type">
                      {([
                        ["month", "Month"],
                        ["dates", "Date range"],
                        ["year", "Year"],
                      ] as const).map(([type, label]) => (
                        <Button
                          key={type}
                          type="button"
                          variant={chartFilterType === type ? "default" : "outline"}
                          aria-pressed={chartFilterType === type}
                          onClick={() => setChartFilterType(type)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    {chartFilterType === "month" && (
                      <div className="space-y-2">
                        <Label htmlFor="chart-filter-month">Month</Label>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            id="chart-filter-month"
                            type="month"
                            value={chartMonth}
                            onChange={(event) => setChartMonth(event.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
                          />
                        </div>
                      </div>
                    )}
                    {chartFilterType === "dates" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="chart-filter-from">From date</Label>
                          <DateFilterInput
                            id="chart-filter-from"
                            value={chartFrom}
                            onChange={setChartFrom}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chart-filter-to">To date</Label>
                          <DateFilterInput
                            id="chart-filter-to"
                            value={chartTo}
                            onChange={setChartTo}
                          />
                        </div>
                      </div>
                    )}
                    {chartFilterType === "year" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Choose year</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Previous years"
                              onClick={() => setYearRangeStart((year) => year - 12)}
                            >
                              <ChevronLeft />
                            </Button>
                            <span className="min-w-24 text-center text-sm font-medium">
                              {yearRangeStart}–{yearRangeStart + 11}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Next years"
                              onClick={() => setYearRangeStart((year) => year + 12)}
                            >
                              <ChevronRight />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 12 }, (_, index) => String(yearRangeStart + index)).map((year) => (
                            <Button
                              key={year}
                              type="button"
                              size="sm"
                              variant={chartYear === year ? "default" : "outline"}
                              aria-pressed={chartYear === year}
                              onClick={() => setChartYear(year)}
                            >
                              {year}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetChartFilter}>
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                    <Button type="button" onClick={applyChartFilter}>Apply filter</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Finance-specific expense and collection insights */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                    <CardDescription>Category-wise expense distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => [`₹${(Number(value) / 1000).toFixed(0)}K`, ""]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {expenseBreakdown.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">₹{(item.value / 1000).toFixed(0)}K</span>
                            <Badge variant="secondary">{item.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Collections by Payment Method</CardTitle>
                    <CardDescription>Paid revenue split by how it was collected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={paymentMethodData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {paymentMethodData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => [formatCurrencyINR(Number(value)), "Collected"]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {paymentMethodData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{formatCurrencyINR(item.value)}</span>
                            <Badge variant="secondary">{item.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Expense category movement over the selected time range */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Trends by Category</CardTitle>
                  <CardDescription>{selectedPeriodDescription} · top expense categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={expenseTrend}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="period" tick={axisStyle} />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(value) => `₹${(Number(value) / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [formatCurrencyINR(Number(value)), String(name)]}
                      />
                      <Legend />
                      {expenseCategories.map((category, index) => (
                        <Bar
                          key={category}
                          dataKey={category}
                          stackId="expenses"
                          fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                          radius={index === expenseCategories.length - 1 ? 4 : 0}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Transactions Table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>
                        Showing {recentTransactions.length} of {allTransactions.length}
                        {transactionLimit === null ? " transactions" : " transactions"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="txn-limit" className="text-sm text-muted-foreground">
                        Show
                      </Label>
                      <select
                        id="txn-limit"
                        value={transactionLimit === null ? "all" : String(transactionLimit)}
                        onChange={(e) =>
                          setTransactionLimit(e.target.value === "all" ? null : Number(e.target.value))
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {TRANSACTION_LIMIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="font-medium">{txn.date}</TableCell>
                          <TableCell>{txn.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{txn.category}</Badge>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold",
                              txn.type === "income"
                                ? "text-emerald-500"
                                : "text-red-500"
                            )}
                          >
                            {txn.type === "income" ? "+" : "-"}{txn.amount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={txn.type === "income" ? "default" : "destructive"}
                            >
                              {txn.type === "income" ? (
                                <TrendingUp className="mr-1 h-3 w-3" />
                              ) : (
                                <TrendingDown className="mr-1 h-3 w-3" />
                              )}
                              {txn.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {txn.type === "expense" && !txn.teacherSalary && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete expense: ${txn.description}`}
                                onClick={() => setExpenseToDelete({
                                  id: txn.id,
                                  description: txn.description,
                                })}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {recentTransactions.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No transactions in this period.
                    </p>
                  )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
      <AddExpenseSheet
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSuccess={() => {
          if (!authenticated) return;
          setRefreshKey((prev) => prev + 1);
        }}
      />
      <Dialog
        open={expenseToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingExpense) setExpenseToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Delete Expense
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {expenseToDelete?.description || "this expense"}
              </span>
              ? This will update the finance totals and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExpenseToDelete(null)}
              disabled={deletingExpense}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteExpense}
              disabled={deletingExpense}
            >
              {deletingExpense && <Loader2 className="size-4 animate-spin" />}
              {deletingExpense ? "Deleting..." : "Delete Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Exports every transaction the date filter covers, not just the rows
          currently on screen. The limit is there to make the table readable;
          silently exporting a tenth of the ledger because someone left the
          selector on 10 would be worse than no selector at all. */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={allTransactions.map((t) => ({
          Date: t.date,
          Description: t.description,
          Category: t.category,
          Amount: t.amount,
          Type: t.type,
        }))}
        filename="finance-report"
      />
    </div>
  );
}
