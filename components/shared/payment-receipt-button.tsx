"use client"

import { useState } from "react"
import { Download, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/sonner"
import {
  downloadPaymentReceiptPdf,
  openPrintWindow,
  renderPaymentReceipt,
  type PaymentReceipt,
} from "@/lib/print-report"

interface PaymentReceiptButtonProps {
  receipt: PaymentReceipt
  className?: string
}

export function PaymentReceiptButton({ receipt, className }: PaymentReceiptButtonProps) {
  const { toast } = useToast()
  const [busyAction, setBusyAction] = useState<"print" | "download" | null>(null)

  function handlePrint() {
    if (busyAction) return
    const win = openPrintWindow("Payment document")
    if (!win) {
      toast("Your browser blocked the print window. Allow pop-ups for this site and try again.", {
        variant: "destructive",
        duration: 8000,
      })
      return
    }

    setBusyAction("print")
    try {
      renderPaymentReceipt(win, receipt)
    } catch (error) {
      console.error("Unable to prepare the payment document:", error)
      win.close()
      toast("We couldn't prepare this payment document. Please try again.", { variant: "destructive" })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDownload() {
    if (busyAction) return
    setBusyAction("download")

    try {
      await downloadPaymentReceiptPdf(receipt)
    } catch (error) {
      console.error("Unable to download the payment document:", error)
      toast("We couldn't download this payment document. Please try again.", { variant: "destructive" })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={receipt.kind === "payment" ? "Print payment receipt" : "Print installment statement"}
        aria-label={receipt.kind === "payment" ? "Print payment receipt" : "Print installment statement"}
        onClick={handlePrint}
        disabled={busyAction !== null}
      >
        {busyAction === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Download PDF"
        aria-label="Download PDF"
        onClick={handleDownload}
        disabled={busyAction !== null}
      >
        {busyAction === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      </Button>
    </div>
  )
}
