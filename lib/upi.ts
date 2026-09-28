/**
 * The institute's UPI details, in one place.
 *
 * Every surface that asks for money needs the same three facts — who to pay, the
 * payee name to show, and a QR encoding both. They were previously inline
 * `process.env` reads with a hardcoded fallback repeated at each site, so the
 * student portal, the registration form and the marketing pages could each
 * disagree about where the money goes.
 *
 * NEXT_PUBLIC_ is deliberate: these are inlined at build time so the values are
 * readable in a client component without a server round trip. Neither value is
 * a secret — a UPI ID has to be printed on a QR code for anyone to scan it.
 */

/**
 * The institute's mobile number, which doubles as the UPI ID.
 *
 * The fallback is the institute's real published number, not a placeholder: it
 * is already hardcoded across the marketing pages (header, footer, contact CTA,
 * course pages) as the public contact number, so leaving it unset here would
 * blank the QR code while the same number stayed on screen two clicks away.
 */
const DEFAULT_UPI_ID = "8143248778"
const DEFAULT_UPI_NAME = "TNGC Computers"

export const UPI_ID = (process.env.NEXT_PUBLIC_UPI_ID || "").trim() || DEFAULT_UPI_ID

export const UPI_PAYEE_NAME =
  (process.env.NEXT_PUBLIC_UPI_NAME || "").trim() || DEFAULT_UPI_NAME

/**
 * The number as a 10-digit mobile, for the `tel:` link and the copy button.
 *
 * A UPI ID is normally `someone@bank`; this one is a bare mobile number, so
 * there is nothing to strip. Guarded anyway rather than assumed, because a
 * malformed `tel:` href is a dead link on a phone and a pasted string that
 * cannot be dialled — the two things a student standing at the counter needs.
 */
export const UPI_CONTACT_NUMBER = /\d{10}$/.test(UPI_ID) ? UPI_ID : DEFAULT_UPI_ID

/**
 * Builds a `upi://` URI for a UPI app to open.
 *
 * The payee name is percent-encoded with `encodeURIComponent`, which turns a
 * space into `%20`. Building this by hand rather than with `URLSearchParams`
 * because that encodes a space as `+`, and a `+` in the payee name is read
 * literally by some UPI apps — the QR then scans and the app still shows a
 * garbled payee.
 *
 * `amount` is omitted rather than sent as zero when it is unknown: a QR
 * pre-filled with `am=0.00` opens a payment that is already wrong, and the
 * student is better off typing the figure. Two decimal places, because the UPI
 * spec expects them and a whole-number amount is what the registration form
 * used to send.
 */
export function buildUpiUri(amount?: number | null): string {
  const parts = [
    `pa=${encodeURIComponent(UPI_ID)}`,
    `pn=${encodeURIComponent(UPI_PAYEE_NAME)}`,
    "cu=INR",
  ]

  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    parts.push(`am=${amount.toFixed(2)}`)
  }

  return `upi://pay?${parts.join("&")}`
}
