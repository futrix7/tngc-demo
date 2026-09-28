"use client"

import { useEffect, useState } from "react"
import { WalletCards } from "lucide-react"
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

interface AddExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddExpenseSheet({ open, onOpenChange, onSuccess }: AddExpenseSheetProps) {
  const { toast } = useToast()
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Salary")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [branch, setBranch] = useState("ramanthapur")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

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
    setDescription("")
    setCategory("Salary")
    setAmount("")
    setBranch("ramanthapur")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
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
            <Select value={branch} onValueChange={(value) => setBranch(value || "ramanthapur")}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ramanthapur">Ramanthapur</SelectItem>
                <SelectItem value="amberpet">Amberpet</SelectItem>
                <SelectItem value="kodad">Kodad</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>
    </FormSheet>
  )
}
