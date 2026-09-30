"use client"

import { useState, useEffect } from "react"
import { BookOpen } from "lucide-react"
import {
  FormSheet,
  FormField,
  SHEET_INPUT_CLASS,
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
  SHEET_TEXTAREA_CLASS,
} from "@/components/admin/form-sheet"
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

interface CourseData {
  id: string
  name: string
  short_name: string
  duration: string
  category: string
  fee: number
  eligibility: string
  description: string
  topics: string[]
  status?: string
}

interface EditCourseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: CourseData | null
  onSuccess: () => void
}

export function EditCourseSheet({ open, onOpenChange, course, onSuccess }: EditCourseSheetProps) {
  const { toast } = useToast()
  const [courseName, setCourseName] = useState("")
  const [shortName, setShortName] = useState("")
  const [duration, setDuration] = useState("")
  const [courseType, setCourseType] = useState("")
  const [fee, setFee] = useState("")
  const [eligibility, setEligibility] = useState("")
  const [description, setDescription] = useState("")
  const [topics, setTopics] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (course) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form state when opening the sheet
      setCourseName(course.name)
      setShortName(course.short_name)
      setDuration(course.duration)
      setCourseType(course.category)
      setFee(String(course.fee))
      setEligibility(course.eligibility)
      setDescription(course.description)
      setTopics(course.topics.join(", "))
    }
  }, [course])

  async function handleSubmit() {
    if (!courseName.trim() || !shortName.trim() || !duration.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    if (!course) return
    setSaving(true)

    const slug = courseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const { error } = await supabase
      .from("courses")
      .update({
        slug,
        name: courseName.trim(),
        short_name: shortName.trim(),
        duration: duration.trim(),
        type: courseType || "long-term",
        description: description.trim() || courseName.trim(),
        full_description: description.trim() || courseName.trim(),
        topics: topics ? topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
        fees: fee ? `₹${Number(fee).toLocaleString("en-IN")}` : "₹0",
        fee_numeric: fee ? (parseInt(fee) || 0) : 0,
        eligibility: eligibility || "Any",
      })
      .eq("id", course.id)

    setSaving(false)

    if (error) {
      toast("Failed to update course: " + error.message, { variant: "destructive" })
      return
    }

    toast("Course updated successfully", { variant: "success" })
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Course"
      icon={BookOpen}
      submitLabel={saving ? "Saving..." : "Save Changes"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Course Name" htmlFor="courseName">
          <Input id="courseName" className={SHEET_INPUT_CLASS} placeholder="Enter course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
        </FormField>
        <FormField label="Short Name" htmlFor="shortName">
          <Input id="shortName" className={SHEET_INPUT_CLASS} placeholder="Enter the short name" value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration" htmlFor="duration">
          <Input id="duration" className={SHEET_INPUT_CLASS} placeholder="Enter the duration" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </FormField>
        <FormField label="Course Type">
          <Select value={courseType} onValueChange={(v) => setCourseType(v ?? "")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long-term">Long-Term</SelectItem>
              <SelectItem value="short-term">Short-Term</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Fee" htmlFor="fee">
          <Input id="fee" className={SHEET_INPUT_CLASS} type="number" placeholder="Enter course fee" value={fee} onChange={(e) => setFee(e.target.value)} />
        </FormField>
        <FormField label="Eligibility">
          <Select value={eligibility} onValueChange={(v) => setEligibility(v ?? "")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select eligibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10th Pass or equivalent">10th Pass</SelectItem>
              <SelectItem value="12th Pass or equivalent">12th Pass</SelectItem>
              <SelectItem value="Graduate or equivalent">Graduate</SelectItem>
              <SelectItem value="Any">Any</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          placeholder="Enter course description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={SHEET_TEXTAREA_CLASS}
        />
      </FormField>

      <FormField label="Topics" htmlFor="topics">
        <textarea
          id="topics"
          placeholder="Comma-separated topics"
          rows={2}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className={SHEET_TEXTAREA_CLASS}
        />
      </FormField>
    </FormSheet>
  )
}
