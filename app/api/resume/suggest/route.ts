import { NextResponse } from "next/server"

import { getProfile } from "@/lib/profile/store"
import { suggest, SuggestError } from "@/lib/resume/suggest"
import { suggestRequestSchema, type Suggestion } from "@/lib/resume/types"

type Envelope = { success: true; data: Suggestion } | { success: false; error: string }
const fail = (error: string, status = 400) => NextResponse.json<Envelope>({ success: false, error }, { status })

export async function POST(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const parsed = suggestRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("That section can't be written with AI.")
  const profile = await getProfile()
  if (!profile) return fail("Finish onboarding first.", 409)
  try {
    return NextResponse.json<Envelope>({ success: true, data: suggest(parsed.data, profile) })
  } catch (e) {
    if (e instanceof SuggestError) return fail(e.message, 422)
    throw e
  }
}
