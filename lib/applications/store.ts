import "server-only"

import { mkdir, open, readFile, rm, stat } from "node:fs/promises"
import path from "node:path"

import { writeJsonAtomic } from "@/lib/engine/store"
import type { Application } from "./types"

/*
 * Each candidate's applications (spec 012): the file-backed stand-in for the
 * `applications` / queue table until spec 008, one file per candidate. Both
 * this app and that candidate's engine change it, always inside a lock
 * (engine/store.py uses the same lock file), so neither overwrites the
 * other's edits.
 */
const DIR = path.join(process.cwd(), "data", "applications")
const fileFor = (candidateId: string) => path.join(DIR, `${candidateId}.json`)
const lockFor = (candidateId: string) => path.join(DIR, `${candidateId}.lock`)
const STALE_LOCK_MS = 10_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function acquire(candidateId: string): Promise<() => Promise<void>> {
  const LOCK = lockFor(candidateId)
  const deadline = Date.now() + 10_000
  for (;;) {
    try {
      const handle = await open(LOCK, "wx")
      return async () => {
        await handle.close()
        await rm(LOCK, { force: true })
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        await mkdir(DIR, { recursive: true })
        continue
      }
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e
      const age = await stat(LOCK).then((s) => Date.now() - s.mtimeMs, () => 0)
      if (age > STALE_LOCK_MS) {
        await rm(LOCK, { force: true }) // left by a crashed process
        continue
      }
      if (Date.now() > deadline) throw new Error("Your applications are busy being updated. Try again in a moment.")
      await sleep(50)
    }
  }
}

export async function getApplications(candidateId: string): Promise<Application[]> {
  for (let i = 0; i < 5; i++) {
    try {
      return (JSON.parse(await readFile(fileFor(candidateId), "utf8")) as { applications: Application[] }).applications
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
      await sleep(80) // mid-write by the engine
    }
  }
  return []
}

/** Read, change and save one candidate's applications under the shared lock. */
export async function mutateApplications<T>(candidateId: string, fn: (apps: Application[]) => T): Promise<T> {
  const release = await acquire(candidateId)
  try {
    const apps = await getApplications(candidateId)
    const result = fn(apps)
    await writeJsonAtomic(fileFor(candidateId), { applications: apps })
    return result
  } finally {
    await release()
  }
}
