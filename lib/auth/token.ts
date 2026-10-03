import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Two distinct kinds of credential live in this app, and mixing them up is the
 * mistake that turns a password reset into a security incident:
 *
 *  1. The **session token** — an opaque random string the user never sees, stored
 *     hashed in `app_sessions` so it can be revoked. This is what the app's own
 *     route handlers check.
 *
 *  2. The **database token** — a short-lived HS256 JWT the browser sends to
 *     PostgREST so the existing row-level security policies keep working.
 *
 * The database token is deliberately *not* a session credential. It carries only
 * the user id, is valid for minutes, and cannot be revoked — but revoking it is
 * unnecessary, because it is useless on its own: it grants nothing beyond what the
 * caller's own rows already allow, and the moment the session is gone the app stops
 * handing it out. Revocation lives in `app_sessions`.
 */

const HEADER = { alg: "HS256", typ: "JWT" } as const

function base64url(input: Buffer | string): string {
  return Buffer.from(input as never)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(padded + "=".repeat((4 - (padded.length % 4)) % 4), "base64")
}

/** Constant-time compare that tolerates length mismatches without throwing. */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, "utf8")
  const bBytes = Buffer.from(b, "utf8")
  if (aBytes.length !== bBytes.length) return false
  return timingSafeEqual(aBytes, bBytes)
}

/** Opaque, high-entropy session token. 32 bytes = 256 bits. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 of the session token, hex. What actually gets stored in the database. */
export function hashSessionToken(token: string): string {
  return createHmac("sha256", "app_users")
    .update(token)
    .digest("hex")
}

function sign(data: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(data).digest())
}

export type DatabaseTokenClaims = {
  sub: string
  role: "authenticated"
  exp: number
}

/**
 * Mints the short-lived JWT the browser presents to PostgREST.
 *
 * This is the only remaining reason a shared signing secret exists, and it exists
 * solely so the ~30 files that query the database directly from the browser keep
 * resolving their own rows through the policies already written for them. It is
 * scoped to minutes and carries no authority beyond the caller's own identity.
 */
export function mintDatabaseToken(userId: string, secret: string, ttlSeconds = 300): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify(HEADER))
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + ttlSeconds,
      iss: "tngc",
    })
  )
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`
}

/** Verifies signature and expiry. Returns null for anything malformed or forged. */
export function verifyDatabaseToken(token: string, secret: string): DatabaseTokenClaims | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  if (!safeEqual(signature, sign(`${header}.${payload}`, secret))) return null

  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(fromBase64url(payload).toString("utf8"))
  } catch {
    return null
  }

  if (claims.role !== "authenticated") return null
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return null
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null

  return { sub: claims.sub, role: "authenticated", exp: claims.exp }
}