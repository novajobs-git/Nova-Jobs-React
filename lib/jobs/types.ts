import type { Ats, Sponsorship } from "@/lib/applications/types"

export type ExperienceLevel = "Entry" | "Mid" | "Senior"

export type WorkMode = "Remote" | "Hybrid" | "On-site"

/** Jobs below this match score are never shown to a candidate. */
export const MATCH_THRESHOLD = 30

export interface Job {
  id: string
  company: string
  /** Logo URL read from the company's ATS board (spec 010); the UI falls back to a building placeholder. */
  companyLogo?: string
  role: string
  location: string
  workMode: WorkMode
  level: ExperienceLevel
  ats: Ats
  sponsorship: Sponsorship
  /** Always >= MATCH_THRESHOLD. */
  matchScore: number
  /** USD per year, when the posting states it. */
  salary?: { min: number; max: number }
  /** Resume skills found in this job (spec 006). */
  matchedSkills?: string[]
  /** How many scorable skills the job asks for. */
  skillTotal?: number
  /** Why this job matched the candidate's profile. */
  matchReasons: string[]
  postedAt: string
  postingUrl: string
}
