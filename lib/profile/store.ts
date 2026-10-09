import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { connection } from "next/server"

import { yearsFromResume } from "./resume"
import type { OnboardingData } from "./schema"
import { EXPERIENCE_YEARS } from "./options"

/*
 * File-backed stand-in for the Supabase `profiles` table + `resumes`
 * bucket until spec 007/008. One demo candidate until Clerk exists.
 * Stored in snake_case, in the shape engine.py reads from `profiles`; the
 * camelCase <-> snake_case mapping lives only here.
 */
const DATA_DIR = path.join(process.cwd(), "data")
const PROFILE_FILE = path.join(DATA_DIR, "profiles", "candidate.json")
const RESUME_DIR = path.join(DATA_DIR, "resumes")

export interface StoredProfile {
  full_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  location: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  job_title: string
  years_experience: string
  /** Months of work in the resume's date ranges, clamped into the self-reported range (spec 014); null if none were found. */
  years_experience_computed: number | null
  target_level: string
  highest_degree: string
  desired_salary: string
  earliest_start_date: string
  work_authorization: string
  needs_sponsorship: string
  gender: string
  race_ethnicity: string
  veteran_status: string
  disability_status: string
  target_job_title: string[]
  target_locations: string[]
  work_modes: string[]
  resume_pdf: string
  resume_filename: string
  resume_skills: string[]
  resume_text: string
  onboarding_complete: boolean
  updated_at: string
}

export async function saveResume(pdf: Uint8Array, text: string): Promise<string> {
  const resumeId = randomUUID()
  await mkdir(RESUME_DIR, { recursive: true })
  await writeFile(path.join(RESUME_DIR, `${resumeId}.pdf`), pdf)
  await writeFile(path.join(RESUME_DIR, `${resumeId}.txt`), text, "utf8")
  return resumeId
}

async function resumeText(resumeId: string): Promise<string> {
  // resumeId is a server-issued UUID; refuse anything else before touching the disk.
  if (!/^[0-9a-f-]{36}$/.test(resumeId)) throw new Error("Unknown resume")
  return readFile(path.join(RESUME_DIR, `${resumeId}.txt`), "utf8")
}

/** [low, high] years for each self-reported range. */
const YEAR_RANGES: Record<(typeof EXPERIENCE_YEARS)[number], [number, number]> = {
  "0–1": [0, 1],
  "1–3": [1, 3],
  "3–5": [3, 5],
  "5–8": [5, 8],
  "8–12": [8, 12],
  "12+": [12, 40],
}

// The candidate's own answer wins: the resume only places them within it.
function computedYears(text: string, range: OnboardingData["yearsExperience"]): number | null {
  const years = yearsFromResume(text)
  if (years === null) return null
  const [low, high] = YEAR_RANGES[range]
  return Math.min(Math.max(years, low), high)
}

/** Years used for matching: the resume's figure, else the middle of the self-reported range. */
export function candidateYears(p: StoredProfile): number {
  if (typeof p.years_experience_computed === "number") return p.years_experience_computed
  const range = YEAR_RANGES[p.years_experience as OnboardingData["yearsExperience"]]
  return range ? (range[1] >= 40 ? range[0] : (range[0] + range[1]) / 2) : 0
}

export async function saveProfile(data: OnboardingData): Promise<StoredProfile> {
  const text = await resumeText(data.resumeId)
  const profile: StoredProfile = {
    full_name: `${data.firstName} ${data.lastName}`.trim(),
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone,
    location: data.location,
    linkedin_url: data.linkedinUrl,
    github_url: data.githubUrl,
    portfolio_url: data.portfolioUrl,
    job_title: data.currentTitle,
    years_experience: data.yearsExperience,
    years_experience_computed: computedYears(text, data.yearsExperience),
    target_level: data.targetLevel,
    highest_degree: data.highestDegree,
    desired_salary: data.desiredSalary,
    earliest_start_date: data.earliestStartDate,
    work_authorization: data.workAuthorization,
    needs_sponsorship: data.needsSponsorship,
    gender: data.gender,
    race_ethnicity: data.raceEthnicity,
    veteran_status: data.veteranStatus,
    disability_status: data.disabilityStatus,
    target_job_title: data.targetTitles,
    target_locations: data.targetLocations,
    work_modes: data.workModes,
    resume_pdf: `resumes/${data.resumeId}.pdf`,
    resume_filename: data.resumeFileName,
    resume_skills: data.skills,
    resume_text: text,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }
  await mkdir(path.dirname(PROFILE_FILE), { recursive: true })
  await writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2), "utf8")
  return profile
}

/** The resume builder's saved skills replace the parsed ones for matching. */
export async function updateResumeSkills(skills: string[]): Promise<StoredProfile> {
  const profile = await getProfile()
  if (!profile) throw new Error("Finish onboarding before saving a resume.")
  const updated: StoredProfile = { ...profile, resume_skills: skills, updated_at: new Date().toISOString() }
  await writeFile(PROFILE_FILE, JSON.stringify(updated, null, 2), "utf8")
  return updated
}

export async function getProfile(): Promise<StoredProfile | null> {
  // The profile is per-candidate request data: never prerender a page from it.
  await connection()
  try {
    return JSON.parse(await readFile(PROFILE_FILE, "utf8")) as StoredProfile
  } catch {
    return null
  }
}
