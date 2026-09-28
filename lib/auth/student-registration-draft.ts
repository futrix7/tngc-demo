const STORAGE_KEY = "tngc.student-registration-draft"
const STEP_COOKIE = "tngc_student_registration_step"
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_AGE_SECONDS = 24 * 60 * 60

export type StudentRegistrationDraft = {
  fullName: string
  email: string
  phone: string
  fatherName: string
  branch: string
  selectedCourseSlugs: string[]
  presentStatus: string
  parentMobile: string
  agreeTerms: boolean
  signature: string
  paymentReference: string
  paymentMode: "installments" | "custom"
  customPaymentAmount: string
  paidInstallments: number[]
  paymentDone: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export function readStudentRegistrationDraft(): StudentRegistrationDraft | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || typeof parsed.savedAt !== "number") {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    if (Date.now() - parsed.savedAt > MAX_AGE_MS || parsed.savedAt > Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return {
      fullName: readText(parsed.fullName),
      email: readText(parsed.email),
      phone: readText(parsed.phone),
      fatherName: readText(parsed.fatherName),
      branch: readText(parsed.branch),
      selectedCourseSlugs: Array.isArray(parsed.selectedCourseSlugs)
        ? parsed.selectedCourseSlugs.filter((value): value is string => typeof value === "string")
        : [],
      presentStatus: readText(parsed.presentStatus),
      parentMobile: readText(parsed.parentMobile),
      agreeTerms: parsed.agreeTerms === true,
      signature: readText(parsed.signature),
      paymentReference: readText(parsed.paymentReference),
      paymentMode: parsed.paymentMode === "custom" ? "custom" : "installments",
      customPaymentAmount: readText(parsed.customPaymentAmount),
      paidInstallments: Array.isArray(parsed.paidInstallments)
        ? parsed.paidInstallments.filter(
            (value): value is number => typeof value === "number" && [1, 2, 3].includes(value)
          )
        : [1],
      paymentDone: parsed.paymentDone === true,
    }
  } catch {
    return null
  }
}

export function readStudentRegistrationStep(): number | null {
  if (typeof document === "undefined") return null

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STEP_COOKIE}=`))
  const step = Number(cookie?.slice(STEP_COOKIE.length + 1))

  return Number.isInteger(step) && step >= 1 && step <= 4 ? step : null
}

export function saveStudentRegistrationStep(step: number): void {
  if (typeof document === "undefined" || !Number.isInteger(step) || step < 1 || step > 4) return
  document.cookie = `${STEP_COOKIE}=${step}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`
}

export function clearStudentRegistrationStep(): void {
  if (typeof document === "undefined") return
  document.cookie = `${STEP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function saveStudentRegistrationDraft(draft: StudentRegistrationDraft): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    // Storage can be unavailable in private browsing; registration still works.
  }
}

export function clearStudentRegistrationDraft(): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore unavailable storage.
  }

  clearStudentRegistrationStep()
}