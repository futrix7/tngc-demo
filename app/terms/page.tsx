import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-12 border-b border-border bg-card">
        <div className="flex h-full items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[10px] font-extrabold">
              TNGC
            </div>
            <span className="text-sm font-bold">The New Generation Computers</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Terms & Conditions</h1>
          <p className="text-sm text-muted-foreground mt-1">Last updated: 24 August 2026</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing and using the TNGC (The New Generation Computers) Student Portal, you agree to be bound by these Terms and Conditions. If you do not agree to any part of these terms, you may not access the portal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Use of the Portal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Student Portal is provided exclusively for enrolled students of TNGC to access course materials, view attendance records, track fee payments, download certificates, and communicate with administration. You agree to use the portal only for its intended purpose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Account Responsibility</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your login credentials. Any activity that occurs under your account is your responsibility. Notify TNGC administration immediately if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Course Enrollment</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enrollment in any course is subject to availability and payment of applicable fees. TNGC reserves the right to modify course schedules, content, and instructors without prior notice. Course completion certificates are issued only after meeting all attendance and assessment requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Fee Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All fees must be paid by the specified due dates. Late payments may attract additional charges. Fees once paid are non-refundable except in cases where TNGC cancels the course. Installment plans must be adhered to as agreed during enrollment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Attendance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A minimum attendance of 75% is required to be eligible for course completion certificates. Students with attendance below the minimum threshold may be required to repeat certain modules or may not receive certification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Intellectual Property</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All course materials, videos, documents, and content provided through the portal are the intellectual property of TNGC and its faculty. You may not reproduce, distribute, or share these materials with unauthorized parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TNGC shall not be liable for any indirect, incidental, or consequential damages arising from the use of the portal. The portal is provided &quot;as is&quot; without warranties of any kind, either express or implied.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Modifications</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TNGC reserves the right to modify these Terms and Conditions at any time. Changes will be effective immediately upon posting. Continued use of the portal after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For any questions regarding these Terms & Conditions, contact us at:
            </p>
            <div className="text-sm text-muted-foreground mt-2 space-y-1">
              <p>The New Generation Computers</p>
              <p>Ramanthapur, Hyderabad, Telangana</p>
              <p>Phone: +91 81432 48778 </p>
              <p>Phone: +91 95501 92527</p>
              <p>Email: contact@tngcinstitute.com</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
