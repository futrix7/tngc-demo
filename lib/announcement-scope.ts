// Which announcements one student should see.
//
// `announcements.target` is chosen by the admin when the notice is written:
// "All Students & Staff", "All Students", "Python Students", "Java Students" or
// "All Staff". The student portal has been showing every row regardless, so a
// Java student reads Python-specific notices and everybody reads the staff-only
// ones. The target list is resolved here so the dashboard and the announcements
// page ask for the same thing.
//
// This is presentation scoping, not a security boundary: `announcements` is
// public-readable by design (an institute notice board), and RLS is what
// decides who may read it. Hiding a row from a student is a matter of not
// showing them a notice written for somebody else.
//
// The target set is closed because `components/admin/announcement-dialog.tsx`
// hardcodes the same options — add one there and add it here too.

const BASE_TARGETS = ["All Students & Staff", "All Students"]

const PYTHON_COURSES = new Set([
  "core-python",
  "oops-python",
  "python-full-stack",
  "pgppl",
])

const JAVA_COURSES = new Set([
  "core-java",
  "advanced-java",
  "java-full-stack",
  "pgjpl",
])

/**
 * Targets to ask Postgres for. Passed to `.in("target", ...)`, so the server
 * filters before any LIMIT: the dashboard's "recent 5" becomes five notices this
 * student can actually read, instead of five that were then thrown away.
 */
export function announcementTargetsFor(courseSlug: string | null): string[] {
  const slug = (courseSlug ?? "").trim().toLowerCase()
  const targets = [...BASE_TARGETS]
  if (PYTHON_COURSES.has(slug)) targets.push("Python Students")
  if (JAVA_COURSES.has(slug)) targets.push("Java Students")
  return targets
}
