"use client"

import { CompanyLogo, JobAction, MatchPill } from "@/components/jobs/job-parts"
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col rounded-panel sm:min-h-[228px] border bg-card p-[18px] shadow-xs">
              <div className="flex items-start gap-3">
                <CompanyLogo company={job.company} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] leading-5 font-semibold text-balance">{job.role}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{job.company}</p>
                </div>
                <MatchPill score={job.matchScore} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{job.location}</p>
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
      )}
    </section>
  )
}
