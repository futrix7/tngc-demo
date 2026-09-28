"use client"

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"

type ToastOptions = {
  variant?: "default" | "success" | "destructive" | "info" | "warning"
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

function toast(message: string, opts?: ToastOptions) {
  const options = {
    description: opts?.description,
    duration: opts?.duration,
    onDismiss: opts?.onDismiss,
    ...(opts?.action ? { action: opts.action } : {}),
  }

  switch (opts?.variant) {
    case "success":
      sonnerToast.success(message, options)
      break
    case "destructive":
      sonnerToast.error(message, options)
      break
    case "info":
      sonnerToast.info(message, options)
      break
    case "warning":
      sonnerToast.warning(message, options)
      break
    default:
      sonnerToast(message, options)
  }
}

function useToast() {
  return { toast }
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="bottom-right"
        theme="system"
        closeButton
        duration={4000}
        offset={16}
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
          },
        }}
      />
    </>
  )
}

export { toast, useToast, ToastProvider }
export type { ToastOptions }
