"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Megaphone, Pin, Calendar, User, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { announcementTargetsFor } from "@/lib/announcement-scope"
import { EmptyState, QueryError } from "@/components/student/data-state"

interface Announcement {
  id: string
  title: string
  message: string
  date: string
  author: string
  priority: "high" | "medium" | "low"
  pinned: boolean
  target: string
}

const priorityConfig: Record<string, { className: string; label: string }> = {
  high: { className: "bg-red-500/15 text-red-600", label: "Important" },
  medium: { className: "bg-amber-500/15 text-amber-600", label: "Info" },
  low: { className: "bg-blue-500/15 text-blue-600", label: "Notice" },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    async function fetchAnnouncements() {
      setLoadError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadError("Please sign in again to see announcements.")
        setLoading(false)
        return
      }

      // Who this student is decides which notices they get: the target audience
      // and, below, the date they joined. Both are read up front so the server
      // does the filtering — otherwise the page would pull every notice in the
      // institute and drop most of them in the browser.
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("course_slug, enrollment_date")
        .eq("user_id", user.id)
        .maybeSingle()

      if (studentError) {
        console.error("[announcements] student lookup failed:", studentError.message)
        setLoadError("We couldn't load announcements for this account. Please refresh the page.")
        setLoading(false)
        return
      }

      let query = supabase
        .from("announcements")
        .select("*")
        .in("target", announcementTargetsFor(student?.course_slug ?? null))
        .order("pinned", { ascending: false })
        .order("published_date", { ascending: false })

      // A notice written before this student enrolled is not about them — the
      // institute posts course-intake and batch notices that are stale the day
      // the batch starts. Skipped when the date is unknown, so a missing value
      // never becomes an empty board.
      if (student?.enrollment_date) {
        query = query.gte("published_date", student.enrollment_date)
      }

      const { data, error } = await query

      // The old `if (!error && data)` dropped the failure on the floor and
      // rendered the empty list below it. A student saw "No announcements yet"
      // and concluded the institute had posted nothing, which is the opposite of
      // what a permissions or network failure means.
      if (error) {
        console.error("[announcements] lookup failed:", error.message)
        setLoadError(error.message)
        setLoading(false)
        return
      }

      setAnnouncements(
        (data ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          date: formatDate(a.published_date),
          author: a.author_name || "Admin",
          priority: a.priority,
          pinned: a.pinned,
          target: a.target,
        }))
      )
      setLoading(false)
    }
    fetchAnnouncements()
  }, [attempt])

  const pinned = announcements.filter((a) => a.pinned)
  const others = announcements.filter((a) => !a.pinned)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 lg:p-8">
        <h1 className="text-lg font-bold sm:text-xl">Announcements</h1>
        <QueryError
          what="announcements"
          detail={loadError}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    )
  }

  if (announcements.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 lg:p-8">
        <h1 className="text-lg font-bold sm:text-xl">Announcements</h1>
        <EmptyState
          title="No announcements yet"
          description="Notices from the institute will appear here."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-lg sm:text-xl font-bold">Announcements</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Stay updated with institute notices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{announcements.length}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{pinned.length}</p>
            <p className="text-[11px] text-muted-foreground">Pinned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-600">{announcements.filter((a) => a.priority === "high").length}</p>
            <p className="text-[11px] text-muted-foreground">Important</p>
          </CardContent>
        </Card>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Pin className="size-3.5 text-amber-600" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pinned</h2>
          </div>
          <div className="space-y-2.5">
            {pinned.map((a) => {
              const pCfg = priorityConfig[a.priority]
              return (
                <Card key={a.id} className="border-amber-500/20">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Megaphone className="size-4 text-amber-600 shrink-0" />
                        <p className="text-xs sm:text-sm font-medium truncate">{a.title}</p>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${pCfg.className}`}>{pCfg.label}</Badge>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mb-2 line-clamp-2">{a.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="size-2.5" />{a.date}</span>
                      <span className="flex items-center gap-1"><User className="size-2.5" />{a.author}</span>
                      <Badge variant="outline" className="text-[9px]">{a.target}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* All Others */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">All Announcements</h2>
        <div className="space-y-2.5">
          {others.map((a) => {
            const pCfg = priorityConfig[a.priority]
            return (
              <Card key={a.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs sm:text-sm font-medium">{a.title}</p>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${pCfg.className}`}>{pCfg.label}</Badge>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mb-2 line-clamp-2">{a.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="size-2.5" />{a.date}</span>
                    <span className="flex items-center gap-1"><User className="size-2.5" />{a.author}</span>
                    <Badge variant="outline" className="text-[9px]">{a.target}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
