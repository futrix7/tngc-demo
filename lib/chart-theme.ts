export const CHART_COLORS = {
  primary: "#22c55e",
  emerald: "#22c55e",
  violet: "#8b5cf6",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  rose: "#ef4444",
  indigo: "#4f46e5",
  slate: "#64748b",
}

export const CHART_PALETTE = [
  "#22c55e",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#4f46e5",
]

export const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--card, #ffffff)",
  color: "var(--card-foreground, #1a1a1a)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: "0.75rem",
  padding: "0.5rem 0.75rem",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
}

export const axisStyle = {
  fontSize: 11,
  fill: "var(--muted-foreground, #888)",
}

export const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "var(--border, #e5e7eb)",
}

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}
