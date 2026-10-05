import { NextResponse } from "next/server"

import { saveBuiltResume } from "@/lib/resume/store"
import { resumeDocSchema } from "@/lib/resume/types"

type Envelope = { success: true; data: { updatedAt: string } } | { success: false; error: string }

export async function PUT(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const parsed = resumeDocSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json<Envelope>(
      { success: false, error: `Couldn't save: ${issue?.path.join(" ") || "resume"} ${issue?.message ?? "is invalid"}.` },
      { status: 400 },
    )
  }
  try {
    return NextResponse.json<Envelope>({ success: true, data: { updatedAt: await saveBuiltResume(parsed.data) } })
  } catch (e) {
    const error = e instanceof Error && e.message ? e.message : "Couldn't write your resume to disk."
    return NextResponse.json<Envelope>({ success: false, error }, { status: 500 })
  }
}
