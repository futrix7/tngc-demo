"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Mail,
  Phone,
  Award,
  BookOpen,
  IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AddTeacherSheet } from "@/components/admin/add-teacher-sheet";
import { EditTeacherSheet, type TeacherRecord } from "@/components/admin/edit-teacher-sheet";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/sonner";

interface Teacher {
  id: string;
  name: string;
  role: string;
  branch: string;
  branchId: string | null;
  subjects: string[];
  experience: number;
  status: "Active" | "On Leave";
  email: string | null;
  phone: string;
  salary: number | null;
}

export default function TeachersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(null);
  const [salaryTeacher, setSalaryTeacher] = useState<Teacher | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  async function fetchTeachers() {
    setLoading(true);
    const { data: teachersData, error } = await supabase
      .from("teachers")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching teachers:", error);
      setLoading(false);
      return;
    }

    const mapped: Teacher[] = (teachersData || []).map((t) => ({
      id: t.id,
      name: t.full_name,
      role: t.role,
      branch: t.branches?.name ?? "",
      branchId: t.branch_id ?? null,
      subjects: t.subjects ?? [],
      experience: t.experience ?? 0,
      status: t.status ?? "Active",
      email: t.email,
      phone: t.phone,
      salary: t.salary ?? null,
    }));

    setTeachers(mapped);
    setLoading(false);
  }

  async function handlePaySalary(teacher: Teacher, month: string) {
    const amount = Number(teacher.salary ?? 0);

    if (!teacher.salary || amount <= 0) {
      toast("Add a valid monthly salary before paying this teacher", { variant: "destructive" });
      return;
    }

    if (!month) {
      toast("Select the salary month first", { variant: "destructive" });
      return;
    }

    const recentPaymentThreshold = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existingSalary, error: lookupError } = await supabase
      .from("transactions")
      .select("id")
      .eq("type", "expense")
      .eq("category", "Salary")
      .eq("teacher_id", teacher.id)
      .gte("created_at", recentPaymentThreshold)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[teachers] salary eligibility check failed:", lookupError.message);
      toast("Unable to verify salary eligibility. Please try again.", { variant: "destructive" });
      return;
    }

    if (existingSalary) {
      toast("A recent salary payment is already recorded for this teacher.", { variant: "warning" });
      setSalaryOpen(false);
      setSalaryTeacher(null);
      return;
    }

    const paidOn = new Date();
    const paidDate = [
      paidOn.getFullYear(),
      String(paidOn.getMonth() + 1).padStart(2, "0"),
      String(paidOn.getDate()).padStart(2, "0"),
    ].join("-");

    const { error } = await supabase.from("transactions").insert({
      date: paidDate,
      description: `Teacher salary - ${teacher.name} - ${month}`,
      category: "Salary",
      amount,
      type: "expense",
      branch_id: teacher.branchId,
      teacher_id: teacher.id,
    });

    if (error) {
      toast("Failed to record teacher salary: " + error.message, { variant: "destructive" });
      return;
    }

    toast(`Salary paid for ${teacher.name} in ${month}`, { variant: "success" });
    setSalaryOpen(false);
    setSalaryTeacher(null);
    setSalaryMonth(new Date().toISOString().slice(0, 7));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchTeachers();
  }, []);

  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.subjects.some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const stats = [
    { label: "Total Teachers", value: teachers.length, color: "text-accent-foreground" },
    { label: "Active", value: teachers.filter((t) => t.status === "Active").length, color: "text-emerald-600" },
    { label: "On Leave", value: teachers.filter((t) => t.status === "On Leave").length, color: "text-amber-600" },
    { label: "Monthly Salary", value: `₹${teachers.reduce((sum, t) => sum + Number(t.salary ?? 0), 0).toLocaleString("en-IN")}`, color: "text-violet-600" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading teachers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
        <p className="text-muted-foreground">
          Manage faculty and instructors
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-sm font-bold shrink-0", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              className="w-full pl-8 sm:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTeachers.map((teacher) => (
          <Card key={teacher.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{teacher.name}</CardTitle>
                  <CardDescription>{teacher.role}</CardDescription>
                </div>
                <Badge
                  variant={teacher.status === "Active" ? "default" : "secondary"}
                  className={cn(
                    teacher.status === "Active" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                    teacher.status === "On Leave" && "bg-amber-100 text-amber-700 hover:bg-amber-100"
                  )}
                >
                  {teacher.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{teacher.branch}</p>

              <div className="flex flex-wrap gap-1.5">
                {teacher.subjects.map((subject) => (
                  <Badge key={subject} variant="outline" className="text-xs">
                    {subject}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" />
                  <span>{teacher.experience} yrs exp</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{teacher.subjects.length} subjects</span>
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <IndianRupee className="h-3.5 w-3.5" />
                  <span>{teacher.salary ? `₹${Number(teacher.salary).toLocaleString("en-IN")}/month` : "Salary not set"}</span>
                </div>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{teacher.email || "Email not provided"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{teacher.phone}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTeacher({
                      id: teacher.id,
                      full_name: teacher.name,
                      email: teacher.email,
                      phone: teacher.phone,
                      role: teacher.role,
                      branch_id: teacher.branchId,
                      subjects: teacher.subjects,
                      experience: teacher.experience,
                      status: teacher.status,
                      salary: teacher.salary,
                    });
                    setEditOpen(true);
                  }}
                >
                  Edit Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSalaryTeacher(teacher);
                    setSalaryMonth(new Date().toISOString().slice(0, 7));
                    setSalaryOpen(true);
                  }}
                >
                  Pay Salary
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <AddTeacherSheet open={addOpen} onOpenChange={setAddOpen} onSuccess={() => fetchTeachers()} />
      <EditTeacherSheet
        teacher={selectedTeacher}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedTeacher(null)
        }}
        onSuccess={() => fetchTeachers()}
      />

      {salaryOpen && salaryTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Pay Salary</h3>
                <p className="text-sm text-muted-foreground">Select the month for {salaryTeacher.name}.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="salary-month" className="text-sm font-medium">Salary Month</label>
                <input
                  id="salary-month"
                  type="month"
                  value={salaryMonth}
                  onChange={(event) => setSalaryMonth(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Amount: <span className="font-semibold">₹{Number(salaryTeacher.salary ?? 0).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setSalaryOpen(false); setSalaryTeacher(null); }}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={() => handlePaySalary(salaryTeacher, salaryMonth)}>
                  Confirm Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
