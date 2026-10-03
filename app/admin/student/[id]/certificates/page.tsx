"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Award, Printer, Loader2, XCircle, AlertTriangle, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import {
  CERTIFICATE_HEADING,
  getCertificateCourseName,
  printCertificate,
} from "@/lib/certificate-print"
import { useToast } from "@/components/ui/sonner"
import { useStudent } from "../layout"

/** Every value the `certificate_status` enum can hold. */
type CertificateStatus = "Issued" | "Processing" | "Pending" | "Rejected" | "Requested"

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
  issuedBy: string
  type: string
  status: CertificateStatus
}

const statusClass: Record<CertificateStatus, string> = {
  Issued: "bg-emerald-500/15 text-emerald-600",
  Processing: "bg-blue-500/15 text-blue-600",
  Pending: "bg-amber-500/15 text-amber-600",
  Requested: "bg-amber-500/15 text-amber-600",
  Rejected: "bg-red-500/15 text-red-600",
}

export default function StudentCertificatesPage() {
  const student = useStudent()
  const { toast } = useToast()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      try {
        setLoadError(null)

        const { data: certRows, error } = await supabase
          .from("certificates")
          .select("id, name, course_slug, type, status, issued_date, credential_id, guardian_name, course_start_date, course_end_date, division, issued_by")
          .eq("student_id", student!.id)
          .order("created_at", { ascending: false })

        // `lib/supabase` is not parameterised with `Database`, so a bad column
        // name resolves to a silent success with no rows. Checking `.error` is
        // the only way to tell "no certificates" from "query was wrong".
        if (error) {
          console.error("[admin/student/certificates] lookup failed:", error.message)
          setLoadError(error.message)
          return
        }

        const rows = certRows ?? []
        const slugs = [...new Set(rows.map((row) => row.course_slug).filter(Boolean))] as string[]
        const { data: courseRows, error: courseError } = slugs.length
          ? await supabase.from("courses").select("slug, name").in("slug", slugs)
          : { data: [], error: null }

        if (courseError) {
          console.error("[admin/student/certificates] course lookup failed:", courseError.message)
        }
        const courseNames = new Map((courseRows ?? []).map((row) => [row.slug, row.name]))

        setCertificates(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            course: (row.course_slug && courseNames.get(row.course_slug)) || row.course_slug || "Course",
            issuedDate: row.issued_date || "—",
            credentialId: row.credential_id || "—",
            guardianName: row.guardian_name || "",
            courseStartDate: row.course_start_date || "",
            courseEndDate: row.course_end_date || "",
            division: row.division || "",
            issuedBy: row.issued_by || "TNGC Computers",
            type: row.type || "Completion",
            status: row.status as CertificateStatus,
          }))
        )
      } catch (err) {
        console.error("[admin/student/certificates] fetch crashed:", err)
        setLoadError(err instanceof Error ? err.message : "Unexpected error")
      } finally {
        setLoading(false)
      }
    }
    void fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <p>Could not load certificates: {loadError}</p>
      </div>
    )
  }

  const issued = certificates.filter((c) => c.status === "Issued").length
  const processing = certificates.filter((c) => c.status === "Processing" || c.status === "Requested").length

  const handlePrint = (cert: Certificate) => {
    const opened = printCertificate({
      studentName: student?.name ?? "",
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          className={buttonVariants({ className: "gap-2" })}
          href={`/admin/certificates?studentId=${encodeURIComponent(student?.id ?? "")}`}
        >
            <Send className="size-4" />
            Issue Certificate
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
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
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{processing}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2.5">
        {certificates.map((cert) => (
          <Card key={cert.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:size-10">
                  <Award className="size-4 sm:size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 break-words text-xs font-medium sm:text-sm">{CERTIFICATE_HEADING}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] shrink-0",
                        statusClass[cert.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {cert.status}
                    </Badge>
                  </div>
                  <p className="mb-1 break-words text-[11px] text-muted-foreground">
                    {getCertificateCourseName(cert.name, cert.course)} · {cert.issuedBy}
                  </p>
                  {cert.status === "Issued" && (
                    <p className="break-all font-mono text-[10px] text-muted-foreground">ID: {cert.credentialId} · Issued: {cert.issuedDate}</p>
                  )}
                  {cert.status === "Rejected" && (
                    <p className="text-[10px] text-red-600 flex items-center gap-1">
                      <XCircle className="size-3" />
                      Not approved — the student can request it again.
                    </p>
                  )}
                </div>
                {cert.status === "Issued" && (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => handlePrint(cert)}>
                    <Printer className="size-3" />
                    <span className="hidden sm:inline">Print</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {certificates.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No certificates found.</p>
        )}
      </div>
    </div>
  )
}
