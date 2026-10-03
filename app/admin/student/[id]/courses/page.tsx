"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Loader2, Trash2 } from "lucide-react"
import { useStudent, useRemoveStudentCourse } from "../layout"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface StudentCourse {
  slug: string
  name: string
  totalFee: number
}

export default function StudentCoursesPage() {
  const student = useStudent()
  const removeStudentCourse = useRemoveStudentCourse()
  const { toast } = useToast()
  const [courses, setCourses] = useState<StudentCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [removingCourse, setRemovingCourse] = useState<StudentCourse | null>(null)
  const [confirmationName, setConfirmationName] = useState("")
  const [removing, setRemoving] = useState(false)

  const fetchCourses = useCallback(async () => {
    if (!student) return
    setLoading(true)
    setError("")

    const [feesResult, studentResult] = await Promise.all([
      supabase.from("fees").select("course_slug, total_fee").eq("student_id", student.id),
      supabase.from("students").select("course_slug, is_legacy_import").eq("id", student.id).single(),
    ])
    if (feesResult.error || studentResult.error) {
      const loadError = feesResult.error ?? studentResult.error
      console.error("[student courses] enrollment lookup failed:", loadError?.message)
      setError("This student's course enrollments could not be loaded.")
      setLoading(false)
      return
    }

    const feeRows = feesResult.data ?? []
    const courseSlugs = [...new Set([
      ...feeRows.map((fee) => fee.course_slug),
      ...(!studentResult.data.is_legacy_import ? [studentResult.data.course_slug] : []),
    ].filter((slug): slug is string => Boolean(slug)))]

    if (courseSlugs.length === 0) {
      setCourses([])
      setLoading(false)
      return
    }

    const { data: courseRows, error: courseError } = await supabase
      .from("courses")
      .select("slug, name")
      .in("slug", courseSlugs)

    if (courseError) {
      console.error("[student courses] course lookup failed:", courseError.message)
      setError("Course details could not be loaded.")
      setLoading(false)
      return
    }

    setCourses(courseSlugs.map((slug) => ({
      slug,
      name: courseRows?.find((course) => course.slug === slug)?.name ?? slug,
      totalFee: feeRows
        .filter((fee) => fee.course_slug === slug)
        .reduce((sum, fee) => sum + Number(fee.total_fee ?? 0), 0),
    })))
    setLoading(false)
  }, [student])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time enrollment fetch
    fetchCourses()
  }, [fetchCourses])

  async function confirmRemoveCourse() {
    if (!student || !removingCourse || confirmationName !== removingCourse.name || removing) return
    setRemoving(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/remove-course", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: student.id,
          courseSlug: removingCourse.slug,
          confirmationName,
        }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        toast(result.error ?? "This course could not be removed.", { variant: "destructive" })
        return
      }

      removeStudentCourse(removingCourse.name)
      toast("Course removed from this student.", { variant: "success" })
      setRemovingCourse(null)
      setConfirmationName("")
      await fetchCourses()
    } catch (cause) {
      console.error("[student courses] course removal failed:", cause)
      toast("This course could not be removed. Please try again.", { variant: "destructive" })
    } finally {
      setRemoving(false)
    }
  }

  function openRemoval(course: StudentCourse) {
    setConfirmationName("")
    setRemovingCourse(course)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Enrolled Courses</h2>
        <p className="text-sm text-muted-foreground">Courses and fee schedules currently attached to {student?.name ?? "this student"}.</p>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && courses.length === 0 && (
        <Card>
          <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
            <p>No active courses are recorded for this student.</p>
            <Link className="font-medium text-primary underline underline-offset-4" href={`/admin/student/${student?.id}/profile`}>
              Open the profile to add a course
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.slug}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{course.name}</CardTitle>
                  <CardDescription>{course.totalFee > 0
                    ? `Fee: ₹${course.totalFee.toLocaleString("en-IN")}`
                    : "No fee schedule"}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">Enrolled</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => openRemoval(course)}
              >
                <Trash2 className="mr-2 size-4" />
                Remove course
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(removingCourse)}
        onOpenChange={(open) => {
          if (!open && !removing) {
            setRemovingCourse(null)
            setConfirmationName("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <BookOpen className="size-5" />
              Remove student course
            </DialogTitle>
            <DialogDescription>
              This removes <span className="font-semibold text-foreground">{removingCourse?.name}</span> and its unpaid fee schedule from this student only. Payment or certificate history prevents removal and is kept unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="removeCourseName">
              Type the course name to confirm: <span className="text-foreground">{removingCourse?.name}</span>
            </Label>
            <Input
              id="removeCourseName"
              value={confirmationName}
              onChange={(event) => setConfirmationName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemovingCourse(null)} disabled={removing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveCourse}
              disabled={confirmationName !== removingCourse?.name || removing}
            >
              {removing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {removing ? "Removing..." : "Remove course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
