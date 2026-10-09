import { HIGHEST_DEGREE, TARGET_LEVELS } from "@/lib/profile/options"

/*
 * Structured matching rules (spec 014, decisions confirmed 2026-10-07).
 * Stage 1 hard filters remove a job outright; stage 2 scores what's left.
 * Pure functions: lib/jobs/matches.ts feeds them the pool and the profile.
 */

/** Same order as TARGET_LEVELS and as TIERS in scripts/ats/requirements.py. */
export const TIER_KEYS = ["new_grad", "entry", "mid", "senior", "staff", "vp"] as const
export const DEGREE_KEYS = ["none", "bachelor", "master", "phd"] as const
export type TierKey = (typeof TIER_KEYS)[number]
export type DegreeKey = (typeof DEGREE_KEYS)[number]
export type TargetLevel = (typeof TARGET_LEVELS)[number]

export const TITLE_CUTOFF = 0.89
export const TITLE_CUTOFF_RELAXED = 0.87
export const YEARS_BUFFER = 2
export const YEARS_BUFFER_RELAXED = 4
/** Below this many strict matches, filters are relaxed one step at a time. */
export const MIN_RESULTS = 15

export const WEIGHTS = { title: 0.3, skills: 0.3, freshness: 0.2, location: 0.1, salary: 0.1 } as const

export type Relaxation = "level" | "degree" | "title"
/** Cumulative fallback steps, in the confirmed order. */
export const RELAX_STEPS: Relaxation[][] = [[], ["level"], ["level", "degree"], ["level", "degree", "title"]]

export const levelLabel = (tier: TierKey) => TARGET_LEVELS[TIER_KEYS.indexOf(tier)]

/** Candidate's degree on the job scale: High school and Associate count as no degree. */
export function degreeRank(degree: string | undefined): number {
  const i = HIGHEST_DEGREE.indexOf(degree as (typeof HIGHEST_DEGREE)[number])
  return i <= 1 ? 0 : i - 1
}

export interface Candidate {
  levelIndex: number
  years: number
  degreeRank: number
}

export interface JobRequirements {
  seniorityLevel?: TierKey | null
  minYearsExperience?: number | null
  degreeRequired?: DegreeKey | null
}

/**
 * Stage 1 for one job under the given relaxations. Returns null when the job
 * is excluded, else the relaxations it needed (empty = a strict match).
 * Unknown requirements never exclude a job; an unknown title similarity does.
 */
export function passes(job: JobRequirements, similarity: number | null, c: Candidate, relax: Relaxation[]): Relaxation[] | null {
  const needed = new Set<Relaxation>()

  if (similarity !== null) {
    if (similarity < TITLE_CUTOFF) {
      if (!relax.includes("title") || similarity < TITLE_CUTOFF_RELAXED) return null
      needed.add("title")
    }
  }

  if (job.seniorityLevel) {
    const tier = TIER_KEYS.indexOf(job.seniorityLevel)
    if (tier < c.levelIndex - 1) return null // 2+ tiers below: never relaxed
    if (tier > c.levelIndex + 1) {
      if (!relax.includes("level") || tier > c.levelIndex + 2) return null
      needed.add("level")
    }
  }

  if (job.minYearsExperience != null && job.minYearsExperience > c.years + YEARS_BUFFER) {
    if (!relax.includes("level") || job.minYearsExperience > c.years + YEARS_BUFFER_RELAXED) return null
    needed.add("level")
  }

  // Only a required Master's or PhD can exclude a job.
  const required = job.degreeRequired ? DEGREE_KEYS.indexOf(job.degreeRequired) : 0
  if (required >= 2 && required > c.degreeRank) {
    if (!relax.includes("degree") || required > c.degreeRank + 1) return null
    needed.add("degree")
  }

  return [...needed]
}

