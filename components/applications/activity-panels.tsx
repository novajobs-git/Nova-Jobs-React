"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AtsBreakdown, DailyActivity } from "@/lib/applications/stats"

const chartConfig = {
  applied: { label: "Applied", color: "var(--success)" },
  needs_review: { label: "Needs review", color: "var(--needs-review)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig

export function ActivityPanels({ daily, ats }: { daily: DailyActivity[]; ats: AtsBreakdown[] }) {
  const finished = daily.reduce((sum, d) => sum + d.applied + d.needs_review + d.failed, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section aria-labelledby="activity-heading" className="rounded-lg border bg-card p-4 md:p-5 lg:col-span-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="activity-heading" className="text-base font-semibold">Last 14 days</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{finished} finished attempts</p>
        </div>
        <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-52 w-full">
          <BarChart data={daily} margin={{ left: -20, right: 0, top: 4 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis allowDecimals={false} domain={[0, "dataMax + 1"]} tickLine={false} axisLine={false} width={40} />
            <ChartLegend content={<ChartLegendContent />} verticalAlign="top" align="left" wrapperStyle={{ paddingBottom: 12, paddingLeft: 20 }} />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
            <Bar dataKey="applied" stackId="a" fill="var(--color-applied)" isAnimationActive={false} />
            <Bar dataKey="needs_review" stackId="a" fill="var(--color-needs_review)" isAnimationActive={false} />
            <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </section>

      <section aria-labelledby="ats-heading" className="rounded-lg border bg-card p-4 md:p-5">
        <h2 id="ats-heading" className="text-base font-semibold">Success by ATS</h2>
        <p className="mt-1 text-sm text-muted-foreground">Where finished applications went through.</p>
        <ul className="mt-5 space-y-4">
          {ats.map((row) => {
            const rate = Math.round((row.applied / row.attempted) * 100)
            return (
              <li key={row.ats}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{row.ats}</span>
                  <span className="text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground">{rate}%</span> · {row.applied} of {row.attempted}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-none bg-muted" role="presentation">
                  <div className="h-full rounded-none bg-success" style={{ width: `${rate}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
