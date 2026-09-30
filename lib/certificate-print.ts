/**
 * Renders an issued certificate as a printable page and opens it for printing.
 *
 * Both certificate screens had their own idea of this, or none at all: the
 * student's page built the HTML inline, and the admin's per-student page had a
 * "Download" button with no `onClick` that did nothing at all. Printing is the
 * honest implementation here — the app has no PDF renderer and no server-side
 * certificate endpoint, so anything labelled "Download PDF" that produced a
 * blob would be a promise the code does not keep. The browser's print dialog
 * saves to PDF on every platform the institute uses.
 *
 * Every value that reaches the document is escaped. These strings are student
 * names, course names and free-text references that an admin typed, and they are
 * interpolated into HTML that a browser will parse; a name containing `<` would
 * otherwise truncate the document or inject markup into a certificate that is
 * meant to be an official-looking artefact.
 */

export interface PrintableCertificate {
  /** The recipient's full name. */
  studentName: string
  /** The course the certificate is for. */
  course: string
  /** `Completion` | `Proficiency` | `Module`, shown as "Certificate of ...". */
  type: string
  /** The human-readable certificate title, if one was set. */
  name: string
  credentialId: string
  issuedDate: string
  issuedBy: string
}

const INSTITUTE_NAME = "TNGC Computers"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Opens the certificate in a new window and calls print on it.
 *
 * Returns false when the browser blocked the popup, so the caller can say so —
 * `window.open` returning null is not a failure to ignore, and the previous
 * version left the user with no window and no message.
 */
export function printCertificate(certificate: PrintableCertificate): boolean {
  const student = escapeHtml(certificate.studentName || "Student")
  const course = escapeHtml(certificate.course || "Course")
  const type = escapeHtml(certificate.type || "Completion")
  const title = escapeHtml(certificate.name || `${course} ${type} Certificate`)
  const credential = escapeHtml(certificate.credentialId || "—")
  const issued = escapeHtml(certificate.issuedDate || "—")
  const issuedBy = escapeHtml(certificate.issuedBy || INSTITUTE_NAME)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 40px; color: #1a202c; }
  .cert { max-width: 800px; margin: 0 auto; border: 4px double #16a34a; padding: 48px; text-align: center; }
  .brand { font-size: 28px; font-weight: 700; color: #16a34a; letter-spacing: 2px; }
  .sub { font-size: 12px; letter-spacing: 3px; color: #718096; text-transform: uppercase; margin-top: 4px; }
  .line { border-top: 2px solid #16a34a; margin: 20px auto; width: 120px; }
  .intro { font-size: 13px; color: #718096; text-transform: uppercase; letter-spacing: 2px; }
  .name { font-size: 34px; font-weight: 700; margin: 8px 0 16px; border-bottom: 2px solid #e2e8f0; display: inline-block; padding: 0 24px 8px; }
  .body { font-size: 15px; color: #4a5568; }
  .course { font-size: 20px; font-weight: 700; color: #16a34a; margin: 6px 0; }
  .meta { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; color: #718096; text-align: center; gap: 20px; }
  .meta div { flex: 1; }
  .meta strong { display: block; color: #1a202c; font-size: 14px; margin-top: 6px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="cert">
    <div class="brand">${INSTITUTE_NAME}</div>
    <div class="sub">Certificate of ${type}</div>
    <hr class="line" />
    <p class="intro">This is to certify that</p>
    <p class="name">${student}</p>
    <p class="body">has successfully completed the course</p>
    <p class="course">${course}</p>
    <p class="body">with satisfactory performance and has been awarded this certificate.</p>
    <div class="meta">
      <div>Credential ID<strong>${credential}</strong></div>
      <div>Date Issued<strong>${issued}</strong></div>
      <div>Issued By<strong>${issuedBy}</strong></div>
    </div>
  </div>
  <script>window.onload = function () { window.print(); }<\/script>
</body>
</html>`

  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) return false

  win.document.write(html)
  win.document.close()
  win.focus()
  return true
}
