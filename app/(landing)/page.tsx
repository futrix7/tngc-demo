import { Hero } from "@/components/landing/hero"
import { TrustBar } from "@/components/landing/trust-bar"
import { LongTermCourses } from "@/components/landing/long-term-courses"
import { ShortTermCourses } from "@/components/landing/short-term-courses"
import { Staff } from "@/components/landing/staff"
import { Address } from "@/components/landing/address"
import { ContactCTA } from "@/components/landing/contact-cta"

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <LongTermCourses />
      <ShortTermCourses />
      <Staff />
      <Address />
      <ContactCTA />
    </>
  )
}
