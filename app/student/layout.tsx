"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import {
  LayoutDashboard,
  CalendarCheck,
  Wallet,
  Megaphone,
  UserCircle,
  Sun,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/auth/auth-guard"

const navLinks = [
  { label: "Home", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
  { label: "Fee", href: "/student/fee", icon: Wallet },
  { label: "Notices", href: "/student/announcements", icon: Megaphone },
  { label: "Profile", href: "/student/profile", icon: UserCircle },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-9"
      aria-label="Toggle theme"
    >
      {mounted
        ? theme === "dark" ? <Sun className="size-5 md:size-4" /> : <Moon className="size-5 md:size-4" />
        : <Sun className="size-5 md:size-4" />
      }
    </button>
  )
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Marks a section live, not just the exact path. `/student/profile` is a real
  // destination and so are its children, and without this the pill highlighted
  // nothing at all while a student browsed their own profile.
  const isSectionActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <AuthGuard role="student">
    <div className="h-screen overflow-hidden bg-background">
      {/* Main content. pb reserves the height of the floating pill so the last
          card is never trapped underneath it. */}
      <main className="h-full overflow-y-auto pb-28">{children}</main>

      {/*
        One floating pill for every breakpoint, replacing the desktop sidebar and
        the separate mobile bottom bar.

        Centred rather than full-width: a bar stretched edge to edge on a
        desktop display puts "Home" 2000px away from "Profile" and reads as a
        phone layout stretched. The pill keeps the target next to the thumb and
        next to the pointer at the same time.

        Labels are hidden below md. Five labelled items plus the toggle measure
        ~620px, which overflows a 640-768px viewport and would either clip the
        pill or force a second row; icons alone fit from 320px up.
      */}
      <nav
        aria-label="Student portal"
        className="fixed bottom-4 left-1/2 z-40 max-w-[calc(100vw-1rem)] -translate-x-1/2 sm:bottom-6"
      >
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card/95 p-2 shadow-lg shadow-black/5 backdrop-blur-md dark:shadow-black/30">
          {navLinks.map((link) => {
            const active = isSectionActive(link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-medium transition-colors md:h-auto md:min-w-0 md:justify-start md:py-2",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="size-5 shrink-0 md:size-4" />
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            )
          })}
          <div className="mx-1 h-8 w-px shrink-0 bg-border md:h-6" />
          <ThemeToggle />
        </div>
      </nav>
    </div>
    </AuthGuard>
  )
}
