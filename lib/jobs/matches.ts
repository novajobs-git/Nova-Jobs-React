import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { loadPool, type Pool, type PooledJob } from "@/lib/jobs/pool"
import type { Job, MatchedJobs } from "@/lib/jobs/types"
import { candidateTitleVectors, cosine, loadJobEmbeddings } from "@/lib/matching/embeddings"
import { skillOverlap } from "@/lib/matching/score"
import {
  MIN_RESULTS,
  RELAX_STEPS,
  combine,
  degreeRank,
  freshnessScore,
  levelLabel,
  locationScore,
  parseSalary,
  passes,
  salaryScore,
  titleScore,
  workModeOf,
  type Candidate,
  type Relaxation,
} from "@/lib/matching/structured"
import { DEFAULT_LEVEL, TARGET_LEVELS } from "@/lib/profile/options"
import { degreeFromResume } from "@/lib/profile/resume"
import type { OnboardingData } from "@/lib/profile/schema"
import { candidateYears, type StoredProfile } from "@/lib/profile/store"

/*
 * Per-candidate matches against the central pool: the file-backed stand-in
 * for the `job_matches` table until spec 008. Two stages (spec 014): hard
 * filters, relaxed step by step only when fewer than MIN_RESULTS survive,
 * then a weighted score. Everything except freshness is stored, and the file
 * is recomputed whenever the pool, the title embeddings or the profile
 * fields matching reads change. One demo candidate until Clerk exists.
 */
const CANDIDATE_ID = "candidate"
const MATCH_FILE = path.join(process.cwd(), "data", "matches", `${CANDIDATE_ID}.json`)
const MATCHING_VERSION = 2

interface StoredMatch {
  jobId: string
  /** Best cosine similarity over the target titles; null when titles couldn't be embedded. */
  similarity: number | null
  skills: number
  matched: string[]
  total: number
  location: number
  salary: number | null
  relaxedBy: Relaxation[]
}

interface MatchFile {
  candidateId: string
  key: string
  /** False when the target titles couldn't be embedded; such a file is recomputed on the next read. */
  titleFilter: boolean
  matchedAt: string
  relaxed: Relaxation[]
  matches: StoredMatch[]
}

function candidateOf(profile: StoredProfile): Candidate {
  const level = profile.target_level || DEFAULT_LEVEL[profile.years_experience as OnboardingData["yearsExperience"]] || "Mid Level"
  // Profiles saved before spec 014 have no degree: use the resume's, else assume a Bachelor's.
  const degree = profile.highest_degree || degreeFromResume(profile.resume_text) || "Bachelor’s"
  return {
    levelIndex: Math.max(0, TARGET_LEVELS.indexOf(level as (typeof TARGET_LEVELS)[number])),
    years: candidateYears(profile),
    degreeRank: degreeRank(degree),
  }
}

/** Everything the stored matches depend on; a change means recompute. */
function inputsKey(profile: StoredProfile, poolVersion: number, embeddingsVersion: number): string {
  return JSON.stringify([
    MATCHING_VERSION,
    poolVersion,
    embeddingsVersion,
    candidateOf(profile),
    [...profile.target_job_title].sort(),
    [...profile.target_locations].sort(),
    [...profile.work_modes].sort(),
    profile.desired_salary,
    profile.resume_skills.map((s) => s.toLowerCase()).sort(),
  ])
}

