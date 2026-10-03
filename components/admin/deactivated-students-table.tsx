"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"

interface DeactivatedStudent {
  id: string
  full_name: string
  email: string | null
  phone: string
  course_slug: string | null
  branch_id: string | null
  enrollment_date: string | null
}

const PAGE_SIZE = 10

function sanitizeSearch(value: string) {
  return value.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
}

export function DeactivatedStudentsTable() {
  const { toast } = useToast()
  const [students, setStudents] = useState<DeactivatedStudent[]>([])
  const [branchNames, setBranchNames] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState<"previous" | "next" | null>(null)
  const [loadError, setLoadError] = useState("")
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const requestId = useRef(0)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const fetchStudents = useCallback(async (currentPage: number, searchTerm: string) => {
    const activeRequest = ++requestId.current
    setLoading(true)
    setLoadError("")

    let query = supabase
      .from("students")
      .select("id, full_name, email, phone, course_slug, branch_id, enrollment_date", { count: "exact" })
      .eq("status", "Inactive")
      .order("full_name", { ascending: true })

    const safeSearch = sanitizeSearch(searchTerm)
    if (safeSearch) {
      query = query.or(
        `id.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`
      )
    }

    const { data, error, count } = await query.range(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE - 1
    )

    if (error) {
      console.error("[deactivated students] profile lookup failed:", error.message)
      if (activeRequest === requestId.current) {
        setLoadError("Could not load deactivated student profiles.")
        setStudents([])
        setLoading(false)
        setPageLoading(null)
      }
      return
    }

    if (activeRequest !== requestId.current) return

    const branchIds = [...new Set((data ?? []).map((student) => student.branch_id).filter(Boolean))] as string[]
    const { data: branches, error: branchError } = branchIds.length
      ? await supabase.from("branches").select("id, name").in("id", branchIds)
      : { data: [], error: null }

    if (branchError) {
      console.error("[deactivated students] branch lookup failed:", branchError.message)
      setLoadError("Student profiles loaded, but branch details could not be loaded.")
    }
    if (activeRequest !== requestId.current) return

    setStudents(data ?? [])
    setTotalCount(count ?? 0)
    setBranchNames(Object.fromEntries((branches ?? []).map((branch) => [branch.id, branch.name])))
    setLoading(false)
    setPageLoading(null)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchStudents(page, search)
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchStudents, page, search])

  async function activateStudent(student: DeactivatedStudent) {
    if (activatingId) return
    setActivatingId(student.id)

    const { data, error } = await supabase
      .from("students")
      .update({ status: "Active" })
      .eq("id", student.id)
      .eq("status", "Inactive")
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[deactivated students] activation failed:", error.message)
      toast("Could not activate this student. Please try again.", { variant: "destructive" })
      setActivatingId(null)
      return
    }
    if (!data) {
      toast("This student is no longer deactivated. Refresh the list and try again.", { variant: "destructive" })
      setActivatingId(null)
      await fetchStudents(page, search)
      return
    }

    toast(`${student.full_name} activated. Their existing student data is available again.`, { variant: "success" })
    setActivatingId(null)
    await fetchStudents(page, search)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Deactivated students
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
            </CardTitle>
            <CardDescription>
              {totalCount.toLocaleString()} inactive profiles. Only profile details are loaded until activation;
              fees, payments, and certificates remain untouched.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search deactivated students"
              placeholder="Search name, phone, email, ID..."
              value={search}
              onChange={(event) => {
                setPageLoading(null)
                setSearch(event.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadError && (
          <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {loadError}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Phone</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Course</TableHead>
              <TableHead className="hidden lg:table-cell">Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/admin/student/${student.id}/profile`} className="hover:underline">
                    {student.id}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/admin/student/${student.id}/profile`} className="hover:underline">
                    {student.full_name}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{student.phone || "—"}</TableCell>
                <TableCell className="hidden max-w-48 truncate md:table-cell">{student.email || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{student.course_slug || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {student.branch_id ? branchNames[student.branch_id] ?? student.branch_id : "—"}
                </TableCell>
                <TableCell><Badge variant="destructive">Deactivated</Badge></TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={() => void activateStudent(student)}
                    disabled={activatingId !== null}
                  >
                    {activatingId === student.id
                      ? <Loader2 className="mr-2 size-4 animate-spin" />
                      : <CheckCircle2 className="mr-2 size-4" />}
                    Activate
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && students.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {loadError ? "Deactivated student profiles are unavailable." : "No deactivated students found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page} of {totalPages || 1}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPageLoading("previous")
              setPage((current) => Math.max(1, current - 1))
            }}
            disabled={page === 1 || loading || pageLoading !== null}
          >
            <span className="inline-flex size-4 items-center justify-center" aria-hidden="true">
              {pageLoading === "previous"
                ? <Loader2 className="size-4 animate-spin" />
                : <ChevronLeft className="size-4" />}
            </span>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPageLoading("next")
              setPage((current) => Math.min(totalPages, current + 1))
            }}
            disabled={page >= totalPages || totalPages === 0 || loading || pageLoading !== null}
          >
            Next
            <span className="inline-flex size-4 items-center justify-center" aria-hidden="true">
              {pageLoading === "next"
                ? <Loader2 className="size-4 animate-spin" />
                : <ChevronRight className="size-4" />}
            </span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
