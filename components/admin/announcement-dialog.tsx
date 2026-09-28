"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface AnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AnnouncementDialog({ open, onOpenChange, onSuccess }: AnnouncementDialogProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState("medium")
  const [target, setTarget] = useState("All Students")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!title.trim() || !message.trim()) {
      toast("Please fill in title and message", { variant: "destructive" })
      return
    }

    setSaving(true)

    const announcementId = `ANN-${Date.now()}`

    const { error } = await supabase.from("announcements").insert({
      id: announcementId,
      title: title.trim(),
      message: message.trim(),
      priority: (priority as "high" | "medium" | "low") || "medium",
      target: target || "All Students",
      pinned: false,
    })

    setSaving(false)

    if (error) {
      toast("Failed to create announcement: " + error.message, { variant: "destructive" })
      return
    }

    toast("Announcement published", { variant: "success" })
    setTitle("")
    setMessage("")
    setPriority("medium")
    setTarget("All Students")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5" />
            New Announcement
          </DialogTitle>
          <DialogDescription>
            Create a new notice for students and staff
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              placeholder="Enter the title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-message">Message</Label>
            <textarea
              id="a-message"
              placeholder="Write your announcement..."
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "medium")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Select value={target} onValueChange={(v) => setTarget(v ?? "All Students")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Students & Staff">All Students & Staff</SelectItem>
                  <SelectItem value="All Students">All Students</SelectItem>
                  <SelectItem value="Python Students">Python Students</SelectItem>
                  <SelectItem value="Java Students">Java Students</SelectItem>
                  <SelectItem value="All Staff">All Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Publishing..." : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
