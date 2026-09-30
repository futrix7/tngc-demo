"use client"

import { useEffect, useState } from "react"
import { IndianRupee, Loader2 } from "lucide-react"
import {
  FormSheet,
  FormField,
  SHEET_INPUT_CLASS,
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
  SHEET_TEXTAREA_CLASS,
} from "@/components/admin/form-sheet"
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
import { checkAmountAgainstTotal, parseSingleAmount } from "@/lib/amount-split"
import { localDate } from "@/lib/local-date"
import { cn } from "@/lib/utils"

interface RecordPaymentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface StudentOption {
  id: string
  full_name: string
}

/** One course fee belonging to the chosen student, with what is still open on it. */
interface FeeOption {
  id: string
  courseSlug: string | null
  courseName: string
  totalFee: number
  outstanding: number
}

/**
 * The methods the ledger actually stores. `record_fee_payment_at` writes this
 * column as given, and the other screens group and filter on it, so the free-text
 * list this used to offer ("Net Banking", "Cheque", "Card") produced values that
 * appear on no other screen and match no filter.
 */
const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank transfer" },
]

/** Local calendar day, not UTC. `toISOString()` reads as yesterday in IST. */
function todayLocal(): string {
  return localDate()
}


/**
 * Records money received at the counter, against a real course fee.
 *
 * This used to INSERT a bare `payments` row straight from the browser: no
 * installment_id, no schedule update, no change to `fees.paid_amount`. The money
 * appeared in the payments list and in revenue totals, and the student's fee page
 * went on showing it as owed, because nothing connected the row to a schedule.
 * Every balance in the app was computed from the installments, so a payment
 * recorded this way did not exist as far as anything the student sees.
 *
 * It now goes to /api/installments/collect, the same route the per-installment
 * Collect button uses, so one figure lands on the ledger, settles the oldest open
 * schedule lines and moves the fee balance in a single transaction. The course is
 * chosen from the student's own fees rather than from the courses table, because
 * a payment only means something against a fee that exists.
 */
