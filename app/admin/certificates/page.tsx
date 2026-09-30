"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Search, Award, CheckCircle2, Clock, Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { mintId } from "@/lib/mint-id"
import { localDate } from "@/lib/local-date"

interface Certificate {
  id: string
  studentName: string
  studentId: string
  course: string
  type: string
  issuedDate: string
  credentialId: string
  status: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
}

interface StudentOption {
  id: string
  full_name: string
  course_slug: string | null
  courseName: string
}

const statusConfig: Record<string, { className: string; icon: React.ElementType }> = {
  Issued: { className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  Pending: { className: "bg-amber-500/15 text-amber-600", icon: Clock },
  Rejected: { className: "bg-red-500/15 text-red-600", icon: Clock },
  Processing: { className: "bg-blue-500/15 text-blue-600", icon: Clock },
  Requested: { className: "bg-purple-500/15 text-purple-600", icon: Send },
}

export default function AdminCertificatesPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [issueOpen, setIssueOpen] = useState(false)
  const [studentPickerOpen, setStudentPickerOpen] = useState(false)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  const [certType, setCertType] = useState("Completion")
  const [issuing, setIssuing] = useState(false)

  async function fetchCertificates() {
    setLoading(true)
    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching certificates:", error)
      setLoading(false)
      return
    }

    const courseSlugs = [...new Set((data || []).map((row) => row.course_slug).filter(Boolean))] as string[]
    const { data: courseRows } = courseSlugs.length
      ? await supabase.from("courses").select("slug, name").in("slug", courseSlugs)
      : { data: [] }
    const courseMap = new Map((courseRows ?? []).map((course) => [course.slug, course.name]))

    const mapped: Certificate[] = (data || []).map((row) => ({
      id: row.id,
      studentName: row.student_name,
      studentId: row.student_id,
      course: row.course_slug ? (courseMap.get(row.course_slug) ?? row.course_slug) : "—",
      type: row.type,
      issuedDate: row.issued_date || "—",
      credentialId: row.credential_id || "—",
      status: row.status,
    }))

    setCertificates(mapped)
    setLoading(false)
  }

  async function fetchStudents() {
    const [studentsRes, instRes, feesRes, certRes] = await Promise.all([
      supabase.from("students").select("id, full_name").order("full_name"),
      supabase.from("fee_installments").select("fee_id, status"),
      supabase.from("fees").select("id, student_id, course_slug"),
      supabase.from("certificates").select("student_id, course_slug, status"),
    ])

    const installmentRows = instRes.data || []
    const byFee = new Map<string, string[]>()
    installmentRows.forEach((row) => {
      const arr = byFee.get(row.fee_id) || []
      arr.push(row.status)
      byFee.set(row.fee_id, arr)
    })

    const issuedKeys = new Set(
      (certRes.data || [])
        .filter((row) => row.student_id && row.course_slug && row.status === "Issued")
        .map((row) => `${row.student_id}:${row.course_slug}`)
    )

    const feeRows = feesRes.data || []
    const eligibleFeeRows = feeRows.filter((fee) => {
      const statuses = byFee.get(fee.id)
      const key = fee.student_id && fee.course_slug ? `${fee.student_id}:${fee.course_slug}` : null
      return !!fee.course_slug && !!statuses && statuses.length > 0 && statuses.every((status) => status === "Paid") && (!key || !issuedKeys.has(key))
    })

    const studentsData = studentsRes.data || []
    if (studentsData.length === 0 || eligibleFeeRows.length === 0) {
      setStudents([])
      return
    }

    const courseSlugs = [...new Set(eligibleFeeRows.map((fee) => fee.course_slug).filter(Boolean))] as string[]
    let coursesMap: Record<string, string> = {}

    if (courseSlugs.length > 0) {
      const { data: coursesData } = await supabase
        .from("courses")
        .select("slug, name")
        .in("slug", courseSlugs)
      if (coursesData) {
        coursesMap = Object.fromEntries(coursesData.map((c) => [c.slug, c.name]))
      }
    }

    const options: StudentOption[] = []
    const byStudent = new Map<string, StudentOption[]>()

    eligibleFeeRows.forEach((fee) => {
      const student = studentsData.find((item) => item.id === fee.student_id)
      if (!student || !fee.course_slug) return

      const option: StudentOption = {
        id: `${student.id}:${fee.course_slug}`,
        full_name: student.full_name,
        course_slug: fee.course_slug,
        courseName: coursesMap[fee.course_slug] ?? fee.course_slug,
      }

      const existing = byStudent.get(student.id) || []
      existing.push(option)
      byStudent.set(student.id, existing)
    })

    byStudent.forEach((items) => {
      items.forEach((option) => options.push(option))
    })

    setStudents(options)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchCertificates()
  }, [])

  useEffect(() => {
    if (issueOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load student list when dialog opens
      fetchStudents()
    }
  }, [issueOpen])

  async function handleIssueCertificate() {
    if (!selectedStudent) {
      toast("Please select a student", { variant: "destructive" })
      return
    }

    setIssuing(true)

    const student = students.find((s) => s.id === selectedStudent)
    if (!student) {
      toast("Student not found", { variant: "destructive" })
      setIssuing(false)
      return
    }

    // A credential id is the number a graduate quotes to verify a certificate,
    // so it has to be distinguishable. The old `Math.random() * 9999` gave
    // roughly one collision per hundred certificates and nothing detected it —
    // `certificates.credential_id` has no unique index, so two students could
    // be handed the same official-looking reference with no error anywhere.
    // The random tail plus the date makes that vanishingly unlikely, and the
    // insert is retried on the vanishingly-unlikely case below.
    const issuedDate = localDate()
    const credentialId = `TNGC-${issuedDate.slice(0, 4)}-${mintId("").replace(/-/g, "").slice(0, 6).toUpperCase()}`
    const certId = mintId("CERT")

    const { data: existingCert, error: existingError } = await supabase
      .from("certificates")
      .select("id, status")
      .eq("student_id", student.id.split(":")[0])
      .eq("course_slug", student.course_slug)
      .limit(1)
      .maybeSingle()

    if (existingError && existingError.code !== "PGRST116") {
      setIssuing(false)
      toast("Failed to verify certificate status: " + existingError.message, { variant: "destructive" })
      return
    }

    let error

    if (existingCert) {
      ;({ error } = await supabase
        .from("certificates")
        .update({
          student_name: student.full_name,
          name: `${student.courseName} ${certType} Certificate`,
          type: certType as "Completion" | "Proficiency" | "Module",
          credential_id: credentialId,
          issued_date: issuedDate,
          issued_by: "admin",
          status: "Issued",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCert.id))
    } else {
      ;({ error } = await supabase.from("certificates").insert({
        id: certId,
        student_id: student.id.split(":")[0],
        student_name: student.full_name,
        course_slug: student.course_slug,
        name: `${student.courseName} ${certType} Certificate`,
        type: certType as "Completion" | "Proficiency" | "Module",
        credential_id: credentialId,
        issued_date: issuedDate,
        issued_by: "admin",
        status: "Issued",
      }))
    }

    setIssuing(false)

    if (error) {
      toast("Failed to issue certificate: " + error.message, { variant: "destructive" })
      return
    }

    toast("Certificate issued successfully", { variant: "success" })
    setSelectedStudent("")
    setCertType("Completion")
    setIssueOpen(false)
    fetchCertificates()
  }

  const stats = [
    { label: "Issued", value: certificates.filter((c) => c.status === "Issued").length, color: "text-emerald-600" },
    { label: "Pending", value: certificates.filter((c) => c.status === "Pending").length, color: "text-amber-600" },
    { label: "Rejected", value: certificates.filter((c) => c.status === "Rejected").length, color: "text-red-600" },
    { label: "Total", value: certificates.length, color: "text-foreground" },
  ]

  const filtered = certificates.filter(
    (c) =>
      c.studentName.toLowerCase().includes(search.toLowerCase()) ||
      c.course.toLowerCase().includes(search.toLowerCase()) ||
      c.credentialId.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-xs text-muted-foreground">Issue and manage student certificates</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setIssueOpen(true)}>
          <Send className="h-4 w-4" />
          Issue Certificate
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-sm font-bold shrink-0", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Certificates</CardTitle>
              <CardDescription>{filtered.length} certificates found</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Course</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Credential ID</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Award className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No certificates found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((cert) => {
                const cfg = statusConfig[cert.status] || statusConfig.Pending
                const Icon = cfg.icon
                return (
                  <TableRow key={cert.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {cert.studentName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{cert.studentName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono md:hidden">{cert.studentId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{cert.course}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{cert.type}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">{cert.credentialId}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{cert.issuedDate}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[10px] gap-1", cfg.className)}>
                        <Icon className="size-2.5" />
                        {cert.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-5" />
              Issue Certificate
            </DialogTitle>
            <DialogDescription>
              Only students who have completed all their installments can receive a certificate
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Student *</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setStudentPickerOpen(true)}
              >
                <span className="truncate">
                  {selectedStudent
                    ? students.find((s) => s.id === selectedStudent)?.full_name + " — " + (students.find((s) => s.id === selectedStudent)?.courseName ?? "")
                    : "Choose a student"}
                </span>
                <span className="text-xs text-muted-foreground">Select</span>
              </Button>
              {students.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No students have completed all their installments yet.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Certificate Type *</Label>
              <Select value={certType} onValueChange={(v) => setCertType(v ?? "Completion")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Completion">Completion</SelectItem>
                  <SelectItem value="Proficiency">Proficiency</SelectItem>
                  <SelectItem value="Module">Module</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleIssueCertificate} disabled={issuing || !selectedStudent}>
              {issuing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Award className="size-4" />
                  Issue Certificate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
        <SheetContent side="left" className="w-full max-w-md border-r bg-background px-0 pb-0 pt-0 text-foreground sm:max-w-md">
          <SheetHeader className="border-b bg-background px-4 pb-3 pt-4">
            <SheetTitle>Select Student & Course</SheetTitle>
            <SheetDescription>Search and choose a completed course certificate to issue.</SheetDescription>
          </SheetHeader>

          <div className="flex h-full flex-col px-4 pb-4 pt-3">
            <div className="sticky top-0 z-10 bg-background pb-3">
              <Input
                placeholder="Search students or courses..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(148,163,184,0.65)_transparent] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
              {students
                .filter((student) => {
                  const query = studentSearch.trim().toLowerCase()
                  if (!query) return true
                  return (
                    student.full_name.toLowerCase().includes(query) ||
                    student.courseName.toLowerCase().includes(query)
                  )
                })
                .map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-accent/60",
                      selectedStudent === student.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => {
                      setSelectedStudent(student.id)
                      setStudentPickerOpen(false)
                      setStudentSearch("")
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{student.courseName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">Select</span>
                  </button>
                ))}

              {students.filter((student) => {
                const query = studentSearch.trim().toLowerCase()
                if (!query) return true
                return (
                  student.full_name.toLowerCase().includes(query) ||
                  student.courseName.toLowerCase().includes(query)
                )
              }).length === 0 && (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No matching student or course found.
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="border-t px-4 py-3">
            <Button variant="outline" className="w-full" onClick={() => setStudentPickerOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
