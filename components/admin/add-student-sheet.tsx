"use client"

import { useEffect, useState } from "react"
import { BookOpen, Check, ChevronDown, Search, UserPlus } from "lucide-react"
import { FormSheet, FormField } from "@/components/admin/form-sheet"
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
  const [paidAmount, setPaidAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentReference, setPaymentReference] = useState("")
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
    setPaidAmount("")
    setPaymentMethod("cash")
    setPaymentReference("")
    setCourseSearch("")
  }

  async function handleSubmit() {
    if (!fullName.trim() || !phone.trim() || !fatherName.trim() || !course || !totalFee) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    const amountPaid = Number(paidAmount || 0)
    if (amountPaid < 0 || amountPaid > Number(totalFee)) {
      toast("Payment amount must be between 0 and the total course fee.", { variant: "destructive" })
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
          totalFee: Number(totalFee),
          paidAmount: amountPaid > 0 ? amountPaid : 0,
          paymentMethod,
          paymentReference,
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
  const paidValue = Number(paidAmount || 0)
  const remainingBalance = Math.max(totalCourseFee - paidValue, 0)

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Register Student"
      icon={UserPlus}
      submitLabel={saving ? "Registering..." : "Register Student"}
      onSubmit={handleSubmit}
      contentClassName="w-full sm:max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Full Name" htmlFor="fullName">
          <Input id="fullName" placeholder="Enter full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email (optional)" htmlFor="email">
          <Input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Phone (initial password)" htmlFor="phone">
          <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Father / Guardian Name" htmlFor="fatherName">
          <Input id="fatherName" placeholder="Enter name" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Father / Guardian Phone" htmlFor="fatherPhone">
          <Input id="fatherPhone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Course">
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          onClick={() => setCourseDialogOpen(true)}
          className="h-11 w-full justify-between px-3 font-normal"
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
                    setPaidAmount("")
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Amount Paid" htmlFor="paidAmount">
          <Input
            id="paidAmount"
            type="number"
            min="0"
            max={totalCourseFee || undefined}
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </FormField>

        <FormField label="Payment Method">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank</option>
          </select>
        </FormField>
      </div>

      <FormField label="Reference / Note" htmlFor="paymentReference">
        <Input
          id="paymentReference"
          placeholder="Optional receipt or note"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
        />
      </FormField>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={clearForm}>
          Clear form
        </Button>
      </div>
    </FormSheet>
  )
}
