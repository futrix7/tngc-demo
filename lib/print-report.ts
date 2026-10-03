"use client"

/**
 * The one print layout used for every payment and installment record in the
 * portal.
 *
 * Each screen that shows money — the institute-wide payment ledger, the
 * installment schedule, a single student's payments, a student's own fee page —
 * describes what it wants printed as data (`PrintReport`) and hands it to this
 * module. The HTML, the page setup and the print dialog live here once, so a
 * statement printed from the counter and a statement printed by a student are
 * the same document.
 *
 * Deliberately string-built rather than rendered in the page: the printout has
 * to be a standalone A4 document with its own colours, borders and repeating
 * table headers, none of which survive printing the app's own DOM.
 */

export type PrintTone = "positive" | "warning" | "negative" | "muted" | "info"

/** A cell that needs more than plain text — a status, a balance, a warning. */
export interface PrintText {
  text: string
  tone?: PrintTone
}

export type PrintValue = string | number | boolean | null | undefined | PrintText

export interface PrintColumn {
  /** Key the column reads from each row. */
  key: string
  label: string
  align?: "left" | "right" | "center"
  /** Optional CSS width, e.g. "18%". Columns without one share what is left. */
  width?: string
}

export interface PrintSection {
  title?: string
  columns: PrintColumn[]
  rows: Array<Record<string, PrintValue>>
  /** Bold closing row. Keys missing here print an empty cell, not a dash. */
  totals?: Record<string, PrintValue>
  emptyText?: string
}

export interface PrintStat {
  label: string
  value: string
  tone?: PrintTone
}

export interface PrintMetaItem {
  label: string
  value: string
}

export interface PrintReport {
  title: string
  subtitle?: string
  /** What the sheet covers — student, filters, date range, record count. */
  meta?: PrintMetaItem[]
  /** Headline figures across the whole report, not just the visible page. */
  stats?: PrintStat[]
  /** One section per table. A schedule and its payment history sit side by side. */
  sections?: PrintSection[]
  /** Caveat printed under the tables, e.g. what "awaiting verification" means. */
  note?: string
}

export interface PaymentReceipt {
  kind: "payment" | "installment"
  documentNumber: string
  receiptSerial?: number | null
  statementSerial?: number | null
  date: string
  status: string
  studentName: string
  studentId: string
  studentPhone?: string | null
  course: string
  installment?: string | null
  dueDate?: string | null
  feeAmount: number
  transactionAmount?: number
  paidToDate: number
  awaitingVerification: number
  balanceDue: number
  method?: string | null
  reference?: string | null
  verifiedAt?: string | null
}

