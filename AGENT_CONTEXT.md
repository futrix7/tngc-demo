# Institution7 Agent Context

This document is the single canonical context file for future agents working on this project.

## Project summary

This repository is a Next.js application for a computer training institute. It manages students, staff, course catalog, payments, installments, finance, and admin operations with Supabase as the backend.

Primary app folders:
- app/ — Next.js routes and pages
- components/ — UI and admin/portal components
- lib/ — utilities, phone helpers, auth helpers, API helpers, Supabase config
- types/ — Supabase database types
- public/ — static assets
- supabase.sql — canonical database bootstrap and migration script
- supabase-verify.sql — validation checks for the database state
- supabase-seed.sql — initial seed data for branches, courses, faculty

## Current stack and operating principles

- Next.js app router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Auth
- Server-side admin routes for sensitive actions
- Client-side pagination/filtering should be server-scoped when large datasets are involved
- Never build or push to git unless explicitly instructed by the user
- Treat the SQL migration as the source of truth for schema changes

## Critical product decisions

### Student auth
- Student sign-in is phone number + password, entered on `app/auth/user/login`
- The Supabase **phone (SMS) provider is disabled** on this project, so `signInWithPassword({ phone })` fails with `Phone logins are disabled`. Sign-in therefore goes through `POST /api/auth/login`: the server finds the student by phone, then completes the Supabase sign-in with an email handle so no SMS is ever involved
- Accounts created phone-only are given a derived address of `<10-digit phone>@students.tngc.in` on first sign-in; students never see it
- **The administrator owns the password**: it is entered on the Add Student sheet (blank falls back to the student's own 10-digit number) and can be changed later with **Set Password** on the student detail header. Both go through `app/api/admin/students/password/route.ts` for existing students and the register route for new ones
- Student records store a local phone number, but Supabase Auth identity is normalized to E.164 format with +91 prefix
- Student email is optional; it should not be treated as required in the app or SQL
- Student phone is effectively the login identity and should not be editable from the student profile in a way that changes the auth identity
- Failed sign-ins are throttled per phone number (8 attempts / 15 min) via `lib/rate-limit.ts`
- Admin login is unchanged: email + password on `/auth/admin/login`, provisioned from `ADMIN_EMAIL`/`ADMIN_PASSWORD`

### Admin auth
- Admin login is separate from student login
- Finance route is protected by a PIN check after admin session verification
- Admin bootstrap logic lives in API routes and expects a configured admin session environment

### Payment and fee flow
There are two separate things here and they were deliberately unmerged. Do not collapse them back together.

- **The fee schedule** is the administrator's own amounts, never the system's. Nothing is halved or divided equally.
  - A fee is at most three installments, each greater than zero, and the parts must add up to the fee exactly
  - No amounts supplied means one installment for the whole fee; a zero fee produces no schedule
  - Built by `create_fee_schedule(p_fee_id uuid, p_amounts numeric[], p_first_due date)`
- **A payment** is one figure the student chooses, payable repeatedly over time up to the outstanding balance.
  - "Pay 2,000 of a 5,000 fee, then come back for 1,500 or 3,000" is the whole model
  - There is no per-installment selection, no per-installment amount box, no pay-all toggle and no 3-installment cap in the pay flow
  - The student's number is what lands on the ledger, exactly as typed
- Internal allocation: `record_fee_payment` attributes a figure to the outstanding schedule lines oldest-first, one `payments` row per line it touches. This is bookkeeping so each schedule row keeps showing honest progress — it is not a division of what was handed over, and no share is ever worked out for the student.
- A line already holding a Pending claim is skipped, so a second claim can never be stacked on money already with the institute.
- Installment rows are tracked in fee_installments; payment claims are recorded in payments
- Payment status includes Paid, Pending, Partial, Overdue, and Rejected as relevant in UI logic
- `register_student` and `enroll_student_in_course` take `p_installment_amounts numeric[]` (the schedule) and `p_payment_amount numeric` (one figure). Old `p_payment_amounts numeric[]` signatures are dropped explicitly so re-running supabase.sql is idempotent.
- `submit_fee_payment(p_user_id, p_fee_id, p_amount, p_method, p_reference)` is the student's side — one course, one figure. It files Pending rows and moves no balance; `verify_installment_payments` is what moves it, and only an admin can reach that.
- A student's own enrollment takes no payment at all: `enroll_student_in_course` records payments as Paid because an admin or verified counter is the one enrolling, and a browser must not be able to mark a fee settled.
- The split editor (components/shared/amount-split.tsx) is schedule-only now. `lib/amount-split.ts` keeps `parseAmountSplit`/`checkAmountSplitAgainst` for the schedule and adds `parseSingleAmount`/`checkAmountAgainstTotal` for payments.

### Filters
- Reusable filter system is in components/admin/filter-dialog.tsx
- Pass `triggerLabel` when the page already shows shortcut tabs, so the dialog is not mistaken for a duplicate of them
- Students, Payments, Finance, and Installments use a staged Apply/Clear pattern
- On Apply, fetches should be triggered once with aggregated filter values instead of updating one filter at a time
- Large datasets should use server-side filtering and pagination when possible
- For large data, show a loading/spinner while filters apply
- X-clear button should remove all filters and reload the unfiltered default view

## Important current features

### Student management
- Student directory with search, status filter, course filter, pagination, export
- Student profile includes status and course context
- Student registration supports optional email, required phone, guardian fields, branch, and course
- Add-course flow supports custom total fee and optional first payment on enrollment

### Installments and fees
- Fee schedule generation is handled in SQL via fee schedule functions
- Installment pages display payment state, due dates, balances, and variance between paid, pending, and overdue amounts
- Confirming a payment claim against an installment is supported
- Unmark/reverse payment actions exist for verified installments
- The student fee page shows one card per course with paid/pending plus a per-course "payable" figure, and the installment schedule underneath; it never merges installments across courses
- Each course card carries its own Pay button that opens the pay dialog with that course pre-selected and its balance pre-filled. The top-level "Pay Now" opens the same dialog on the first course with anything owing.
- The pay dialog is one course and one amount. There is no installment checkbox list and no per-line amount boxes.

### Analytics
- The three range tabs are shortcuts into the same window the filter dialog edits
- `from` equal to `to` is a single day, and an open end means "up to today"
- Filtered rows are scoped once per table and every chart reads that same slice
- Short windows bucket by day or week, long ones by month
- Postgres `date` columns are parsed as local dates, not `new Date("yyyy-mm-dd")`, which resolves to UTC midnight

### Payments
- Payment history page supports search + filter by status/date
- Payment records are derived from the payments table
- Export uses filtered rows when the user explicitly requests export

### Finance
- Finance page computes revenue, expenses, branch-wise revenue, course income, and recent transactions
- Finance fetches are now bounded by date filters and use a default recent-window range for practical data loading
- Recent Transactions has its own row limit (10/25/50/100/All). The limit is a display concern only — export always covers the whole filtered range
- Finance access is protected by an admin PIN validation flow

### Admin tools
- Add student sheet (includes the login password the student will sign in with)
- Add teacher sheet
- Add expense sheet
- Add course dialog
- Export dialogs
- Record payment sheet
- Set Password action on the student detail page (creates the login account if it is missing)

### Admin dashboard
- Six stat cards with a daily bias: total students, admissions today, collected today, spent today, outstanding fees, active courses
- Charts: enrollment trends (6 months), course enrollment, and daily collections over the last 14 days
- "Today at a Glance" panel plus a "Payments Today" list; the older branch revenue pie and fee snapshot cards were removed deliberately — do not reintroduce them

### Student app
- Floating bottom pill, not a sidebar; `navLinks` in app/student/layout.tsx is ordered Certificates, Profile, Fee
- Only one link can be active: the longest matching prefix wins, so a nested page never lights up two tabs
- Certificates is a top-level route at /student/certificates, not nested under profile

## Database notes

The canonical schema is in supabase.sql.

Important schema facts:
- Student email is nullable
- Student phone is required and used in student authentication flow
- Branches, courses, students, teachers, admins, fees, fee_installments, payments, and certificates are core business tables
- transactions table exists for expense/income tracking
- announcements and attendance tables are intentionally not treated as active app features; do not bring them back unless explicitly requested

## Current migration state

- supabase.sql is the source of truth for schema and migrations
- supabase-verify.sql confirms expected SQL functions and grant state
- supabase-seed.sql seeds branches/courses/faculty
- The database bootstrap should be applied to Supabase before using sign-in or course/fee features
- supabase.sql must be pasted into the Supabase SQL editor by hand: no management token or direct Postgres connection is available in this environment, so the service-role key cannot run the DDL

## Notable implementation realities

- There were older app docs (README, OVERVIEW, DESIGN, CLAUDE, ADMIN_CONTEXT) that were stale and conflicting. They were removed in favor of this single agent context file.
- Keep future changes in sync with supabase.sql rather than relying on UI assumptions alone.
- Avoid reintroducing removed features like announcements and attendance without a clear user request and schema addition.
- Avoid broad build or git operations unless the user explicitly asks for them.

## Files to read first for a new agent

1. supabase.sql
2. app/auth/user/login/page.tsx
3. app/api/auth/login/route.ts
4. app/admin/student/page.tsx
4. app/admin/installments/page.tsx
5. app/admin/payments/page.tsx
6. app/admin/finanace/page.tsx
7. components/admin/filter-dialog.tsx
8. components/admin/add-student-course-dialog.tsx
9. app/api/admin/students/register/route.ts
10. app/api/admin/students/add-course/route.ts

## Short operational checklist

- If changing student auth, check `app/api/auth/login/route.ts`, the Supabase Phone Auth setting, and student migration logic
- If changing course enrollment or installments, check SQL functions and fee schedule logic
- If changing filters, check the reusable FilterDialog and apply server-side pagination when the dataset grows
- If changing schema, update supabase.sql and verify with supabase-verify.sql
- If changing admin or finance access, keep server-side validations in place

## Final instruction for future agents

Use this file as the starting context before making feature changes. Prefer verifying the actual schema and runtime behavior in the app over relying on old docs or stale assumptions.
