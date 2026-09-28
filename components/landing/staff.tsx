"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Award, GraduationCap, User } from "lucide-react"
import { supabase } from "@/lib/supabase"

const fallbackFaculty = [
  {
    id: "fallback-1",
    name: "Mr. Mada Eswar Rao",
    role: "Founder & Director",
    branch: "Ramanthapur",
    qualifications: ["MCA Gold Medalist", "M.Tech"],
    description:
      "With over 24 years of experience in computer education, Mr. Mada Eswar Rao has been instrumental in shaping the careers of thousands of students. His vision and dedication have made TNGC one of the most trusted computer training institutes in Hyderabad.",
    is_founder: true,
  },
  {
    id: "fallback-2",
    name: "Mrs. S Sowmya",
    role: "Manager",
    branch: "Ramanthapur",
    qualifications: ["MCA", "5+ Years Experience"],
    description: null,
    is_founder: false,
  },
  {
    id: "fallback-3",
    name: "Mr. V Rajesh",
    role: "Coding Trainer",
    branch: "Ramanthapur",
    qualifications: ["B.Tech", "3+ Years Experience"],
    description: null,
    is_founder: false,
  },
  {
    id: "fallback-4",
    name: "Mrs. K Lavanya",
    role: "Computer Trainer",
    branch: "Ramanthapur",
    qualifications: ["MCA", "4+ Years Experience"],
    description: null,
    is_founder: false,
  },
  {
    id: "fallback-5",
    name: "Mrs. P Soundarya",
    role: "Accountant",
    branch: "Ramanthapur",
    qualifications: ["M.Com", "5+ Years Experience"],
    description: null,
    is_founder: false,
  },
]

interface FacultyRow {
  id: string
  name: string
  role: string
  branch: string | null
  qualifications: string[]
  description: string | null
  is_founder: boolean
}

/**
 * A person is identified by name and role together.
 *
 * `name` alone is not enough: two trainers can share it. Used to collapse repeat
 * rows, because `faculty` has no unique key and an unguarded seed appends a fresh
 * copy of the whole team on every run of supabase.sql. The migration now
 * de-duplicates the table, but a page that renders one card per row should not
 * depend on that having been applied to be correct.
 */
function facultyIdentity(row: FacultyRow): string {
  return `${row.name}::${row.role}`
}

function uniqueFaculty(rows: FacultyRow[]): FacultyRow[] {
  const seen = new Set<string>()
  const kept: FacultyRow[] = []

  for (const row of rows) {
    const identity = facultyIdentity(row)
    if (seen.has(identity)) continue
    seen.add(identity)
    kept.push(row)
  }

  return kept
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function Staff() {
  const [director, setDirector] = useState<FacultyRow | null>(null)
  const [members, setMembers] = useState<FacultyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchFaculty() {
      try {
        const { data, error } = await supabase
          .from("faculty")
          .select("id, name, role, branch, qualifications, description, is_founder")
          .order("is_founder", { ascending: false })

        if (!active) return

        if (error) {
          console.error("[landing] faculty lookup failed:", error.message)
          applyFallback()
          return
        }

        if (!data || data.length === 0) {
          // Not the same fault as a failed query, and worth saying so: the page
          // is about to render the hardcoded team, which looks correct and is not
          // what the database holds.
          console.error("[landing] faculty returned no rows — falling back to the hardcoded team.")
          applyFallback()
          return
        }

        const rows = uniqueFaculty(data as FacultyRow[])
        setDirector(rows.find((f) => f.is_founder) ?? rows[0] ?? null)
        setMembers(rows.filter((f) => !f.is_founder))
      } catch {
        if (active) applyFallback()
      } finally {
        if (active) setLoading(false)
      }
    }

    function applyFallback() {
      setDirector(fallbackFaculty.find((f) => f.is_founder) ?? null)
      setMembers(fallbackFaculty.filter((f) => !f.is_founder))
    }

    fetchFaculty()
    return () => {
      active = false
    }
  }, [])

  return (
    <section id="staff" className="py-16 sm:py-24 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm"
          >
            Meet Our Team
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            About the Founder & Our Faculty
          </motion.h2>
        </div>

        {loading ? (
          <div className="mt-10 sm:mt-12 space-y-8">
            <div className="mx-auto max-w-5xl h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/50" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/60 bg-muted/50" />
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-10 sm:mt-12"
          >
            {director && (
              <motion.div
                variants={cardVariants}
                className="mx-auto mb-8 max-w-5xl overflow-hidden rounded-2xl border border-primary/20 bg-card ring-1 ring-primary/10"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="relative flex items-center justify-center bg-gradient-to-b from-primary/8 via-primary/5 to-primary/10 md:w-56 lg:w-64 min-h-[320px] md:min-h-[400px]">
                    <div className="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/10 sm:size-32 lg:size-36">
                      <User className="size-14 sm:size-16" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
                  </div>

                  <div className="flex-1 p-6 sm:p-8 lg:p-10">
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Award className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary sm:text-xs">
                        {director.role}
                      </span>
                    </div>

                    <h3 className="mt-4 text-2xl font-extrabold text-foreground sm:text-3xl">
                      {director.name}
                    </h3>

                    {director.qualifications?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {director.qualifications.map((q, i) => (
                          <span
                            key={`${q}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground sm:text-xs"
                          >
                            <GraduationCap className="size-3.5 text-primary" />
                            {q}
                          </span>
                        ))}
                      </div>
                    )}

                    {director.description && (
                      <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {director.description}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {members.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {members.map((member) => (
                  <motion.div
                    key={member.id}
                    variants={cardVariants}
                    className="group rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-primary/15 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:size-11">
                      <User className="size-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-foreground sm:text-base">
                      {member.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-primary sm:text-sm">
                      {member.role}
                    </p>
                    {member.branch && (
                      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                        {member.branch}
                      </p>
                    )}
                    {member.qualifications?.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1">
                        {member.qualifications.map((q, i) => (
                          <span
                            key={`${q}-${i}`}
                            className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {q}
                          </span>
                        ))}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  )
}