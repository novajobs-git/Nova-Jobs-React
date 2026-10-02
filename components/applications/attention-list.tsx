"use client"

import { useState } from "react"
import { ChevronDownIcon, CircleCheckIcon, ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { StatusLabel } from "@/components/applications/status"
import { DEMO_NOW } from "@/lib/applications/mock-data"
import { relativeTime } from "@/lib/applications/stats"
import type { Application, ResolutionAction } from "@/lib/applications/types"

const ACTION_LABEL: Record<ResolutionAction, string> = {
  retry: "Retry",
  answer: "Answer question",
  update_profile: "Update profile",
  dismiss: "Dismiss",
}

// Until the queue API exists (spec 004), actions only confirm what they will do.
const ACTION_TOAST: Record<ResolutionAction, (app: Application) => string> = {
  retry: (a) => `${a.role} at ${a.company} will go back into the queue.`,
  answer: (a) => `Your answer will be saved and ${a.company} re-queued.`,
  update_profile: () => "This will open your profile at the missing field.",
  dismiss: (a) => `${a.company} will be removed from this list.`,
}

const COLLAPSED_COUNT = 4

export function AttentionList({ items }: { items: Application[] }) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-lg border bg-card px-4 py-4 md:px-5">
        <CircleCheckIcon className="size-5 text-success" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">All clear.</span>{" "}
          <span className="text-muted-foreground">Every finished application went through.</span>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="attention-heading" className="rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-4 border-b px-4 py-3 md:px-5">
        <h2 id="attention-heading" className="text-base font-semibold">
          Needs your attention
        </h2>
        <p className="hidden text-sm text-muted-foreground sm:block">Nothing is submitted until these are resolved.</p>
      </div>
      <ul className="divide-y">
        {(expanded ? items : items.slice(0, COLLAPSED_COUNT)).map((app) => {
          const action = app.resolution ?? "retry"
          return (
            <li key={app.id} className="grid gap-3 px-4 py-4 md:grid-cols-[8rem_1fr_auto] md:gap-5 md:px-5">
              <div className="flex items-center justify-between md:block">
                <StatusLabel status={app.status} />
                <p className="text-xs text-muted-foreground tabular-nums md:mt-1">{relativeTime(app.updatedAt, DEMO_NOW)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {app.role} <span className="font-normal text-muted-foreground">· {app.company}</span>
                </p>
                <p className="mt-1 max-w-[75ch] text-sm text-pretty text-foreground/80">{app.reason}</p>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <Button
                  size="sm"
                  variant={action === "dismiss" ? "outline" : "default"}
                  className={action === "dismiss" ? "bg-card" : undefined}
                  onClick={() => toast(ACTION_LABEL[action], { description: ACTION_TOAST[action](app) })}
                >
                  {ACTION_LABEL[action]}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={app.postingUrl} target="_blank" rel="noreferrer">
                    Posting <ExternalLinkIcon data-icon="inline-end" />
                  </a>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {items.length > COLLAPSED_COUNT && (
        <div className="border-t px-4 py-2 md:px-5">
          <Button variant="ghost" size="sm" className="-ml-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show all ${items.length}`}
            <ChevronDownIcon data-icon="inline-end" className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
          </Button>
        </div>
      )}
    </section>
  )
}
