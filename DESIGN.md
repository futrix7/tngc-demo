# Design System

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, RSC enabled) |
| UI Primitives | `@base-ui/react` |
| Styling | Tailwind CSS v4 + `tw-animate-css` |
| Component Library | shadcn/ui v4 (`base-nova` style) |
| Variant Engine | `class-variance-authority` (cva) |
| Class Merging | `clsx` + `tailwind-merge` via `cn()` |
| Icons | `lucide-react` |
| Color Space | oklch |

---

## Color Tokens

All colors are defined as CSS custom properties in `app/globals.css` and mapped to Tailwind via `@theme inline`.

### Semantic Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Default text |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card/surface bg |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Card text |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Popover/dropdown bg |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Popover text |
| `--primary` | `oklch(0.508 0.118 165.612)` | `oklch(0.432 0.095 166.913)` | Primary actions (green) |
| `--primary-foreground` | `oklch(0.979 0.021 166.113)` | `oklch(0.979 0.021 166.113)` | Text on primary |
| `--secondary` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.21 0.006 285.885)` | `oklch(0.985 0 0)` | Text on secondary |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Subtle/secondary text |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Accent highlights |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error/danger states |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Default borders |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Input field borders |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus rings |

### Rules

- Never use raw color values (`bg-white`, `text-black`) in components. Always use semantic tokens (`bg-card`, `text-foreground`).
- Destructive uses reduced opacity in light mode (`bg-destructive/10`) and full opacity in dark mode (`dark:bg-destructive/20`).
- Borders use `ring-1 ring-foreground/10` for subtle card/surface outlines.

---

## Typography

### Font Stack

| Variable | Font | Usage |
|----------|------|-------|
| `--font-sans` | Instrument Sans | Body text, UI labels, headings |
| `--font-heading` | Instrument Sans | Card titles, dialog titles, section headings |
| `--font-geist-mono` | Geist Mono | Code blocks, monospace content |

### Type Scale

| Element | Classes |
|---------|---------|
| Page heading | `text-3xl font-semibold leading-10 tracking-tight` |
| Card/Dialog title | `font-heading text-base leading-snug font-medium` |
| Body text | `text-sm` |
| Description/subtitle | `text-sm text-muted-foreground` |
| Label | `text-sm leading-none font-medium` |
| Badge/tag | `text-xs font-medium` |
| Small/detail | `text-xs` |

### Rules

- Body default is `text-sm` across all UI components.
- Use `font-heading` for section/card titles (resolves to Instrument Sans).
- Muted/secondary text always uses `text-muted-foreground`.

---

## Spacing & Layout

### Border Radius

Base radius: `0.625rem` (`--radius`)

| Token | Calculation | Value |
|-------|-------------|-------|
| `--radius-sm` | `var(--radius) * 0.6` | `0.375rem` |
| `--radius-md` | `var(--radius) * 0.8` | `0.5rem` |
| `--radius-lg` | `var(--radius)` | `0.625rem` |
| `--radius-xl` | `var(--radius) * 1.4` | `0.875rem` |
| `--radius-2xl` | `var(--radius) * 1.8` | `1.125rem` |

### Radius Conventions

| Component | Radius |
|-----------|--------|
| Buttons (default) | `rounded-lg` |
| Buttons (xs, sm) | `rounded-[min(var(--radius-md),Npx)]` |
| Inputs | `rounded-lg` |
| Cards | `rounded-xl` |
| Badges | `rounded-4xl` (pill) |
| Select content | `rounded-lg` |
| Dialog content | `rounded-xl` |
| Sheet content | no explicit radius (edge-anchored) |
| Drawer popup | `rounded-t-xl` (bottom), directional variants |

### Component Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Card (default) | `py-(--card-spacing)` / `px-(--card-spacing)` where `--card-spacing: --spacing(4)` | `gap-(--card-spacing)` |
| Card (sm) | `--card-spacing: --spacing(3)` | `gap-(--card-spacing)` |
| Dialog content | `p-4` | `gap-4` |
| Sheet header | `p-4` | `gap-0.5` |
| Drawer header | `p-4 pb-0` | `gap-0.5` |
| Button (default) | `px-2.5` | `gap-1.5` |

---

## Component Architecture

### File Structure

```
components/
  ui/           # shadcn/ui base components
    button.tsx
    card.tsx
    alert.tsx
    badge.tsx
    input.tsx
    label.tsx
    progress.tsx
    select.tsx
    sheet.tsx
    drawer.tsx
    dialog.tsx
    switch.tsx
```

### Pattern: Component Authoring

Every UI component follows this structure:

```tsx
import { cn } from "@/lib/utils"

