"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, FileUp, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"

interface LegacyStudent {
  id: string
  originalId: string
  name: string
  fatherName: string
  branch: string
  phone: string
  currentCourses: string
  previousCourse: string
  enrollmentTime: string | null
  convertedStudentId: string | null
}

interface LegacyStudentsResponse {
  rows?: LegacyStudent[]
  totalCount?: number
  error?: string
  code?: string
}

const ROWS_PER_PAGE = 10

function sanitizeSearch(value: string) {
  return value.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s@._+-]/gu, "")
}

function formatEnrollmentTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })
}

export function LegacyStudentsTable() {
  const { toast } = useToast()
  const [students, setStudents] = useState<LegacyStudent[]>([])
  const [search, setSearch] = useState("")
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState<"previous" | "next" | null>(null)
  const [importing, setImporting] = useState(false)
  const [loadError, setLoadError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE)

  const fetchStudents = useCallback(async (page: number, term: string) => {
    const activeRequest = ++requestId.current
    setLoading(true)
    setLoadError("")

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        setLoadError("Your admin session has expired. Please sign in again.")
        setLoading(false)
        if (activeRequest === requestId.current) setPageLoading(null)
        return false
      }

      const params = new URLSearchParams({
        page: String(page),
        search: sanitizeSearch(term),
      })
      const response = await fetch(`/api/admin/students/import-legacy?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = (await response.json()) as LegacyStudentsResponse
      if (!response.ok) {
        console.error("Error fetching legacy students:", result.code ?? "request failed", result.error)
        if (activeRequest === requestId.current) {
          setLoadError(result.error ?? "Could not load imported students.")
          setLoading(false)
          setPageLoading(null)
        }
        return false
      }
      if (activeRequest !== requestId.current) return true

      setStudents(result.rows ?? [])
      setTotalCount(result.totalCount ?? 0)
      setLoading(false)
      setPageLoading(null)
      return true
    } catch (error) {
      if (activeRequest === requestId.current) {
        console.error("Error fetching legacy students:", error instanceof Error ? error.message : error)
        setLoadError("Could not load imported students. Please check your connection and try again.")
        setLoading(false)
        setPageLoading(null)
      }
      return false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchStudents(currentPage, search)
    }, 250)
    return () => clearTimeout(timer)
  }, [currentPage, fetchStudents, search])

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setImporting(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const formData = new FormData()
      formData.set("file", file)
      const response = await fetch("/api/admin/students/import-legacy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const result = (await response.json()) as { error?: string; imported?: number }

      if (!response.ok) {
        toast(result.error ?? "Could not import the CSV.", { variant: "destructive" })
        return
      }

      toast(`${result.imported ?? 0} legacy student rows converted.`, { variant: "success" })
      await fetchStudents(currentPage, search)
    } catch (error) {
      console.error("Legacy student CSV import failed:", error)
      toast("Could not import the CSV. Please try again.", { variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Imported students
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
            </CardTitle>
            <CardDescription>
              {totalCount.toLocaleString()} converted CSV students. Imported profiles remain available here and in their
              {" "}student routes; staging rows are removed after successful conversion. Fees, payments, and logins
              {" "}stay empty until an admin configures them.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search imported students"
                placeholder="Search name, phone, source ID..."
                value={search}
                onChange={(event) => {
                  setPageLoading(null)
                  setSearch(event.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-8 sm:w-72"
              />
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Choose a student CSV file"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
              {importing ? "Importing..." : "Import CSV"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadError && (
          <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {loadError}
          </div>
        )}
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[12%] md:w-[10%] lg:w-[8%] xl:w-[6%]" />
            <col className="w-[32%] md:w-[23%] lg:w-[15%] xl:w-[12%]" />
            <col className="hidden md:table-column md:w-[23%] lg:w-[15%] xl:w-[12%]" />
            <col className="hidden lg:table-column lg:w-[12%] xl:w-[10%]" />
            <col className="w-[28%] md:w-[18%] lg:w-[13%] xl:w-[10%]" />
            <col className="hidden xl:table-column xl:w-[16%]" />
            <col className="hidden xl:table-column xl:w-[16%]" />
            <col className="hidden lg:table-column lg:w-[17%] xl:w-[10%]" />
            <col className="w-[28%] md:w-[26%] lg:w-[20%] xl:w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Source ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Father / Guardian</TableHead>
              <TableHead className="hidden lg:table-cell">Branch</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="hidden xl:table-cell">Active course(s)</TableHead>
              <TableHead className="hidden xl:table-cell">Previous course (CSV)</TableHead>
              <TableHead className="hidden lg:table-cell">Enrollment time</TableHead>
              <TableHead>Student record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:leading-6">
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-mono text-xs">{student.originalId}</TableCell>
                <TableCell className="overflow-hidden font-medium">
                  <span className="line-clamp-2">{student.name}</span>
                </TableCell>
                <TableCell className="hidden overflow-hidden md:table-cell">
                  <span className="line-clamp-2">{student.fatherName || "—"}</span>
                </TableCell>
                <TableCell className="hidden overflow-hidden lg:table-cell">
                  <span className="line-clamp-2">{student.branch || "—"}</span>
                </TableCell>
                <TableCell className="overflow-hidden">
                  <span className="line-clamp-2">{student.phone || "—"}</span>
                </TableCell>
                <TableCell className="hidden overflow-hidden xl:table-cell">
                  <span className="line-clamp-2">{student.currentCourses || "—"}</span>
                </TableCell>
                <TableCell className="hidden overflow-hidden xl:table-cell">
                  <span className="line-clamp-2">{student.previousCourse || "—"}</span>
                </TableCell>
                <TableCell className="hidden overflow-hidden lg:table-cell">
                  <span className="line-clamp-2">{formatEnrollmentTime(student.enrollmentTime)}</span>
                </TableCell>
                <TableCell>
                  {student.convertedStudentId ? (
                    <Link
                      href={`/admin/student/${student.convertedStudentId}/profile`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unavailable</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && students.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {loadError ? "Legacy students are unavailable." : "No imported students match your search."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages || 1}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPageLoading("previous")
              setCurrentPage((page) => Math.max(1, page - 1))
            }}
            disabled={currentPage === 1 || loading || pageLoading !== null}
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
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }}
            disabled={currentPage >= totalPages || totalPages === 0 || loading || pageLoading !== null}
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
