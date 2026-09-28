"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Award, Download, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useStudent } from "../layout"

interface Certificate {
  id: string
  name: string
  issuedDate: string | null
  status: "Issued" | "Processing" | "Pending" | "Rejected" | "Requested"
}

export default function StudentCertificatesPage() {
  const student = useStudent()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      const { data: certRows } = await supabase
        .from("certificates").select("id, name, issued_date, status")
        .eq("student_id", student!.id).order("created_at", { ascending: false })

      if (certRows) {
        setCertificates(certRows.map((c) => ({
          id: c.id,
          name: c.name,
          issuedDate: c.issued_date,
          status: c.status as Certificate["status"],
        })))
      }
      setLoading(false)
    }
    fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold">{certificates.length}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">{certificates.filter((c) => c.status === "Issued").length}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Issued</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{certificates.filter((c) => c.status === "Processing").length}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Processing</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2.5">
        {certificates.map((cert) => (
          <Card key={cert.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="size-4 sm:size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs sm:text-sm font-medium truncate">{cert.name}</p>
                    <Badge variant="secondary" className={cn("text-[10px] shrink-0", cert.status === "Issued" ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600")}>
                      {cert.status}
                    </Badge>
                  </div>
                  {cert.status === "Issued" && cert.issuedDate && (
                    <p className="text-[10px] text-muted-foreground font-mono">Issued: {cert.issuedDate}</p>
                  )}
                </div>
                {cert.status === "Issued" && (
                  <Button variant="outline" size="sm" className="gap-1 shrink-0">
                    <Download className="size-3" />
                    <span className="hidden sm:inline">Download</span>
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
