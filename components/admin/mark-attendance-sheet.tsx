"use client"

import { useEffect, useState } from "react"
import { CalendarCheck } from "lucide-react"
import { FormSheet } from "@/components/admin/form-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface MarkAttendanceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  onSuccess: () => void
}

interface StudentEntry {
  id: string
  full_name: string
  phone: string | null
  course_slug: string | null
  course_name: string | null
  branch_id: string | null
  branch_name: string | null
  batch_time: string | null
}

const STATUSES = ["Present", "Absent", "Late", "Leave"] as const

export function MarkAttendanceSheet({ open, onOpenChange, date, onSuccess }: MarkAttendanceSheetProps) {
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentEntry[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [timeIn, setTimeIn] = useState("09:00")
  const [timeOut, setTimeOut] = useState("22:00")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function loadData() {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, phone, course_slug, branch_id, batch_time, courses(name), branches(name)")
        .eq("status", "Active")
        .order("full_name")
      if (error) {
        toast("Failed to load students: " + error.message, { variant: "destructive" })
        return
      }
      setStudents(
        (data || []).map((row) => {
          const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches
          return {
            id: row.id,
            full_name: row.full_name,
            phone: row.phone,
            course_slug: row.course_slug,
            course_name: course?.name ?? null,
            branch_id: row.branch_id,
            branch_name: branch?.name ?? null,
            batch_time: row.batch_time ?? null,
          }
        })
      )
      const defaults: Record<string, string> = {}
      ;(data || []).forEach((s) => {
        defaults[s.id] = "Present"
      })
      setStatuses(defaults)
    }
    loadData()
  }, [open, toast])

  async function handleSubmit() {
    if (students.length === 0) {
      toast("No students to mark", { variant: "info" })
      onOpenChange(false)
      return
    }
    setSaving(true)
    const rows = students.map((s) => ({
      student_id: s.id,
      date,
      course_slug: s.course_slug,
      branch_id: s.branch_id,
      status: statuses[s.id] ?? "Present",
      time_in: timeIn ? `${timeIn}:00` : null,
      time_out: timeOut ? `${timeOut}:00` : null,
      hours: timeIn && timeOut ? computeHours(timeIn, timeOut) : 0,
    }))

    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" })
    setSaving(false)

    if (error) {
      toast("Failed to save attendance: " + error.message, { variant: "destructive" })
      return
    }

    toast("Attendance saved successfully", { variant: "success" })
    onOpenChange(false)
    onSuccess()
  }

  function computeHours(inTime: string, outTime: string): number {
    const [ih, im] = inTime.split(":").map(Number)
    const [oh, om] = outTime.split(":").map(Number)
    let diff = (oh * 60 + om) - (ih * 60 + im)
    if (diff < 0) diff += 24 * 60
    return Math.round((diff / 60) * 10) / 10
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mark Attendance"
      icon={CalendarCheck}
      submitLabel={saving ? "Saving..." : `Save ${students.length} Records`}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor="timeIn" className="block">
          <span className="text-sm font-medium leading-none">Time In</span>
          <span className="mt-1.5 block">
            <Input id="timeIn" type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
          </span>
        </label>
        <label htmlFor="timeOut" className="block">
          <span className="text-sm font-medium leading-none">Time Out</span>
          <span className="mt-1.5 block">
            <Input id="timeOut" type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-input">
        {students.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No active students found.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {students.map((s, index) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-2.5 ${index > 0 ? "border-t border-input" : ""}`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                  {s.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.course_name ?? s.course_slug ?? "No course"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[s.branch_name ?? "", s.phone ?? "", s.batch_time ?? ""]
                      .filter(Boolean)
                      .join(" • ") || "—"}
                  </p>
                </div>
                <Select
                  value={statuses[s.id] ?? "Present"}
                  onValueChange={(v) => setStatuses((prev) => ({ ...prev, [s.id]: v ?? "Present" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((st) => {
          const count = Object.values(statuses).filter((v) => v === st).length
          return (
            <Button
              key={st}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next: Record<string, string> = {}
                students.forEach((s) => {
                  next[s.id] = st
                })
                setStatuses(next)
              }}
            >
              {st}: {count}
            </Button>
          )
        })}
      </div>
    </FormSheet>
  )
}