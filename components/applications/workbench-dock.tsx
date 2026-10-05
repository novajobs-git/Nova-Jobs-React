"use client"

import { useState } from "react"
import { ChevronUpIcon, ExternalLinkIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { queueOrder, useApplications } from "@/components/applications/applications-provider"
import { StatusLabel } from "@/components/applications/status"
import { CompanyLogo } from "@/components/jobs/job-parts"
import { DEMO_NOW } from "@/lib/applications/mock-data"
import { relativeTime } from "@/lib/applications/stats"
import type { Application } from "@/lib/applications/types"
import { cn } from "@/lib/utils"

type TabKey = "progress" | "applied" | "attention"

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

export function WorkbenchDock() {
  const { applications } = useApplications()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<TabKey>("progress")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { isMobile, state } = useSidebar()

  const applying = applications.find((a) => a.status === "applying")
  const queued = queueOrder(applications)
  const lists: Record<TabKey, Application[]> = {
    progress: applying ? [applying, ...queued] : queued,
    applied: applications.filter((a) => a.status === "applied"),
    attention: applications.filter((a) => a.status === "failed" || a.status === "needs_review"),
  }
  const items = lists[tab]
  const selected = items.find((a) => a.id === selectedId) ?? null
  const placeInLine = (app: Application) => (app.status === "queued" ? queued.findIndex((q) => q.id === app.id) + 1 : null)

  // The panel spans the content area only; it must never cover the sidebar.
  const left = isMobile || state === "collapsed" ? 0 : "15.5rem"

  return (
    <>
      <div className="sticky bottom-0 z-20 border-t bg-card">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[50px] w-full items-center gap-3 px-6 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
          aria-label={applying ? `Open Auto-Apply Queue. Applying to ${applying.company} now.` : "Open Auto-Apply Queue"}
        >
          <span className="relative flex size-2 shrink-0" aria-hidden>
            {applying && <span className="absolute inset-0 animate-ping rounded-none bg-primary/50 motion-reduce:animate-none" />}
            <span className={applying ? "relative size-2 rounded-none bg-primary" : "relative size-2 rounded-none bg-primary/30"} />
          </span>
          <span className="text-[15px] font-semibold">Auto-Apply Queue</span>
          <span className="rounded-none bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-hover tabular-nums">
            {lists.progress.length}
          </span>
          <ChevronUpIcon className="ml-auto size-4 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 p-0 transition-[height] duration-200 motion-reduce:transition-none"
          style={{ left, height: expanded ? "calc(100svh - 66px)" : "min(560px, 70svh)" }}
        >
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as TabKey)
              setSelectedId(null)
            }}
            className="min-h-0 flex-1 gap-0"
          >
            <header className="border-b px-4 md:px-6">
              <div className="flex items-center gap-2 pt-3">
                <SheetTitle className="text-[15px] font-semibold">Auto-Apply Queue</SheetTitle>
                <SheetDescription className="sr-only">One job is applied to at a time. Others wait their turn.</SheetDescription>
                <div className="ml-auto flex items-center gap-1">
                  <IconButton label={expanded ? "Restore size" : "Expand"} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
                  </IconButton>
                  <IconButton label="Close" onClick={() => setOpen(false)}>
                    <XIcon />
                  </IconButton>
                </div>
              </div>
              <TabsList variant="line" className="-mb-px h-auto gap-5 p-0">
                <WorkbenchTab value="progress" label="In progress" count={lists.progress.length} />
                <WorkbenchTab value="applied" label="Applied" count={lists.applied.length} />
                <WorkbenchTab value="attention" label="Needs attention" count={lists.attention.length} />
              </TabsList>
            </header>

            <div className="relative flex min-h-0 flex-1">
              <QueueTable
                items={items}
                selectedId={selected?.id ?? null}
                compact={!!selected}
                onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                placeInLine={placeInLine}
                empty={{ progress: "Nothing in the queue.", applied: "No applications sent yet.", attention: "Nothing needs your attention." }[tab]}
              />
              {selected && (
                <ApplicationDetail
                  key={selected.id}
                  app={selected}
                  place={placeInLine(selected)}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="text-muted-foreground hover:text-foreground">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function WorkbenchTab({ value, label, count }: { value: TabKey; label: string; count: number }) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 flex-none rounded-none px-0 text-[15px] font-medium text-muted-foreground after:bottom-0! after:h-0.5 after:bg-primary-hover data-active:text-primary-hover hover:text-foreground data-active:hover:text-primary-hover"
    >
      {label}
      <span className="text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
    </TabsTrigger>
  )
}

interface QueueTableProps {
  items: Application[]
  selectedId: string | null
  /** A detail panel is open: show fewer columns. */
  compact: boolean
  onSelect: (id: string) => void
  placeInLine: (app: Application) => number | null
  empty: string
}

function QueueTable({ items, selectedId, compact, onSelect, placeInLine, empty }: QueueTableProps) {
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
    <div className="@container min-w-0 flex-1 overflow-y-auto">
      <div className={cn(cols, "sticky top-0 z-10 border-b bg-popover px-4 py-2.5 text-sm font-semibold md:px-6")} role="presentation">
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
            <li key={app.id} className="border-b">
              <button
                type="button"
                onClick={() => onSelect(app.id)}
                aria-pressed={active}
                className={cn(
                  cols,
                  "relative w-full px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/60 md:px-6",
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
                  {app.status === "applying" && app.progress && (
                    <span className="block truncate text-xs text-muted-foreground">{app.progress.step}</span>
                  )}
                </span>
                <span className={cn(show.match, "text-right text-sm tabular-nums")}>{app.matchScore}%</span>
                <span className={cn(show.ats, "truncate text-sm")}>{app.ats}</span>
                <span className={cn(show.location, "truncate text-sm text-muted-foreground")}>{app.location}</span>
                <span className={cn(show.updated, "text-right text-sm text-muted-foreground tabular-nums")}>
                  {relativeTime(app.updatedAt, DEMO_NOW)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ApplicationDetail({ app, place, onClose }: { app: Application; place: number | null; onClose: () => void }) {
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
