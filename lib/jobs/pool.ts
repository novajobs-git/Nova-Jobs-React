import "server-only"

import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

import { extractKeywords } from "@/lib/matching/extract"

/*
 * The central job pool every candidate is matched against, written by
 * scripts/scrape_jobs.py (spec 004), enrich_descriptions.py (spec 006) and
 * enrich_logos.py (specs 010, 011). Replaced by a Supabase query in spec 008.
 */
const POOL_FILE = path.join(process.cwd(), "data", "jobs", "us-jobs.json")

// Downloaded logos are served from /logos/<hash>.<ext>; older pools hot-linked a URL.
const logoPath = z.string().regex(/^\/logos\/[a-f0-9]{20}\.(png|jpg|gif|webp|svg|ico|avif)$/)

const scrapedJob = z.object({
  id: z.string(),
  ats: z.enum(["Greenhouse", "Lever", "Ashby", "Workday", "SmartRecruiters"]),
  company: z.string(),
  title: z.string(),
  location: z.string(),
  url: z.url(),
  description: z.string().nullish(),
  // A bad logo value drops the logo, never the pool.
  companyLogo: z.union([logoPath, z.url()]).nullish().catch(null),
  postedAt: z.string().nullable(),
  scrapedAt: z.string(),
})
const poolFile = z.object({ jobs: z.array(scrapedJob) })

export type PooledJob = z.infer<typeof scrapedJob> & { keywords: string[] }
export interface Pool {
  /** Changes whenever a script rewrites the pool; stored matches older than this are recomputed. */
  version: number
  jobs: PooledJob[]
}

// Extracting keywords from ~1k descriptions is the expensive part, and the
// pool only changes when a script rewrites the file; cache per file version.
let cache: Pool | null = null

/** The pool, or null when nothing has been scraped yet. */
export async function loadPool(): Promise<Pool | null> {
  let version: number
  try {
    version = (await stat(POOL_FILE)).mtimeMs
  } catch {
    return null
  }
  if (cache?.version !== version) {
    const { jobs } = poolFile.parse(JSON.parse(await readFile(POOL_FILE, "utf8")))
    cache = {
      version,
      jobs: jobs.map((j) => ({ ...j, keywords: extractKeywords(`${j.title}\n${j.description ?? ""}`) })),
    }
  }
  return cache
}
