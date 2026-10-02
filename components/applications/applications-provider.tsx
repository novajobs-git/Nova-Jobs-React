"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

import { DEMO_NOW } from "@/lib/applications/mock-data"
import type { Application } from "@/lib/applications/types"
import type { Job } from "@/lib/jobs/types"

interface ApplicationsContextValue {
  applications: Application[]
  /** Queues the job; returns its place in line (1 = next after the one applying). */
  apply: (job: Job) => number
  /** Demo-only switch from the top bar; autonomous apply is not built yet. */
  autoApply: boolean
  setAutoApply: (on: boolean) => void
}

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null)

/*
 * Client-side stand-in for the queue API (spec 008): Apply adds a queued
 * row here so the Jobs page, Applications page and Workbench all agree.
 * State resets on reload.
 */
export function ApplicationsProvider({ initial, children }: { initial: Application[]; children: React.ReactNode }) {
  const [applications, setApplications] = useState(initial)
  const [autoApply, setAutoApply] = useState(true)

  const apply = useCallback(
    (job: Job) => {
      if (applications.some((a) => a.jobId === job.id)) {
        return applications.filter((a) => a.status === "queued").length
      }
      // Offset by the list length so jobs queued in one session keep their click order.
      const now = new Date(DEMO_NOW.getTime() + applications.length).toISOString()
      const queued: Application = {
        id: `app_local_${job.id}`,
        jobId: job.id,
        company: job.company,
        role: job.role,
        location: job.location,
        ats: job.ats,
        matchScore: job.matchScore,
        sponsorship: job.sponsorship,
        status: "queued",
        queuedAt: now,
        updatedAt: now,
        postingUrl: job.postingUrl,
      }
      setApplications([queued, ...applications])
      return applications.filter((a) => a.status === "queued").length + 1
    },
    [applications],
  )

  const value = useMemo(() => ({ applications, apply, autoApply, setAutoApply }), [applications, apply, autoApply])
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>
}

export function useApplications() {
  const ctx = useContext(ApplicationsContext)
  if (!ctx) throw new Error("useApplications must be used within ApplicationsProvider")
  return ctx
}

/** Queued jobs in the order they'll be worked on. */
export function queueOrder(applications: Application[]): Application[] {
  return applications
    .filter((a) => a.status === "queued")
    .sort((a, b) => Date.parse(a.queuedAt) - Date.parse(b.queuedAt))
}
