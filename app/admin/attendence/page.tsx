"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Filter,
  Save,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import { ExportDialog } from "@/components/admin/export-dialog";

type AttendanceStatus = "Present" | "Absent" | "Late" | "Leave" | "Not Marked";

interface AttendanceRecord {
  studentId: string;
  name: string;
  course: string;
  branch: string;
  courseSlug: string | null;
  branchId: string | null;
  timeIn: string;
  timeOut: string;
  status: AttendanceStatus;
  hours: number;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [branch, setBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const savedStatuses = useRef(new Map<string, AttendanceStatus>());

  const fetchAttendance = useCallback(async () => {
    setLoading(true);

    const [attendanceRes, studentsRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("*, students(full_name)")
        .eq("date", date),
      supabase
        .from("students")
        .select("id, full_name, course_slug, branch_id, courses(name), branches(name)")
        .eq("status", "Active")
        .order("full_name"),
    ]);

    if (attendanceRes.error) {
      console.error("Error fetching attendance:", attendanceRes.error);
      setLoading(false);
      return;
    }
    if (studentsRes.error) {
      console.error("Error fetching students:", studentsRes.error);
      setLoading(false);
      return;
    }

    const attendanceMap = new Map<string, { timeIn: string; timeOut: string; status: string; hours: number }>();
    (attendanceRes.data ?? []).forEach((row) => {
      attendanceMap.set(row.student_id, {
        timeIn: row.time_in ?? "",
        timeOut: row.time_out ?? "",
        status: row.status,
        hours: row.hours ?? 0,
      });
    });

    const seen = new Set<string>();
    const records: AttendanceRecord[] = [];

    (studentsRes.data ?? []).forEach((s) => {
      const course = Array.isArray(s.courses) ? s.courses[0] : s.courses;
      const branch = Array.isArray(s.branches) ? s.branches[0] : s.branches;
      const att = attendanceMap.get(s.id);
      seen.add(s.id);
      records.push({
        studentId: s.id,
        name: s.full_name,
        course: course?.name ?? s.course_slug ?? "N/A",
        branch: branch?.name ?? "",
        courseSlug: s.course_slug,
        branchId: s.branch_id,
        timeIn: att?.timeIn ?? "",
        timeOut: att?.timeOut ?? "",
        status: (att?.status as AttendanceStatus) ?? "Not Marked",
        hours: att?.hours ?? 0,
      });
    });

    (attendanceRes.data ?? []).forEach((row) => {
      if (seen.has(row.student_id)) return;
      const att = attendanceMap.get(row.student_id);
      records.push({
        studentId: row.student_id,
        name: row.students?.full_name ?? "Unknown",
        course: row.course_slug ?? "N/A",
        branch: "",
        courseSlug: row.course_slug,
        branchId: row.branch_id,
        timeIn: att?.timeIn ?? "",
        timeOut: att?.timeOut ?? "",
        status: (att?.status as AttendanceStatus) ?? "Not Marked",
        hours: att?.hours ?? 0,
      });
    });

    setAttendanceData(records);
    savedStatuses.current = new Map(records.map((r) => [r.studentId, r.status]));

    setLoading(false);
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchAttendance();
  }, [fetchAttendance]);

  const filteredData = attendanceData.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = branch === "all" || student.branch === branch;
    return matchesSearch && matchesBranch;
  });

  const summaryStats = [
    { label: "Total Students", value: attendanceData.length, icon: Users, color: "text-blue-500" },
    { label: "Present", value: attendanceData.filter((r) => r.status === "Present").length, icon: CheckCircle2, color: "text-green-500" },
    { label: "Absent", value: attendanceData.filter((r) => r.status === "Absent").length, icon: XCircle, color: "text-red-500" },
    { label: "Late", value: attendanceData.filter((r) => r.status === "Late").length, icon: Clock, color: "text-yellow-500" },
  ];

  function handleStatusChange(studentId: string, status: "Present" | "Absent") {
    setAttendanceData((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  }

  function computeHours(inTime: string, outTime: string): number {
    const [ih, im] = inTime.split(":").map(Number);
    const [oh, om] = outTime.split(":").map(Number);
    let diff = oh * 60 + om - (ih * 60 + im);
    if (diff < 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  }

  async function handleSave() {
    const changed = attendanceData.some(
      (r) => savedStatuses.current.get(r.studentId) !== r.status
    );

    if (!changed) {
      toast("No changes to save", { variant: "info" });
      return;
    }

    const rows = attendanceData
      .filter((r) => r.status !== "Not Marked")
      .map((r) => ({
        student_id: r.studentId,
        date,
        course_slug: r.courseSlug,
        branch_id: r.branchId,
        status: r.status,
        time_in: r.timeIn || null,
        time_out: r.timeOut || null,
        hours: r.timeIn && r.timeOut ? computeHours(r.timeIn, r.timeOut) : r.hours,
      }));

    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setSaving(false);

    if (error) {
      toast("Failed to save attendance: " + error.message, { variant: "destructive" });
      return;
    }

    toast("Attendance saved successfully", { variant: "success" });
    // Refetch directly instead of through a reload counter, so the effect only
    // ever depends on the date it is actually keyed to.
    await fetchAttendance();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Track daily attendance records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {summaryStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className="text-sm font-bold shrink-0">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Attendance Records</h2>
              <p className="text-sm text-muted-foreground">
                Showing records for{" "}
                {new Date(date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search students..."
                  className="pl-8 sm:w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="sm:w-[170px]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <div className="relative">
                <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="all">All Branches</option>
                  <option value="Ramanthapur">Ramanthapur</option>
                  <option value="Amberpet">Amberpet</option>
                  <option value="Kodad">Kodad</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading attendance data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">
                      {student.studentId}
                    </TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.course}</TableCell>
                    <TableCell>{student.branch || "-"}</TableCell>
                    <TableCell>
                      {student.timeIn || "-"}
                    </TableCell>
                    <TableCell>
                      {student.timeOut || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={student.status === "Present" ? "default" : "outline"}
                          className={
                            student.status === "Present"
                              ? "h-7 w-8 px-0 text-xs bg-green-600 text-white hover:bg-green-600"
                              : "h-7 w-8 px-0 text-xs"
                          }
                          onClick={() => handleStatusChange(student.studentId, "Present")}
                        >
                          P
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={student.status === "Absent" ? "default" : "outline"}
                          className={
                            student.status === "Absent"
                              ? "h-7 w-8 px-0 text-xs bg-red-600 text-white hover:bg-red-600"
                              : "h-7 w-8 px-0 text-xs"
                          }
                          onClick={() => handleStatusChange(student.studentId, "Absent")}
                        >
                          A
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {student.hours > 0 ? student.hours.toFixed(2) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <p className="text-muted-foreground">No students found for this date.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={attendanceData.map((r) => ({
          "Student ID": r.studentId,
          Name: r.name,
          Course: r.course,
          Branch: r.branch,
          "Time In": r.timeIn,
          "Time Out": r.timeOut,
          Status: r.status,
          Hours: r.hours,
        }))}
        filename="attendance-report"
      />
    </div>
  );
}
