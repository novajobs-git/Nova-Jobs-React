"use client"

import { cn } from "@/lib/utils"
import { OUTCOMES } from "@/lib/applications/stats"
import type { Outcome } from "@/lib/applications/types"
import { OUTCOME_META } from "@/components/applications/status"

interface OutcomeBarProps {
  counts: Record<Outcome, number>
  selected: Outcome | "all"
  onSelect: (outcome: Outcome | "all") => void
}

/** Largest-remainder rounding, so the legend always sums to exactly 100%. */
function roundedPercents(counts: Record<Outcome, number>, total: number): Record<Outcome, number> {
  const result = { applied: 0, in_queue: 0, needs_review: 0, failed: 0 }
  if (total === 0) return result
  const exact = OUTCOMES.map((o) => ({ o, value: (counts[o] / total) * 100 }))
  for (const { o, value } of exact) result[o] = Math.floor(value)
  let remaining = 100 - OUTCOMES.reduce((sum, o) => sum + result[o], 0)
  for (const { o } of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1))) {
    if (remaining-- <= 0) break
    result[o]++
  }
  return result
}

export function OutcomeBar({ counts, selected, onSelect }: OutcomeBarProps) {
  const total = OUTCOMES.reduce((sum, o) => sum + counts[o], 0)
  const percents = roundedPercents(counts, total)
  const toggle = (o: Outcome) => onSelect(selected === o ? "all" : o)

  return (
    <section aria-label="Outcome of every application" className="rounded-lg border bg-card p-4 md:p-5">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="presentation">
        {OUTCOMES.filter((o) => counts[o] > 0).map((o) => (
          <button
            key={o}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => toggle(o)}
            style={{ flexGrow: counts[o] }}
            className={cn(
              "h-full min-w-1.5 basis-0 cursor-pointer transition-opacity duration-200 hover:opacity-80",
              OUTCOME_META[o].fill,
              selected !== "all" && selected !== o && "opacity-25",
            )}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {OUTCOMES.map((o) => {
          const meta = OUTCOME_META[o]
          const active = selected === o
          return (
            <button
              key={o}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(o)}
              className={cn(
                "group -m-2 flex flex-col items-start rounded-md p-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground">
                <span className={cn("size-2.5 rounded-full", meta.fill)} aria-hidden />
                {meta.label}
              </span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{counts[o]}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {percents[o]}%
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