function ComponentName({
  className,
  ...props
}: React.ComponentProps<"element">) {
  return (
    <element
      data-slot="component-name"
      className={cn("base-classes", className)}
      {...props}
    />
  )
}

export { ComponentName }
```

### Rules

1. **`data-slot` attribute**: Every component and sub-component MUST have a `data-slot` attribute matching its kebab-case name. This is used for CSS selectors and parent-child styling.

2. **`cn()` utility**: Always wrap className through `cn()` to allow consumer overrides via tailwind-merge.

3. **Spread props**: Always spread remaining props onto the root element.

4. **`className` last**: The `cn()` call merges base styles with the consumer's `className`, letting consumers override anything.

5. **No forwardRef**: Use function components directly. React 19 forwards refs automatically.

6. **`"use client"` directive**: Add only when the component uses hooks, event handlers, or browser APIs. Pure layout components (Card, Alert) do not need it.

### Variant Pattern (cva)

For components with visual variants, use `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const componentVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border-border bg-background",
      // ...
    },
    size: {
      default: "h-8 px-2.5",
      sm: "h-7 px-2",
      // ...
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})
```

Export both the component and the variants object for external reuse.

### Compound Component Pattern

For components with sub-parts (Card, Dialog, Sheet, Drawer), export individual named functions:

```tsx
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```

Each sub-component gets its own `data-slot` (e.g., `data-slot="card-header"`).

---

## Focus & Interaction States

### Focus Ring Pattern

All interactive elements use this focus-visible pattern:

```
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

### Disabled State

```
disabled:pointer-events-none disabled:opacity-50
```

For form elements with cursor:
```
disabled:cursor-not-allowed disabled:opacity-50
```

### Aria-Invalid (Form Validation)

```
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40
```

### Active Pressed

```
active:not-aria-[haspopup]:translate-y-px
```

---

## Dark Mode

### Mechanism

Class-based dark mode via `.dark` class on a parent element.

```css
@custom-variant dark (&:is(.dark *));
```

### Convention

- Use Tailwind's `dark:` prefix for dark-mode overrides.
- Common overrides:
  - `dark:bg-input/30` (transparent inputs in dark mode)
  - `dark:hover:bg-input/50`
  - `dark:aria-invalid:border-destructive/50`
  - `dark:data-unchecked:bg-input/80` (switch unchecked state)

---

## Animation & Transitions

### Library

`tw-animate-css` provides utility animation classes.

### State Animations

Components use data-attribute driven animations:

```
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
```

### Transition Timing

| Component | Duration | Easing |
|-----------|----------|--------|
| Dialog overlay | `duration-100` | default |
| Dialog content | `duration-100` | default |
| Sheet | `duration-200` | `ease-in-out` |
| Drawer | `duration-450` | `cubic-bezier(0.22,1,0.36,1)` |
| Progress indicator | `transition-all` | default |

### Overlay Pattern

All overlays (Dialog, Sheet, Drawer) use:
```
bg-black/10 supports-backdrop-filter:backdrop-blur-xs
```

---

## SVG & Icon Rules

- Icons from `lucide-react` only.
- Default icon size in components: `size-4` via `[&_svg:not([class*='size-'])]:size-4`.
- Icons in buttons/badges: `[&_svg]:pointer-events-none [&_svg]:shrink-0`.
- Close buttons use `XIcon` with `sr-only` label for accessibility.

---

## Responsive Behavior

- Base layout is mobile-first.
- Dialog: `w-full max-w-[calc(100%-2rem)]` mobile, `sm:max-w-sm` desktop.
- Sheet: `w-3/4` mobile, `sm:max-w-sm` for left/right sides.
- Grid layouts use `@container` queries where appropriate (e.g., CardHeader).

---

## Accessibility

- All interactive elements have visible focus rings.
- Close buttons include `<span className="sr-only">Close</span>`.
- Form elements use `aria-invalid` for validation feedback.
- Buttons use `aria-expanded` for toggle states.
- Dialog/Sheet/Drawer use proper `role` attributes via Base UI primitives.
- Labels use `peer-disabled:opacity-50` pattern for associated input states.

---

## Adding a New Component

1. Create file in `components/ui/kebab-case-name.tsx`.
2. Import `cn` from `@/lib/utils`.
3. Add `data-slot="component-name"` to root element.
4. Wrap className with `cn()`.
5. If variants exist, use `cva` and export the variants object.
6. If compound, export each sub-component with its own `data-slot`.
7. Use semantic color tokens only (`bg-card`, `text-foreground`, etc.).
8. Follow focus/disabled/aria-invalid patterns from existing components.
9. Add `"use client"` only if needed (hooks/events/browser APIs).
