"use client"

import { useState } from "react"
import { PencilLine } from "lucide-react"
import {
  FormSheet,
  FormField,
  SHEET_INPUT_CLASS,
  SHEET_SELECT_TRIGGER_CLASS,
  SHEET_SELECT_VALUE_CLASS,
} from "@/components/admin/form-sheet"
import { BranchSelect } from "@/components/admin/branch-select"
import {
  TeacherQualificationSelect,
  TeacherSpecializationSelect,
} from "@/components/admin/teacher-qualification-select"
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
  email: string | null
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
  // The form's fields come from one teacher, so it is mounted afresh per teacher
  // rather than being copied out of props by an effect. The old version did the
  // copying in a `useEffect`, which meant every edit arrived one commit late:
  // the sheet first painted the previous teacher's values, then repainted with
  // this one's — and editing two teachers in a row briefly showed the first
  // teacher's name in the second's form.
  if (!teacher) {
    return (
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Teacher Details"
        icon={PencilLine}
        submitLabel="Save Changes"
        onSubmit={() => undefined}
      >
        <p className="text-sm text-muted-foreground">
          Choose a teacher to edit.
        </p>
      </FormSheet>
    )
  }

  return (
    <EditTeacherForm
      key={teacher.id}
      teacher={teacher}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  )
}

function EditTeacherForm({
  teacher,
  open,
  onOpenChange,
  onSuccess,
}: EditTeacherSheetProps & { teacher: TeacherRecord }) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(() => teacher.full_name ?? "")
  const [email, setEmail] = useState(() => teacher.email ?? "")
  const [phone, setPhone] = useState(() => teacher.phone ?? "")
  const [role, setRole] = useState(() => teacher.role ?? "Teacher")
  const [qualification, setQualification] = useState(() => teacher.qualification ?? "")
  const [specialization, setSpecialization] = useState(() => teacher.specialization ?? "")
  const [branch, setBranch] = useState(() => teacher.branch_id ?? "")
  const [experience, setExperience] = useState(() => String(teacher.experience ?? 0))
  const [salary, setSalary] = useState(() => (teacher.salary != null ? String(teacher.salary) : ""))
  const [status, setStatus] = useState<"Active" | "On Leave">(teacher.status ?? "Active")
  const [subjects, setSubjects] = useState(() => (teacher.subjects ?? []).join(", "))
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

    const cleanedSubjects = subjects
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    setSaving(true)

    const { error } = await supabase
      .from("teachers")
      .update({
        full_name: fullName.trim(),
        email: email.trim() || null,
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
          <Input id="editTeacherName" className={SHEET_INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email (optional)" htmlFor="editTeacherEmail">
          <Input id="editTeacherEmail" className={SHEET_INPUT_CLASS} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone" htmlFor="editTeacherPhone">
          <Input id="editTeacherPhone" className={SHEET_INPUT_CLASS} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Role">
          <Select value={role} onValueChange={(value) => setRole(value || "Teacher")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select role" />
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
        <TeacherQualificationSelect value={qualification} onChange={setQualification} />
        <TeacherSpecializationSelect value={specialization} onChange={setSpecialization} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Branch">
          <BranchSelect value={branch} onChange={setBranch} />
        </FormField>
        <FormField label="Status">
          <Select value={status} onValueChange={(value) => setStatus((value as "Active" | "On Leave") || "Active")}>
            <SelectTrigger className={SHEET_SELECT_TRIGGER_CLASS}>
              <SelectValue className={SHEET_SELECT_VALUE_CLASS} placeholder="Select status" />
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
          <Input id="editTeacherExperience" className={SHEET_INPUT_CLASS} type="number" min="0" value={experience} onChange={(e) => setExperience(e.target.value)} />
        </FormField>
        <FormField label="Monthly Salary" htmlFor="editTeacherSalary">
          <Input id="editTeacherSalary" className={SHEET_INPUT_CLASS} type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Subjects" htmlFor="editTeacherSubjects">
        <Input id="editTeacherSubjects" className={SHEET_INPUT_CLASS} placeholder="Java, Python, Web Development" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
      </FormField>
    </FormSheet>
  )
}