/** 0-100: how far above the strict cutoff the best target-title similarity is. */
export function titleScore(similarity: number): number {
  return Math.max(0, Math.min(100, ((similarity - TITLE_CUTOFF) / (1 - TITLE_CUTOFF)) * 100))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 100 x 0.5^(age_days / 7): halves every week (spec 011). */
export function freshnessScore(postedAt: string, now = Date.now()): number {
  const ageDays = Math.max(0, (now - Date.parse(postedAt)) / DAY_MS)
  const score = 100 * 0.5 ** (ageDays / 7)
  return Number.isFinite(score) ? score : 0
}

export type WorkMode = "Remote" | "Hybrid" | "On-site"

export function workModeOf(location: string): WorkMode {
  if (/remote/i.test(location)) return "Remote"
  if (/hybrid/i.test(location)) return "Hybrid"
  return "On-site"
}

const STATES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado", CT: "connecticut",
  DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois",
  IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana",
  NE: "nebraska", NV: "nevada", NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york",
  NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah",
  VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming",
}
const STATE_BY_NAME = new Map(Object.entries(STATES).map(([code, name]) => [name, code]))

/** Does a job location ("New York, NY; Austin, TX") fall in a target ("NY", "Texas", "Austin, TX")? */
function inLocation(jobLocation: string, target: string): boolean {
  const [first, second] = target.split(",").map((s) => s.trim())
  const lower = jobLocation.toLowerCase()
  const stateMatch = (s: string) => {
    const code = s.length === 2 ? s.toUpperCase() : STATE_BY_NAME.get(s.toLowerCase())
    return !!code && STATES[code] !== undefined && (new RegExp(`\\b${code}\\b`).test(jobLocation) || lower.includes(STATES[code]))
  }
  if (second) return lower.includes(first.toLowerCase()) // "Austin, TX": the city decides
  if (first.length === 2 || STATE_BY_NAME.has(first.toLowerCase())) return stateMatch(first)
  return first.length > 1 && lower.includes(first.toLowerCase())
}

/** 0-100 location/work-setup fit. */
export function locationScore(jobLocation: string, targets: string[], workModes: string[]): number {
  const mode = workModeOf(jobLocation)
  const modeOk = workModes.length === 0 || workModes.includes(mode)
  if (mode === "Remote") return modeOk ? 100 : 50
  if (targets.length === 0) return 50
  if (!targets.some((t) => inLocation(jobLocation, t))) return 0
  return modeOk ? 100 : 50
}

/** "120,000", "$120k", "120K-140K", "120" (thousands) -> 120000; null if no number. */
export function parseSalary(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k)?/i.exec(text)
  if (!m) return null
  let n = Number(m[1].replace(/,/g, ""))
  if (m[2] || n < 1000) n *= 1000
  return n >= 10_000 ? n : null
}

/** 0-100, or null when either side is unknown (its weight is then dropped). */
export function salaryScore(desired: number | null, max: number | null | undefined): number | null {
  if (!desired || !max) return null
  if (max >= desired) return 100
  return Math.max(0, 100 * (1 - (desired - max) / (0.3 * desired)))
}

export interface Components {
  title: number | null
  skills: number
  freshness: number
  location: number
  salary: number | null
}

/** Weighted score; unknown components (null) are dropped and the rest rescaled to sum to 1. */
export function combine(c: Components): number {
  let total = 0
  let weight = 0
  for (const key of Object.keys(WEIGHTS) as (keyof Components)[]) {
    const value = c[key]
    if (value === null) continue
    total += WEIGHTS[key] * value
    weight += WEIGHTS[key]
  }
  return weight ? Math.round(total / weight) : 0
}

export const RELAXED_COPY: Record<Relaxation, { banner: string; tag: string }> = {
  level: {
    banner: "Showing some roles a level above your experience — we didn’t find enough exact matches today.",
    tag: "Above your level",
  },
  degree: {
    banner: "Including roles that ask for a higher degree than yours — we didn’t find enough exact matches today.",
    tag: "Higher degree",
  },
  title: {
    banner: "Including roles further from your target titles — we didn’t find enough exact matches today.",
    tag: "Related role",
  },
}
