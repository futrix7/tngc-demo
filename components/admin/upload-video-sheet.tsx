"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { FormSheet, FormField } from "@/components/admin/form-sheet"
import { Input } from "@/components/ui/input"
import { CourseSelect } from "@/components/admin/course-select"
import { supabase } from "@/lib/supabase"
import { mintId } from "@/lib/mint-id"
import { localDate } from "@/lib/local-date"
import { useToast } from "@/components/ui/sonner"

interface UploadVideoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UploadVideoSheet({ open, onOpenChange, onSuccess }: UploadVideoSheetProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [course, setCourse] = useState("")
  const [duration, setDuration] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) {
      toast("Please enter a video title", { variant: "destructive" })
      return
    }

    // A video with no link is a row the list cannot act on, so it is worth
    // saying so here rather than storing something the UI can only display.
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      toast("Please enter the URL the video is hosted at", { variant: "destructive" })
      return
    }
    let parsedUrl: URL
    try {
      parsedUrl = new URL(trimmedUrl)
    } catch {
      toast("That does not look like a valid URL", { variant: "destructive" })
      return
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      toast("The video URL must start with http:// or https://", { variant: "destructive" })
      return
    }

    setSaving(true)

    // `videos.uploaded_by` is a FK to `teachers.id`. It used to be left null, so
    // every row read "—" under "Uploaded By" and no admin could be traced as
    // the one who published a lecture. Resolved from the signed-in account.
    const { data: authData } = await supabase.auth.getUser()
    const { data: teacherRows } = authData?.user
      ? await supabase.from("teachers").select("id").eq("email", authData.user.email ?? "").limit(1)
      : { data: [] as { id: string }[] }
    const uploadedBy = teacherRows?.[0]?.id ?? null

    const { error } = await supabase.from("videos").insert({
      id: mintId("VID"),
      title: title.trim(),
      url: parsedUrl.href,
      course_slug: course || null,
      duration: duration.trim() || null,
      views: 0,
      // `upload_date` has a DEFAULT, but it is `CURRENT_DATE` evaluated in the
      // database's timezone (UTC), which reads as yesterday for anything
      // entered before 05:30 IST.
      upload_date: localDate(),
      uploaded_by: uploadedBy,
      status: "Published",
    })

    setSaving(false)

    if (error) {
      toast("Failed to upload video: " + error.message, { variant: "destructive" })
      return
    }

    toast("Video uploaded successfully", { variant: "success" })
    setTitle("")
    setUrl("")
    setCourse("")
    setDuration("")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Video"
      icon={Upload}
      submitLabel={saving ? "Uploading..." : "Upload"}
      onSubmit={handleSubmit}
    >
      <FormField label="Video Title" htmlFor="title">
        <Input id="title" placeholder="Enter the video title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>

      <FormField label="Video URL" htmlFor="url">
        <Input id="url" type="url" placeholder="Enter the video URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Course">
          <CourseSelect value={course} onChange={setCourse} />
        </FormField>
        <FormField label="Duration" htmlFor="duration">
          <Input id="duration" placeholder="Enter the duration" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </FormField>
      </div>
    </FormSheet>
  )
}
