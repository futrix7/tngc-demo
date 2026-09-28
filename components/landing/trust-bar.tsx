"use client"

import { motion } from "framer-motion"
import { ShieldCheck, FileCheck, Globe, Building2, Clock, BadgeCheck } from "lucide-react"

const items = [
  { icon: ShieldCheck, title: "AIACTE Affiliated", sub: "ISO 9001:2015 Certified" },
  { icon: FileCheck, title: "Govt Order J1/3106/16", sub: "Director of Employment & Training" },
  { icon: Globe, title: "Consulate Recognised", sub: "Valid for Abroad Processing" },
  { icon: Building2, title: "Employment Exchange", sub: "All Exchanges Recognised" },
  { icon: Clock, title: "24+ Years", sub: "Of Excellence" },
  { icon: BadgeCheck, title: "Govt of Telangana", sub: "Officially Recognised" },
]

export function TrustBar() {
  // Duplicate for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="relative overflow-hidden border-y border-border/50 bg-background py-4">
      {/* fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
        className="flex w-max gap-4"
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 px-5 py-3 backdrop-blur-sm"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
