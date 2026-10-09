import { NextResponse } from "next/server"
import { z } from "zod"

import { enqueue, QueueError } from "@/lib/applications/queue"
import { getApplications } from "@/lib/applications/store"
import { currentCandidateId } from "@/lib/candidate"
import type { Application } from "@/lib/applications/types"
import { getEngine } from "@/lib/engine/store"
import type { Engine } from "@/lib/engine/types"
import { getProfile } from "@/lib/profile/store"

type Envelope = { success: true; data: { applications: Application[]; engine: Engine } } | { success: false; error: string }

const state = async (candidateId: string) => ({ applications: await getApplications(candidateId), engine: await getEngine(candidateId) })

/** Polled by the app while Auto-Apply runs. */
export async function GET() {
  // Auth check goes here once Clerk is wired (spec 008).
  return NextResponse.json<Envelope>({ success: true, data: await state(await currentCandidateId()) })
}

const body = z.object({ jobId: z.string().min(1) })

/** Apply click: queue a matched job. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json<Envelope>({ success: false, error: "Send the job to apply to." }, { status: 400 })
  const candidateId = await currentCandidateId()
  const profile = await getProfile()
  if (!profile) return NextResponse.json<Envelope>({ success: false, error: "Finish onboarding first." }, { status: 409 })
  try {
    await enqueue(candidateId, profile, parsed.data.jobId)
  } catch (e) {
    if (e instanceof QueueError || e instanceof Error) {
      return NextResponse.json<Envelope>({ success: false, error: e.message }, { status: e instanceof QueueError ? 404 : 500 })
    }
    throw e
  }
  return NextResponse.json<Envelope>({ success: true, data: await state(candidateId) })
}
