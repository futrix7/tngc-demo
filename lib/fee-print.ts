"use client"

import { localDate } from "@/lib/local-date"
import { paymentStatusCellLabel, paymentStatusTone } from "@/lib/payment-status"
import {
  inr,
  printDate,
  type PrintReport,
  type PrintSection,
  type PrintValue,
} from "@/lib/print-report"

/**
 * Fee and payment statements, built for every screen that shows money.
 *
 * `lib/print-report.ts` owns the paper. This module owns what goes on it: the
 * column sets, the totals and the wording, so a student's own statement, the
 * counter's copy and the institute-wide register cannot describe the same money
 * three different ways.
 *
 * Each screen still gathers its own rows — they come from different queries with
 * different scopes — and hands them over here as plain numbers. Nothing in this
 * file touches the database, which is what keeps it identical for an admin and a
 * student.
 */

export interface StatementInstallmentRow {
  /** Shown as the first column when the statement spans several students. */
  student?: string
  course?: string
  label: string
  dueDate: string
  paidDate?: string | null
  amount: number
  paidAmount: number
  /** Money handed over but not yet confirmed by the institute. */
  awaitingAmount?: number
  balance: number
  status: string
}

export interface StatementPaymentRow {
  id: string
  student?: string
  course?: string
  /** Which schedule line this money landed on. */
  against?: string
  date: string
  amount: number
  method?: string
  reference?: string
  status: string
}

export interface StatementContext {
  title: string
  subtitle?: string
  /** Student, filters, date range — whatever identifies the sheet. */
  meta?: PrintReport["meta"]
  note?: string
}

export interface StudentStatementInput extends StatementContext {
  studentName: string
  studentId?: string | null
  installments: StatementInstallmentRow[]
  payments?: StatementPaymentRow[]
}

export interface RegisterInput extends StatementContext {
  installments: StatementInstallmentRow[]
  payments?: StatementPaymentRow[]
}

/**
 * Whether the Student column earns its place.
 *
 * A single student's statement repeats their name on every row for no gain, so
 * the column only appears once the sheet covers more than one person — which is
 * what separates a statement from the institute-wide register.
 */
function spansStudents(
  installments: readonly StatementInstallmentRow[],
  payments: readonly StatementPaymentRow[]
): boolean {
  const names = new Set<string>()
  for (const row of installments) if (row.student) names.add(row.student)
  for (const row of payments) if (row.student) names.add(row.student)
  return names.size > 1
}

/**
 * Whether the Course column earns its place.
 *
 * One course is already named in the header, so a single-course statement would
 * otherwise spend a tenth of its width saying the same thing eighty times.
 */
function spansCourses(
  installments: readonly StatementInstallmentRow[],
  payments: readonly StatementPaymentRow[]
): boolean {
  const courses = new Set<string>()
  for (const row of installments) if (row.course) courses.add(row.course)
  for (const row of payments) if (row.course) courses.add(row.course)
  return courses.size > 1
}

function installmentStatusTone(row: StatementInstallmentRow) {
  if (awaiting(row) > 0) return "warning" as const
  return paymentStatusTone(row.status)
}

/**
 * How an installment's state is worded.
 *
 * A line with money in flight reads as "awaiting verification" rather than its
 * stored `Pending`, because from either side of the counter that is what is
 * actually happening to it. The same wording the badge uses comes from
 * `lib/payment-status.ts` so the sheet and the screen cannot disagree.
 */
function installmentStatusText(row: StatementInstallmentRow): string {
  if (awaiting(row) > 0) return paymentStatusCellLabel("Pending")
  return row.status
}

function awaiting(row: StatementInstallmentRow): number {
  return Math.max(0, Number(row.awaitingAmount ?? 0))
}

function scheduleColumns(showStudent: boolean, showCourse: boolean) {
  const columns = []
  if (showStudent) columns.push({ key: "student", label: "Student" })
  columns.push({ key: "label", label: "Installment" })
  if (showCourse) columns.push({ key: "course", label: "Course" })
  columns.push(
    { key: "dueDate", label: "Due date" },
    { key: "amount", label: "Amount", align: "right" as const },
    { key: "paidAmount", label: "Paid", align: "right" as const },
    { key: "awaitingAmount", label: "Awaiting", align: "right" as const },
    { key: "balance", label: "Balance", align: "right" as const },
    { key: "paidDate", label: "Paid date" },
    { key: "status", label: "Status" }
  )
  return columns
}

