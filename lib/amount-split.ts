import { MAX_SPLIT_PARTS } from "@/components/shared/amount-split"

/**
 * Reads a split an HTTP caller sent into the numbers a database function wants.
 *
 * The rule the institute works to is that an amount is never divided without
 * somebody choosing the parts: there is no "split evenly" fallback here, and a
 * missing or malformed entry is an error rather than something to guess at. That
 * matters because the guess is what produced invoices carrying thirds of a fee
 * that the student never agreed to.
 *
 * `values` is the raw JSON array. Blank, absent and empty arrays all mean the
 * same thing — no split, so the caller should pass NULL and let the database
 * build a single line for the full amount.
 */
export function parseAmountSplit(values: unknown): {
  amounts: number[] | null
  error: string | null
} {
  if (values === undefined || values === null) {
    return { amounts: null, error: null }
  }

  if (!Array.isArray(values)) {
    return { amounts: null, error: "Amounts must be sent as a list." }
  }

  const filled = values.filter(
    (value) => value !== null && value !== undefined && value !== ""
  )

  // An all-blank list is what a form with every box empty sends. It is not a
  // mistake, it is the "one amount, not a split" answer.
  if (filled.length === 0) {
    return { amounts: null, error: null }
  }

  if (filled.length !== values.length) {
    return {
      amounts: null,
      error: "Leave every amount blank, or fill in all of them.",
    }
  }

  if (filled.length > MAX_SPLIT_PARTS) {
    return {
      amounts: null,
      error: `An amount can be split at most ${MAX_SPLIT_PARTS} ways.`,
    }
  }

  const amounts: number[] = []

  for (const value of filled) {
    const amount = typeof value === "number" ? value : Number(value)

    if (!Number.isFinite(amount) || amount <= 0) {
      return { amounts: null, error: "Every amount must be a number above zero." }
    }

    amounts.push(Number(amount.toFixed(2)))
  }

  return { amounts, error: null }
}

/**
 * Reads the single figure a caller says they are paying now.
 *
 * A payment is one number, never a list of boxes. "Paying 2,000 of 5,000" is one
 * fact; the second, competing set of boxes that used to sit next to the schedule
 * was how the same payment ended up described two different ways on one screen.
 * Blank, absent and empty all mean the same thing — nothing is being paid yet,
 * so the caller passes NULL and the fee is simply left open.
 */
export function parseSingleAmount(value: unknown): {
  amount: number | null
  error: string | null
} {
  if (value === undefined || value === null || value === "") {
    return { amount: null, error: null }
  }

  const amount = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return { amount: null, error: "The amount paid must be a number above zero." }
  }

  return { amount: Number(amount.toFixed(2)), error: null }
}

/**
 * Checks a payment figure against what is owed. Paying less than the fee is the
 * whole point — the student comes back when they can and hands over whatever
 * they have — so only "more than the fee" is a mistake here.
 */
export function checkAmountAgainstTotal(amount: number | null, total: number): string | null {
  if (amount === null) return null

  if (amount > total + 0.005) {
    return `₹${amount.toLocaleString("en-IN")} is more than the ₹${total.toLocaleString("en-IN")} owed.`
  }

  return null
}

/**
 * Checks a schedule against the fee it is supposed to cover.
 *
 * Exact, always: the parts have to add up to the fee, or the fee balance would
 * not match the sum of its installments. There used to be a second, looser mode
 * here for payments, which paid less than a fee being the point — that moved to
 * `checkAmountAgainstTotal`, since a payment is one figure rather than a list.
 */
export function checkAmountSplitAgainst(amounts: number[] | null, total: number): string | null {
  if (!amounts) return null

  const sum = Number(amounts.reduce((running, amount) => running + amount, 0).toFixed(2))

  if (Math.abs(sum - total) > 0.005) {
    return `The parts must add up to ₹${total.toLocaleString("en-IN")}. They add up to ₹${sum.toLocaleString("en-IN")}.`
  }

  return null
}
