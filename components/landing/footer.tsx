"use client"

import { Phone, MapPin, MessageCircle } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
const quickLinks = [
  { label: "Courses", href: "/courses" },
  { label: "Staff", href: "#staff" },
  { label: "Address", href: "#address" },
  { label: "Contact", href: "#contact" },
]

const socialLinks = [
  { icon: FaWhatsapp, href: "https://wa.me/918143248778", label: "WhatsApp" },
  { icon: MessageCircle, href: "https://wa.me/919550192527", label: "WhatsApp 2" },
  { icon: Phone, href: "tel:8143248778", label: "Phone" },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-extrabold sm:size-10">
                TNGC
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  The New Generation
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Computers
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-sm">
              24+ years of excellence in computer education. ISO 9001:2015
              Certified and Recognised by Govt of Telangana.
            </p>

            {/* Social Links */}
            <div className="mt-4 flex items-center gap-2.5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
                >
                  <social.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground sm:text-sm">
              Quick Links
            </h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Branches */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground sm:text-sm">
              Branches
            </h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
              <li className="flex items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                <MapPin className="size-3 mt-0.5 shrink-0 sm:size-3.5" />
                <span>Ramanthapur (Main)</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                <MapPin className="size-3 mt-0.5 shrink-0 sm:size-3.5" />
                <span>Amberpet</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                <MapPin className="size-3 mt-0.5 shrink-0 sm:size-3.5" />
                <span>Kodad</span>
              </li>
              <li className="text-[11px] text-muted-foreground/70 sm:text-xs">
                Hyderabad, Telangana
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground sm:text-sm">
              Contact
            </h3>
            <ul className="mt-3 space-y-2.5 sm:mt-4">
              <li>
                <a
                  href="tel:8143248778"
                  className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
                >
                  <Phone className="size-3 shrink-0 sm:size-3.5" />
                  8143248778
                </a>
              </li>
              <li>
                <a
                  href="tel:9550192527"
                  className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
                >
                  <Phone className="size-3 shrink-0 sm:size-3.5" />
                  9550192527
                </a>
              </li>
            </ul>

            {/* Newsletter-style CTA */}
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-[11px] font-semibold text-foreground sm:text-xs">
                Ready to enroll?
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                Call us or visit any branch.
              </p>
              <a
                href="tel:8143248778"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline sm:text-xs"
              >
                Call Now &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-5 sm:mt-10 sm:flex-row sm:pt-6">
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            &copy; 2026 The New Generation Computers. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground sm:text-xs">
            <a href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</a>
            <span>&middot;</span>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span>&middot;</span>
            <span>
              Web Design by{" "}
              <span className="font-semibold text-foreground">
                NEW GENERATION Web Services
              </span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
