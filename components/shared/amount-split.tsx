"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The institute's ceiling on how many times an amount may be divided. It is
 * three everywhere — a fee schedule, a payment against that schedule, the
 * installments a student can settle in one go — and it is a cap, not a target.
 */
export const MAX_SPLIT_PARTS = 3

/**
 * Turns the raw text of each box into the numbers a caller sends on.
 *
 * Blank boxes are dropped rather than read as zero, so leaving the third box
 * empty means "two parts", not "three parts where one is nothing". Anything that
 * is not a positive finite number is a mistake the caller should hear about
 * before a request is made, which is what the third return value reports.
 */
export function readAmountParts(values: string[]): {
  amounts: number[]
  error: string | null
} {
  const amounts: number[] = []

  for (const raw of values) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) {
      return { amounts: [], error: "Every amount must be a number above zero." }
    }

    amounts.push(value)
  }

  if (amounts.length > MAX_SPLIT_PARTS) {
    return { amounts: [], error: `Use at most ${MAX_SPLIT_PARTS} amounts.` }
  }

  return { amounts, error: null }
}

/** What the boxes currently add up to. Zero when nothing is filled in. */
export function sumAmountParts(values: string[]): number {
  return values.reduce((total, raw) => {
    const value = Number(raw.trim())
    return Number.isFinite(value) && value > 0 ? total + value : total
  }, 0)
}

interface AmountSplitProps {
  /** Wired to the array of box values, always of length 1..MAX_SPLIT_PARTS. */
  values: string[]
  onChange: (values: string[]) => void
  label: string
  /** Shown under the boxes. Say what the split has to add up to, if anything. */
  hint?: React.ReactNode
  /** A total the parts must reach. Null when there is no such total. */
  target?: number | null
  /** Box labels, e.g. ["Installment 1", ...]. Falls back to "Part 1". */
  partLabels?: string[]
  /** Smaller boxes, for a dialog that is already dense. */
  compact?: boolean
  className?: string
}

/**
 * Up to three amount boxes and nothing else.
 *
 * There is deliberately no default fill, no "split evenly", and no figure the
 * component offers to put in a box. What lands here is what somebody decided to
 * pay, which is the whole point: an earlier version divided a fee into equal
 * thirds and then spread payments over them by walking a remaining balance, and
 * the resulting invoice bore amounts nobody had agreed to.
 *
 * `values` is always at least one entry long so the first box always exists; a
 * caller passes an empty string to mean "no split yet".
 */
export function AmountSplit({
  values,
  onChange,
  label,
  hint,
  target = null,
  partLabels,
  compact = false,
  className,
}: AmountSplitProps) {
  const parts = values.length > 0 ? values : [""]
  const total = sumAmountParts(parts)
  const hasTarget = typeof target === "number" && target > 0
  const matches = hasTarget && Math.abs(total - target) < 0.005
  const overTarget = hasTarget && total > target + 0.005
  const canAdd = parts.length < MAX_SPLIT_PARTS
  const filled = parts.filter((part) => Number(part.trim()) > 0).length

  function setPart(index: number, value: string) {
    const next = [...parts]
    next[index] = value
    onChange(next)
  }

  function addPart() {
    if (!canAdd) return
    onChange([...parts, ""])
  }

  function removePart(index: number) {
    if (parts.length <= 1) return
    onChange(parts.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>

      <div className="space-y-2">
        {parts.map((value, index) => (
          <div key={index} className={cn("flex items-center gap-2", compact && "gap-1.5")}>
            <span className="w-24 shrink-0 text-xs text-muted-foreground sm:w-28">
              {partLabels?.[index] ?? `Part ${index + 1}`}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(event) => setPart(index, event.target.value)}
              placeholder="0"
              aria-label={partLabels?.[index] ?? `Part ${index + 1} amount`}
              className={compact ? "h-10" : "h-12 text-base"}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePart(index)}
              disabled={parts.length <= 1}
              aria-label={`Remove ${partLabels?.[index] ?? `part ${index + 1}`}`}
              className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Minus className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {canAdd && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPart}
              className="h-9 gap-1.5"
            >
              <Plus className="size-3.5" />
              {parts.length === 1 ? "Split into parts" : "Add part"}
            </Button>
          )}
          {filled === 0 && parts.length < MAX_SPLIT_PARTS && (
            <span className="text-xs text-muted-foreground">
              Leave every box blank to keep it as one amount.
            </span>
          )}
        </div>

        <p
          className={cn(
            "text-xs font-medium",
            matches
              ? "text-emerald-600 dark:text-emerald-400"
              : overTarget
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {hasTarget
            ? `${matches ? "Adds up" : "Adds up to"} ₹${total.toLocaleString("en-IN")} of ₹${target.toLocaleString("en-IN")}`
            : total > 0
              ? `Total ₹${total.toLocaleString("en-IN")}`
              : ""}
        </p>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
