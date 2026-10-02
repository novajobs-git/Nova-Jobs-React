import { NextResponse } from "next/server"

import { onboardingSchema } from "@/lib/profile/schema"
import { saveProfile } from "@/lib/profile/store"

type Envelope = { success: true } | { success: false; error: string }

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
  try {
    await saveProfile(parsed.data)
  } catch {
    return NextResponse.json<Envelope>({ success: false, error: "Your resume upload expired. Upload it again." }, { status: 400 })
  }
  return NextResponse.json<Envelope>({ success: true })
}
