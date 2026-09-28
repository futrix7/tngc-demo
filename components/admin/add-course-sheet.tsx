"use client"

import { useState } from "react"
import { BookOpen } from "lucide-react"
import { FormSheet, FormField } from "@/components/admin/form-sheet"
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

interface AddCourseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddCourseSheet({ open, onOpenChange, onSuccess }: AddCourseSheetProps) {
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

  async function handleSubmit() {
    if (!courseName.trim() || !shortName.trim() || !duration.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    setSaving(true)

    const slug = courseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const { error } = await supabase.from("courses").insert({
      slug,
      name: courseName.trim(),
      short_name: shortName.trim(),
      duration: duration.trim(),
      type: (courseType as "long-term" | "short-term") || "long-term",
      description: description.trim() || courseName.trim(),
      full_description: description.trim() || courseName.trim(),
      topics: topics ? topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
      fees: fee ? `₹${Number(fee).toLocaleString("en-IN")}` : "₹0",
      fee_numeric: fee ? (parseInt(fee) || 0) : 0,
      eligibility: eligibility || "Any",
      certification: "Course Completion Certificate",
      certification_body: "TNGC Institute",
      schedule: "Weekdays: 9 AM - 11 AM",
      batch_size: "10-15 students",
      status: "active",
    })

    setSaving(false)

    if (error) {
      toast("Failed to add course: " + error.message, { variant: "destructive" })
      return
    }

    toast("Course added successfully", { variant: "success" })
    setCourseName("")
    setShortName("")
    setDuration("")
    setCourseType("")
    setFee("")
    setEligibility("")
    setDescription("")
    setTopics("")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Course"
      icon={BookOpen}
      submitLabel={saving ? "Adding..." : "Add Course"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Course Name" htmlFor="courseName">
          <Input id="courseName" placeholder="Enter course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
        </FormField>
        <FormField label="Short Name" htmlFor="shortName">
          <Input id="shortName" placeholder="Enter the short name" value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration" htmlFor="duration">
          <Input id="duration" placeholder="Enter the duration" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </FormField>
        <FormField label="Course Type">
          <Select value={courseType} onValueChange={(v) => setCourseType(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
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
          <Input id="fee" type="number" placeholder="Enter course fee" value={fee} onChange={(e) => setFee(e.target.value)} />
        </FormField>
        <FormField label="Eligibility">
          <Select value={eligibility} onValueChange={(v) => setEligibility(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select eligibility" />
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
          className="w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </FormField>

      <FormField label="Topics" htmlFor="topics">
        <textarea
          id="topics"
          placeholder="Comma-separated topics"
          rows={2}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className="w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </FormField>
    </FormSheet>
  )
}
