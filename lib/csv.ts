/**
 * Parse CSV records, including quoted delimiters, escaped quotes, and
 * line breaks inside quoted fields.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (quoted) {
        quoted = false
      } else if (field.length === 0) {
        quoted = true
      } else {
        throw new Error(`Unexpected quote at character ${index + 1}.`)
      }
      continue
    }

    if (!quoted && character === ",") {
      record.push(field)
      field = ""
      continue
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index++
      record.push(field)
      if (record.some((value) => value.trim() !== "")) records.push(record)
      record = []
      field = ""
      continue
    }

    field += character
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.")
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    if (record.some((value) => value.trim() !== "")) records.push(record)
  }

  if (records.length === 0) return []

  const headers = records[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim()
  )
  if (headers.some((header) => !header)) {
    throw new Error("CSV contains an empty column name.")
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate column names.")
  }

  return records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`
      )
    }

    return Object.fromEntries(headers.map((header, column) => [header, values[column]]))
  })
}