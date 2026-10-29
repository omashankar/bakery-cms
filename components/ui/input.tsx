"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Whether what the person has typed still stands for the value the form
 * holds. An empty box stands for anything — the form turned "" into 0 or a
 * default, and showing that number back would refill the box on every
 * Backspace. "24." and "1.50" stand for 24 and 1.5 the same way.
 */
function draftStandsFor(draft: string, value: unknown): boolean {
  if (draft.trim() === "" || draft === String(value)) return true
  const typed = Number(draft)
  return Number.isFinite(typed) && typed === Number(value)
}

function Input({
  className,
  type,
  value,
  onChange,
  onBlur,
  ...props
}: React.ComponentProps<"input">) {
  /*
    A number box the form parses on every keystroke cannot be emptied: Backspace
    on "0" makes "", the form stores Number("") || 0 = 0, and React writes "0"
    straight back. So while the person types, the box shows their own text; the
    form's number takes over again on blur, or as soon as it disagrees with the
    text (a clamp, a reset after save). Every numeric box in the app gets this
    here rather than each form keeping its own string state.
  */
  const [draft, setDraft] = React.useState<string | null>(null)
  const numeric =
    type === "number" || props.inputMode === "decimal" || props.inputMode === "numeric"
  const controlled = value !== undefined
  const shown =
    numeric && controlled && draft !== null && draftStandsFor(draft, value) ? draft : value

  return (
    <InputPrimitive
      type={type}
      value={shown}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        if (numeric && controlled) setDraft(event.target.value)
        onChange?.(event)
      }}
      onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
        setDraft(null)
        onBlur?.(event)
      }}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-foreground/55 disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-muted/50 dark:disabled:bg-muted dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
