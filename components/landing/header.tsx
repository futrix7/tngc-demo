"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Phone, Sun, Moon, Monitor, LogIn, UserPlus } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const landingLinks = [
  { label: "Courses", href: "/courses" },
  { label: "Staff", href: "/#staff" },
  { label: "Address", href: "/#address" },
  { label: "Contact", href: "/#contact" },
]

const coursesLinks = [
  { label: "Home", href: "/" },
  { label: "Staff", href: "/#staff" },
  { label: "Address", href: "/#address" },
  { label: "Contact", href: "/#contact" },
]

function ThemeToggle({ overlay }: { overlay: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
        <Monitor className="size-4" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
        overlay
          ? "border border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

export function Header() {
  const pathname = usePathname()
  const isCoursesPage = pathname.startsWith("/courses")
  const navLinks = isCoursesPage ? coursesLinks : landingLinks

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Transparent/white-text style only applies over the home hero.
  // Everywhere else (courses, terms, privacy, or after scrolling) use the solid style.
  const overlay = pathname === "/" && !scrolled
  const solid = !overlay

  const isActive = (href: string) => !href.includes("#") && href === pathname

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border transition-all duration-300",
        solid
          ? "mx-2 mt-2 rounded-2xl border-border/50 bg-background/80 shadow-xl backdrop-blur-xl sm:mx-auto sm:mt-3 sm:w-[95%] sm:max-w-5xl lg:max-w-6xl"
          : "mx-4 mt-4 border-transparent bg-transparent sm:mx-auto sm:mt-6 sm:w-[95%] sm:max-w-7xl sm:rounded-b-2xl"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary px-1 py-0.5 text-primary-foreground text-[10px] font-extrabold sm:size-9">
            TNGC
          </div>
          <div className="hidden sm:block">
            <p
              className={cn(
                "text-sm font-bold leading-tight",
                overlay ? "text-white" : "text-foreground"
              )}
            >
              The New Generation
            </p>
            <p
              className={cn(
                "text-[10px] leading-tight",
                overlay ? "text-white/70" : "text-muted-foreground"
              )}
            >
              Computers
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                overlay
                  ? isActive(link.href)
                    ? "text-white bg-white/10"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                  : isActive(link.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle overlay={overlay} />
          <Link
            href="/auth/user/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5 text-sm",
              overlay
                ? "text-white/80 hover:text-white hover:bg-white/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogIn className="size-3.5" />
            Login
          </Link>
          <Link
            href="/auth/user/register"
            className={cn(
              buttonVariants({ size: "sm" }),
              "gap-1.5 text-sm",
              overlay && "bg-white text-black hover:bg-white/90"
            )}
          >
            <UserPlus className="size-3.5" />
            Register
          </Link>
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <ThemeToggle overlay={overlay} />
          <Sheet>
            <SheetTrigger
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
                overlay
                  ? "text-white hover:bg-white/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-[min(280px,calc(100vw-2rem))] p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary px-1 py-0.5 text-primary-foreground text-[10px] font-bold">
                    TNGC
                  </div>
                  Menu
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 overflow-y-auto px-3 py-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                      isActive(link.href)
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto border-t border-border px-4 py-4 space-y-2.5">
                <a
                  href="tel:8143248778"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center gap-2")}
                >
                  <Phone className="size-3.5" />
                  8143248778
                </a>
                <div className="flex gap-2">
                  <Link
                    href="/auth/user/login"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 inline-flex items-center justify-center gap-1.5")}
                  >
                    <LogIn className="size-3.5" />
                    Login
                  </Link>
                  <Link
                    href="/auth/user/register"
                    className={cn(buttonVariants({ size: "sm" }), "flex-1 inline-flex items-center justify-center gap-1.5")}
                  >
                    <UserPlus className="size-3.5" />
                    Register
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
