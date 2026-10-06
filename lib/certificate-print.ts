"use client"

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
const FONT_SANS = "Montserrat, Arial, Helvetica, sans-serif"

// A4 landscape @ 96dpi
const W = 1123
const H = 794
const CX = W / 2

// Body block: every row is laid out between these two x positions.
const L = 96
const R = 1026

const LABEL_SIZE = 23
const CHAR_W = 8.7 // approx. label width per character at LABEL_SIZE
const GAP = 8

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
  maxSize = 21,
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

/** Empty signature space above a line, followed by the printed name and designation. */
function signatureBlock(x1: number, x2: number, lineY: number, name: string, role: string): string {
  const cx = (x1 + x2) / 2
  return `<line x1="${x1}" y1="${lineY}" x2="${x2}" y2="${lineY}" stroke="#1b2340" stroke-width="0.9" />
      <text x="${cx}" y="${lineY + 20}" text-anchor="middle" font-family="${FONT_SANS}" font-weight="700" font-size="13" fill="#1b2340">${escapeHtml(name)}</text>
      <text x="${cx}" y="${lineY + 36}" text-anchor="middle" font-family="${FONT_SANS}" font-weight="500" font-size="10.5" fill="#1b2340">${escapeHtml(role)}</text>`
}

function metaRow(labelText: string, value: string, y: number): string {
  return `<text x="${L}" y="${y}" font-family="${FONT_SANS}" font-weight="700" font-size="12" letter-spacing="0.4" fill="#1b2340">${labelText}</text>
      <line x1="${L + 62}" y1="${y + 3}" x2="${L + 200}" y2="${y + 3}" stroke="#1b2340" stroke-width="0.9" />
      ${valueText(value, L + 62, L + 200, y, 14, 8, 0.6)}`
}

const ADDRESS_LINE = "# 3-3-21/B, 1st Floor, Sharadanagar, RTC Colony Road, Ramanthapur, Hyderabad - 500013."
const WHATSAPP_NUMBER = "8790745614"
const WHATSAPP_URL = "https://wa.me/918790745614"

const FOOTER_TOP = 726
const FOOTER_H = 32

/** Full-width footer band with address, phone and website. */
function footerBar(): string {
  const mid = FOOTER_TOP + FOOTER_H / 2 + 4
  const addr = fitText(ADDRESS_LINE, 640, 12, 8, 0.52)
  const t = (x: number, anchor: string, text: string, size: string, extra = "") =>
    `<text x="${x}" y="${mid}" text-anchor="${anchor}" font-family="${FONT_SANS}" font-weight="600" font-size="${size}" fill="#fff"${extra}>${escapeHtml(text)}</text>`
  return `<rect x="36" y="${FOOTER_TOP}" width="${W - 72}" height="${FOOTER_H}" fill="#1d2a55" />
      <rect x="36" y="${FOOTER_TOP}" width="${W - 72}" height="2" fill="#b8923f" />
      ${t(L, "start", ADDRESS_LINE, addr.size, addr.squeeze)}
      <a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ${WHATSAPP_NUMBER}">
        ${t(R, "end", `WhatsApp: ${WHATSAPP_NUMBER}`, "12")}
      </a>`
}

