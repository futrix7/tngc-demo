"use client"

import { AlertTriangle, RefreshCw, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Query-level failure and empty states for the student portal.
 *
 * `app/student/error.tsx` catches a *thrown* error, but nothing here throws: the
 * portal reads through `supabase-js`, which resolves a failed query into
 * `{ data: null, error }` rather than rejecting. So the route boundary never
 * fires and a failed read used to render as a page of zeroes — a real balance of
 * ₹0, a real attendance of 0%, a real "no certificates" — which reads as fact
 * rather than as a failure. These are the states that say otherwise.
 *
 * The wording is deliberately about what to do, not about what broke. "Couldn't
 * load your fee details" tells a student the number on the page is not to be
 * believed; "PostgREST error 42P01" tells them nothing they can act on. The
 * underlying message goes to the console, where it is useful.
 */

type QueryErrorProps = {
  /** What failed, in the user's terms: "your attendance records". */
  what: string
  /** Console-facing detail. Logged, never rendered. */
  detail?: string | null
  onRetry?: () => void
  className?: string
}

/** Shown when a read failed. Distinct from empty: something is wrong, not absent. */
export function QueryError({ what, detail, onRetry, className }: QueryErrorProps) {
  if (detail) {
    console.error(`[portal] failed to load ${what}:`, detail)
  }

  return (
    <Card className={cn("border-destructive/40", className)}>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Couldn&apos;t load {what}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a problem on our side, not with your account. Nothing has been changed — try
            again in a moment.
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  /** Optional action, e.g. a link to the page that would fill this in. */
  action?: React.ReactNode
  className?: string
}

/** Shown when a read succeeded and there is genuinely nothing to show. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
