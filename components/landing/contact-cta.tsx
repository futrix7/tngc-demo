"use client"

import { motion } from "framer-motion"
import { Phone, MessageCircle, MapPin, ArrowRight, Clock } from "lucide-react"

const actions = [
  {
    href: "tel:8143248778",
    icon: Phone,
    label: "Call Now",
    sub: "8143248778",
    style: "bg-white text-slate-900 hover:bg-white/90 shadow-2xl shadow-black/25",
  },
  {
    href: "https://wa.me/918143248778",
    icon: MessageCircle,
    label: "WhatsApp",
    sub: "Instant Reply",
    style: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-2xl shadow-emerald-900/35",
    external: true,
  },
  {
    href: "#address",
    icon: MapPin,
    label: "Visit Us",
    sub: "Ramanthapur",
    style: "border-2 border-white/30 text-white hover:bg-white/12",
  },
]

export function ContactCTA() {
  return (
    <section id="contact" className="relative overflow-hidden py-24 sm:py-36">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1920&q=75')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/96 via-slate-900/90 to-indigo-950/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.18),_transparent_55%)]" />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm"
          >
            <Clock className="size-4" />
            Admissions Open
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Ready to start your
            <span className="block bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              career journey?
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-lg text-slate-300"
          >
            Call us today for admissions, batch timings, and course details. Special batches for housewives, employees, and Telugu medium students.
          </motion.p>

          {/* Action buttons — bigger, bolder */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            {actions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`group inline-flex min-w-[200px] items-center justify-center gap-3 rounded-2xl px-9 py-5 text-lg font-extrabold transition-all duration-200 hover:scale-[1.05] hover:-translate-y-1 ${action.style}`}
              >
                <action.icon className="size-6 shrink-0" />
                <span>
                  <span className="block leading-tight">{action.label}</span>
                  <span className="block text-sm font-normal opacity-70">{action.sub}</span>
                </span>
              </a>
            ))}
          </motion.div>

          {/* Secondary contact row */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8"
          >
            <a
              href="tel:8143248778"
              className="flex items-center gap-2 text-base font-semibold text-slate-300 transition-colors hover:text-white"
            >
              <Phone className="size-4" />
              8143248778
            </a>
            <span className="hidden text-slate-600 sm:block">·</span>
            <a
              href="tel:9550192527"
              className="flex items-center gap-2 text-base font-semibold text-slate-300 transition-colors hover:text-white"
            >
              <Phone className="size-4" />
              9550192527
            </a>
            <span className="hidden text-slate-600 sm:block">·</span>
            <a
              href="#address"
              className="flex items-center gap-2 text-base font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Find our location
              <ArrowRight className="size-4" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
