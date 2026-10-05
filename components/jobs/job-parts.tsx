"use client"

import { useState } from "react"
import { BadgeCheckIcon, CircleHelpIcon, CircleSlashIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useApplications } from "@/components/applications/applications-provider"
import { StatusLabel } from "@/components/applications/status"
import { cn } from "@/lib/utils"
import type { Application, Sponsorship } from "@/lib/applications/types"
import type { Job } from "@/lib/jobs/types"

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
  const { apply } = useApplications()

  if (application) return <StatusLabel status={application.status} />

  return (
    <Button
      className={cn("h-9 px-4 text-[15px]", className)}
      onClick={() => {
        const place = apply(job)
        toast.success(`Queued: ${job.role}`, {
          description: `${job.company} is #${place} in line. Track it in the Auto-Apply Queue.`,
        })
      }}
    >
      Apply
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
