"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import {
  UserCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Edit,
  Camera,
  LogOut,
  ChevronRight,
  CreditCard,
  Award,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { EmptyState, QueryError } from "@/components/student/data-state"
import { useToast } from "@/components/ui/sonner"
import { useAuthState } from "@/hooks/use-auth"
import { ROLE_LOGIN } from "@/lib/auth/roles"

interface Profile {
  name: string
  id: string
  email: string
  phone: string
  dob: string
  address: string
  course: string
  branch: string
  joinDate: string
  batchTime: string
  fatherName: string
  fatherPhone: string
  motherName: string
  status: string
}

const fallbackProfile: Profile = {
  name: "—",
  id: "—",
  email: "—",
  phone: "—",
  dob: "—",
  address: "—",
  course: "—",
  branch: "—",
  joinDate: "—",
  batchTime: "—",
  fatherName: "—",
  fatherPhone: "—",
  motherName: "—",
  status: "Active",
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default function StudentProfile() {
  const router = useRouter()
  const { toast } = useToast()
  const { signOut } = useAuthState()
  const [profile, setProfile] = useState<Profile>(fallbackProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    const result = await signOut()
    if (!result.ok) {
      toast("We couldn't sign you out. Please try again.", { variant: "destructive" })
      setSigningOut(false)
      return
    }
    setSignOutDialogOpen(false)
    router.replace(ROLE_LOGIN.student)
  }

  useEffect(() => {
    async function fetchProfile() {
      setLoadError(null)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLoadError(authError?.message ?? "No signed-in user was found")
        setLoading(false)
        return
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*, branches(name)")
        .eq("user_id", user.id)
        .single()

      // Previously `if (student)` with no error branch, so a failed read left
      // `profile` null and rendered an empty profile card full of em-dashes —
      // indistinguishable from a student who has genuinely filled in nothing.
      if (studentError || !student) {
        console.error("[profile] lookup failed:", studentError?.message ?? "no student row")
        setLoadError(studentError?.message ?? "No student record is linked to this account")
        setLoading(false)
        return
      }

      const { data: feeRows } = await supabase
        .from("fees")
        .select("course_slug")
        .eq("student_id", student.id)
      const courseSlugs = [...new Set([
        ...(feeRows ?? []).map((fee) => fee.course_slug),
        student.course_slug,
      ].filter((slug): slug is string => Boolean(slug)))]
      const { data: courseRows } = courseSlugs.length > 0
        ? await supabase.from("courses").select("slug, name").in("slug", courseSlugs)
        : { data: [] as { slug: string; name: string }[] }
      const courseName = courseSlugs
        .map((slug) => courseRows?.find((course) => course.slug === slug)?.name ?? slug)
        .join(", ")

      {
        const s = student
        const p: Profile = {
          name: s.full_name,
          id: s.id,
          email: s.email || "—",
          phone: s.phone,
          dob: formatDate(s.date_of_birth),
          address: s.address || "—",
          course: courseName || "—",
          branch: s.branches?.name || "—",
          joinDate: formatDate(s.enrollment_date),
          batchTime: s.batch_time || "—",
          fatherName: s.father_name || "—",
          fatherPhone: s.father_phone || "—",
          motherName: s.mother_name || "—",
          status: s.status ?? "Not set",
        }
        setProfile(p)
        setEditName(p.name)
        setEditEmail(s.email ?? "")
        setEditAddress(p.address)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [attempt])

  const handleSave = async () => {
    if (!editName.trim()) {
      toast("Name is required", { variant: "destructive" })
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from("students")
      .update({
        full_name: editName,
        email: editEmail.trim() || null,
        address: editAddress || null,
      })
      .eq("id", profile.id)

    if (error) {
      toast("Failed to save profile: " + error.message, { variant: "destructive" })
      setSaving(false)
      return
    }

    await supabase.auth.updateUser({
      data: { full_name: editName },
    })

    setProfile({ ...profile, name: editName, email: editEmail.trim() || "—", address: editAddress })
    setEditOpen(false)
    setSaving(false)
    toast("Profile updated successfully", { variant: "success" })
  }

  const handleCancel = () => {
    setEditName(profile.name)
    setEditEmail(profile.email)
    setEditAddress(profile.address)
    setEditOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <QueryError
          what="your profile"
          detail={loadError}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <EmptyState
          title="No profile to show"
          description="We could not find a student record for this sign-in. If you have just registered, your enrollment may still be being set up — contact the institute."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        <div className="h-20 sm:h-28 bg-gradient-to-br from-primary/20 to-primary/5" />
        <CardContent className="relative px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 -mt-9 sm:-mt-10">
            <div className="relative self-center sm:self-auto">
              <div className="flex size-18 sm:size-20 items-center justify-center rounded-full border-4 border-background bg-muted text-xl sm:text-2xl font-bold" style={{ width: "5rem", height: "5rem" }}>
                {profile.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <button className="absolute bottom-0 right-0 size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Camera className="size-4" />
              </button>
            </div>
            <div className="flex-1 text-center sm:text-left pb-1">
              <h1 className="text-lg sm:text-xl font-bold">{profile.name}</h1>
              <p className="text-xs text-muted-foreground">{profile.id}</p>
            </div>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 self-center sm:self-auto" />}>
                <Edit className="size-3.5" />
                <span className="hidden sm:inline">Edit Profile</span>
                <span className="sm:hidden">Edit</span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Phone (login number)</Label>
                    <Input id="profile-phone" value={profile.phone} readOnly />
                    <p className="text-xs text-muted-foreground">Contact administration to change the sign-in number.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input id="edit-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 justify-center sm:justify-start">
            <Badge variant="secondary" className="text-[11px] sm:text-xs">{profile.course}</Badge>
            <Badge variant="secondary" className="text-[11px] sm:text-xs">{profile.branch}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600 text-[11px] sm:text-xs">{profile.status}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm sm:text-base font-semibold mb-3">Personal Information</h2>
            <div className="divide-y divide-border">
              {[
                { icon: Mail, label: "Email", value: profile.email },
                { icon: Phone, label: "Phone", value: profile.phone },
                { icon: Calendar, label: "Date of Birth", value: profile.dob },
                { icon: MapPin, label: "Address", value: profile.address },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3">
                  <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <row.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="text-xs sm:text-sm truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm sm:text-base font-semibold mb-3">Course Details</h2>
            <div className="divide-y divide-border">
              {[
                { icon: BookOpen, label: "Course", value: profile.course },
                { icon: MapPin, label: "Branch", value: profile.branch },
                { icon: Calendar, label: "Join Date", value: profile.joinDate },
                { icon: UserCircle, label: "Batch Time", value: profile.batchTime },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3">
                  <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <row.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="text-xs sm:text-sm truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold mb-3">Parent / Guardian</h2>
          <div className="grid sm:grid-cols-3 gap-1 sm:gap-4 divide-y sm:divide-y-0 divide-border">
            {[
              { icon: UserCircle, label: "Father's Name", value: profile.fatherName },
              { icon: Phone, label: "Father's Phone", value: profile.fatherPhone },
              { icon: UserCircle, label: "Mother's Name", value: profile.motherName },
            ].map((row) => (
              <div key={row.label} className="sm:px-4 first:sm:pl-0 py-2.5 sm:py-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="size-8 sm:size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <row.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="text-xs sm:text-sm truncate">{row.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="space-y-2">
        <Link href="/student/certificates">
          <button className="flex w-full items-center justify-between rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Award className="size-4 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Certificates</p>
                <p className="text-[11px] text-muted-foreground">View & download certificates</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </Link>
        <Link href="/student/profile/payments">
          <button className="flex w-full items-center justify-between rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <CreditCard className="size-4 text-violet-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Payment History</p>
                <p className="text-[11px] text-muted-foreground">Receipts & transactions</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </Link>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 text-destructive hover:text-destructive"
        onClick={() => setSignOutDialogOpen(true)}
        disabled={signingOut}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>

      <Dialog
        open={signOutDialogOpen}
        onOpenChange={(open) => {
          if (!signingOut) setSignOutDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will be signed out of this device. You can sign back in anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutDialogOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut && <Loader2 className="size-4 animate-spin" />}
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
