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
  place?: string
  displayTitle?: string
}

export const CERTIFICATE_HEADING = "Certification of completion"

export function getCertificateCourseName(certificateName: string, courseName: string): string {
  const configuredName = certificateName.trim()
  const legacyDefaultNames = new Set([
    "course completion certificate",
    `${courseName.trim()} completion certificate`.toLowerCase(),
  ])
  return configuredName && !legacyDefaultNames.has(configuredName.toLowerCase())
    ? configuredName
    : courseName
}

const INSTITUTE_NAME = "THE NEW GENERATION COMPUTERS"
const FONT_SERIF = "'Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const FONT_SCRIPT = "'Pinyon Script', 'Monotype Corsiva', cursive"

// A4 landscape @ 96dpi
const W = 1123
const H = 794
const CX = W / 2

// Body block: every row is laid out between these two x positions.
const L = 96
const R = 1026

const LABEL_SIZE = 22
const CHAR_W = 8.8 // approx. label width per character at LABEL_SIZE
const GAP = 6

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

function fitText(text: string, maxWidth: number, maxSize: number, minSize: number, factor: number) {
  const size = Math.max(minSize, Math.min(maxSize, maxWidth / Math.max(1, text.length * factor)))
  const overflow = text.length * factor * size > maxWidth
  return {
    size: size.toFixed(1),
    squeeze: overflow ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "",
  }
}

/** Dynamic value centred on its underline. */
function valueText(
  raw: string,
  x1: number,
  x2: number,
  y: number,
  maxSize = 19,
  minSize = 10,
  factor = 0.6
): string {
  const maxWidth = x2 - x1 - 12
  const { size, squeeze } = fitText(raw, maxWidth, maxSize, minSize, factor)
  return `<text class="value" x="${(x1 + x2) / 2}" y="${y}" text-anchor="middle" font-size="${size}"${squeeze}>${escapeHtml(raw)}</text>`
}

/** Natural width of a label, used to plan the row. */
function width(text: string): number {
  return Math.round(text.length * CHAR_W)
}

/**
 * Label occupying exactly x1..x2 (textLength pins the width, so the rules that follow
 * always touch it — no gaps or overlaps whichever font ends up rendering).
 */
function label(x1: number, x2: number, y: number, text: string): string {
  return `<text class="label" x="${x1}" y="${y}" font-size="${LABEL_SIZE}" textLength="${x2 - x1}" lengthAdjust="spacing">${escapeHtml(text)}</text>`
}

function rule(x1: number, x2: number, y: number): string {
  return `<line x1="${x1}" y1="${y + 6}" x2="${x2}" y2="${y + 6}" stroke="#1b2340" stroke-width="0.9" />`
}

