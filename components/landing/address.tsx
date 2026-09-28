"use client"

import { motion } from "framer-motion"
import { MapPin, Navigation, ExternalLink } from "lucide-react"

const LAT = 17.393590927124023
const LNG = 78.53582000732422
const MAPS_URL = `https://maps.google.com/maps?q=${LAT}%2C${LNG}&z=17&hl=en`
const EMBED_URL = `https://www.google.com/maps?q=${LAT},${LNG}&z=17&output=embed`

export function Address() {
  return (
    <section id="address" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm"
          >
            Find Us
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Our Location
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mt-10 max-w-5xl sm:mt-12"
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            {/* Map */}
            <div className="relative h-64 w-full sm:h-80 lg:h-96">
              <iframe
                title="TNGC - Ramanthapur Branch Location"
                src={EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
                allowFullScreen
              />
            </div>

            {/* Info + CTA */}
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-14">
                  <MapPin className="size-6 sm:size-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-foreground sm:text-xl">
                    TNGC - Ramanthapur Branch
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    3-3-21/B, 1st Floor, Sharada Nagar,
                    <br />
                    RTC Colony Road, Ramanthapur,
                    <br />
                    Hyderabad - 500013
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Navigation className="size-4 text-primary" />
                    <span>
                      <span className="font-semibold text-foreground">Landmark:</span>{" "}
                      Susheela Hospital
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:self-center"
              >
                <Navigation className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                Open in Maps
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}