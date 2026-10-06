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
import { Search, Award, CheckCircle2, Clock, Send, Loader2, Eye, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { mintId } from "@/lib/mint-id"
import { localDate } from "@/lib/local-date"
import {
  CERTIFICATE_HEADING,
  createCertificateHtml,
  getCertificateCourseName,
  printCertificate,
  type PrintableCertificate,
} from "@/lib/certificate-print"

const DIVISION_OPTIONS = ["First", "Second", "Third"] as const
const CUSTOM_DIVISION_OPTION = "__custom_division__"
const EMPTY_CERTIFICATE_DETAILS: CertificateIssueDetails = {
  issuedDate: localDate(),
  courseStartDate: "",
  courseEndDate: "",
  division: "",
}

interface Certificate {
  id: string
  studentName: string
  studentId: string
  course: string
  type: string
  issuedDate: string
  credentialId: string
  status: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
  printable: PrintableCertificate
}

interface StudentOption {
  id: string
  full_name: string
  guardianName: string
  course_slug: string | null
  courseName: string
  certificateTitles: string[]
}

interface CertificateIssueDetails {
  issuedDate: string
  courseStartDate: string
  courseEndDate: string
  division: string
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
  const [previewCertificate, setPreviewCertificate] = useState<PrintableCertificate | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")
  const [issueOpen, setIssueOpen] = useState(false)
  const [studentPickerOpen, setStudentPickerOpen] = useState(false)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState("")
  const [selectedCertificateTitles, setSelectedCertificateTitles] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState("")
  const [certType, setCertType] = useState("Completion")
  const [detailsByTitle, setDetailsByTitle] = useState<Record<string, CertificateIssueDetails>>({})
  const [customDivision, setCustomDivision] = useState("")
  const [customDivisionTitle, setCustomDivisionTitle] = useState("")
  const [divisionDialogOpen, setDivisionDialogOpen] = useState(false)
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

    const mapped: Certificate[] = (data || []).map((row) => {
      const course = row.course_slug ? (courseMap.get(row.course_slug) ?? row.course_slug) : "—"
      const certificateCourse = getCertificateCourseName(row.name, course)
      return {
        id: row.id,
        studentName: row.student_name,
        studentId: row.student_id,
        course: certificateCourse,
        type: row.type,
        issuedDate: row.issued_date || "—",
        credentialId: row.credential_id || "—",
        status: row.status,
        printable: {
          studentName: row.student_name,
          guardianName: row.guardian_name || "",
          displayTitle: CERTIFICATE_HEADING,
          course: certificateCourse,
          type: row.type,
          name: row.name,
          credentialId: row.credential_id || "—",
          issuedDate: row.issued_date || "—",
          courseStartDate: row.course_start_date || "",
          courseEndDate: row.course_end_date || "",
          division: row.division || "",
          issuedBy: row.issued_by || "TNGC Computers",
        },
      }
    })

    setCertificates(mapped)
    setLoading(false)
  }

  async function fetchStudents() {
    const [studentsRes, instRes, feesRes, certRes] = await Promise.all([
      supabase.from("students").select("id, full_name, father_name").order("full_name"),
      supabase.from("fee_installments").select("fee_id, status"),
      supabase.from("fees").select("id, student_id, course_slug"),
      supabase.from("certificates").select("student_id, course_slug, status, name"),
    ])

    const installmentRows = instRes.data || []
    const byFee = new Map<string, string[]>()
    installmentRows.forEach((row) => {
      const arr = byFee.get(row.fee_id) || []
      arr.push(row.status)
      byFee.set(row.fee_id, arr)
    })

    const issuedTitlesByCourse = new Map<string, Set<string>>()
    ;(certRes.data || []).forEach((row) => {
      if (!row.student_id || !row.course_slug || row.status !== "Issued" || !row.name) return
      const key = `${row.student_id}:${row.course_slug}`
      const titles = issuedTitlesByCourse.get(key) ?? new Set<string>()
      titles.add(row.name)
      issuedTitlesByCourse.set(key, titles)
    })

    const feeRows = feesRes.data || []
    const eligibleFeeRows = feeRows.filter((fee) => {
      const statuses = byFee.get(fee.id)
      return !!fee.course_slug && !!statuses && statuses.length > 0 && statuses.every((status) => status === "Paid")
    })

    const studentsData = studentsRes.data || []
    if (studentsData.length === 0 || eligibleFeeRows.length === 0) {
      setStudents([])
      return
    }

    const courseSlugs = [...new Set(eligibleFeeRows.map((fee) => fee.course_slug).filter(Boolean))] as string[]
    let coursesMap: Record<string, { name: string; certificateTitles: string[] }> = {}

    if (courseSlugs.length > 0) {
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("slug, name, certification, certifications")
        .in("slug", courseSlugs)
      if (coursesError) {
        console.error("Error fetching course certificate titles:", coursesError)
        toast("Unable to load course certificate titles: " + coursesError.message, { variant: "destructive" })
        setStudents([])
        return
      }
      if (coursesData) {
        coursesMap = Object.fromEntries(coursesData.map((course) => [
          course.slug,
          {
            name: course.name,
            certificateTitles: Array.isArray(course.certifications) && course.certifications.length > 0
              ? course.certifications
              : [course.certification && !/^course completion certificate$/i.test(course.certification)
                  ? course.certification
                  : course.name],
          },
        ]))
      }
    }

    const options: StudentOption[] = []
    const byStudentAndCourse = new Map<string, StudentOption>()

    eligibleFeeRows.forEach((fee) => {
      const student = studentsData.find((item) => item.id === fee.student_id)
      if (!student || !fee.course_slug) return
      const course = coursesMap[fee.course_slug]
      if (!course) return
      const key = `${student.id}:${fee.course_slug}`
      const issuedTitles = issuedTitlesByCourse.get(key) ?? new Set<string>()
      const certificateTitles = course.certificateTitles.filter((title) => !issuedTitles.has(title))
      if (certificateTitles.length === 0) return

      const option: StudentOption = {
        id: key,
        full_name: student.full_name,
        guardianName: student.father_name ?? "",
        course_slug: fee.course_slug,
        courseName: course.name,
        certificateTitles,
      }

      byStudentAndCourse.set(key, option)
    })
    options.push(...byStudentAndCourse.values())

    setStudents(options)
    const requestedStudentId = new URLSearchParams(window.location.search).get("studentId")
    const requestedStudent = requestedStudentId
      ? options.find((option) => option.id.startsWith(`${requestedStudentId}:`))
      : undefined
    if (requestedStudent) {
      setSelectedStudent(requestedStudent.id)
      setSelectedCertificateTitles(requestedStudent.certificateTitles)
      setDetailsByTitle({})
    }
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

  useEffect(() => {
    const requestedStudentId = new URLSearchParams(window.location.search).get("studentId")
    if (requestedStudentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open the issue sheet for a linked student
      setIssueOpen(true)
    }
  }, [])

  async function handleIssueCertificate() {
    if (!selectedStudent) {
      toast("Please select a student", { variant: "destructive" })
      return
    }

    const validDate = (value: string) => {
      const parsed = new Date(`${value}T00:00:00.000Z`)
      return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    }
    if (selectedCertificateTitles.length === 0) {
      toast("Please select at least one certificate title.", { variant: "destructive" })
      return
    }

    const student = students.find((s) => s.id === selectedStudent)
    if (!student) {
      toast("Student not found", { variant: "destructive" })
      return
    }

    const titlesToIssue = selectedCertificateTitles.filter((title) => student.certificateTitles.includes(title))
    if (titlesToIssue.length === 0) {
      toast("No unissued certificate titles are selected. Please choose the student again.", { variant: "destructive" })
      return
    }

    for (const title of titlesToIssue) {
      const details = detailsByTitle[title] ?? EMPTY_CERTIFICATE_DETAILS
      if (!validDate(details.issuedDate)) {
        toast(`Enter a valid issue date for "${title}".`, { variant: "destructive" })
        return
      }
      if (!validDate(details.courseStartDate) || !validDate(details.courseEndDate)) {
        toast(`Enter valid course start and end dates for "${title}".`, { variant: "destructive" })
        return
      }
      if (details.courseEndDate < details.courseStartDate) {
        toast(`The course end date cannot be before its start date for "${title}".`, { variant: "destructive" })
        return
      }
      if (!details.division.trim()) {
        toast(`Please enter the certificate division for "${title}".`, { variant: "destructive" })
        return
      }
    }

    setIssuing(true)
    let issuedCount = 0
    let failure: { title: string; message: string } | null = null
    let activeTitle = titlesToIssue[0]

    try {
      const { data: existingCredentials, error: credentialsError } = await supabase
        .from("certificates")
        .select("credential_id")

      if (credentialsError) {
        throw new Error(`Unable to determine the next certificate number: ${credentialsError.message}`)
      }

      let certificateSerial = (existingCredentials ?? []).reduce((highest, certificate) => {
        const match = /^TNGC\/(\d+)\/N$/i.exec(certificate.credential_id ?? "")
        return match ? Math.max(highest, Number(match[1])) : highest
      }, 1000)

      for (const title of titlesToIssue) {
        activeTitle = title
        const { data: existingCert, error: existingError } = await supabase
          .from("certificates")
          .select("id, status")
          .eq("student_id", student.id.split(":")[0])
          .eq("course_slug", student.course_slug)
          .eq("name", title)
          .limit(1)
          .maybeSingle()

        if (existingError && existingError.code !== "PGRST116") {
          failure = { title, message: existingError.message }
          break
        }

        if (existingCert?.status === "Issued") continue

        const details = detailsByTitle[title] ?? EMPTY_CERTIFICATE_DETAILS
        certificateSerial += 1
        const credentialId = `TNGC/${String(certificateSerial).padStart(4, "0")}/N`
        const certificateData = {
          student_name: student.full_name,
          name: title,
          type: certType as "Completion" | "Proficiency" | "Module",
          credential_id: credentialId,
          issued_date: details.issuedDate,
          guardian_name: student.guardianName || null,
          course_start_date: details.courseStartDate,
          course_end_date: details.courseEndDate,
          division: details.division.trim(),
          issued_by: "admin",
          status: "Issued" as const,
          updated_at: new Date().toISOString(),
        }

        const result = existingCert
          ? await supabase.from("certificates").update(certificateData).eq("id", existingCert.id)
          : await supabase.from("certificates").insert({
              id: mintId("CERT"),
              student_id: student.id.split(":")[0],
              course_slug: student.course_slug,
              ...certificateData,
            })

        if (result.error) {
          failure = { title, message: result.error.message }
          break
        }
        issuedCount += 1
      }
    } catch (error) {
      failure = {
        title: activeTitle,
        message: error instanceof Error ? error.message : "Unexpected error",
      }
    } finally {
      setIssuing(false)
    }

    if (failure) {
      toast(
        issuedCount > 0
          ? `Issued ${issuedCount} certificate${issuedCount === 1 ? "" : "s"}, but failed on "${failure.title}": ${failure.message}. Reopen the form to issue the remaining titles.`
          : `Failed to issue "${failure.title}": ${failure.message}`,
        { variant: "destructive" }
      )
      await Promise.all([fetchCertificates(), fetchStudents()])
      return
    }

    if (issuedCount === 0) {
      toast("The selected certificate titles have already been issued.", { variant: "destructive" })
      await fetchStudents()
      return
    }

    toast(`${issuedCount} certificate${issuedCount === 1 ? "" : "s"} issued successfully`, { variant: "success" })
    setSelectedStudent("")
    setSelectedCertificateTitles([])
    setCertType("Completion")
    setDetailsByTitle({})
    setCustomDivision("")
    setCustomDivisionTitle("")
    setIssueOpen(false)
    await fetchCertificates()
  }

  function handleDivisionChange(title: string, value: string | null) {
    if (value === "Others") {
      const division = detailsByTitle[title]?.division ?? ""
      setCustomDivision(DIVISION_OPTIONS.includes(division as typeof DIVISION_OPTIONS[number]) ? "" : division)
      setCustomDivisionTitle(title)
      setDivisionDialogOpen(true)
      return
    }
    if (value && value !== CUSTOM_DIVISION_OPTION) {
      setDetailsByTitle((current) => ({
        ...current,
        [title]: { ...EMPTY_CERTIFICATE_DETAILS, ...current[title], division: value },
      }))
    }
  }

  function saveCustomDivision() {
    const trimmed = customDivision.trim()
    if (!trimmed) return
    setDetailsByTitle((current) => ({
      ...current,
      [customDivisionTitle]: {
        ...EMPTY_CERTIFICATE_DETAILS,
        ...current[customDivisionTitle],
        division: trimmed,
      },
    }))
    setDivisionDialogOpen(false)
  }

  function handlePrintPreview() {
    if (previewCertificate && !printCertificate(previewCertificate)) {
      toast("Please allow pop-ups to print certificates", { variant: "destructive" })
    }
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

  const templateCertificate: PrintableCertificate = {
    studentName: "Student Name",
    guardianName: "Guardian Name",
    course: "Course Name",
    type: "Completion",
    name: CERTIFICATE_HEADING,
    credentialId: "TNGC/9207/N",
    issuedDate: localDate(),
    courseStartDate: "",
    courseEndDate: "",
    division: "",
    issuedBy: "TNGC Computers",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-xs text-muted-foreground">Issue and manage student certificates</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => {
            setPreviewCertificate(templateCertificate)
            setPreviewTitle("Certificate Template")
          }}>
            <Eye className="h-4 w-4" />
            View Template
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setIssueOpen(true)}>
            <Send className="h-4 w-4" />
            Issue Certificate
          </Button>
        </div>
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
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn("text-[10px] gap-1", cfg.className)}>
                          <Icon className="size-2.5" />
                          {cert.status}
                        </Badge>
                        {cert.status === "Issued" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2"
                            onClick={() => {
                              setPreviewCertificate(cert.printable)
                              setPreviewTitle(`${cert.studentName} certificate`)
                            }}
                          >
                            <Eye className="size-3.5" />
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!previewCertificate} onOpenChange={(open) => {
        if (!open) {
          setPreviewCertificate(null)
          setPreviewTitle("")
        }
      }}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] max-h-[90dvh] overflow-y-auto overscroll-contain p-3 sm:max-w-6xl sm:p-4">
          <DialogHeader>
            <DialogTitle>{previewTitle || "Certificate Preview"}</DialogTitle>
            <DialogDescription>
              {previewTitle === "Certificate Template"
                ? "Preview of the certificate design used when issuing certificates."
                : "Preview the issued certificate without the student photo."}
            </DialogDescription>
          </DialogHeader>
          {previewCertificate && (
            <iframe
              title={previewTitle || "Certificate preview"}
              srcDoc={createCertificateHtml(previewCertificate)}
              sandbox=""
              className="block aspect-[297/210] max-h-[65dvh] min-h-48 w-full rounded-lg border bg-white"
            />
          )}
          <DialogFooter>
            {previewCertificate && previewTitle !== "Certificate Template" && (
              <Button type="button" onClick={handlePrintPreview}>
                <Printer className="size-4" />
                Print certificate
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => {
              setPreviewCertificate(null)
              setPreviewTitle("")
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={issueOpen} onOpenChange={setIssueOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle className="flex items-center gap-2">
              <Award className="size-5" />
              Issue Certificate
            </SheetTitle>
            <SheetDescription>
              Only students who have completed all their installments can receive a certificate
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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
              <div className="flex items-center justify-between">
                <Label>Certificates to issue *</Label>
                {selectedStudent && (
                  <span className="text-xs text-muted-foreground">
                    {selectedCertificateTitles.length} selected
                  </span>
                )}
              </div>
              <div className="space-y-2 rounded-md border p-3">
                {(students.find((student) => student.id === selectedStudent)?.certificateTitles ?? []).length > 0 ? (
                  (students.find((student) => student.id === selectedStudent)?.certificateTitles ?? []).map((title) => (
                    <label key={title} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selectedCertificateTitles.includes(title)}
                        onChange={(event) => setSelectedCertificateTitles((current) =>
                          event.target.checked
                            ? [...current, title]
                            : current.filter((item) => item !== title)
                        )}
                      />
                      <span>{title}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent ? "All configured certificates have already been issued." : "Choose a student to view available certificates."}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">All remaining titles are selected by default. Uncheck any you do not want to issue now.</p>
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

            <div className="space-y-3">
              <div>
                <Label>Details for each certificate *</Label>
                <p className="text-xs text-muted-foreground">
                  Set the issue date, course dates, and division separately for each selected certificate. Type applies to all.
                </p>
              </div>
              {selectedCertificateTitles.map((title, index) => {
                const details = detailsByTitle[title] ?? EMPTY_CERTIFICATE_DETAILS
                const issueId = `certificateIssueDate-${index}`
                const startId = `certificateCourseStartDate-${index}`
                const endId = `certificateCourseEndDate-${index}`
                const divisionId = `certificateDivision-${index}`
                const isStandardDivision = DIVISION_OPTIONS.includes(details.division as typeof DIVISION_OPTIONS[number])

                return (
                  <div key={title} className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-medium break-words">{title}</p>
                    <div className="space-y-1.5">
                      <Label htmlFor={issueId}>Certificate Issue Date *</Label>
                      <Input
                        id={issueId}
                        type="date"
                        value={details.issuedDate}
                        onChange={(event) => setDetailsByTitle((current) => ({
                          ...current,
                          [title]: {
                            ...EMPTY_CERTIFICATE_DETAILS,
                            ...current[title],
                            issuedDate: event.target.value,
                          },
                        }))}
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={startId}>Course Start Date *</Label>
                        <Input
                          id={startId}
                          type="date"
                          value={details.courseStartDate}
                          onChange={(event) => setDetailsByTitle((current) => ({
                            ...current,
                            [title]: {
                              ...EMPTY_CERTIFICATE_DETAILS,
                              ...current[title],
                              courseStartDate: event.target.value,
                            },
                          }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={endId}>Course End Date *</Label>
                        <Input
                          id={endId}
                          type="date"
                          value={details.courseEndDate}
                          onChange={(event) => setDetailsByTitle((current) => ({
                            ...current,
                            [title]: {
                              ...EMPTY_CERTIFICATE_DETAILS,
                              ...current[title],
                              courseEndDate: event.target.value,
                            },
                          }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={divisionId}>Division *</Label>
                      <Select
                        value={isStandardDivision ? details.division : details.division ? CUSTOM_DIVISION_OPTION : ""}
                        onValueChange={(value) => handleDivisionChange(title, value)}
                      >
                        <SelectTrigger id={divisionId}>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIVISION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                          {!isStandardDivision && details.division && (
                            <SelectItem value={CUSTOM_DIVISION_OPTION}>{details.division}</SelectItem>
                          )}
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleIssueCertificate} disabled={issuing || !selectedStudent || selectedCertificateTitles.length === 0}>
              {issuing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Award className="size-4" />
                  Issue {selectedCertificateTitles.length || ""} Certificate{selectedCertificateTitles.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={divisionDialogOpen} onOpenChange={setDivisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter certificate division</DialogTitle>
            <DialogDescription>
              Enter the division to appear on “{customDivisionTitle}”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="customCertificateDivision">Division</Label>
            <Input
              id="customCertificateDivision"
              autoFocus
              value={customDivision}
              onChange={(event) => setCustomDivision(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  saveCustomDivision()
                }
              }}
              maxLength={80}
              placeholder="Enter division"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDivisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCustomDivision} disabled={!customDivision.trim()}>
              Save division
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
        <SheetContent side="left" className="w-full max-w-md gap-0 overflow-hidden border-r bg-background px-0 pb-0 pt-0 text-foreground sm:max-w-md">
          <SheetHeader className="shrink-0 border-b bg-background px-4 pb-3 pt-4">
            <SheetTitle>Select Student & Course</SheetTitle>
            <SheetDescription>Search and choose a completed course certificate to issue.</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
            <div className="z-10 shrink-0 bg-background pb-3">
              <Input
                placeholder="Search students or courses..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>

            <div className="h-0 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-2 scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 dark:[scrollbar-color:rgb(71_85_105)_rgb(30_41_59)] dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 dark:[&::-webkit-scrollbar-track]:bg-slate-800">
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
                      setSelectedCertificateTitles(student.certificateTitles)
                      setDetailsByTitle({})
                      setStudentPickerOpen(false)
                      setStudentSearch("")
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{student.courseName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {student.certificateTitles.length} certificate{student.certificateTitles.length === 1 ? "" : "s"}
                    </span>
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

          <SheetFooter className="mt-0 shrink-0 border-t px-4 py-3">
            <Button variant="outline" className="w-full" onClick={() => setStudentPickerOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
