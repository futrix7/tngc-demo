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
- Student sign-in uses phone number + password
- Student records store a local phone number, but Supabase Auth identity is normalized to E.164 format with +91 prefix
- Initial student password is the 10-digit phone number
- Student email is optional; it should not be treated as required in the app or SQL
- Student phone is effectively the login identity and should not be editable from the student profile in a way that changes the auth identity

### Admin auth
- Admin login is separate from student login
- Finance route is protected by a PIN check after admin session verification
- Admin bootstrap logic lives in API routes and expects a configured admin session environment

### Payment and fee flow
- Course fee schedules are split into three installments by default
- Installment rows are tracked in fee_installments
- Payment claims are recorded in payments
- Payment status includes Paid, Pending, Partial, Overdue, and Rejected as relevant in UI logic
- When a student is added to a course via the admin add-course flow, the first installment may optionally be recorded immediately as a verified payment
- The first installment payment cannot exceed the amount due for installment 1

### Filters
- Reusable filter system is in components/admin/filter-dialog.tsx
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

### Payments
- Payment history page supports search + filter by status/date
- Payment records are derived from the payments table
- Export uses filtered rows when the user explicitly requests export

### Finance
- Finance page computes revenue, expenses, branch-wise revenue, course income, and recent transactions
- Finance fetches are now bounded by date filters and use a default recent-window range for practical data loading
- Finance access is protected by an admin PIN validation flow

### Admin tools
- Add student sheet
- Add teacher sheet
- Add expense sheet
- Add course dialog
- Export dialogs
- Record payment sheet

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
- The database bootstrap should be applied to Supabase before using phone-based sign-in or course/fee features

## Notable implementation realities

- There were older app docs (README, OVERVIEW, DESIGN, CLAUDE, ADMIN_CONTEXT) that were stale and conflicting. They were removed in favor of this single agent context file.
- Keep future changes in sync with supabase.sql rather than relying on UI assumptions alone.
- Avoid reintroducing removed features like announcements and attendance without a clear user request and schema addition.
- Avoid broad build or git operations unless the user explicitly asks for them.

## Files to read first for a new agent

1. supabase.sql
2. app/auth/user/login/page.tsx
3. app/admin/student/page.tsx
4. app/admin/installments/page.tsx
5. app/admin/payments/page.tsx
6. app/admin/finanace/page.tsx
7. components/admin/filter-dialog.tsx
8. components/admin/add-student-course-dialog.tsx
9. app/api/admin/students/register/route.ts
10. app/api/admin/students/add-course/route.ts

## Short operational checklist

- If changing student auth, check Supabase Phone Auth and student migration logic
- If changing course enrollment or installments, check SQL functions and fee schedule logic
- If changing filters, check the reusable FilterDialog and apply server-side pagination when the dataset grows
- If changing schema, update supabase.sql and verify with supabase-verify.sql
- If changing admin or finance access, keep server-side validations in place

## Final instruction for future agents

Use this file as the starting context before making feature changes. Prefer verifying the actual schema and runtime behavior in the app over relying on old docs or stale assumptions.
