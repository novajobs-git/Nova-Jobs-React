"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ChipInputProps {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  invalid?: boolean
}

/** Type and press Enter (or comma) to add; click × to remove. */
export function ChipInput({ id, value, onChange, placeholder, invalid }: ChipInputProps) {
  const [draft, setDraft] = useState("")

  const add = (raw: string) => {
    const item = raw.trim().replace(/,$/, "")
    if (item && !value.some((v) => v.toLowerCase() === item.toLowerCase())) onChange([...value, item])
    setDraft("")
  }

  return (
    <div>
      <Input
        id={id}
        value={draft}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add(draft)
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft && add(draft)}
        className="h-11 bg-card"
      />
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item}>
              <Chip label={item} onRemove={() => onChange(value.filter((v) => v !== item))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Chip({ label, onRemove, className }: { label: string; onRemove?: () => void; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-none border border-primary/20 bg-primary/8 pr-1 pl-3 text-sm font-medium text-primary-hover",
        !onRemove && "pr-3",
        className,
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="flex size-6 items-center justify-center rounded-none text-primary-hover/70 hover:bg-primary/15 hover:text-primary-hover"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </span>
  )
}
