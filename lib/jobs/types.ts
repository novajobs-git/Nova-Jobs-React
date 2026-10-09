import type { Ats, Sponsorship } from "@/lib/applications/types"
import type { Relaxation, TargetLevel, WorkMode } from "@/lib/matching/structured"

export type { WorkMode }

export interface Job {
  id: string
  company: string
  /** Company logo downloaded from its ATS board (/logos/<file>, specs 010-011); the UI falls back to a building placeholder. */
  companyLogo?: string
  role: string
  location: string
  workMode: WorkMode
  /** Seniority extracted at ingestion (spec 014); absent until extraction has run. */
  level?: TargetLevel
  ats: Ats
  sponsorship: Sponsorship
  /** Weighted match score 0-100 (spec 014: title, skills, freshness, location, salary). */
  matchScore: number
  /** USD per year, when the posting states it. */
  salary?: { min: number; max: number }
  /** Resume skills found in this job (spec 006). */
  matchedSkills?: string[]
  /** How many scorable skills the job asks for. */
  skillTotal?: number
  /** Why this job matched the candidate's profile. */
  matchReasons: string[]
  /** Filters relaxed to include this job because there were too few exact matches (spec 014). */
  relaxedBy?: Relaxation[]
  postedAt: string
  postingUrl: string
}

/** The candidate's matches, plus which filters had to be relaxed to find enough of them. */
export interface MatchedJobs {
  jobs: Job[]
  relaxed: Relaxation[]
}
