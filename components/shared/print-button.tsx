"use client"

import { useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/sonner"
import { openPrintWindow, renderPrintReport, type PrintReport } from "@/lib/print-report"

interface PrintButtonProps {
  /**
   * Builds the sheet when clicked. Async on purpose: the rows often need a
   * query for the whole filtered set, not just the page on screen.
   */
  getReport: () => PrintReport | Promise<PrintReport>
  label?: string
  title?: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "xs" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  disabled?: boolean
}

/**
 * The print action, in the same place and shape on every payment and
 * installment screen. All it knows is how to ask for a `PrintReport`; what the
 * sheet contains is the page's business.
 */
export function PrintButton({
  getReport,
  label = "Print",
  title,
  className,
  variant = "outline",
  size = "sm",
  disabled = false,
}: PrintButtonProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy || disabled) return

    // Opened first, while the click is still the gesture that permits it. The
    // data can take longer to arrive than the browser allows a popup.
    const win = openPrintWindow(label)
    if (!win) {
      toast("Your browser blocked the print window. Allow pop-ups for this site and try again.", {
        variant: "destructive",
        duration: 8000,
      })
      return
    }

    setBusy(true)
    try {
      const report = await getReport()
      renderPrintReport(win, report)
    } catch (error) {
      console.error("Unable to prepare the printout:", error)
      win.close()
      toast("We couldn't prepare that printout. Please try again.", { variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      title={title ?? `Print ${label.toLowerCase()}`}
      onClick={handleClick}
      disabled={disabled || busy}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Printer />}
      {busy ? "Preparing..." : label}
    </Button>
  )
}
