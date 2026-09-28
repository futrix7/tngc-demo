# TNGC — The New Generation Computers

Institute management portal for a computer training centre: a public marketing site,
a student portal, and an admin portal, on Next.js 16 (App Router) with Supabase
for auth and Postgres.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.3.2, App Router, React 19 |
| Route protection | `proxy.ts` (the Next 16 replacement for `middleware.ts`) |
| Auth | Supabase Auth, cookie-backed via `@supabase/ssr` |
| Email verification / password reset | **None** — accounts are created and passwords reset with no proof of email ownership |
| Data access | Browser client for portal reads and writes; route handlers for anything privileged |
| Authorization | Postgres row level security (`supabase.sql`) |
| UI | Tailwind v4, shadcn (`base-nova`), lucide, next-themes, sonner |

## Setup

```bash
npm install
cp .env.example .env.local    # then fill it in
```

The database is three files. Apply the first two, in this order, in the Supabase
SQL editor (Dashboard → SQL Editor → New query):

| File | Apply | Contains |
| --- | --- | --- |
| `supabase.sql` | first | Extensions, enums, tables, indexes, row level security, the authorisation helpers and triggers, the id sequences, the `register_student` transaction, the installment/payment lifecycle functions, the per-role grants, every policy, and a closing RLS guard |
| `supabase-seed.sql` | second | Reference data only: the three branches, the course catalogue, and the faculty list |
| `supabase-verify.sql` | by hand | Nine read-only queries that confirm a deploy landed correctly |

Both applied files are **safe to re-run**: every statement is guarded, so applying
them again is a no-op and they also upgrade a database built from the older files.
`supabase.sql`'s last statement is a check that raises if any policy would still
grant a write to `anon`, so a run that completes is a run that closed the door.

The three `.sql` files contain no comments at all. Everything that would once have
been a comment in them — why a statement is shaped the way it is, what to expect
from a verification query, the pitfalls — is written out in this README instead, and
the file names in this section are the only place the split is documented. Keep it
that way: the reasoning belongs in prose, and the SQL stays executable as-is.

> **Re-running it is how you fix "Registration is unavailable right now" (503).**
> That message means `supabase.sql` was never fully applied, not that the student
> did anything wrong — most often a column is missing. `CREATE TABLE IF NOT EXISTS`
> is a *no-op* on a table that already exists, so a column added to one of those
> statements never reaches an existing database; only the `ALTER TABLE` statements
> do. When you add a column to a table in `supabase.sql`, add the matching
> `ALTER TABLE` in the same change, or existing databases will keep failing
> against code that reads it. A run that "succeeded" is not proof the shape is
> right — run the first query in `supabase-verify.sql` to confirm the columns
> exist.

> **`ALTER TYPE ... ADD VALUE 'Rejected'`.** A guarded `DO` block near the top of
> `supabase.sql` adds a `Rejected` member to the `payment_status` enum, which the
> verification flow genuinely needs — see *Payment lifecycle* below. On
> PostgreSQL 12+ this is safe inside a transaction, which is what the SQL editor
> uses. On PostgreSQL 11 or older it must be run on its own, outside the rest of
> the file. Supabase is well past 12.


Then:

```bash
npm run dev
```

## Verifying a deploy

`supabase-verify.sql` is nine read-only queries. Each is expected to return either
nothing or a known result, which is what makes a deploy checkable rather than
merely finished:

| # | Checks | Expected |
| --- | --- | --- |
| 1 | `present_status` and `full_name_as_signature` exist on `students` | both rows — a column that never got created is what causes the 503 above |
| 2 | public tables with row level security off | zero rows |
| 3 | write grants held by `anon` | zero rows |
| 4 | every policy mentioning `anon` | `SELECT` only, on `branches`, `courses`, `faculty`, `announcements`, `videos` |
| 5 | policies on `rate_limit_log` | `0` |
| 6 | the seven lifecycle functions and their identity arguments | one row per name, with the arguments exactly `submit_installment_payments(uuid, uuid[], text, text, boolean)`, `verify_installment_payments(text[], boolean, text, text)`, `unmark_installment(uuid, text, text)` |
| 7 | those functions executable by `anon` or `authenticated` | zero rows |
| 8 | `payment_status` enum members | `Paid, Pending, Partial, Overdue, Rejected` |
| 9 | fees whose installments do not sum to `total_fee` | zero rows — the last installment absorbs the rounding, so a schedule that comes up short silently loses the student money and one that overshoots invents a debt |