function paymentColumns(showStudent: boolean, showCourse: boolean) {
  const columns = []
  if (showStudent) columns.push({ key: "student", label: "Student" })
  columns.push({ key: "id", label: "Payment ID" })
  if (showCourse) columns.push({ key: "course", label: "Course" })
  columns.push(
    { key: "against", label: "Paid towards" },
    { key: "date", label: "Date" },
    { key: "amount", label: "Amount", align: "right" as const },
    { key: "method", label: "Method" },
    { key: "reference", label: "Reference" },
    { key: "status", label: "Status" }
  )
  return columns
}

function scheduleRows(rows: readonly StatementInstallmentRow[], showStudent: boolean) {
  return rows.map((row) => {
    const record: Record<string, PrintValue> = {
      label: row.label,
      dueDate: printDate(row.dueDate),
      amount: inr(row.amount),
      paidAmount: inr(row.paidAmount),
      awaitingAmount: inr(awaiting(row)),
      balance: inr(row.balance),
      paidDate: printDate(row.paidDate),
      status: { text: installmentStatusText(row), tone: installmentStatusTone(row) },
    }
    if (showStudent) record.student = row.student ?? "—"
    if (row.course) record.course = row.course
    return record
  })
}

function paymentRows(rows: readonly StatementPaymentRow[], showStudent: boolean) {
  return rows.map((row) => {
    const record: Record<string, PrintValue> = {
      id: row.id,
      against: row.against || "—",
      date: printDate(row.date),
      amount: inr(row.amount),
      method: row.method || "—",
      reference: row.reference || "—",
      status: { text: paymentStatusCellLabel(row.status), tone: paymentStatusTone(row.status) },
    }
    if (showStudent) record.student = row.student ?? "—"
    if (row.course) record.course = row.course
    return record
  })
}

function scheduleTotals(rows: readonly StatementInstallmentRow[], label: string) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const paid = rows.reduce((sum, row) => sum + row.paidAmount, 0)
  const awaitingTotal = rows.reduce((sum, row) => sum + awaiting(row), 0)
  const balance = rows.reduce((sum, row) => sum + row.balance, 0)

  return {
    label,
    amount: inr(total),
    paidAmount: inr(paid),
    awaitingAmount: inr(awaitingTotal),
    // Still owing is the one figure a reader looks for first, so it is coloured
    // rather than left as a quiet number in a column of numbers.
    balance: { text: inr(balance), tone: balance > 0 ? ("negative" as const) : ("positive" as const) },
  }
}

function paymentTotals(rows: readonly StatementPaymentRow[], label: string) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const received = rows
    .filter((row) => row.status === "Paid")
    .reduce((sum, row) => sum + row.amount, 0)
  const unconfirmed = rows
    .filter((row) => row.status === "Pending")
    .reduce((sum, row) => sum + row.amount, 0)

  return {
    label,
    amount: inr(total),
    status: {
      text: `${inr(received)} received`,
      tone: unconfirmed > 0 ? ("warning" as const) : ("positive" as const),
    },
  }
}

/** A note that explains the wording, so the figures are not read wrongly. */
const AWAITING_NOTE =
  "Amounts marked 'Awaiting verification' have been handed over but are not yet confirmed by the institute, so they are not counted as received."

/**
 * Everything one student's fee says: the schedule, the money against it, and
 * what is still owed.
 */
