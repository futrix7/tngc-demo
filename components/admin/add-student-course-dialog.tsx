"use client"

import { useEffect, useState } from "react"
import { BookOpen, Check, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// The schedule split only. A payment is one figure, so nothing here needs a
// second set of parts to keep in step.
import { AmountSplit, MAX_SPLIT_PARTS, readAmountParts, sumAmountParts } from "@/components/shared/amount-split"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { parsePaymentAmount } from "@/lib/amount-split"

interface CourseOption {
  slug: string
  name: string
  duration: string
  fee_numeric: number
}

export function AddStudentCourseDialog({
  studentId,
  onSuccess,
  className,
}: {
  studentId: string
  onSuccess: (courseName: string) => void
  className?: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [search, setSearch] = useState("")
  const [selectedSlug, setSelectedSlug] = useState("")
  const [installmentAmounts, setInstallmentAmounts] = useState<string[]>([""])
  const [amountPaidNow, setAmountPaidNow] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
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
  const totalFee = Number(selectedCourse?.fee_numeric ?? 0)
  function validateCourse(): boolean {
    if (!selectedCourse || !Number.isFinite(totalFee) || totalFee <= 0) {
      toast("Choose a course with a valid catalog fee.", { variant: "destructive" })
      return false
    }

    const schedule = readAmountParts(installmentAmounts)
    if (schedule.error) {
      toast(schedule.error, { variant: "destructive" })
      return false
    }

    if (schedule.amounts.length > 0) {
      const sum = Number(sumAmountParts(installmentAmounts).toFixed(2))
      if (Math.abs(sum - totalFee) > 0.005) {
        toast(
          `The installments must add up to ₹${totalFee.toLocaleString("en-IN")}. They add up to ₹${sum.toLocaleString("en-IN")}.`,
          { variant: "destructive" }
        )
        return false
      }
    }

    const parsedPayment = parsePaymentAmount(amountPaidNow.trim() === "" ? null : amountPaidNow)
    const paidNow = parsedPayment.amount
    if (parsedPayment.error) {
      toast(parsedPayment.error, { variant: "destructive" })
      return false
    }
    if (paidNow !== null && paidNow > totalFee) {
      toast(`The payment cannot be more than the ₹${totalFee.toLocaleString("en-IN")} course fee.`, {
        variant: "destructive",
      })
      return false
    }

    return true
  }

  async function addCourse() {
    if (!selectedCourse || saving || !validateCourse()) return
    const schedule = readAmountParts(installmentAmounts)
    const paidNow = parsePaymentAmount(amountPaidNow.trim() === "" ? null : amountPaidNow).amount

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
          installmentAmounts: schedule.amounts.length > 0 ? schedule.amounts : null,
          paymentAmount: paidNow,
          paymentMethod,
          paymentReference,
        }),
      })
      const result = await response.json().catch(() => ({})) as {
        error?: string
        courseAdded?: boolean
      }
      if (!response.ok) {
        if (result.courseAdded) {
          toast(result.error ?? "The course was added, but check Installments before collecting again.", {
            variant: "destructive",
            duration: 10000,
          })
          setOpen(false)
          setSelectedSlug("")
          setAmountPaidNow("")
          setPaymentReference("")
          setPaymentMethod("cash")
          setInstallmentAmounts([""])
          onSuccess(selectedCourse.name)
          return
        }
        toast(result.error ?? "Unable to add course", { variant: "destructive" })
        return
      }

      toast(
        paidNow === null
          ? `${selectedCourse.name} added. Record payments from the Installments page.`
          : `${selectedCourse.name} added and ₹${paidNow.toLocaleString("en-IN")} payment recorded.`,
        { variant: "success" }
      )
      setOpen(false)
      setSelectedSlug("")
      setAmountPaidNow("")
      setPaymentReference("")
      setPaymentMethod("cash")
      setInstallmentAmounts([""])
      onSuccess(selectedCourse.name)
    } catch {
      toast("Unable to add course. Please try again.", { variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className={`gap-2 ${className ?? ""}`} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Course
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[95dvh] max-h-[95dvh] flex-col gap-4 overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Add a course</DialogTitle>
            <DialogDescription>
              The course total comes from the catalog and cannot be changed here. Enter an amount only if you are collecting payment now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search courses"
                placeholder="Search by course name or code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-2">
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
                    setInstallmentAmounts([""])
                    setAmountPaidNow("")
                    setPaymentMethod("cash")
                    setPaymentReference("")
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
          </div>
          <DialogFooter className="mt-auto max-h-[60dvh] min-h-0 w-full shrink-0 flex-col gap-0 overflow-hidden p-3 sm:flex-col sm:justify-start">
            <div className="min-h-0 w-full flex-1 space-y-3 overflow-y-auto overscroll-contain px-1">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Course total (catalog fee)</p>
                <p className="mt-1 text-lg font-semibold">
                  {selectedCourse ? `₹${totalFee.toLocaleString("en-IN")}` : "Choose a course"}
                </p>
              </div>
              {selectedCourse && (
                <AmountSplit
                  compact
                  values={installmentAmounts}
                  onChange={setInstallmentAmounts}
                  label="Installments"
                  target={totalFee || null}
                  partLabels={Array.from({ length: Math.max(installmentAmounts.length, 1) }, (_, i) => `Installment ${i + 1}`)}
                  hint={`Up to ${MAX_SPLIT_PARTS}, in your own amounts. Blank keeps the fee as one line — nothing is divided for you.`}
                />
              )}
              <div className="space-y-2">
                <Label htmlFor="student-course-paid-now">Amount paid now (optional)</Label>
                <Input
                  id="student-course-paid-now"
                  type="number"
                  min="1"
                  max={totalFee || undefined}
                  step="1"
                  inputMode="numeric"
                  value={amountPaidNow}
                  onChange={(event) => setAmountPaidNow(event.target.value)}
                  placeholder="Leave blank if collecting later"
                  disabled={!selectedCourse}
                />
              </div>
              {amountPaidNow.trim() !== "" && Number(amountPaidNow) > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-course-payment-method">Payment method</Label>
                    <select
                      id="student-course-payment-method"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-course-payment-reference">Reference / note</Label>
                    <Input
                      id="student-course-payment-reference"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      placeholder="Optional receipt or note"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 mt-2 w-full shrink-0 border-t bg-muted/95 pt-3 backdrop-blur">
              <Button className="w-full" onClick={addCourse} disabled={!selectedCourse || saving}>
                {saving ? "Adding course..." : "Add course"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
