"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Clock, ArrowRight, Star, Eye, IndianRupee } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

function parseFees(fees: string, feeNumeric: number): number {
  if (feeNumeric && feeNumeric > 0) return feeNumeric
  if (fees) {
    const digits = fees.replace(/[^0-9]/g, "")
    if (digits) return parseInt(digits, 10)
  }
  return 0
}

export function LongTermCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showSuggested, setShowSuggested] = useState(true)

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

        if (active) setCourses(error ? [] : (data ?? []))
      } catch {
        if (active) setCourses([])
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchCourses()
    return () => {
      active = false
    }
  }, [])

  const suggestedCourses = courses.filter((course) => course.popular)
  const visibleCourses = showSuggested ? suggestedCourses : courses

  return (
    <section id="courses" className="py-16 sm:py-24 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm"
          >
            Long-Term Professional Courses
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Build strong careers with industry-ready programmes
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/8 via-background to-primary/5 p-4 sm:flex-row"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Suggested for you</p>
            <p className="mt-1 text-sm text-muted-foreground">Focused career tracks selected for faster placements and stronger outcomes.</p>
          </div>
          <div className="inline-flex rounded-full border border-border/70 bg-background p-1">
            <button
              type="button"
              onClick={() => setShowSuggested(true)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                showSuggested ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Suggested
            </button>
            <button
              type="button"
              onClick={() => setShowSuggested(false)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                !showSuggested ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All courses
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/50" />
            ))}
          </div>
        ) : visibleCourses.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
          >
            {visibleCourses.map((course) => {
              const fee = parseFees(course.fees, course.fee_numeric)
              return (
                <motion.div
                  key={course.slug}
                  variants={cardVariants}
                  className={`group relative flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200 hover:shadow-md sm:p-6 ${
                    course.popular
                      ? "border-primary/25 ring-1 ring-primary/10"
                      : "border-border/60 hover:border-primary/15"
                  }`}
                >
                  {course.popular && (
                    <div className="mb-3 inline-flex items-center gap-1 self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Star className="size-2.5 fill-current" />
                      {showSuggested ? "Suggested" : "Popular"}
                    </div>
                  )}

                  <h3 className="text-lg font-extrabold text-foreground">
                    {course.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {course.description}
                  </p>

                  <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <Clock className="size-3" />
                    {course.duration}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {course.topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-4">
                    <Link
                      href={`/courses/${course.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Eye className="size-3.5" />
                      View Details
                    </Link>

                    {fee > 0 && (
                      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-right">
                        <IndianRupee className="size-4 text-foreground" />
                        <span className="text-lg font-extrabold text-foreground sm:text-xl">
                          {new Intl.NumberFormat("en-IN").format(fee)}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            {showSuggested
              ? "Suggested courses are being updated. Please check all courses for the latest batch details."
              : "Courses are being updated. Please contact us for the latest batch details."}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center sm:mt-10"
        >
          <a
            href="#contact"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-6 text-sm")}
          >
            Enquire About All Courses
            <ArrowRight className="size-4" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}