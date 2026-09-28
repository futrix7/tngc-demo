import { supabase } from "@/lib/supabase"

export interface Course {
  slug: string
  name: string
  shortName: string
  duration: string
  type: "long-term" | "short-term"
  description: string
  fullDescription: string
  topics: string[]
  fees: string
  eligibility: string
  certification: string
  popular?: boolean
  highlights: string[]
  careerOpportunities: string[]
  tools: string[]
  schedule: string
  batchSize: string
  certificationBody: string
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "active")
    .order("name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    duration: row.duration,
    type: row.type,
    description: row.description,
    fullDescription: row.full_description,
    topics: row.topics ?? [],
    fees: row.fees,
    eligibility: row.eligibility,
    certification: row.certification,
    popular: row.popular,
    highlights: row.highlights ?? [],
    careerOpportunities: row.career_opportunities ?? [],
    tools: row.tools ?? [],
    schedule: row.schedule,
    batchSize: row.batch_size,
    certificationBody: row.certification_body,
  }))
}

export async function fetchCourseBySlug(slug: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (error && error.code !== "PGRST116") throw error
  if (!data) return null

  return {
    slug: data.slug,
    name: data.name,
    shortName: data.short_name,
    duration: data.duration,
    type: data.type,
    description: data.description,
    fullDescription: data.full_description,
    topics: data.topics ?? [],
    fees: data.fees,
    eligibility: data.eligibility,
    certification: data.certification,
    popular: data.popular,
    highlights: data.highlights ?? [],
    careerOpportunities: data.career_opportunities ?? [],
    tools: data.tools ?? [],
    schedule: data.schedule,
    batchSize: data.batch_size,
    certificationBody: data.certification_body,
  }
}

export async function fetchLongTermCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "active")
    .eq("type", "long-term")
    .order("name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    duration: row.duration,
    type: row.type,
    description: row.description,
    fullDescription: row.full_description,
    topics: row.topics ?? [],
    fees: row.fees,
    eligibility: row.eligibility,
    certification: row.certification,
    popular: row.popular,
    highlights: row.highlights ?? [],
    careerOpportunities: row.career_opportunities ?? [],
    tools: row.tools ?? [],
    schedule: row.schedule,
    batchSize: row.batch_size,
    certificationBody: row.certification_body,
  }))
}

export async function fetchShortTermCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "active")
    .eq("type", "short-term")
    .order("name")

  if (error) throw error

  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    duration: row.duration,
    type: row.type,
    description: row.description,
    fullDescription: row.full_description,
    topics: row.topics ?? [],
    fees: row.fees,
    eligibility: row.eligibility,
    certification: row.certification,
    popular: row.popular,
    highlights: row.highlights ?? [],
    careerOpportunities: row.career_opportunities ?? [],
    tools: row.tools ?? [],
    schedule: row.schedule,
    batchSize: row.batch_size,
    certificationBody: row.certification_body,
  }))
}
