"use client"

import { useState } from "react"

import { ApplicationDetail, ApplicationTable } from "@/components/applications/application-table"
import { useApplications } from "@/components/applications/applications-provider"

/** Failed and needs-review applications, in the same table and detail panel as the Workbench. */
export function NeedsReview() {
  const { applications } = useApplications()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const items = applications
    .filter((a) => a.status === "failed" || a.status === "needs_review")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const selected = items.find((a) => a.id === selectedId) ?? null

  return (
    <section aria-labelledby="review-title" className="border bg-card">
      <header className="flex items-baseline justify-between gap-4 border-b px-4 py-3 md:px-6">
        <h2 id="review-title" className="text-base font-semibold">
          Needs your review
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {items.length} {items.length === 1 ? "application" : "applications"}
        </p>
      </header>
      <div className="relative flex min-h-48">
        <ApplicationTable
          items={items}
          selectedId={selected?.id ?? null}
          compact={!!selected}
          onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          placeInLine={() => null}
          empty="Nothing needs your review. Applications that fail or need an answer from you show up here."
          className="bg-card"
        />
        {selected && <ApplicationDetail key={selected.id} app={selected} place={null} onClose={() => setSelectedId(null)} />}
      </div>
    </section>
  )
}
