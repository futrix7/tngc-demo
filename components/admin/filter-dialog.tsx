"use client"

import { useState } from "react"
import { Filter, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateFilterInput } from "@/components/admin/date-filter-input"

export interface FilterOption {
  label: string
  value: string
}

export interface FilterField {
  key: string
  label: string
  type: "select" | "text" | "date" | "month"
  defaultValue: string
  options?: FilterOption[]
  placeholder?: string
  showWhen?: { key: string; value: string }
}

export type FilterValues = Record<string, string>

interface FilterDialogProps {
  title: string
  description: string
  fields: FilterField[]
  values: FilterValues
  onApply: (values: FilterValues) => Promise<void>
  onClear: (values: FilterValues) => Promise<void>
  /**
   * Word on the trigger button.
   *
   * Defaults to "Filters", which reads right where it sits next to a table that
   * has no other filtering. Pages that already offer quick tabs above the
   * results pass something like "More filters" so the two controls do not look
   * like duplicates of each other.
   */
  triggerLabel?: string
}

export function FilterDialog({ title, description, fields, values, onApply, onClear, triggerLabel = "Filters" }: FilterDialogProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValues>(values)
  const [busy, setBusy] = useState<"apply" | "clear" | null>(null)
  const [error, setError] = useState("")
  const defaults = Object.fromEntries(fields.map((field) => [field.key, field.defaultValue]))
  const activeCount = fields.filter((field) => (values[field.key] ?? field.defaultValue) !== field.defaultValue).length

  async function apply() {
    setBusy("apply")
    setError("")
    try {
      await onApply(draft)
      setOpen(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Filters could not be applied. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  async function clear() {
    setBusy("clear")
    setError("")
    setDraft(defaults)
    try {
      await onClear(defaults)
      setOpen(false)
    } catch {
      setError("Filters could not be cleared. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          onClick={() => {
            setDraft(values)
            setError("")
            setOpen(true)
          }}
          aria-haspopup="dialog"
        >
          {busy === "apply" ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
          {triggerLabel}
          {activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear all filters"
            title="Clear all filters"
            onClick={clear}
            disabled={busy !== null}
          >
            {busy === "clear" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) setOpen(nextOpen) }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.filter((field) => !field.showWhen || draft[field.showWhen.key] === field.showWhen.value).map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`filter-${field.key}`}>{field.label}</Label>
                {field.type === "select" ? (
                  <select
                    id={`filter-${field.key}`}
                    value={draft[field.key] ?? field.defaultValue}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "date" ? (
                  <DateFilterInput
                    id={`filter-${field.key}`}
                    value={draft[field.key] ?? field.defaultValue}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ) : (
                  <Input
                    id={`filter-${field.key}`}
                    type={field.type}
                    value={draft[field.key] ?? field.defaultValue}
                    placeholder={field.placeholder}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={clear} disabled={busy !== null}>
              {busy === "clear" && <Loader2 className="size-4 animate-spin" />}
              Clear all
            </Button>
            <Button onClick={apply} disabled={busy !== null}>
              {busy === "apply" && <Loader2 className="size-4 animate-spin" />}
              {busy === "apply" ? "Applying..." : "Apply filters"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
