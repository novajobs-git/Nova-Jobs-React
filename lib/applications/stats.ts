import type { Application } from "./types"

const DAY = 24 * 60 * 60 * 1000

export interface DayCount {
  /** yyyy-mm-dd, local time. */
  date: string
  /** e.g. "Oct 5". */
  label: string
  value: number
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Submitted applications per day for the last `days` days, oldest first. */
export function appliedPerDay(apps: Application[], now: Date, days: number): DayCount[] {
  const buckets: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY)
    buckets.push({ date: localDate(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: 0 })
  }
  const byDate = new Map(buckets.map((b) => [b.date, b]))
  for (const app of apps) {
    if (app.status !== "applied") continue
    const bucket = byDate.get(localDate(new Date(app.updatedAt)))
    if (bucket) bucket.value++
  }
  return buckets
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
