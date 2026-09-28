"use client"

import { motion } from "framer-motion"
import { Phone, MessageCircle, MapPin } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ContactCTA() {
  return (
    <section id="contact" className="py-20 sm:py-28 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Ready to Start Your Career?
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Take the first step{" "}
              <span className="text-primary">today</span>
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base text-muted-foreground max-w-xl mx-auto"
          >
            Call us today for admission, course details & batch timings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-5"
          >
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="tel:8143248778"
                className="inline-flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5"
              >
                <Phone className="size-5" />
                8143248778
              </a>
              <a
                href="tel:9550192527"
                className="inline-flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-8 py-4 text-lg font-bold text-card-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md hover:-translate-y-0.5"
              >
                <Phone className="size-5" />
                9550192527
              </a>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="tel:8143248778"
                className={cn(buttonVariants({ size: "lg" }), "px-7 gap-2")}
              >
                <Phone className="size-4" />
                Call Now
              </a>
              <a
                href="https://wa.me/918143248778"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-7 gap-2")}
              >
                <MessageCircle className="size-4" />
                WhatsApp Enquire
              </a>
              <a
                href="#branches"
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "px-7 gap-2")}
              >
                <MapPin className="size-4" />
                Visit Institute
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-10 rounded-2xl border border-border/60 bg-card p-6 text-card-foreground"
          >
            <p className="text-sm text-muted-foreground">
              Only Admin can register new members. Contact us to enrol.
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Special batches available for Housewives, Telugu Medium Students &
              Employees.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
