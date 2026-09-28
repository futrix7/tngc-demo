"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Award, Download, CheckCircle2, Clock, Eye, Send, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"
import { QueryError } from "@/components/student/data-state"

interface Certificate {
  id: string
  name: string
  course: string
  issuedDate: string
  credentialId: string
  status: "Issued" | "Processing" | "Requested"
  issueBy: string
  type: "Completion" | "Proficiency" | "Module"
}

interface EligibleCourse {
  slug: string
  name: string
}

const statusConfig: Record<string, { className: string; icon: React.ElementType }> = {
  Issued: { className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  Processing: { className: "bg-blue-500/15 text-blue-600", icon: Clock },
  Requested: { className: "bg-amber-500/15 text-amber-600", icon: Clock },
}

export default function StudentCertificates() {
  const { toast } = useToast()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState("")
  const [eligibleCourses, setEligibleCourses] = useState<EligibleCourse[]>([])
  const [tab, setTab] = useState("all")
  const [reqOpen, setReqOpen] = useState(false)
  const [reqCourseSlug, setReqCourseSlug] = useState("")
  const [reqType, setReqType] = useState("Completion")
  const [reqNotes, setReqNotes] = useState("")
  const [viewCert, setViewCert] = useState<Certificate | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  async function fetchCertificates() {
    try {
      setLoadError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadError("No signed-in user was found")
        setLoading(false)
        return
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("user_id", user.id)
        .single()

      if (studentError || !student) {
        console.error("[certificates] student lookup failed:", studentError?.message)
        setLoadError(studentError?.message ?? "No student record is linked to this account")
        setLoading(false)
        return
      }

      setStudentName(student.full_name)

      const { data: feeRows, error: feeError } = await supabase
        .from("fees")
        .select("id, course_slug, pending_amount")
        .eq("student_id", student.id)

      const { data: existingCerts, error: certLookupError } = await supabase
        .from("certificates")
        .select("course_slug, status")
        .eq("student_id", student.id)

      if (certLookupError) {
        console.error("[certificates] existing certificate lookup failed:", certLookupError.message)
      }

      const usedCourseSlugs = new Set(
        (existingCerts || [])
          .filter((course) => course.course_slug && ["Issued", "Requested", "Processing", "Pending"].includes(course.status))
          .map((course) => course.course_slug)
      )

      if (feeError) {
        console.error("[certificates] fee eligibility lookup failed:", feeError.message)
        setEligibleCourses([])
      } else if (feeRows && feeRows.length > 0) {
        const courseSlugs = [...new Set(feeRows.map((fee) => fee.course_slug).filter((slug): slug is string => Boolean(slug)))]
        const [schedulesResult, coursesResult] = await Promise.all([
          supabase
            .from("fee_installments")
            .select("fee_id, status")
            .in("fee_id", feeRows.map((fee) => fee.id)),
          courseSlugs.length
            ? supabase.from("courses").select("slug, name").in("slug", courseSlugs)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (schedulesResult.error || coursesResult.error) {
          console.error(
            "[certificates] course eligibility lookup failed:",
            schedulesResult.error?.message ?? coursesResult.error?.message
          )
          setEligibleCourses([])
        } else {
          const courseNames = new Map((coursesResult.data ?? []).map((course) => [course.slug, course.name]))
          const eligible = feeRows
            .filter((fee) => {
              if (!fee.course_slug || Number(fee.pending_amount) > 0 || usedCourseSlugs.has(fee.course_slug)) return false
              const courseInstallments = (schedulesResult.data ?? []).filter((item) => item.fee_id === fee.id)
              return courseInstallments.length > 0 && courseInstallments.every((item) => item.status === "Paid")
            })
            .map((fee) => ({
              slug: fee.course_slug as string,
              name: courseNames.get(fee.course_slug as string) ?? fee.course_slug as string,
            }))
          setEligibleCourses(eligible)
          setReqCourseSlug((current) => eligible.some((course) => course.slug === current) ? current : "")
        }
      } else {
        setEligibleCourses([])
      }

      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[certificates] lookup failed:", error.message)
        setLoadError(error.message)
        setLoading(false)
        return
      }

      {
        const slugs = [...new Set((data || []).map((c) => c.course_slug).filter(Boolean))] as string[]
        const { data: courses } = slugs.length
          ? await supabase.from("courses").select("slug, name").in("slug", slugs)
          : { data: null }
        const courseMap = new Map((courses ?? []).map((c) => [c.slug, c.name]))

        setCertificates(
          (data || []).map((c) => ({
            id: c.id,
            name: c.name,
            course: (c.course_slug && courseMap.get(c.course_slug)) || c.course_slug || "Course",
            issuedDate: c.issued_date || "—",
            credentialId: c.credential_id || "—",
            status: c.status as Certificate["status"],
            issueBy: c.issued_by || "TNGC Computers",
            type: c.type,
          }))
        )
      }
    } catch (err) {
      console.error("[certificates] fetch crashed:", err)
      setLoadError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchCertificates()
  }, [attempt])

  const filtered = tab === "all" ? certificates : certificates.filter((c) => {
    if (tab === "issued") return c.status === "Issued"
    return c.status !== "Issued"
  })

  const issued = certificates.filter((c) => c.status === "Issued").length

  const handleDownload = (cert: Certificate) => {
    const studentDisplay = studentName || "Student"

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${cert.name}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 40px; color: #1a202c; }
  .cert { max-width: 800px; margin: 0 auto; border: 4px double #16a34a; padding: 48px; text-align: center; }
  .brand { font-size: 28px; font-weight: 700; color: #16a34a; letter-spacing: 2px; }
  .sub { font-size: 12px; letter-spacing: 3px; color: #718096; text-transform: uppercase; margin-top: 4px; }
  .line { border-top: 2px solid #16a34a; margin: 20px auto; width: 120px; }
  .intro { font-size: 13px; color: #718096; text-transform: uppercase; letter-spacing: 2px; }
  .name { font-size: 34px; font-weight: 700; margin: 8px 0 16px; border-bottom: 2px solid #e2e8f0; display: inline-block; padding: 0 24px 8px; }
  .body { font-size: 15px; color: #4a5568; }
  .course { font-size: 20px; font-weight: 700; color: #16a34a; margin: 6px 0; }
  .meta { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; color: #718096; text-align: center; gap: 20px; }
  .meta div { flex: 1; }
  .meta strong { display: block; color: #1a202c; font-size: 14px; margin-top: 6px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="cert">
    <div class="brand">TNGC Computers</div>
    <div class="sub">Certificate of ${cert.type}</div>
    <hr class="line" />
    <p class="intro">This is to certify that</p>
    <p class="name">${studentDisplay}</p>
    <p class="body">has successfully completed the course</p>
    <p class="course">${cert.course}</p>
    <p class="body">with satisfactory performance and has been awarded this certificate.</p>
    <div class="meta">
      <div>Credential ID<strong>${cert.credentialId}</strong></div>
      <div>Date Issued<strong>${cert.issuedDate}</strong></div>
      <div>Issued By<strong>${cert.issueBy}</strong></div>
    </div>
  </div>
  <script>window.onload = function () { window.print(); }</script>
</body>
</html>`

    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) {
      toast("Please allow pop-ups to download certificates", { variant: "destructive" })
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  const handleRequest = async () => {
    const eligibleCourse = eligibleCourses.find((course) => course.slug === reqCourseSlug)
    if (!eligibleCourse) {
      toast("Choose a course with all installments paid.", { variant: "warning" })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast("Please log in", { variant: "destructive" })
      return
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("user_id", user.id)
      .single()

    if (!student) {
      toast("Student profile not found", { variant: "destructive" })
      return
    }

    const { data: existingCertificate, error: existingError } = await supabase
      .from("certificates")
      .select("id")
      .eq("student_id", student.id)
      .eq("course_slug", eligibleCourse.slug)
      .in("status", ["Issued", "Requested", "Processing", "Pending"])
      .limit(1)
      .maybeSingle()

    if (existingError && existingError.code !== "PGRST116") {
      toast("Failed to validate existing certificates: " + existingError.message, { variant: "destructive" })
      return
    }

    if (existingCertificate) {
      toast("You already have a certificate request or certificate for this course.", { variant: "warning" })
      return
    }

    const certId = `CERT-${Date.now()}`
    const { error } = await supabase.from("certificates").insert({
      id: certId,
      student_id: student.id,
      student_name: student.full_name,
      course_slug: eligibleCourse.slug,
      name: `${eligibleCourse.name} ${reqType} Certificate`,
      type: reqType,
      status: "Requested",
    })

    if (error) {
      toast("Failed to submit request: " + error.message, { variant: "destructive" })
      return
    }

    toast(`${reqType} certificate requested for ${eligibleCourse.name}`, { variant: "success" })
    setReqOpen(false)
    setReqCourseSlug("")
    setReqType("Completion")
    setReqNotes("")
    fetchCertificates()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 lg:p-8">
        <Link href="/student/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          Back to Profile
        </Link>
        <QueryError
          what="your certificates"
          detail={loadError}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <Link href="/student/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back to Profile
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Certificates</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{issued} certificates issued</p>
        </div>
        {eligibleCourses.length > 0 ? (
          <Dialog open={reqOpen} onOpenChange={setReqOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1" />}>
              <Send className="size-3" />
              Request
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] max-h-[85dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Request a Certificate</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="certificate-course">Completed Course</Label>
                  <select
                    id="certificate-course"
                    value={reqCourseSlug}
                    onChange={(event) => setReqCourseSlug(event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose a completed course</option>
                    {eligibleCourses.map((course) => (
                      <option key={course.slug} value={course.slug}>{course.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Certificate Type</Label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option>Completion</option>
                    <option>Proficiency</option>
                    <option>Module</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="req-notes">Reason / Notes</Label>
                  <textarea
                    id="req-notes"
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    rows={3}
                    placeholder="Why do you need this certificate?"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                <Button className="w-full" onClick={handleRequest} disabled={!reqCourseSlug}>
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <p className="text-xs text-muted-foreground sm:max-w-56 sm:text-right">
            Complete a course&rsquo;s installments to request its certificate.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold">{certificates.length}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">{issued}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Issued</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{certificates.length - issued}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start gap-1 h-9">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Certificate Cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No certificates found.
            </CardContent>
          </Card>
        )}
        {filtered.map((cert) => {
          const cfg = statusConfig[cert.status]
          const Icon = cfg.icon
          return (
            <Card key={cert.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Award className="size-4 sm:size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs sm:text-sm font-medium truncate">{cert.name}</p>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 gap-1 ${cfg.className}`}>
                        <Icon className="size-2.5" />
                        {cert.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">{cert.course} &middot; {cert.issueBy}</p>
                    {cert.status === "Issued" && (
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {cert.credentialId} &middot; {cert.issuedDate}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {cert.status === "Issued" && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setViewCert(cert)}>
                        <Eye className="size-3" />
                        <span className="hidden sm:inline">View</span>
                      </Button>
                    )}
                    {cert.status === "Issued" && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownload(cert)}>
                        <Download className="size-3" />
                        <span className="hidden sm:inline">Download</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Certificate Preview Dialog */}
      <Dialog open={!!viewCert} onOpenChange={(open) => !open && setViewCert(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewCert && (
            <>
              <DialogHeader>
                <DialogTitle>Certificate Preview</DialogTitle>
              </DialogHeader>
              <div className="rounded-xl border-2 border-primary/30 bg-linear-to-b from-primary/5 to-white p-6 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold tracking-wider text-primary">TNGC</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Teja Nagendra Government College</p>
                </div>
                <div className="text-center space-y-2 py-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">This is to certify that</p>
                  <p className="text-lg font-bold">{studentName}</p>
                  <p className="text-xs text-muted-foreground">has successfully completed</p>
                  <p className="text-sm font-semibold">{viewCert.course}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-muted-foreground text-[10px]">Credential ID</p>
                    <p className="font-mono font-semibold">{viewCert.credentialId}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-muted-foreground text-[10px]">Date Issued</p>
                    <p className="font-semibold">{viewCert.issuedDate}</p>
                  </div>
                </div>
              </div>
              <Button className="w-full gap-1 mt-2" onClick={() => handleDownload(viewCert)}>
                <Download className="size-3" />
                Download Certificate
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
