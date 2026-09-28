# TNGC Admin Panel — Complete Context

## Tech Stack
- Next.js 16.3.2 + TypeScript + Tailwind CSS v4 + shadcn/ui (base-ui) + Framer Motion + Recharts
- All pages are `"use client"` — hardcoded data, no API calls (except Finance PIN)
- Branches: Ramanthapur (Main), Amberpet, Kodad

## Directory Structure
```
app/admin/
├── layout.tsx                    (147 lines) — Sidebar + topbar + mobile bottom nav
├── dashboard/page.tsx            (419 lines) — Overview metrics, charts, enrollments, events
├── analytics/page.tsx            (511 lines) — Deep analytics with time-range tabs, export
├── announcements/page.tsx        (212 lines) — Manage announcements with priority, pinning, search
├── attendence/page.tsx           (210 lines) — Daily attendance records, filters, export
├── certificates/page.tsx         (168 lines) — Issue/manage certificates, search
├── course/page.tsx               (233 lines) — Course cards with category filter, add/edit/delete
├── finanace/page.tsx             (603 lines) — Finance with PIN gate, charts, transactions
├── installments/page.tsx         (244 lines) — Installment tracking, tabs, pagination
├── payments/page.tsx             (246 lines) — Payment history, weekly chart, pagination
├── profile/page.tsx              (165 lines) — Admin profile display
├── profile/settings/page.tsx     (272 lines) — Edit profile, password, notifications
├── student/page.tsx              (355 lines) — Student list, search, pagination
├── student/[id]/page.tsx         (530 lines) — Student detail with 5 tabs
├── teacher/page.tsx              (241 lines) — Teacher cards, search, add
└── videos/page.tsx               (176 lines) — Video management, search
```

**Total: 16 files, ~4,792 lines**

---

## Layout (`layout.tsx`)
- Fixed 264px sidebar (responsive — hamburger on mobile)
- 14 nav links: Dashboard, Students, Teachers, Courses, Attendance, Installments, Payments, Finance, Certificates, Videos, Announcements, Analytics, Profile, Settings
- Active link: `bg-primary/10 text-primary`
- Theme toggle (light/dark) at sidebar bottom
- Mobile: `BottomNav` component + hamburger toggle
- Logo: "TNGC" badge + "Admin Panel"

---

## Pages Detail

### 1. Dashboard (`/admin/dashboard`)
**Purpose:** Main overview with key metrics and charts.
- 3 stat cards: Total Students (1,247), Active Courses (24), Attendance Today (89%)
- Enrollment Trends — AreaChart (6 months)
- Course Enrollment — BarChart (6 courses)
- Branch Revenue — PieChart donut (3 branches)
- Weekly Attendance — BarChart (Mon-Sat)
- Upcoming Events — 4 events with type badges
- Recent Enrollments — Table (5 rows)
- Pending Tasks — 4 items with priority

### 2. Analytics (`/admin/analytics`)
**Purpose:** Deep analytics with time filtering and export.
- 3 tab buttons: This Month / This Quarter / This Year (switches all data)
- 4 metrics: Student Growth, Completion Rate, Revenue, Avg Rating
- Enrollment Trends — AreaChart (full-width)
- Enrollment by Course Type — PieChart donut (Long-Term vs Short-Term)
- Branch Performance — BarChart
- Revenue vs Expenses — AreaChart (dual)
- Course Completion Status — PieChart donut
- Weekly Attendance — BarChart
- Top Performing Courses — Ranked list (1-5)
- Student Demographics — Age group bar visualization
- Course Rankings — Progress bars
- "Export Report" button → ExportDialog

### 3. Announcements (`/admin/announcements`)
**Purpose:** Manage institute-wide announcements.
- 4 stats: Total (8), Pinned (2), High Priority (3), This Month (6)
- Pinned section — cards with title, priority badge, message, target, date, author
- All announcements — Table with search filter
- Priority: high=red, medium=amber, low=blue
- "New Announcement" button → AnnouncementDialog

### 4. Attendance (`/admin/attendence`)
**Purpose:** Track daily attendance records.
- 4 stats: Total Students (186), Present (165), Absent (14), Late (7)
- Filters: search, date picker, branch dropdown
- Table: Student ID, Name, Course, Time In/Out, Status, Hours
- "Export" and "Mark Attendance" buttons

### 5. Certificates (`/admin/certificates`)
**Purpose:** Issue and manage student certificates.
- 4 stats: Total Issued (4), Pending (2), Rejected (1), Total (7)
- Search filter (name, course, credential ID)
- Table: Student, Course, Type, Credential ID, Date, Status, More
- "Issue Certificate" button

### 6. Courses (`/admin/course`)
**Purpose:** Manage all courses with card-based display.
- Filter tabs: All / Long-Term / Short-Term
- 4 stats: Total Courses (16), Enrollments, Popular, Highest Fee
- Card grid: name, duration, Popular badge, Status badge, Fee, Students, Rating, Completion rate, Progress bar, Next batch, Edit/Delete buttons
- "Add Course" button → AddCourseSheet

