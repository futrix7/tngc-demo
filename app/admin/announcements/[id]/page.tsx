"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Pin,
  Trash2,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface Announcement {
  id: string
  title: string
  message: string
  priority: "high" | "medium" | "low"
  target: string
  author: string
  publishedDate: string
  createdAt: string
  pinned: boolean
}

const priorityConfig: Record<string, { className: string; label: string }> = {
  high: { className: "bg-red-500/15 text-red-600", label: "High" },
  medium: { className: "bg-amber-500/15 text-amber-600", label: "Medium" },
  low: { className: "bg-blue-500/15 text-blue-600", label: "Low" },
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const id = params.id

  const fetchAnnouncement = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("[announcements/detail] lookup failed:", error.message)
      setLoadError(error.message)
      setLoading(false)
      return
    }

    if (!data) {
      setLoadError("This notice no longer exists. It may have been deleted.")
      setLoading(false)
      return
    }

    setAnnouncement({
      id: data.id,
      title: data.title,
      message: data.message,
      priority: data.priority,
      target: data.target,
      author: data.author_name || "Admin",
      publishedDate: formatDate(data.published_date),
      createdAt: data.created_at ? new Date(data.created_at).toLocaleString("en-IN") : "—",
      pinned: data.pinned ?? false,
    })
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchAnnouncement()
  }, [fetchAnnouncement, attempt])

  async function confirmDelete() {
    if (!announcement) return
    setDeleting(true)

    const { error } = await supabase.from("announcements").delete().eq("id", announcement.id)

    if (error) {
      console.error("[announcements/detail] delete failed:", error.message)
      toast("We couldn't delete that notice. Nothing was removed.", { variant: "destructive" })
      setDeleting(false)
      setDeleteOpen(false)
      return
    }

    toast("Notice deleted", { variant: "success" })
    setDeleting(false)
    setDeleteOpen(false)
    router.push("/admin/announcements")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !announcement) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/announcements"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Announcements
        </Link>
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-destructive">{loadError ?? "Notice not found."}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/admin/announcements")}>
                Back to list
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cfg = priorityConfig[announcement.priority] ?? priorityConfig.medium

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/announcements"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Announcements
        </Link>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("text-[10px] gap-1", cfg.className)}>
            {cfg.label}
          </Badge>
          {announcement.pinned && (
            <Badge variant="secondary" className="text-[10px] gap-1 text-violet-600 bg-violet-500/15">
              <Pin className="size-2.5" />
              Pinned
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{announcement.title}</h1>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* The list truncates nothing but shows one line at most; this is the
              only place the whole notice is readable, which is what makes the
              row's arrow mean anything. */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{announcement.message}</p>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {announcement.target}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Published {announcement.publishedDate}
            </span>
            <span>By {announcement.author}</span>
            <span>Created {announcement.createdAt}</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this notice?</DialogTitle>
            <DialogDescription>
              &ldquo;{announcement.title}&rdquo; will be removed from every student&apos;s
              announcements page. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? "Deleting..." : "Delete notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
