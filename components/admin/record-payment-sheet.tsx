"use client"

import { useEffect, useState } from "react"
import { IndianRupee } from "lucide-react"
import { FormSheet, FormField } from "@/components/admin/form-sheet"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"

interface RecordPaymentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface StudentOption {
  id: string
  full_name: string
  course_slug?: string | null
  branch_id?: string | null
}

const PAYMENT_METHODS = ["UPI", "Cash", "Card", "Net Banking", "Cheque"]

export function RecordPaymentSheet({ open, onOpenChange, onSuccess }: RecordPaymentSheetProps) {
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentOption[]>([])
  const [courses, setCourses] = useState<{ slug: string; name: string }[]>([])
  const [studentId, setStudentId] = useState("")
  const [courseSlug, setCourseSlug] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("UPI")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState("Paid")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function loadData() {
      const [studentRes, courseRes] = await Promise.all([
        supabase.from("students").select("id, full_name, course_slug, branch_id").order("full_name"),
        supabase.from("courses").select("slug, name"),
      ])
      if (studentRes.data) setStudents(studentRes.data)
      if (courseRes.data) setCourses(courseRes.data)
      setAmount("")
      setMethod("UPI")
      setPaymentDate(new Date().toISOString().split("T")[0])
      setStatus("Paid")
      setDescription("")
      setStudentId("")
      setCourseSlug("")
    }
    loadData()
  }, [open])

  function handleStudentChange(id: string) {
    setStudentId(id)
    const student = students.find((s) => s.id === id)
    if (student?.course_slug) {
      setCourseSlug(student.course_slug)
    }
  }

  async function handleSubmit() {
    if (!studentId) {
      toast("Please select a student", { variant: "destructive" })
      return
    }
    const numericAmount = Number(amount)
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      toast("Please enter a valid amount", { variant: "destructive" })
      return
    }

    setSaving(true)
    const selected = students.find((s) => s.id === studentId)

    // crypto.randomUUID rather than Date.now(): two payments saved in the same
    // millisecond would mint the same primary key, and a duplicate-key error is
    // a hard failure that loses the entry the admin just typed in.
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()

    const { error } = await supabase.from("payments").insert({
      id: `PAY-${new Date().getFullYear()}-${token}`,
      student_id: studentId,
      student_name: selected?.full_name ?? "",
      course_slug: courseSlug || null,
      amount: numericAmount,
      payment_date: paymentDate,
      method,
      status,
      receipt_no: `RCT-${token}`,
      description: description.trim() || null,
      // The finance dashboard groups revenue by branch, so a payment recorded
      // without one disappears from that breakdown. Taken from the student
      // rather than typed, so it cannot be misattributed.
      branch_id: selected?.branch_id ?? null,
    })
    setSaving(false)

    if (error) {
      toast("Failed to record payment: " + error.message, { variant: "destructive" })
      return
    }

    toast("Payment recorded successfully", { variant: "success" })
    onOpenChange(false)
    onSuccess()
  }

  function courseName() {
    return courses.find((c) => c.slug === courseSlug)?.name ?? (courseSlug || "")
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record Payment"
      icon={IndianRupee}
      submitLabel={saving ? "Saving..." : "Record Payment"}
      onSubmit={handleSubmit}
    >
      <FormField label="Student" htmlFor="studentId">
        <Select value={studentId} onValueChange={(v) => handleStudentChange(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Course">
        <Input value={courseName()} readOnly placeholder="Auto-filled from student" />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount (₹)" htmlFor="amount">
          <Input
            id="amount"
            type="number"
            min="0"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Method">
          <Select value={method} onValueChange={(v) => setMethod(v ?? "UPI")}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Payment Date" htmlFor="paymentDate">
          <Input
            id="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </FormField>
        <FormField label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v ?? "Paid")}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          placeholder="Enter the note (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </FormField>
    </FormSheet>
  )
}