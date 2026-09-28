"use client"

import { Phone, MapPin, MessageCircle, Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { FaWhatsapp } from "react-icons/fa"

const quickLinks = [
  { label: "Long-Term Courses", href: "/#courses"  },
  { label: "Staff & Faculty",   href: "/#staff"    },
  { label: "Our Address",       href: "/#address"  },
  { label: "Contact Us",        href: "/#contact"  },
  { label: "Full Catalogue",    href: "/courses"   },
]

const branches = [
  { name: "Ramanthapur",   tag: "Main", href: "https://maps.google.com/maps?q=17.39359,78.53582" },
  { name: "Amberpet",      tag: null,   href: "https://maps.google.com/maps?q=17.3786,78.5387"   },
  { name: "Kodad",         tag: null,   href: "https://maps.google.com/maps?q=17.005,80.0015"    },
]

const socialLinks = [
  { icon: FaWhatsapp,    href: "https://wa.me/918143248778", label: "WhatsApp Primary", color: "hover:text-emerald-500 hover:border-emerald-400/40 hover:bg-emerald-500/8" },
  { icon: MessageCircle, href: "https://wa.me/919550192527", label: "WhatsApp Secondary", color: "hover:text-sky-500 hover:border-sky-400/40 hover:bg-sky-500/8" },
  { icon: Phone,         href: "tel:8143248778",             label: "Phone", color: "hover:text-primary hover:border-primary/40 hover:bg-primary/8" },
]

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      {/* Top wave decoration */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-extrabold shadow-md shadow-primary/25">
                TNGC
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-foreground">The New Generation</p>
                <p className="text-[10px] font-medium text-muted-foreground">Computers · Hyderabad</p>
              </div>
            </div>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              24+ years of excellence in computer education. ISO 9001:2015 Certified and Recognised by the Govt. of Telangana.
            </p>

            {/* Credential badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {["ISO Certified", "Govt Recognised", "AIACTE"].map((b) => (
                <span key={b} className="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  {b}
                </span>
              ))}
            </div>

            {/* Social icons */}
            <div className="mt-5 flex items-center gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground transition-all duration-200 ${s.color}`}
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Quick Links</h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ArrowRight className="size-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Branches */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Our Branches</h3>
            <ul className="mt-4 space-y-3">
              {branches.map((b) => (
                <li key={b.name}>
                  <a
                    href={b.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/60 group-hover:text-primary" />
                    <span>
                      {b.name}
                      {b.tag && (
                        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                          {b.tag}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground/60">Hyderabad, Telangana</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Contact</h3>
            <ul className="mt-4 space-y-3">
              {[
                { href: "tel:8143248778",  label: "8143248778"  },
                { href: "tel:9550192527",  label: "9550192527"  },
              ].map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                    <Phone className="size-3.5 shrink-0 text-primary/60" />
                    {n.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="https://wa.me/918143248778"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-emerald-600"
                >
                  <FaWhatsapp className="size-3.5 shrink-0 text-emerald-500" />
                  WhatsApp Enquiry
                </a>
              </li>
            </ul>

            {/* CTA card */}
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/6 p-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <p className="text-xs font-extrabold text-foreground">Ready to enroll?</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Special batches for housewives, employees & Telugu medium students.
              </p>
              <a
                href="tel:8143248778"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:scale-[1.04] hover:bg-primary/90"
              >
                Call Now
                <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 The New Generation Computers. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href="/terms"   className="transition-colors hover:text-primary">Terms & Conditions</Link>
            <span className="text-border">·</span>
            <Link href="/privacy" className="transition-colors hover:text-primary">Privacy Policy</Link>
            <span className="text-border">·</span>
            <span>
              Web Design by{" "}
              <span className="font-bold text-foreground">NEW GENERATION Web Services</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
