"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { useApplications } from "@/components/applications/applications-provider"
import { RelaxedNotice } from "@/components/jobs/job-parts"
import { JobsTable } from "@/components/jobs/jobs-table"
import { TopMatches } from "@/components/jobs/top-matches"
import type { Job } from "@/lib/jobs/types"
import type { Relaxation } from "@/lib/matching/structured"

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

export function JobsView({ jobs, relaxed, firstName }: { jobs: Job[]; relaxed: Relaxation[]; firstName: string }) {
  const { applications } = useApplications()
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
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-none border bg-card px-4 text-[15px] font-medium text-foreground/75 transition-colors hover:text-foreground"
          >
            View analytics
          </Link>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-6">
        {relaxed.length > 0 && <RelaxedNotice relaxed={relaxed} />}
        <TopMatches jobs={top} total={jobs.length} applicationFor={applicationFor} />
        <JobsTable jobs={jobs} applicationFor={applicationFor} />
      </div>
    </>
  )
}
