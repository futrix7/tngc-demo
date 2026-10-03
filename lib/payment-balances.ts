export interface InstallmentPayment {
  installment_id: string | null
  amount: number
  status: string
}

export interface InstallmentPaymentTotals {
  paid: number
  pending: number
}

export function getInstallmentPaymentTotals(
  payments: readonly InstallmentPayment[]
): Map<string, InstallmentPaymentTotals> {
  const totals = new Map<string, InstallmentPaymentTotals>()

  for (const payment of payments) {
    if (!payment.installment_id || (payment.status !== "Paid" && payment.status !== "Pending")) {
      continue
    }

    const installmentTotals = totals.get(payment.installment_id) ?? { paid: 0, pending: 0 }
    if (payment.status === "Paid") {
      installmentTotals.paid += Number(payment.amount)
    } else {
      installmentTotals.pending += Number(payment.amount)
    }
    totals.set(payment.installment_id, installmentTotals)
  }

  return totals
}

export function getRemainingInstallmentBalance(
  amount: number,
  totals: InstallmentPaymentTotals = { paid: 0, pending: 0 }
): number {
  return Math.max(0, Number((amount - totals.paid - totals.pending).toFixed(2)))
}
