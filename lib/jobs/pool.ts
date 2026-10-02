import "server-only"

import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

import { getDemoJobs } from "@/lib/jobs/mock-data"
import { MATCH_THRESHOLD, type ExperienceLevel, type Job } from "@/lib/jobs/types"
import { extractKeywords } from "@/lib/matching/extract"
import { scoreJob } from "@/lib/matching/score"

/*
 * The job pool written by scripts/scrape_jobs.py (spec 004) and
 * scripts/enrich_descriptions.py (spec 006). Replaced by a Supabase query in
 * spec 008; getJobs() keeps its signature.
 */
const POOL_FILE = path.join(process.cwd(), "data", "jobs", "us-jobs.json")

const scrapedJob = z.object({
  id: z.string(),
  ats: z.enum(["Greenhouse", "Lever", "Ashby", "Workday", "SmartRecruiters"]),
  company: z.string(),
  title: z.string(),
  location: z.string(),
  url: z.url(),
  description: z.string().nullish(),
  postedAt: z.string().nullable(),
  scrapedAt: z.string(),
})
const poolFile = z.object({ jobs: z.array(scrapedJob) })

type PooledJob = z.infer<typeof scrapedJob> & { keywords: string[] }

// Extracting keywords from ~1k descriptions is the expensive part, and the
// pool only changes when a script rewrites the file; cache per file version.
let cache: { mtimeMs: number; jobs: PooledJob[] } | null = null

async function loadPool(): Promise<PooledJob[] | null> {
  let mtimeMs: number
  try {
    mtimeMs = (await stat(POOL_FILE)).mtimeMs
  } catch {
    return null
  }
  if (cache?.mtimeMs !== mtimeMs) {
    const { jobs } = poolFile.parse(JSON.parse(await readFile(POOL_FILE, "utf8")))
    cache = {
      mtimeMs,
      jobs: jobs.map((j) => ({ ...j, keywords: extractKeywords(`${j.title}\n${j.description ?? ""}`) })),
    }
  }
  return cache.jobs
}

function levelFor(title: string): ExperienceLevel {
  if (/\b(senior|sr\.?|staff|principal|lead)\b/i.test(title)) return "Senior"
  if (/\b(junior|jr\.?|associate|intern|entry|new grad)\b/i.test(title)) return "Entry"
  return "Mid"
}

/**
 * Jobs whose skills/keywords overlap the candidate's resume skills by at
 * least MATCH_THRESHOLD% (spec 006), best first. Falls back to demo jobs
 * when nothing has been scraped yet.
 */
export async function getJobs(candidateSkills: string[]): Promise<Job[]> {
  const pool = await loadPool()
  if (!pool) return getDemoJobs()

  const matched: Job[] = []
  for (const job of pool) {
    const match = scoreJob(candidateSkills, job.keywords)
    if (!match || match.score < MATCH_THRESHOLD) continue
    matched.push({
      id: job.id,
      company: job.company,
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
  return matched.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      (b.matchedSkills?.length ?? 0) - (a.matchedSkills?.length ?? 0) ||
      Date.parse(b.postedAt) - Date.parse(a.postedAt),
  )
}
