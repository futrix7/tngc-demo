# TNGC — The New Generation Computers
### Complete Application Overview

> A full-stack institute management platform built with **Next.js 16**, **Tailwind CSS v4**, **Supabase**, **shadcn/ui**, **Framer Motion**, and **Recharts**.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Tech Stack](#tech-stack)
3. [Landing / Public Pages](#landing--public-pages)
4. [Authentication](#authentication)
5. [Student Portal](#student-portal)
6. [Admin Panel](#admin-panel)
7. [Database Schema](#database-schema)
8. [API Routes](#api-routes)
9. [Components Library](#components-library)
10. [Key Notes](#key-notes)

---

## Project Structure

```
institution/
├── app/
│   ├── (landing)/          # Public landing pages
│   │   ├── page.tsx        # Home page
│   │   └── layout.tsx      # Header + Footer wrapper
│   ├── auth/
│   │   ├── user/           # Student auth (login, register, reset-password)
│   │   └── admin/          # Admin auth (login, register, reset-password)
│   ├── student/            # Student portal (protected)
│   │   ├── layout.tsx      # Bottom nav / top nav layout
│   │   ├── dashboard/
│   │   ├── fee/
│   │   ├── attendance/
│   │   ├── announcements/
│   │   ├── videos/
│   │   └── profile/
│   │       ├── page.tsx
│   │       ├── settings/
│   │       ├── payments/
│   │       └── certificates/
│   ├── admin/              # Admin panel (protected)
│   │   ├── layout.tsx      # Sidebar + bottom nav layout
│   │   ├── dashboard/
│   │   ├── student/
│   │   ├── teacher/
│   │   ├── course/
│   │   ├── attendence/
│   │   ├── installments/
│   │   ├── payments/
│   │   ├── finanace/
│   │   ├── certificates/
│   │   ├── videos/
│   │   ├── announcements/
│   │   ├── analytics/
│   │   └── profile/
│   │       ├── page.tsx
│   │       └── settings/
│   ├── courses/            # Public course listing & detail pages
│   ├── api/                # API routes
│   ├── terms/
│   ├── privacy/
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Tailwind v4 + theme config
├── components/
│   ├── landing/            # Landing page sections
│   ├── admin/              # Admin-specific components
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   └── utils.ts            # cn() helper
├── data/
│   └── hero-images.ts      # Hero carousel images
└── supabase.sql       # Schema, functions, RLS, grants, policies (apply first)
    supabase-seed.sql # Reference data: branches, courses, faculty (apply second)
    supabase-verify.sql # Read-only deploy checks, run by hand
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.2 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animation | Framer Motion 13 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Dark Mode | next-themes with Tailwind dark variant |

---

## Landing / Public Pages

### 🏠 Home Page — `/`
> Hero carousel → Trust bar → Features → Long-term courses → Short-term courses → Full Stack spotlight → Faculty → Branches → Contact CTA

| Section | Component | Description |
|---|---|---|
| Hero | `hero.tsx` | Full-screen image carousel with auto-play, nav arrows, dots. Falls back to gradient backgrounds. Badges: AIACTE, ISO 9001, Consulate, Employment Exchange. |
| Trust Bar | `trust-bar.tsx` | 5-column grid: AIACTE Affiliated, Govt Order, Consulate Recognised, Employment Exchange, 24+ Years. |
| Features | `features.tsx` | 4 cards: Classes by Management, Individual Attention, Special Batches, Experienced Faculties. |
| Long-Term Courses | `long-term-courses.tsx` | 8 course cards (DCA, ADCA, PGDCA, PGJPL, PGPPL, Python Full Stack, Java Full Stack, ADWD) with duration, topics, "Popular" badge. |
| Short-Term Courses | `short-term-courses.tsx` | 16 short courses in a compact grid (Basic, Internet, MS-Office, Tally, C, Oracle, Excel, Java, JS, Angular, HTML, CSS, Bootstrap, Python, OOPS Python). |
| Full Stack Spotlight | `fullstack-spotlight.tsx` | Featured section for Python & Java Full Stack with gradient background. |
| Faculty | `faculty.tsx` | Founder card (Mr. Mada Eswar Rao — MCA Gold Medalist, M.Tech) + 4 faculty cards. |
| Branches | `branches.tsx` | 3 branch cards: Ramanthapur (Main), Amberpet, Kodad. |
| Contact CTA | `contact-cta.tsx` | Phone numbers (8143248778, 9550192527), Call/WhatsApp/Visit buttons. |

### 📄 Other Public Pages

| Route | Description |
|---|---|
| `/courses` | Public course listing page |
| `/courses/[slug]` | Individual course detail page |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |

---

## Authentication

### 👨‍🎓 Student Auth

| Route | Page | Description |
|---|---|---|
| `/auth/user/login` | Login | Email + password, Google OAuth, "Remember me", forgot password link |
| `/auth/user/register` | Register | **3-step onboarding wizard**: (1) Personal Info — name, father name, email, phone (2) Choose Course — branch select + course cards grid with categories (3) Final Details — present status, parent mobile, password, declaration, signature |
| `/auth/user/reset-password` | Reset | Email-based password reset |

### 🔐 Admin Auth

| Route | Page | Description |
|---|---|---|
| `/auth/admin/login` | Login | Uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env.local`; provisions the Supabase admin account on first sign-in |

---

## Student Portal

> **Layout**: Desktop → horizontal top nav bar. Mobile → floating bottom dock with 5 tabs + theme toggle.
> **Pages**: 6 main sections.

### 📊 Dashboard — `/student/dashboard`

| Feature | Description |
|---|---|
| Welcome Card | Gradient card with student avatar (initials), name, course, branch |
| Stats Grid | 4 stat cards: Attendance (87%), Fee Paid (₹18,000), Certificates (2), Hours (124) |
| Course Progress | 4 progress bars: Python Basics (100%), Django (72%), React (45%), SQL (28%) |
| Today's Classes | 3 upcoming classes with subject, time, instructor |
| Recent Notices | 3 notices with type badges (Holiday, Info, Alert) |

### 💰 Fee — `/student/fee`

| Feature | Description |
|---|---|
| Fee Overview | Total Fee (₹60,000), Paid (₹54,000), Progress bar (90%), Remaining (₹6,000) |
| Installment Schedule | 6 installments with status (Paid/Pending), due dates, paid dates, overdue detection |
| Additional Charges | Lab Fee (₹6,000), Study Material (₹2,000), Exam Fee (₹1,000) |
| Pay Now Dialog | Payment form with amount input, method selection (UPI/Cash/Bank Transfer), success animation |
| View Payment History | Link to `/student/profile/payments` |

### ✅ Attendance — `/student/attendance`

| Feature | Description |
|---|---|
| Today's Status | Green card showing Present/Absent with clock in/out times |
| Quick Stats | 4 cards: Overall %, Present count, Absent count, Leave count |
| Streak | Fire icon with current streak (4 days), weekly dot visualization |
| Weekly Overview | 7-column grid with status icons per day |
| Tabs | **Recent Log** (10 records with date, time in/out, hours) / **Monthly** (6 months with progress bars) |

### 📢 Announcements — `/student/announcements`

| Feature | Description |
|---|---|
| Stats | Total count, Pinned count, Important count |
| Pinned Section | Highlighted announcements with amber border |
| All Announcements | Cards with title, message, date, author, priority badge (Important/Info/Notice), target badge |

### 📹 Videos — `/student/videos`
> Video listing page for published course videos.

### 👤 Profile — `/student/profile`

| Feature | Description |
|---|---|
| Profile Header | Gradient banner, avatar with initials, name, student ID, course/branch/status badges |
| Edit Profile | Dialog with name, email, phone, address fields |
| Personal Information | Email, phone, DOB, address |
| Course Details | Course, branch, join date, batch time |
| Parent/Guardian | Father's name, father's phone, mother's name |
| Quick Links | Certificates → `/student/profile/certificates`, Payment History → `/student/profile/payments` |
| Settings Link | → `/student/profile/settings` |

### ⚙️ Settings — `/student/profile/settings`

| Feature | Description |
|---|---|
| Theme | Light / Dark / System toggle with preview |
| Notifications | Push, Email, SMS, WhatsApp toggles (persisted to localStorage) |
| Change Password | Current + new + confirm password dialog with validation |
| Sign Out | Confirmation dialog |

### 📜 Certificates — `/student/profile/certificates`
> View and download earned certificates.

### 💳 Payment History — `/student/profile/payments`
> Transaction history with receipts.

---

## Admin Panel

> **Layout**: Desktop → collapsible sidebar (14 links). Mobile → bottom nav bar + hamburger menu.
> **Pages**: 14 sections.

### 📊 Dashboard — `/admin/dashboard`

| Feature | Description |
|---|---|
| Stat Cards | Total Students (1,247), Active Courses (24), Attendance Today (89%) |
| Enrollment Trends | Area chart (Jan–Jun monthly enrollments) |
| Course Enrollment | Bar chart (6 courses by enrollment count) |
| Branch Revenue | Pie chart (Ramanthapur ₹14.2L, Amberpet ₹9.8L, Kodad ₹6.5L) |
| Weekly Attendance | Bar chart (Mon–Sat attendance rates) |
| Upcoming Events | 4 events: Orientation, Workshop, Industry Visit, Mid-Terms |
| Recent Enrollments | 5 latest student enrollments with status badges |
| Pending Tasks | 4 tasks with priority badges (High/Medium/Low) |

### 👥 Students — `/admin/student`

| Feature | Description |
|---|---|
| Summary Stats | Total: 1,247, Active: 1,089, Pending: 98, Inactive: 60 |
| Search & Filter | Search by name/ID, filter by status |
| Student Table | 10 columns: ID, Name, Course, Branch, Phone, Enrollment Date, Status, Actions |
| Add Student | Sheet/dialog integration for adding new students |
| Pagination | Paginated results |

### 👤 Student Detail — `/admin/student/[id]`

| Feature | Description |
|---|---|
| Tabs | Profile, Attendance, Fee, Payments, Certificates |
| 5 Mock Students | STU-2026-001 through STU-2026-005 |
| Profile Tab | Personal info, course details, parent info |
| Attendance Tab | Monthly breakdown with attendance % |
| Fee Tab | Installment schedule with paid/pending status |
| Payments Tab | Payment history table |
| Certificates Tab | Certificate list with download buttons |

### 👨‍🏫 Teachers — `/admin/teacher`

| Feature | Description |
|---|---|
| Stats | Total: 6, Active: 5, On Leave: 1, Subjects: 14 |
| Search & Filter | By name, role, branch |
| Teacher Cards | 6 cards with: name, role, branch, subjects, experience, status, email, phone |
| Add Teacher | Sheet integration for adding new teachers |

### 📚 Courses — `/admin/course`

| Feature | Description |
|---|---|
| Stats | Total Courses, Enrollments, Popular Course, Highest Fee |
| Filter Tabs | All / Long-Term / Short-Term |
| Course Grid | 16 course cards with: name, duration, fee, students enrolled, rating, completion rate, next batch, edit/delete actions |
| Add Course | Sheet integration |

### ✅ Attendance — `/admin/attendence`

| Feature | Description |
|---|---|
| Summary Stats | Total: 186, Present: 165, Absent: 14, Late: 7 |
| Date Picker | Select date to view records |
| Branch Filter | Filter by branch |
| Search | Search by student name/ID |
| Attendance Table | 8 columns: Student ID, Name, Course, Time In, Time Out, Status, Hours, Actions |

### 💳 Installments — `/admin/installments`

| Feature | Description |
|---|---|
| Stats | Collected: ₹1,41,000, Pending: ₹29,000, Overdue: ₹22,000, This Month: ₹24,000 |
| Tab Filters | All / Paid / Pending / Overdue |
| Installment Table | 15 records with search and pagination |
| Export | Export dialog integration |

### 💰 Payments — `/admin/payments`

| Feature | Description |
|---|---|
| Weekly Bar Chart | Payment trends by week |
| Payment History | 15 records with columns: Student, Course, Amount, Date, Method, Status |
| Search & Pagination | Full search and paginated results |
| Export | Export dialog integration |

### 🏦 Finance — `/admin/finanace`

| Feature | Description |
|---|---|
| OTP Gate | 6-digit PIN verification via `/api/verify-pin` before revealing data |
| Summary Cards | Revenue ₹24,85,000, Expenses ₹8,45,000, Net Profit ₹16,40,000, Margin 66% |
| Monthly Chart | Area chart showing revenue vs expenses |
| Expense Breakdown | Pie chart by category |
| Branch Revenue | Bar chart by branch |
| Revenue by Course | Progress bars per course |
| Recent Transactions | Transaction table |
| Export | Export dialog integration |

### 📜 Certificates — `/admin/certificates`

| Feature | Description |
|---|---|
| Stats | Issued, Pending, Rejected, Total counts |
| Search | Search by student name |
| Certificate Table | 7 records: Student Name, Course, Type, Credential ID, Issued Date, Status, Actions |

### 📹 Videos — `/admin/videos`

| Feature | Description |
|---|---|
| Stats | Total: 10, Published: 7, Draft: 1, Total Views: 6,870 |
| Search | Search by title/course |
| Video Table | 10 records: Title, Course, Duration, Views, Uploaded By, Status |
| Upload Video | Sheet integration for uploading new videos |

### 📢 Announcements — `/admin/announcements`

| Feature | Description |
|---|---|
| Stats | Total, Pinned, Important counts |
| Pinned Announcements | Highlighted section |
| Announcements Table | 8 records with priority badges |
| Create Announcement | Dialog integration |

### 📈 Analytics — `/admin/analytics`

| Feature | Description |
|---|---|
| Date Range Tabs | This Month / Quarter / Year |
| Key Metrics | Overview statistics |
| Enrollment Chart | Area chart |
| Course Type Pie | Enrollment by course type |
| Branch Performance | Bar chart |
| Revenue vs Expenses | Area chart |
| Course Completion | Pie chart |
| Weekly Attendance | Bar chart |
| Top Courses | Ranked list |
| Demographics | Bar chart |
| Export | Export dialog integration |

### 👤 Profile — `/admin/profile`

| Feature | Description |
|---|---|
| Profile Header | Avatar, name ("Admin User"), badge, branch |
| Personal Info | Email, phone, branch, join date |
| Recent Activity | 5 activity log items |
| Settings Link | → `/admin/profile/settings` |

### ⚙️ Settings — `/admin/profile/settings`

| Feature | Description |
|---|---|
| Avatar Upload | Profile photo upload |
| Personal Info | Name, email, phone, branch dropdown, bio |
| Change Password | Password change form |
| Notifications | Email/SMS/WhatsApp toggle preferences |
| Save/Cancel | Form actions |

---

## Database Schema

> **17 tables**, **17 enums**, Row-Level Security (RLS) enabled on all tables.

### Enums

| Enum | Values |
|---|---|
| `course_type` | `long-term`, `short-term` |
| `course_status` | `active`, `upcoming`, `full` |
| `student_status` | `Active`, `Inactive`, `Pending` |
| `gender_type` | `male`, `female`, `other` |
| `teacher_status` | `Active`, `On Leave` |
| `payment_status` | `Paid`, `Pending`, `Partial`, `Overdue` |
| `attendance_status` | `Present`, `Absent`, `Late`, `Leave` |
| `certificate_status` | `Issued`, `Pending`, `Rejected`, `Processing`, `Requested` |
| `certificate_type` | `Completion`, `Proficiency`, `Module` |
| `video_status` | `Published`, `Draft`, `Processing` |
| `announcement_priority` | `high`, `medium`, `low` |
| `transaction_type` | `income`, `expense` |
| `qualification_type` | `B.Tech`, `M.Tech`, `MCA`, `M.Sc`, `PhD`, `Others` |
| `specialization_type` | `Java`, `Python`, `Web Development`, `Database`, `Networking`, `MS-Office` |
| `experience_range` | `0-1`, `1-3`, `3-5`, `5-10`, `10+` |
| `eligibility_type` | `10th`, `12th`, `graduate`, `any` |

### Tables

| Table | Key Columns | Description |
|---|---|---|
| `branches` | id, name, address, city, is_primary | 3 branches (Ramanthapur, Amberpet, Kodad) |
| `courses` | id, slug, name, duration, type, fee_numeric, topics[], popular | 16+ courses across categories |
| `students` | id (STU-XXXX-XXXX), user_id → auth.users, full_name, course_slug → courses, branch_id → branches | Core student records |
| `teachers` | id, user_id, full_name, role, branch_id, subjects[], qualification, specialization | Faculty records |
| `admins` | id, user_id, full_name, email, branch_id, role, notification prefs | Admin users |
| `fees` | id, student_id → students, course_slug, total_fee, paid_amount, pending_amount | Per-student fee records |
| `fee_installments` | id, fee_id → fees, label, amount, due_date, paid_date, status | Individual installment tracking |
| `fee_extras` | id, fee_id → fees, label, amount, status | Additional charges (Lab, Material, Exam) |
| `payments` | id, student_id → students, amount, payment_date, method, status, receipt_no | Payment transaction log |
| `attendance` | id, student_id → students, date, time_in, time_out, hours, status, branch_id | Daily attendance records |
| `certificates` | id, student_id → students, course_slug, type, credential_id, issued_date, status | Certificate records |
| `videos` | id, title, url, course_slug, duration, views, uploaded_by → teachers, status | Course video content |
| `announcements` | id, title, message, priority, target, author_name, pinned | Institute announcements |
| `transactions` | id, date, description, category, amount, type (income/expense), branch_id | Finance ledger |
| `activity_log` | id, admin_id → admins, action, type, timestamp | Admin activity audit trail |
| `events` | id, name, date, type | Upcoming events |
| `pending_tasks` | id, task, priority, completed | Admin task management |

### Security (RLS Policies)

| Policy | Access |
|---|---|
| Admins | Full access on all tables |
| Students | Read access on courses, branches, announcements, published videos |
| Students | Full access on own records (students, fees, payments, attendance, certificates) |

### Seed Data

| Branch | ID | Primary |
|---|---|---|
| Ramanthapur | `ramanthapur` | ✅ |
| Amberpet | `amberpet` | ❌ |
| Kodad | `kodad` | ❌ |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/verify-pin` | POST | Verify 6-digit admin PIN for finance page access |

---

## Components Library

### shadcn/ui Primitives (`components/ui/`)

| Component | File |
|---|---|
| Alert | `alert.tsx` |
| Badge | `badge.tsx` |
| Button | `button.tsx` |
| Card | `card.tsx` |
| Dialog | `dialog.tsx` |
| Drawer | `drawer.tsx` |
| Input | `input.tsx` |
| Input OTP | `input-otp.tsx` |
| Label | `label.tsx` |
| Progress | `progress.tsx` |
| Select | `select.tsx` |
| Sheet | `sheet.tsx` |
| Sonner (Toast) | `sonner.tsx` |
| Switch | `switch.tsx` |
| Table | `table.tsx` |
| Tabs | `tabs.tsx` |

### Landing Components (`components/landing/`)

| Component | Description |
|---|---|
| `header.tsx` | Sticky nav with logo, links, theme toggle, Login/Register buttons, mobile drawer |
| `hero.tsx` | Full-screen carousel with images/gradients, badges, CTA buttons |
| `trust-bar.tsx` | 5-item credibility grid |
| `features.tsx` | 4 feature cards |
| `long-term-courses.tsx` | 8 course cards with topics |
| `short-term-courses.tsx` | 16 short course items |
| `fullstack-spotlight.tsx` | Featured Full Stack section |
| `faculty.tsx` | Founder + 4 faculty cards |
| `branches.tsx` | 3 branch location cards |
| `contact-cta.tsx` | Phone numbers, CTA buttons |
| `footer.tsx` | Site footer |

### Admin Components (`components/admin/`)

| Component | Description |
|---|---|
| `bottom-nav.tsx` | Mobile bottom navigation bar (hidden on lg+) |
| `add-student-sheet.tsx` | Sheet form for adding students |
| `add-teacher-sheet.tsx` | Sheet form for adding teachers |
| `add-course-sheet.tsx` | Sheet form for adding courses |
| `announcement-dialog.tsx` | Dialog for creating announcements |
| `announcement-drawer.tsx` | Drawer for viewing announcement details |
| `export-dialog.tsx` | Export data dialog |
| `form-sheet.tsx` | Generic form sheet component |
| `upload-video-sheet.tsx` | Sheet form for uploading videos |

---

## Key Notes

1. **Mobile-First Design**: All pages use responsive Tailwind classes (`sm:`, `md:`, `lg:`) for mobile-first layout.

2. **Desktop Layouts**:
   - Student → Horizontal top nav bar (`lg:block`)
   - Admin → Collapsible sidebar (`lg:static lg:translate-x-0`)

3. **Mobile Layouts**:
   - Student → Floating bottom dock with motion animation
   - Admin → Fixed bottom nav bar + hamburger menu

4. **Dark Mode**: Full dark mode support via `next-themes` with custom CSS variables in `globals.css`.

5. **Mock Data**: All pages currently use hardcoded mock data. Supabase integration is defined in schema but not yet connected in UI.

6. **Route Typos** (legacy, kept for compatibility):
   - `/admin/attendence` (not `attendance`)
   - `/admin/finanace` (not `finance`)

7. **Animations**: Framer Motion used for page transitions, card stagger effects, carousel, and layout animations.

8. **Charts**: Recharts used extensively in admin dashboard, analytics, finance, and payments pages.

---

*Generated for documentation handoff — ready for a documentation agent to polish and publish.*
