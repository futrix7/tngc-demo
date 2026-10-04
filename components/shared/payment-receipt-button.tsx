"use client"

import { useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/sonner"
import {
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
  const [isPrinting, setIsPrinting] = useState(false)

  function handlePrint() {
    if (isPrinting) return
    const win = openPrintWindow("Fee Receipt")
    if (!win) {
      toast("Your browser blocked the print window. Allow pop-ups for this site and try again.", {
        variant: "destructive",
        duration: 8000,
      })
      return
    }

    setIsPrinting(true)
    try {
      renderPaymentReceipt(win, receipt)
    } catch (error) {
      console.error("Unable to prepare the payment document:", error)
      win.close()
      toast("We couldn't prepare this payment document. Please try again.", { variant: "destructive" })
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Print fee receipt"
        aria-label="Print fee receipt"
        onClick={handlePrint}
        disabled={isPrinting}
      >
        {isPrinting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
      </Button>
    </div>
  )
}
