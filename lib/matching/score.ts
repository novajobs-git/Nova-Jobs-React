import { scorableKeywords } from "./extract"

/** A job must match at least this many keywords, whatever its percentage. */
export const MIN_MATCHED_KEYWORDS = 2

export interface KeywordMatch {
  /** Matched ÷ job keywords, 0–100. */
  score: number
  matched: string[]
  /** How many scorable keywords the job asks for. */
  total: number
}

/**
 * Share of the job's skills/keywords that appear in the candidate's resume
 * (spec 006). Returns null when the job has nothing to compare or fewer than
 * MIN_MATCHED_KEYWORDS overlap.
 */
export function scoreJob(candidateKeywords: string[], jobKeywords: string[]): KeywordMatch | null {
  const candidate = new Set(scorableKeywords(candidateKeywords))
  const job = scorableKeywords(jobKeywords)
  if (job.length === 0) return null
  const matched = job.filter((k) => candidate.has(k))
  if (matched.length < MIN_MATCHED_KEYWORDS) return null
  return { score: Math.round((matched.length / job.length) * 100), matched, total: job.length }
}
