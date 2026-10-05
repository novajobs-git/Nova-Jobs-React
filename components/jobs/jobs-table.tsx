"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CompanyLogo, JobAction, MatchPill } from "@/components/jobs/job-parts"
import type { Application } from "@/lib/applications/types"
import type { Job } from "@/lib/jobs/types"

const PAGE_SIZE = 15

const headClass = "h-11 text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase"

export function JobsTable({ jobs, applicationFor }: { jobs: Job[]; applicationFor: (job: Job) => Application | undefined }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? jobs : jobs.slice(0, PAGE_SIZE)

  return (
    <section aria-labelledby="all-heading" className="rounded-panel border bg-card p-4 shadow-xs sm:p-6">
      <h2 id="all-heading" className="mb-4 text-lg font-semibold tracking-tight">All matched jobs</h2>

      <Table>
        <TableHeader className="bg-muted/70 [&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${headClass} pl-4 md:w-[22%]`}>Company</TableHead>
            <TableHead className={`${headClass} md:w-[36%]`}>Job title</TableHead>
            <TableHead className={`${headClass} hidden md:table-cell md:w-[22%]`}>Location</TableHead>
            <TableHead className={`${headClass} hidden sm:table-cell`}>Match</TableHead>
            <TableHead className="pr-4"><span className="sr-only">Action</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((job) => (
            <TableRow key={job.id} className="h-[67px]">
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <CompanyLogo src={job.companyLogo} />
                  <span className="hidden text-[15px] text-muted-foreground lg:inline">{job.company}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-0 whitespace-normal">
                <a href={job.postingUrl} target="_blank" rel="noreferrer" className="text-[15px] font-semibold hover:text-primary-hover">
                  {job.role}
                </a>
                <p className="text-sm text-muted-foreground lg:hidden">
                  {job.company}
                  <span className="md:hidden"> · {job.location}</span>
                </p>
              </TableCell>
              <TableCell className="hidden text-[15px] whitespace-normal text-muted-foreground md:table-cell">{job.location}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <MatchPill score={job.matchScore} />
                {job.skillTotal ? (
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {job.matchedSkills?.length}/{job.skillTotal} skills
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="w-28 pr-4 text-right">
                <JobAction job={job} application={applicationFor(job)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {jobs.length > PAGE_SIZE && (
        <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show ${jobs.length - PAGE_SIZE} more`}
        </Button>
      )}
    </section>
  )
}
