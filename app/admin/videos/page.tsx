"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Search, Play, Upload, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { UploadVideoSheet } from "@/components/admin/upload-video-sheet"
import { supabase } from "@/lib/supabase"

interface Video {
  id: string
  title: string
  course: string
  duration: string
  views: number
  uploadedBy: string
  date: string
  status: "Published" | "Draft" | "Processing"
  url: string | null
}

/**
 * Only `http(s)` and blob-free `data:` links are allowed through.
 *
 * The URL is admin-supplied free text that ends up in an `href`, and an
 * unvalidated value here is a `javascript:` execution vector. Anything that is
 * not plainly a web or media link is reported as "no link" rather than
 * silently rendered as a button that does nothing.
 */
function safeVideoUrl(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href
    return null
  } catch {
    return null
  }
}

const statusConfig: Record<string, { className: string }> = {
  Published: { className: "bg-emerald-500/15 text-emerald-600" },
  Draft: { className: "bg-amber-500/15 text-amber-600" },
  Processing: { className: "bg-blue-500/15 text-blue-600" },
}

export default function VideosPage() {
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<Video[]>([])

  async function fetchVideos() {
    setLoading(true)
    const { data, error } = await supabase
      .from("videos")
      .select("*, courses(name), teachers(full_name)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching videos:", error)
      setLoading(false)
      return
    }

    const mapped: Video[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      course: row.courses?.name || "—",
      duration: row.duration || "—",
      views: row.views ?? 0,
      uploadedBy: row.teachers?.full_name || "—",
      date: row.upload_date,
      status: row.status,
      url: row.url,
    }))

    setVideos(mapped)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchVideos()
  }, [])

  const stats = [
    { label: "Total Videos", value: videos.length, color: "text-foreground" },
    { label: "Published", value: videos.filter((v) => v.status === "Published").length, color: "text-emerald-600" },
    { label: "Draft", value: videos.filter((v) => v.status === "Draft").length, color: "text-amber-600" },
    { label: "Total Views", value: videos.reduce((sum, v) => sum + v.views, 0).toLocaleString(), color: "text-violet-600" },
  ]

  const filtered = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.course.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading videos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Videos</h1>
          <p className="text-xs text-muted-foreground">Manage course videos and lectures</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setSheetOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Video
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-sm font-bold shrink-0", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Videos</CardTitle>
              <CardDescription>{filtered.length} videos found</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                className="pl-8 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Course</TableHead>
                <TableHead className="hidden sm:table-cell">Duration</TableHead>
                <TableHead className="hidden sm:table-cell">Views</TableHead>
                <TableHead className="hidden lg:table-cell">Uploaded By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((video) => {
                const link = safeVideoUrl(video.url)
                return (
                <TableRow key={video.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <Play className="size-4 text-primary fill-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{video.title}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{video.course}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{video.course}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="size-3" />
                      {video.duration}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{video.views.toLocaleString()}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{video.uploadedBy}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", statusConfig[video.status]?.className)}>
                      {video.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {link ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<a href={link} target="_blank" rel="noopener noreferrer" />}
                        title={`Open ${video.title}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span className="sr-only">Open {video.title}</span>
                      </Button>
                    ) : (
                      <span
                        className="text-[10px] text-muted-foreground px-1"
                        title="No video URL was recorded for this row"
                      >
                        No link
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UploadVideoSheet open={sheetOpen} onOpenChange={setSheetOpen} onSuccess={() => fetchVideos()} />
    </div>
  )
}
