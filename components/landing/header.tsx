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
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 active:scale-95",
        white
          ? "border-white/30 text-white/80 hover:bg-white/15 hover:border-white/50 hover:text-white"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/8 hover:text-primary"
      )}
    >
      {!mounted
        ? <Monitor className="size-5" />
        : theme === "dark"
          ? <Sun className="size-5" />
          : <Moon className="size-5" />
      }
    </button>
  )
}

/* ─── Header ─────────────────────────────────────────────────────── */
export function Header() {
  const pathname  = usePathname()
  const isHome    = pathname === "/"
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // transparent = over the dark hero, only on home before scrolling
  const white = isHome && !scrolled
  const isActive = (href: string) => !href.includes("#") && href === pathname

  return (
    <header
      /**
       * Strategy: always `fixed`, always full-width.
       * We animate individual CSS properties (background, border-color,
       * box-shadow, padding) so the browser can interpolate smoothly.
       * No class-swap on background — that can't animate.
       */
      style={{
        backgroundColor: scrolled || !isHome
          ? "color-mix(in oklch, var(--background) 88%, transparent)"
          : "transparent",
        borderBottomColor: scrolled || !isHome
          ? "color-mix(in oklch, var(--border) 60%, transparent)"
          : "transparent",
        backdropFilter: scrolled || !isHome ? "blur(20px) saturate(1.4)" : "none",
        WebkitBackdropFilter: scrolled || !isHome ? "blur(20px) saturate(1.4)" : "none",
        boxShadow: scrolled || !isHome
          ? "0 4px 32px rgba(0,0,0,0.10)"
          : "none",
      }}
      className="fixed inset-x-0 top-0 z-50 border-b"
      /* All the animated properties use a single transition declaration */
      data-scrolled={scrolled ? "true" : "false"}
    >
      {/* Inline style for the transition — avoids Tailwind purging the arbitrary value */}
      <style>{`
        header[data-scrolled] {
          transition:
            background-color 400ms cubic-bezier(0.4, 0, 0.2, 1),
            border-bottom-color 400ms cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 400ms cubic-bezier(0.4, 0, 0.2, 1),
            backdrop-filter 400ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        header[data-scrolled] .header-accent {
          transition: opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Rainbow accent bar — fades in when solid */}
      <div
        className="header-accent h-[3px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500"
        style={{ opacity: scrolled || !isHome ? 1 : 0 }}
      />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">

        {/* ── Logo ─────────────────────────────────────────────── */}
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl text-xs font-extrabold tracking-tight shadow-lg",
            "transition-all duration-300 group-hover:scale-105",
            white
              ? "bg-white text-indigo-700 shadow-white/20"
              : "bg-primary text-primary-foreground shadow-primary/25"
          )}>
            TNGC
          </div>
          <div>
            <p className={cn(
              "text-[15px] font-extrabold leading-none tracking-tight transition-colors duration-300",
              white ? "text-white" : "text-foreground"
            )}>
              The New Generation
            </p>
            <p className={cn(
              "mt-0.5 text-[11px] font-medium transition-colors duration-300",
              white ? "text-white/55" : "text-muted-foreground"
            )}>
              Computers · Hyderabad
            </p>
          </div>
        </Link>

        {/* ── Desktop nav (lg+) ─────────────────────────────────── */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-4 py-2.5 text-[15px] font-semibold",
                "transition-all duration-200",
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

        {/* ── Desktop CTA (lg+) ─────────────────────────────────── */}
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

        {/* ── Tablet nav (md–lg) ────────────────────────────────── */}
        <nav className="hidden items-center gap-0.5 md:flex lg:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                white
                  ? "text-white/80 hover:bg-white/12 hover:text-white"
                  : "text-foreground/70 hover:bg-primary/8 hover:text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ── Mobile / tablet right ─────────────────────────────── */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <ThemeToggle white={white} />

          <Link
            href="/auth/user/register"
            className={cn(
              "hidden sm:inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold",
              "shadow-lg transition-all duration-200 hover:scale-[1.04]",
              white
                ? "bg-white text-indigo-700 shadow-white/15 hover:bg-white/92"
                : cn(buttonVariants(), "h-10 px-5 shadow-primary/20")
            )}
          >
            <Sparkles className="size-4" />
            Register
          </Link>

          {/* Hamburger */}
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border",
                "transition-all duration-200 active:scale-95",
                white
                  ? "border-white/30 text-white hover:bg-white/12 hover:border-white/50"
                  : "border-border text-foreground hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
              )}
            >
              <Menu className="size-5" />
            </SheetTrigger>

            <SheetContent
              side="right"
              showCloseButton={false}
              className="flex w-full max-w-[300px] flex-col p-0 sm:max-w-sm"
            >
              <div className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

              <SheetHeader className="shrink-0 border-b border-border px-5 py-5">
                <SheetTitle>
                  <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-extrabold shadow-md shadow-primary/25">
                        TNGC
                      </div>
                      <div>
                        <p className="text-base font-extrabold leading-tight text-foreground">
                          The New Generation
                        </p>
                        <p className="text-[11px] text-muted-foreground">Computers · Hyderabad</p>
                      </div>
                    </Link>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Navigation
                </p>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold",
                      "transition-all duration-150 hover:bg-primary/8 hover:text-primary",
                      isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/80"
                    )}
                  >
                    <GraduationCap className="size-4 shrink-0 text-primary/50" />
                    {link.label}
                    <ChevronRight className="ml-auto size-3.5 text-muted-foreground/40" />
                  </Link>
                ))}
              </nav>

              <div className="shrink-0 space-y-3 border-t border-border px-4 py-5">
                <a
                  href="tel:8143248778"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-12 w-full justify-center gap-2 rounded-xl text-base font-semibold"
                  )}
                >
                  <Phone className="size-5" />
                  Call: 8143248778
                </a>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/auth/user/login"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-12 justify-center gap-2 rounded-xl text-base font-semibold"
                    )}
                  >
                    <LogIn className="size-5" />
                    Login
                  </Link>
                  <Link
                    href="/auth/user/register"
                    className={cn(
                      buttonVariants(),
                      "h-12 justify-center gap-2 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
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