Query 6 is the one that catches a half-finished migration: a leftover older
overload is still granted to `service_role` and still enforces the previous rules,
so the app would behave by whichever name PostgREST happened to resolve.

Then the end-to-end pass, in a browser:

1. Sign in as a student and confirm the admin portal returns no rows.
2. Sign in as an admin and confirm every admin page still loads.
3. Register a student through the sign-up form, choosing Installment 1. Confirm a
   `fees` row, three `fee_installments` rows and one `Pending` payment were
   written, with the payment's `installment_id` pointing at the Installment 1 row
   and `receipt_no` set.
4. As that student, pay Installments 2 and 3 from the fee page. As an admin,
   verify the pair from the payments page. The student's `fees` row should now
   read `paid_amount = total_fee` and `pending_amount = 0`.

## Environment

Full documentation, including why each variable exists, is in [`.env.example`](.env.example).
The ones that will bite you if unset:

| Variable | If unset |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Rate limiting, password reset and admin account provisioning return 503 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin sign-in is unavailable; set both in `.env.local` to provision the single admin account |
| `FINANCE_PIN` | The finance dashboard gate returns 503 |

## How authorization works

This is the part worth understanding before changing anything.

There are three layers, and only the third is a real boundary:

1. **`components/auth/auth-guard.tsx`** — a client component. Purely UX. It ships
   to the browser, so anything it hides is still fetchable by an anonymous
   visitor. Never treat it as a security control.
2. **`proxy.ts`** — refreshes the session and redirects by role before a page
   renders. Closes "paste the dashboard URL" and the flash of private content.
   Per the Next.js data security guide it is *not* an authorization boundary:
   it makes DB calls for UX, and a determined client can simply not send it.
3. **Row level security** — the actual enforcement. Policies in
   `supabase.sql` decide what each JWT may read and write. Because
   this is enforced in Postgres, it holds no matter which key made the request.

The rule that follows from that: **the admin portal reads and writes every table
straight from the browser with the anon key, and that is safe.** The anon key is
public by design; what is not public is the JWT the signed-in admin's browser
attaches, and RLS checks it. Routing admin traffic through server actions would
buy nothing here.

`admins` is the whole definition of admin access. `is_admin()` is a
`SECURITY DEFINER` function that checks for a row in `admins` matching
`auth.uid()`; it is `SECURITY DEFINER` precisely so its own lookup bypasses RLS
instead of recursing. It is used by every admin policy, by `resolveRole()`, and by
`authenticateAdminRequest()`.

> The `admins` table previously had policies named `"Admins full access"` whose
> body was the literal `USING (true)`. Since Postgres ORs all applicable
> permissive policies, that made the whole database world-readable and let anyone
> `INSERT` themselves into `admins` to become an administrator. `supabase.sql`
> fixes it, and its final statement raises an error if any policy would still
> grant a write to `anon` — so a completed run is a verified one. The queries that
> confirm it by hand are in `supabase-verify.sql`.

## Authentication flows

| Flow | Path | Notes |
| --- | --- | --- |
| Student sign-up | `/auth/user/register` → `/api/register` | Four steps: details, courses, payment, review. One server-side transaction: auth user + student + per-course fees/installments + pending payment. The student picks which of the three installments to settle, or all of them. Priced from `courses.fee_numeric`, not the client |
| Student sign-in | `/auth/user/login` | |
| Admin sign-in | `/auth/admin/login` → `/api/admin/bootstrap` | `ADMIN_EMAIL` and `ADMIN_PASSWORD` are server-only. The first sign-in creates the Supabase Auth user and `admins` row; subsequent sign-ins sync the configured password before creating a normal Supabase session. Set `ADMIN_NAME` optionally. |
| Student password reset | `/auth/user/reset-password` → `/api/reset-password` | Email + new password, then all sessions are revoked. **No ownership proof — see Known limitations** |
| Finance gate | `/admin/finanace` → `/api/verify-pin` | Admin session verified server-side, then the PIN. 5 attempts / 15 min |

`FINANCE_PIN` is a single shared plaintext value, not a per-admin second factor.
It is documented as such in `.env.example`. It is acceptable only because the
endpoint requires a real admin session first and rate-limits per admin.

## Error handling conventions