export function RecordPaymentSheet({ open, onOpenChange, onSuccess }: RecordPaymentSheetProps) {
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentOption[]>([])
  const [fees, setFees] = useState<FeeOption[]>([])
  const [studentId, setStudentId] = useState("")
  const [feeId, setFeeId] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("upi")
  const [paymentDate, setPaymentDate] = useState(todayLocal)
  const [status, setStatus] = useState("Paid")
  const [description, setDescription] = useState("")
  const [loadingFees, setLoadingFees] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function loadData() {
      const { data } = await supabase
        .from("students").select("id, full_name").order("full_name")
      if (data) setStudents(data)
      setAmount("")
      setMethod("upi")
      setPaymentDate(todayLocal())
      setStatus("Paid")
      setDescription("")
      setStudentId("")
      setFeeId("")
      setFees([])
    }
    void loadData()
  }, [open])

  async function handleStudentChange(id: string) {
    setStudentId(id)
    setFeeId("")
    setAmount("")
    if (!id) {
      setFees([])
      return
    }

    setLoadingFees(true)
    const { data: feeRows, error } = await supabase
      .from("fees")
      .select("id, course_slug, total_fee, paid_amount, pending_amount")
      .eq("student_id", id)

    if (error) {
      console.error("[record-payment] fee lookup failed:", error.message)
      toast("Could not load this student's course fees.", { variant: "destructive" })
      setFees([])
      setLoadingFees(false)
      return
    }

    const rows = feeRows ?? []
    const slugs = [...new Set(rows.map((row) => row.course_slug).filter(Boolean))] as string[]
    const { data: courseRows } = slugs.length
      ? await supabase.from("courses").select("slug, name").in("slug", slugs)
      : { data: [] as { slug: string; name: string }[] }
    const nameBySlug = new Map((courseRows ?? []).map((course) => [course.slug, course.name]))

    const options: FeeOption[] = rows.map((row) => {
      const total = Number(row.total_fee ?? 0)
      // A claim the student filed and the institute has not verified still blocks
      // the money from being collected again, so it counts as taken here too.
      // Counting only settled money offered the same amount twice and the RPC then
      // refused it.
      const taken = Number(row.paid_amount ?? 0) + Number(row.pending_amount ?? 0)
      return {
        id: row.id,
        courseSlug: row.course_slug,
        courseName: nameBySlug.get(row.course_slug ?? "") ?? row.course_slug ?? "Course fee",
        totalFee: total,
        outstanding: Math.max(0, Number((total - taken).toFixed(2))),
      }
    })

    setFees(options)
    if (options.length === 1) setFeeId(options[0].id)
    setLoadingFees(false)
  }

  const selectedFee = fees.find((fee) => fee.id === feeId) ?? null
  const parsed = parseSingleAmount(amount.trim() === "" ? null : amount)
  const amountError =
    !selectedFee
      ? null
      : amount.trim() === ""
        ? "Enter the amount that was handed over."
        : parsed.error ??
          checkAmountAgainstTotal(parsed.amount, selectedFee.outstanding)
  const futureDate = paymentDate > todayLocal()

  async function handleSubmit() {
    if (!selectedFee) {
      toast("Choose which course this payment is for", { variant: "destructive" })
      return
    }
    if (amountError || !parsed.amount) {
      toast(amountError ?? "Enter a valid amount", { variant: "destructive" })
      return
    }
    if (futureDate) {
      toast("A payment cannot be dated in the future.", { variant: "destructive" })
      return
    }

    setSaving(true)

    try {
      // The route checks the admin's bearer token server-side; without it the
      // request cannot be told apart from an anonymous one.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/installments/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          feeId: selectedFee.id,
          amount: parsed.amount,
          method,
          reference: description.trim(),
          status,
          paymentDate,
        }),
      })

      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        amount?: number
        rows?: { label: string; amount: number }[]
      }

      if (!response.ok) {
        toast(result.error ?? "We couldn't record that payment. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      const settled = Number(result.amount ?? parsed.amount)
      const breakdown = result.rows?.length
        ? ` across ${result.rows.map((row) => row.label).join(", ")}`
        : ""

      toast(
        `Recorded ₹${settled.toLocaleString("en-IN")} for ${selectedFee.courseName}${breakdown}.`,
        { variant: "success" }
      )
      onOpenChange(false)
      onSuccess()
    } catch {
      toast("We couldn't record that payment. Nothing was changed — please try again.", {
        variant: "destructive",
        duration: 10000,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record Payment"
      icon={IndianRupee}
      submitLabel={saving ? "Recording..." : "Record Payment"}
      onSubmit={handleSubmit}
    >
      <FormField label="Student" htmlFor="studentId">
        <Select value={studentId} onValueChange={(v) => void handleStudentChange(v ?? "")}>
          <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
            <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select student" />
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

      <FormField label="Course fee" htmlFor="feeId">
        <Select
          value={feeId}
          onValueChange={(v) => { setFeeId(v ?? ""); setAmount("") }}
          disabled={!studentId || loadingFees || fees.length === 0}
        >
          <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
            <SelectValue
              className={SHEET_SELECT_VALUE_CLASS}
              placeholder={
                !studentId
                  ? "Select a student first"
                  : loadingFees
                    ? "Loading fees..."
                    : fees.length === 0
                      ? "This student has no course fee"
                      : "Select the course being paid"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {fees.map((fee) => (
              <SelectItem key={fee.id} value={fee.id}>
                {fee.courseName} — ₹{fee.outstanding.toLocaleString("en-IN")} outstanding
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount (₹)" htmlFor="amount">
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={selectedFee?.outstanding}
            placeholder={selectedFee ? String(selectedFee.outstanding) : "Enter amount"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(amountError)}
            className={cn(SHEET_INPUT_CLASS, amountError && "border-destructive")}
          />
        </FormField>
        <FormField label="Method">
          <Select value={method} onValueChange={(v) => setMethod(v ?? "upi")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {amountError && (
        <p className="text-xs font-medium text-destructive">{amountError}</p>
      )}

      {selectedFee && !amountError && (
        <p className="text-xs text-muted-foreground">
          The oldest unpaid installments of {selectedFee.courseName} are settled first, so one
          figure can cover more than a single line. Anything still owing afterwards stays on the
          schedule.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Payment Date" htmlFor="paymentDate">
          <Input
            id="paymentDate"
            type="date"
            max={todayLocal()}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={cn(SHEET_INPUT_CLASS, futureDate && "border-destructive")}
          />
        </FormField>
        <FormField label="Status">
          {/* Only these two. A payment is money received, or money somebody says
              they have sent; `Partial` is a property of an installment once a part
              payment lands on it, and `Overdue` belongs to a due date. Offering
              them here wrote values the settlement logic never honoured. */}
          <Select value={status} onValueChange={(v) => setStatus(v ?? "Paid")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Paid">Paid — money received</SelectItem>
              <SelectItem value="Pending">Pending — claimed, to verify</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {futureDate && (
        <p className="text-xs font-medium text-destructive">
          A payment cannot be dated in the future.
        </p>
      )}

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          placeholder="Reference or note (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={SHEET_TEXTAREA_CLASS}
        />
      </FormField>

      {saving && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Writing the ledger row, the schedule and the fee balance together.
        </p>
      )}
    </FormSheet>
  )
}
