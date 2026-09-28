"use client"

import { fetchCourses, type Course } from "@/lib/courses"
import { useEffect, useState } from "react"
import {
  Clock,
  GraduationCap,
  Star,
  ArrowRight,
  BookOpen,
  Award,
  Users,
  Wrench,
  ArrowLeft,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"

function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group relative flex flex-col rounded-2xl border bg-card transition-all hover:shadow-xl hover:border-primary/30 overflow-hidden"
    >
      <div className="p-6 pb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
            {course.name}
          </h3>
          <span className="shrink-0 text-lg font-extrabold text-foreground leading-none">
            {course.fees}
          </span>
        </div>

        {course.popular && (
          <Badge className="mb-3 bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] w-fit">
            <Star className="size-2.5 fill-current mr-0.5" />
            Most Popular
          </Badge>
        )}

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {course.description}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 text-primary shrink-0" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GraduationCap className="size-3.5 text-primary shrink-0" />
            {course.eligibility}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5 text-primary shrink-0" />
            {course.batchSize}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {course.topics.slice(0, 5).map((topic) => (
            <span
              key={topic}
              className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {topic}
            </span>
          ))}
          {course.topics.length > 5 && (
            <span className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              +{course.topics.length - 5} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto border-t bg-muted/30 px-6 py-3.5">
        <div className="flex items-center justify-between">
          <span
            className="relative text-xs text-muted-foreground max-w-[55%] truncate"
            title={course.certification}
          >
            <span className="inline-flex items-center gap-1.5">
              <Award className="size-3.5 text-primary shrink-0" />
              {course.certification.length > 22
                ? course.certification.slice(0, 22) + "..."
                : course.certification}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
            View Details
            <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoading(false))
  }, [])

  const longTerm = courses.filter((c) => c.type === "long-term")
  const shortTerm = courses.filter((c) => c.type === "short-term")

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl lg:text-5xl">
            Our Courses
          </h1>
          <p className="mt-3 text-muted-foreground sm:text-lg">
            {courses.length} courses across {longTerm.length} long-term and {shortTerm.length} short-term programmes
          </p>
        </div>

        <div className="mb-14">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="rounded-xl bg-primary/10 p-2">
              <BookOpen className="size-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Long-Term Courses</h2>
            <Badge variant="secondary" className="ml-1 text-xs">{longTerm.length}</Badge>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {longTerm.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
            {longTerm.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                Long-term courses are being updated. Contact us for batch details.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="rounded-xl bg-primary/10 p-2">
              <Wrench className="size-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Short-Term Courses</h2>
            <Badge variant="secondary" className="ml-1 text-xs">{shortTerm.length}</Badge>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {shortTerm.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
            {shortTerm.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                Short-term courses are being updated. Contact us for batch details.
              </p>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
