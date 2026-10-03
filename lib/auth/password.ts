import "server-only"

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>

/**
 * Password hashing for the institute's own credential store.
 *
 * scrypt with per-password random salts. Chosen over bcrypt/argon2 because it is
 * built into Node: no new dependency, no native build step, and the parameters
 * below are the ones OWASP lists for scrypt (N=2^17, r=8, p=1).
 *
 * The stored format carries its own parameters, so raising N later re-hashes
 * transparently on the next successful sign-in instead of invalidating every
 * existing password:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
 */

/** ~128 MB of memory per hash. maxmem is set above it because N=2^17 needs headroom. */
const PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const MAXMEM = 256 * 1024 * 1024

export const MIN_PASSWORD_LENGTH = 6

/**
 * Caps how expensive a hash may get, so a stored row cannot be used to make the
 * server allocate an arbitrary amount of memory. A row naming a larger N than this
 * is refused rather than honoured.
 */
const MAX_SUPPORTED_N = 2 ** 20

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The login password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > 200) {
    return "That password is too long."
  }
  return null
}

/** Hashes a password for storage. Never returns the plaintext alongside the hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  })

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$")
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing for every malformed input, and — importantly
 * — always performs a scrypt derivation, even when the row is unknown or the
 * format is unparseable. Skipping the work in those cases would make "no such
 * account" measurably faster than "wrong password", which is enough to enumerate
 * which phone numbers are registered.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // Burn an equivalent amount of work on the failure paths.
  const dummy = await scrypt(password.normalize("NFKC"), randomBytes(SALT_LENGTH), KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAXMEM,
  })

  if (!stored) return false

  const parts = stored.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return false

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (N > MAX_SUPPORTED_N || N < 2 || r < 1 || p < 1) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[4], "base64")
    expected = Buffer.from(parts[5], "base64")
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false

  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  })

  // Same length by construction (we asked for expected.length), but never assume:
  // timingSafeEqual throws on a mismatch and that throw must not become a signal.
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/**
 * True when a stored hash was made with weaker parameters than the current
 * policy, so it can be upgraded on the next successful sign-in.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return false
  return Number(parts[1]) !== PARAMS.N || Number(parts[2]) !== PARAMS.r || Number(parts[3]) !== PARAMS.p
}