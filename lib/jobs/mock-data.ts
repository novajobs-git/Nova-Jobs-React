import { DEMO_NOW, getApplications } from "@/lib/applications/mock-data"
import type { Ats, Sponsorship } from "@/lib/applications/types"
import { MATCH_THRESHOLD, type ExperienceLevel, type Job, type WorkMode } from "./types"

/*
 * Synthetic job pool standing in for the Supabase job pool + match table
 * until specs 007–008 land. Every job that already has an application is
 * included, plus new matches the candidate hasn't acted on. Companies are
 * fictional.
 */

type NewJobRow = [
  company: string,
  role: string,
  location: string,
  workMode: WorkMode,
  level: ExperienceLevel,
  ats: Ats,
  match: number,
  sponsorship: Sponsorship,
  hoursAgo: number,
  salary?: [number, number],
]

const NEW_JOBS: NewJobRow[] = [
  ["Orbital Pay", "Senior Frontend Engineer, Payments", "New York, NY", "Hybrid", "Senior", "Lever", 94, "offered", 2, [175, 210]],
  ["Copperleaf Software", "Frontend Engineer, Collaboration", "Remote (US)", "Remote", "Mid", "Ashby", 92, "offered", 5, [140, 170]],
  ["Tidewater Analytics", "Senior UI Engineer, Dashboards", "Boston, MA", "Hybrid", "Senior", "Greenhouse", 89, "offered", 9, [165, 195]],
  ["Northwind Labs", "Frontend Engineer, Design Systems", "Remote (US)", "Remote", "Mid", "Ashby", 87, "unknown", 14, [135, 165]],
  ["Halcyon Health", "Software Engineer, Web Platform", "Seattle, WA", "Hybrid", "Mid", "Greenhouse", 85, "offered", 20, [145, 175]],
  ["Parcel & Pine", "Senior Product Engineer", "Portland, OR", "Remote", "Senior", "Ashby", 83, "offered", 26, [160, 190]],
  ["Kestrel Security", "UI Engineer, Threat Console", "Remote (US)", "Remote", "Mid", "Lever", 81, "unknown", 30],
  ["Lumen Grid", "Frontend Engineer, Grid Operations", "Denver, CO", "Hybrid", "Mid", "Greenhouse", 79, "offered", 33, [125, 150]],
  ["Meridian Bank", "Frontend Engineer, Mobile Web", "Charlotte, NC", "On-site", "Mid", "Workday", 76, "offered", 40, [120, 145]],
  ["Juniper Commerce", "Senior Frontend Engineer, Search", "Chicago, IL", "Hybrid", "Senior", "Greenhouse", 74, "not_offered", 44, [170, 200]],
  ["Arcadia Robotics", "Software Engineer, Operator UI", "Austin, TX", "On-site", "Mid", "Greenhouse", 72, "offered", 52, [130, 160]],
  ["Sable Systems", "Frontend Engineer, Alerts", "Remote (US)", "Remote", "Mid", "Lever", 70, "not_offered", 60],
  ["Brightline Freight", "Junior Frontend Developer", "Dallas, TX", "On-site", "Entry", "Lever", 66, "offered", 64, [85, 105]],
  ["Waypoint Logistics", "Associate Software Engineer, Web", "Atlanta, GA", "Hybrid", "Entry", "Workday", 62, "offered", 70, [90, 110]],
  ["Cinder Games", "UI Programmer, Web Launcher", "Los Angeles, CA", "On-site", "Mid", "Greenhouse", 58, "not_offered", 76, [120, 150]],
  ["Fieldstone Insurance", "Frontend Developer I", "Columbus, OH", "Hybrid", "Entry", "Workday", 55, "offered", 84, [80, 98]],
  ["Orbital Pay", "Staff Frontend Engineer", "New York, NY", "Hybrid", "Senior", "Lever", 51, "offered", 96, [210, 250]],
  ["Halcyon Health", "Junior Software Engineer, Patient Web", "Seattle, WA", "Hybrid", "Entry", "Greenhouse", 47, "offered", 110, [95, 115]],
  ["Juniper Commerce", "Full Stack Engineer, Payments", "Chicago, IL", "Remote", "Mid", "Greenhouse", 43, "not_offered", 130],
  ["Tidewater Analytics", "Data Engineer (Frontend Tooling)", "Boston, MA", "Hybrid", "Mid", "Greenhouse", 38, "unknown", 150, [130, 155]],
  ["Lumen Grid", "Software Engineer, Mapping", "Remote (US)", "Remote", "Mid", "Greenhouse", 34, "unknown", 170],
  ["Brightline Freight", "Mobile Engineer (React Native)", "Dallas, TX", "On-site", "Mid", "Lever", 31, "offered", 190],
  // Below the threshold: present in the pool, never shown to this candidate.
  ["Kestrel Security", "Backend Engineer, Detection", "Remote (US)", "Remote", "Senior", "Lever", 24, "unknown", 12],
]

