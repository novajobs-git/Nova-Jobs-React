"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { OUTCOME_META, StatusLabel } from "@/components/applications/status"
import { DEMO_NOW } from "@/lib/applications/mock-data"
import { OUTCOMES, outcomeOf, relativeTime } from "@/lib/applications/stats"
import type { Application, Ats, Outcome, Sponsorship } from "@/lib/applications/types"

const SPONSORSHIP_LABEL: Record<Sponsorship, string> = {
  offered: "Sponsors",
  not_offered: "No",
  unknown: "Not stated",
}

const ATS_OPTIONS: Ats[] = ["Greenhouse", "Lever", "Ashby", "Workday", "SmartRecruiters"]

// A daily check-in cares about recent activity; older rows load on request.
const PAGE_SIZE = 15

interface HistoryTableProps {
  applications: Application[]
  counts: Record<Outcome, number>
  outcome: Outcome | "all"
  onOutcomeChange: (outcome: Outcome | "all") => void
}

export function HistoryTable({ applications, counts, outcome, onOutcomeChange }: HistoryTableProps) {
  const [query, setQuery] = useState("")
  const [ats, setAts] = useState<Ats | "all">("all")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications.filter(
      (a) =>
        (outcome === "all" || outcomeOf(a.status) === outcome) &&
        (ats === "all" || a.ats === ats) &&
        (q === "" || a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)),
    )
  }, [applications, outcome, ats, query])

  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, PAGE_SIZE)
  const filtered = query !== "" || ats !== "all" || outcome !== "all"

  return (
    <section id="history" aria-labelledby="history-heading" className="mt-2 scroll-mt-20">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="history-heading" className="text-base font-semibold">History</h2>
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          Showing {visible.length} of {rows.length}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs className="min-w-0" value={outcome} onValueChange={(v) => onOutcomeChange(v as Outcome | "all")}>
          <div className="-mx-4 overflow-x-auto px-4 mask-[linear-gradient(to_right,black_85%,transparent)] md:mx-0 md:px-0 md:mask-none">
            <TabsList>
              <TabsTrigger value="all">All <TabCount n={applications.length} /></TabsTrigger>
              {OUTCOMES.map((o) => (
                <TabsTrigger key={o} value={o}>
                  {OUTCOME_META[o].label} <TabCount n={counts[o]} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        <div className="flex min-w-0 gap-2">
          <div className="relative flex-1 xl:w-64 xl:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company or role"
              aria-label="Search company or role"
              className="bg-card pl-8"
            />
          </div>
          <Select value={ats} onValueChange={(v) => setAts(v as Ats | "all")}>
            <SelectTrigger className="w-28 bg-card sm:w-36" aria-label="Filter by ATS">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ATS</SelectItem>
              {ATS_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4 md:pl-5">Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right md:table-cell">Match</TableHead>
              <TableHead className="hidden lg:table-cell">Sponsorship</TableHead>
              <TableHead className="hidden lg:table-cell">ATS</TableHead>
              <TableHead className="hidden pr-4 text-right sm:table-cell md:pr-5">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="max-w-0 pl-4 md:w-[38%] md:pl-5">
                  <a href={app.postingUrl} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-primary hover:underline hover:underline-offset-4">
                    {app.role}
                  </a>
                  <p className="truncate text-muted-foreground">{app.company} · {app.location}</p>
                </TableCell>
                <TableCell className="w-30 pr-4 sm:pr-2 md:w-[26%] md:max-w-0">
                  <StatusLabel status={app.status} />
                  <p className="text-xs text-muted-foreground tabular-nums sm:hidden">{relativeTime(app.updatedAt, DEMO_NOW)}</p>
                  {app.reason && <p className="hidden truncate text-xs text-muted-foreground md:block" title={app.reason}>{app.reason}</p>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{app.matchScore}%</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className={app.sponsorship === "offered" ? "text-foreground" : "text-muted-foreground"}>
                    {SPONSORSHIP_LABEL[app.sponsorship]}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{app.ats}</TableCell>
                <TableCell className="hidden pr-4 text-right text-muted-foreground tabular-nums sm:table-cell md:pr-5">
                  {relativeTime(app.updatedAt, DEMO_NOW)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > PAGE_SIZE && (
          <div className="border-t px-4 py-2 md:px-5">
            <Button variant="ghost" size="sm" className="-ml-2" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show ${rows.length - PAGE_SIZE} more`}
            </Button>
          </div>
        )}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No applications match these filters.</p>
            {filtered && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("")
                  setAts("all")
                  onOutcomeChange("all")
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function TabCount({ n }: { n: number }) {
  return <Badge variant="secondary" className="h-4.5 px-1.5 tabular-nums">{n}</Badge>
}
