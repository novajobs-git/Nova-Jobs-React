import { NextResponse } from "next/server"
import { z } from "zod"

import { currentCandidateId } from "@/lib/candidate"
import { updateSettings } from "@/lib/engine/store"
import type { Engine } from "@/lib/engine/types"

type Envelope = { success: true; data: Engine } | { success: false; error: string }

const body = z.object({ enabled: z.boolean().optional(), autoApplyMatches: z.boolean().optional(), autoSubmit: z.boolean().optional() })

/** The signed-in candidate's Auto-Apply toggle (enabled) and Settings options; nobody else's change. */
export async function PUT(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json<Envelope>({ success: false, error: "Send enabled, autoApplyMatches and/or autoSubmit." }, { status: 400 })
  try {
    return NextResponse.json<Envelope>({ success: true, data: await updateSettings(await currentCandidateId(), parsed.data) })
  } catch (e) {
    const error = e instanceof Error ? e.message : "Couldn't start the engine."
    return NextResponse.json<Envelope>({ success: false, error }, { status: 500 })
  }
}
