"use client";

import { useState, useEffect } from "react";
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
  Filter,
  Download,
  ArrowRight,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;

  async function fetchStudents() {
    setLoading(true);

    const { data: studentsRows, error } = await supabase
      .from("students")
      .select("id, full_name, phone, enrollment_date, status, course_slug, branch_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching students:", error);
      setLoading(false);
      return;
    }

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

    const total = mapped.length;
    const active = mapped.filter((s) => s.status === "Active").length;
    const pending = mapped.filter((s) => s.status === "Pending").length;
    const inactive = mapped.filter((s) => s.status === "Inactive").length;

    setStats([
      { label: "Total Students", value: total, color: "text-foreground" },
      { label: "Active", value: active, color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Pending", value: pending, color: "text-amber-600 dark:text-amber-400" },
      { label: "Inactive", value: inactive, color: "text-red-600 dark:text-red-400" },
    ]);

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchStudents();
  }, []);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.id.toLowerCase().includes(search.toLowerCase()) ||
      student.course.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const startIndex = (currentPage - 1) * studentsPerPage;
  const paginatedStudents = filteredStudents.slice(
    startIndex,
    startIndex + studentsPerPage
  );

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
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Manage all student records</p>
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
                Showing {filteredStudents.length} of {students.length} students
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
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
              {paginatedStudents.map((student) => (
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
              {paginatedStudents.length === 0 && (
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
    </div>
  );
}
