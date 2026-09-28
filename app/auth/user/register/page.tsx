"use client"

import { startTransition, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { buildUpiUri, UPI_CONTACT_NUMBER } from "@/lib/upi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GraduationCap,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  BookOpen,
  MapPin,
  Briefcase,
  Home,
  Building2,
  FileText,
  Clock,
  IndianRupee,
  Monitor,
  Code,
  Globe,
  Database,
  Cloud,
  Layers,
  Loader2,
  CreditCard,
  CheckCircle2,
  Hash,
  AlertTriangle,
  LogIn,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/sonner"
import { describeAuthError } from "@/lib/errors"
import {
  clearStudentRegistrationStep,
  clearStudentRegistrationDraft,
  readStudentRegistrationDraft,
  readStudentRegistrationStep,
  saveStudentRegistrationStep,
  saveStudentRegistrationDraft,
} from "@/lib/auth/student-registration-draft"
import type { Variants, Transition } from "framer-motion"

type CourseCategory = "basic" | "programming" | "web" | "data" | "cloud" | "other"

interface CourseOption {
  slug: string
  name: string
  duration: string
  fee: number
  description: string
  category: CourseCategory
  popular: boolean
}

interface BranchOption {
  id: string
  name: string
}

/**
 * Presentation only: which shelf a course sits on, and whether it carries the
 * POPULAR flag. Nothing else.
 *
 * Name, duration and price all come from the `courses` table now. They used to
 * come from a hardcoded map in this file, which put the browser in charge of what
 * a course costs: the figure on the payment screen, the amount encoded in the UPI
 * QR code, and the amount register_student() actually charges were three
 * independent numbers, and they disagreed — the form quoted ₹3,500 for Tally
 * Prime against the database's ₹5,000, and ₹5,000 for Core Java against ₹2,500.
 * Five of the twenty entries also named slugs the database has never heard of
 * (data-science, aws, azure, power-bi, reactjs), so a student who picked one was
 * refused at submit with "no longer available" and no way to tell why.
 *
 * Keyed by slug on purpose: a course the database does not sell cannot be offered,
 * and one it sells but this file has never heard of still appears, under
 * "More Courses".
 */
const courseMeta: Record<string, { category: CourseCategory; popular?: boolean }> = {
  dca: { category: "basic" },
  adca: { category: "basic" },
  pgdca: { category: "basic" },
  "basic-computer": { category: "basic" },
  "internet-concept": { category: "basic" },
  "ms-office": { category: "basic" },
  "tally-prime": { category: "basic" },
  "c-language": { category: "programming" },
  "core-java": { category: "programming" },
  "advanced-java": { category: "programming" },
  "core-python": { category: "programming" },
  "oops-python": { category: "programming" },
  pgjpl: { category: "programming", popular: true },
  pgppl: { category: "programming", popular: true },
  "java-full-stack": { category: "programming", popular: true },
  "python-full-stack": { category: "programming", popular: true },
  adwd: { category: "web" },
  html: { category: "web" },
  css: { category: "web" },
  javascript: { category: "web" },
  "angular-js": { category: "web" },
  bootstrap: { category: "web" },
  oracle: { category: "data" },
  "advanced-excel": { category: "data" },
}

const categoryConfig: Record<CourseCategory, { icon: typeof Monitor; color: string; bg: string; label: string }> = {
  basic:       { icon: Monitor,  color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40",     label: "Computer Basics" },
  programming: { icon: Code,     color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40",  label: "Programming" },
  web:         { icon: Globe,    color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-950/40",label: "Web Development" },
  data:        { icon: Database, color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/40",    label: "Data & Analytics" },
  cloud:       { icon: Cloud,    color: "text-sky-600 dark:text-sky-400",       bg: "bg-sky-50 dark:bg-sky-950/40",        label: "Cloud Computing" },
  other:       { icon: Layers,   color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-slate-950/40",    label: "More Courses" },
}

const statusOptions = [
  { value: "Student",   icon: GraduationCap },
  { value: "Housewife", icon: Home },
  { value: "Employed",  icon: Briefcase },
  { value: "Business",  icon: Building2 },
  { value: "Others",    icon: User },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
}

const courseCardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: "easeOut" as Transition["ease"] },
  }),
}

/** Formats a rupee amount the way the rest of the form does. */
function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

const PASSWORD_MIN_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Mirrors the rule in `/api/register` so the student is told what is wrong
 * before submitting, instead of after a round trip to the server.
 *
 * Returns null when the password is acceptable, otherwise the message to show.
 */
function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number."
  }
  return null
}

