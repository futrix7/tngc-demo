"use client"

import { PortalError } from "@/components/portal-boundary"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PortalError error={error} reset={reset} homeHref="/admin/dashboard" homeLabel="Admin dashboard" />
}
