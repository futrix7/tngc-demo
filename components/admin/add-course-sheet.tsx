"use client"

import { useState } from "react"
import { BookOpen, Plus, Trash2 } from "lucide-react"
import {
  FormSheet,
  FormField,
  SHEET_INPUT_CLASS,
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
  SHEET_TEXTAREA_CLASS,
} from "@/components/admin/form-sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  const [certifications, setCertifications] = useState([""])
  const [saving, setSaving] = useState(false)

  function updateCertification(index: number, value: string) {
    setCertifications((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))
  }

  async function handleSubmit() {
    if (!courseName.trim() || !shortName.trim() || !duration.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    const certificateTitles = certifications.map((item, index) =>
      item.trim() || (index === 0 ? courseName.trim() : "")
    )
    if (certificateTitles.some((title) => !title)) {
      toast("Enter a course name for every certificate", { variant: "destructive" })
      return
    }
    if (new Set(certificateTitles.map((title) => title.toLowerCase())).size !== certificateTitles.length) {
      toast("Certificate course names must be unique", { variant: "destructive" })
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
      certification: certificateTitles[0],
      certifications: certificateTitles,
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
    setCertifications([""])
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
          <Input id="courseName" placeholder="Enter course name" className={SHEET_INPUT_CLASS} value={courseName} onChange={(e) => setCourseName(e.target.value)} />
        </FormField>
        <FormField label="Short Name" htmlFor="shortName">
          <Input id="shortName" placeholder="Enter the short name" className={SHEET_INPUT_CLASS} value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration" htmlFor="duration">
          <Input id="duration" placeholder="Enter the duration" className={SHEET_INPUT_CLASS} value={duration} onChange={(e) => setDuration(e.target.value)} />
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
          <Input id="fee" type="number" placeholder="Enter course fee" className={SHEET_INPUT_CLASS} value={fee} onChange={(e) => setFee(e.target.value)} />
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
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={SHEET_TEXTAREA_CLASS}
        />
      </FormField>

      <FormField label="Topics" htmlFor="topics">
        <textarea
          id="topics"
          placeholder="Comma-separated topics"
          rows={3}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className={SHEET_TEXTAREA_CLASS}
        />
      </FormField>

      <FormField label={`Certification of completion · ${certifications.length} certificate${certifications.length === 1 ? "" : "s"}`}>
        <div className="space-y-2">
          {certifications.map((certificate, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Course name on certificate ${index + 1}`}
                placeholder={index === 0 ? courseName || "Course name" : "Enter course name"}
                className={SHEET_INPUT_CLASS}
                value={certificate || (index === 0 ? courseName : "")}
                onChange={(event) => updateCertification(index, event.target.value)}
                maxLength={100}
              />
              {certifications.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remove certificate title ${index + 1}`}
                  onClick={() => setCertifications((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCertifications((current) => [...current, ""])}
          >
            <Plus className="mr-2 size-4" />
            Add Certificate
          </Button>
          <p className="text-xs text-muted-foreground">
            The certificate heading stays “Certification of completion”. The names above are editable course names printed on each certificate.
          </p>
        </div>
      </FormField>
    </FormSheet>
  )
}