export function createCertificateHtml(certificate: PrintableCertificate, autoPrint = false): string {
  const typeRaw = certificate.type || "Completion"
  const type = escapeHtml(typeRaw)
  const studentRaw = (certificate.studentName || "Student").toUpperCase()
  const guardianRaw = (certificate.guardianName || "—").toUpperCase()
  const courseRaw = (certificate.course || "Course").toUpperCase()
  const credentialRaw = certificate.credentialId || "—"
  const divisionRaw = (certificate.division || "—").toUpperCase()
  const placeRaw = (certificate.place || "HYDERABAD").toUpperCase()
  const issuedRaw = formatDate(certificate.issuedDate)
  const courseStartRaw = formatDate(certificate.courseStartDate)
  const courseEndRaw = formatDate(certificate.courseEndDate)
  const issuedByRaw = (certificate.issuedBy || "M. NADIYA").toUpperCase()

  const title = escapeHtml(CERTIFICATE_HEADING)

  const titleText = CERTIFICATE_HEADING
  const titleFit = fitText(titleText, 560, 42, 24, 0.42)

  // Both dates share one size so they look identical.
  const dateFit = Math.min(
    Number(fitText(courseStartRaw, 240, 19, 10, 0.6).size),
    Number(fitText(courseEndRaw, 240, 19, 10, 0.6).size)
  )

  // ---- Body rows (baselines) ----
  const Y0 = 276
  const STEP = 46
  const y = (i: number) => Y0 + STEP * i

  // Row 0: Roll no
  const t0 = "Roll. No."
  const r0a = L
  const r0b = r0a + width(t0)

  // Row 1: Student
  const t1 = "This is to certify that Sri / Smt / Kum."
  const r1a = L
  const r1b = r1a + width(t1)

  // Row 2: Guardian + "is awarded the"
  const t2a = "S/o, D/o, G/o"
  const t2b = "is awarded the"
  const r2a = L + width(t2a)
  const r2b = R - width(t2b)

  // Row 3: Course + "He / She having successfully completed"
  const t3 = "He / She having successfully completed"
  const r3a = R - width(t3)

  // Row 4: full-width justified line
  const t4 = "the prescribed course of study in Theory and Practicals at our Institute in Ramanthapur conducted from"

  // Row 5: dates + sentence
  const t5 = "and having passed the final Examination"
  const t5w = width(t5)
  const gapTo = 22 + GAP * 4 // "to"
  const dateRuleW = Math.round((R - L - t5w - gapTo - 14) / 2)
  const d1a = L
  const d1b = d1a + dateRuleW
  const toX = d1b + GAP + 2
  const d2a = toX + 22 + GAP + 2
  const d2b = d2a + dateRuleW
  const t5x = R - t5w

  // Row 6: Division
  const t6a = "and placed in"
  const t6b = "Division."
  const r6a = L + width(t6a)
  const r6b = R - width(t6b)

  const printScript = autoPrint
    ? `<script>
(function () {
  var done = false;
  function go() { if (done) return; done = true; window.print(); }
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("italic 700 22px 'Cormorant Garamond'"),
      document.fonts.load("700 18px 'Cormorant Garamond'"),
      document.fonts.load("600 13px Montserrat"),
      document.fonts.load("700 13px Montserrat"),
      document.fonts.load("800 33px 'Playfair Display'"),
      document.fonts.load("400 40px 'Pinyon Script'")
    ]).then(function () {
      return document.fonts.ready;
    }).then(function () {
      setTimeout(go, 100);
    }, function () {
      setTimeout(go, 100);
    });
    setTimeout(go, 5000);
  } else {
    window.onload = go;
  }
})();
</script>`
    : ""

  const fontImport =
    "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600;1,700&family=Cormorant+Garamond:wght@600;700&family=Montserrat:wght@500;600;700&family=Pinyon+Script&family=Playfair+Display:wght@700;800&display=swap');"

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    ${fontImport}
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 0; }
    html, body { width: 100%; min-height: 100%; margin: 0; padding: 0; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef1f5;
      color: #1b2340;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
    }
    .page {
      width: min(297mm, calc(100vw - 24px), calc((100vh - 24px) * ${W} / ${H}));
      width: min(297mm, calc(100vw - 24px), calc((100dvh - 24px) * ${W} / ${H}));
      aspect-ratio: ${W} / ${H};
      flex: none;
      background: #fff;
    }
    svg { display: block; width: 100%; height: 100%; }
    .label { font-family: ${FONT_SERIF}; font-style: italic; font-weight: 700; fill: #1b2340; }
    .value { font-family: ${FONT_SERIF}; font-style: normal; font-weight: 700; fill: #1d2a55; stroke: #1d2a55; stroke-width: 0.18px; paint-order: stroke fill; font-variant-numeric: lining-nums; }
    @media print {
      html, body { width: 297mm; height: 210mm; min-height: 0; overflow: hidden; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      body { display: block; }
      .page { width: 297mm; height: 210mm; aspect-ratio: auto; page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Certificate of ${type} for ${escapeHtml(studentRaw)}">
      <defs>
        <path id="ringTop" d="M27.07 87.65 A43 43 0 1 1 92.93 87.65" />
        <path id="ringBottom" d="M14.14 76.69 A48.8 48.8 0 0 0 105.86 76.69" />
      </defs>

      <!-- Page + frame -->
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" />
      <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#b8923f" stroke-width="1.4" />
      <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="#b8923f" stroke-width="0.5" />

      <!-- Faint watermark seal -->
      <g transform="translate(${CX} 420) scale(3.9) translate(-60 -60)" opacity="0.06" fill="#1d2a55">
        <circle cx="60" cy="60" r="58" fill="none" stroke="#1d2a55" stroke-width="2.2" />
        <circle cx="60" cy="60" r="35.5" fill="none" stroke="#1d2a55" stroke-width="1.6" />
        <text font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="6.4" letter-spacing="0.6">
          <textPath href="#ringTop" startOffset="50%" text-anchor="middle">THE NEW GENERATION COMPUTERS</textPath>
        </text>
        <text font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="5.6" letter-spacing="0.8">
          <textPath href="#ringBottom" startOffset="50%" text-anchor="middle">RAMANTHAPUR • HYDERABAD</textPath>
        </text>
        <text x="60" y="68" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800" font-size="15">TNGC</text>
      </g>

      <!-- Top-right: round seal (centred at 940,95, mirrors the logo) -->
      <g transform="translate(887 42) scale(0.88)">
        <circle cx="60" cy="60" r="58" fill="#1d2a55" />
        <circle cx="60" cy="60" r="55" fill="none" stroke="#b8923f" stroke-width="1" />
        <circle cx="60" cy="60" r="35.5" fill="#fff" stroke="#b8923f" stroke-width="1.4" />
        <circle cx="60" cy="60" r="32.5" fill="none" stroke="#1d2a55" stroke-width="0.6" />
        <text fill="#fff" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="6.4" letter-spacing="0.6">
          <textPath href="#ringTop" startOffset="50%" text-anchor="middle">THE NEW GENERATION COMPUTERS</textPath>
        </text>
        <text fill="#fff" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="5.6" letter-spacing="0.8">
          <textPath href="#ringBottom" startOffset="50%" text-anchor="middle">RAMANTHAPUR • HYDERABAD</textPath>
        </text>
        <circle cx="15.6" cy="71.9" r="1.8" fill="#b8923f" />
        <circle cx="104.4" cy="71.9" r="1.8" fill="#b8923f" />
        <polygon points="60,40 61.41,44.06 65.71,44.15 62.28,46.74 63.53,50.85 60,48.4 56.47,50.85 57.72,46.74 54.29,44.15 58.59,44.06" fill="#b8923f" />
        <text x="60" y="68" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800" font-size="15" fill="#1d2a55" letter-spacing="0.5">TNGC</text>
        <path d="M36 66 Q42 86 60 88 Q78 86 84 66" fill="none" stroke="#b8923f" stroke-width="1.4" stroke-linecap="round" />
      </g>

      <!-- Header -->
      <text x="${CX}" y="100" text-anchor="middle" font-family="'Playfair Display', 'Times New Roman', Georgia, serif" font-weight="800" font-size="34" fill="#1d2a55" textLength="620" lengthAdjust="spacingAndGlyphs">${INSTITUTE_NAME}</text>
      <text x="${CX}" y="128" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="600" font-size="13" fill="#1b2340" textLength="390" lengthAdjust="spacingAndGlyphs">AN ISO 9001:2015 CERTIFIED ORGANIZATION</text>
      <text x="${CX}" y="150" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="500" font-size="12.5" fill="#1b2340" textLength="330" lengthAdjust="spacing">(Recognised By Govt. of Telangana - 3106/16)</text>
      <text x="${CX}" y="212" text-anchor="middle" font-family="${FONT_SCRIPT}" font-size="${titleFit.size}"${titleFit.squeeze} fill="#a61d33">${escapeHtml(titleText)}</text>

      <!-- Row 0: Roll no -->
      ${label(r0a, r0b, y(0), t0)}
      ${rule(r0b + GAP, 560, y(0))}
      ${valueText(credentialRaw, r0b + GAP, 560, y(0), 19, 10, 0.64)}

      <!-- Row 1: Student -->
      ${label(r1a, r1b, y(1), t1)}
      ${rule(r1b + GAP, R, y(1))}
      ${valueText(studentRaw, r1b + GAP, R, y(1))}

      <!-- Row 2: Guardian -->
      ${label(L, r2a, y(2), t2a)}
      ${rule(r2a + GAP, r2b - GAP, y(2))}
      ${valueText(guardianRaw, r2a + GAP, r2b - GAP, y(2))}
      ${label(r2b, R, y(2), t2b)}

      <!-- Row 3: Course -->
      ${rule(L, r3a - GAP, y(3))}
      ${valueText(courseRaw, L, r3a - GAP, y(3))}
      ${label(r3a, R, y(3), t3)}

      <!-- Row 4: full-width sentence -->
      ${label(L, R, y(4), t4)}

      <!-- Row 5: dates + sentence -->
      ${rule(d1a, d1b, y(5))}
      <text class="value" x="${(d1a + d1b) / 2}" y="${y(5)}" text-anchor="middle" font-size="${dateFit}">${escapeHtml(courseStartRaw)}</text>
      ${label(toX, toX + 22, y(5), "to")}
      ${rule(d2a, d2b, y(5))}
      <text class="value" x="${(d2a + d2b) / 2}" y="${y(5)}" text-anchor="middle" font-size="${dateFit}">${escapeHtml(courseEndRaw)}</text>
      ${label(t5x, R, y(5), t5)}

      <!-- Row 6: Division -->
      ${label(L, r6a, y(6), t6a)}
      ${rule(r6a + GAP, r6b - GAP, y(6))}
      ${valueText(divisionRaw, r6a + GAP, r6b - GAP, y(6))}
      ${label(r6b, R, y(6), t6b)}

      <!-- Date / Place -->
      <text x="${L}" y="618" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="#1b2340" stroke="#1b2340" stroke-width="0.12px" paint-order="stroke fill">Date :</text>
      <text x="${L}" y="650" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="#1b2340" stroke="#1b2340" stroke-width="0.12px" paint-order="stroke fill">Place :</text>
      <line x1="154" y1="621" x2="300" y2="621" stroke="#1b2340" stroke-width="0.9" />
      <line x1="154" y1="653" x2="300" y2="653" stroke="#1b2340" stroke-width="0.9" />
      ${valueText(issuedRaw, 154, 300, 618, 14, 9, 0.6)}
      ${valueText(placeRaw, 154, 300, 650, 14, 9, 0.6)}

      <!-- Signatures + stamp -->
      <g transform="translate(0 14)">
        <g transform="translate(335.5 600)">
          <path d="${CERTIFICATE_SIGNATURE_PATHS.director}" fill="#1a2a9c" fill-rule="evenodd" />
        </g>
        <text x="412.5" y="700" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="14" fill="#1b2340">M. NADIYA</text>
        <text x="412.5" y="717" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="500" font-size="10.5" fill="#1b2340">Centre Director</text>

        <g transform="translate(477.5 606) scale(0.85)">
          <path d="${CERTIFICATE_STAMP_PATH}" fill="#2a4fa8" fill-rule="evenodd" opacity="0.88" />
        </g>

        <g transform="translate(585.5 600)">
          <path d="${CERTIFICATE_SIGNATURE_PATHS.trainer}" fill="#1a2a9c" fill-rule="evenodd" />
        </g>
        <text x="710.5" y="700" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="14" fill="#1b2340">${escapeHtml(issuedByRaw)}</text>
        <text x="710.5" y="717" text-anchor="middle" font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="500" font-size="10.5" fill="#1b2340">Trainer</text>
      </g>
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