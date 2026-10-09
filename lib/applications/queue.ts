import "server-only"

import { getMatchedJobs } from "@/lib/jobs/matches"
import type { StoredProfile } from "@/lib/profile/store"
import { engineRunning, ensureWorker } from "@/lib/engine/store"
import { mutateApplications } from "./store"
import type { Application } from "./types"

export class QueueError extends Error {}

export type QueueAction = "pause" | "resume" | "cancel"

/** Apply click: queues one of the candidate's matched jobs. */
export async function enqueue(candidateId: string, profile: StoredProfile, jobId: string): Promise<void> {
  const job = (await getMatchedJobs(profile)).jobs.find((j) => j.id === jobId)
  if (!job) throw new QueueError("This job is no longer in your matches.")
  await mutateApplications(candidateId, (apps) => {
    if (apps.some((a) => a.jobId === jobId)) return
    const now = new Date().toISOString()
    const app: Application = {
      id: `app_${job.id}`,
      jobId: job.id,
      company: job.company,
      companyLogo: job.companyLogo,
      role: job.role,
      location: job.location,
      ats: job.ats,
      matchScore: job.matchScore,
      sponsorship: job.sponsorship,
      status: "queued",
      queuedAt: now,
      updatedAt: now,
      postingUrl: job.postingUrl,
    }
    apps.push(app)
  })
  await ensureWorker(candidateId)
}

/**
 * Pause parks a job (it keeps its place in line); resume puts it back;
 * cancel removes it, so the job can be applied to again. A job the engine is
 * applying to right now gets a request the engine acts on at its next step.
 */
export async function control(candidateId: string, jobId: string, action: QueueAction): Promise<void> {
  const running = await engineRunning(candidateId)
  await mutateApplications(candidateId, (apps) => {
    const app = apps.find((a) => a.jobId === jobId)
    if (!app) throw new QueueError("That application isn't in your queue any more.")
    const now = new Date().toISOString()

    if (app.status === "applying" && running && action !== "resume") {
      app.control = action
      return
    }
    switch (action) {
      case "pause":
        if (app.status !== "queued" && app.status !== "applying") throw new QueueError("Only queued applications can be paused.")
        Object.assign(app, { status: "paused", updatedAt: now })
        delete app.progress
        delete app.liveUrl
        delete app.control
        return
      case "resume":
        if (app.status !== "paused") throw new QueueError("Only paused applications can be resumed.")
        Object.assign(app, { status: "queued", updatedAt: now })
        return
      case "cancel":
        if (!["queued", "applying", "paused"].includes(app.status)) throw new QueueError("Finished applications can't be cancelled.")
        apps.splice(apps.indexOf(app), 1)
        return
    }
  })
  if (action === "resume") await ensureWorker(candidateId)
}
