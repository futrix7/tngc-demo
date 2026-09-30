/**
 * Client-minted primary keys for tables whose `id` is a plain TEXT column.
 *
 * `teachers`, `videos` and `certificates` all key on TEXT rather than uuid, so
 * the browser has to invent the value. `Date.now()` on its own is not enough: it
 * is millisecond-resolution, and two records created in the same millisecond
 * collide on the primary key. The second insert fails with a duplicate-key error
 * that surfaces as "failed to add teacher" with no obvious cause — which is
 * exactly what happened when the same form was submitted twice quickly or two
 * admins worked at once.
 *
 * `crypto.randomUUID()` is used where available (every browser the institute
 * runs on, and it is available in secure contexts which this app is served in
 * over HTTPS). The timestamp is kept as a readable prefix because these ids get
 * typed, read aloud over the phone, and pasted into spreadsheets, so
 * `TCH-2026-04-a1b2c3d4` sorts and scans far better than a bare uuid. The random
 * tail is what makes it unique.
 */
export function mintId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(16).slice(2, 10).padEnd(8, "0")
  return `${prefix}-${stamp}-${uuid}`
}
