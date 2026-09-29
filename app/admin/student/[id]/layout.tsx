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
import { ArrowLeft, Mail, Phone, Trash2, Loader2, User, Wallet, CreditCard, Award, IndianRupee } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { AddStudentCourseDialog } from "@/components/admin/add-student-course-dialog"

interface StudentData {
  name: string
  id: string
  email: string | null
  phone: string
  course: string
  branch: string
  status: "Active" | "Inactive" | "Pending"
}

const StudentContext = createContext<StudentData | null>(null)

export function useStudent() {
  return useContext(StudentContext)
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Pending: "secondary",
  Inactive: "destructive",
}

const navLinks = [
  { label: "Profile", href: "profile", icon: User },
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

  useEffect(() => {
    async function fetchStudent() {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, email, phone, course_slug, branch_id, status")
        .eq("id", id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const { data: feeRows } = await supabase
        .from("fees")
        .select("course_slug")
        .eq("student_id", id)
      const courseSlugs = [...new Set([
        ...(feeRows ?? []).map((fee) => fee.course_slug),
        data.course_slug,
      ].filter((slug): slug is string => Boolean(slug)))]
      let courseName = courseSlugs.join(", ")
      let branchName = data.branch_id ?? ""

      if (courseSlugs.length > 0) {
        const { data: courseData } = await supabase
          .from("courses").select("slug, name").in("slug", courseSlugs)
        if (courseData?.length) courseName = courseSlugs
          .map((slug) => courseData.find((course) => course.slug === slug)?.name ?? slug)
          .join(", ")
      }
      if (data.branch_id) {
        const { data: branchData } = await supabase
          .from("branches").select("name").eq("id", data.branch_id).single()
        if (branchData) branchName = branchData.name
      }

      setStudent({
        name: data.full_name,
        id: data.id,
        email: data.email,
        phone: data.phone,
        course: courseName,
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

  async function handleDelete() {
    if (!deleteEnabled) return
    setDeleting(true)

    const { data: feeRows } = await supabase.from("fees").select("id").eq("student_id", id)
    const feeIds = feeRows?.map((f) => f.id) ?? []

    if (feeIds.length > 0) {
      await supabase.from("fee_installments").delete().in("fee_id", feeIds)
    }
    await supabase.from("fees").delete().eq("student_id", id)
    await supabase.from("payments").delete().eq("student_id", id)
    await supabase.from("certificates").delete().eq("student_id", id)
    await supabase.from("students").delete().eq("id", id)

    toast("Student deleted successfully", { variant: "success" })
    setDeleting(false)
    setDeleteOpen(false)
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

  return (
    <StudentContext.Provider value={student}>
      <div className="space-y-4">
        <Link href="/admin/student" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Students
        </Link>

        {/* Profile Header */}
        <Card className="overflow-hidden">
          <div className="h-20 sm:h-28 bg-gradient-to-br from-primary/20 to-primary/5" />
          <CardContent className="relative px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 -mt-9 sm:-mt-10">
              <div className="relative self-center sm:self-auto">
                <div className="flex size-18 sm:size-20 items-center justify-center rounded-full border-4 border-background bg-muted text-xl sm:text-2xl font-bold" style={{ width: "5rem", height: "5rem" }}>
                  {student.name.split(" ").map((n) => n[0]).join("")}
                </div>
              </div>
              <div className="flex-1 text-center sm:text-left pb-1">
                <h1 className="text-lg sm:text-xl font-bold">{student.name}</h1>
                <p className="text-xs text-muted-foreground">{student.id}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="size-3" />{student.email || "No email on file"}</span>
                  <span className="flex items-center gap-1"><Phone className="size-3" />{student.phone}</span>
                </div>
              </div>
              <div className="flex gap-2 self-center sm:self-auto flex-wrap justify-center">
                <Badge variant="secondary" className="text-[11px] sm:text-xs">{student.course}</Badge>
                <Badge variant="secondary" className="text-[11px] sm:text-xs">{student.branch}</Badge>
                <Badge variant={statusVariant[student.status]} className="text-[11px] sm:text-xs">{student.status}</Badge>
                <Button variant="outline" size="sm" onClick={handleStatusToggle} disabled={changingStatus}>
                  {changingStatus ? "Updating..." : student.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
                <AddStudentCourseDialog
                  studentId={student.id}
                  onSuccess={(courseName) => setStudent((current) => current ? {
                    ...current,
                    course: [...new Set([...current.course.split(", ").filter(Boolean), courseName])].join(", "),
                  } : current)}
                />
                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2 px-4"
                  onClick={() => { setDeleteName(""); setDeleteConfirm(""); setDeleteOpen(true) }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {navLinks.map((link) => {
            const isActive = pathname === `${basePath}/${link.href}`
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={`${basePath}/${link.href}`}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
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
        </div>

        {/* Page Content */}
        <div>{children}</div>

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
    </StudentContext.Provider>
  )
}
