import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[catalogue] Supabase public environment variables are missing")
    return NextResponse.json(
      { error: "The course catalogue is unavailable right now." },
      { status: 503 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const [coursesResult, branchesResult] = await Promise.all([
      supabase
        .from("courses")
        .select("slug, name, duration, fee_numeric, description")
        .eq("status", "active"),
      // Keep the database's primary branch first, then sort the rest by name.
      supabase
        .from("branches")
        .select("id, name")
        .order("is_primary", { ascending: false })
        .order("name"),
    ])

    if (coursesResult.error || branchesResult.error) {
      const errors = [coursesResult.error, branchesResult.error].filter((error) => error !== null)
      for (const error of errors) {
        console.error("[catalogue] Supabase query failed:", error.message)
      }
      return NextResponse.json(
        { error: "The course catalogue is unavailable right now." },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        courses: coursesResult.data ?? [],
        branches: branchesResult.data ?? [],
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[catalogue] Supabase request failed:", error)
    return NextResponse.json(
      { error: "The course catalogue is unavailable right now." },
      { status: 502 }
    )
  }
}
