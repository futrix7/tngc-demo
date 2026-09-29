"use client"

import { PortalError } from "@/components/portal-boundary"

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PortalError error={error} reset={reset} homeHref="/student/profile" homeLabel="Profile" />
  )
}
