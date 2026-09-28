import { Hero } from "@/components/landing/hero"
import { TrustBar } from "@/components/landing/trust-bar"
import { Features } from "@/components/landing/features"
import { LongTermCourses } from "@/components/landing/long-term-courses"
import { ShortTermCourses } from "@/components/landing/short-term-courses"
import { FullStackSpotlight } from "@/components/landing/fullstack-spotlight"
import { InfoSections } from "@/components/landing/info-sections"
import { Staff } from "@/components/landing/staff"
import { Address } from "@/components/landing/address"
import { Branches } from "@/components/landing/branches"
import { ContactCTA } from "@/components/landing/contact-cta"

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Features />
      <LongTermCourses />
      <ShortTermCourses />
      <FullStackSpotlight />
      <InfoSections />
      <Staff />
      <Address />
      <Branches />
      <ContactCTA />
    </>
  )
}
