"use client"

import { useApplications } from "@/components/applications/applications-provider"
import { SparkAreaChart } from "@/components/charts/spark-chart"
import { appliedPerDay } from "@/lib/applications/stats"

const DAYS = 30

/**
 * Submitted applications per day. The spark chart has no axes of its own, so
 * the date axis (horizontal) and count axis (vertical) are labeled around it.
 */
export function ApplicationsByDay() {
  const { applications } = useApplications()
  const days = appliedPerDay(applications, new Date(), DAYS)
  const total = days.reduce((sum, d) => sum + d.value, 0)
  const peak = Math.max(...days.map((d) => d.value))
  const xTicks = [days[0], days[Math.floor(days.length / 2)], days.at(-1)!]

  return (
    <section aria-labelledby="by-day-title" className="border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-3 md:px-5">
        <h2 id="by-day-title" className="text-base font-semibold">
          Applications by day
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{total}</span> in the last {DAYS} days
        </p>
      </header>

      <div className="px-4 pt-5 pb-4 md:px-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
          <div className="flex h-56 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
            <span>{peak}</span>
            <span>0</span>
          </div>
          <div className="relative">
            <SparkAreaChart
              data={days}
              index="label"
              categories={["value"]}
              colors={["blue"]}
              fill="gradient"
              maxValue={Math.max(peak, 1)}
              className="h-56 w-full"
              role="img"
              aria-label={`Applications submitted per day over the last ${DAYS} days: ${total} in total.`}
            />
            {total === 0 && (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                No applications sent yet. Each one shows here on the day it&rsquo;s submitted.
              </p>
            )}
          </div>
          <div className="col-start-2 mt-2 flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden>
            {xTicks.map((d) => (
              <span key={d.date}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
