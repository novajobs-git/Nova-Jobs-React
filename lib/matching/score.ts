import { scorableKeywords } from "./extract"

export interface KeywordMatch {
  /** Matched ÷ job keywords, 0–100. */
  score: number
  matched: string[]
  /** How many scorable keywords the job asks for. */
  total: number
}

/**
 * Share of the job's skills/keywords that appear in the candidate's resume
 * (spec 006). A ranking component only since spec 014: no floor, 0 when the
 * job has nothing to compare.
 */
export function skillOverlap(candidateKeywords: string[], jobKeywords: string[]): KeywordMatch {
  const candidate = new Set(scorableKeywords(candidateKeywords))
  const job = scorableKeywords(jobKeywords)
  const matched = job.filter((k) => candidate.has(k))
  return { score: job.length ? Math.round((matched.length / job.length) * 100) : 0, matched, total: job.length }
}
