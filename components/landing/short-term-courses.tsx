"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, Eye } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Course {
  slug: string
  name: string
  duration: string
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
}

export function ShortTermCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchCourses() {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("slug, name, duration")
          .eq("type", "short-term")
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

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm"
          >
            Short-Term Skill Courses
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Quick learning for immediate results
          </motion.h2>
        </div>

        {loading ? (
          <div className="mt-10 grid grid-cols-2 gap-2.5 sm:mt-12 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border border-border/60 bg-muted/50" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Short-term courses are being updated. Contact us for the latest batch details.
          </p>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-10 grid grid-cols-2 gap-2.5 sm:mt-12 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
          >
            {courses.map((course) => (
              <motion.div
                key={course.name}
                variants={itemVariants}
                className="group flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2.5 text-card-foreground transition-all duration-200 hover:border-primary/15 hover:shadow-sm sm:px-4 sm:py-3"
              >
                <span className="text-xs font-semibold sm:text-sm">{course.name}</span>
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                    <Clock className="size-2.5 sm:size-3" />
                    {course.duration}
                  </span>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label={`View ${course.name} details`}
                  >
                    <Eye className="size-3 sm:size-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
