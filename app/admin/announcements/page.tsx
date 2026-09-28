"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Search, Plus, Calendar, Users, Pin, ArrowRight, AlertCircle, Info, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnnouncementDialog } from "@/components/admin/announcement-dialog"
import { supabase } from "@/lib/supabase"

interface Announcement {
  id: string
  title: string
  message: string
  priority: "high" | "medium" | "low"
  target: string
  author: string
  date: string
  pinned: boolean
}

const priorityConfig: Record<string, { className: string; icon: React.ElementType }> = {
  high: { className: "bg-red-500/15 text-red-600", icon: AlertCircle },
  medium: { className: "bg-amber-500/15 text-amber-600", icon: Info },
  low: { className: "bg-blue-500/15 text-blue-600", icon: CheckCircle2 },
}

export default function AnnouncementsPage() {
  const [search, setSearch] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  async function fetchAnnouncements() {
    setLoading(true)
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching announcements:", error)
      setLoading(false)
      return
    }

    const mapped: Announcement[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      priority: row.priority,
      target: row.target,
      author: row.author_name || "Admin",
      date: row.published_date,
      pinned: row.pinned ?? false,
    }))

    setAnnouncements(mapped)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchAnnouncements()
  }, [])

  const now = new Date()
  const stats = [
    { label: "Total", value: announcements.length, color: "text-foreground" },
    { label: "Pinned", value: announcements.filter((a) => a.pinned).length, color: "text-violet-600" },
    { label: "High Priority", value: announcements.filter((a) => a.priority === "high").length, color: "text-red-600" },
    {
      label: "This Month",
      value: announcements.filter((a) => {
        if (!a.date) return false
        const d = new Date(a.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length,
      color: "text-emerald-600",
    },
  ]

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.message.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading announcements...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-xs text-muted-foreground">Manage notices and announcements</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4" />
          New Announcement
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

      {/* Pinned Announcements */}
      {announcements.filter((a) => a.pinned).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Pin className="size-3.5" />
            Pinned
          </h2>
          {announcements
            .filter((a) => a.pinned)
            .map((a) => {
              const cfg = priorityConfig[a.priority]
              const Icon = cfg.icon
              return (
                <Card key={a.id} className="border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold">{a.title}</h3>
                          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", cfg.className)}>
                            <Icon className="size-2.5 mr-0.5" />
                            {a.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{a.message}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="size-3" />{a.target}</span>
                          <span className="flex items-center gap-1"><Calendar className="size-3" />{a.date}</span>
                          <span>By {a.author}</span>
                        </div>
                      </div>
                      <Link
                        href={`/admin/announcements/${a.id}`}
                        aria-label={`Open ${a.title}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </div>
      )}

      {/* All Announcements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Announcements</CardTitle>
              <CardDescription>{filtered.length} announcements</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
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
                <TableHead className="hidden md:table-cell">Target</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Author</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const cfg = priorityConfig[a.priority]
                const Icon = cfg.icon
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {a.pinned && <Pin className="size-3 text-primary shrink-0" />}
                        <span className="font-medium text-sm">{a.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{a.target}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[10px] gap-1", cfg.className)}>
                        <Icon className="size-2.5" />
                        {a.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{a.date}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{a.author}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/announcements/${a.id}`}
                        aria-label={`Open ${a.title}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AnnouncementDialog open={drawerOpen} onOpenChange={setDrawerOpen} onSuccess={() => fetchAnnouncements()} />
    </div>
  )
}
