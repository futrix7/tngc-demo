"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useStudent } from "../layout"

interface AttendanceMonth {
  month: string
  present: number
  absent: number
  leave: number
  pct: number
}

interface AttendanceData {
  overall: number
  present: number
  absent: number
  leave: number
  months: AttendanceMonth[]
}

export default function StudentAttendancePage() {
  const student = useStudent()
  const [data, setData] = useState<AttendanceData>({ overall: 0, present: 0, absent: 0, leave: 0, months: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    async function fetch() {
      const { data: attRows } = await supabase
        .from("attendance").select("date, status").eq("student_id", student!.id).order("date", { ascending: false })

      if (attRows) {
        const totalRecords = attRows.length
        const presentCount = attRows.filter((a) => a.status === "Present").length
        const absentCount = attRows.filter((a) => a.status === "Absent").length
        const leaveCount = attRows.filter((a) => a.status === "Leave").length
        const overallPct = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0

        const monthMap: Record<string, { present: number; absent: number; leave: number; total: number }> = {}
        for (const row of attRows) {
          const d = new Date(row.date)
          const key = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`
          if (!monthMap[key]) monthMap[key] = { present: 0, absent: 0, leave: 0, total: 0 }
          monthMap[key].total++
          if (row.status === "Present") monthMap[key].present++
          if (row.status === "Absent") monthMap[key].absent++
          if (row.status === "Leave") monthMap[key].leave++
        }

        const months: AttendanceMonth[] = Object.entries(monthMap).slice(0, 6).map(([month, d]) => ({
          month,
          present: d.present,
          absent: d.absent,
          leave: d.leave,
          pct: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
        }))

        setData({ overall: overallPct, present: presentCount, absent: absentCount, leave: leaveCount, months })
      }
      setLoading(false)
    }
    fetch()
  }, [student])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 sm:p-5 text-center">
          <div className="inline-flex size-20 sm:size-24 items-center justify-center rounded-full border-4 border-primary/30 bg-primary/10 mb-2 sm:mb-3">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{data.overall}%</p>
          </div>
          <p className="text-xs sm:text-sm font-medium">Overall Attendance</p>
          <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">{data.present}</p>
              <p className="text-[10px] text-muted-foreground">Present</p>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-red-600">{data.absent}</p>
              <p className="text-[10px] text-muted-foreground">Absent</p>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-amber-600">{data.leave}</p>
              <p className="text-[10px] text-muted-foreground">Leave</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold mb-3">Monthly Breakdown</h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {data.months.map((m) => (
                <div key={m.month} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <p className="text-xs sm:text-sm font-medium">{m.month}</p>
                  <p className={cn("text-xs sm:text-sm font-bold", m.pct >= 85 ? "text-emerald-600" : m.pct >= 75 ? "text-amber-600" : "text-red-600")}>{m.pct}%</p>
                </div>
              ))}
              {data.months.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-2">No attendance data available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
