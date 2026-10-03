"use client"

import { use, useState, useEffect, createContext, useContext } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Mail, Phone, Trash2, Loader2, User, Wallet, CreditCard, Award, IndianRupee, KeyRound, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { AddStudentCourseDialog } from "@/components/admin/add-student-course-dialog"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"

interface StudentData {
  name: string
  id: string
  email: string | null
  phone: string
  course: string
  courses: string[]
  previousCourse: string | null
  isLegacyImport: boolean
  branch: string
  status: "Active" | "Inactive" | "Pending" | null
}

const StudentContext = createContext<StudentData | null>(null)
const RemoveStudentCourseContext = createContext<((courseName: string) => void) | null>(null)

export function useStudent() {
  return useContext(StudentContext)
}

export function useRemoveStudentCourse() {
  const removeCourse = useContext(RemoveStudentCourseContext)
  if (!removeCourse) {
    throw new Error("useRemoveStudentCourse must be used within the student admin layout.")
  }
  return removeCourse
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Pending: "secondary",
  Inactive: "destructive",
}

const navLinks = [
  { label: "Profile", href: "profile", icon: User },
  { label: "Courses", href: "courses", icon: BookOpen },
  { label: "Fee", href: "fee", icon: Wallet },
  { label: "Installments", href: "installments", icon: IndianRupee },
  { label: "Payments", href: "payments", icon: CreditCard },
  { label: "Certificates", href: "certificates", icon: Award },
]

