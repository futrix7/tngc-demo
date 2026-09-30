"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
}

/**
 * Reads the stored preference.
 *
 * "system" has to survive a reload. It used to be read as `saved === "dark" ||
 * saved === "light" ? saved : "light"`, which quietly rewrote anyone's choice of
 * "system" into "light" the moment the page was refreshed — so a dark-mode user
 * on a light-mode laptop got a white page and no way back from the toggle without
 * picking a fixed theme.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const saved = localStorage.getItem("theme")
  return saved === "dark" || saved === "light" || saved === "system" ? saved : "light"
}

/**
 * The theme actually painted.
 *
 * For "system" this asks the operating system rather than defaulting to light, so
 * the first paint after a reload matches the preference the user actually chose.
 */
function getInitialResolved(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => getInitialResolved(getInitialTheme()))

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
    const resolved = newTheme === "system" ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