const INSTITUTE_NAME = "THE NEW GENERATION COMPUTERS"
const INSTITUTE_ADDRESS = "3-3-21/B, 1st Floor, Sharada Nagar, RTC Colony Road, Ramanthapur, Hyderabad - 500013"

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Reads a stored amount, a formatted "₹1,200" string, or nothing at all. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const text = typeof value === "object" && "text" in (value as Record<string, unknown>)
    ? String((value as Record<string, unknown>).text)
    : String(value)
  const parsed = Number(text.replace(/[₹,\s]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Indian-grouped rupees. Every money figure on a printout goes through here. */
export function inr(value: number | string | null | undefined): string {
  const amount = toNumber(value)
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

/**
 * "02 Oct 2026" from a stored date, whatever the column hands over.
 *
 * Parses the parts rather than `new Date(...)`, because the database stores
 * dates as `YYYY-MM-DD` and a timezone shift here would print a due date one
 * day earlier than the schedule says.
 */
export function printDate(value: string | null | undefined): string {
  if (!value) return "—"
  const match = ISO_DATE.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    .toLocaleString("en", { month: "short", timeZone: "UTC" })
  return `${day} ${monthName} ${year}`
}

/** Sums one column across the rows of a section, for its totals row. */
export function sumColumn(rows: Array<Record<string, PrintValue>>, key: string): number {
  return rows.reduce((sum, row) => sum + toNumber(row[key]), 0)
}

function readCell(value: PrintValue): PrintText {
  if (value === null || value === undefined || value === "") return { text: "—" }
  if (typeof value === "object") return { text: value.text || "—", tone: value.tone }
  if (typeof value === "boolean") return { text: value ? "Yes" : "No" }
  if (typeof value === "number") {
    return { text: value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) }
  }
  return { text: String(value) }
}

function alignClass(align: PrintColumn["align"]): string {
  if (align === "right") return "num"
  if (align === "center") return "mid"
  return ""
}

function sectionHtml(section: PrintSection): string {
  const columns = section.columns
  const headerCells = columns
    .map(
      (column) =>
        `<th class="${alignClass(column.align)}"${column.width ? ` style="width:${escapeHtml(column.width)}"` : ""}>${escapeHtml(column.label)}</th>`
    )
    .join("")

  const bodyRows =
    section.rows.length > 0
      ? section.rows
          .map((row) => {
            const cells = columns
              .map((column) => {
                const cell = readCell(row[column.key])
                const tone = cell.tone ? ` t-${cell.tone}` : ""
                return `<td class="${alignClass(column.align)}${tone}">${escapeHtml(cell.text)}</td>`
              })
              .join("")
            return `<tr>${cells}</tr>`
          })
          .join("")
      : `<tr><td class="empty" colspan="${columns.length}">${escapeHtml(section.emptyText ?? "No records found.")}</td></tr>`

  const totalsRow = section.totals
    ? `<tr class="totals">${columns
        .map((column) => {
          const present = Object.prototype.hasOwnProperty.call(section.totals, column.key)
          if (!present) return `<td class="${alignClass(column.align)}"></td>`
          const cell = readCell(section.totals![column.key])
          const tone = cell.tone ? ` t-${cell.tone}` : ""
          return `<td class="${alignClass(column.align)}${tone}">${escapeHtml(cell.text)}</td>`
        })
        .join("")}</tr>`
    : ""

  return `<section class="block">
      ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}${totalsRow}</tbody>
      </table>
    </section>`
}

function metaHtml(meta: PrintMetaItem[] | undefined): string {
  if (!meta || meta.length === 0) return ""
  return `<dl class="meta">${meta
    .map(
      (item) =>
        `<div class="meta-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value || "—")}</dd></div>`
    )
    .join("")}</dl>`
}

function statsHtml(stats: PrintStat[] | undefined): string {
  if (!stats || stats.length === 0) return ""
  return `<div class="stats">${stats
    .map(
      (stat) => `<div class="stat${stat.tone ? ` t-${stat.tone}` : ""}">
        <span class="stat-label">${escapeHtml(stat.label)}</span>
        <span class="stat-value">${escapeHtml(stat.value)}</span>
      </div>`
    )
    .join("")}</div>`
}

export function buildPrintReportHtml(report: PrintReport): string {
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const sections = (report.sections ?? []).map(sectionHtml).join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #fff;
      color: #18181b;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media screen { body { padding: 24px; background: #f4f4f5; } .sheet { background: #fff; } }
    .sheet { max-width: 100%; }

    .head { border-bottom: 2px solid #18181b; padding-bottom: 8px; }
    .brand-name { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: 0.06em; }
    .brand-sub { margin: 2px 0 0; font-size: 9.5px; color: #52525b; letter-spacing: 0.02em; }
    .heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-top: 10px; }
    h1 { margin: 0; font-size: 18px; line-height: 1.2; }
    .subtitle { margin: 3px 0 0; font-size: 11px; color: #52525b; }
    .generated { margin: 0; font-size: 9.5px; color: #52525b; text-align: right; white-space: nowrap; }

    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 6px 18px;
      margin: 10px 0 0;
      padding: 8px 0 0;
      border-top: 1px solid #e4e4e7;
    }
    .meta-item dt { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
    .meta-item dd { margin: 1px 0 0; font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .stat { border: 1px solid #d4d4d4; border-radius: 4px; padding: 6px 8px; }
    .stat-label { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
    .stat-value { display: block; margin-top: 2px; font-size: 15px; font-weight: 700; color: inherit; }

    .block { margin-top: 16px; break-inside: auto; }
    h2 {
      margin: 0 0 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #a1a1aa;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #d4d4d4; padding: 5px 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th {
      background: #f4f4f5;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #3f3f46;
    }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.mid, th.mid { text-align: center; }
    td.empty { padding: 16px 8px; text-align: center; color: #71717a; background: #fff; }
    tr.totals td { background: #f4f4f5 !important; font-weight: 700; border-top: 2px solid #18181b; }

    .t-positive { color: #047857; font-weight: 600; }
    .t-warning { color: #b45309; font-weight: 600; }
    .t-negative { color: #b91c1c; font-weight: 600; }
    .t-muted { color: #52525b; font-weight: 600; }
    .t-info { color: #0369a1; font-weight: 600; }

    .note { margin: 12px 0 0; font-size: 9.5px; color: #52525b; }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #d4d4d4;
      font-size: 9px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="head">
      <p class="brand-name">${INSTITUTE_NAME}</p>
      <p class="brand-sub">${INSTITUTE_ADDRESS}</p>
      <div class="heading">
        <div>
          <h1>${escapeHtml(report.title)}</h1>
          ${report.subtitle ? `<p class="subtitle">${escapeHtml(report.subtitle)}</p>` : ""}
        </div>
        <p class="generated">Generated<br />${escapeHtml(generatedAt)}</p>
      </div>
    </header>

    ${metaHtml(report.meta)}
    ${statsHtml(report.stats)}

    ${sections}

    ${report.note ? `<p class="note">${escapeHtml(report.note)}</p>` : ""}

    <footer class="foot">
      <span>${INSTITUTE_NAME}</span>
      <span>Computer-generated statement · For your records.</span>
    </footer>
  </div>
</body>
</html>`
}

