"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Award, GraduationCap, Quote } from "lucide-react"
import { supabase } from "@/lib/supabase"

const fallbackFaculty = [
  {
    id: "fallback-1",
    name: "Nadiya",
    role: "Director",
    branch: "Ramanthapur",
    qualifications: ["MBA", "Degree"],
    description:
      "The Director of The New Generation Computers, guiding students with experience, discipline, and a strong training culture.",
    is_founder: false,
  },
  {
    id: "fallback-2",
    name: "Mada Eswar",
    role: "Founder",
    branch: "Ramanthapur",
    qualifications: [],
    description: null,
    is_founder: true,
  },
  {
    id: "fallback-3",
    name: "Mr G Madhavrao",
    role: "Coding Trainer",
    branch: "Ramanthapur",
    qualifications: ["Coding Trainer"],
    description: null,
    is_founder: false,
  },
  {
    id: "fallback-4",
    name: "Mr M Harish Kumar",
    role: "Computer Trainer",
    branch: "Ramanthapur",
    qualifications: ["Computer Trainer"],
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

/** Deterministic gradient per person based on their name */
function avatarGradient(name: string): string {
  const gradients = [
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-700",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-sky-500 to-indigo-600",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return gradients[Math.abs(hash) % gradients.length]
}

function AvatarInitials({ name, size = "lg" }: { name: string; size?: "lg" | "sm" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const grad = avatarGradient(name)

  if (size === "lg") {
    return (
      <div
        className={`flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br ${grad} text-3xl font-black text-white shadow-xl ring-4 ring-white/10 sm:size-28`}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-lg font-black text-white shadow-lg ring-2 ring-white/10`}
    >
      {initials}
    </div>
  )
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

        if (error || !data || data.length === 0) {
          applyFallback()
          return
        }

        const rows = uniqueFaculty(data as FacultyRow[]).map((faculty) => {
          if (/nadiya/i.test(faculty.name)) {
            return { ...faculty, name: "Nadiya", role: "Director", is_founder: false }
          }
          if (/mada.*eswar|eswar.*mada/i.test(faculty.name) || /founder/i.test(faculty.role)) {
            return { ...faculty, role: "Founder", is_founder: true }
          }
          return faculty
        })
        const directorRecord = rows.find((faculty) => /nadiya/i.test(faculty.name))
        const preferredDirector = {
          ...fallbackFaculty[0],
          ...(directorRecord ?? {}),
          name: "Nadiya",
          role: "Director",
          is_founder: false,
        }
        if (!rows.some((faculty) => /founder/i.test(faculty.role))) {
          rows.push(fallbackFaculty[1])
        }

        setDirector(preferredDirector)
        setMembers(
          rows.filter(
            (f) =>
              !/nadiya/i.test(f.name) &&
              !/director/i.test(f.role) &&
              (/founder/i.test(f.role) || /trainer/i.test(f.role))
          )
        )
      } catch {
        if (active) applyFallback()
      } finally {
        if (active) setLoading(false)
      }
    }

    function applyFallback() {
      const preferredDirector =
        fallbackFaculty.find((f) => /nadiya/i.test(f.name)) ?? fallbackFaculty[0]

      setDirector(preferredDirector)
      setMembers(
        fallbackFaculty.filter(
          (f) =>
            f.id !== preferredDirector?.id &&
            (/founder/i.test(f.role) || /trainer/i.test(f.role))
        )
      )
    }

    fetchFaculty()
    return () => { active = false }
  }, [])

  return (
    <section id="staff" className="bg-slate-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mx-auto max-w-xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-400"
          >
            Meet our leadership & trainers
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            The people behind your growth
          </motion.h2>
        </div>

        {loading ? (
          <div className="mt-14 space-y-6">
            <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl bg-white/5" />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-14">
            {/* Director spotlight */}
            {director && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800"
              >
                {/* decorative bg image */}
                <div className="absolute inset-0">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-10"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=60')",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-transparent" />
                </div>

                <div className="relative flex flex-col gap-8 p-8 sm:flex-row sm:items-center sm:p-10 lg:p-12">
                  <div className="shrink-0">
                    <AvatarInitials name={director.name} size="lg" />
                  </div>

                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
                      <Award className="size-3.5" />
                      {director.role}
                    </div>
                    <h3 className="mt-3 text-3xl font-black text-white sm:text-4xl">{director.name}</h3>

                    {director.qualifications?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {director.qualifications.map((q, i) => (
                          <span
                            key={`${q}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300"
                          >
                            <GraduationCap className="size-3.5 text-indigo-400" />
                            {q}
                          </span>
                        ))}
                      </div>
                    )}

                    {director.description && (
                      <div className="mt-5 flex gap-3">
                        <Quote className="mt-0.5 size-5 shrink-0 text-indigo-400/50" />
                        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
                          {director.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Team grid */}
            {members.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {members.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ delay: i * 0.08 }}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl"
                  >
                    <AvatarInitials name={member.name} size="sm" />
                    <h4 className="mt-4 text-base font-bold text-white">{member.name}</h4>
                    <p className="mt-0.5 text-sm font-semibold text-indigo-400">{member.role}</p>
                    {member.branch && (
                      <p className="mt-1 text-xs text-slate-500">{member.branch}</p>
                    )}
                    {member.qualifications?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {member.qualifications.map((q, j) => (
                          <span
                            key={`${q}-${j}`}
                            className="rounded-lg border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400"
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
