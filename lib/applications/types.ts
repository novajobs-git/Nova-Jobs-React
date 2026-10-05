export type ApplicationStatus =
  | "queued"
  | "applying"
  | "applied"
  | "failed"
  | "needs_review"

export type Ats = "Greenhouse" | "Lever" | "Ashby" | "Workday" | "SmartRecruiters"

export type Sponsorship = "offered" | "not_offered" | "unknown"

/** What the candidate can do about a failed or needs-review application. */
export type ResolutionAction = "retry" | "answer" | "update_profile" | "dismiss"

export interface Application {
  id: string
  /** The job in the shared pool this application is for. */
  jobId: string
  company: string
  /** Copied from the job (spec 011); demo applications have none. */
  companyLogo?: string
  role: string
  location: string
  ats: Ats
  /** Always >= 30: jobs below the match threshold are never shown. */
  matchScore: number
  sponsorship: Sponsorship
  status: ApplicationStatus
  /** Verbatim reason, present on failed and needs_review. */
  reason?: string
  resolution?: ResolutionAction
  /** Present only while applying: the engine's current step. */
  progress?: { step: string; current: number; total: number }
  queuedAt: string
  updatedAt: string
  postingUrl: string
}

/** Statuses grouped the way the candidate thinks about them. */
export type Outcome = "applied" | "in_queue" | "needs_review" | "failed"
