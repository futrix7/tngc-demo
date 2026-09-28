"use client"

import { motion } from "framer-motion"
import { Users, Monitor, CreditCard, Calendar } from "lucide-react"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function InfoSections() {
  return (
    <section className="py-16 sm:py-24 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5"
        >
          {/* Class Capacity */}
          <motion.div
            variants={cardVariants}
            className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Users className="size-5" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground sm:text-xl">
                Batch Size
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">11</p>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Monitor className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">11</p>
                  <p className="text-xs text-muted-foreground">Systems</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Each batch is limited to a maximum of <span className="font-semibold text-foreground">11 students</span> with <span className="font-semibold text-foreground">11 dedicated systems</span> for individual hands-on practice.
            </p>
          </motion.div>

          {/* Installment Structure */}
          <motion.div
            variants={cardVariants}
            className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CreditCard className="size-5" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground sm:text-xl">
                Flexible Payments
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">2 Installments</p>
                  <p className="text-xs text-muted-foreground">Minimum payment plan</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Up to 3 Installments</p>
                  <p className="text-xs text-muted-foreground">Maximum payment plan</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Pay your course fees in <span className="font-semibold text-foreground">2 to 3 easy installments</span>. Talk to us for a plan that works for you.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