export function buildStudentStatement(input: StudentStatementInput): PrintReport {
  const installments = input.installments
  const payments = input.payments ?? []
  const showStudent = spansStudents(installments, payments)
  const showCourse = spansCourses(installments, payments)

  const totalFee = installments.reduce((sum, row) => sum + row.amount, 0)
  const totalPaid = installments.reduce((sum, row) => sum + row.paidAmount, 0)
  const totalAwaiting = installments.reduce((sum, row) => sum + awaiting(row), 0)
  const totalBalance = installments.reduce((sum, row) => sum + row.balance, 0)

  return {
    title: input.title,
    subtitle: input.subtitle,
    meta: [
      { label: "Student", value: input.studentName },
      ...(input.studentId ? [{ label: "Student ID", value: input.studentId }] : []),
      ...(input.meta ?? []),
    ],
    stats: [
      { label: "Total fee", value: inr(totalFee) },
      { label: "Amount paid", value: inr(totalPaid), tone: "positive" },
      {
        label: "Awaiting verification",
        value: inr(totalAwaiting),
        tone: totalAwaiting > 0 ? "warning" : "muted",
      },
      {
        label: "Balance due",
        value: inr(totalBalance),
        tone: totalBalance > 0 ? "negative" : "positive",
      },
    ],
    sections: [
      {
        title: "Installment schedule",
        columns: scheduleColumns(showStudent, showCourse),
        rows: scheduleRows(installments, showStudent),
        totals: scheduleTotals(installments, "Total"),
        emptyText: "No installment schedule has been created yet.",
      },
      ...(payments.length > 0
        ? [
            {
              title: "Payment history",
              columns: paymentColumns(showStudent, showCourse),
              rows: paymentRows(payments, showStudent),
              totals: paymentTotals(payments, "Total"),
              emptyText: "No payments recorded.",
            },
          ]
        : []),
    ],
    note: [AWAITING_NOTE, input.note].filter(Boolean).join(" "),
  }
}

/**
 * The institute-wide sheet: many students, many courses, no single balance.
 *
 * Kept separate from `buildStudentStatement` because the two answer different
 * questions. A statement answers "what does this one student still owe"; a
 * register answers "who owes what on this date", and putting a single total on
 * it would invite someone to read the sum as a collectible figure.
 */
export function buildFeeRegister(input: RegisterInput): PrintReport {
  const installments = input.installments
  const payments = input.payments ?? []
  const showStudent = spansStudents(installments, payments) || installments.length > 0
  const showCourse = spansCourses(installments, payments)

  const totalAmount = installments.reduce((sum, row) => sum + row.amount, 0)
  const totalPaid = installments.reduce((sum, row) => sum + row.paidAmount, 0)
  const totalAwaiting = installments.reduce((sum, row) => sum + awaiting(row), 0)
  const totalBalance = installments.reduce((sum, row) => sum + row.balance, 0)
  const overdue = installments.filter((row) => row.balance > 0 && isPastDue(row.dueDate))
  const overdueAmount = overdue.reduce((sum, row) => sum + row.balance, 0)

  const stats = [
    { label: "Installments", value: String(installments.length) },
    { label: "Scheduled", value: inr(totalAmount) },
    { label: "Collected", value: inr(totalPaid), tone: "positive" as const },
    {
      label: "Awaiting verification",
      value: inr(totalAwaiting),
      tone: totalAwaiting > 0 ? ("warning" as const) : ("muted" as const),
    },
    {
      label: "Outstanding",
      value: inr(totalBalance),
      tone: totalBalance > 0 ? ("negative" as const) : ("positive" as const),
    },
    {
      label: "Overdue",
      value: inr(overdueAmount),
      tone: overdueAmount > 0 ? ("negative" as const) : ("muted" as const),
    },
  ]

  const sections: PrintSection[] = [
    {
      title: "Installments",
      columns: scheduleColumns(showStudent, showCourse),
      rows: scheduleRows(installments, showStudent),
      totals: scheduleTotals(installments, `Total · ${installments.length} installments`),
      emptyText: "No installments match this search and filter.",
    },
  ]

  if (payments.length > 0) {
    sections.push({
      title: "Payments",
      columns: paymentColumns(showStudent, showCourse),
      rows: paymentRows(payments, showStudent),
      totals: paymentTotals(payments, `Total · ${payments.length} payments`),
      emptyText: "No payments match this search and filter.",
    })
  }

  return {
    title: input.title,
    subtitle: input.subtitle,
    // No record count here: the stats already lead with it, and printing it twice
    // on one sheet reads as two different figures.
    meta: input.meta,
    stats,
    sections,
    note: [
      AWAITING_NOTE,
      "Overdue counts only the outstanding balance on installments already past their due date.",
      input.note,
    ]
      .filter(Boolean)
      .join(" "),
  }
}

/**
 * Whether a due date has passed.
 *
 * Compared as text against the local calendar day, never `new Date(dueDate)`:
 * the database stores dates as `YYYY-MM-DD`, and parsing that as UTC makes a due
 * date that is still three days away look overdue to anyone east of Greenwich.
 */
function isPastDue(dueDate: string): boolean {
  const today = localDate()
  return /^\d{4}-\d{2}-\d{2}$/.test(dueDate.slice(0, 10)) ? dueDate.slice(0, 10) < today : false
}
