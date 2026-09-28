"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, Eye, Zap } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Course {
  slug: string
  name: string
  duration: string
}

/* ── Hardcoded fallback — always shown when Supabase is unreachable ── */
const FALLBACK_COURSES: Course[] = [
  { slug: "ms-word",            name: "MS Word",              duration: "1 Month"  },
  { slug: "ms-excel",           name: "MS Excel",             duration: "1 Month"  },
  { slug: "ms-powerpoint",      name: "MS PowerPoint",        duration: "1 Month"  },
  { slug: "internet-basics",    name: "Internet & Email",     duration: "2 Weeks"  },
  { slug: "tally-basic",        name: "Tally Basic",          duration: "1 Month"  },
  { slug: "photoshop",          name: "Photoshop",            duration: "1 Month"  },
  { slug: "canva",              name: "Canva Design",         duration: "2 Weeks"  },
  { slug: "python-basics",      name: "Python Basics",        duration: "6 Weeks"  },
  { slug: "html-css",           name: "HTML & CSS",           duration: "6 Weeks"  },
  { slug: "javascript-basics",  name: "JavaScript Basics",    duration: "6 Weeks"  },
  { slug: "coreldraw",          name: "CorelDRAW",            duration: "1 Month"  },
  { slug: "typing",             name: "Typing (Eng/Tel)",     duration: "1 Month"  },
  { slug: "data-entry",         name: "Data Entry",           duration: "2 Weeks"  },
  { slug: "gst-filing",         name: "GST & E-Filing",       duration: "3 Weeks"  },
  { slug: "youtube-creation",   name: "YouTube Creation",     duration: "2 Weeks"  },
  { slug: "social-media",       name: "Social Media Mktg",    duration: "1 Month"  },
]

/* Rotating colour classes for pills */
const PILL_COLORS = [
  "border-indigo-400/40 bg-indigo-500/8 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/16",
  "border-violet-400/40 bg-violet-500/8 text-violet-700 dark:text-violet-300 hover:bg-violet-500/16",
  "border-pink-400/40 bg-pink-500/8 text-pink-700 dark:text-pink-300 hover:bg-pink-500/16",
  "border-amber-400/40 bg-amber-500/8 text-amber-700 dark:text-amber-300 hover:bg-amber-500/16",
  "border-sky-400/40 bg-sky-500/8 text-sky-700 dark:text-sky-300 hover:bg-sky-500/16",
  "border-emerald-400/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/16",
  "border-rose-400/40 bg-rose-500/8 text-rose-700 dark:text-rose-300 hover:bg-rose-500/16",
  "border-orange-400/40 bg-orange-500/8 text-orange-700 dark:text-orange-300 hover:bg-orange-500/16",
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
} as const

const pill = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
} as const

export function ShortTermCourses() {
  const [courses, setCourses] = useState<Course[]>(FALLBACK_COURSES)
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
    <section className="relative py-20 sm:py-28 overflow-hidden bg-muted/30">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-violet-500/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-amber-500/6 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300"
          >
            <Zap className="size-3.5 fill-amber-500 text-amber-500" />
            Short-Term Skill Courses
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Quick skills,{" "}
            <span className="text-gradient-primary">instant results</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="mt-3 text-base text-muted-foreground"
          >
            Focused short courses you can complete in weeks — perfect for adding specific skills fast.
          </motion.p>
        </div>

        {/* Pills grid */}
        {loading ? (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="h-10 w-32 animate-pulse rounded-2xl border border-border/60 bg-muted/50" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            {courses.map((course, i) => (
              <motion.div
                key={course.slug}
                variants={pill}
                whileHover={{ scale: 1.06, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.97 }}
              >
                <Link
                  href={`/courses/${course.slug}`}
                  className={`group flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${PILL_COLORS[i % PILL_COLORS.length]}`}
                >
                  <span>{course.name}</span>
                  <span className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold dark:bg-white/10">
                    <Clock className="size-2.5" />
                    {course.duration}
                  </span>
                  <Eye className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center text-base text-muted-foreground"
        >
          Can&apos;t find what you&apos;re looking for?{" "}
          <a href="#contact" className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary/20 hover:scale-[1.03]">
            Contact us
          </a>{" "}
          — we customise batches too.
        </motion.p>
      </div>
    </section>
  )
}
