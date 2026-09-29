"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CreditCard,
  Wallet,
  BarChart3,
  Menu,
  X,
  Sun,
  Moon,
  Video,
  Award,
  IndianRupee,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/admin/bottom-nav"
import { AuthGuard } from "@/components/auth/auth-guard"
import { SignOutButton } from "@/components/auth/sign-out-button"

const sidebarLinks = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/admin/student", icon: Users },
  { label: "Teachers", href: "/admin/teacher", icon: GraduationCap },
  { label: "Courses", href: "/admin/course", icon: BookOpen },
  { label: "Installments", href: "/admin/installments", icon: IndianRupee },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Finance", href: "/admin/finanace", icon: Wallet },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
  { label: "Videos", href: "/admin/videos", icon: Video },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {mounted
        ? (theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />)
        : <Sun className="size-4" />
      }
      {mounted
        ? (theme === "dark" ? "Light Mode" : "Dark Mode")
        : "Dark Mode"
      }
    </button>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard role="admin">
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary px-1 py-0.5 text-primary-foreground text-[10px] font-extrabold">
              TNGC
            </div>
            <span className="text-sm font-bold text-foreground">Admin Panel</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <ThemeToggle />
          <SignOutButton role="admin" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-10 items-center border-b border-border bg-card px-4 sm:px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">{children}</main>
      </div>

      <BottomNav />
    </div>
    </AuthGuard>
  )
}
