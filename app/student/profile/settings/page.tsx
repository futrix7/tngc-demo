"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/sonner"
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Bell,
  Lock,
  LogOut,
  ChevronRight,
  Smartphone,
  MessageSquare,
  Mail,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { ROLE_LOGIN } from "@/hooks/use-auth"

const themeOptions = [
  { value: "light", label: "Light", icon: Sun, description: "Light mode" },
  { value: "dark", label: "Dark", icon: Moon, description: "Dark mode" },
  { value: "system", label: "System", icon: Monitor, description: "Follow device setting" },
] as const

interface NotificationSettings {
  push: boolean
  email: boolean
  sms: boolean
  whatsapp: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  push: true,
  email: false,
  sms: true,
  whatsapp: false,
}

export default function StudentSettings() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS
    try {
      const saved = localStorage.getItem("tngc_student_notifications")
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS
    } catch {
      return DEFAULT_NOTIFICATIONS
    }
  })
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const updateNotification = (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...notifications, [key]: value }
    setNotifications(updated)
    localStorage.setItem("tngc_student_notifications", JSON.stringify(updated))
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast("Password must be at least 6 characters", { variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", { variant: "destructive" })
      return
    }
    if (!currentPassword) {
      toast("Please enter your current password", { variant: "destructive" })
      return
    }
    setPasswordLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    })

    if (verifyError) {
      toast("Current password is incorrect", { variant: "destructive" })
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      toast("Failed to update password: " + error.message, { variant: "destructive" })
      setPasswordLoading(false)
      return
    }

    toast("Password updated successfully", { variant: "success" })
    setPasswordDialogOpen(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace(ROLE_LOGIN.student)
  }

  const toggleItems = [
    {
      key: "push" as const,
      icon: Bell,
      title: "Push Notifications",
      desc: "Class reminders & fee alerts",
    },
    {
      key: "email" as const,
      icon: Mail,
      title: "Email Alerts",
      desc: "Receipts & announcements",
    },
    {
      key: "sms" as const,
      icon: Smartphone,
      title: "SMS Notifications",
      desc: "Important updates via SMS",
    },
    {
      key: "whatsapp" as const,
      icon: MessageSquare,
      title: "WhatsApp Notifications",
      desc: "Quick alerts on WhatsApp",
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <Link href="/student/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back to Profile
      </Link>

      <div>
        <h1 className="text-lg sm:text-xl font-bold">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Manage your app preferences</p>
      </div>

      {/* Theme */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-3">Appearance</h2>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const Icon = opt.icon
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value as "light" | "dark" | "system")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold">Notifications</h2>

          {toggleItems.map((item) => {
            const Icon = item.icon
            const isActive = notifications[item.key]
            return (
              <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => updateNotification(item.key, !isActive)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    isActive ? "bg-primary" : "bg-input"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    isActive ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-2">
          <h2 className="text-sm font-semibold mb-1">Account</h2>

          <button
            onClick={() => setPasswordDialogOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                <Lock className="size-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Change Password</span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setSignOutDialogOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                <LogOut className="size-4 text-red-600" />
              </div>
              <span className="text-sm font-medium">Sign Out</span>
            </div>
            <ChevronRight className="size-4 text-red-600" />
          </button>
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground pb-4">
        TNGC Student Portal v1.0
      </p>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current and new password below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-red-500">Must be at least 6 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={passwordLoading}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={passwordLoading}>
              {passwordLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Out Dialog */}
      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign Out</DialogTitle>
            <DialogDescription>Are you sure you want to sign out of your account?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
