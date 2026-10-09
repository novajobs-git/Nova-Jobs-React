"use client"

import { useState } from "react"
import { ChevronUpIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { queueOrder, useApplications } from "@/components/applications/applications-provider"
import { ApplicationDetail, ApplicationTable, IconButton } from "@/components/applications/application-table"
import type { Application } from "@/lib/applications/types"
import { cn } from "@/lib/utils"

type TabKey = "progress" | "applied" | "attention"

export function WorkbenchDock() {
  const { applications, engine } = useApplications()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<TabKey>("progress")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { isMobile, state } = useSidebar()

  const applying = applications.find((a) => a.status === "applying")
  const queued = queueOrder(applications)
  const lists: Record<TabKey, Application[]> = {
    progress: [...(applying ? [applying] : []), ...queued, ...applications.filter((a) => a.status === "paused")],
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
          <span
            className={cn(
              "hidden min-w-0 truncate text-sm sm:block",
              engine.status.state === "not_running" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {applying ? `Applying to ${applying.role} at ${applying.company}` : engine.status.message}
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
              <ApplicationTable
                items={items}
                selectedId={selected?.id ?? null}
                compact={!!selected}
                onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                placeInLine={placeInLine}
                withControls={tab === "progress"}
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
