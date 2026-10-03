import { Phone } from "lucide-react"
import { UPI_CONTACT_NUMBER } from "@/lib/upi"

export function UpiPayBlock() {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <a
        href={`tel:${UPI_CONTACT_NUMBER}`}
        className="inline-flex items-center gap-2 text-base font-bold text-foreground hover:underline"
      >
        <Phone className="size-4 shrink-0 text-primary" />
        {UPI_CONTACT_NUMBER}
      </a>
    </div>
  )
}
