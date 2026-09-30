"use client"

import { ReactNode } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  icon: LucideIcon
  submitLabel: string
  onSubmit: () => void
  children: ReactNode
  contentClassName?: string
}

/**
 * Field sizing for the data-entry sheets (student, teacher, course).
 *
 * Two fields share a row there, so the default 40px control looked cramped at
 * half the sheet width. These override the component defaults — tailwind-merge
 * drops `h-10`/`h-11` and `md:text-sm` from the primitives when they collide —
 * giving 48px tall controls with 16px text that is readable on a phone.
 */
export const SHEET_INPUT_CLASS = "h-12 text-base md:text-base"
export const SHEET_SELECT_TRIGGER_CLASS = "data-[size=default]:h-12 text-base"
export const SHEET_SELECT_VALUE_CLASS = "text-base"
/** Native selects keep the same footprint as the React Select trigger. */
export const SHEET_NATIVE_SELECT_CLASS =
  "h-12 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
export const SHEET_TEXTAREA_CLASS =
  "w-full min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-base dark:bg-input/30"

export function FormSheet({
  open,
  onOpenChange,
  title,
  icon: Icon,
  submitLabel,
  onSubmit,
  children,
  contentClassName,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("gap-0", contentClassName)}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="size-5" />
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4 flex-1">
          {children}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>{submitLabel}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function FormField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
