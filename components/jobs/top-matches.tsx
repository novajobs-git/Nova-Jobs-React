"use client"

import { Building2Icon, MapPinIcon } from "lucide-react"

import { CompanyLogo, JobAction, MatchPill, RelaxedTags } from "@/components/jobs/job-parts"
import type { Application } from "@/lib/applications/types"
import type { Job } from "@/lib/jobs/types"

interface TopMatchesProps {
  jobs: Job[]
  total: number
  applicationFor: (job: Job) => Application | undefined
}

export function TopMatches({ jobs, total, applicationFor }: TopMatchesProps) {
  return (
    <section aria-labelledby="top-heading">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="top-heading" className="text-lg font-semibold tracking-tight">Top matches for you</h2>
        <p className="hidden text-sm text-muted-foreground tabular-nums sm:block">{total} jobs matched to your profile</p>
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-panel border bg-card px-5 py-6 text-sm text-muted-foreground">
          You’ve acted on every top match. New matches appear here as jobs are added to the pool.
        </p>
      ) : (
        // One bordered strip; each cell draws its right/bottom divider and the -mr/-mb overflow clips the outer edge.
        <div className="overflow-hidden rounded-panel border bg-card">
          <ul className="-mr-px -mb-px grid sm:grid-cols-2 xl:grid-cols-4">
            {jobs.map((job) => (
              <li key={job.id} className="flex min-w-0 flex-col border-r border-b p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <CompanyLogo src={job.companyLogo} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm leading-5 font-semibold" title={job.role}>{job.role}</h3>
                    <RelaxedTags relaxedBy={job.relaxedBy} className="mt-1.5" />
                  </div>
                  <MatchPill score={job.matchScore} />
                </div>
                <dl className="mt-3 grid gap-1 text-sm text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <dt>
                      <Building2Icon className="size-4 shrink-0" aria-label="Company" />
                    </dt>
                    <dd className="truncate">{job.company}</dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <dt>
                      <MapPinIcon className="size-4 shrink-0" aria-label="Location" />
                    </dt>
                    <dd className="truncate" title={job.location}>{job.location}</dd>
                  </div>
                </dl>
                {job.matchedSkills && job.matchedSkills.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">
                      {job.matchedSkills.length} of {job.skillTotal} skills match
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Matched skills">
                      {job.matchedSkills.slice(0, 4).map((skill) => (
                        <li key={skill} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">
                          {skill}
                        </li>
                      ))}
                      {job.matchedSkills.length > 4 && (
                        <li className="px-1 py-0.5 text-xs text-muted-foreground">+{job.matchedSkills.length - 4}</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <a
                    href={job.postingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    View details →
                  </a>
                  <JobAction job={job} application={applicationFor(job)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
