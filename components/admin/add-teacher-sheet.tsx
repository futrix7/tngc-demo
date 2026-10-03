"use client"

import { useState } from "react"
import { GraduationCap } from "lucide-react"
import {
  TeacherQualificationSelect,
  TeacherSpecializationSelect,
} from "@/components/admin/teacher-qualification-select"
import {
  FormSheet,
  FormField,
  SHEET_INPUT_CLASS,
} from "@/components/admin/form-sheet"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { mintId } from "@/lib/mint-id"
import { useToast } from "@/components/ui/sonner"

interface AddTeacherSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddTeacherSheet({ open, onOpenChange, onSuccess }: AddTeacherSheetProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [qualification, setQualification] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [experience, setExperience] = useState("")
  const [salary, setSalary] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!fullName.trim() || !phone.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast("Enter a valid email address or leave it blank.", { variant: "destructive" })
      return
    }

    setSaving(true)

    // `teachers.experience` is an INTEGER of years. The picker used to offer
    // ranges ("1-3", "5-10") and `parseInt` truncated each to its lower bound,
    // so "1-3 years" was stored as 1 and the list printed "1 yrs exp" for a
    // teacher the admin had described as having three. `parseFloat` on a number
    // field is exact and matches the column, the edit sheet, and that label.
    const years = experience ? Number.parseFloat(experience) : 0
    if (!Number.isFinite(years) || years < 0) {
      setSaving(false)
      toast("Experience must be a number of years", { variant: "destructive" })
      return
    }

    const { error } = await supabase.from("teachers").insert({
      id: mintId("TCH"),
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim(),
      role: "Teacher",
      subjects: [],
      experience: years,
      qualification: qualification || null,
      specialization: specialization || null,
      salary: salary ? parseFloat(salary) : null,
      status: "Active",
    })

    setSaving(false)

    if (error) {
      toast("Failed to add teacher: " + error.message, { variant: "destructive" })
      return
    }

    toast("Teacher added successfully", { variant: "success" })
    setFullName("")
    setEmail("")
    setPhone("")
    setQualification("")
    setSpecialization("")
    setExperience("")
    setSalary("")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Teacher"
      icon={GraduationCap}
      submitLabel={saving ? "Adding..." : "Add Teacher"}
      onSubmit={handleSubmit}
      contentClassName="w-full sm:max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Full Name" htmlFor="fullName">
          <Input id="fullName" placeholder="Enter full name" className={SHEET_INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email (optional)" htmlFor="email">
          <Input id="email" type="email" placeholder="Enter email" className={SHEET_INPUT_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" type="tel" placeholder="Enter phone" className={SHEET_INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <TeacherQualificationSelect value={qualification} onChange={setQualification} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeacherSpecializationSelect value={specialization} onChange={setSpecialization} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Experience (years)" htmlFor="experience">
          <Input
            id="experience"
            type="number"
            min="0"
            step="0.5"
            placeholder="Enter years of experience"
            className={SHEET_INPUT_CLASS}
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          />
        </FormField>
        <FormField label="Monthly Salary" htmlFor="salary">
          <Input id="salary" type="number" placeholder="Enter salary" className={SHEET_INPUT_CLASS} value={salary} onChange={(e) => setSalary(e.target.value)} />
        </FormField>
      </div>
    </FormSheet>
  )
}
