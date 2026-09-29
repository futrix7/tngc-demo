export function normalizeIndianPhone(phone: string): { nationalNumber: string; e164: string } | null {
  const digits = phone.replace(/\D/g, "")
  const nationalNumber = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits

  if (!/^\d{10}$/.test(nationalNumber)) return null

  return { nationalNumber, e164: `+91${nationalNumber}` }
}