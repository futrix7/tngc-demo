export type AuthRecovery =
  | "signin"
  | "reset"
  | "resend-confirmation"
  | "retry"
  | "contact-support"
  | "none"

export type AuthErrorInfo = {
  message: string
  recovery: AuthRecovery
  alreadyRegistered: boolean
}

type Rule = {
  test: RegExp
  message: string
  recovery: AuthRecovery
  alreadyRegistered?: boolean
}

const AUTH_RULES: Rule[] = [
  {
    test: /user already registered|already been registered|already exists|duplicate key.*auth/i,
    message: "An account with this email is already registered.",
    recovery: "signin",
    alreadyRegistered: true,
  },
  {
    test: /invalid login credentials/i,
    // Supabase returns this one string for an unknown address and a wrong
    // password alike, on purpose, so the message cannot name which one was
    // wrong without leaking whether an account exists. The hint is here
    // because the two things people actually mistype -- a capital letter and
    // a stray trailing space -- are invisible in a password field.
    message: "Incorrect email or password. Check for caps lock or a trailing space.",
    recovery: "reset",
  },
  {
    test: /email not confirmed|not confirmed/i,
    message: "Your email address hasn't been confirmed yet.",
    recovery: "resend-confirmation",
  },
  {
    test: /user not found/i,
    message: "No account exists with that email address.",
    recovery: "signin",
  },
  {
    test: /password should be at least|invalid password|weak password/i,
    message: "Password must be at least 6 characters.",
    recovery: "none",
  },
  {
    test: /new password should be different|same as the old password|reuse/i,
    message: "Choose a password you haven't used before.",
    recovery: "none",
  },
  {
    test: /unable to validate email|invalid email|email address .* invalid|valid email/i,
    message: "Enter a valid email address.",
    recovery: "none",
  },
  {
    test: /rate limit|too many requests|over_request_rate|security purposes/i,
    message: "Too many attempts. Please wait a minute and try again.",
    recovery: "retry",
  },
  {
    test: /token has expired|invalid token|invalid.*session|auth session missing/i,
    message: "This link is invalid or has expired. Please request a new one.",
    recovery: "reset",
  },
  {
    test: /email address .* not authorized|not allowed|signups not allowed/i,
    message: "New sign-ups are currently closed. Please contact the institute.",
    recovery: "contact-support",
  },
  {
    test: /failed to fetch|networkerror|network request failed|load failed|terminated/i,
    message: "Can't reach the server. Check your connection and try again.",
    recovery: "retry",
  },
]

const DB_RULES: Rule[] = [
  {
    test: /duplicate key|already exists|23505/i,
    message: "That record already exists.",
    recovery: "none",
  },
  {
    test: /row-level security|permission denied|42501/i,
    message: "You don't have permission to do that.",
    recovery: "contact-support",
  },
  {
    test: /jwt expired|invalid token|401/i,
    message: "Your session expired. Please sign in again.",
    recovery: "signin",
  },
  {
    test: /PGRST116|json object requested|0 rows/i,
    message: "We couldn't find that record.",
    recovery: "none",
  },
  {
    test: /violates not-null|23502/i,
    message: "Please fill in all the required fields.",
    recovery: "none",
  },
  {
    test: /invalid input syntax|22P02|23503|foreign key/i,
    message: "Some of the details provided aren't valid.",
    recovery: "none",
  },
  {
    test: /failed to fetch|networkerror|load failed/i,
    message: "Can't reach the server. Check your connection and try again.",
    recovery: "retry",
  },
]

function messageOf(error: unknown): string {
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return ""
}

function apply(rules: Rule[], error: unknown, fallback: string): AuthErrorInfo {
  const raw = messageOf(error)

  for (const rule of rules) {
    if (rule.test.test(raw)) {
      return {
        message: rule.message,
        recovery: rule.recovery,
        alreadyRegistered: rule.alreadyRegistered ?? false,
      }
    }
  }

  const trimmed = raw.trim()
  return {
    message: trimmed || fallback,
    recovery: "retry",
    alreadyRegistered: false,
  }
}

export function describeAuthError(error: unknown): AuthErrorInfo {
  return apply(AUTH_RULES, error, "We couldn't sign you in. Please try again.")
}

export function describeDbError(error: unknown, fallback = "Something went wrong. Please try again."): AuthErrorInfo {
  return apply(DB_RULES, error, fallback)
}

export function toErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = messageOf(error).trim()
  return raw || fallback
}
