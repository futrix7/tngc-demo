"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
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

interface AddStudentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddStudentSheet({ open, onOpenChange, onSuccess }: AddStudentSheetProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [gender, setGender] = useState("")
  const [branch, setBranch] = useState("")
  const [course, setCourse] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast("Please fill in all required fields", { variant: "destructive" })
      return
    }

    setSaving(true)

    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })

    const studentId = `STU-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, "0")}`

    const { error } = await supabase.from("students").insert({
      id: studentId,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      date_of_birth: dateOfBirth || null,
      gender: (gender as "male" | "female" | "other") || null,
      branch_id: branch || null,
      course_slug: course || null,
      address: address.trim() || null,
      status: "Active",
    })

    setSaving(false)

    if (error) {
      toast("Failed to add student: " + error.message, { variant: "destructive" })
      return
    }

    toast("Student added successfully", { variant: "success" })
    setFullName("")
    setEmail("")
    setPhone("")
    setDateOfBirth("")
    setGender("")
    setBranch("")
    setCourse("")
    setAddress("")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Student"
      icon={UserPlus}
      submitLabel={saving ? "Adding..." : "Add Student"}
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
        <FormField label="Date of Birth" htmlFor="dob">
          <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Gender">
          <Select value={gender} onValueChange={(v) => setGender(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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

      <FormField label="Course">
        <Select value={course} onValueChange={(v) => setCourse(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dca">DCA</SelectItem>
            <SelectItem value="adca">ADCA</SelectItem>
            <SelectItem value="pgdca">PGDCA</SelectItem>
            <SelectItem value="pgjpl">PGJPL</SelectItem>
            <SelectItem value="pgppl">PGPPL</SelectItem>
            <SelectItem value="python-full-stack">Python Full Stack</SelectItem>
            <SelectItem value="java-full-stack">Java Full Stack</SelectItem>
            <SelectItem value="adwd">A.D.W.D</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Address" htmlFor="address">
        <textarea
          id="address"
          placeholder="Enter full address"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </FormField>
    </FormSheet>
  )
}
