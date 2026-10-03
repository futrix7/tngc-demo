"use client"

import { useEffect, useState } from "react"
import { BookOpen, Check, ChevronDown, Search, UserPlus } from "lucide-react"
import { FormSheet, FormField, SHEET_INPUT_CLASS, SHEET_NATIVE_SELECT_CLASS } from "@/components/admin/form-sheet"
import { AmountSplit, MAX_SPLIT_PARTS, readAmountParts, sumAmountParts } from "@/components/shared/amount-split"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { parsePaymentAmount } from "@/lib/amount-split"

interface AddStudentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddStudentSheet({ open, onOpenChange, onSuccess }: AddStudentSheetProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [fatherName, setFatherName] = useState("")
  const [fatherPhone, setFatherPhone] = useState("")
  const [course, setCourse] = useState("")
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)
  const [courseSearch, setCourseSearch] = useState("")
  const [totalFee, setTotalFee] = useState("")
  // One split and one figure. The schedule is how the fee is divided up; what is
  // handed over on day one is a single amount, because "the student paid 2,000
  // of 5,000" is one fact and never three. Blank schedule boxes mean the whole
  // fee is a single line they can pay any part of later.
  const [installmentAmounts, setInstallmentAmounts] = useState<string[]>([""])
  const [amountPaidNow, setAmountPaidNow] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentReference, setPaymentReference] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [courses, setCourses] = useState<{ slug: string; name: string; duration: string; fee_numeric: number }[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    async function fetchOptions() {
      setCatalogLoading(true)
      try {
        const { data, error } = await supabase.from("courses").select("slug, name, duration, fee_numeric").eq("status", "active").order("name")
        if (error) {
          toast("Unable to load courses", { variant: "destructive" })
          return
        }
        setCourses(data ?? [])
      } catch {
        toast("Unable to load courses", { variant: "destructive" })
      } finally {
        setCatalogLoading(false)
      }
    }

    fetchOptions()
  }, [open, toast])

  function clearForm() {
    setFullName("")
    setEmail("")
    setPhone("")
    setFatherName("")
    setFatherPhone("")
    setCourse("")
    setTotalFee("")
    setInstallmentAmounts([""])
    setAmountPaidNow("")
    setPaymentMethod("cash")
    setPaymentReference("")
    setPassword("")
    setPasswordVisible(false)
    setCourseSearch("")
  }

  async function handleSubmit() {
    if (!fullName.trim() || !phone.trim() || !fatherName.trim() || !course || !totalFee) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    const fee = Number(totalFee)

    const schedule = readAmountParts(installmentAmounts)
    if (schedule.error) {
      toast(schedule.error, { variant: "destructive" })
      return
    }

    if (schedule.amounts.length > 0) {
      const sum = Number(sumAmountParts(installmentAmounts).toFixed(2))
      if (Math.abs(sum - fee) > 0.005) {
        toast(
          `The installments must add up to ₹${fee.toLocaleString("en-IN")}. They add up to ₹${sum.toLocaleString("en-IN")}.`,
          { variant: "destructive" }
        )
        return
      }
    }

    // A single figure for what is being handed over, and it can be any figure up
    // to the fee. There is no second set of boxes to keep in step with the
    // schedule: paying 2,000 of a 5,000 fee is one number, and the schedule is a
    // plan for when the rest arrives, not a set of instructions for this form.
    const parsedPayment = parsePaymentAmount(amountPaidNow.trim() || null)
    const amountPaid = parsedPayment.amount ?? 0
    if (parsedPayment.error) {
      toast(parsedPayment.error, { variant: "destructive" })
      return
    }
    if (amountPaid > fee) {
      toast(`The payment cannot be more than the ₹${fee.toLocaleString("en-IN")} fee.`, {
        variant: "destructive",
      })
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

      const response = await fetch("/api/admin/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          fatherName,
          fatherPhone,
          courseSlug: course,
          totalFee: fee,
          installmentAmounts: schedule.amounts.length > 0 ? schedule.amounts : null,
          paymentAmount: amountPaid > 0 ? amountPaid : null,
          paymentMethod,
          paymentReference,
          password,
        }),
      })
      const result = await response.json() as { error?: string; studentId?: string }
      if (!response.ok) {
        toast(result.error ?? "Failed to add student", { variant: "destructive" })
        return
      }

      toast(`Student account created${result.studentId ? ` (${result.studentId})` : ""}`, { variant: "success" })
      clearForm()
      onOpenChange(false)
      onSuccess()
    } catch {
      toast("Failed to add student. Please try again.", { variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const normalizedCourseSearch = courseSearch.trim().toLocaleLowerCase()
  const filteredCourses = courses.filter((item) =>
    item.name.toLocaleLowerCase().includes(normalizedCourseSearch) ||
    item.slug.toLocaleLowerCase().includes(normalizedCourseSearch)
  )

  const totalCourseFee = Number(totalFee || 0)
  const paidValue = Number(amountPaidNow.trim()) || 0
  const remainingBalance = Math.max(totalCourseFee - paidValue, 0)
  const paidOverFee = paidValue > totalCourseFee + 0.005 && totalCourseFee > 0

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Register Student"
      icon={UserPlus}
      submitLabel={saving ? "Registering..." : "Register Student"}
      onSubmit={handleSubmit}
      contentClassName="w-full data-[side=right]:sm:max-w-xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Full Name" htmlFor="fullName">
          <Input id="fullName" placeholder="Enter full name" className={SHEET_INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email (optional)" htmlFor="email">
          <Input id="email" type="email" placeholder="Enter email" className={SHEET_INPUT_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Phone (student login)" htmlFor="phone">
          <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" className={SHEET_INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Login Password" htmlFor="password">
          {/* The administrator hands this password to the student, so they have to
              be able to read back what they typed before saving it. */}
          <div className="relative">
            <Input
              id="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Leave blank to use the phone number"
              className={`${SHEET_INPUT_CLASS} pr-11`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordVisibilityToggle
              visible={passwordVisible}
              label="password"
              onToggle={() => setPasswordVisible((visible) => !visible)}
            />
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Father / Guardian Name" htmlFor="fatherName">
          <Input id="fatherName" placeholder="Enter name" className={SHEET_INPUT_CLASS} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </FormField>
        <FormField label="Father / Guardian Phone" htmlFor="fatherPhone">
          <Input id="fatherPhone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" className={SHEET_INPUT_CLASS} value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Course">
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          onClick={() => setCourseDialogOpen(true)}
          className="h-12 w-full justify-between px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate text-left">
            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{courses.find((item) => item.slug === course)?.name ?? "Choose a course"}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </FormField>

      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="max-h-[85dvh] gap-4 overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select a course</DialogTitle>
            <DialogDescription>Available active courses</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              placeholder="Search courses..."
              aria-label="Search courses"
              className="pl-10"
            />
          </div>
          <div className="min-h-0 max-h-[55dvh] space-y-1 overflow-y-auto pr-1">
            {catalogLoading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading courses...</p>
            ) : filteredCourses.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No courses match that search.</p>
            ) : (
              filteredCourses.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={course === item.slug}
                  onClick={() => {
                    setCourse(item.slug)
                    setTotalFee(item.fee_numeric ? String(item.fee_numeric) : "")
                    setInstallmentAmounts([""])
                    setAmountPaidNow("")
                    setPaymentMethod("cash")
                    setPaymentReference("")
                    setCourseSearch("")
                    setCourseDialogOpen(false)
                  }}
                  className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted aria-pressed:border-primary/30 aria-pressed:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{item.slug} · {item.duration}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                    ₹{Number(item.fee_numeric ?? 0).toLocaleString("en-IN")}
                    {course === item.slug && <Check className="size-4 text-primary" />}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Real total</span>
          <span>Balance due: ₹{remainingBalance.toLocaleString("en-IN")}</span>
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          ₹{totalCourseFee.toLocaleString("en-IN")}
        </div>
      </div>

      <AmountSplit
        values={installmentAmounts}
        onChange={setInstallmentAmounts}
        label="Installments"
        target={totalCourseFee > 0 ? totalCourseFee : null}
        partLabels={Array.from({ length: Math.max(installmentAmounts.length, 1) }, (_, i) => `Installment ${i + 1}`)}
        hint={`Your own amounts, up to ${MAX_SPLIT_PARTS}. Nothing is divided for you — leave every box blank and the whole fee becomes one line the student can pay any part of, whenever they like.`}
      />

      {/* One number, not another set of boxes. The schedule above is a plan for
          the fee; this is what is physically in the hand today. */}
      <FormField label="Amount being paid now" htmlFor="amountPaidNow">
        <div className="flex gap-2">
          <Input
            id="amountPaidNow"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            max={totalCourseFee || undefined}
            placeholder="0"
            aria-invalid={paidOverFee}
            className={paidOverFee ? `${SHEET_INPUT_CLASS} border-destructive` : SHEET_INPUT_CLASS}
            value={amountPaidNow}
            onChange={(e) => setAmountPaidNow(e.target.value)}
          />
          {totalCourseFee > 0 && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setAmountPaidNow(String(totalCourseFee))}
              disabled={totalCourseFee === paidValue}
            >
              Full fee
            </Button>
          )}
        </div>
      </FormField>

      <p className="-mt-2 text-xs text-muted-foreground">
        Any figure up to the fee, or leave it blank if nothing is being handed over yet.
        {remainingBalance > 0 && ` ₹${remainingBalance.toLocaleString("en-IN")} will still be owing.`}
      </p>

      {paidOverFee && (
        <p className="text-xs font-medium text-destructive">
          That is more than the ₹{totalCourseFee.toLocaleString("en-IN")} fee.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Payment Method">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={SHEET_NATIVE_SELECT_CLASS}
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank</option>
          </select>
        </FormField>

        <FormField label="Reference / Note" htmlFor="paymentReference">
          <Input
            id="paymentReference"
            placeholder="Optional receipt or note"
            className={SHEET_INPUT_CLASS}
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={clearForm}>
          Clear form
        </Button>
      </div>
    </FormSheet>
  )
}
