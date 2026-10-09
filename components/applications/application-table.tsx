"use client"

import { useState } from "react"
import { BanIcon, ExternalLinkIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useApplications } from "@/components/applications/applications-provider"
import { StatusLabel } from "@/components/applications/status"
import { CompanyLogo } from "@/components/jobs/job-parts"
import { relativeTime } from "@/lib/applications/stats"
import { ACTIVE_STATUSES, type Application } from "@/lib/applications/types"
import { cn } from "@/lib/utils"

/*
 * The Stripe-style application table and its right-hand detail panel, shared
 * by the Workbench (Auto-Apply Queue) and the Dashboard's "Needs your review".
 */

const SPONSORSHIP: Record<Application["sponsorship"], string> = {
  offered: "Offered",
  not_offered: "Not offered",
  unknown: "Not stated in the posting",
}

const fullTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })

export function IconButton({ label, onClick, children, disabled, className }: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled} className={cn("text-muted-foreground hover:text-foreground", className)}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

interface ApplicationTableProps {
  /** The surface the table sits on; its sticky header matches it. */
  className?: string
  items: Application[]
  selectedId: string | null
  /** A detail panel is open: show fewer columns. */
  compact: boolean
  onSelect: (id: string) => void
  placeInLine: (app: Application) => number | null
  empty: string
  /** Pause / resume / cancel icons on queued, applying and paused rows. */
  withControls?: boolean
}

