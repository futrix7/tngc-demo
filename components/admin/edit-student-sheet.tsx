"use client"

import { useState } from "react"
import { UserRoundPen } from "lucide-react"
import { FormField, FormSheet, SHEET_INPUT_CLASS, SHEET_NATIVE_SELECT_CLASS } from "@/components/admin/form-sheet"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/sonner"
import { supabase } from "@/lib/supabase"
import { normalizeIndianPhone } from "@/lib/phone"

export interface EditableStudentDetails {
  id: string
  name: string
  email: string | null
  phone: string
  dateOfBirth: string
  gender: string
  address: string
  fatherName: string
  fatherPhone: string
  motherName: string
  batchTime: string
  enrollmentDate: string
}

interface EditStudentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: EditableStudentDetails
  onSaved: (details: EditableStudentDetails) => void
}

export function EditStudentSheet({ open, onOpenChange, student, onSaved }: EditStudentSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(student)

  function update<K extends keyof EditableStudentDetails>(key: K, value: EditableStudentDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (saving) return
    if (!details.name.trim()) {
      toast("Student name is required.", { variant: "warning" })
      return
    }
    if (!normalizeIndianPhone(details.phone)) {
      toast("Enter a valid 10-digit student phone number.", { variant: "warning" })
      return
    }
    if (details.fatherPhone && !normalizeIndianPhone(details.fatherPhone)) {
      toast("Enter a valid 10-digit father/guardian phone number or leave it blank.", { variant: "warning" })
      return
    }
    const email = details.email?.trim() ?? ""
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast("Enter a valid email address or leave it blank.", { variant: "warning" })
      return
    }

    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) {
        toast("Your admin session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const response = await fetch("/api/admin/students/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(details),
      })
      const result = await response.json() as { error?: string; student?: EditableStudentDetails }
      if (!response.ok) {
        toast(result.error ?? "Could not update student details.", {
          variant: response.status === 409 ? "warning" : "destructive",
        })
        return
      }

      const saved = result.student ?? {
        ...details,
        name: details.name.trim(),
        email: details.email?.trim() || null,
        phone: normalizeIndianPhone(details.phone)!.nationalNumber,
        fatherPhone: details.fatherPhone.trim(),
      }
      onSaved(saved)
      onOpenChange(false)
      toast("Student details updated.", { variant: "success" })
    } catch (error) {
      console.error("[admin student edit] save failed:", error)
      toast("Could not update student details. Please try again.", { variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDetails(student)
        onOpenChange(nextOpen)
      }}
      title="Edit Student Details"
      icon={UserRoundPen}
      submitLabel={saving ? "Saving..." : "Save Details"}
      onSubmit={handleSubmit}
      contentClassName="w-full data-[side=right]:sm:max-w-xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="edit-student-name">
          <Input
            id="edit-student-name"
            className={SHEET_INPUT_CLASS}
            value={details.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </FormField>
        <FormField label="Student login phone" htmlFor="edit-student-phone">
          <Input
            id="edit-student-phone"
            type="tel"
            inputMode="numeric"
            maxLength={14}
            className={SHEET_INPUT_CLASS}
            value={details.phone}
            onChange={(event) => update("phone", event.target.value)}
            required
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Email (optional)" htmlFor="edit-student-email">
          <Input
            id="edit-student-email"
            type="email"
            className={SHEET_INPUT_CLASS}
            value={details.email ?? ""}
            onChange={(event) => update("email", event.target.value)}
          />
        </FormField>
        <FormField label="Date of birth" htmlFor="edit-student-dob">
          <Input
            id="edit-student-dob"
            type="date"
            className={SHEET_INPUT_CLASS}
            value={details.dateOfBirth}
            onChange={(event) => update("dateOfBirth", event.target.value)}
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Gender" htmlFor="edit-student-gender">
          <select
            id="edit-student-gender"
            className={`w-full ${SHEET_NATIVE_SELECT_CLASS}`}
            value={details.gender}
            onChange={(event) => update("gender", event.target.value)}
          >
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField label="Batch time" htmlFor="edit-student-batch">
          <Input
            id="edit-student-batch"
            className={SHEET_INPUT_CLASS}
            value={details.batchTime}
            onChange={(event) => update("batchTime", event.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Address" htmlFor="edit-student-address">
        <Input
          id="edit-student-address"
          className={SHEET_INPUT_CLASS}
          value={details.address}
          onChange={(event) => update("address", event.target.value)}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Father / guardian name" htmlFor="edit-student-father">
          <Input
            id="edit-student-father"
            className={SHEET_INPUT_CLASS}
            value={details.fatherName}
            onChange={(event) => update("fatherName", event.target.value)}
          />
        </FormField>
        <FormField label="Father / guardian phone (optional)" htmlFor="edit-student-father-phone">
          <Input
            id="edit-student-father-phone"
            type="tel"
            inputMode="numeric"
            maxLength={14}
            className={SHEET_INPUT_CLASS}
            value={details.fatherPhone}
            onChange={(event) => update("fatherPhone", event.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Mother's name" htmlFor="edit-student-mother">
        <Input
          id="edit-student-mother"
          className={SHEET_INPUT_CLASS}
          value={details.motherName}
          onChange={(event) => update("motherName", event.target.value)}
        />
      </FormField>

      <FormField label="Enrollment date" htmlFor="edit-student-enrollment-date">
        <Input
          id="edit-student-enrollment-date"
          type="date"
          className={SHEET_INPUT_CLASS}
          value={details.enrollmentDate}
          onChange={(event) => update("enrollmentDate", event.target.value)}
        />
      </FormField>
    </FormSheet>
  )
}
