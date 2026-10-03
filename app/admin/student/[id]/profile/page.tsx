"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { UserCircle, Mail, Phone, MapPin, Calendar, BookOpen, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useStudent } from "../layout"

interface ProfileData {
  dob: string
  address: string
  batchTime: string
  fatherName: string
  fatherPhone: string
  motherName: string
  joinDate: string
}

function displayDate(value: string) {
  if (!value) return "Not provided"
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function StudentProfilePage() {
  const student = useStudent()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    async function fetchProfile() {
      setError(null)

      const { data, error: profileError } = await supabase
        .from("students")
        .select("date_of_birth, address, batch_time, father_name, father_phone, mother_name, enrollment_date")
        .eq("id", student!.id)
        .maybeSingle()

      if (profileError) {
        // Swallowed before: `data` was simply undefined, `profile` stayed null and
        // the page rendered `null` — a blank panel under a working header, with
        // no message and no way to tell it apart from a student who has no
        // details on file.
        console.error("[student profile] lookup failed:", profileError.message)
        setError("This student's details could not be loaded.")
        setLoading(false)
        return
      }

      if (!data) {
        setError("This student's details could not be found.")
        setLoading(false)
        return
      }

      setProfile({
        dob: data.date_of_birth ?? "",
        address: data.address ?? "",
        batchTime: data.batch_time ?? "",
        fatherName: data.father_name ?? "",
        fatherPhone: data.father_phone ?? "",
        motherName: data.mother_name ?? "",
        joinDate: data.enrollment_date ?? "",
      })
      setLoading(false)
    }
    fetchProfile()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (!student || !profile) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">{error ?? "This student's details are unavailable."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Use the student tabs to view fees, installments, payments, and certificates.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-1 text-base font-semibold">Personal information</h2>
          <p className="mb-3 text-xs text-muted-foreground">Contact and identity details for this student.</p>
          <div className="divide-y divide-border">
            {[
              { icon: Mail, label: "Email", value: student.email },
              { icon: Phone, label: "Phone", value: student.phone },
              { icon: Calendar, label: "Date of Birth", value: displayDate(profile.dob) },
              { icon: MapPin, label: "Address", value: profile.address },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 items-start gap-3 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <row.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  <p className="break-words text-sm">{row.value || "Not provided"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-1 text-base font-semibold">Course details</h2>
          <p className="mb-3 text-xs text-muted-foreground">Enrollment and class information.</p>
          <div className="divide-y divide-border">
            {[
              { icon: MapPin, label: "Branch", value: student.branch },
              { icon: Calendar, label: "Join Date", value: displayDate(profile.joinDate) },
              { icon: UserCircle, label: "Batch Time", value: profile.batchTime },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 items-start gap-3 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <row.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  <p className="break-words text-sm">{row.value || "Not provided"}</p>
                </div>
              </div>
            ))}
            <div className="flex min-w-0 items-start gap-3 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <BookOpen className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">Courses</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {student.courses.length > 0
                    ? student.courses.map((course) => (
                      <span key={course} className="max-w-full rounded-md bg-secondary px-2 py-1 text-xs leading-snug text-secondary-foreground [overflow-wrap:anywhere]">
                        {course}
                      </span>
                    ))
                    : <span className="text-sm text-muted-foreground">No course on file</span>}
                </div>
              </div>
            </div>
            {student.previousCourse && (
              <div className="flex min-w-0 items-start gap-3 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">Previous course (CSV; historical only)</p>
                  <p className="break-words text-sm">{student.previousCourse}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="p-4 sm:p-5">
          <h2 className="mb-1 text-base font-semibold">Parent / guardian</h2>
          <p className="mb-3 text-xs text-muted-foreground">Optional family and emergency contact information.</p>
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {[
              { icon: UserCircle, label: "Father's Name", value: profile.fatherName },
              { icon: Phone, label: "Father's Phone", value: profile.fatherPhone },
              { icon: UserCircle, label: "Mother's Name", value: profile.motherName },
            ].map((row) => (
              <div key={row.label} className="min-w-0 py-3 sm:px-3 sm:py-2 first:sm:pl-0">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <row.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="break-words text-sm">{row.value || "Not provided"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
