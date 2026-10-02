import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { ApplicationStatus, Outcome } from "@/lib/applications/types"

interface StatusMeta {
  label: string
  icon: LucideIcon
  /** Text + icon tone. */
  text: string
  /** Solid fill for bars, dots and legend swatches. */
  fill: string
}

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  applied: { label: "Applied", icon: CircleCheckIcon, text: "text-success-text", fill: "bg-success" },
  applying: { label: "Applying", icon: LoaderCircleIcon, text: "text-warning", fill: "bg-warning" },
  queued: { label: "Queued", icon: CircleDashedIcon, text: "text-primary", fill: "bg-primary" },
  needs_review: { label: "Needs review", icon: CircleAlertIcon, text: "text-destructive", fill: "bg-needs-review" },
  failed: { label: "Failed", icon: CircleXIcon, text: "text-destructive", fill: "bg-destructive" },
}

export const OUTCOME_META: Record<Outcome, StatusMeta> = {
  applied: STATUS_META.applied,
  in_queue: { ...STATUS_META.queued, label: "In queue" },
  needs_review: STATUS_META.needs_review,
  failed: STATUS_META.failed,
}

export function StatusLabel({ status, className }: { status: ApplicationStatus; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", meta.text, className)}>
      <Icon className="size-4" aria-hidden />
      {meta.label}
    </span>
  )
}
