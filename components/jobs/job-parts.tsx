"use client"

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

// Monogram tiles stand in for company logos until the job pool stores real ones.
const LOGO_COLORS = ["bg-indigo-500", "bg-rose-500", "bg-slate-900", "bg-emerald-600", "bg-sky-500", "bg-amber-500", "bg-violet-600", "bg-teal-600"]

export function CompanyLogo({ company, className }: { company: string; className?: string }) {
  const hash = [...company].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card", className)} aria-hidden>
      <span className={cn("flex size-[22px] items-center justify-center rounded-[5px] text-[11px] font-bold text-white", LOGO_COLORS[hash % LOGO_COLORS.length])}>
        {company[0]}
      </span>
    </span>
  )
}

export function MatchPill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-bold tabular-nums",
        score >= 90 ? "border-success/20 bg-success/10 text-success-text" : "border-primary/20 bg-primary/10 text-primary-hover",
      )}
    >
      {score}%
    </span>
  )
}
