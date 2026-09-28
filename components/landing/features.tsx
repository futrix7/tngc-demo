"use client"

import { motion } from "framer-motion"
import { Users, UserCheck, CalendarClock, GraduationCap } from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Classes by Management",
    description:
      "Direct guidance from experienced management for better results.",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    icon: UserCheck,
    title: "Individual Attention",
    description:
      "Small batches and personal mentoring for every student.",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  {
    icon: CalendarClock,
    title: "Special Batches",
    description:
      "Dedicated batches for Housewives, Telugu Medium Students & Employees.",
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/10",
  },
  {
    icon: GraduationCap,
    title: "Experienced Faculties",
    description:
      "Industry-experienced trainers focused on practical, job-ready skills.",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10",
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm"
          >
            Why Students Choose Us
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Quality Education with Personal Care
          </motion.h2>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-primary/20 hover:shadow-md sm:p-6"
            >
              <div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${feature.iconBg} ${feature.iconColor} sm:size-11`}>
                <feature.icon className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
