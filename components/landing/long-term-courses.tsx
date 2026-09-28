"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Clock, ArrowRight, Star, Eye, IndianRupee, BookOpen } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Course {
  slug: string
  name: string
  duration: string
  description: string
  topics: string[]
  fees: string
  fee_numeric: number
  popular?: boolean
}

/* ── Hardcoded fallback — always shown when Supabase is unreachable ── */
const FALLBACK_COURSES: Course[] = [
  {
    slug: "dca",
    name: "DCA",
    duration: "6 Months",
    description: "Diploma in Computer Applications — the most popular all-round course.",
    topics: ["MS Office", "Internet", "Tally", "DTP", "Typing"],
    fees: "₹8,000",
    fee_numeric: 8000,
    popular: true,
  },
  {
    slug: "adca",
    name: "ADCA",
    duration: "1 Year",
    description: "Advanced Diploma in Computer Applications with deeper coverage.",
    topics: ["MS Office", "Tally Prime", "DTP", "HTML", "C Language"],
    fees: "₹14,000",
    fee_numeric: 14000,
    popular: true,
  },
  {
    slug: "python-full-stack",
    name: "Python Full Stack",
    duration: "6 Months",
    description: "Complete web development with Python, Django and modern frontend.",
    topics: ["Core Python", "Django", "HTML/CSS", "JavaScript", "Live Project"],
    fees: "₹25,000",
    fee_numeric: 25000,
    popular: true,
  },
  {
    slug: "java-full-stack",
    name: "Java Full Stack",
    duration: "6 Months",
    description: "Enterprise web development with Java, Spring Boot and frontend.",
    topics: ["Core Java", "Spring Boot", "HTML/CSS", "JavaScript", "Live Project"],
    fees: "₹25,000",
    fee_numeric: 25000,
    popular: true,
  },
  {
    slug: "tally-prime",
    name: "Tally Prime",
    duration: "3 Months",
    description: "Industry-standard accounting software for finance careers.",
    topics: ["GST", "Accounting", "Payroll", "Inventory", "Banking"],
    fees: "₹6,000",
    fee_numeric: 6000,
    popular: false,
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    duration: "3 Months",
    description: "Modern marketing skills for social media, SEO and online ads.",
    topics: ["SEO", "Google Ads", "Social Media", "Email", "Analytics"],
    fees: "₹10,000",
    fee_numeric: 10000,
    popular: false,
  },
  {
    slug: "graphic-design",
    name: "Graphic Design",
    duration: "3 Months",
    description: "Creative design for print, digital and branding projects.",
    topics: ["Photoshop", "Illustrator", "CorelDRAW", "Canva", "Logo Design"],
    fees: "₹9,000",
    fee_numeric: 9000,
    popular: false,
  },
  {
    slug: "hardware-networking",
    name: "Hardware & Networking",
    duration: "6 Months",
    description: "PC assembly, troubleshooting and network administration.",
    topics: ["PC Assembly", "Windows Server", "Networking", "CCNA Basics", "Troubleshooting"],
    fees: "₹12,000",
    fee_numeric: 12000,
    popular: false,
  },
]

/* Colour accent per card index — cycles through student-friendly palette */
const CARD_ACCENTS = [
  { tag: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300", dot: "bg-indigo-500" },
  { tag: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300", dot: "bg-violet-500" },
  { tag: "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-300",         dot: "bg-pink-500" },
  { tag: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",     dot: "bg-amber-500" },
  { tag: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300",             dot: "bg-sky-500" },
  { tag: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { tag: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",         dot: "bg-rose-500" },
  { tag: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
]

function parseFees(fees: string, feeNumeric: number): number {
  if (feeNumeric && feeNumeric > 0) return feeNumeric
  const digits = (fees ?? "").replace(/[^0-9]/g, "")
  return digits ? parseInt(digits, 10) : 0
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
} as const

const cardAnim = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: "easeOut" as const },
  },
} as const

export function LongTermCourses() {
  const [courses, setCourses] = useState<Course[]>(FALLBACK_COURSES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function fetchCourses() {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("slug, name, duration, description, topics, fees, fee_numeric, popular")
          .eq("type", "long-term")
          .eq("status", "active")
          .order("created_at")

        if (!active) return
        if (!error && data && data.length > 0) setCourses(data as Course[])
      } catch {
        /* keep fallback */
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchCourses()
    return () => { active = false }
  }, [])

  return (
    <section id="courses" className="relative py-20 sm:py-28 overflow-hidden">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-500/6 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full bg-violet-500/6 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary"
          >
            <BookOpen className="size-3.5" />
            Long-Term Professional Courses
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Launch your career with the{" "}
            <span className="text-gradient-primary">right programme</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="mt-3 text-base text-muted-foreground"
          >
            Industry-aligned courses designed to get you job-ready fast.
          </motion.p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-3xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {courses.map((course, i) => {
              const accent = CARD_ACCENTS[i % CARD_ACCENTS.length]
              const fee = parseFees(course.fees, course.fee_numeric)

              return (
                <motion.div
                  key={course.slug}
                  variants={cardAnim}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className={`group relative flex flex-col rounded-3xl border bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl sm:p-6 ${
                    course.popular
                      ? "border-primary/30 ring-2 ring-primary/12"
                      : "border-border/60 hover:border-primary/20"
                  }`}
                >
                  {/* Popular badge */}
                  {course.popular && (
                    <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Star className="size-2.5 fill-current" />
                      Popular
                    </div>
                  )}

                  {/* Accent dot + title */}
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${accent.dot}`} />
                    <h3 className="text-lg font-extrabold leading-tight text-foreground">{course.name}</h3>
                  </div>

                  {/* Description */}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {course.description}
                  </p>

                  {/* Duration chip */}
                  <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="size-3 text-primary" />
                    {course.duration}
                  </div>

                  {/* Topics */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(course.topics ?? []).slice(0, 4).map((topic) => (
                      <span
                        key={topic}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${accent.tag}`}
                      >
                        {topic}
                      </span>
                    ))}
                    {(course.topics ?? []).length > 4 && (
                      <span className="rounded-lg border border-border/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        +{course.topics.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Footer: price + CTA */}
                  <div className="mt-auto flex items-end justify-between pt-5">
                    <Link
                      href={`/courses/${course.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Eye className="size-3.5" />
                      Details
                    </Link>
                    {fee > 0 && (
                      <div className="flex items-center gap-0.5 text-foreground">
                        <IndianRupee className="size-3.5 font-bold" />
                        <span className="text-lg font-extrabold">
                          {new Intl.NumberFormat("en-IN").format(fee)}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <a
            href="#contact"
            className="inline-flex items-center gap-3 rounded-2xl bg-primary px-9 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:scale-[1.04] hover:bg-primary/90"
          >
            Enquire About Any Course
            <ArrowRight className="size-5" />
          </a>
          <Link
            href="/courses"
            className="inline-flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-9 py-4 text-base font-bold text-foreground transition-all hover:border-primary/30 hover:bg-muted hover:scale-[1.04]"
          >
            View Full Catalogue
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
