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
