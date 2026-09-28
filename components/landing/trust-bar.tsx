"use client"

import { motion } from "framer-motion"
import {
  ShieldCheck,
  FileCheck,
  Globe,
  Building2,
  Clock,
} from "lucide-react"

const items = [
  {
    icon: ShieldCheck,
    title: "AIACTE Affiliated",
    subtitle: "ISO 9001:2015 Certified",
    detail: "Recognised by Govt of T.S.",
  },
  {
    icon: FileCheck,
    title: "Govt Order J1/3106/16",
    subtitle: "Director of Employment",
    detail: "& Training, Hyderabad",
  },
  {
    icon: Globe,
    title: "Consulate Recognised",
    subtitle: "Certificates valid for",
    detail: "Abroad Processing",
  },
  {
    icon: Building2,
    title: "Employment Exchange",
    subtitle: "Certificates registrable with",
    detail: "All Employment Exchanges",
  },
  {
    icon: Clock,
    title: "24+ Years",
    subtitle: "Of Excellence in",
    detail: "Computer Education",
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export function TrustBar() {
  return (
    <section className="border-y border-border/50 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-6 lg:grid-cols-5"
        >
          {items.map((item) => (
            <motion.div
              key={item.title}
              variants={itemVariants}
              className="flex items-start gap-2.5 sm:gap-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10">
                <item.icon className="size-4 sm:size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  {item.subtitle}
                </p>
                <p className="text-[11px] font-semibold text-foreground/80 sm:text-xs">
                  {item.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