export default function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [student, setStudent] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  // The administrator is typing a password they will read aloud to the student
  // over the counter, so they need to check they typed it right before saving.
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)

  useEffect(() => {
    async function fetchStudent() {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, email, phone, course_slug, legacy_course_label, is_legacy_import, branch_id, status")
        .eq("id", id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const feeRows = data.status === "Inactive"
        ? []
        : (await supabase
          .from("fees")
          .select("course_slug")
          .eq("student_id", id)).data ?? []
      const courseSlugs = [...new Set([
        ...feeRows.map((fee) => fee.course_slug),
        ...(!data.is_legacy_import ? [data.course_slug] : []),
      ].filter((slug): slug is string => Boolean(slug)))]
      const courseNames: string[] = []
      let branchName = data.branch_id ?? ""

      if (courseSlugs.length > 0) {
        const { data: courseData } = await supabase
          .from("courses").select("slug, name").in("slug", courseSlugs)
        courseNames.push(...courseSlugs.map(
          (slug) => courseData?.find((course) => course.slug === slug)?.name ?? slug
        ))
      }
      if (data.branch_id) {
        const { data: branchData } = await supabase
          .from("branches").select("name").eq("id", data.branch_id).single()
        if (branchData) branchName = branchData.name
      }

      const courses = [...new Set(courseNames)]
      setStudent({
        name: data.full_name,
        id: data.id,
        email: data.email,
        phone: data.phone,
        course: courses.join(", "),
        courses,
        previousCourse: data.legacy_course_label,
        isLegacyImport: data.is_legacy_import,
        branch: branchName,
        status: data.status as StudentData["status"],
      })
      setLoading(false)
    }
    fetchStudent()
  }, [id])

  const deleteEnabled = student && deleteName === student.name && deleteConfirm === "DELETE"

  async function handleStatusToggle() {
    if (!student || changingStatus) return
    const nextStatus = student.status === "Active" ? "Inactive" : "Active"
    setChangingStatus(true)

    const { error } = await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("id", student.id)

    if (error) {
      toast("Unable to update student status: " + error.message, { variant: "destructive" })
    } else {
      setStudent((current) => current ? { ...current, status: nextStatus } : current)
      toast(`${student.name} marked ${nextStatus.toLowerCase()}`, { variant: "success" })
    }
    setChangingStatus(false)
  }

  async function handleSetPassword() {
    if (settingPassword || newPassword.length < 6) return
    setSettingPassword(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: id, password: newPassword }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        toast(result.error ?? "Could not update the password", { variant: "destructive" })
        return
      }

      toast(`Login password set for ${student?.name ?? "this student"}`, { variant: "success" })
      setNewPassword("")
      setPasswordOpen(false)
    } catch {
      toast("Could not update the password. Please try again.", { variant: "destructive" })
    } finally {
      setSettingPassword(false)
    }
  }

  /**
   * Deletes a student and everything attached to them.
   *
   * This ran entirely in the browser with the anon key, which is why deleting a
   * student never really worked. RLS scopes `payments`, `fees` and `certificates`
   * to a student's own row, so those deletes came back as permission errors — and
   * the handler discarded every one of them and reported "Student deleted
   * successfully" anyway, leaving a student with no fees and no payments still on
   * file. It also never removed the Supabase auth account, so the student kept a
   * working login after their record was gone.
   *
   * The whole thing now runs server-side, where the service role is not subject to
   * those policies, and the login is removed with the rest of it.
   */
  async function handleDelete() {
    if (!deleteEnabled || deleting) return
    setDeleting(true)

    let accountRemoved: boolean | undefined

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: id }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        accountRemoved?: boolean
      }

      if (!response.ok) {
        toast(result.error ?? "Could not delete this student. Nothing was changed.", {
          variant: "destructive",
          duration: 15000,
        })
        return
      }

      accountRemoved = result.accountRemoved
    } catch {
      toast("Could not delete this student. Nothing was changed — please try again.", {
        variant: "destructive",
        duration: 10000,
      })
      return
    } finally {
      // Always, so a failure leaves the dialog usable rather than stuck reading
      // "Deleting..." with nothing in flight.
      setDeleting(false)
    }

    setDeleteOpen(false)

    if (accountRemoved === false) {
      // The student is off the books; the login is not. A different problem, and
      // worth saying plainly rather than reporting a clean success.
      toast(
        "The student was deleted, but their login could not be removed. Ask whoever administers the database to remove the account.",
        { variant: "destructive", duration: 15000 }
      )
    } else {
      toast("Student deleted successfully", { variant: "success" })
    }

    // Client-side navigation rather than a full page load: the deleted route
    // must not be re-fetched from the router cache on the way out.
    router.replace("/admin/student")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !student) {
    return (
      <div className="space-y-4">
        <Link href="/admin/student" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Students
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Student not found</p>
            <p className="text-sm text-muted-foreground mt-1">No student found with ID: {id}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const basePath = `/admin/student/${id}`
  const removeStudentCourse = (courseName: string) => {
    setStudent((current) => {
      if (!current) return current
      const courses = current.courses.filter((course) => course !== courseName)
      return { ...current, courses, course: courses.join(", ") }
    })
  }

  if (student.status === "Inactive") {
    return (
      <StudentContext.Provider value={student}>
        <RemoveStudentCourseContext.Provider value={removeStudentCourse}>
        <div className="mx-auto w-full max-w-7xl space-y-4 px-1 sm:px-0">
          <Link href="/admin/student" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to Students
          </Link>
          <Card>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary sm:size-16 sm:text-lg">
                    {student.name.split(" ").map((part) => part[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="break-words text-lg font-bold leading-tight sm:text-xl">{student.name}</h1>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{student.id}</p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span className="inline-flex min-w-0 items-start gap-2 break-all">
                        <Mail className="mt-0.5 size-3.5 shrink-0" />
                        {student.email || "No email on file"}
                      </span>
                      <span className="inline-flex min-w-0 items-start gap-2 break-all">
                        <Phone className="size-3.5 shrink-0" />
                        {student.phone || "No phone on file"}
                      </span>
                    </div>
                  </div>
                </div>
                <Button className="w-full shrink-0 sm:w-auto" onClick={handleStatusToggle} disabled={changingStatus}>
                  {changingStatus && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {changingStatus ? "Activating..." : "Activate student"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Badge variant="destructive">Deactivated</Badge>
                <Badge variant="outline">{student.branch || "No branch on file"}</Badge>
                {student.courses.length > 0
                  ? student.courses.map((course) => (
                    <span key={course} className="max-w-full rounded-md bg-secondary px-2.5 py-1 text-xs leading-snug text-secondary-foreground [overflow-wrap:anywhere]">
                      {course}
                    </span>
                  ))
                  : <Badge variant="secondary">No course on file</Badge>}
                {student.previousCourse && (
                  <Badge variant="outline" className="max-w-full whitespace-normal text-left [overflow-wrap:anywhere]">
                    Previous course (CSV): {student.previousCourse}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Other student records are kept unchanged and are not loaded while this student is deactivated.
                Activate the student to restore access to their normal profile, fee, payment, and certificate pages.
              </p>
            </CardContent>
          </Card>
        </div>
        </RemoveStudentCourseContext.Provider>
      </StudentContext.Provider>
    )
  }

  return (
    <StudentContext.Provider value={student}>
      <RemoveStudentCourseContext.Provider value={removeStudentCourse}>
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-1 sm:px-0">
        <Link href="/admin/student" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Students
        </Link>

        <Card>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary sm:size-16 sm:text-xl">
                  {student.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-lg font-bold leading-tight sm:text-2xl">{student.name}</h1>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{student.id}</p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 sm:text-sm">
                    <span className="inline-flex min-w-0 items-start gap-2 break-all">
                      <Mail className="mt-0.5 size-3.5 shrink-0" />
                      {student.email || "No email on file"}
                    </span>
                    <span className="inline-flex min-w-0 items-start gap-2 break-all">
                      <Phone className="size-3.5 shrink-0" />
                      {student.phone || "No phone on file"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleStatusToggle}
                  disabled={changingStatus}
                >
                  {changingStatus && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {changingStatus ? "Updating..." : student.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
                <div className="col-span-2 sm:col-span-1">
                  <AddStudentCourseDialog
                    studentId={student.id}
                    className="w-full sm:w-auto"
                    onSuccess={(courseName) => setStudent((current) => current ? {
                      ...current,
                      course: [...new Set([...current.courses, courseName])].join(", "),
                      courses: [...new Set([...current.courses, courseName])],
                    } : current)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => { setNewPassword(""); setPasswordOpen(true) }}
                >
                  <KeyRound className="size-4" />
                  Set Password
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => { setDeleteName(""); setDeleteConfirm(""); setDeleteOpen(true) }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t pt-4">
              <Badge variant="outline">{student.branch || "No branch on file"}</Badge>
              <Badge variant={student.status ? statusVariant[student.status] : "outline"}>
                {student.status ?? "Not set"}
              </Badge>
              {student.courses.length > 0
                ? student.courses.map((course) => (
                  <span key={course} className="max-w-full rounded-md bg-secondary px-2.5 py-1 text-xs leading-snug text-secondary-foreground [overflow-wrap:anywhere]">
                    {course}
                  </span>
                ))
                : <Badge variant="secondary">No course on file</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <nav aria-label="Student sections" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {navLinks.map((link) => {
            const isActive = pathname === `${basePath}/${link.href}`
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={`${basePath}/${link.href}`}
                className={cn(
                  "flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:flex-1 sm:justify-start sm:px-4 sm:text-sm lg:flex-none",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Page Content */}
        <div className="min-w-0">{children}</div>

        {/* Login Password Dialog */}
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="size-5" />
                Set Login Password
              </DialogTitle>
              <DialogDescription className="text-sm">
                <span className="font-semibold text-foreground">{student.name}</span> signs in with
                phone number <span className="font-semibold text-foreground">{student.phone || "not set"}</span> and
                this password. Saving creates a login if one does not exist; changing it signs the student out of any active sessions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="studentPassword" className="text-sm font-semibold">
                New password (at least 6 characters)
              </Label>
              <div className="relative">
                <Input
                  id="studentPassword"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 pr-11"
                />
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  label="password"
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                size="lg"
                className="px-6"
                onClick={() => setPasswordOpen(false)}
                disabled={settingPassword}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                className="gap-2 px-6"
                onClick={handleSetPassword}
                disabled={newPassword.length < 6 || settingPassword}
              >
                {settingPassword ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {settingPassword ? "Saving..." : "Save Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive text-lg">
                <Trash2 className="size-6" />
                Delete Student
              </DialogTitle>
              <DialogDescription className="text-sm">
                This action cannot be undone. This will permanently delete <span className="font-semibold text-foreground">{student.name}</span>&apos;s record and all associated data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="deleteName" className="text-sm font-semibold">
                  Type the student name: <span className="text-foreground">{student.name}</span>
                </Label>
                <Input
                  id="deleteName"
                  placeholder={student.name}
                  value={deleteName}
                  onChange={(e) => setDeleteName(e.target.value)}
                  className={cn("h-11", deleteName && !deleteEnabled && "border-red-500")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deleteConfirm" className="text-sm font-semibold">
                  Type <span className="text-foreground">DELETE</span> to confirm
                </Label>
                <Input
                  id="deleteConfirm"
                  placeholder="DELETE"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className={cn("h-11", deleteConfirm && !deleteEnabled && "border-red-500")}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="lg" onClick={() => setDeleteOpen(false)} disabled={deleting} className="px-6">
                Cancel
              </Button>
              <Button variant="destructive" size="lg" onClick={handleDelete} disabled={!deleteEnabled || deleting} className="gap-2 px-6">
                {deleting ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
                {deleting ? "Deleting..." : "Delete Student"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </RemoveStudentCourseContext.Provider>
    </StudentContext.Provider>
  )
}
