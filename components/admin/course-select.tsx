"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import {
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
} from "@/components/admin/form-sheet"

interface Course {
  slug: string
  name: string
}

interface CourseSelectProps {
  /** `courses.slug` — the value written into `course_slug` columns. */
  value: string
  onChange: (courseSlug: string) => void
  placeholder?: string
  /** Renders the taller data-entry sizing used by the admin sheets. */
  sheetSized?: boolean
}

/**
 * Picks an institute course by its real `courses.slug`.
 *
 * The video upload sheet used to offer nine hardcoded slugs in a static list.
 * Those drifted from the database immediately: a course renamed in the database
 * kept its old label in this dropdown, and any course added later was
 * unselectable, so its videos could never be filed against it. Reading `courses`
 * means the list is whatever the institute actually teaches.
 */
export function CourseSelect({
  value,
  onChange,
  placeholder = "Select course",
  sheetSized = true,
}: CourseSelectProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCourses() {
      setLoading(true)
      setFailed(false)
      const { data, error } = await supabase
        .from("courses")
        .select("slug, name")
        .order("name", { ascending: true })

      if (cancelled) return
      if (error) {
        console.error("[course-select] course lookup failed:", error.message)
        setCourses([])
        setFailed(true)
      } else {
        setCourses(data ?? [])
      }
      setLoading(false)
    }

    void loadCourses()
    return () => { cancelled = true }
  }, [])

  const triggerClass = sheetSized ? SHEET_SELECT_TRIGGER_CLASS : undefined
  const valueClass = sheetSized ? SHEET_SELECT_VALUE_CLASS : undefined

  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger className={triggerClass}>
        <SelectValue
          className={valueClass}
          placeholder={loading ? "Loading courses..." : failed ? "Courses unavailable" : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {courses.map((course) => (
          <SelectItem key={course.slug} value={course.slug}>
            {course.name}
          </SelectItem>
        ))}
        {courses.length === 0 && !loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {failed ? "No courses could be loaded." : "No courses have been set up yet."}
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