function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - whole) * 100)
  const smallNumbers = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  function underThousand(value: number): string {
    const parts: string[] = []
    if (value >= 100) {
      parts.push(`${smallNumbers[Math.floor(value / 100)]} Hundred`)
      value %= 100
    }
    if (value >= 20) {
      const unit = value % 10
      parts.push(`${tens[Math.floor(value / 10)]}${unit ? ` ${smallNumbers[unit]}` : ""}`)
    } else if (value > 0 || parts.length === 0) {
      parts.push(smallNumbers[value])
    }
    return parts.join(" ")
  }

  function indianNumber(value: number): string {
    if (value === 0) return "Zero"
    const groups = [
      { size: 10000000, label: "Crore" },
      { size: 100000, label: "Lakh" },
      { size: 1000, label: "Thousand" },
      { size: 1, label: "" },
    ]
    let remaining = value
    const parts: string[] = []
    for (const group of groups) {
      const count = Math.floor(remaining / group.size)
      if (count > 0) {
        parts.push(`${underThousand(count)}${group.label ? ` ${group.label}` : ""}`)
        remaining %= group.size
      }
    }
    return parts.join(" ")
  }

  const rupees = `${indianNumber(whole)} Rupees`
  return paise ? `${rupees} and ${indianNumber(paise)} Paise Only` : `${rupees} Only`
}

function paymentDocumentNumber(receipt: PaymentReceipt): string {
  return receipt.kind === "payment"
    ? receipt.receiptSerial
      ? `TNGC-${String(receipt.receiptSerial).padStart(6, "0")}`
      : receipt.documentNumber
    : receipt.statementSerial
      ? `TNGC-S-${String(receipt.statementSerial).padStart(6, "0")}`
      : receipt.documentNumber
}

