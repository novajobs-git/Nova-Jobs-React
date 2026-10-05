import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { updateResumeSkills, type StoredProfile } from "@/lib/profile/store"
import { seedResume } from "./seed"
import { resumeDocSchema, type ResumeDoc } from "./types"

/* File-backed stand-in for a `resumes` row until spec 008, like lib/profile/store.ts. */
const RESUME_FILE = path.join(process.cwd(), "data", "resume", "candidate.json")

/** The saved resume, or a first draft seeded from the profile (updatedAt null). */
export async function getBuiltResume(profile: StoredProfile): Promise<ResumeDoc> {
  try {
    const saved = resumeDocSchema.safeParse(JSON.parse(await readFile(RESUME_FILE, "utf8")))
    if (saved.success) return saved.data
  } catch {
    // Not saved yet.
  }
  return seedResume(profile)
}

/** Saves the document and makes its skills the ones jobs are matched on. */
export async function saveBuiltResume(doc: ResumeDoc): Promise<string> {
  const updatedAt = new Date().toISOString()
  await mkdir(path.dirname(RESUME_FILE), { recursive: true })
  await writeFile(RESUME_FILE, JSON.stringify({ ...doc, updatedAt }, null, 2), "utf8")
  await updateResumeSkills(doc.skills)
  return updatedAt
}
