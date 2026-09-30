"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import {
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
} from "@/components/admin/form-sheet"

interface Branch {
  id: string
  name: string
}

interface BranchSelectProps {
  /** `branches.id` — a uuid. Not the name, and not a hardcoded slug. */
  value: string
  onChange: (branchId: string) => void
  placeholder?: string
  /** Renders the taller data-entry sizing used by the admin sheets. */
  sheetSized?: boolean
}

/**
 * Picks an institute branch by its real id.
 *
 * The expense and teacher sheets used to offer three hardcoded slugs
 * (`ramanthapur`, `amberpet`, `kodad`) and write one straight into `branch_id`.
 * Every reader of that column looks it up against `branches.id`, so those writes
 * either failed the foreign key or produced an "Unknown" label on the finance
 * dashboard — the branch breakdown silently came out empty.
 *
 * The list is loaded rather than hardcoded for the same reason: a fourth campus
 * has to be selectable the moment it exists in the database, not after someone
 * edits this file.
 */
export function BranchSelect({
  value,
  onChange,
  placeholder = "Select branch",
  sheetSized = true,
}: BranchSelectProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  // Distinguishes "still loading" from "loaded and empty" so the trigger can say
  // so, rather than showing a bare placeholder that reads as a failure.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadBranches() {
      setLoading(true)
      setFailed(false)
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true })

      if (cancelled) return
      if (error) {
        console.error("[branch-select] branch lookup failed:", error.message)
        setBranches([])
        setFailed(true)
      } else {
        setBranches(data ?? [])
      }
      setLoading(false)
    }

    void loadBranches()
    return () => { cancelled = true }
  }, [])

  const triggerClass = sheetSized ? SHEET_SELECT_TRIGGER_CLASS : undefined
  const valueClass = sheetSized ? SHEET_SELECT_VALUE_CLASS : undefined

  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger className={triggerClass}>
        <SelectValue
          className={valueClass}
          placeholder={loading ? "Loading branches..." : failed ? "Branches unavailable" : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
        {branches.length === 0 && !loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {failed
              ? "No branches could be loaded."
              : "No branches have been set up yet."}
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