export function getPaymentReceiptFileName(receipt: PaymentReceipt): string {
  const title = receipt.kind === "payment"
    ? receipt.status === "Paid" ? "PAYMENT RECEIPT" : "PAYMENT ACKNOWLEDGEMENT"
    : "INSTALLMENT STATEMENT"
  const receiptDate = receipt.kind === "payment" ? receipt.date : new Date().toISOString().slice(0, 10)
  const fileDate = receiptDate.slice(0, 10).replace(/-/g, "")

  return [
    title,
    receipt.studentName,
    paymentDocumentNumber(receipt),
    fileDate,
  ]
    .map((part) => part.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").trim())
    .filter(Boolean)
    .join(" - ")
}

export async function downloadPaymentReceiptPdf(receipt: PaymentReceipt): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js")
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.position = "fixed"
  frame.style.left = "-10000px"
  frame.style.top = "0"
  frame.style.width = "210mm"
  frame.style.height = "297mm"
  frame.style.border = "0"

  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true })
  })
  document.body.appendChild(frame)

  try {
    const frameDocument = frame.contentDocument
    if (!frameDocument) throw new Error("Unable to access the receipt PDF document.")
    frameDocument.open()
    frameDocument.write(buildPaymentReceiptHtml(receipt, true))
    frameDocument.close()
    await loaded
    await frameDocument.fonts.ready

    const receiptElement = frameDocument.querySelector<HTMLElement>(".sheet")
    if (!receiptElement) throw new Error("The receipt content is missing.")

    await html2pdf()
      .set({
        filename: `${getPaymentReceiptFileName(receipt)}.pdf`,
        margin: 0,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          onclone: (clonedDocument: Document) => {
            clonedDocument.documentElement.style.color = "#172033"
            clonedDocument.body.style.color = "#172033"
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(receiptElement)
      .save()
  } finally {
    frame.remove()
  }
}

export function buildPaymentReceiptHtml(receipt: PaymentReceipt, pdfExport = false): string {
  const title = receipt.kind === "payment"
    ? receipt.status === "Paid" ? "PAYMENT RECEIPT" : "PAYMENT ACKNOWLEDGEMENT"
    : "INSTALLMENT STATEMENT"
  const statusTone = receipt.status === "Paid" ? "paid" : receipt.status === "Rejected" ? "rejected" : "pending"
  const date = printDate(receipt.kind === "payment" ? receipt.date : new Date().toISOString().slice(0, 10))
  const amount = receipt.kind === "payment" ? Number(receipt.transactionAmount ?? 0) : Number(receipt.feeAmount)
  const safe = escapeHtml
  const details = [
    ["Student ID", receipt.studentId],
    ["Student", receipt.studentName],
    ["Phone", receipt.studentPhone || "—"],
    ["Course", receipt.course],
    ...(receipt.installment ? [["Installment", receipt.installment]] : []),
    ...(receipt.dueDate ? [["Due date", printDate(receipt.dueDate)]] : []),
  ]
  const detailsHtml = details.map(([label, value]) =>
    `<div class="detail"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`
  ).join("")
  const documentNumber = paymentDocumentNumber(receipt)
  const suggestedFileName = getPaymentReceiptFileName(receipt)
  const transactionHtml = receipt.kind === "payment" ? `
    <section class="section">
      <h2>Payment details</h2>
      <div class="detail-grid">
        <div class="detail"><span>Payment date</span><strong>${safe(date)}</strong></div>
        <div class="detail"><span>Payment method</span><strong>${safe(receipt.method || "—")}</strong></div>
        <div class="detail"><span>Reference / note</span><strong>${safe(receipt.reference || "—")}</strong></div>
        <div class="detail"><span>Verification</span><strong>${safe(receipt.verifiedAt ? printDate(receipt.verifiedAt) : receipt.status === "Paid" ? "Verified" : "Not verified")}</strong></div>
      </div>
    </section>
  ` : ""
  const paymentRow = receipt.kind === "payment" ? `
    <div class="summary-row"><span>This transaction</span><strong>${safe(inr(amount))}</strong></div>
    <div class="summary-row"><span>Verified payments to date</span><strong>${safe(inr(receipt.paidToDate))}</strong></div>
  ` : `
    <div class="summary-row"><span>Verified payments against installment</span><strong>${safe(inr(receipt.paidToDate))}</strong></div>
    <div class="summary-row"><span>Payments awaiting verification</span><strong>${safe(inr(receipt.awaitingVerification))}</strong></div>
    <div class="summary-row total"><span>Installment amount</span><strong>${safe(inr(receipt.feeAmount))}</strong></div>
  `
  const notice = receipt.status === "Paid"
    ? "Payment verified and recorded by the institute."
    : receipt.status === "Rejected"
      ? "This payment was rejected or reversed and is not proof of payment received."
      : "This payment is awaiting institute verification. This acknowledgement is not confirmation that funds have been received."

  return `<!DOCTYPE html>
<html lang="en"${pdfExport ? ' class="pdf-export"' : ""}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${safe(suggestedFileName)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; background: #fff; font: 12px/1.5 'Poppins', Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { position: relative; display: flex; width: 100%; min-height: 269mm; flex-direction: column; max-width: 760px; margin: 0 auto; padding: 28px; border: 1px solid #dbe2ea; }
    .brand { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 2px solid #123b67; }
    .mark { display: grid; width: 56px; height: 48px; flex: 0 0 56px; place-items: center; border-radius: 10px; background: #123b67; color: white; font-size: 16px; font-weight: 700; letter-spacing: .04em; }
    .brand h1 { margin: 0; color: #123b67; font-size: 16px; letter-spacing: .045em; }
    .brand p { margin: 3px 0 0; color: #526174; font-size: 10px; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin: 22px 0 16px; }
    .title-row h2 { margin: 0; color: #123b67; font-size: 21px; letter-spacing: .04em; }
    .title-row p { margin: 4px 0 0; color: #64748b; }
    .status { display: inline-block; padding: 5px 9px; border: 1px solid; border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: .07em; white-space: nowrap; }
    .status.paid { border-color: #a7f3d0; color: #047857; background: #ecfdf5; }
    .status.pending { border-color: #fde68a; color: #a16207; background: #fffbeb; }
    .status.rejected { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
    .ref-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 14px; border-radius: 6px; background: #f3f6fa; }
    .ref-row span, .detail span { display: block; color: #64748b; font-size: 9px; font-weight: 600; letter-spacing: .055em; text-transform: uppercase; }
    .ref-row strong, .detail strong { display: block; margin-top: 3px; overflow-wrap: anywhere; font-size: 11px; }
    .section { margin-top: 19px; }
    .section h3 { margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #dbe2ea; color: #123b67; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; }
    .summary { margin-top: 18px; padding: 14px 16px; border: 1px solid #dbe2ea; border-radius: 6px; }
    .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; }
    .summary-row span { color: #526174; }
    .summary-row strong { text-align: right; }
    .summary-row.total { margin-top: 5px; padding-top: 10px; border-top: 1px solid #dbe2ea; color: #123b67; font-size: 14px; font-weight: 700; }
    .amount-words { margin-top: 10px; padding-top: 9px; border-top: 1px dashed #cbd5e1; color: #526174; font-size: 10px; }
    .notice { margin-top: 18px; padding: 10px 12px; border-left: 3px solid ${statusTone === "paid" ? "#059669" : statusTone === "rejected" ? "#dc2626" : "#d97706"}; background: #f8fafc; color: #475569; font-size: 10px; }
    footer { display: flex; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 8px; border-top: 1px solid #dbe2ea; color: #64748b; font-size: 8px; }
    @media screen { body { padding: 24px; background: #eef2f6; } .sheet { background: #fff; box-shadow: 0 8px 30px #0f172a14; } }
    .pdf-export body { padding: 0; background: #fff; }
    .pdf-export .sheet { width: 198mm; max-width: 198mm; min-height: 285mm; margin: 0 auto; padding: 6mm; border: 0; box-shadow: none; }
    @media print {
      body { min-height: 269mm; }
      .sheet { width: 198mm; max-width: 198mm; min-height: 285mm; margin: 0 auto; padding: 6mm; border: 0; }
    }
    @media (max-width: 520px) { .sheet { padding: 18px; } .title-row { flex-direction: column; } .detail-grid { gap: 10px; } }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="brand">
      <div class="mark">TNGC</div>
      <div><h1>${safe(INSTITUTE_NAME)}</h1><p>${safe(INSTITUTE_ADDRESS)}</p></div>
    </header>
    <div class="title-row">
      <div><h2>${safe(title)}</h2><p>${receipt.kind === "payment" ? "Official payment record" : "Fee schedule and balance statement"}</p></div>
      <span class="status ${statusTone}">${safe(receipt.status.toUpperCase())}</span>
    </div>
    <div class="ref-row">
      <div><span>${receipt.kind === "payment" ? "Receipt / payment no." : "Statement no."}</span><strong>${safe(documentNumber)}</strong></div>
      <div><span>${receipt.kind === "payment" ? "Payment date" : "Printed on"}</span><strong>${safe(date)}</strong></div>
    </div>
    <section class="section"><h3>Student and course</h3><div class="detail-grid">${detailsHtml}</div></section>
    ${transactionHtml}
    <section class="summary">
      ${paymentRow}
      <div class="summary-row"><span>Amount awaiting verification</span><strong>${safe(inr(receipt.awaitingVerification))}</strong></div>
      <div class="summary-row total"><span>Balance due</span><strong>${safe(inr(receipt.balanceDue))}</strong></div>
      ${receipt.kind === "payment" ? `<div class="amount-words">Transaction amount in words: <strong>${safe(amountInWords(amount))}</strong></div>` : ""}
    </section>
    <p class="notice">${safe(notice)}</p>
    <footer><span>${safe(INSTITUTE_NAME)}</span><span>Computer-generated document · Please retain for your records</span></footer>
  </main>
</body>
</html>`
}

const PREPARING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Preparing printout</title>
  <style>
    body { margin: 0; display: grid; place-items: center; min-height: 100vh; font-family: Arial, Helvetica, sans-serif; color: #52525b; background: #fff; }
    p { font-size: 13px; letter-spacing: 0.02em; }
  </style>
</head>
<body><p>Preparing printout…</p></body>
</html>`

/**
 * Opens the print window straight away, while the click is still the user
 * gesture.
 *
 * Report data usually comes from a query, and by the time it arrives the browser
 * would no longer allow a popup — so the window is opened first and filled in
 * later. Returns null when popups are blocked, which the caller reports.
 */
export function openPrintWindow(title = "Printout"): Window | null {
  const win = window.open("", "_blank", "width=1024,height=800")
  if (!win) return null
  win.document.open()
  win.document.write(PREPARING_HTML)
  win.document.close()
  win.document.title = title
  return win
}

/** Fills an open print window with the report and sends it to the printer. */
export function renderPrintReport(win: Window, report: PrintReport): void {
  const doc = win.document
  doc.open()
  doc.write(buildPrintReportHtml(report))
  doc.close()

  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } catch (error) {
      console.error("Unable to open the print dialog:", error)
    }
  }

  if (doc.readyState === "complete") {
    setTimeout(run, 150)
  } else {
    win.addEventListener("load", () => setTimeout(run, 150), { once: true })
  }
}

export function renderPaymentReceipt(win: Window, receipt: PaymentReceipt): void {
  const doc = win.document
  doc.open()
  doc.write(buildPaymentReceiptHtml(receipt))
  doc.close()

  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } catch (error) {
      console.error("Unable to open the receipt print dialog:", error)
    }
  }

  if (doc.readyState === "complete") {
    setTimeout(run, 150)
  } else {
    win.addEventListener("load", () => setTimeout(run, 150), { once: true })
  }
}

/** One call for a report that is already in hand. */
export function printReport(report: PrintReport): boolean {
  const win = openPrintWindow(report.title)
  if (!win) return false
  renderPrintReport(win, report)
  return true
}
