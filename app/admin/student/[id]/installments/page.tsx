"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  IndianRupee,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Banknote,
  Calendar,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { useStudent } from "../layout"

interface Installment {
  id: string
  label: string
  amount: number
  dueDate: string
  paidDate: string | null
  status: "Paid" | "Pending"
  feeId: string
}

interface CollectionRecord {
  id: string
  installmentLabel: string
  amount: number
  collectedDate: string
  method: string
}

export default function StudentInstallmentsPage() {
  const student = useStudent()
  const { toast } = useToast()
  const [installments, setInstallments] = useState<Installment[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [totalFee, setTotalFee] = useState(0)
  const [collected, setCollected] = useState(0)
  const [loading, setLoading] = useState(true)

  const [collectOpen, setCollectOpen] = useState(false)
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [collectReference, setCollectReference] = useState("")
  const [collectMethod, setCollectMethod] = useState("Cash")
  const [collecting, setCollecting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!student) return

    const { data: feesRows } = await supabase
      .from("fees").select("id, total_fee, paid_amount").eq("student_id", student.id)

    if (feesRows && feesRows.length > 0) {
      const fTotal = feesRows.reduce((s, f) => s + (f.total_fee ?? 0), 0)
      const fPaid = feesRows.reduce((s, f) => s + (f.paid_amount ?? 0), 0)
      setTotalFee(fTotal)
      setCollected(fPaid)

      const feeIds = feesRows.map((f) => f.id)
      const { data: instRows } = await supabase
        .from("fee_installments").select("id, label, amount, due_date, paid_date, status, fee_id")
        .in("fee_id", feeIds).order("due_date", { ascending: true })

      if (instRows) {
        setInstallments(instRows.map((i) => ({
          id: i.id,
          label: i.label,
          amount: i.amount,
          dueDate: i.due_date,
          paidDate: i.paid_date,
          status: i.status === "Paid" ? "Paid" : "Pending",
          feeId: i.fee_id,
        })))
      }
    }

    const { data: payRows } = await supabase
      .from("payments").select("id, amount, payment_date, method, description")
      .eq("student_id", student.id)
      .eq("status", "Paid")
      .order("payment_date", { ascending: false })

    if (payRows) {
      setCollections(payRows.map((p) => ({
        id: p.id,
        installmentLabel: p.description ?? "Fee Payment",
        amount: p.amount,
        collectedDate: p.payment_date,
        method: p.method,
      })))
    }

    setLoading(false)
  }, [student])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchData()
  }, [fetchData])

  function openCollect(inst: Installment) {
    setSelectedInstallment(inst)
    setCollectReference("")
    setCollectMethod("Cash")
    setCollectOpen(true)
  }

  async function handleCollect() {
    if (!selectedInstallment || !student) return
    setCollecting(true)

    // One call, one transaction. This used to be three separate browser writes
    // whose errors were never checked: a payment row, an installment status, and
    // an incremented fees.paid_amount that never decremented pending_amount. Any
    // of them failing produced exactly the reported "marked paid but the payment
    // could not be recorded", and the toast claimed success either way.
    //
    // The amount is the installment's own, not the field below. A counter
    // collection settles an installment; if less than the full amount was taken,
    // the shortfall is a part payment and belongs in a different flow, not
    // silently recorded as if the installment were discharged.
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast("Your session has expired. Please sign in again.", { variant: "destructive" })
        return
      }

      const res = await fetch("/api/installments/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          installmentId: selectedInstallment.id,
          // Lowercased: the method buttons hold the display form ("UPI", "Cash"),
          // and the route validates against a lowercase pattern.
          method: collectMethod.toLowerCase(),
          reference: collectReference.trim(),
        }),
      })

      const json = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast(json.error ?? "We couldn't record that payment. Nothing was changed.", {
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      toast(`${selectedInstallment.label} marked paid, and the receipt was recorded.`, {
        variant: "success",
      })
      setCollectOpen(false)
      setCollectReference("")
      setLoading(true)
      fetchData()
    } catch {
      toast("We couldn't record that payment. Nothing was changed — please try again.", {
        variant: "destructive",
      })
    } finally {
      setCollecting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  const pending = installments.filter((i) => i.status === "Pending")
  const paid = installments.filter((i) => i.status === "Paid")
  const pendingAmount = totalFee - collected

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <IndianRupee className="size-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">₹{totalFee.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Fee</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 text-center">
            <Banknote className="size-6 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">₹{collected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Collected</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 text-center">
            <Clock className="size-6 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">₹{pendingAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Installments - Collection */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Pending Installments</h3>
            <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {pending.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Clock className="size-4 sm:size-5 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{inst.label}</p>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="size-3" />
                      Due: {inst.dueDate}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <p className="text-sm font-bold">₹{inst.amount.toLocaleString()}</p>
                  <Button
                    size="lg"
                    className="gap-1.5 px-4"
                    onClick={() => openCollect(inst)}
                  >
                    <Plus className="size-4" />
                    Collect
                  </Button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">All installments are paid!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paid Installments */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Paid Installments</h3>
            <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-600">{paid.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {paid.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CheckCircle2 className="size-4 sm:size-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{inst.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Paid: {inst.paidDate ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <p className="text-sm font-bold">₹{inst.amount.toLocaleString()}</p>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-600">Paid</Badge>
                </div>
              </div>
            ))}
            {paid.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No paid installments yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Collection History */}
      {collections.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 sm:p-5 pb-0">
              <h3 className="text-sm font-semibold">Collection History</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>For</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-xs">{c.installmentLabel}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{c.collectedDate}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{c.method}</TableCell>
                    <TableCell className="font-medium text-xs">₹{c.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Collect Dialog */}
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Banknote className="size-5 text-primary" />
              Collect Payment
            </DialogTitle>
            <DialogDescription>
              Collecting for: <span className="font-semibold text-foreground">{selectedInstallment?.label}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Read-only. The amount is the installment's own: a counter collection
                discharges an installment or it does not. The field used to be
                editable, which let an admin record a part payment as a full one and
                leave the balance silently wrong. */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Amount being collected</p>
              <p className="text-2xl font-extrabold">
                ₹{selectedInstallment?.amount.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "UPI", "Bank"].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={collectMethod === m ? "default" : "outline"}
                    size="lg"
                    onClick={() => setCollectMethod(m)}
                    className="gap-1.5"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collectReference" className="text-sm font-semibold">
                Reference (optional)
              </Label>
              <Input
                id="collectReference"
                value={collectReference}
                onChange={(e) => setCollectReference(e.target.value)}
                placeholder="Receipt or transaction number"
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="lg" onClick={() => setCollectOpen(false)} disabled={collecting} className="px-6">
              Cancel
            </Button>
            <Button size="lg" onClick={handleCollect} disabled={collecting} className="gap-2 px-6">
              {collecting ? <Loader2 className="size-5 animate-spin" /> : <Banknote className="size-5" />}
              {collecting
                ? "Recording..."
                : `Collect ₹${selectedInstallment?.amount.toLocaleString("en-IN")}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
