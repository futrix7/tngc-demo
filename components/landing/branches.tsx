"use client"

import { motion } from "framer-motion"
import { MapPin, Phone, Clock, Navigation, ExternalLink } from "lucide-react"

interface Branch {
  name: string
  tag?: string
  address: string
  city: string
  note?: string
  phone?: string
  lat: number
  lng: number
  primary: boolean
}

const branches: Branch[] = [
  {
    name: "TNGC - Ramanthapur",
    tag: "Main Branch",
    address: "Near Ramanthapur Bus Stand, RTC Colony Road",
    city: "Ramanthapur, Hyderabad - 500013",
    note: "Mon - Sat | 7:00 AM - 9:00 PM",
    phone: "+91 81432 48778",
    lat: 17.393590927124023,
    lng: 78.53582000732422,
    primary: true,
  },
  {
    name: "TNGC - Amberpet",
    tag: "Branch",
    address: "Amberpet Main Road",
    city: "Amberpet, Hyderabad - 500013",
    note: "Mon - Sat | 7:00 AM - 9:00 PM",
    phone: "+91 95501 92527",
    lat: 17.3786,
    lng: 78.5387,
    primary: false,
  },
  {
    name: "TNGC - Kodad",
    tag: "Branch",
    address: "Kodad Town Center",
    city: "Kodad, Telangana - 508201",
    note: "Mon - Sat | 7:00 AM - 9:00 PM",
    phone: "+91 81432 48778",
    lat: 17.005,
    lng: 80.0015,
    primary: false,
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function Branches() {
  return (
    <section id="branches" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Branches
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Visit us{" "}
              <span className="text-primary">near you</span>
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              Multiple locations across Hyderabad to make quality education accessible to everyone.
            </p>
          </motion.div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {branches.map((branch) => {
            const mapsUrl = `https://maps.google.com/maps?q=${branch.lat},${branch.lng}&z=17&hl=en`

            return (
              <motion.div
                key={branch.name}
                variants={cardVariants}
                className={`group relative overflow-hidden rounded-2xl border bg-card text-card-foreground transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  branch.primary
                    ? "border-primary/30 ring-1 ring-primary/10"
                    : "border-border/60 hover:border-primary/20"
                }`}
              >
                {branch.primary && (
                  <div className="absolute top-0 left-0 z-10 h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
                )}

                <div className="relative h-40 w-full overflow-hidden">
                  <iframe
                    title={`Map - ${branch.name}`}
                    src={`https://www.google.com/maps?q=${branch.lat},${branch.lng}&z=15&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0 grayscale transition-all duration-300 group-hover:grayscale-0"
                    allowFullScreen
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                </div>

                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        branch.primary
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      } transition-colors`}
                    >
                      <MapPin className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-extrabold text-foreground">
                        {branch.name}
                      </h3>
                      {branch.tag && (
                        <span className="inline-block mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                          {branch.tag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {branch.address}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {branch.city}
                    </p>
                    {branch.phone && (
                      <a
                        href={`tel:${branch.phone}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Phone className="size-3.5" />
                        {branch.phone}
                      </a>
                    )}
                    {branch.note && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {branch.note}
                      </p>
                    )}
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Navigation className="size-4" />
                    Get Directions
                    <ExternalLink className="size-3.5 opacity-60" />
                  </a>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