const HOUR = 60 * 60 * 1000

function jobId(company: string, role: string) {
  return `job_${`${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
}

function workModeFor(location: string): WorkMode {
  return location.startsWith("Remote") ? "Remote" : "Hybrid"
}

function levelFor(role: string): ExperienceLevel {
  if (/senior|staff/i.test(role)) return "Senior"
  if (/junior|associate|\bI\b/.test(role)) return "Entry"
  return "Mid"
}

const SALARY_BY_LEVEL: Record<ExperienceLevel, [number, number]> = {
  Entry: [90, 115],
  Mid: [130, 160],
  Senior: [165, 200],
}

// The demo candidate targets frontend roles, prefers remote or the
// Northeast, and needs visa sponsorship.
function reasonsFor(role: string, location: string, sponsorship: Sponsorship, match: number): string[] {
  const reasons: string[] = []
  if (/front|ui|web|design system|product engineer/i.test(role)) reasons.push("Title matches your target: Frontend Engineer")
  else reasons.push("Skills overlap: React, TypeScript")
  if (sponsorship === "offered") reasons.push("Sponsors visas, which you need")
  else if (location.startsWith("Remote")) reasons.push("Remote (US), one of your preferred locations")
  else if (match >= 60) reasons.push("Experience level fits your 5 years")
  else reasons.push(`Located in ${location}`)
  return reasons
}

/** Same signature the Supabase-backed service will expose. */
export async function getDemoJobs(): Promise<Job[]> {
  const applications = await getApplications()

  const fromApplications: Job[] = applications.map((a) => {
    const level = levelFor(a.role)
    const [min, max] = SALARY_BY_LEVEL[level]
    return {
      id: a.jobId,
      company: a.company,
      role: a.role,
      location: a.location,
      workMode: workModeFor(a.location),
      level,
      ats: a.ats,
      sponsorship: a.sponsorship,
      matchScore: a.matchScore,
      salary: { min: min * 1000, max: max * 1000 },
      matchReasons: reasonsFor(a.role, a.location, a.sponsorship, a.matchScore),
      postedAt: new Date(Date.parse(a.queuedAt) - 30 * HOUR).toISOString(),
      postingUrl: a.postingUrl,
    }
  })

  const fresh: Job[] = NEW_JOBS.map(([company, role, location, workMode, level, ats, match, sponsorship, hoursAgo, salary]) => {
    const id = jobId(company, role)
    return {
      id,
      company,
      role,
      location,
      workMode,
      level,
      ats,
      sponsorship,
      matchScore: match,
      salary: salary && { min: salary[0] * 1000, max: salary[1] * 1000 },
      matchReasons: reasonsFor(role, location, sponsorship, match),
      postedAt: new Date(DEMO_NOW.getTime() - hoursAgo * HOUR).toISOString(),
      postingUrl: `https://jobs.example.com/${id.slice(4)}`,
    }
  })

  return [...fresh, ...fromApplications]
    .filter((job) => job.matchScore >= MATCH_THRESHOLD)
    .sort((a, b) => b.matchScore - a.matchScore)
}
