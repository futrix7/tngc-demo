"use client"

import { useState } from "react"
import { Banknote, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export interface CollectibleInstallment {
  id: string
  /** The student the money is for. Names the confirmation toast. */
  student?: string
  /** The line itself, e.g. "Installment 2 of 4". */
  label: string
  /** Who the line belongs to, e.g. "Python Full Stack". */
  title: string
  subtitle?: string
  /** The full amount of this line. */
  amount: number
  /** What is genuinely still open on it. */
  balance: number
  /** Settles the whole balance with one figure. */
  settleAll: boolean
}

interface CollectDialogProps {
  installment: CollectibleInstallment | null
  onOpenChange: (open: boolean) => void
  onCollected: () => void
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
] as const

/**
 * Takes money at the counter against one installment.
 *
 * "Pay the whole line" and "hand over part of it" are both offered, because both
 * happen and the app previously had only the first. The amount box is editable
 * and defaults to the balance rather than being fixed, so an admin who took ₹500
 * against a ₹3,000 line records ₹500 — which is what actually left their hand.
 * The earlier version rendered the installment's own amount as read-only text and
 * recorded the full figure whatever was paid.
 *
 * Both paths go to /api/installments/collect, so the ledger row, the installment
 * status and the fee balance are written in one transaction either way.
 */
export function CollectDialog({ installment, onOpenChange, onCollected }: CollectDialogProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)

  const open = installment !== null

  function handleOpenChange(next: boolean) {
    if (!next) {
      setAmount("")
      setMethod("cash")
      setReference("")
      setSaving(false)
    }
    onOpenChange(next)
  }

  const entered = amount.trim() === "" ? 0 : Number(amount)
  const amountError =
    installment && amount.trim() !== ""
      ? !Number.isFinite(entered) || entered <= 0
        ? "Enter an amount above zero."
        : entered > installment.balance + 0.005
          ? `Only ₹${installment.balance.toLocaleString("en-IN")} is outstanding on this installment.`
          : null
      : null
  const settleAll = installment !== null && installment.settleAll && amount.trim() === ""
  const effective = settleAll ? installment.balance : entered

  async function handleSubmit() {
    if (!installment || saving || amountError) return

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/installments/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          installmentId: installment.id,
          amount: effective,
          method,
          reference: reference.trim(),
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

      // The RPC may settle one line or cross onto the next, so the confirmation
      // names what it actually did rather than echoing the amount back.
      const breakdown = result.rows?.length
        ? ` (${result.rows.map((row) => row.label).join(", ")})`
        : ""

      toast(
        `Collected ₹${Number(result.amount ?? effective).toLocaleString("en-IN")} for ${installment.student ?? installment.title}${breakdown}.`,
        { variant: "success" }
      )

      handleOpenChange(false)
      onCollected()
    } catch {
      toast("We couldn't record that payment. Nothing was changed — please try again.", {
        variant: "destructive",
        duration: 10000,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!installment) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            {[installment.student, installment.subtitle].filter(Boolean).join(" · ") ||
              installment.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{installment.label}</p>
            {installment.title !== installment.label && (
              <p className="text-xs text-muted-foreground">{installment.title}</p>
            )}
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Installment amount</span>
                <span>₹{installment.amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Outstanding</span>
                <span>₹{installment.balance.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collectAmount">
              Amount collected
              {installment.settleAll && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (blank settles the full balance)
                </span>
              )}
            </Label>
            <Input
              id="collectAmount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={installment.balance}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={installment.balance.toFixed(2)}
              aria-invalid={Boolean(amountError)}
              className={cn("h-11", amountError && "border-destructive")}
            />
            {amountError ? (
              <p className="text-xs font-medium text-destructive">{amountError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Any figure up to ₹{installment.balance.toLocaleString("en-IN")}.{" "}
                {effective > 0 && settleAll
                  ? "This settles the line in full."
                  : effective > 0 && effective < installment.balance
                    ? `₹${(installment.balance - effective).toLocaleString("en-IN")} will still be owing on this line.`
                    : "Leave blank to take the whole balance."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={method === option.value ? "default" : "outline"}
                  onClick={() => setMethod(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collectReference">Reference (optional)</Label>
            <Input
              id="collectReference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Receipt or transaction number"
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || Boolean(amountError) || effective <= 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
            {saving
              ? "Recording..."
              : `Collect ₹${effective.toLocaleString("en-IN")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