export default function UserRegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [showRegistrationIssues, setShowRegistrationIssues] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)

  const [fatherName, setFatherName] = useState("")
  const [branch, setBranch] = useState("")
  const [selectedCourseSlugs, setSelectedCourseSlugs] = useState<string[]>([])
  const [presentStatus, setPresentStatus] = useState("")
  const [parentMobile, setParentMobile] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [signature, setSignature] = useState("")

  const [paymentDone, setPaymentDone] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentMode, setPaymentMode] = useState<"installments" | "custom">("installments")
  const [customPaymentAmount, setCustomPaymentAmount] = useState("")
  // Which of the three installments are being settled at registration. Defaults
  // to the first only, matching what the form did before the schedule existed:
  // it filed one payment for the whole course fee as though "Registration Fee"
  // were a single charge.
  const [paidInstallments, setPaidInstallments] = useState<number[]>([1])

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  const steps = [
    { id: 1, title: "Personal Info",     icon: User,      description: "Tell us about yourself" },
    { id: 2, title: "Choose Course",      icon: BookOpen,  description: "Select branch & course" },
    { id: 3, title: "Payment",            icon: CreditCard, description: "UPI payment" },
    { id: 4, title: "Final Details",      icon: FileText,  description: "Review & submit" },
  ]

  const totalSteps = steps.length
  const currentStepData = steps[step - 1]
  const progress = (step / totalSteps) * 100

  const selectedCourses = courses.filter((c) => selectedCourseSlugs.includes(c.slug))
  const selectedCourseNames = selectedCourses.map((c) => c.name).join(", ")
  const totalFee = selectedCourses.reduce((sum, c) => sum + c.fee, 0)
  const signatureMatchesName =
    signature.trim().toLowerCase() === fullName.trim().toLowerCase()

  const INSTALLMENT_COUNT = 3

  /**
   * Mirrors create_fee_schedule() in supabase.sql.
   *
   * The first rows take the floor of the fee divided by three and the last one
   * absorbs the remainder, so the three always add back up to the course fee. The
  * obvious alternative — Math.ceil for every row — makes the parts sum to more
  * than the whole and overstates the scheduled fee.
   */
  function installmentShare(n: number): number {
    if (totalFee <= 0) return 0
    const base = Math.floor(totalFee / INSTALLMENT_COUNT)
    if (n === INSTALLMENT_COUNT) return totalFee - base * (INSTALLMENT_COUNT - 1)
    return base
  }

  const payAllNow = paidInstallments.length === INSTALLMENT_COUNT
  const parsedCustomPaymentAmount = Number(customPaymentAmount)
  const validCustomPaymentAmount =
    customPaymentAmount.trim() !== "" &&
    Number.isFinite(parsedCustomPaymentAmount) &&
    parsedCustomPaymentAmount > 0 &&
    parsedCustomPaymentAmount <= totalFee
  const amountToPay = paymentMode === "custom"
    ? validCustomPaymentAmount ? parsedCustomPaymentAmount : 0
    : paidInstallments.reduce((sum, n) => sum + installmentShare(n), 0)

  const passwordIssue = password ? passwordProblem(password) : null
  const registrationIssues = [
    catalogueLoading ? "Wait for the course and branch list to finish loading." : null,
    catalogueError,
    !fullName.trim() ? "Enter your full name in Personal Info." : null,
    !fatherName.trim() ? "Enter your father's or husband's name in Personal Info." : null,
    !EMAIL_PATTERN.test(email.trim()) ? "Enter a valid email address in Personal Info." : null,
    phone.length !== 10 ? "Enter a valid 10-digit mobile number in Personal Info." : null,
    !branch ? "Select a preferred branch in Choose Course." : null,
    selectedCourseSlugs.length === 0 ? "Select at least one course in Choose Course." : null,
    selectedCourseSlugs.length > 6 ? "Select no more than 6 courses." : null,
    parentMobile.length !== 10 ? "Enter a valid 10-digit parent's mobile number." : null,
    !presentStatus ? "Select your present status." : null,
    !password ? "Create a password." : passwordIssue,
    !agreeTerms ? "Agree to the declaration and terms." : null,
    !paymentDone ? "Confirm your payment details on the Payment step." : null,
    !signature.trim()
      ? "Type your full name as your signature."
      : !signatureMatchesName
        ? `Your signature must match your name: ${fullName.trim() || "enter your name in Personal Info"}.`
        : null,
    totalFee > 0 && paymentMode === "custom" && !validCustomPaymentAmount
      ? `Enter a payment amount greater than ₹0 and no more than ${inr(totalFee)}.`
      : null,
    totalFee > 0 && paymentMode === "installments" && paidInstallments.length === 0
      ? "Choose at least one installment to pay."
      : null,
  ].filter((issue): issue is string => issue !== null)

  useEffect(() => {
    const draft = readStudentRegistrationDraft()
    const savedStep = readStudentRegistrationStep()
    if (!draft) clearStudentRegistrationStep()

    startTransition(() => {
      if (draft) {
        setFullName(draft.fullName)
        setEmail(draft.email)
        setPhone(draft.phone)
        setFatherName(draft.fatherName)
        setBranch(draft.branch)
        setSelectedCourseSlugs(draft.selectedCourseSlugs)
        setPresentStatus(draft.presentStatus)
        setParentMobile(draft.parentMobile)
        setAgreeTerms(draft.agreeTerms)
        setSignature(draft.signature)
        setPaymentReference(draft.paymentReference)
        setPaymentMode(draft.paymentMode)
        setCustomPaymentAmount(draft.customPaymentAmount)
        setPaidInstallments(draft.paidInstallments)
        setPaymentDone(draft.paymentDone)
        setStep(savedStep ?? 1)
      }
      setDraftLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!draftLoaded || alreadyRegistered) return

    const hasInputs = Boolean(
      fullName || email || phone || fatherName || branch || selectedCourseSlugs.length ||
      presentStatus || parentMobile || signature || paymentReference || customPaymentAmount
    )

    if (!hasInputs) {
      clearStudentRegistrationDraft()
      return
    }

    saveStudentRegistrationDraft({
      fullName,
      email,
      phone,
      fatherName,
      branch,
      selectedCourseSlugs,
      presentStatus,
      parentMobile,
      agreeTerms,
      signature,
      paymentReference,
      paymentMode,
      customPaymentAmount,
      paidInstallments,
      paymentDone,
    })
    saveStudentRegistrationStep(step)
  }, [
    draftLoaded,
    alreadyRegistered,
    fullName,
    email,
    phone,
    fatherName,
    branch,
    selectedCourseSlugs,
    presentStatus,
    parentMobile,
    agreeTerms,
    signature,
    paymentReference,
    paymentMode,
    customPaymentAmount,
    paidInstallments,
    paymentDone,
    step,
  ])

  function togglePaidInstallment(n: number) {
    setPaymentDone(false)
    setPaidInstallments((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    )
  }

  /**
   * Loads the catalogue the student actually enrols in.
   *
   * `anon` may read courses and branches, so this needs no session. An error is
   * surfaced rather than papered over with a fallback list: a hardcoded list is
   * how five unselectable courses and three different prices for the same course
   * got into this form in the first place. Offering a catalogue we cannot read is
   * how a student ends up paying one number and being invoiced another.
   */
  useEffect(() => {
    let active = true

    async function loadCatalogue() {
      const response = await fetch("/api/catalogue", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Catalogue request failed (${response.status})`)
      }
      const catalogue: {
        courses: Array<{
          slug: string
          name: string
          duration: string
          fee_numeric: number
          description: string
        }>
        branches: BranchOption[]
      } = await response.json()

      if (!active) return

      const options: CourseOption[] = catalogue.courses.map((row) => {
        const meta = courseMeta[row.slug]
        return {
          slug: row.slug,
          name: row.name,
          duration: row.duration,
          fee: Number(row.fee_numeric) || 0,
          description: row.description,
          category: meta?.category ?? "other",
          popular: meta?.popular ?? false,
        }
      })

      // A slug can be retired between the catalogue loading and the student
      // submitting. Dropping the selection here is better than letting the server
      // reject the whole enrolment for one stale course.
      setCourses(options)
      setSelectedCourseSlugs((prev) => prev.filter((slug) => options.some((c) => c.slug === slug)))
      setBranchOptions(catalogue.branches)
      setCatalogueLoading(false)
    }

    loadCatalogue().catch((err) => {
      console.error("[register] catalogue load crashed:", err)
      if (!active) return
      setCatalogueError("We couldn't load the course list. Please refresh the page.")
      setCatalogueLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  function goNext() {
    if (step >= totalSteps) return

    if (step === 1) {
      if (!fullName.trim() || !fatherName.trim() || !email.trim() || phone.length !== 10) {
        toast("Complete all required personal details before continuing.", { variant: "destructive" })
        return
      }
      if (!EMAIL_PATTERN.test(email.trim())) {
        toast("Enter a valid email address before continuing.", { variant: "destructive" })
        return
      }
    }

    if (step === 2 && (!branch || selectedCourseSlugs.length === 0)) {
      toast("Select a branch and at least one course before continuing.", { variant: "destructive" })
      return
    }

    if (step === 3 && !paymentDone) {
      toast("Confirm your payment before continuing.", { variant: "destructive" })
      return
    }

    setDirection(1)
    setStep((s) => s + 1)
  }

  function goPrev() {
    if (step > 1) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }

  function toggleCourse(slug: string) {
    setPaymentDone(false)
    setSelectedCourseSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  async function handlePaymentConfirm() {
    if (totalFee > 0 && amountToPay <= 0) {
      toast("Choose an installment or enter a valid custom amount.", { variant: "destructive" })
      return
    }

    setConfirmingPayment(true)
    setPaymentDone(true)
    setConfirmingPayment(false)
    toast("Payment noted! Our team will verify it after submission.", { variant: "success" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (submitting) return

    setShowRegistrationIssues(true)
    setSubmissionError(null)
    if (registrationIssues.length > 0) {
      toast("Please fix the items shown below before creating your account.", {
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone,
          password,
          fatherName: fatherName.trim(),
          fatherPhone: parentMobile,
          branchId: branch,
          courseSlugs: selectedCourseSlugs,
          presentStatus,
          signature: signature.trim(),
          paymentReference: paymentReference.trim(),
          paidInstallments: totalFee > 0 && paymentMode === "installments" ? paidInstallments : [],
          customPaymentAmount: totalFee > 0 && paymentMode === "custom" ? amountToPay : null,
        }),
      })

      const data: { error?: string; studentId?: string } = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409) {
          clearStudentRegistrationDraft()
          setAlreadyRegistered(true)
          toast(data.error || "An account with this email already exists.", {
            variant: "warning",
            description: "Sign in instead, or reset your password if you've forgotten it.",
          })
          return
        }

        if (res.status === 429) {
          const message = data.error || "Too many attempts. Please wait and try again."
          setSubmissionError(message)
          toast(message, {
            variant: "destructive",
          })
          return
        }

        const message = data.error || "We couldn't complete your registration."
        setSubmissionError(message)
        toast(message, {
          variant: "destructive",
        })
        return
      }

      clearStudentRegistrationDraft()

      // The account now exists and is confirmed, so this sign-in cannot fail on
      // a confirmation prompt. If it somehow does, the student record is already
      // waiting and they only need to retry.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        console.error("[register] sign-in after signup failed:", signInError.message)
        toast("Your account was created.", {
          variant: "warning",
          description: "We couldn't sign you in automatically. Please sign in with your new password.",
        })
        router.replace(`/auth/user/login?email=${encodeURIComponent(email.trim())}`)
        return
      }

      toast("Account created successfully!", {
        variant: "success",
        description: "Welcome to TNGC. Your student ID is " + (data.studentId ?? "on the way"),
      })
      router.replace("/student/dashboard")
      router.refresh()
    } catch (err) {
      console.error("[register] submission crashed:", err)
      const info = describeAuthError(err)
      setSubmissionError(info.message)
      toast(info.message, { variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyRegistered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/30 px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertTriangle className="size-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground">You&apos;re already registered</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An account already exists for{" "}
            <span className="font-semibold text-foreground">{email.trim()}</span>. Sign in to continue, or
            reset your password if you&apos;ve forgotten it.
          </p>

          <div className="mt-6 space-y-2">
            <Link href={`/auth/user/login?email=${encodeURIComponent(email.trim())}`} className="block">
              <Button className="h-10 w-full gap-2">
                <LogIn className="size-4" />
                Sign in instead
              </Button>
            </Link>
            <Link
              href={`/auth/user/reset-password?email=${encodeURIComponent(email.trim())}`}
              className="block"
            >
              <Button variant="outline" className="h-10 w-full">
                Reset password
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="h-10 w-full"
              onClick={() => {
                setAlreadyRegistered(false)
                setStep(1)
                setDirection(-1)
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-background to-muted/30 px-3 py-6 sm:px-4 sm:py-8">
      <div className="w-full max-w-4xl overflow-x-hidden">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/5">
          <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3 lg:px-6">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight tracking-tight text-foreground">
                Create Your Account
              </h1>
              <p className="text-xs leading-snug text-muted-foreground">
                Join TNGC and start your learning journey
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            <div className="hidden w-72 border-r border-border bg-muted/30 p-6 lg:flex lg:flex-col">
              <div className="flex-1 space-y-1">
                {steps.map((s, i) => {
                  const isActive = step === s.id
                  const isCompleted = step > s.id
                  const Icon = s.icon
                  return (
                    <div key={s.id} className="relative">
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200",
                          isActive && "bg-primary/10",
                          isCompleted && "opacity-60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : isCompleted
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                            {s.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                        </div>
                      </div>
                      {i < steps.length - 1 && <div className="ml-7 h-1 w-px bg-border" />}
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-xl bg-primary/5 p-4">
                <p className="text-xs font-medium text-muted-foreground">Already have an account?</p>
                <Link href="/auth/user/login" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Sign in <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <div className="border-b border-border px-4 py-3 lg:hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Step {step} of {totalSteps}</span>
                  <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{currentStepData.title}</p>
              </div>

              <div className="hidden px-6 pt-5 lg:block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Step {step} of {totalSteps}</span>
                  <span className="text-xs font-medium text-primary">{currentStepData.title}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>
              </div>

              <div className="flex flex-1 min-w-0 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
                <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-1 flex-col">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={`step-${step}`}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="space-y-4"
                      >
                        {step === 1 && (
                          <>
                            <div className="mb-4">
                              <h2 className="text-lg font-bold text-foreground">Personal Information</h2>
                              <p className="text-sm text-muted-foreground">Let&apos;s start with your basic details</p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="fullName">Full Name *</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input id="fullName" placeholder="e.g. Rahul Sharma" className="h-10 pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="fatherName">Father&apos;s / Husband&apos;s Name *</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input id="fatherName" placeholder="e.g. Suresh Sharma" className="h-10 pl-10" value={fatherName} onChange={(e) => setFatherName(e.target.value)} required />
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input id="email" type="email" placeholder="you@example.com" className="h-10 pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="phone">Mobile Number *</Label>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="98765 43210" className="h-10 pl-10" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {step === 2 && (
                          <>
                            <div className="mb-4">
                              <h2 className="text-lg font-bold text-foreground">Choose Your Course</h2>
                              <p className="text-sm text-muted-foreground">Select your branch and courses</p>
                            </div>

                            {catalogueError ? (
                              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                                {catalogueError}
                              </div>
                            ) : catalogueLoading ? (
                              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Loading courses...
                              </div>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  <Label>Preferred Branch *</Label>
                                  <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground z-10" />
                                    <Select value={branch} onValueChange={(v) => setBranch(v ?? "")}>
                                      <SelectTrigger className="pl-10">
                                        <SelectValue placeholder="Select your nearest branch" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {branchOptions.map((b) => (
                                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {(Object.keys(categoryConfig) as CourseCategory[]).map((catKey) => {
                                    const cat = categoryConfig[catKey]
                                    const catCourses = courses.filter((c) => c.category === catKey)
                                    if (catCourses.length === 0) return null
                                    const CatIcon = cat.icon

                                    return (
                                      <div key={catKey}>
                                        <div className={cn("mb-2 flex items-center gap-2 rounded-lg px-3 py-1.5", cat.bg)}>
                                          <CatIcon className={cn("size-3.5", cat.color)} />
                                          <span className={cn("text-xs font-semibold", cat.color)}>{cat.label}</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          {catCourses.map((course, idx) => {
                                            const selected = selectedCourseSlugs.includes(course.slug)
                                            const CourseIcon = cat.icon
                                            return (
                                              <motion.button
                                                key={course.slug}
                                                type="button"
                                                custom={idx}
                                                variants={courseCardVariants}
                                                initial="hidden"
                                                animate="visible"
                                                whileTap={{ scale: 0.97 }}
                                                whileHover={{ scale: 1.01 }}
                                                onClick={() => toggleCourse(course.slug)}
                                                aria-pressed={selected}
                                                className={cn(
                                                  "group relative flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-all",
                                                  selected
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-border bg-background hover:border-primary/30"
                                                )}
                                              >
                                                <div className={cn(
                                                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                                                  selected ? "bg-primary text-primary-foreground" : cat.bg
                                                )}>
                                                  {selected ? <Check className="size-4" /> : <CourseIcon className={cn("size-4", cat.color)} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className={cn("text-sm font-bold", selected ? "text-primary" : "text-foreground")}>
                                                      {course.name}
                                                    </span>
                                                    {course.popular && (
                                                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">POPULAR</span>
                                                    )}
                                                  </div>
                                                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{course.description}</p>
                                                  <div className="mt-1.5 flex items-center gap-2.5">
                                                    <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                                                      <Clock className="size-2.5" />{course.duration}
                                                    </span>
                                                    <span className="flex items-center gap-0.5 text-[11px] font-bold text-primary">
                                                      <IndianRupee className="size-2.5" />{course.fee.toLocaleString("en-IN")}
                                                    </span>
                                                  </div>
                                                </div>
                                              </motion.button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>

                                {selectedCourses.length > 0 && (
                                  <div className="rounded-xl bg-primary/5 p-3 text-center">
                                    <p className="text-xs text-muted-foreground">
                                      Selected: <span className="font-semibold text-primary">{selectedCourseNames}</span>
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-foreground">
                                      Total Fee: {inr(totalFee)}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}

                        {step === 3 && (
                          <>
                            <div className="mb-4">
                              <h2 className="text-lg font-bold text-foreground">Complete Payment</h2>
                              <p className="text-sm text-muted-foreground">Scan the QR code below to pay via UPI</p>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-muted-foreground">Course(s)</span>
                                  <span className="text-sm font-semibold text-foreground text-right">{selectedCourseNames}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-border pt-3">
                                  <span className="text-sm font-medium text-muted-foreground">Total Fee</span>
                                  <span className="text-xl font-extrabold text-foreground">₹{totalFee.toLocaleString("en-IN")}</span>
                                </div>
                              </div>

                              {/* Which part of the fee is being paid now. The course
                                  is split into three installments, and a student may
                                  settle up to three at once — or the whole balance,
                                  which is the same thing on a three-part course but
                                  matters once an admin has extended the schedule. */}
                              <div className="rounded-xl border border-border p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <Label>What are you paying now?</Label>
                                  {totalFee > 0 && paymentMode === "installments" && (
                                    <button
                                      type="button"
                                      onClick={() => setPaidInstallments(payAllNow ? [] : [1, 2, 3])}
                                      className="text-xs font-medium text-primary hover:underline"
                                    >
                                      {payAllNow ? "Clear selection" : "Pay everything"}
                                    </button>
                                  )}
                                </div>

                                {totalFee > 0 && (
                                  <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Payment amount mode">
                                    <label className={cn(
                                      "flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                      paymentMode === "installments" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}>
                                      <input
                                        className="sr-only"
                                        type="radio"
                                        name="paymentMode"
                                        value="installments"
                                        checked={paymentMode === "installments"}
                                        onChange={() => { setPaymentMode("installments"); setPaymentDone(false) }}
                                      />
                                      By installment
                                    </label>
                                    <label className={cn(
                                      "flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                      paymentMode === "custom" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}>
                                      <input
                                        className="sr-only"
                                        type="radio"
                                        name="paymentMode"
                                        value="custom"
                                        checked={paymentMode === "custom"}
                                        onChange={() => { setPaymentMode("custom"); setPaymentDone(false) }}
                                      />
                                      Custom amount
                                    </label>
                                  </div>
                                )}

                                {totalFee <= 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    No fee is set for the selected course yet, so there is
                                    nothing to pay now. You can settle it from your fee page
                                    once the institute publishes the amount.
                                  </p>
                                )}

                                {totalFee > 0 && (
                                  <>
                                    {paymentMode === "installments" ? (
                                      <div className="space-y-2">
                                        {[1, 2, 3].map((n) => {
                                          const share = installmentShare(n)
                                          const checked = paidInstallments.includes(n)
                                          return (
                                            <label
                                              key={n}
                                              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                                                checked
                                                  ? "border-primary bg-primary/5"
                                                  : "cursor-pointer border-border hover:bg-muted/50"
                                              }`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() => togglePaidInstallment(n)}
                                                  className="size-4 accent-primary"
                                                />
                                                <span className="text-sm font-medium">
                                                  Installment {n}
                                                  {n === 3 && totalFee > 0 && (
                                                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                      (final, adjusted)
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                              <span className="text-sm font-semibold">{inr(share)}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <Label htmlFor="customPaymentAmount">Amount to pay</Label>
                                        <div className="relative">
                                          <IndianRupee className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                          <Input
                                            id="customPaymentAmount"
                                            type="number"
                                            min="0.01"
                                            max={totalFee}
                                            step="0.01"
                                            inputMode="decimal"
                                            placeholder={`Up to ₹${totalFee.toLocaleString("en-IN")}`}
                                            className="h-10 pl-10"
                                            value={customPaymentAmount}
                                            onChange={(event) => {
                                              setCustomPaymentAmount(event.target.value)
                                              setPaymentDone(false)
                                            }}
                                          />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {validCustomPaymentAmount
                                            ? `${inr(totalFee - amountToPay)} will remain on your fee balance.`
                                            : `Enter an amount up to ${inr(totalFee)}.`}
                                        </p>
                                      </div>
                                    )}

                                    <p className="mt-3 text-xs text-muted-foreground">
                                      {amountToPay <= 0
                                        ? paymentMode === "custom"
                                          ? "Enter the amount you are paying now."
                                          : "Select at least one installment, or pay the whole fee now."
                                        : `Paying ${inr(amountToPay)} of ${inr(totalFee)} now. The rest stays on your schedule.`}
                                    </p>
                                  </>
                                )}
                              </div>

                              {totalFee > 0 && amountToPay > 0 && (
                                <>
                                  <div className="flex flex-col items-center rounded-xl border border-border bg-background p-6">
                                    <QRCodeSVG
                                      value={buildUpiUri(amountToPay)}
                                      size={200}
                                      bgColor="transparent"
                                      fgColor="currentColor"
                                      level="M"
                                      includeMargin
                                      className="text-foreground"
                                    />
                                    <p className="mt-3 text-xs text-muted-foreground">Scan with any UPI app</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">{UPI_CONTACT_NUMBER}</p>
                                  </div>

                                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground text-center space-y-1">
                                    <p>
                                      Pay{" "}
                                      <span className="font-bold text-foreground">
                                        ₹{amountToPay.toLocaleString("en-IN")}
                                      </span>{" "}
                                      to the UPI ID above
                                    </p>
                                    <p>After payment, click the button below to confirm</p>
                                  </div>
                                </>
                              )}

                              {totalFee > 0 && (
                                <div className="space-y-2">
                                  <Label htmlFor="paymentReference">UPI Transaction Reference (optional)</Label>
                                  <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      id="paymentReference"
                                      placeholder="Enter the transaction ID"
                                      className="h-10 pl-10"
                                      value={paymentReference}
                                      onChange={(e) => setPaymentReference(e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-center">
                                {paymentDone ? (
                                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-5" />
                                    <span className="font-semibold">Payment Confirmed</span>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    onClick={handlePaymentConfirm}
                                    disabled={confirmingPayment || (totalFee > 0 && amountToPay <= 0)}
                                    className="gap-2"
                                  >
                                    {confirmingPayment ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="size-4" />
                                    )}
                                    {confirmingPayment ? "Confirming..." : "I have paid"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {step === 4 && (
                          <>
                            <div className="mb-4">
                              <h2 className="text-lg font-bold text-foreground">Final Details</h2>
                              <p className="text-sm text-muted-foreground">Complete your registration</p>
                            </div>

                            <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
                              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                  <span className="text-muted-foreground">Name:</span>
                                  <p className="font-semibold text-foreground wrap-break-word">{fullName}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Email:</span>
                                  <p className="font-semibold text-foreground wrap-break-word">{email}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Course:</span>
                                  <p className="font-semibold text-foreground wrap-break-word">{selectedCourseNames}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Fee to Pay:</span>
                                  <p className="font-semibold text-amber-600 dark:text-amber-400">₹{totalFee.toLocaleString("en-IN")} (pending verification)</p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Present Status *</Label>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {statusOptions.map((opt) => {
                                  const Icon = opt.icon
                                  const selected = presentStatus === opt.value
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => setPresentStatus(opt.value)}
                                      aria-pressed={selected}
                                      className={cn(
                                        "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-background text-foreground hover:border-primary/40"
                                      )}
                                    >
                                      <Icon className="size-4 shrink-0" />
                                      <span className="truncate">{opt.value}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="parentMobile">Parent&apos;s Mobile Number *</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input id="parentMobile" type="tel" inputMode="numeric" maxLength={10} placeholder="98765 43210" className="h-10 pl-10" value={parentMobile} onChange={(e) => setParentMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="password">Password *</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  id="password"
                                  type={passwordVisible ? "text" : "password"}
                                  autoComplete="new-password"
                                  placeholder="Create a password"
                                  aria-describedby="password-requirements"
                                  aria-invalid={Boolean(passwordIssue)}
                                  className={cn(
                                    "h-10 pl-10 pr-10",
                                    passwordIssue
                                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                                      : password
                                        ? "border-emerald-500 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                        : ""
                                  )}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                />
                                <PasswordVisibilityToggle
                                  visible={passwordVisible}
                                  label="password"
                                  onToggle={() => setPasswordVisible((visible) => !visible)}
                                />
                              </div>
                              <p id="password-requirements" className="text-xs text-muted-foreground">
                                Minimum {PASSWORD_MIN_LENGTH} characters, including a letter and a number.
                              </p>
                              {passwordIssue && (
                                <p className="text-xs text-red-500">{passwordIssue}</p>
                              )}
                            </div>

                            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
                              I confirm that all the details I entered above are true. I agree to follow
                              the institute&apos;s rules. I understand that once I pay the fee, it cannot be
                              refunded or changed.
                            </div>

                            <div className="flex items-start gap-2">
                              <input id="agree" type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary" />
                              <Label htmlFor="agree" className="text-sm font-normal leading-snug text-muted-foreground">
                                I agree to the above declaration and{" "}
                                <Link href="/terms" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-primary hover:underline">
                                  Terms of Service
                                  <ArrowUpRight className="size-3" />
                                </Link>
                                {" "}and{" "}
                                <Link href="/privacy" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-primary hover:underline">
                                  Privacy Policy
                                  <ArrowUpRight className="size-3" />
                                </Link>
                              </Label>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signature">Type your full name as signature *</Label>
                              <Input
                                id="signature"
                                placeholder="Type your full name"
                                className="h-10"
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                                aria-invalid={Boolean(signature.trim() && !signatureMatchesName)}
                                aria-describedby="signature-requirements"
                                required
                              />
                              <p
                                id="signature-requirements"
                                className={cn(
                                  "text-xs",
                                  signature.trim() && !signatureMatchesName
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                                )}
                              >
                                {signature.trim() && !signatureMatchesName
                                  ? `Your signature must match the name above: ${fullName.trim() || "enter your name in Personal Info"}.`
                                  : "Enter the same name you provided in Personal Info."}
                              </p>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {step === totalSteps &&
                    (submissionError || (showRegistrationIssues && registrationIssues.length > 0)) && (
                    <div
                      role="alert"
                      className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                    >
                      {submissionError ? (
                        <p>{submissionError}</p>
                      ) : (
                        <>
                          <p className="font-medium">
                            Complete these items before your account can be created:
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {registrationIssues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                    <Button type="button" variant="outline" onClick={goPrev} className="gap-1.5" disabled={submitting || step === 1}>
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>

                    <div className="flex-1" />

                    {step < totalSteps ? (
                      <Button
                        type="button"
                        onClick={goNext}
                        className="gap-1.5 px-6"
                        disabled={
                          (step === 1 && (!fullName || !fatherName || !email || !phone)) ||
                          (step === 2 &&
                            (catalogueLoading ||
                              catalogueError !== null ||
                              !branch ||
                              selectedCourseSlugs.length === 0)) ||
                          (step === 3 && !paymentDone)
                        }
                      >
                        Continue <ArrowRight className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="gap-1.5 px-6"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Check className="size-4" />
                            Create Account
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>

                <p className="mt-4 text-center text-sm text-muted-foreground lg:hidden">
                  Already have an account?{" "}
                  <Link href="/auth/user/login" className="font-medium text-primary hover:underline">Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
