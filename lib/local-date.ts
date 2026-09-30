/**
 * Local calendar day as `YYYY-MM-DD`.
 *
 * `new Date().toISOString().split("T")[0]` is the obvious one-liner and it is
 * wrong for this app. `toISOString()` converts to UTC first, so in IST (UTC+5:30)
 * any time between midnight and 05:30 local comes back as *yesterday's* date. An
 * expense entered at 9 AM was stamped with the previous day, a payment dated
 * today came back as tomorrow's `payment_date` and tripped the "not in the
 * future" check, and a certificate issued in the early morning was dated the day
 * before.
 *
 * The institute operates in IST, so the local calendar day is the correct answer
 * everywhere. `toDateInputValue` is the same thing for `<input type="date">`
 * values, which is why they are one function.
 */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
