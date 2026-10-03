"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Clock, Star, Edit, Trash2, Award, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AddCourseSheet } from "@/components/admin/add-course-sheet";
import { EditCourseSheet } from "@/components/admin/edit-course-sheet";
import { useToast } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

type CourseType = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  duration: string;
  fee: number;
  students: number;
  category: "long-term" | "short-term";
  popular?: boolean;
  rating?: number;
  nextBatch?: string;
  status?: "active" | "upcoming" | "full";
  eligibility: string;
  description: string;
  topics: string[];
};

const filterTabs = [
  { label: "All", value: "all" as const },
  { label: "Long-Term", value: "long-term" as const },
  { label: "Short-Term", value: "short-term" as const },
];

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  upcoming: { label: "Upcoming", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  full: { label: "Full", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

/**
 * Looks a course's status up without ever returning undefined.
 *
 * `course_status` is an enum with a default, so the three keys above cover every
 * row the database can hold — but the column is read as `c.status ?? "active"`,
 * which means a course saved before the enum existed, or edited by hand, can carry
 * anything at all. `statusBadge[course.status].className` then threw on the first
 * access, and the whole courses page went blank for every course, not just the
 * odd one. An unrecognised value is shown as itself rather than swallowed.
 */
function courseStatusBadge(status: string | null | undefined) {
  return (
    statusBadge[status ?? ""] ?? {
      label: status || "Unknown",
      className: "bg-muted text-muted-foreground border-border",
    }
  );
}

export default function AdminCoursesPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "long-term" | "short-term">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseType | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<CourseType | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseType[]>([]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);

    const { data: coursesData, error: coursesError } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (coursesError) {
      console.error("Error fetching courses:", coursesError);
      toast("Unable to load courses: " + coursesError.message, { variant: "destructive" });
      setLoading(false);
      return;
    }

    const pageSize = 1000;
    const feeEnrollments: { student_id: string | null; course_slug: string | null }[] = [];
    const primaryEnrollments: { id: string; course_slug: string | null }[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("fees")
        .select("student_id, course_slug")
        .not("course_slug", "is", null)
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Error fetching course enrollments:", error);
        toast("Unable to load enrolled student counts: " + error.message, { variant: "destructive" });
        setLoading(false);
        return;
      }
      feeEnrollments.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("students")
        .select("id, course_slug")
        .eq("is_legacy_import", false)
        .not("course_slug", "is", null)
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Error fetching primary student courses:", error);
        toast("Unable to load enrolled student counts: " + error.message, { variant: "destructive" });
        setLoading(false);
        return;
      }
      primaryEnrollments.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    const studentsByCourse: Record<string, Set<string>> = {};
    for (const row of feeEnrollments) {
      if (!row.course_slug || !row.student_id) continue;
      (studentsByCourse[row.course_slug] ??= new Set()).add(row.student_id);
    }
    for (const row of primaryEnrollments) {
      if (!row.course_slug) continue;
      (studentsByCourse[row.course_slug] ??= new Set()).add(row.id);
    }

    const mapped: CourseType[] = (coursesData || []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      short_name: c.short_name ?? "",
      duration: c.duration,
      fee: c.fee_numeric ?? 0,
      students: studentsByCourse[c.slug]?.size ?? 0,
      category: c.type,
      popular: c.popular ?? false,
      rating: c.rating ?? null,
      nextBatch: c.next_batch ?? null,
      status: c.status ?? "active",
      eligibility: c.eligibility ?? "",
      description: c.description ?? "",
      topics: c.topics ?? [],
    }));

    setCourses(mapped);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchCourses();
  }, [fetchCourses]);

  const filteredCourses =
    activeFilter === "all"
      ? courses
      : courses.filter((c) => c.category === activeFilter);

  function handleFilterChange(value: "all" | "long-term" | "short-term") {
    setActiveFilter(value);
  }

  function handleEdit(course: CourseType) {
    setEditingCourse(course);
    setEditOpen(true);
  }

  function handleDelete(course: CourseType) {
    setDeletingCourse(course);
    setDeleteName("");
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deletingCourse || deleteName !== deletingCourse.name) return;
    setDeleting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" });
        return;
      }

      const response = await fetch("/api/admin/courses/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: deletingCourse.id, confirmationName: deleteName }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        toast(result.error ?? "Failed to delete course.", { variant: "destructive" });
        return;
      }

      toast("Course deleted successfully", { variant: "success" });
      setDeleteOpen(false);
      setDeletingCourse(null);
      setDeleteName("");
      await fetchCourses();
    } catch (error) {
      console.error("[admin courses] delete failed:", error);
      toast("Failed to delete course. Please try again.", { variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const deleteEnabled = deletingCourse && deleteName === deletingCourse.name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-xs text-muted-foreground">Manage all courses and programmes</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                activeFilter === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Course
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Courses", value: courses.length },
          { label: "Enrollments", value: courses.reduce((sum, c) => sum + c.students, 0) },
          { label: "Popular", value: courses.filter((c) => c.popular).length },
          { label: "Highest Fee", value: courses.length > 0 ? `₹${Math.max(...courses.map((c) => c.fee)).toLocaleString("en-IN")}` : "₹0" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className="text-sm font-bold shrink-0">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base leading-tight">{course.name}</CardTitle>
                <div className="flex items-center gap-1.5">
                  {course.popular && (
                    <Badge variant="secondary" className="shrink-0 bg-amber-500/10 text-amber-700 border-amber-500/20">
                      <Star className="mr-1 h-3 w-3 fill-current" />
                      Popular
                    </Badge>
                  )}
                  {course.status && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", courseStatusBadge(course.status).className)}
                    >
                      {courseStatusBadge(course.status).label}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                {course.duration}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Fee</p>
                  <p className="font-semibold text-sm">₹{course.fee.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Enrolled students</p>
                  <p className="font-semibold text-sm">{course.students}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium">{course.rating ?? "—"}</span>
                  <span className="text-muted-foreground">/ 5</span>
                </div>
              </div>

              {course.nextBatch && (
                <div className="flex items-center justify-between text-xs border-t pt-2">
                  <span className="text-muted-foreground">Next Batch</span>
                  <span className="font-medium text-primary">{course.nextBatch}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(course)}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  onClick={() => handleDelete(course)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddCourseSheet open={addOpen} onOpenChange={setAddOpen} onSuccess={() => fetchCourses()} />
      <EditCourseSheet open={editOpen} onOpenChange={setEditOpen} course={editingCourse} onSuccess={() => fetchCourses()} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-lg">
              <Trash2 className="size-5" />
              Delete Course
            </DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-semibold text-foreground">{deletingCourse?.name}</span>.
              A course with student enrollments or linked financial/learning records cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="deleteName" className="text-sm font-semibold">
              Type the course name to confirm: <span className="text-foreground">{deletingCourse?.name}</span>
            </Label>
            <Input
              id="deleteName"
              placeholder={deletingCourse?.name}
              value={deleteName}
              onChange={(e) => setDeleteName(e.target.value)}
              className={cn("h-11", deleteName && !deleteEnabled && "border-red-500")}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setDeleteOpen(false)} disabled={deleting} className="px-6">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={confirmDelete}
              disabled={!deleteEnabled || deleting}
              className="gap-2 px-6"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
