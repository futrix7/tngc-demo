"use client"

import { useState } from "react"
import { GraduationCap } from "lucide-react"
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
  const [branch, setBranch] = useState("")
  const [experience, setExperience] = useState("")
  const [salary, setSalary] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    setSaving(true)

    const teacherId = `TCH-${Date.now()}`

    const { error } = await supabase.from("teachers").insert({
      id: teacherId,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role: "Teacher",
      branch_id: branch || null,
      subjects: [],
      experience: experience ? parseInt(experience) : 0,
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
    setBranch("")
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
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Full Name" htmlFor="fullName">
          <Input id="fullName" placeholder="Enter full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" type="tel" placeholder="Enter phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Qualification">
          <Select value={qualification} onValueChange={(v) => setQualification(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select qualification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B.Tech">B.Tech</SelectItem>
              <SelectItem value="M.Tech">M.Tech</SelectItem>
              <SelectItem value="MCA">MCA</SelectItem>
              <SelectItem value="M.Sc">M.Sc</SelectItem>
              <SelectItem value="PhD">PhD</SelectItem>
              <SelectItem value="Others">Others</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Specialization">
          <Select value={specialization} onValueChange={(v) => setSpecialization(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select specialization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Java">Java</SelectItem>
              <SelectItem value="Python">Python</SelectItem>
              <SelectItem value="Web Development">Web Development</SelectItem>
              <SelectItem value="Database">Database</SelectItem>
              <SelectItem value="Networking">Networking</SelectItem>
              <SelectItem value="MS-Office">MS-Office</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Branch">
          <Select value={branch} onValueChange={(v) => setBranch(v ?? "")}>
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

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Experience">
          <Select value={experience} onValueChange={(v) => setExperience(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select experience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0-1">0-1 years</SelectItem>
              <SelectItem value="1-3">1-3 years</SelectItem>
              <SelectItem value="3-5">3-5 years</SelectItem>
              <SelectItem value="5-10">5-10 years</SelectItem>
              <SelectItem value="10+">10+ years</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Monthly Salary" htmlFor="salary">
          <Input id="salary" type="number" placeholder="Enter salary" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </FormField>
      </div>
    </FormSheet>
  )
}
