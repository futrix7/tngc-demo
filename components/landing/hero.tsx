"use client"

import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, BadgeCheck, Sparkles, Star, Users, Award, TrendingUp } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRef } from "react"

const stats = [
  { value: "24+", label: "Years of Excellence", icon: Award },
  { value: "1000+", label: "Students Trained", icon: Users },
  { value: "11", label: "Students Per Batch", icon: TrendingUp },
]

const floatingBadges = [
  { text: "ISO 9001:2015 Certified", color: "from-indigo-500/20 to-indigo-500/5", border: "border-indigo-400/30", textColor: "text-indigo-200" },
  { text: "Govt. of Telangana Recognised", color: "from-violet-500/20 to-violet-500/5", border: "border-violet-400/30", textColor: "text-violet-200" },
  { text: "AIACTE Affiliated", color: "from-amber-500/20 to-amber-500/5", border: "border-amber-400/30", textColor: "text-amber-200" },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex flex-col">
      {/* Parallax background image */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 z-0"
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-slate-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.15),_transparent_50%)]" />
      </motion.div>

      {/* Animated grid pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <motion.div style={{ opacity }} className="relative z-10 flex flex-1 flex-col">
        {/* Main content */}
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
          <div className="grid min-h-[calc(100vh-8rem)] items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left column */}
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200 backdrop-blur-sm"
              >
                <Sparkles className="size-3.5" />
                Hyderabad&apos;s Premier Computer Institute
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-6 text-5xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl"
              >
                Learn Skills.
                <span className="block bg-gradient-to-r from-indigo-300 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  Build Careers.
                </span>
                <span className="block text-white/90">Change Lives.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-6 max-w-md text-lg leading-relaxed text-slate-300"
              >
                Join thousands of students who launched their careers with TNGC&apos;s hands-on computer training programmes.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.42 }}
                className="mt-8 flex flex-wrap gap-4"
              >
                <Link
                  href="/auth/user/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "group gap-3 rounded-2xl px-9 py-4 text-base font-bold shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.04] hover:shadow-indigo-500/50 h-auto"
                  )}
                >
                  Start Learning Today
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/#courses"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "gap-3 rounded-2xl border-white/25 bg-white/8 px-9 py-4 text-base font-bold text-white backdrop-blur-sm hover:border-indigo-300/50 hover:bg-indigo-500/15 hover:scale-[1.04] h-auto"
                  )}
                >
                  Explore Courses
                </Link>
              </motion.div>

              {/* Floating credential badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="mt-10 flex flex-wrap gap-2"
              >
                {floatingBadges.map((badge) => (
                  <div
                    key={badge.text}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm",
                      badge.color,
                      badge.border,
                      badge.textColor
                    )}
                  >
                    <BadgeCheck className="size-3" />
                    {badge.text}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right column — image mosaic */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden lg:flex"
            >
              {/* Glow blobs */}
              <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="absolute -right-10 bottom-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

              <div className="relative grid w-full grid-cols-2 gap-4">
                {/* Main large image */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="col-span-2 relative h-64 overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=85')",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                      <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                      Career-focused training since 2000
                    </div>
                  </div>
                </motion.div>

                {/* Bottom-left image */}
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="relative h-48 overflow-hidden rounded-2xl border border-white/10 shadow-xl"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80')",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-xs font-bold text-white">Small Batches</p>
                    <p className="text-[10px] text-slate-300">One-on-one attention</p>
                  </div>
                </motion.div>

                {/* Bottom-right stats card */}
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex h-48 flex-col justify-between rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-5 backdrop-blur-sm shadow-xl"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">Our Numbers</p>
                  <div className="space-y-3">
                    {stats.map((stat) => (
                      <div key={stat.label} className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-400/15 text-indigo-300">
                          <stat.icon className="size-3.5" />
                        </div>
                        <div>
                          <p className="text-lg font-black leading-none text-white">{stat.value}</p>
                          <p className="text-[9px] font-medium text-slate-400">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom stats strip — mobile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="relative z-10 border-t border-white/10 bg-white/5 backdrop-blur-sm lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/10 px-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center py-4">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="mt-0.5 text-center text-[10px] font-medium text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