- **Server:** `describeApiFailure()` / `respondWithFailure()` in `lib/api-response.ts`
  map a thrown error to a status and a user-facing message. An unrun migration
  becomes a non-retryable 503 with an actionable server log, not a 500 that
  invites a doomed retry. Unknown errors log the full cause server-side and never
  leak internals. Missing configuration fails **closed** where the endpoint is a
  gate.
- **Client:** `describeAuthError()` / `describeDbError()` in `lib/errors.ts` return
  `{ message, recovery, alreadyRegistered }`. `recovery` drives which affordance
  appears — a "Resend confirmation email" link only shows for
  `recovery === "resend-confirmation"`.
- **Never** surface a raw exception, and never let a query failure default to
  `|| []`. That idiom is what made the finance page render an empty payment list
  and chart for as long as it selected a column that did not exist.

## Known limitations

- **`/api/reset-password` proves nothing.** It accepts an email address and a new
  password and sets it with the service-role key. Anyone who knows an account's
  email can take that account over, including admin accounts, and the endpoint is
  unthrottled. Email OTP verification was removed from this flow. If this app is
  reachable from the public internet, put it back before real users sign up.
- Registration does not verify email either. `/api/register` creates a
  `email_confirm: true` account for any well-formed address, so anyone can
  register using somebody else's email address. It is throttled per email and per
  IP, which stops volume abuse but not this.
- `FINANCE_PIN` is shared and unhashed (above).
- `types/database.ts` is hand-maintained and is **not** wired into the Supabase
  clients. Its table entries declare no `Relationships`, so the portal's nested
  selects resolve to `never` and typing the clients produces 505 errors across 30
  files. Regenerate it against the live project and then parameterise
  `createBrowserClient<Database>` — that is the only thing that would catch a query
  for a column that does not exist. Until then, a bad column fails at runtime as a
  silent empty result, so every query must handle `.error` and none may fall back
  to `|| []`.
- ~~A payment filed from the student portal is written with `status: "Paid"` by the
  student themselves~~ — **fixed.** A student could mark themselves fully paid and
  corrupt revenue reporting, because RLS permits both writes scoped to their own
  row. There is now no browser path that writes a `Paid` payment or moves
  `fees.paid_amount` at all. See *Payment lifecycle* below.
- `findUserIdByEmail()` pages through the auth user list because the admin API
  has no lookup-by-email. It caps at 100,000 users and reports exhaustion as an
  error rather than "no such user".
- `ADMIN_CONTEXT.md` and `OVERVIEW.md` are out of date; this README is current.

## Payment lifecycle

A course fee is not one charge. `create_fee_schedule()` splits it into three
installments — `Installment 1`, `Installment 2`, `Installment 3` — with the first
two taking the floor of a third and the last absorbing the remainder, so the parts
always sum to the fee exactly.

Nothing in the browser can mark an installment paid, and that is the point. The
chain is:

| Step | Who | What moves |
| --- | --- | --- |
| Student claims payment | student, own rows only | A `Pending` payment per installment. **No** balance movement |
| Admin verifies or rejects | admin | The status flip, the installment, and `fees.paid_amount` — one transaction |
| Admin marks paid directly | admin | Same, for money received at the counter with no prior claim |
| Admin unmarks paid | admin | Reverses the ledger rows and credits the balance back |

Every one of those is a `SECURITY DEFINER` function granted to `service_role` only
and reached through an authenticated API route. The functions take the acting
user's id as a parameter rather than reading it themselves, so a student id
supplied by a browser is never trusted — ownership is re-checked inside the
transaction against the authenticated caller.

Three details that are easy to break:

- **`Pending` means in flight, `Rejected` means decided.** A refused claim has to
  leave `Pending`, because `Pending` is the state that blocks the student from
  paying that installment again. Parking a rejection on `Pending` left the
  installment permanently unpayable. That is why `Rejected` is a real enum member
  and not a note in the description.
- **Reversals are recorded, not deleted.** Unmarking sets the payment to
  `Rejected` and writes the reason onto the row, rather than erasing it. Revenue
  figures sum `status = 'Paid'`, so a reversal drops out of them while the ledger
  still shows what was claimed and why it was withdrawn.
- **Only `Paid` counts as revenue.** Every chart and total that reads `payments`
  must filter on it. Counting all statuses reports money the institute has not
  received, and makes an unmark look like it did nothing.

Rows from one transaction share a `receipt_no`, so an admin verifies a
multi-installment payment as a single set rather than hunting for a match.

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # eslint
```
