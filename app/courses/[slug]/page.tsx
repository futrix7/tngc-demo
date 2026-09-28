"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchCourseBySlug, type Course } from "@/lib/courses"
import {
  Clock,
  Award,
  IndianRupee,
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
  Briefcase,
  Star,
  Calendar,
  Users,
  Building2,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"

export default function CourseDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetchCourseBySlug(slug)
      .then(setCourse)
      .catch(() => setCourse(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Course not found.</p>
          <Link
            href="/courses"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" />
            Browse All Courses
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-4xl px-4 pt-28 pb-8 sm:px-6 sm:pb-12 lg:px-8">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Courses
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              {course.popular && (
                <Badge className="mb-3">
                  <Star className="size-3 fill-current" />
                  Popular
                </Badge>
              )}
              <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                {course.name}
              </h1>
              <p className="mt-1 text-base text-muted-foreground sm:text-lg">
                {course.description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Clock className="size-3.5" />
              {course.duration}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <IndianRupee className="size-3.5" />
              {course.fees}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <GraduationCap className="size-3.5" />
              {course.eligibility}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <Calendar className="mx-auto mb-1 size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Schedule</p>
              <p className="text-sm font-semibold">{course.schedule}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Users className="mx-auto mb-1 size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Batch Size</p>
              <p className="text-sm font-semibold">{course.batchSize}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Building2 className="mx-auto mb-1 size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Certified By</p>
              <p className="text-sm font-semibold">{course.certificationBody}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Award className="mx-auto mb-1 size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Certificate</p>
              <p className="text-sm font-semibold truncate">{course.certification}</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground">About this Course</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {course.fullDescription}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground">What You Will Learn</h2>
            {course.topics.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {course.topics.map((topic) => (
                  <div
                    key={topic}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    {topic}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Full syllabus is shared at the time of admission.
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground">Tools & Technologies</h2>
            {course.tools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {course.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    <Wrench className="size-3" />
                    {tool}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Tools are covered as part of the curriculum.
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground">Course Highlights</h2>
            {course.highlights.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {course.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Contact us for detailed course highlights.
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-foreground">Career Opportunities</h2>
            {course.careerOpportunities.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {course.careerOpportunities.map((opp) => (
                  <span
                    key={opp}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Briefcase className="size-3 text-primary" />
                    {opp}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Career guidance is provided after course completion.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="tel:8143248778"
              className={cn(buttonVariants({ size: "lg" }), "px-6 text-sm")}
            >
              Enroll Now
            </a>
            <a
              href="https://wa.me/918143248778"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-6 text-sm"
              )}
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
