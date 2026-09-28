"use client"

import { motion } from "framer-motion"
import { Code2, Rocket, ArrowRight, CheckCircle2 } from "lucide-react"

const programmes = [
  {
    icon: Code2,
    name: "Python Full Stack",
    duration: "6 Months",
    image:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    topics: ["Core Python", "Django", "HTML/CSS", "JavaScript", "Live Project"],
    color: "from-cyan-500 to-blue-600",
    glow: "shadow-cyan-500/30",
  },
  {
    icon: Rocket,
    name: "Java Full Stack",
    duration: "6 Months",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80",
    topics: ["Core Java", "Spring Boot", "HTML/CSS", "JavaScript", "Live Project"],
    color: "from-violet-500 to-purple-700",
    glow: "shadow-violet-500/30",
  },
]

const outcomes = [
  "Industry-ready portfolio",
  "Live project certificate",
  "Job placement support",
  "High-paying developer roles",
]

export function FullStackSpotlight() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Background image with dark overlay */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1920&q=75')",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/88" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.18),_transparent_65%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-300"
          >
            🔥 Most Popular
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Full Stack{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Programmes
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="mt-4 text-base text-slate-400"
          >
            Complete with Live Project + Industry Tools. Launch your developer career in 6 months.
          </motion.p>
        </div>

        {/* Programme cards */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {programmes.map((prog, i) => (
            <motion.div
              key={prog.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.12 }}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl ${prog.glow} backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20`}
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url('${prog.image}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                {/* Duration pill */}
                <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {prog.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-7">
                <div className="flex items-center gap-3">
                  <div className={`flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br ${prog.color} shadow-lg`}>
                    <prog.icon className="size-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white">{prog.name}</h3>
                </div>

                {/* Topics */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {prog.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Outcomes + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-12 flex flex-col items-center gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm sm:flex-row sm:justify-between"
        >
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            {outcomes.map((o) => (
              <div key={o} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                {o}
              </div>
            ))}
          </div>
          <a
            href="#contact"
            className="inline-flex shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-9 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:scale-[1.04] hover:shadow-violet-500/45"
          >
            Enquire Now
            <ArrowRight className="size-5" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
