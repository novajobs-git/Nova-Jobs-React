"use client"

import { useState } from "react"
import { ChevronUpIcon, ExternalLinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { queueOrder, useApplications } from "@/components/applications/applications-provider"
import { StatusLabel } from "@/components/applications/status"
import { DEMO_NOW } from "@/lib/applications/mock-data"
import { relativeTime } from "@/lib/applications/stats"
import type { Application } from "@/lib/applications/types"

export function WorkbenchDock() {
  const { applications } = useApplications()
  const [open, setOpen] = useState(false)
  const { isMobile, state } = useSidebar()

  const applying = applications.find((a) => a.status === "applying")
  const queued = queueOrder(applications)
  const inProgress = applying ? [applying, ...queued] : queued
  const applied = applications.filter((a) => a.status === "applied")
  const attention = applications.filter((a) => a.status === "failed" || a.status === "needs_review")

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
            {applying && <span className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />}
            <span className={applying ? "relative size-2 rounded-full bg-primary" : "relative size-2 rounded-full bg-primary/30"} />
          </span>
          <span className="text-[15px] font-semibold">Auto-Apply Queue</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-hover tabular-nums">
            {inProgress.length}
          </span>
          <ChevronUpIcon className="ml-auto size-4 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent side="bottom" className="h-[min(560px,70svh)] gap-0 p-0" style={{ left }}>
          <SheetHeader className="border-b px-4 py-3 md:px-6">
            <SheetTitle>Auto-Apply Queue</SheetTitle>
            <SheetDescription>One job is applied to at a time. Others wait their turn.</SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="progress" className="min-h-0 flex-1 gap-0">
            <div className="border-b px-4 py-2 md:px-6">
              <TabsList>
                <TabsTrigger value="progress">In progress <Count n={inProgress.length} /></TabsTrigger>
                <TabsTrigger value="applied">Applied <Count n={applied.length} /></TabsTrigger>
                <TabsTrigger value="attention">Failed / Needs review <Count n={attention.length} /></TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <TabsContent value="progress" className="m-0">
                <QueueList items={inProgress} empty="Nothing in the queue." />
              </TabsContent>
              <TabsContent value="applied" className="m-0">
                <QueueList items={applied} empty="No applications sent yet." />
              </TabsContent>
              <TabsContent value="attention" className="m-0">
                <QueueList items={attention} empty="Nothing needs your attention." />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Count({ n }: { n: number }) {
  return <Badge variant="secondary" className="h-4.5 px-1.5 tabular-nums">{n}</Badge>
}

function QueueList({ items, empty }: { items: Application[]; empty: string }) {
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground md:px-6">{empty}</p>
  }
  return (
    <ul className="divide-y">
      {items.map((app, i) => (
        <li key={app.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 md:px-6">
          <div className="w-28 shrink-0">
            <StatusLabel status={app.status} />
            {app.status === "queued" && (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">#{items.slice(0, i).filter((q) => q.status === "queued").length + 1} in line</p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{app.role}</p>
            <p className="truncate text-sm text-muted-foreground">
              {app.company} · {app.location} · {app.ats}
            </p>
            {app.progress && (
              <div className="mt-2 flex max-w-sm items-center gap-3">
                <Progress value={(app.progress.current / app.progress.total) * 100} className="h-1.5" />
                <span className="shrink-0 text-xs text-muted-foreground">{app.progress.step}</span>
              </div>
            )}
            {app.reason && <p className="mt-1 text-sm text-destructive">{app.reason}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex-col sm:items-end">
            <span className="tabular-nums">{relativeTime(app.updatedAt, DEMO_NOW)}</span>
            <a href={app.postingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              Posting <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
