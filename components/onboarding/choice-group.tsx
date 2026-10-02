"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface ChoiceGroupProps {
  name: string
  options: readonly string[]
  value: string | undefined
  onChange: (value: string) => void
  /** Visible label for the group; omitted when the step title already asks the question. */
  label?: string
  invalid?: boolean
  size?: "lg" | "md"
}

/** Large, whole-row-clickable radio options. */
export function ChoiceGroup({ name, options, value, onChange, label, invalid, size = "md" }: ChoiceGroupProps) {
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={onChange}
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={cn("gap-2.5", size === "lg" && "gap-3")}
    >
      {options.map((option) => {
        const id = `${name}-${option.replace(/\W+/g, "-")}`
        const checked = value === option
        return (
          <label
            key={option}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 text-[15px] transition-colors hover:border-primary/40",
              size === "lg" ? "min-h-14 font-medium" : "min-h-12 py-2.5",
              checked && "border-primary bg-primary/5 ring-1 ring-primary",
              invalid && !value && "border-destructive/50",
            )}
          >
            <RadioGroupItem id={id} value={option} />
            {option}
          </label>
        )
      })}
    </RadioGroup>
  )
}
