import type { Application, ApplicationStatus, Ats, Outcome } from "./types"

export const OUTCOMES: Outcome[] = ["applied", "in_queue", "needs_review", "failed"]

export function outcomeOf(status: ApplicationStatus): Outcome {
  return status === "queued" || status === "applying" ? "in_queue" : status
}

export function countByOutcome(apps: Application[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { applied: 0, in_queue: 0, needs_review: 0, failed: 0 }
  for (const app of apps) counts[outcomeOf(app.status)]++
  return counts
}

const DAY = 24 * 60 * 60 * 1000

export function appliedSince(apps: Application[], now: Date, days: number): number {
  const cutoff = now.getTime() - days * DAY
  return apps.filter((a) => a.status === "applied" && Date.parse(a.updatedAt) >= cutoff).length
}

export interface DailyActivity {
  date: string
  label: string
  applied: number
  needs_review: number
  failed: number
}

/** Finished attempts per day, oldest first. In-queue items have no outcome yet. */
export function dailyActivity(apps: Application[], now: Date, days: number): DailyActivity[] {
  const buckets: DailyActivity[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      applied: 0,
      needs_review: 0,
      failed: 0,
    })
  }
  for (const app of apps) {
    const outcome = outcomeOf(app.status)
    if (outcome === "in_queue") continue
    const bucket = buckets.find((b) => b.date === app.updatedAt.slice(0, 10))
    if (bucket) bucket[outcome]++
  }
  return buckets
}

export interface AtsBreakdown {
  ats: Ats
  applied: number
  attempted: number
}

/** Success rate per ATS, so the candidate can see where applications stall. */
export function byAts(apps: Application[]): AtsBreakdown[] {
  const map = new Map<Ats, AtsBreakdown>()
  for (const app of apps) {
    if (outcomeOf(app.status) === "in_queue") continue
    const row = map.get(app.ats) ?? { ats: app.ats, applied: 0, attempted: 0 }
    row.attempted++
    if (app.status === "applied") row.applied++
    map.set(app.ats, row)
  }
  return [...map.values()].sort((a, b) => b.attempted - a.attempted)
}

export function relativeTime(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days}d ago`
}
