"use client"

import { CERTIFICATE_SIGNATURE_PATHS, CERTIFICATE_STAMP_PATH } from "@/lib/certificate-assets"

export interface PrintableCertificate {
  studentName: string
  guardianName: string
  course: string
  type: string
  name: string
  credentialId: string
  issuedDate: string
  courseStartDate: string
  courseEndDate: string
  division: string
  issuedBy: string
}

const INSTITUTE_NAME = "THE NEW GENERATION COMPUTERS"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return "—"

  const [, year, month, day] = match
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    .toLocaleString("en", { month: "short", timeZone: "UTC" })
    .toUpperCase()
  return `${day}-${monthName}-${year}`
}

export function createCertificateHtml(certificate: PrintableCertificate, autoPrint = false): string {
  const studentName = certificate.studentName || "Student"
  const student = escapeHtml(studentName)
  const guardian = escapeHtml(certificate.guardianName || "—")
  const courseName = certificate.course || "Course"
  const course = escapeHtml(courseName)
  const type = escapeHtml(certificate.type || "Completion")
  const title = escapeHtml(
    certificate.name || `${certificate.course || "Course"} ${certificate.type || "Completion"} Certificate`
  )
  const credential = escapeHtml(certificate.credentialId || "—")
  const issued = escapeHtml(formatDate(certificate.issuedDate))
  const courseStart = escapeHtml(formatDate(certificate.courseStartDate))
  const courseEnd = escapeHtml(formatDate(certificate.courseEndDate))
  const division = escapeHtml(certificate.division || "—")
  const studentFontSize = Math.max(18, Math.min(48, 1050 / (studentName.length * 0.56)))
  const courseFontSize = Math.max(18, Math.min(34, 1000 / (courseName.length * 0.55)))

  const printScript = autoPrint ? "<script>window.onload = function () { window.print(); }</script>" : ""

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 0; }
  html, body { width: 100%; height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #e8e7e3; color: #172b49; font-family: Georgia, 'Times New Roman', serif; }
  .page { width: 297mm; height: 210mm; padding: 9mm; background: #fffdf7; }
  svg { display: block; width: 100%; height: 100%; }
  .small { font-family: Arial, sans-serif; }
  @media screen {
    .page { max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); }
  }
  @media print {
    body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { max-width: none; max-height: none; }
  }
</style>
</head>
<body>
  <main class="page">
    <svg viewBox="0 0 1400 990" role="img" aria-label="Certificate of ${type} for ${student}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9b6b20" />
          <stop offset=".5" stop-color="#e8cc82" />
          <stop offset="1" stop-color="#9b6b20" />
        </linearGradient>
        <pattern id="paper" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 24L24 0M-6 6L6-6M18 30L30 18" stroke="#aa8b4e" stroke-opacity=".045" stroke-width="1" />
        </pattern>
      </defs>
      <rect x="8" y="8" width="1384" height="974" fill="#fffdf7" stroke="#173252" stroke-width="12" />
      <rect x="25" y="25" width="1350" height="940" fill="url(#paper)" stroke="url(#gold)" stroke-width="4" />
      <rect x="39" y="39" width="1322" height="912" fill="none" stroke="#173252" stroke-width="1.5" />
      <g fill="none" stroke="url(#gold)" stroke-width="3">
        <path d="M48 205V48H205M1195 48h157v157M48 785v157h157M1195 942h157V785" />
        <path d="M48 245c75-8 109-43 121-121M1352 245c-75-8-109-43-121-121M48 745c75 8 109 43 121 121M1352 745c-75 8-109 43-121 121" />
      </g>
      <g fill="#173252">
        <circle cx="58" cy="58" r="5" /><circle cx="1342" cy="58" r="5" />
        <circle cx="58" cy="932" r="5" /><circle cx="1342" cy="932" r="5" />
      </g>

      <g transform="translate(128 125)">
        <circle cx="0" cy="0" r="48" fill="#173252" stroke="url(#gold)" stroke-width="4" />
        <circle cx="0" cy="0" r="39" fill="none" stroke="#fffdf7" stroke-width="1.5" />
        <path d="M0-25l7 17 18 2-14 12 4 18L0 14l-15 10 4-18-14-12 18-2z" fill="#e5c16f" />
        <text x="0" y="67" text-anchor="middle" class="small" font-size="10" font-weight="700" letter-spacing="2" fill="#173252">TNGC</text>
      </g>
      <g text-anchor="middle" fill="#173252">
        <text x="700" y="111" font-size="34" font-weight="700" letter-spacing="2">${INSTITUTE_NAME}</text>
        <text x="700" y="145" class="small" font-size="14" font-weight="700" letter-spacing="3">AN ISO 9001:2015 CERTIFIED ORGANIZATION</text>
        <text x="700" y="170" class="small" font-size="12" letter-spacing="1.5" fill="#7c6535">RECOGNIZED BY GOVERNMENT OF TELANGANA · 3106/16</text>
      </g>
      <g class="small" text-anchor="end" fill="#173252">
        <text x="1267" y="91" font-size="12" letter-spacing="1.5">ROLL NO.</text>
        <text x="1267" y="116" font-size="18" font-weight="700">${credential}</text>
      </g>
      <path d="M300 215H1100" stroke="url(#gold)" stroke-width="2" />
      <path d="M660 215l40-12 40 12-40 12z" fill="#d5b361" />

      <g text-anchor="middle" fill="#173252">
        <text x="700" y="279" font-size="43" font-weight="700" letter-spacing="4">CERTIFICATE OF ${type.toUpperCase()}</text>
        <text x="700" y="324" class="small" font-size="16" letter-spacing="3" fill="#7c6535">THIS IS TO CERTIFY THAT</text>
        <text x="700" y="390" font-size="${studentFontSize}" font-weight="700" fill="#173252">${student}</text>
        <path d="M390 405H1010" stroke="#c5a454" stroke-width="2" />
        <text x="700" y="443" class="small" font-size="18" fill="#45566a">Guardian: <tspan font-weight="700" fill="#173252">${guardian}</tspan></text>
        <text x="700" y="489" class="small" font-size="18" fill="#45566a">has successfully completed the course</text>
        <text x="700" y="544" font-size="${courseFontSize}" font-weight="700" fill="#9b6b20">${course}</text>
        <text x="700" y="585" class="small" font-size="17" fill="#45566a">Course period: <tspan font-weight="700" fill="#173252">${courseStart}</tspan> to <tspan font-weight="700" fill="#173252">${courseEnd}</tspan></text>
        <text x="700" y="621" class="small" font-size="17" fill="#45566a">Awarded in <tspan font-weight="700" fill="#173252">${division}</tspan></text>
      </g>

      <path d="M130 682H1270" stroke="#d5b361" stroke-width="1.5" />
      <g text-anchor="middle" fill="#173252">
        <g transform="translate(390 710) scale(1.05)">
          <path d="${CERTIFICATE_SIGNATURE_PATHS.director}" fill="#1a2a9c" fill-rule="evenodd" />
        </g>
        <g transform="translate(626 704) scale(.95)">
          <path d="${CERTIFICATE_STAMP_PATH}" fill="#2a4fa8" fill-rule="evenodd" opacity=".88" />
        </g>
        <g transform="translate(880 715) scale(.95)">
          <path d="${CERTIFICATE_SIGNATURE_PATHS.trainer}" fill="#1a2a9c" fill-rule="evenodd" />
        </g>
        <path d="M325 791h230" stroke="#173252" stroke-width="1.5" />
        <text x="440" y="817" class="small" font-size="14" font-weight="700" letter-spacing="1.5">M. NADIYA</text>
        <text x="440" y="839" class="small" font-size="11" letter-spacing="1" fill="#7c6535">CENTRE DIRECTOR</text>
        <path d="M845 791h230" stroke="#173252" stroke-width="1.5" />
        <text x="960" y="817" class="small" font-size="14" font-weight="700" letter-spacing="1.5">M. ESWARA RAO</text>
        <text x="960" y="839" class="small" font-size="11" letter-spacing="1" fill="#7c6535">TRAINER</text>
      </g>
      <g class="small" fill="#173252">
        <text x="139" y="877" font-size="12" letter-spacing="1">ISSUE DATE</text>
        <text x="139" y="901" font-size="16" font-weight="700">${issued}</text>
        <text x="1261" y="877" text-anchor="end" font-size="12" letter-spacing="1">ISSUED AT</text>
        <text x="1261" y="901" text-anchor="end" font-size="16" font-weight="700">HYDERABAD, TELANGANA</text>
      </g>
      <text x="700" y="922" text-anchor="middle" class="small" font-size="10" letter-spacing="2" fill="#7c6535">RAMANTHAPUR · HYDERABAD</text>
    </svg>
  </main>
  ${printScript}
</body>
</html>`
}

export function printCertificate(certificate: PrintableCertificate): boolean {
  const html = createCertificateHtml(certificate, true)
  const win = window.open("", "_blank", "width=1200,height=850")
  if (!win) return false

  win.document.write(html)
  win.document.close()
  win.focus()
  return true
}