### 7. Finance (`/admin/finanace`)
**Purpose:** Financial overview with PIN-protected access.
- **PIN Gate:** 6-digit InputOTP → verify via `/api/verify-pin`
- 4 stats: Total Revenue (24.85L), Expenses (8.45L), Net Profit (16.4L), Margin (66%)
- Monthly Revenue vs Expenses — AreaChart (dual)
- Expense Breakdown — PieChart donut (5 categories)
- Branch-wise Revenue — BarChart (horizontal)
- Revenue by Course — Progress bars
- Recent Transactions — Table (8 rows)
- "Export Report" button → ExportDialog

### 8. Installments (`/admin/installments`)
**Purpose:** Track student installment payments.
- 4 stats: Total Collected (1.41L), Pending (29K), Overdue (22K), This Month (24K)
- Search + 4 tab filters: All / Paid / Pending / Overdue
- Table: Student, Course, Installment (e.g. "2/6"), Amount, Due Date, Paid Date, Status
- Pagination (10 per page)
- "Export" and "Add Installment" buttons

### 9. Payments (`/admin/payments`)
**Purpose:** View payment history with chart.
- Weekly Collections — BarChart (4 weeks)
- Search + Date Range filter
- Table: Payment ID, Student, Course, Amount, Date, Method, Status
- Pagination (8 per page)
- "Export" → ExportDialog, "Record Payment" button

### 10. Profile (`/admin/profile`)
**Purpose:** Display admin profile.
- Avatar (initials "AD"), name, role, branch, status
- Personal Information: email, phone, branch, joined
- Recent Activity — 5 items with colored dots
- "Edit Profile" → `/admin/profile/settings`

### 11. Profile Settings (`/admin/profile/settings`)
**Purpose:** Edit admin profile, password, notifications.
- Avatar upload section
- Personal Info form: Full Name, Email, Phone, Branch (select), Bio (textarea)
- Change Password: Current, New, Confirm
- Notification Toggles: Email (on), SMS (off), WhatsApp (on)
- "Cancel" and "Save Changes" buttons

### 12. Students List (`/admin/student`)
**Purpose:** List all students with search, filter, add.
- 4 stats: Total (1,247), Active (1,089), Pending (98), Inactive (60)
- Search + Filter + Export + "Add Student" (→ AddStudentSheet)
- Table: Student ID (links to detail), Name (links to detail), Course, Branch, Phone, Enrollment Date, Status, More
- Pagination (10 per page)

### 13. Student Detail (`/admin/student/[id]`)
**Purpose:** Comprehensive student profile with tabs.
- Profile Header: avatar, name, ID, course, branch, status badges
- 5 tabs:
  - **Profile** — Personal Info + Course Details + Parent/Guardian
  - **Attendance** — Overall %, Present/Absent/Leave counts, Monthly breakdown
  - **Fee** — Total/Paid/Remaining, Progress bar, 6-installment schedule
  - **Payments** — Total Paid/Pending stats, payments table
  - **Certificates** — Total/Issued/Processing, certificate cards with Download

### 14. Teachers (`/admin/teacher`)
**Purpose:** Manage faculty as card grid.
- 4 stats: Total (6), Active (5), On Leave (1), Total Subjects (14)
- Search + Filter + Export + "Add Teacher" (→ AddTeacherSheet)
- Card grid: name, role, status badge, branch, subject badges, experience, email, phone

### 15. Videos (`/admin/videos`)
**Purpose:** Manage course videos/lectures.
- 4 stats: Total (10), Published (8), Draft (1), Views (6,900)
- Search filter
- Table: Title (with Play icon), Course, Duration, Views, Uploaded By, Status, More
- "Upload Video" → UploadVideoSheet

---

## Shared Components (`components/admin/`)
- `add-course-sheet.tsx` — Sheet for adding courses
- `add-student-sheet.tsx` — Sheet for adding students
- `add-teacher-sheet.tsx` — Sheet for adding teachers
- `announcement-dialog.tsx` — Dialog for creating announcements
- `announcement-drawer.tsx` — Drawer for announcement details
- `bottom-nav.tsx` — Mobile bottom navigation
- `export-dialog.tsx` — Export dialog (used in analytics, finance, payments)
- `form-sheet.tsx` — Generic form sheet
- `upload-video-sheet.tsx` — Sheet for uploading videos

## UI Patterns
- **Stat cards:** 4-column grid, icon + value + label + trend percentage
- **Tables:** Custom HTML tables with search, pagination, status badges
- **Charts:** Recharts (AreaChart, BarChart, PieChart) with gradient fills
- **Filters:** Pill-style tab buttons, search inputs, date pickers, branch dropdowns
- **Actions:** "Add [Entity]" buttons open sheets, "Export" opens ExportDialog
- **Status badges:** Color-coded (green=active/paid, amber=pending, red=inactive/overdue, blue=processing)
- **Cards:** shadcn Card with CardHeader, CardContent, CardFooter
