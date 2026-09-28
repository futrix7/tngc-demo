import Link from "next/link"

export default function PrivacyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">Last updated: 24 August 2026</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect personal information that you provide during enrollment, including your name, contact details, date of birth, parent/guardian information, educational background, and identification documents. We also collect usage data such as login timestamps, pages visited, and course progress.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your information is used to manage your enrollment, track attendance and course progress, process fee payments, issue certificates, communicate important notices, and improve our educational services. We do not sell or rent your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Data Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Data Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, or as required by law. Course records and certificates are maintained indefinitely for verification purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Cookies and Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Student Portal uses essential cookies to maintain your session and preferences. We do not use third-party tracking cookies or advertising cookies. Analytics data is collected in aggregate to improve portal performance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may use third-party services for payment processing and communication. These services have their own privacy policies, and we encourage you to review them. We only share information necessary for these services to function.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal information. You may also request a copy of all data we hold about you. To exercise these rights, contact our administration office.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Children&apos;s Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For students under 18, we require parental consent during enrollment. Parents/guardians have the right to review and request deletion of their child&apos;s information at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Significant changes will be communicated through the Student Portal or via email. Your continued use of the portal after changes are posted constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related inquiries, contact:
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
