"use client"

import { motion } from "framer-motion"
import { Users, Monitor, CreditCard, Layers, CheckCircle2 } from "lucide-react"

const bigStats = [
  {
    value: "11",
    unit: "seats",
    label: "Per Batch",
    desc: "Every student gets a dedicated system — no sharing, pure focus.",
    icon: Users,
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "bg-blue-500/15 text-blue-400",
    border: "border-blue-500/20",
  },
  {
    value: "11",
    unit: "systems",
    label: "In the Lab",
    desc: "Individual computers for every seat so practice is always hands-on.",
    icon: Monitor,
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "bg-emerald-500/15 text-emerald-400",
    border: "border-emerald-500/20",
  },
  {
    value: "3",
    unit: "max",
    label: "Installments",
    desc: "Pay in 2–3 easy instalments. Talk to us for a plan that fits your budget.",
    icon: CreditCard,
    color: "from-violet-500/20 to-violet-600/5",
    iconColor: "bg-violet-500/15 text-violet-400",
    border: "border-violet-500/20",
  },
  {
    value: "24+",
    unit: "years",
    label: "Of Trust",
    desc: "Thousands of alumni working across India and abroad since 2000.",
    icon: Layers,
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "bg-amber-500/15 text-amber-400",
    border: "border-amber-500/20",
  },
]

const perks = [
  "Certificate valid for abroad processing",
  "Registrable with all Employment Exchanges",
  "Special batches for homemakers & employees",
  "Telugu medium students welcome",
]

export function InfoSections() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mx-auto max-w-xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-[0.22em] text-primary"
          >
            Why we&apos;re different
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl"
          >
            Built around your success
          </motion.h2>
        </div>

        {/* Stat cards */}
        <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {bigStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.08 }}
              className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br ${stat.color} ${stat.border} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-7`}
            >
              <div className={`inline-flex size-12 items-center justify-center rounded-2xl ${stat.iconColor}`}>
                <stat.icon className="size-6" />
              </div>
              <div className="mt-5">
                <div className="flex items-end gap-1.5 leading-none">
                  <span className="text-5xl font-black text-foreground sm:text-6xl">{stat.value}</span>
                  <span className="mb-1.5 text-sm font-semibold text-muted-foreground">{stat.unit}</span>
                </div>
                <p className="mt-1 text-base font-bold text-foreground">{stat.label}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stat.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Perks banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid grid-cols-1 gap-3 rounded-3xl border border-border/60 bg-muted/30 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4"
        >
          {perks.map((perk) => (
            <div key={perk} className="flex items-start gap-3 text-sm text-foreground/80">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="font-medium">{perk}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
