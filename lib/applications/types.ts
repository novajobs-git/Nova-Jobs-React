export type ApplicationStatus =
  | "queued"
  | "applying"
  | "paused"
  | "applied"
  | "failed"
  | "needs_review"

export type Ats = "Greenhouse" | "Lever" | "Ashby" | "Workday" | "SmartRecruiters"

export type Sponsorship = "offered" | "not_offered" | "unknown"

/** What the candidate can do about a failed or needs-review application. */
export type ResolutionAction = "retry" | "answer" | "update_profile" | "dismiss"

/** Pause or cancel requested while the engine is applying; the engine acts on it at its next step. */
export type ControlRequest = "pause" | "cancel"

export interface Application {
  id: string
  /** The job in the shared pool this application is for. */
  jobId: string
  company: string
  /** Copied from the job (spec 011). */
  companyLogo?: string | null
  role: string
  location: string
  ats: Ats
  /** Always >= 30: jobs below the match threshold are never shown. */
  matchScore: number
  sponsorship: Sponsorship
  status: ApplicationStatus
  /** Verbatim reason, present on failed and needs_review. */
  reason?: string | null
  resolution?: ResolutionAction | null
  /** Present only while applying: the engine's current step. */
  progress?: { step: string; current: number; total: number }
  /** Present only while applying in a Hyperbrowser session: watch it, or solve a CAPTCHA. */
  liveUrl?: string
  control?: ControlRequest
  /** Queued by "Apply to matches automatically" rather than an Apply click. */
  autoQueued?: boolean
  queuedAt: string
  updatedAt: string
  postingUrl: string
}

/** Statuses the candidate can still pause or cancel. */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["applying", "queued", "paused"]
