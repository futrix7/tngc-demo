"use client"

import { useState } from "react"
import { WalletCards } from "lucide-react"
import { FormSheet, FormField } from "@/components/admin/form-sheet"
import { BranchSelect } from "@/components/admin/branch-select"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { localDate } from "@/lib/local-date"
import { useToast } from "@/components/ui/sonner"

interface AddExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Today, in the institute's own timezone.
 *
 * `toISOString()` gets this wrong by conversion: it moves to UTC first, so an
 * expense entered at 9 AM in IST is stamped with the previous day. Every other
 * date this app writes is a local calendar day, and the finance page buckets
 * transactions by exactly that string. See `lib/local-date`.
 */
function todayLocal(): string {
  return localDate()
}

export function AddExpenseSheet({ open, onOpenChange, onSuccess }: AddExpenseSheetProps) {
  const { toast } = useToast()
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Salary")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayLocal)
  const [branch, setBranch] = useState("")
  const [saving, setSaving] = useState(false)

  /**
   * Reopens onto a blank form dated today.
   *
   * This used to be a `useEffect` on `open`, which is the one thing an effect
   * must not do: it set state synchronously during the commit that rendered the
   * sheet, so the form arrived carrying the last entry's date and then repainted.
   * Doing it in the open handler is the same behaviour in one render.
   */
  function handleOpenChange(next: boolean) {
    if (next) {
      setDescription("")
      setCategory("Salary")
      setAmount("")
      setDate(todayLocal())
      setBranch("")
    }
    onOpenChange(next)
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast("Please enter an expense description", { variant: "destructive" })
      return
    }

    const numericAmount = Number(amount)
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast("Please enter a valid amount", { variant: "destructive" })
      return
    }

    setSaving(true)

    const { error } = await supabase.from("transactions").insert({
      date,
      description: description.trim(),
      category: category.trim(),
      amount: numericAmount,
      type: "expense",
      branch_id: branch || null,
    })

    setSaving(false)

    if (error) {
      toast("Failed to add expense: " + error.message, { variant: "destructive" })
      return
    }

    toast("Expense saved successfully", { variant: "success" })
    handleOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Expense"
      icon={WalletCards}
      submitLabel={saving ? "Saving..." : "Save Expense"}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-3">
        <FormField label="Description" htmlFor="expenseDescription">
          <Input
            id="expenseDescription"
            placeholder="e.g. Faculty salaries, rent, utilities"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">
            <Select value={category} onValueChange={(value) => setCategory(value || "Salary")}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Salary">Salary</SelectItem>
                <SelectItem value="Rent">Rent</SelectItem>
                <SelectItem value="Utilities">Utilities</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Amount" htmlFor="expenseAmount">
            <Input
              id="expenseAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" htmlFor="expenseDate">
            <Input
              id="expenseDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>

          <FormField label="Branch">
            <BranchSelect value={branch} onChange={setBranch} />
          </FormField>
        </div>
      </div>
    </FormSheet>
  )
}