async function computeMatches(profile: StoredProfile, pool: Pool): Promise<MatchFile> {
  const embeddings = await loadJobEmbeddings()
  const targets = await candidateTitleVectors(profile.target_job_title)
  const candidate = candidateOf(profile)

  // Title similarity once per job; with target vectors, a job without its own is left out until embed_titles runs.
  const scored: { job: PooledJob; similarity: number | null }[] = []
  for (const job of pool.jobs) {
    if (!targets) {
      scored.push({ job, similarity: null })
      continue
    }
    const vector = embeddings.vectors.get(job.titleNormalized)
    if (!vector) continue
    scored.push({ job, similarity: Math.max(...targets.map((t) => cosine(t, vector))) })
  }

  // Strict first; relax one more step only while fewer than MIN_RESULTS survive.
  let survivors: { job: PooledJob; similarity: number | null; relaxedBy: Relaxation[] }[] = []
  for (const relax of RELAX_STEPS) {
    survivors = []
    for (const { job, similarity } of scored) {
      const relaxedBy = passes(job, similarity, candidate, relax)
      if (relaxedBy) survivors.push({ job, similarity, relaxedBy })
    }
    if (survivors.length >= MIN_RESULTS) break
  }

  const desired = parseSalary(profile.desired_salary)
  const matches = survivors.map(({ job, similarity, relaxedBy }): StoredMatch => {
    const skills = skillOverlap(profile.resume_skills, job.keywords)
    return {
      jobId: job.id,
      similarity,
      skills: skills.score,
      matched: skills.matched,
      total: skills.total,
      location: locationScore(job.location, profile.target_locations, profile.work_modes),
      salary: salaryScore(desired, job.salaryMax),
      relaxedBy,
    }
  })

  const relaxed = [...new Set(matches.flatMap((m) => m.relaxedBy))]
  const file: MatchFile = {
    candidateId: CANDIDATE_ID,
    key: inputsKey(profile, pool.version, embeddings.version),
    titleFilter: targets !== null,
    matchedAt: new Date().toISOString(),
    relaxed,
    matches,
  }
  await mkdir(path.dirname(MATCH_FILE), { recursive: true })
  await writeFile(MATCH_FILE, JSON.stringify(file, null, 1), "utf8")
  return file
}

async function readMatches(): Promise<MatchFile | null> {
  try {
    return JSON.parse(await readFile(MATCH_FILE, "utf8")) as MatchFile
  } catch {
    return null
  }
}

async function currentMatches(profile: StoredProfile, pool: Pool): Promise<MatchFile> {
  const { version } = await loadJobEmbeddings()
  const stored = await readMatches()
  if (stored?.key === inputsKey(profile, pool.version, version) && stored.titleFilter) return stored
  return computeMatches(profile, pool)
}

/** Matches the candidate against the whole pool now; returns how many jobs matched. */
export async function matchCandidate(profile: StoredProfile): Promise<number> {
  const pool = await loadPool()
  return pool ? (await computeMatches(profile, pool)).matches.length : 0
}

/** The candidate's matched jobs, best first and spread across companies. Empty until the pool has been scraped. */
export async function getMatchedJobs(profile: StoredProfile): Promise<MatchedJobs> {
  const pool = await loadPool()
  if (!pool) return { jobs: [], relaxed: [] }

  const stored = await currentMatches(profile, pool)
  const byId = new Map(pool.jobs.map((j) => [j.id, j]))
  const now = Date.now()
  const jobs: Job[] = []
  for (const match of stored.matches) {
    const job = byId.get(match.jobId)
    if (!job) continue
    const postedAt = job.postedAt ?? job.scrapedAt
    const score = combine({
      title: match.similarity === null ? null : titleScore(match.similarity),
      skills: match.skills,
      freshness: freshnessScore(postedAt, now),
      location: match.location,
      salary: match.salary,
    })
    jobs.push({
      id: job.id,
      company: job.company,
      companyLogo: job.companyLogo ?? undefined,
      role: job.title,
      location: job.location,
      workMode: workModeOf(job.location),
      level: job.seniorityLevel ? levelLabel(job.seniorityLevel) : undefined,
      ats: job.ats,
      // Boards don't state sponsorship in their listings; never guess it.
      sponsorship: "unknown",
      matchScore: score,
      salary: job.salaryMin && job.salaryMax ? { min: job.salaryMin, max: job.salaryMax } : undefined,
      matchedSkills: match.matched,
      skillTotal: match.total,
      matchReasons: [`${match.matched.length} of ${match.total} skills match your resume`],
      relaxedBy: match.relaxedBy.length ? match.relaxedBy : undefined,
      postedAt,
      postingUrl: job.url,
    })
  }
  return { jobs: diversify(jobs), relaxed: stored.relaxed }
}

/**
 * Best-scored first, but spread across companies: every company's best job
 * comes before any company's second, so one big employer can't fill the list.
 */
function diversify(jobs: Job[]): Job[] {
  const ranked = [...jobs].sort((a, b) => b.matchScore - a.matchScore)
  const seen = new Map<string, number>()
  return ranked
    .map((job) => {
      const key = job.company.toLowerCase()
      const nth = seen.get(key) ?? 0
      seen.set(key, nth + 1)
      return { job, nth }
    })
    .sort((a, b) => a.nth - b.nth || b.job.matchScore - a.job.matchScore)
    .map(({ job }) => job)
}
