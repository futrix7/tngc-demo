"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  FormField,
  SHEET_INPUT_CLASS,
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
} from "@/components/admin/form-sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const QUALIFICATIONS = ["B.Tech", "M.Tech", "MCA", "M.Sc", "PhD"]
const SPECIALIZATIONS = ["Java", "Python", "Web Development", "Database", "Networking", "MS-Office"]
const CUSTOM_VALUE = "__custom_teacher_value__"

export function TeacherQualificationSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TeacherCustomValueSelect
      label="Qualification"
      options={QUALIFICATIONS}
      value={value}
      onChange={onChange}
    />
  )
}

export function TeacherSpecializationSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TeacherCustomValueSelect
      label="Specialization"
      options={SPECIALIZATIONS}
      value={value}
      onChange={onChange}
    />
  )
}

function TeacherCustomValueSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customValue, setCustomValue] = useState("")
  const inputId = useId()
  const hasCustomValue = Boolean(value) && !options.includes(value) && value !== "Others"

  function handleValueChange(nextValue: string | null) {
    if (nextValue === "Others") {
      setCustomValue(hasCustomValue ? value : "")
      setDialogOpen(true)
      return
    }
    if (nextValue && nextValue !== CUSTOM_VALUE) onChange(nextValue)
  }

  function saveCustomValue() {
    const trimmed = customValue.trim()
    if (!trimmed) return
    onChange(trimmed)
    setDialogOpen(false)
  }

  return (
    <>
      <FormField label={label}>
        <Select value={hasCustomValue ? CUSTOM_VALUE : value} onValueChange={handleValueChange}>
          <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
            <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
            {hasCustomValue && (
              <SelectItem value={CUSTOM_VALUE}>{value}</SelectItem>
            )}
            <SelectItem value="Others">Others</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Add the teacher&apos;s {label.toLowerCase()} not listed in the options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>{label}</Label>
            <Input
              id={inputId}
              className={SHEET_INPUT_CLASS}
              autoFocus
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  saveCustomValue()
                }
              }}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCustomValue} disabled={!customValue.trim()}>
              Save {label.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
