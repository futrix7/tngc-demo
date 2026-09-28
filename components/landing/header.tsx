"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Menu, Phone, Sun, Moon, Monitor,
  LogIn, Sparkles, GraduationCap, ChevronRight,
} from "lucide-react"
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

const navLinks = [
  { label: "Courses", href: "/#courses" },
  { label: "Staff",   href: "/#staff"   },
  { label: "Address", href: "/#address" },
  { label: "Contact", href: "/#contact" },
]

/* ─── Theme toggle ───────────────────────────────────────────────── */
function ThemeToggle({ white }: { white: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  return (
    <button
      onClick={() => mounted && setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 active:scale-95 sm:h-10 sm:w-10",
        white
          ? "border-white/30 text-white/80 hover:bg-white/15 hover:border-white/50 hover:text-white"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/8 hover:text-primary"
      )}
    >
      {!mounted
        ? <Monitor className="size-4 sm:size-5" />
        : theme === "dark"
          ? <Sun className="size-4 sm:size-5" />
          : <Moon className="size-4 sm:size-5" />
      }
    </button>
  )
}

/* ─── Header ─────────────────────────────────────────────────────── */
export function Header() {
  const pathname = usePathname()
  const isHome   = pathname === "/"
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const white    = isHome && !scrolled
  const isActive = (href: string) => !href.includes("#") && href === pathname

  return (
    <header
      style={{
        backgroundColor: scrolled || !isHome
          ? "color-mix(in oklch, var(--background) 88%, transparent)"
          : "transparent",
        borderBottomColor: scrolled || !isHome
          ? "color-mix(in oklch, var(--border) 60%, transparent)"
          : "transparent",
        backdropFilter:       scrolled || !isHome ? "blur(20px) saturate(1.4)" : "none",
        WebkitBackdropFilter: scrolled || !isHome ? "blur(20px) saturate(1.4)" : "none",
        boxShadow:            scrolled || !isHome ? "0 4px 32px rgba(0,0,0,0.10)" : "none",
      }}
      className="fixed inset-x-0 top-0 z-50 border-b"
      data-scrolled={scrolled ? "true" : "false"}
    >
      <style>{`
        header[data-scrolled] {
          transition:
            background-color 400ms cubic-bezier(0.4,0,0.2,1),
            border-bottom-color 400ms cubic-bezier(0.4,0,0.2,1),
            box-shadow 400ms cubic-bezier(0.4,0,0.2,1),
            backdrop-filter 400ms cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>

      {/* ── Single row, three columns: logo | nav | actions ─────── */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3 lg:px-8 lg:py-3.5">

        {/* ── Logo ─────────────────────────────────────────────── */}
        <Link href="/" className="group flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Badge — always visible */}
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            "text-[10px] font-extrabold tracking-tight shadow-lg",
            "transition-all duration-300 group-hover:scale-105",
            "sm:h-11 sm:w-11 sm:text-xs",
            white
              ? "bg-white text-indigo-700 shadow-white/20"
              : "bg-primary text-primary-foreground shadow-primary/25"
          )}>
            TNGC
          </div>

          {/* Text — hidden on mobile (xs), shown from sm */}
          <div className="hidden sm:block">
            <p className={cn(
              "text-[14px] font-extrabold leading-none tracking-tight transition-colors duration-300 sm:text-[15px]",
              white ? "text-white" : "text-foreground"
            )}>
              The New Generation
            </p>
            <p className={cn(
              "mt-0.5 text-[10px] font-medium transition-colors duration-300 sm:text-[11px]",
              white ? "text-white/55" : "text-muted-foreground"
            )}>
              Computers · Hyderabad
            </p>
          </div>

          {/* Short label — only on mobile instead of the full text */}
          <p className={cn(
            "block text-sm font-extrabold tracking-tight transition-colors duration-300 sm:hidden",
            white ? "text-white" : "text-foreground"
          )}>
            TNGC
          </p>
        </Link>

        {/* ── Desktop nav (lg+) ─────────────────────────────────── */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-all duration-200",
                white
                  ? isActive(link.href)
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/12 hover:text-white"
                  : isActive(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-primary/8 hover:text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ── Tablet nav (md only) ──────────────────────────────── */}
        <nav className="hidden items-center gap-0.5 md:flex lg:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                white
                  ? "text-white/80 hover:bg-white/12 hover:text-white"
                  : "text-foreground/70 hover:bg-primary/8 hover:text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ── Desktop actions (lg+) ─────────────────────────────── */}
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle white={white} />
          <Link
            href="/auth/user/login"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold",
              "transition-all duration-200 hover:scale-[1.03]",
              white
                ? "border border-white/35 text-white hover:bg-white/12 hover:border-white/55"
                : cn(buttonVariants({ variant: "outline" }), "h-11 px-6")
            )}
          >
            <LogIn className="size-4" />
            Login
          </Link>
          <Link
            href="/auth/user/register"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-7 text-[15px] font-bold shadow-xl",
              "transition-all duration-200 hover:scale-[1.04]",
              white
                ? "bg-white text-indigo-700 shadow-white/15 hover:bg-white/92"
                : cn(buttonVariants(), "h-11 px-7 shadow-primary/25")
            )}
          >
            <Sparkles className="size-4" />
            Register Free
          </Link>
        </div>

        {/* ── Mobile + tablet right actions (< lg) ─────────────── */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <ThemeToggle white={white} />

          {/* Hamburger — always visible on < lg */}
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl border",
                "transition-all duration-200 active:scale-95 sm:h-10 sm:w-10",
                white
                  ? "border-white/30 text-white hover:bg-white/12 hover:border-white/50"
                  : "border-border text-foreground hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
              )}
            >
              <Menu className="size-5" />
            </SheetTrigger>

            {/* ── Drawer ─────────────────────────────────────────── */}
            <SheetContent
              side="right"
              showCloseButton={false}
              className="flex w-[85vw] max-w-xs flex-col p-0"
            >
              {/* Drawer header */}
              <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
                <SheetTitle>
                  <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-[11px] font-extrabold shadow-md shadow-primary/25">
                        TNGC
                      </div>
                      <div>
                        <p className="text-base font-extrabold leading-tight text-foreground">
                          The New Generation
                        </p>
                        <p className="text-xs text-muted-foreground">Computers · Hyderabad</p>
                      </div>
                    </Link>
                  </div>
                </SheetTitle>
              </SheetHeader>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-3 py-3">
                <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Navigation
                </p>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold",
                      "transition-all duration-150 hover:bg-primary/8 hover:text-primary",
                      isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/80"
                    )}
                  >
                    <GraduationCap className="size-4 shrink-0 text-primary/50" />
                    {link.label}
                    <ChevronRight className="ml-auto size-4 text-muted-foreground/35" />
                  </Link>
                ))}
              </nav>

              {/* Drawer footer actions */}
              <div className="shrink-0 space-y-3 border-t border-border px-4 py-5">
                <a
                  href="tel:8143248778"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-12 w-full justify-center gap-2 rounded-xl text-[15px] font-semibold"
                  )}
                >
                  <Phone className="size-5" />
                  8143248778
                </a>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/auth/user/login"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-12 justify-center gap-2 rounded-xl text-[15px] font-semibold"
                    )}
                  >
                    <LogIn className="size-5" />
                    Login
                  </Link>
                  <Link
                    href="/auth/user/register"
                    className={cn(
                      buttonVariants(),
                      "h-12 justify-center gap-2 rounded-xl text-[15px] font-bold shadow-lg shadow-primary/20"
                    )}
                  >
                    <Sparkles className="size-5" />
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
