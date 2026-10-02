"use client"

import { useState } from "react"

import { ActivityPanels } from "@/components/applications/activity-panels"
import { useApplications } from "@/components/applications/applications-provider"
import { AttentionList } from "@/components/applications/attention-list"
import { HistoryTable } from "@/components/applications/history-table"
import { OutcomeBar } from "@/components/applications/outcome-bar"
import { DEMO_NOW } from "@/lib/applications/mock-data"
import { appliedSince, byAts, countByOutcome, dailyActivity } from "@/lib/applications/stats"
import type { Outcome } from "@/lib/applications/types"

export function ApplicationsView() {
  const { applications } = useApplications()
  const [outcome, setOutcome] = useState<Outcome | "all">("all")

  const counts = countByOutcome(applications)
  const attention = applications.filter((a) => a.status === "needs_review" || a.status === "failed")
  const applying = applications.find((a) => a.status === "applying")
  const sentThisWeek = appliedSince(applications, DEMO_NOW, 7)

  const selectFromBar = (next: Outcome | "all") => {
    setOutcome(next)
    if (next !== "all") document.getElementById("history")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      })
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="mt-1.5 text-pretty text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{sentThisWeek} sent</span> this week.{" "}
          {attention.length > 0 ? (
            <span className="font-medium text-destructive tabular-nums">
              {attention.length} need{attention.length === 1 ? "s" : ""} you.
            </span>
          ) : (
            "Nothing needs you."
          )}{" "}
          {applying && <>Applying to {applying.company} now.</>}
        </p>
      </header>
      <div className="flex min-w-0 flex-col gap-4">
        <OutcomeBar counts={counts} selected={outcome} onSelect={selectFromBar} />
        <ActivityPanels daily={dailyActivity(applications, DEMO_NOW, 14)} ats={byAts(applications)} />
        <AttentionList items={attention} />
        <HistoryTable applications={applications} counts={counts} outcome={outcome} onOutcomeChange={setOutcome} />
      </div>
    </>
  )
}
