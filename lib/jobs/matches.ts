import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { getDemoJobs } from "@/lib/jobs/mock-data"
import { loadPool, type Pool, type PooledJob } from "@/lib/jobs/pool"
import { MATCH_THRESHOLD, type ExperienceLevel, type Job } from "@/lib/jobs/types"
import { scoreJob } from "@/lib/matching/score"
import type { StoredProfile } from "@/lib/profile/store"

/*
 * Per-candidate matches against the central pool (spec 011): the file-backed
 * stand-in for the `job_matches` table until spec 008. Written when a
 * candidate finishes onboarding or saves their resume, and recomputed on
 * read whenever the pool has been re-scraped or the skills changed.
 * One demo candidate until Clerk exists.
 */
const CANDIDATE_ID = "candidate"
const MATCH_FILE = path.join(process.cwd(), "data", "matches", `${CANDIDATE_ID}.json`)

interface StoredMatch {
  jobId: string
  score: number
  matched: string[]
  total: number
}

interface MatchFile {
  candidateId: string
  poolVersion: number
  skills: string[]
  matchedAt: string
  matches: StoredMatch[]
}

const skillsKey = (skills: string[]) => JSON.stringify(skills.map((s) => s.toLowerCase()).sort())

function computeMatches(skills: string[], jobs: PooledJob[]): StoredMatch[] {
  const matches: StoredMatch[] = []
  for (const job of jobs) {
    const match = scoreJob(skills, job.keywords)
    if (match && match.score >= MATCH_THRESHOLD) matches.push({ jobId: job.id, ...match })
  }
  return matches
}

async function writeMatches(profile: StoredProfile, pool: Pool): Promise<MatchFile> {
  const file: MatchFile = {
    candidateId: CANDIDATE_ID,
    poolVersion: pool.version,
    skills: profile.resume_skills,
    matchedAt: new Date().toISOString(),
    matches: computeMatches(profile.resume_skills, pool.jobs),
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

/** Matches the candidate against the whole pool now; returns how many jobs matched. */
export async function matchCandidate(profile: StoredProfile): Promise<number> {
  const pool = await loadPool()
  return pool ? (await writeMatches(profile, pool)).matches.length : 0
}

function levelFor(title: string): ExperienceLevel {
  if (/\b(senior|sr\.?|staff|principal|lead)\b/i.test(title)) return "Senior"
  if (/\b(junior|jr\.?|associate|intern|entry|new grad)\b/i.test(title)) return "Entry"
  return "Mid"
}

/**
 * The candidate's matched jobs (score >= MATCH_THRESHOLD, spec 006), best
 * first. Falls back to demo jobs when nothing has been scraped yet.
 */
export async function getMatchedJobs(profile: StoredProfile): Promise<Job[]> {
  const pool = await loadPool()
  if (!pool) return getDemoJobs()

  let stored = await readMatches()
  if (!stored || stored.poolVersion !== pool.version || skillsKey(stored.skills) !== skillsKey(profile.resume_skills)) {
    stored = await writeMatches(profile, pool)
  }

  const byId = new Map(pool.jobs.map((j) => [j.id, j]))
  const jobs: Job[] = []
  for (const match of stored.matches) {
    const job = byId.get(match.jobId)
    if (!job) continue
    jobs.push({
      id: job.id,
      company: job.company,
      companyLogo: job.companyLogo ?? undefined,
      role: job.title,
      location: job.location,
      workMode: /remote/i.test(job.location) ? "Remote" : "On-site",
      level: levelFor(job.title),
      ats: job.ats,
      // Boards don't state sponsorship in their listings; never guess it.
      sponsorship: "unknown",
      matchScore: match.score,
      matchedSkills: match.matched,
      skillTotal: match.total,
      matchReasons: [`${match.matched.length} of ${match.total} skills match your resume`],
      postedAt: job.postedAt ?? job.scrapedAt,
      postingUrl: job.url,
    })
  }
  return jobs.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      (b.matchedSkills?.length ?? 0) - (a.matchedSkills?.length ?? 0) ||
      Date.parse(b.postedAt) - Date.parse(a.postedAt),
  )
}
