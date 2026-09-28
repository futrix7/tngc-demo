"use client"

import { motion } from "framer-motion"
import { Users, UserCheck, CalendarClock, GraduationCap, ArrowRight } from "lucide-react"

const features = [
  {
    icon: Users,
    tag: "Live Learning",
    title: "Career-focused classes",
    bullets: ["Real job outcomes", "Industry mentors", "Project-based work"],
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=85",
    accent: "from-cyan-500/20 to-cyan-500/5",
    iconBg: "bg-cyan-500/15 text-cyan-400",
  },
  {
    icon: UserCheck,
    tag: "Personal Support",
    title: "One-on-one attention",
    bullets: ["Small batch sizes", "Doubt clearing every class", "Progress tracking"],
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85",
    accent: "from-violet-500/20 to-violet-500/5",
    iconBg: "bg-violet-500/15 text-violet-400",
  },
  {
    icon: CalendarClock,
    tag: "Flexible",
    title: "Batches for everyone",
    bullets: ["Students & homemakers", "Working professionals", "Telugu medium batches"],
    image:
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1000&q=85",
    accent: "from-emerald-500/20 to-emerald-500/5",
    iconBg: "bg-emerald-500/15 text-emerald-400",
  },
  {
    icon: GraduationCap,
    tag: "Expert Faculty",
    title: "Experienced trainers",
    bullets: ["MCA & B.Tech qualified", "10+ years avg experience", "Industry-connected"],
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=85",
    accent: "from-amber-500/20 to-amber-500/5",
    iconBg: "bg-amber-500/15 text-amber-400",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-slate-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-400"
          >
            Why students choose us
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            A campus built to
            <span className="block bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              inspire growth
            </span>
          </motion.h2>
        </div>

        {/* Alternating feature rows */}
        <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55 }}
              className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              {/* Image */}
              <div className="group relative overflow-hidden rounded-3xl">
                <div
                  className="h-72 w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105 sm:h-80 lg:h-[22rem]"
                  style={{ backgroundImage: `url('${feature.image}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
                {/* Tag pill on image */}
                <div className="absolute left-4 top-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-gradient-to-br ${feature.accent} px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm`}>
                    {feature.tag}
                  </span>
                </div>
              </div>

              {/* Text */}
              <div>
                <div className={`inline-flex size-14 items-center justify-center rounded-2xl ${feature.iconBg}`}>
                  <feature.icon className="size-7" />
                </div>
                <h3 className="mt-5 text-3xl font-black text-white sm:text-4xl">{feature.title}</h3>
                <ul className="mt-6 space-y-3">
                  {feature.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-base text-slate-300">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <ArrowRight className="size-3 text-white" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
