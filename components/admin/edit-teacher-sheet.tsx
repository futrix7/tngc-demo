"use client"

import { useEffect, useState } from "react"
import { PencilLine } from "lucide-react"
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

export interface TeacherRecord {
  id: string
  full_name: string
  email: string
  phone: string
  role: string
  branch_id?: string | null
  subjects?: string[]
  experience?: number
  qualification?: string | null
  specialization?: string | null
  salary?: number | null
  status?: "Active" | "On Leave"
}

interface EditTeacherSheetProps {
  teacher: TeacherRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditTeacherSheet({ teacher, open, onOpenChange, onSuccess }: EditTeacherSheetProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("Teacher")
  const [qualification, setQualification] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [branch, setBranch] = useState("")
  const [experience, setExperience] = useState("0")
  const [salary, setSalary] = useState("")
  const [status, setStatus] = useState<"Active" | "On Leave">("Active")
  const [subjects, setSubjects] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!teacher) return

    setFullName(teacher.full_name ?? "")
    setEmail(teacher.email ?? "")
    setPhone(teacher.phone ?? "")
    setRole(teacher.role ?? "Teacher")
    setQualification(teacher.qualification ?? "")
    setSpecialization(teacher.specialization ?? "")
    setBranch(teacher.branch_id ?? "")
    setExperience(String(teacher.experience ?? 0))
    setSalary(teacher.salary != null ? String(teacher.salary) : "")
    setStatus(teacher.status ?? "Active")
    setSubjects((teacher.subjects ?? []).join(", "))
  }, [teacher, open])

  async function handleSubmit() {
    if (!teacher || !fullName.trim() || !email.trim() || !phone.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    const cleanedSubjects = subjects
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    setSaving(true)

    const { error } = await supabase
      .from("teachers")
      .update({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: role || "Teacher",
        branch_id: branch || null,
        qualification: qualification || null,
        specialization: specialization || null,
        experience: Number(experience) || 0,
        salary: salary ? Number(salary) : null,
        status: status || "Active",
        subjects: cleanedSubjects,
      })
      .eq("id", teacher.id)

    setSaving(false)

    if (error) {
      toast("Failed to update teacher: " + error.message, { variant: "destructive" })
      return
    }

    toast("Teacher updated successfully", { variant: "success" })
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Teacher Details"
      icon={PencilLine}
      submitLabel={saving ? "Saving..." : "Save Changes"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Full Name" htmlFor="editTeacherName">
          <Input id="editTeacherName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="editTeacherEmail">
          <Input id="editTeacherEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone" htmlFor="editTeacherPhone">
          <Input id="editTeacherPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Role">
          <Select value={role} onValueChange={(value) => setRole(value || "Teacher")}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Teacher">Teacher</SelectItem>
              <SelectItem value="Trainer">Trainer</SelectItem>
              <SelectItem value="Coordinator">Coordinator</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Qualification">
          <Select value={qualification} onValueChange={(value) => setQualification(value ?? "")}>
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
        <FormField label="Specialization">
          <Select value={specialization} onValueChange={(value) => setSpecialization(value ?? "")}>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Branch">
          <Select value={branch} onValueChange={(value) => setBranch(value ?? "")}>
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
        <FormField label="Status">
          <Select value={status} onValueChange={(value) => setStatus((value as "Active" | "On Leave") || "Active")}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Experience" htmlFor="editTeacherExperience">
          <Input id="editTeacherExperience" type="number" min="0" value={experience} onChange={(e) => setExperience(e.target.value)} />
        </FormField>
        <FormField label="Monthly Salary" htmlFor="editTeacherSalary">
          <Input id="editTeacherSalary" type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Subjects" htmlFor="editTeacherSubjects">
        <Input id="editTeacherSubjects" placeholder="Java, Python, Web Development" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
      </FormField>
    </FormSheet>
  )
}
