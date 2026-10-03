"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Award, Printer, CheckCircle2, Clock, Eye, Loader2, XCircle, Hourglass } from "lucide-react"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"
import {
  CERTIFICATE_HEADING,
  createCertificateHtml,
  getCertificateCourseName,
  printCertificate,
} from "@/lib/certificate-print"
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
  const [tab, setTab] = useState("all")
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
        <p className="text-xs text-muted-foreground sm:max-w-56 sm:text-right">
          Certificates are issued by the administration.
        </p>
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