export function ApplicationTable({ items, selectedId, compact, onSelect, placeInLine, empty, withControls, className = "bg-popover" }: ApplicationTableProps) {
  if (items.length === 0) {
    return <p className="flex-1 px-4 py-12 text-center text-sm text-muted-foreground md:px-6">{empty}</p>
  }

  // Columns appear by available width, so the table stays readable beside the detail panel.
  const cols = cn(
    "grid items-center gap-x-4",
    compact
      ? "grid-cols-[minmax(0,1fr)_8rem] @2xl:grid-cols-[minmax(0,1fr)_8rem_4rem]"
      : "grid-cols-[minmax(0,1fr)_8rem] @2xl:grid-cols-[minmax(0,1fr)_8rem_4rem_7rem] @5xl:grid-cols-[minmax(0,1fr)_8rem_4rem_7rem_minmax(0,12rem)_6rem]",
  )
  const show = {
    match: "hidden @2xl:block",
    ats: compact ? "hidden" : "hidden @2xl:block",
    location: compact ? "hidden" : "hidden @5xl:block",
    updated: compact ? "hidden" : "hidden @5xl:block",
  }

  return (
    <div className={cn("@container min-w-0 flex-1 overflow-y-auto", className)}>
      <div className={cn(cols, "sticky top-0 z-10 border-b bg-inherit px-4 py-2.5 text-sm font-semibold md:px-6", withControls && "pr-24 md:pr-24")} role="presentation">
        <span>Application</span>
        <span>Status</span>
        <span className={cn(show.match, "text-right")}>Match</span>
        <span className={show.ats}>ATS</span>
        <span className={show.location}>Location</span>
        <span className={cn(show.updated, "text-right")}>Updated</span>
      </div>
      <ul aria-label="Applications">
        {items.map((app) => {
          const active = app.id === selectedId
          const place = placeInLine(app)
          return (
            <li key={app.id} className="relative border-b">
              <button
                type="button"
                onClick={() => onSelect(app.id)}
                aria-pressed={active}
                className={cn(
                  cols,
                  "relative w-full px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/60 md:px-6",
                  withControls && "pr-24 md:pr-24",
                  active && "bg-primary/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary-hover hover:bg-primary/[0.08]",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CompanyLogo src={app.companyLogo} className="size-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{app.role}</span>
                    <span className="block truncate text-sm text-muted-foreground">{app.company}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <StatusLabel status={app.status} />
                  {place && <span className="block text-xs text-muted-foreground tabular-nums">#{place} in line</span>}
                  {app.control ? (
                    <span className="block truncate text-xs text-muted-foreground">{app.control === "pause" ? "Pausing" : "Cancelling"} at the next step</span>
                  ) : (
                    app.status === "applying" &&
                    app.progress && <span className="block truncate text-xs text-muted-foreground">{app.progress.step}</span>
                  )}
                </span>
                <span className={cn(show.match, "text-right text-sm tabular-nums")}>{app.matchScore}%</span>
                <span className={cn(show.ats, "truncate text-sm")}>{app.ats}</span>
                <span className={cn(show.location, "truncate text-sm text-muted-foreground")}>{app.location}</span>
                <span className={cn(show.updated, "text-right text-sm text-muted-foreground tabular-nums")}>
                  {relativeTime(app.updatedAt, new Date())}
                </span>
              </button>
              {withControls && ACTIVE_STATUSES.includes(app.status) && (
                <div className="absolute top-1/2 right-3 -translate-y-1/2 md:right-5">
                  <QueueControls app={app} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ApplicationDetail({ app, place, onClose }: { app: Application; place: number | null; onClose: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusLabel key="s" status={app.status} />],
    ...(place ? ([["Place in line", <span key="p" className="tabular-nums">#{place}</span>]] as [string, React.ReactNode][]) : []),
    ...(app.progress
      ? ([
          [
            "Current step",
            <div key="c" className="grid gap-1.5">
              <span>{app.progress.step}</span>
              <Progress value={(app.progress.current / app.progress.total) * 100} className="h-1 max-w-48" />
            </div>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(app.liveUrl
      ? ([
          [
            "Live view",
            <a key="v" href={app.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-hover underline underline-offset-4">
              Watch live <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(app.reason ? ([["Reason", <span key="r" className="text-destructive">{app.reason}</span>]] as [string, React.ReactNode][]) : []),
    ["Application ID", <span key="i" className="font-mono text-[13px] break-all">{app.id}</span>],
    ["Company", app.company],
    ["Location", app.location],
    ["ATS", app.ats],
    ["Match", <span key="m" className="tabular-nums">{app.matchScore}%</span>],
    ["Sponsorship", SPONSORSHIP[app.sponsorship]],
    ["Queued", <span key="q" className="tabular-nums">{fullTime(app.queuedAt)}</span>],
    ["Last update", <span key="u" className="tabular-nums">{fullTime(app.updatedAt)}</span>],
    [
      "Posting",
      <a key="l" href={app.postingUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 underline underline-offset-4 hover:text-primary-hover">
        <span className="truncate">{app.postingUrl.replace(/^https?:\/\//, "")}</span>
        <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
      </a>,
    ],
  ]

  return (
    <aside
      aria-label={`${app.role} at ${app.company}`}
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l bg-popover shadow-lg animate-in slide-in-from-right-8 fade-in-0 duration-200 motion-reduce:animate-none sm:w-[min(30rem,60%)] md:static md:shadow-none"
    >
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Application</p>
          <h3 className="mt-1 text-lg leading-snug font-semibold text-pretty">
            {app.role}
          </h3>
          <p className="text-sm text-muted-foreground">{app.company}</p>
        </div>
        <QueueControls app={app} />
        <IconButton label="Close details" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>
      <dl className="grid flex-1 auto-rows-min grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 overflow-y-auto px-5 py-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}


/** Pause or resume, and cancel, for an application that hasn't finished. */
export function QueueControls({ app }: { app: Application }) {
  const { control } = useApplications()
  const [busy, setBusy] = useState(false)
  if (!ACTIVE_STATUSES.includes(app.status)) return null

  const run = (action: "pause" | "resume" | "cancel") => async () => {
    setBusy(true)
    await control(app.jobId, action)
    setBusy(false)
  }
  const pending = !!app.control || busy

  return (
    <div className="flex items-center gap-0.5">
      {app.status === "paused" ? (
        <IconButton label="Resume" onClick={run("resume")} disabled={pending}>
          <PlayIcon />
        </IconButton>
      ) : (
        <IconButton label={app.control === "pause" ? "Pausing" : "Pause"} onClick={run("pause")} disabled={pending}>
          <PauseIcon />
        </IconButton>
      )}
      <IconButton label={app.control === "cancel" ? "Cancelling" : "Cancel"} onClick={run("cancel")} disabled={pending} className="hover:text-destructive">
        <BanIcon />
      </IconButton>
    </div>
  )
}
