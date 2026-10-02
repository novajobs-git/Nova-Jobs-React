"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { useApplications } from "@/components/applications/applications-provider"
import { JobsTable } from "@/components/jobs/jobs-table"
import { TopMatches } from "@/components/jobs/top-matches"
import { DEMO_CANDIDATE } from "@/lib/applications/mock-data"
import { cn } from "@/lib/utils"
import type { Job } from "@/lib/jobs/types"

const TOP_COUNT = 4

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

// Uses the viewer's clock; the server render falls back to a neutral greeting.
function useGreeting() {
  return useSyncExternalStore(
    () => () => {},
    () => greetingFor(new Date().getHours()),
    () => "Welcome back",
  )
}

export function JobsView({ jobs, firstName }: { jobs: Job[]; firstName: string }) {
  const { applications, autoApply } = useApplications()
  const greeting = useGreeting()
  const byJob = new Map(applications.map((a) => [a.jobId, a]))
  const applicationFor = (job: Job) => byJob.get(job.id)

  // Picked once on arrival, so a card stays put (showing "Queued") after Apply.
  const [top] = useState(() => jobs.filter((j) => !byJob.has(j.id)).slice(0, TOP_COUNT))

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight font-bold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <span className="mt-2 inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary-hover">
            {DEMO_CANDIDATE.plan}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] font-medium",
              autoApply ? "border-success/25 bg-success/10 text-success-text" : "border-border bg-card text-muted-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", autoApply ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
            {autoApply ? "Auto-Apply active" : "Auto-Apply paused"}
          </span>
          <Link
            href="/applications"
            className="inline-flex h-10 items-center rounded-full border bg-card px-4 text-[15px] font-medium text-foreground/75 transition-colors hover:text-foreground"
          >
            View analytics
          </Link>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-6">
        <TopMatches jobs={top} total={jobs.length} applicationFor={applicationFor} />
        <JobsTable jobs={jobs} applicationFor={applicationFor} />
      </div>
    </>
  )
}
