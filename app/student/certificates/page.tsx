"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Award, Printer, CheckCircle2, Clock, Eye, Send, Loader2, XCircle, Hourglass } from "lucide-react"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"
import {
  CERTIFICATE_HEADING,
  createCertificateHtml,
  getCertificateCourseName,
  printCertificate,
} from "@/lib/certificate-print"
import { mintId } from "@/lib/mint-id"
import { QueryError } from "@/components/student/data-state"

/** Every value the `certificate_status` enum can hold. */
type CertificateStatus = "Issued" | "Processing" | "Requested" | "Pending" | "Rejected"

interface Certificate {
  id: string
  name: string
  course: string
  issuedDate: string
  credentialId: string
  guardianName: string
  courseStartDate: string
  courseEndDate: string
  division: string
  status: CertificateStatus
  issuedBy: string
  type: "Completion" | "Proficiency" | "Module"
}

interface EligibleCourse {
  slug: string
  name: string
}

/**
 * Keyed by the full `certificate_status` enum. An earlier version listed only
 * three of the five, so a `Pending` or `Rejected` certificate made `cfg` undefined
 * and threw while rendering the card — which blanked the whole page. Unknown
 * values from a future enum still fall back instead of crashing.
 */
const statusConfig: Record<string, { className: string; icon: React.ElementType }> = {
  Issued: { className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  Processing: { className: "bg-blue-500/15 text-blue-600", icon: Clock },
  Requested: { className: "bg-amber-500/15 text-amber-600", icon: Hourglass },
  Pending: { className: "bg-amber-500/15 text-amber-600", icon: Hourglass },
  Rejected: { className: "bg-red-500/15 text-red-600", icon: XCircle },
}

const FALLBACK_STATUS = { className: "bg-muted text-muted-foreground", icon: Hourglass }

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
            guardianName: c.guardian_name || "",
            courseStartDate: c.course_start_date || "",
            courseEndDate: c.course_end_date || "",
            division: c.division || "",
            status: c.status as Certificate["status"],
            issuedBy: c.issued_by || "TNGC Computers",
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
  const awaiting = certificates.filter((c) => c.status !== "Issued").length

  const handlePrint = (cert: Certificate) => {
    const opened = printCertificate({
      studentName,
      course: getCertificateCourseName(cert.name, cert.course),
      type: cert.type,
      name: cert.name,
      displayTitle: CERTIFICATE_HEADING,
      credentialId: cert.credentialId,
      issuedDate: cert.issuedDate,
      guardianName: cert.guardianName,
      courseStartDate: cert.courseStartDate,
      courseEndDate: cert.courseEndDate,
      division: cert.division,
      issuedBy: cert.issuedBy,
    })
    if (!opened) {
      toast("Please allow pop-ups to print certificates", { variant: "destructive" })
    }
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

    const { error } = await supabase.from("certificates").insert({
      id: mintId("CERT"),
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
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{awaiting}</p>
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
          const cfg = statusConfig[cert.status] ?? FALLBACK_STATUS
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
                      <p className="text-xs sm:text-sm font-medium truncate">{CERTIFICATE_HEADING}</p>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 gap-1 ${cfg.className}`}>
                        <Icon className="size-2.5" />
                        {cert.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">
                      {getCertificateCourseName(cert.name, cert.course)} · {cert.issuedBy}
                    </p>
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
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePrint(cert)}>
                        <Printer className="size-3" />
                        <span className="hidden sm:inline">Print</span>
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
        <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] max-h-[90dvh] overflow-y-auto overscroll-contain p-3 sm:max-w-5xl sm:p-4">
          {viewCert && (
            <>
              <DialogHeader>
                <DialogTitle>Certificate Preview</DialogTitle>
              </DialogHeader>
              <iframe
                title="Issued certificate preview"
                srcDoc={createCertificateHtml({
                  studentName,
                  guardianName: viewCert.guardianName,
                  course: getCertificateCourseName(viewCert.name, viewCert.course),
                  type: viewCert.type,
                  name: viewCert.name,
                  displayTitle: CERTIFICATE_HEADING,
                  credentialId: viewCert.credentialId,
                  issuedDate: viewCert.issuedDate,
                  courseStartDate: viewCert.courseStartDate,
                  courseEndDate: viewCert.courseEndDate,
                  division: viewCert.division,
                  issuedBy: viewCert.issuedBy,
                })}
                sandbox=""
                className="block aspect-[297/210] max-h-[65dvh] min-h-48 w-full rounded-lg border bg-white"
              />
              <Button className="w-full gap-1 mt-2" onClick={() => handlePrint(viewCert)}>
                <Printer className="size-3" />
                Print / Save as PDF
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
