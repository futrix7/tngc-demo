"use client"

import { FileSpreadsheet, FileText, Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows?: Record<string, unknown>[]
  filename?: string
}

const exportOptions = [
  {
    id: "csv",
    name: "CSV",
    description: "Comma-separated values",
    icon: FileSpreadsheet,
  },
  {
    id: "excel",
    name: "Excel",
    description: "Microsoft Excel format",
    icon: FileSpreadsheet,
  },
  {
    id: "pdf",
    name: "PDF",
    description: "PDF document format",
    icon: FileText,
  },
  {
    id: "print",
    name: "Print",
    description: "Print directly",
    icon: Printer,
  },
]

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const str = value == null ? "" : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = [headers.join(",")]
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(","))
  })
  return lines.join("\n")
}

function buildPrintHtml(rows: Record<string, unknown>[], title: string) {
  if (rows.length === 0) {
    return `<html><head><title>${title}</title></head><body><p>No data available to export.</p></body></html>`
  }
  const headers = Object.keys(rows[0])
  const escapeHtml = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`
    )
    .join("")
  return `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; color: #0a0a0a; }
h1 { font-size: 18px; margin-bottom: 16px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border: 1px solid #d4d4d4; padding: 6px 10px; text-align: left; }
th { background: #f4f4f5; }
</style></head>
<body>
<h1>${title}</h1>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body></html>`
}

function showPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

export function ExportDialog({ open, onOpenChange, rows, filename = "export" }: ExportDialogProps) {
  const data = rows || []
  const title = filename.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())

  function handleExport(format: string) {
    if (format === "csv" || format === "excel") {
      const csv = toCsv(data)
      if (!csv) {
        window.alert("No data available to export.")
        onOpenChange(false)
        return
      }
      const ext = format === "excel" ? "xls" : "csv"
      const mime = format === "excel" ? "application/vnd.ms-excel" : "text/csv"
      downloadBlob("\ufeff" + csv, mime, `${filename}.${ext}`)
    } else {
      showPrintWindow(buildPrintHtml(data, title))
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Choose your preferred export format
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {exportOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleExport(option.id)}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-input p-4 text-center transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                <Icon className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium">{option.name}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}