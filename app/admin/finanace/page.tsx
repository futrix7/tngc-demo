"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Download,
  Wallet,
  PiggyBank,
  CreditCard,
  BarChart3,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/admin/export-dialog";
import { supabase } from "@/lib/supabase";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog";

interface SummaryCard {
  title: string;
  value: string;
  icon: typeof IndianRupee;
  change: string;
  trend: "up" | "down";
  color: string;
  bgColor: string;
}

interface MonthlyDatum {
  month: string;
  revenue: number;
  expenses: number;
}

interface ExpenseItem {
  name: string;
  value: number;
  percentage: number;
}

interface CourseRevenueItem {
  name: string;
  amount: string;
  percentage: number;
}

interface BranchDatum {
  branch: string;
  revenue: number;
}

interface RecentTransaction {
  date: string;
  description: string;
  category: string;
  amount: string;
  type: "income" | "expense";
}

function formatCurrencyINR(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function defaultFinanceRange() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  return { from: localDateKey(start), to: localDateKey(today) }
}

export default function AdminFinancePage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyDatum[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseItem[]>([]);
  const [courseRevenue, setCourseRevenue] = useState<CourseRevenueItem[]>([]);
  const [branchData, setBranchData] = useState<BranchDatum[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<RecentTransaction[]>([]);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateFilters, setDateFilters] = useState(defaultFinanceRange);
  const pendingFilterFetch = useRef<((success: boolean) => void) | null>(null);
  const filterFetchSucceeded = useRef(true);
  const [isInProfit, setIsInProfit] = useState(true);

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
        const rows: { id: string; date: string; description: string; category: string; amount: number; type: "income" | "expense"; branch_id: string | null; created_at: string }[] = []
        let offset = 0
        while (true) {
          let query = supabase.from("transactions").select("*").order("date", { ascending: false })
          if (dateFilters.from) query = query.gte("date", dateFilters.from)
          if (dateFilters.to) query = query.lte("date", dateFilters.to)
          const result = await query.range(offset, offset + 999)
          if (result.error) return { data: null, error: result.error }
          rows.push(...(result.data ?? []))
          if (!result.data || result.data.length < 1000) break
          offset += 1000
        }
        return { data: rows, error: null }
      }

      async function fetchPayments() {
        const rows: { id: string; student_name: string; course_slug: string | null; amount: number; payment_date: string; method: string; status: string; branch_id: string | null }[] = []
        let offset = 0
        while (true) {
          let query = supabase.from("payments").select("id, student_name, course_slug, amount, payment_date, method, status, branch_id").order("payment_date", { ascending: false })
          if (dateFilters.from) query = query.gte("payment_date", dateFilters.from)
          if (dateFilters.to) query = query.lte("payment_date", dateFilters.to)
          const result = await query.range(offset, offset + 999)
          if (result.error) return { data: null, error: result.error }
          rows.push(...(result.data ?? []))
          if (!result.data || result.data.length < 1000) break
          offset += 1000
        }
        return { data: rows, error: null }
      }

      const [transactionsResult, paymentsResult, coursesResult, branchesResult] = await Promise.all([
        fetchTransactions(),
        fetchPayments(),
        supabase.from("courses").select("slug, name"),
        supabase.from("branches").select("id, name"),
      ]);

      // Checked explicitly rather than folded into `|| []`. This page selects
      // `branch_id` from `payments`, a column that did not exist for a while, and
      // PostgREST rejects the whole query when one selected column is unknown.
      // Because every result was defaulted to an empty array, that failure made
      // the payment list and the branch chart render as "no data" — a page that
      // looked correct and was quietly wrong. An unrun migration is a real
      // operator problem and should say so.
      const failures = [
        transactionsResult.error,
        paymentsResult.error,
        coursesResult.error,
        branchesResult.error,
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
        coursesResult.data.forEach((c) => courseMap.set(c.slug, c.name));
      }

      const branchMap = new Map<string, string>();
      if (branchesResult.data) {
        branchesResult.data.forEach((b) => branchMap.set(b.id, b.name));
      }

      const verifiedPayments = (payments || []).filter((p) => p.status === "Paid");
      const expenseTransactions = (transactions || []).filter((t) => t.type === "expense");

      const totalIncome = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const netProfit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
      const profitStatus = netProfit >= 0;
      setIsInProfit(profitStatus);

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

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const now = new Date();
      const monthlyMap = new Map<string, { revenue: number; expenses: number }>();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthNames[d.getMonth()];
        monthlyMap.set(key, { revenue: 0, expenses: 0 });
      }

      for (const payment of verifiedPayments) {
        const d = new Date(payment.payment_date);
        const key = monthNames[d.getMonth()];
        if (monthlyMap.has(key)) {
          monthlyMap.get(key)!.revenue += Number(payment.amount);
        }
      }

      for (const transaction of expenseTransactions) {
        const d = new Date(transaction.date);
        const key = monthNames[d.getMonth()];
        if (monthlyMap.has(key)) {
          monthlyMap.get(key)!.expenses += Number(transaction.amount);
        }
      }

      setMonthlyData(Array.from(monthlyMap.entries()).map(([month, vals]) => ({ month, ...vals })));

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

      const courseRevMap = new Map<string, number>();
      for (const payment of verifiedPayments) {
        const slug = payment.course_slug || "Unknown";
        courseRevMap.set(slug, (courseRevMap.get(slug) || 0) + Number(payment.amount));
      }

      const totalCourseRev = Array.from(courseRevMap.values()).reduce((sum, value) => sum + value, 0);
      const courseRevItems: CourseRevenueItem[] = Array.from(courseRevMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([slug, amount]) => ({
          name: courseMap.get(slug) || slug,
          amount: formatCurrencyINR(amount),
          percentage: totalCourseRev > 0 ? Math.round((amount / totalCourseRev) * 100) : 0,
        }));
      setCourseRevenue(courseRevItems);

      const branchRevMap = new Map<string, number>();
      for (const payment of verifiedPayments) {
        const branchId = payment.branch_id || "unknown";
        branchRevMap.set(branchId, (branchRevMap.get(branchId) || 0) + Number(payment.amount));
      }

      const branchItems: BranchDatum[] = Array.from(branchRevMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([branchId, revenue]) => ({
          branch: branchMap.get(branchId) || "Unknown",
          revenue,
        }));
      setBranchData(branchItems);

      const mergedIncomeRows: RecentTransaction[] = verifiedPayments.map((payment) => ({
        date: new Date(payment.payment_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        description: payment.student_name || "Course payment",
        category: (payment.course_slug && courseMap.get(payment.course_slug)) || "Course Fee",
        amount: formatCurrencyINR(Number(payment.amount)),
        type: "income",
      }));

      const mergedExpenseRows: RecentTransaction[] = expenseTransactions.map((transaction) => ({
        date: new Date(transaction.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        description: transaction.description || "Expense",
        category: transaction.category || "Other",
        amount: formatCurrencyINR(Number(transaction.amount)),
        type: "expense",
      }));

      const allTxns: RecentTransaction[] = [...mergedIncomeRows, ...mergedExpenseRows]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setAllTransactions(allTxns);
      setRecentTransactions(allTxns.slice(0, 10));

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

  const revenueAccent = isInProfit ? "#22c55e" : "#ef4444";
  const expenseAccent = "#ef4444";
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

              {/* Monthly Revenue vs Expenses Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Monthly Revenue vs Expenses</CardTitle>
                      <CardDescription>Comparative trend for the last 6 months</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Total Revenue: {formatCurrencyINR(monthlyData.reduce((sum, item) => sum + Number(item.revenue || 0), 0))}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={monthlyData}>
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
                      <XAxis
                        dataKey="month"
                        tick={axisStyle}
                      />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`₹${(Number(value) / 1000).toFixed(0)}K`, ""]}
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
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense Breakdown & Branch-wise Revenue */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Expense Breakdown Pie Chart */}
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

                {/* Branch-wise Revenue Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Branch-wise Revenue</CardTitle>
                    <CardDescription>Revenue comparison across branches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={branchData} layout="vertical">
                        <CartesianGrid {...gridStyle} />
                        <XAxis
                          type="number"
                          tick={axisStyle}
                          tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                        />
                        <YAxis
                          type="category"
                          dataKey="branch"
                          tick={axisStyle}
                          width={100}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => [`₹${(Number(value) / 100000).toFixed(1)}L`, "Revenue"]}
                        />
                        <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                          {branchData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-3">
                      {branchData.map((branch) => (
                        <div key={branch.branch} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{branch.branch}</span>
                          <span className="text-sm text-muted-foreground">
                            ₹{(branch.revenue / 100000).toFixed(1)}L
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue by Course */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Course</CardTitle>
                  <CardDescription>Course-wise revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {courseRevenue.map((course) => (
                    <div key={course.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate pr-2">
                          {course.name}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {course.amount}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={course.percentage} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {course.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Transactions Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Latest financial transactions</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowAllTxns((s) => !s)}>
                      {showAllTxns ? "Show Less" : "View All"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(showAllTxns ? allTransactions : recentTransactions).map((txn, index) => (
                        <TableRow key={index}>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
          setShowAllTxns(true);
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={recentTransactions.map((t) => ({
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
