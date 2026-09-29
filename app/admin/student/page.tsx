"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Search,
  Download,
  ArrowRight,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { AddStudentSheet } from "@/components/admin/add-student-sheet";
import { FilterDialog, type FilterField, type FilterValues } from "@/components/admin/filter-dialog";

interface Student {
  id: string;
  name: string;
  course: string;
  branch: string;
  phone: string;
  enrollmentDate: string;
  status: "Active" | "Inactive" | "Pending";
}

interface Stats {
  label: string;
  value: number;
  color: string;
}

const statusVariant: Record<
  Student["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  Active: "default",
  Pending: "secondary",
  Inactive: "destructive",
};

function sanitizeStudentSearch(value: string) {
  return value.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "");
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats[]>([
    { label: "Total Students", value: 0, color: "text-foreground" },
    { label: "Active", value: 0, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Pending", value: 0, color: "text-amber-600 dark:text-amber-400" },
    { label: "Inactive", value: 0, color: "text-red-600 dark:text-red-400" },
  ]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [courses, setCourses] = useState<{ slug: string; name: string }[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const studentsPerPage = 10;
  const requestId = useRef(0);
  const manualFetchKey = useRef<string | null>(null);

  const fetchStudents = useCallback(async (page: number, term: string, selectedStatus: string, selectedCourse: string) => {
    const activeRequest = ++requestId.current;
    setLoading(true);

    let query = supabase
      .from("students")
      .select("id, full_name, email, phone, enrollment_date, status, course_slug, branch_id", { count: "exact" })
      .order("created_at", { ascending: false });

    const safeTerm = sanitizeStudentSearch(term);
    if (safeTerm) {
      query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%,id.ilike.%${safeTerm}%`);
    }
    if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
    if (selectedCourse !== "all") query = query.eq("course_slug", selectedCourse);

    const { data: studentsRows, error, count } = await query.range(
      (page - 1) * studentsPerPage,
      page * studentsPerPage - 1
    );

    if (error) {
      console.error("Error fetching students:", error);
      if (activeRequest === requestId.current) setStudents([]);
      setLoading(false);
      return false;
    }

    if (activeRequest !== requestId.current) return true;

    const courseSlugs = [...new Set(studentsRows.map((s) => s.course_slug).filter(Boolean))] as string[];
    const branchIds = [...new Set(studentsRows.map((s) => s.branch_id).filter(Boolean))] as string[];

    let coursesMap: Record<string, string> = {};
    let branchesMap: Record<string, string> = {};

    if (courseSlugs.length > 0) {
      const { data: coursesData } = await supabase
        .from("courses")
        .select("slug, name")
        .in("slug", courseSlugs);
      if (coursesData) {
        coursesMap = Object.fromEntries(coursesData.map((c) => [c.slug, c.name]));
      }
    }

    if (branchIds.length > 0) {
      const { data: branchesData } = await supabase
        .from("branches")
        .select("id, name")
        .in("id", branchIds);
      if (branchesData) {
        branchesMap = Object.fromEntries(branchesData.map((b) => [b.id, b.name]));
      }
    }

    const mapped: Student[] = studentsRows.map((s) => ({
      id: s.id,
      name: s.full_name,
      course: s.course_slug ? coursesMap[s.course_slug] ?? s.course_slug : "",
      branch: s.branch_id ? branchesMap[s.branch_id] ?? s.branch_id : "",
      phone: s.phone,
      enrollmentDate: s.enrollment_date,
      status: s.status as Student["status"],
    }));

    setStudents(mapped);
    setTotalCount(count ?? 0);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const queryKey = JSON.stringify({ currentPage, search, statusFilter, courseFilter });
      if (manualFetchKey.current === queryKey) {
        manualFetchKey.current = null;
        return;
      }
      fetchStudents(currentPage, search, statusFilter, courseFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [courseFilter, currentPage, fetchStudents, search, statusFilter]);

  useEffect(() => {
    async function fetchDirectoryStats() {
      const [coursesResult, totalResult, activeResult, pendingResult, inactiveResult] = await Promise.all([
        supabase.from("courses").select("slug, name").order("name"),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "Pending"),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "Inactive"),
      ]);
      setCourses(coursesResult.data ?? []);
      setStats([
        { label: "Total Students", value: totalResult.count ?? 0, color: "text-foreground" },
        { label: "Active", value: activeResult.count ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Pending", value: pendingResult.count ?? 0, color: "text-amber-600 dark:text-amber-400" },
        { label: "Inactive", value: inactiveResult.count ?? 0, color: "text-red-600 dark:text-red-400" },
      ]);
    }
    fetchDirectoryStats();
  }, []);

  const totalPages = Math.ceil(totalCount / studentsPerPage);

  const directoryFilterFields: FilterField[] = [
    {
      key: "status",
      label: "Student status",
      type: "select",
      defaultValue: "all",
      options: [
        { value: "all", label: "All statuses" },
        { value: "Active", label: "Active" },
        { value: "Pending", label: "Pending" },
        { value: "Inactive", label: "Inactive" },
      ],
    },
    {
      key: "course",
      label: "Course",
      type: "select",
      defaultValue: "all",
      options: [
        { value: "all", label: "All courses" },
        ...courses.map((course) => ({ value: course.slug, label: course.name })),
      ],
    },
  ];

  async function applyDirectoryFilters(values: FilterValues) {
    const nextStatus = values.status || "all";
    const nextCourse = values.course || "all";
    const request = { currentPage: 1, search, statusFilter: nextStatus, courseFilter: nextCourse };
    manualFetchKey.current = JSON.stringify(request);
    setStatusFilter(nextStatus);
    setCourseFilter(nextCourse);
    setCurrentPage(1);
    if (!await fetchStudents(1, search, nextStatus, nextCourse)) throw new Error("Student filter request failed")
  }

  async function handleExport() {
    setExporting(true);
    const safeTerm = sanitizeStudentSearch(search);
    const rows: { id: string; full_name: string; email: string; phone: string; course_slug: string | null; branch_id: string | null; enrollment_date: string; status: string }[] = [];
    let offset = 0;

    try {
      while (true) {
        let query = supabase
          .from("students")
          .select("id, full_name, email, phone, course_slug, branch_id, enrollment_date, status")
          .order("created_at", { ascending: false });
        if (safeTerm) query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%,id.ilike.%${safeTerm}%`);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
        if (courseFilter !== "all") query = query.eq("course_slug", courseFilter);
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        offset += 1000;
      }

      const branchIds = [...new Set(rows.map((row) => row.branch_id).filter(Boolean))] as string[];
      const { data: branchRows } = branchIds.length
        ? await supabase.from("branches").select("id, name").in("id", branchIds)
        : { data: [] as { id: string; name: string }[] };
      const branchNames = new Map((branchRows ?? []).map((row) => [row.id, row.name]));
      const columns = ["Student ID", "Name", "Email", "Phone", "Course", "Branch", "Enrollment Date", "Status"];
      const csvCell = (value: unknown) => {
        const text = String(value ?? "");
        const safeText = /^[=+@-]/.test(text) ? `'${text}` : text;
        return `"${safeText.replace(/"/g, '""')}"`;
      };
      const csv = [columns, ...rows.map((row) => [
        row.id,
        row.full_name,
        row.email,
        row.phone,
        courses.find((item) => item.slug === row.course_slug)?.name ?? row.course_slug ?? "",
        branchNames.get(row.branch_id ?? "") ?? "",
        row.enrollment_date,
        row.status,
      ])].map((line) => line.map(csvCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "students.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting students:", error);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage all student records</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 size-4" />
          Register Student
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-sm font-bold shrink-0", stat.color)}>
                {stat.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Student Directory</CardTitle>
              <CardDescription>
                Showing {students.length} of {totalCount.toLocaleString()} matching students
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, email, ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-8 sm:w-md lg:w-xl"
                />
              </div>
              <FilterDialog
                title="Filter students"
                description="Choose status and course filters, then apply them together."
                fields={directoryFilterFields}
                values={{ status: statusFilter, course: courseFilter }}
                onApply={applyDirectoryFilters}
                onClear={applyDirectoryFilters}
              />
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4" />
                <span>{exporting ? "Exporting..." : "Export"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Students Table */}
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Course</TableHead>
                <TableHead className="hidden lg:table-cell">Branch</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Enrollment Date
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-xs">
                    <Link href={`/admin/student/${student.id}/profile`} className="block">
                      {student.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/student/${student.id}/profile`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {student.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
                          <Phone className="h-3 w-3" />
                          {student.phone}
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    <Link href={`/admin/student/${student.id}/profile`} className="block">
                      {student.course}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    <Link href={`/admin/student/${student.id}/profile`} className="block">
                      {student.branch}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {student.phone}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    <Link href={`/admin/student/${student.id}/profile`} className="block">
                      {student.enrollmentDate}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[student.status]}>
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/student/${student.id}/profile`}>
                      <Button variant="ghost" size="icon-sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <p className="text-muted-foreground">
                      No students found matching your search.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        <CardFooter className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
      <AddStudentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => fetchStudents(currentPage, search, statusFilter, courseFilter)}
      />
    </div>
  );
}
