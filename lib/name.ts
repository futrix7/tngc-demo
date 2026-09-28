/**
 * Name display helpers.
 *
 * The portal greets people by surname, so the trailing word of
 * `students.full_name` is what gets shown. It is derived rather than stored
 * because the name is a single free-text field: there is no `last_name` column
 * to read, and no guarantee the value has more than one word.
 */

/**
 * The trailing word of a full name, for a "Welcome, <surname>" greeting.
 *
 * Falls back to the whole name when there is only one word, so a student whose
 * `full_name` is a single token is greeted by that token rather than by nothing.
 * Returns "" for a missing or blank name, leaving the fallback to the caller —
 * a caller that wants "Student" should not have to import that string from here.
 *
 * Split on whitespace rather than on a single space, because the field is free
 * text: "Rahul  Kumar" is a two-word name, not a two-word name with an empty
 * word in the middle, and `split(" ")` would return "Kumar" from it by accident
 * while returning "" for a leading space.
 *
 * A suffix is treated as part of the name, so "Kumar Jr." greets as "Kumar Jr."
 * rather than "Jr.". Surname conventions are not uniform enough across the
 * names this institute admits to strip one reliably, and guessing wrong greets
 * someone by their suffix.
 */
export function lastName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}

/**
 * One or two initials for an avatar.
 *
 * Capped at two because the avatars holding these are fixed-size circles: an
 * uncapped `map(n => n[0])` over a three-part name renders three letters into a
 * `size-12` circle, which overflows it. Three-part names are the common case
 * here, not the exception, so the cap is the normal path rather than a guard.
 *
 * Keeps the FIRST and LAST initial, skipping the middle ones, so "Rahul Kumar
 * Sharma" reads "RS" — recognisable — rather than "RKS".
 */
export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
