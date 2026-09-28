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

export default function StudentProfilePage() {
  const student = useStudent()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      const { data } = await supabase
        .from("students")
        .select("date_of_birth, address, batch_time, father_name, father_phone, mother_name, enrollment_date")
        .eq("id", student!.id)
        .single()
      if (data) {
        setProfile({
          dob: data.date_of_birth ?? "",
          address: data.address ?? "",
          batchTime: data.batch_time ?? "",
          fatherName: data.father_name ?? "",
          fatherPhone: data.father_phone ?? "",
          motherName: data.mother_name ?? "",
          joinDate: data.enrollment_date,
        })
      }
      setLoading(false)
    }
    fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (!student || !profile) return null

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold mb-3">Personal Information</h2>
          <div className="divide-y divide-border">
            {[
              { icon: Mail, label: "Email", value: student.email },
              { icon: Phone, label: "Phone", value: student.phone },
              { icon: Calendar, label: "Date of Birth", value: profile.dob },
              { icon: MapPin, label: "Address", value: profile.address },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3">
                <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <row.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  <p className="text-xs sm:text-sm truncate">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold mb-3">Course Details</h2>
          <div className="divide-y divide-border">
            {[
              { icon: BookOpen, label: "Course", value: student.course },
              { icon: MapPin, label: "Branch", value: student.branch },
              { icon: Calendar, label: "Join Date", value: profile.joinDate },
              { icon: UserCircle, label: "Batch Time", value: profile.batchTime },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3">
                <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <row.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  <p className="text-xs sm:text-sm truncate">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold mb-3">Parent / Guardian</h2>
          <div className="grid sm:grid-cols-3 gap-1 sm:gap-4 divide-y sm:divide-y-0 divide-border">
            {[
              { icon: UserCircle, label: "Father's Name", value: profile.fatherName },
              { icon: Phone, label: "Father's Phone", value: profile.fatherPhone },
              { icon: UserCircle, label: "Mother's Name", value: profile.motherName },
            ].map((row) => (
              <div key={row.label} className="sm:px-4 first:sm:pl-0 py-2.5 sm:py-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <row.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="text-xs sm:text-sm truncate">{row.value}</p>
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
