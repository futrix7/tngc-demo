"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy, Phone, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { UPI_CONTACT_NUMBER, UPI_ID, UPI_PAYEE_NAME, buildUpiUri } from "@/lib/upi"
import { cn } from "@/lib/utils"

type UpiPayBlockProps = {
  /** Pre-fills the QR's amount field. Omit to leave the figure to the student. */
  amount?: number | null
  /** Extra guidance shown under the QR, e.g. what happens after scanning. */
  note?: string
  className?: string
}

/**
 * The institute's mobile number and a QR that opens a UPI payment to it.
 *
 * Both are shown because neither alone is enough at a counter. The number is
 * what a student reads out when the QR will not scan — a cracked screen, a
 * washed-out printout, an app that refuses the intent — and the QR is what
 * avoids a mistyped digit, which is the failure that has to be reconciled by
 * hand later.
 */
export function UpiPayBlock({ amount, note, className }: UpiPayBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyNumber = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable")
      }

      await navigator.clipboard.writeText(UPI_CONTACT_NUMBER)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Thrown when the page is not on a secure origin, or when the browser
      // withholds clipboard permission. Neither is worth an error dialog: the
      // number is on screen two lines up and long-pressable, so the toast says
      // what to do instead of reporting a failure the student cannot act on.
      toast("Couldn't copy automatically. Tap the number to select it.", {
        variant: "warning",
      })
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border bg-background p-5",
        className
      )}
    >
      <div className="rounded-lg bg-white p-2">
        <QRCodeSVG
          value={buildUpiUri(amount)}
          size={180}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
          includeMargin
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Scan with any UPI app</p>

      <a
        href={`tel:${UPI_CONTACT_NUMBER}`}
        className="mt-1 inline-flex items-center gap-1.5 text-base font-bold text-foreground hover:underline"
      >
        <Phone className="size-4 shrink-0 text-primary" />
        {UPI_CONTACT_NUMBER}
      </a>

      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Smartphone className="size-3 shrink-0" />
        Tap the number to call {UPI_PAYEE_NAME}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyNumber}
        className="mt-3 h-8 gap-1.5 text-xs"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy number"}
      </Button>

      {note && <p className="mt-3 text-center text-xs text-muted-foreground">{note}</p>}

      <p className="sr-only">UPI ID {UPI_ID}</p>
    </div>
  )
}
