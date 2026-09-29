"use client"

import { useEffect, useState } from "react"
import { BookOpen, Check, ChevronLeft, CreditCard, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface CourseOption {
  slug: string
  name: string
  duration: string
  fee_numeric: number
}

export function AddStudentCourseDialog({
  studentId,
  onSuccess,
}: {
  studentId: string
  onSuccess: (courseName: string) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [search, setSearch] = useState("")
  const [selectedSlug, setSelectedSlug] = useState("")
  const [totalFee, setTotalFee] = useState("")
  const [step, setStep] = useState<"course" | "payment">("course")
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("0")
  const [paymentMethod, setPaymentMethod] = useState("upi")
  const [paymentReference, setPaymentReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    async function loadCourses() {
      setLoading(true)
      const [coursesResult, feesResult] = await Promise.all([
        supabase.from("courses").select("slug, name, duration, fee_numeric").eq("status", "active").order("name"),
        supabase.from("fees").select("course_slug").eq("student_id", studentId),
      ])
      if (coursesResult.error || feesResult.error) {
        toast("Unable to load available courses", { variant: "destructive" })
        setLoading(false)
        return
      }
      const enrolled = new Set((feesResult.data ?? []).map((fee) => fee.course_slug).filter(Boolean))
      setCourses((coursesResult.data ?? []).filter((course) => !enrolled.has(course.slug)))
      setLoading(false)
    }

    loadCourses()
  }, [open, studentId, toast])

  const query = search.trim().toLocaleLowerCase()
  const filteredCourses = courses.filter((course) =>
    course.name.toLocaleLowerCase().includes(query) || course.slug.toLocaleLowerCase().includes(query)
  )
  const selectedCourse = courses.find((course) => course.slug === selectedSlug)
  function continueToPayment() {
    const fee = Number(totalFee)
    if (!selectedCourse || !Number.isFinite(fee) || fee <= 0) {
      toast("Choose a course and enter a total fee greater than zero", { variant: "destructive" })
      return
    }
    setStep("payment")
  }

  async function addCourse() {
    if (!selectedCourse || saving) return
    const fee = Number(totalFee)
    if (!Number.isFinite(fee) || fee <= 0) {
      toast("Enter a course fee greater than zero", { variant: "destructive" })
      return
    }
    const initialAmount = Number(initialPaymentAmount)
    const maxAmount = Number(totalFee) || 0
    if (!Number.isFinite(initialAmount) || initialAmount < 0 || initialAmount > maxAmount) {
      toast(`Initial payment must be between ₹0 and ₹${maxAmount.toLocaleString("en-IN")}.`, { variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/add-course", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId,
          courseSlug: selectedCourse.slug,
          totalFee: fee,
          initialPaymentAmount: initialAmount,
          paymentMethod,
          paymentReference,
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        toast(result.error ?? "Unable to add course", { variant: "destructive" })
        return
      }

      toast(
        initialAmount > 0
          ? `${selectedCourse.name} added; ₹${initialAmount.toLocaleString("en-IN")} recorded against the course balance.`
          : `${selectedCourse.name} added with an installment schedule of up to 3 splits.`,
        { variant: "success" }
      )
      setOpen(false)
      setStep("course")
      onSuccess(selectedCourse.name)
    } catch {
      toast("Unable to add course. Please try again.", { variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Course
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setStep("course")
      }}>
        <DialogContent className="max-h-[85dvh] gap-4 overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{step === "course" ? "Add a course" : "Record payment"}</DialogTitle>
            <DialogDescription>
              {step === "course" ? "Choose an active course and set this student&apos;s total fee." : "Record any amount up to the total course fee. The balance remains split across up to 3 installments."}
            </DialogDescription>
          </DialogHeader>
          {step === "course" ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search courses"
                  placeholder="Search by course name or code"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-[38dvh] space-y-1 overflow-y-auto pr-1">
                {loading ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading courses...</p>
                ) : filteredCourses.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">No additional courses match.</p>
                ) : filteredCourses.map((course) => (
                  <button
                    key={course.slug}
                    type="button"
                    aria-pressed={selectedSlug === course.slug}
                    onClick={() => {
                      setSelectedSlug(course.slug)
                      setTotalFee(String(course.fee_numeric || ""))
                      setInitialPaymentAmount("0")
                    }}
                    className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted aria-pressed:border-primary/30 aria-pressed:bg-primary/5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{course.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{course.slug} · {course.duration}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                      ₹{Number(course.fee_numeric || 0).toLocaleString("en-IN")}
                      {selectedSlug === course.slug && <Check className="size-4 text-primary" />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-course-fee">Custom total fee</Label>
                <Input
                  id="student-course-fee"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={totalFee}
                  onChange={(event) => setTotalFee(event.target.value)}
                  placeholder="Choose a course first"
                  disabled={!selectedCourse}
                />
              </div>
              <Button onClick={continueToPayment} disabled={!selectedCourse}>
                Continue to payment
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-medium">{selectedCourse?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total course fee: ₹{Number(totalFee).toLocaleString("en-IN")}</p>
                <p className="mt-1 text-sm text-muted-foreground">Installments: up to 3 splits, with custom amounts allowed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial-installment-payment">Amount received now</Label>
                <Input
                  id="initial-installment-payment"
                  type="number"
                  min="0"
                  max={Number(totalFee) || undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={initialPaymentAmount}
                  onChange={(event) => setInitialPaymentAmount(event.target.value)}
                />
              </div>
              {Number(initialPaymentAmount) > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="initial-payment-method">Payment method</Label>
                    <select
                      id="initial-payment-method"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank transfer</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initial-payment-reference">Payment reference (optional)</Label>
                    <Input id="initial-payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Transaction ID or receipt reference" />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => setStep("course")} disabled={saving}>
                  <ChevronLeft className="size-4" />
                  Back to course
                </Button>
                <Button onClick={addCourse} disabled={saving}>
                  {saving ? "Saving..." : <><CreditCard className="size-4" /> Add course and record payment</>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
