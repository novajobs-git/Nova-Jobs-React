"use client"

import { useState } from "react"
import { BadgeCheckIcon, CircleHelpIcon, CircleSlashIcon, InfoIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useApplications } from "@/components/applications/applications-provider"
import { StatusLabel } from "@/components/applications/status"
import { cn } from "@/lib/utils"
import type { Application, Sponsorship } from "@/lib/applications/types"
import type { Job } from "@/lib/jobs/types"
import { RELAXED_COPY, type Relaxation } from "@/lib/matching/structured"

const SPONSORSHIP = {
  offered: { label: "Sponsors visas", icon: BadgeCheckIcon, className: "text-success-text" },
  not_offered: { label: "No sponsorship", icon: CircleSlashIcon, className: "text-muted-foreground" },
  unknown: { label: "Sponsorship not stated", icon: CircleHelpIcon, className: "text-muted-foreground" },
} satisfies Record<Sponsorship, { label: string; icon: typeof BadgeCheckIcon; className: string }>

export function SponsorshipTag({ value, short, className }: { value: Sponsorship; short?: boolean; className?: string }) {
  const meta = SPONSORSHIP[value]
  const label = short ? { offered: "Sponsors", not_offered: "No", unknown: "Not stated" }[value] : meta.label
  return (
    <span className={cn("inline-flex items-center gap-1.5", meta.className, className)}>
      <meta.icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

export function formatSalary(salary: Job["salary"]) {
  if (!salary) return null
  return `$${Math.round(salary.min / 1000)}k–$${Math.round(salary.max / 1000)}k`
}

/** Apply button, or the job's place in the pipeline once it has one. */
export function JobAction({ job, application, className }: { job: Job; application?: Application; className?: string }) {
  const { apply, autoApply } = useApplications()
  const [busy, setBusy] = useState(false)

  if (application) return <StatusLabel status={application.status} />

  return (
    <Button
      className={cn("h-9 px-4 text-[15px]", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const place = await apply(job)
        setBusy(false)
        if (place === null) return
        toast.success(`Queued: ${job.role}`, {
          description: autoApply
            ? `${job.company} is #${place} in line. Track it in the Auto-Apply Queue.`
            : `${job.company} is #${place} in line. Turn on Auto-Apply to start.`,
        })
      }}
    >
      {busy ? "Queuing…" : "Apply"}
    </Button>
  )
}

// Generic building icon for companies whose board has no logo (spec 010) or whose logo fails to load.
const PLACEHOLDER_LOGO = "/company-placeholder.png"

export function CompanyLogo({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const showLogo = src && !failed
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {showLogo ? (
        // Logos are served from data/logos (spec 011) in mixed formats, incl. SVG and ICO.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        // A black glyph on transparency: softened on light tiles, inverted on dark ones.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={PLACEHOLDER_LOGO} alt="" className="size-5 opacity-55 dark:invert" />
      )}
    </span>
  )
}

/** Shown when too few exact matches were found and filters were relaxed (spec 014). */
export function RelaxedNotice({ relaxed }: { relaxed: Relaxation[] }) {
  return (
    <div role="status" className="flex gap-3 rounded-panel border bg-card px-5 py-4 text-sm">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <ul className="grid gap-1">
        {relaxed.map((r) => (
          <li key={r}>{RELAXED_COPY[r].banner}</li>
        ))}
      </ul>
    </div>
  )
}

/** Text tags naming why a relaxed-in job is shown; never color alone. */
export function RelaxedTags({ relaxedBy, className }: { relaxedBy?: Relaxation[]; className?: string }) {
  if (!relaxedBy?.length) return null
  return (
    <span className={cn("inline-flex flex-wrap gap-1.5", className)}>
      {relaxedBy.map((r) => (
        <span key={r} className="rounded-none border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {RELAXED_COPY[r].tag}
        </span>
      ))}
    </span>
  )
}

export function MatchPill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-none border px-2.5 text-xs font-bold tabular-nums",
        score >= 90 ? "border-success/20 bg-success/10 text-success-text" : "border-primary/20 bg-primary/10 text-primary-hover",
      )}
    >
      {score}%
    </span>
  )
}
