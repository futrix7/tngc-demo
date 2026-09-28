import { Eye, EyeOff } from "lucide-react"

type PasswordVisibilityToggleProps = {
  visible: boolean
  label: string
  onToggle: () => void
  disabled?: boolean
}

export function PasswordVisibilityToggle({
  visible,
  label,
  onToggle,
  disabled = false,
}: PasswordVisibilityToggleProps) {
  const action = visible ? "Hide" : "Show"

  return (
    <button
      type="button"
      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`${action} ${label}`}
      aria-pressed={visible}
      title={`${action} ${label}`}
      onClick={onToggle}
      disabled={disabled}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  )
}