/** ISO 9001, IAF and DAC marks redrawn as vectors from the original certificate. */
function accreditationLogos(x: number, cy: number): string {
  const navy = "#1f3f7a"
  const blue = "#2b5d9b"

  // ISO 9001: ring with tick + banner
  const ic = x + 24
  const iso = `<g>
        <polygon points="${x + 40},${cy - 19} ${x + 100},${cy - 19} ${x + 110},${cy + 22} ${x + 40},${cy + 22}" fill="${navy}" />
        <circle cx="${ic}" cy="${cy}" r="23" fill="#fff" stroke="${navy}" stroke-width="3" />
        <circle cx="${ic}" cy="${cy}" r="17" fill="none" stroke="${navy}" stroke-width="0.8" />
        <path d="M${ic - 15} ${cy - 1} L${ic - 5} ${cy + 11} L${ic + 15} ${cy - 25}" fill="none" stroke="${navy}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        <text x="${x + 74}" y="${cy - 3}" text-anchor="middle" font-family="${FONT_SANS}" font-weight="800" font-size="16" letter-spacing="1" fill="#fff">ISO</text>
        <text x="${x + 74}" y="${cy + 16}" text-anchor="middle" font-family="${FONT_SERIF}" font-weight="600" font-size="19" fill="#fff">9001</text>
      </g>`

  // IAF: blue ellipse with ringed text and grid
  const fx = x + 124 + 35
  const iaf = `<g>
        <defs>
          <path id="iafTop" d="M${fx - 26} ${cy + 1} A26 17 0 0 1 ${fx + 26} ${cy + 1}" />
          <path id="iafBottom" d="M${fx - 31} ${cy - 1} A31 21.5 0 0 0 ${fx + 31} ${cy - 1}" />
        </defs>
        <ellipse cx="${fx}" cy="${cy}" rx="35" ry="24" fill="${blue}" />
        <ellipse cx="${fx}" cy="${cy}" rx="29" ry="19" fill="none" stroke="#fff" stroke-width="0.8" />
        <g stroke="#fff" stroke-width="0.4" fill="none" opacity="0.7">
          <ellipse cx="${fx}" cy="${cy}" rx="12" ry="19" />
          <line x1="${fx - 29}" y1="${cy}" x2="${fx + 29}" y2="${cy}" />
          <line x1="${fx - 26}" y1="${cy - 9}" x2="${fx + 26}" y2="${cy - 9}" />
          <line x1="${fx - 26}" y1="${cy + 9}" x2="${fx + 26}" y2="${cy + 9}" />
        </g>
        <text font-family="${FONT_SANS}" font-weight="700" font-size="5" letter-spacing="0.9" fill="#fff"><textPath href="#iafTop" startOffset="50%" text-anchor="middle">INTERNATIONAL</textPath></text>
        <text font-family="${FONT_SANS}" font-weight="700" font-size="4.6" letter-spacing="0.6" fill="#fff"><textPath href="#iafBottom" startOffset="50%" text-anchor="middle">ACCREDITATION FORUM</textPath></text>
        <text x="${fx}" y="${cy + 3.5}" text-anchor="middle" font-family="${FONT_SANS}" font-weight="800" font-size="9.5" fill="#fff" stroke="${blue}" stroke-width="0.6" paint-order="stroke fill">www.iaf.nu</text>
      </g>`

  // DAC: triangle with leaf
  const dx = x + 208 + 23
  const dac = `<g>
        <path d="M${dx} ${cy - 25} L${dx + 24} ${cy + 24} L${dx - 24} ${cy + 24} Z" fill="#fff" stroke="#6b2a24" stroke-width="3" stroke-linejoin="round" />
        <path d="M${dx - 8} ${cy - 2} Q${dx - 9} ${cy - 15} ${dx + 1} ${cy - 20} Q${dx + 9} ${cy - 12} ${dx + 5} ${cy - 2} Q${dx - 2} ${cy - 5} ${dx - 8} ${cy - 2} Z" fill="#5a9a4a" />
        <text x="${dx}" y="${cy + 12}" text-anchor="middle" font-family="${FONT_SANS}" font-weight="800" font-size="11" fill="#1b2340">DAC</text>
        <line x1="${dx - 12}" y1="${cy + 17}" x2="${dx + 12}" y2="${cy + 17}" stroke="#8b93a5" stroke-width="0.8" />
        <line x1="${dx - 10}" y1="${cy + 20}" x2="${dx + 10}" y2="${cy + 20}" stroke="#8b93a5" stroke-width="0.8" />
      </g>`

  return `${iso}\n      ${iaf}\n      ${dac}`
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
  const title = escapeHtml(CERTIFICATE_HEADING)

  const titleText = CERTIFICATE_HEADING
  const titleFit = fitText(titleText, 560, 46, 26, 0.42)

  // Both dates share one size so they look identical.
  const dateFit = Math.min(
    Number(fitText(courseStartRaw, 250, 19, 10, 0.6).size),
    Number(fitText(courseEndRaw, 250, 19, 10, 0.6).size)
  )

  // ---- Body rows (baselines) ----
  const Y0 = 282
  const STEP = 46
  const y = (i: number) => Y0 + STEP * i

  // Row 0: Roll no
  const t0 = "Roll No."
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

  // Row 3: Course + "He / She has successfully completed"
  const t3 = "He / She has successfully completed"
  const r3a = R - width(t3)

  // Row 4: full-width justified line
  const t4 = "the prescribed course of study in Theory and Practicals at our Institute in Ramanthapur, conducted from"

  // Row 5: dates + sentence
  const t5 = "and has passed the final Examination"
  const t5w = width(t5)
  const gapTo = 26 + GAP * 4 // "to"
  const dateRuleW = Math.round((R - L - t5w - gapTo - 14) / 2)
  const d1a = L
  const d1b = d1a + dateRuleW
  const toX = d1b + GAP + 2
  const d2a = toX + 26 + GAP + 2
  const d2b = d2a + dateRuleW
  const t5x = R - t5w

  // Row 6: Division
  const t6a = "and is placed in"
  const t6b = "Division."
  const r6a = L + width(t6a)
  const r6b = R - width(t6b)

  // Photo box (inset from the frame, right edge aligned with body text)
  const PW = 132
  const PH = 170
  const PX = 926
  const PY = 78

  // Signature row: same row as the accreditation logos (logos centred at y=694)
  const LOGO_CY = 694
  const SIG_LINE = 666

  const printScript = autoPrint
    ? `<script>
(function () {
  var done = false;
  function go() { if (done) return; done = true; window.print(); }
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("italic 700 18px 'Cormorant Garamond'"),
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
    @page { size: 297mm 210mm; margin: 0; }
    html, body { width: 100%; min-height: 100%; margin: 0; padding: 0; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
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
    .value { font-family: ${FONT_SERIF}; font-style: normal; font-weight: 700; fill: #1d2a55; stroke: #1d2a55; stroke-width: 0.18px; paint-order: stroke fill; font-variant-numeric: lining-nums; letter-spacing: 0.4px; }
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

      <!-- Crisp watermark seal -->
      <g transform="translate(${CX} 408) scale(3.7) translate(-60 -60)" opacity="0.2" fill="#b8923f">
        <circle cx="60" cy="60" r="58" fill="none" stroke="#b8923f" stroke-width="0.7" />
        <circle cx="60" cy="60" r="55" fill="none" stroke="#b8923f" stroke-width="0.3" />
        <circle cx="60" cy="60" r="35.5" fill="none" stroke="#b8923f" stroke-width="0.7" />
        <circle cx="60" cy="60" r="33" fill="none" stroke="#b8923f" stroke-width="0.3" />
        <text font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="6" letter-spacing="0.9">
          <textPath href="#ringTop" startOffset="50%" text-anchor="middle">THE NEW GENERATION COMPUTERS</textPath>
        </text>
        <text font-family="Montserrat, Arial, Helvetica, sans-serif" font-weight="700" font-size="4.8" letter-spacing="0.8">
          <textPath href="#ringBottom" startOffset="50%" text-anchor="middle">ISO 9001:2015 • HYDERABAD</textPath>
        </text>
        <text x="60" y="64" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800" font-size="15" letter-spacing="1">TNGC</text>
        <path d="M54 46 L60 40 L66 46 L60 52 Z" />
      </g>

      <!-- Corner ornaments -->
      <g fill="#b8923f">
        <path d="M24 18 L30 24 L24 30 L18 24 Z" />
        <path d="M${W - 24} 18 L${W - 18} 24 L${W - 24} 30 L${W - 30} 24 Z" />
        <path d="M24 ${H - 30} L30 ${H - 24} L24 ${H - 18} L18 ${H - 24} Z" />
        <path d="M${W - 24} ${H - 30} L${W - 18} ${H - 24} L${W - 24} ${H - 18} L${W - 30} ${H - 24} Z" />
      </g>

      <!-- 35 × 45 mm passport-photo box (1123px = 297mm → 3.781 px/mm → 132.3 × 170.1 px) -->
      <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="#fff" stroke="#8b93a5" stroke-width="1.2" stroke-dasharray="5 4" />

      <!-- Header -->
      <text x="${CX}" y="104" text-anchor="middle" font-family="'Playfair Display', 'Times New Roman', Georgia, serif" font-weight="800" font-size="34" fill="#1d2a55" textLength="620" lengthAdjust="spacingAndGlyphs">${INSTITUTE_NAME}</text>
      <text x="${CX}" y="134" text-anchor="middle" font-family="${FONT_SANS}" font-weight="600" font-size="13" fill="#1b2340" textLength="400" lengthAdjust="spacing">AN ISO 9001:2015 CERTIFIED ORGANIZATION</text>
      <text x="${CX}" y="158" text-anchor="middle" font-family="${FONT_SANS}" font-weight="500" font-size="12" fill="#4a5270" textLength="340" lengthAdjust="spacing">(Recognised By Govt. of Telangana - 3106/16)</text>
      <line x1="${CX - 60}" y1="176" x2="${CX + 60}" y2="176" stroke="#b8923f" stroke-width="1" />
      <text x="${CX}" y="228" text-anchor="middle" font-family="${FONT_SCRIPT}" font-size="${titleFit.size}"${titleFit.squeeze} fill="#a61d33">${escapeHtml(titleText)}</text>

      <!-- Row 0: Roll no -->
      ${label(r0a, r0b, y(0), t0)}
      ${rule(r0b + GAP, 560, y(0))}
      ${valueText(credentialRaw, r0b + GAP, 560, y(0), 21, 10, 0.64)}

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
      <text class="label" x="${(d1b + d2a) / 2}" y="${y(5)}" text-anchor="middle" font-size="${LABEL_SIZE}">to</text>
      ${rule(d2a, d2b, y(5))}
      <text class="value" x="${(d2a + d2b) / 2}" y="${y(5)}" text-anchor="middle" font-size="${dateFit}">${escapeHtml(courseEndRaw)}</text>
      ${label(t5x, R, y(5), t5)}

      <!-- Row 6: Division -->
      ${label(L, r6a, y(6), t6a)}
      ${rule(r6a + GAP, r6b - GAP, y(6))}
      ${valueText(divisionRaw, r6a + GAP, r6b - GAP, y(6))}
      ${label(r6b, R, y(6), t6b)}

      <!-- Date (directly below main content) -->
      ${metaRow("Date :", issuedRaw, y(7))}

      <!-- Signatures (beside the accreditation logos, same row) -->
      ${signatureBlock(300, 500, SIG_LINE, "M. Nadiya", "Director")}
      ${signatureBlock(570, 770, SIG_LINE, "M. Eswara Rao", "Trainer")}

      <!-- Accreditation logos (bottom-right corner) -->
      ${accreditationLogos(R - 224, LOGO_CY)}

      <!-- Footer -->
      ${footerBar()}
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