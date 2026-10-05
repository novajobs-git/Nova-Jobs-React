import { NextResponse } from "next/server"

import { matchCandidate } from "@/lib/jobs/matches"
import { onboardingSchema } from "@/lib/profile/schema"
import { saveProfile } from "@/lib/profile/store"

type Envelope = { success: true; data: { matchedJobs: number } } | { success: false; error: string }

export async function POST(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json<Envelope>(
      { success: false, error: `${first?.path.join(".") || "profile"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    )
  }
  let profile
  try {
    profile = await saveProfile(parsed.data)
  } catch {
    return NextResponse.json<Envelope>({ success: false, error: "Your resume upload expired. Upload it again." }, { status: 400 })
  }
  // A new candidate is matched against the central pool as soon as onboarding finishes.
  return NextResponse.json<Envelope>({ success: true, data: { matchedJobs: await matchCandidate(profile) } })
}
