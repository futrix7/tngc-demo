"use client"

import { motion } from "framer-motion"
import { Code2, ArrowRight, Sparkles, Rocket } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function FullStackSpotlight() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 sm:p-12 lg:p-16 text-primary-foreground"
        >
          <div className="absolute -right-32 -top-32 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 size-80 rounded-full bg-black/15 blur-3xl" />
          <div className="absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="size-4" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest opacity-90">
                Most Popular
              </span>
            </div>

            <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              Full Stack Programmes
            </h2>
            <p className="mt-4 max-w-xl text-base opacity-90 leading-relaxed">
              Complete with Live Project + Industry Tools. Perfect for students
              who want high-paying developer jobs.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                    <Code2 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Python Full Stack</h3>
                    <p className="text-sm opacity-70">6 Months Programme</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Core Python", "Django", "HTML/CSS", "JavaScript", "Live Project"].map((t) => (
                    <span key={t} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium opacity-80">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                    <Rocket className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Java Full Stack</h3>
                    <p className="text-sm opacity-70">6 Months Programme</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Core Java", "Spring Boot", "HTML/CSS", "JavaScript", "Live Project"].map((t) => (
                    <span key={t} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium opacity-80">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <a
                href="#contact"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-white text-primary hover:bg-white/90 px-8"
                )}
              >
                Enquire about Full Stack Batches
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
