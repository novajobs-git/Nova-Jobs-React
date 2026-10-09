import { NextResponse } from "next/server"
import { z } from "zod"

import { control, QueueError } from "@/lib/applications/queue"
import { getApplications } from "@/lib/applications/store"
import { currentCandidateId } from "@/lib/candidate"
import type { Application } from "@/lib/applications/types"
import { getEngine } from "@/lib/engine/store"
import type { Engine } from "@/lib/engine/types"

type Envelope = { success: true; data: { applications: Application[]; engine: Engine } } | { success: false; error: string }

const body = z.object({ jobId: z.string().min(1), action: z.enum(["pause", "resume", "cancel"]) })

/** Pause, resume or cancel one application. */
export async function POST(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json<Envelope>({ success: false, error: "Send a job and pause, resume or cancel." }, { status: 400 })
  const candidateId = await currentCandidateId()
  try {
    await control(candidateId, parsed.data.jobId, parsed.data.action)
  } catch (e) {
    if (e instanceof Error) {
      return NextResponse.json<Envelope>({ success: false, error: e.message }, { status: e instanceof QueueError ? 409 : 500 })
    }
    throw e
  }
  return NextResponse.json<Envelope>({ success: true, data: { applications: await getApplications(candidateId), engine: await getEngine(candidateId) } })
}
