"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, RefreshCw, WifiOff } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/sonner"
import { toErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

type PortalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
  /** Home route for the portal, offered as the escape hatch. */
  homeHref: string
  homeLabel: string
}

/**
 * Route-level error boundary shared by both portals.
 *
 * React strips the message of a server-thrown error in production and passes a
 * `digest` instead, so this never renders `error.message` to the user: a raw
 * message could leak internals. The digest is shown so a report can be traced
 * back to the server log, and the full error is logged once on the client.
 */
export function PortalError({ error, reset, homeHref, homeLabel }: PortalErrorProps) {
  const isNetworkError = /fetch|network|load failed/i.test(error.message)

  useEffect(() => {
    console.error("[ui] route error:", error)
    toast(toErrorMessage(error, "This page ran into a problem."), { variant: "destructive" })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            {isNetworkError ? (
              <WifiOff className="size-7 text-destructive" />
            ) : (
              <AlertTriangle className="size-7 text-destructive" />
            )}
          </div>
          <CardTitle className="text-xl font-bold">
            {isNetworkError ? "Can't reach the server" : "This page ran into a problem"}
          </CardTitle>
          <CardDescription>
            {isNetworkError
              ? "Check your internet connection, then try again."
              : "The error has been logged. You can retry, or head back to the dashboard."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button className="h-10 w-full gap-2" onClick={reset}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Link
            href={homeHref}
            className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}
          >
            {homeLabel}
          </Link>
          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type PortalLoadingProps = {
  label?: string
}

/** Suspense fallback for portal routes, so navigation never shows a blank frame. */
export function PortalLoading({ label = "Loading..." }: PortalLoadingProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  )
}
