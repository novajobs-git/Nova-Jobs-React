import { NextResponse } from "next/server"

import { getProfile } from "@/lib/profile/store"
import type { Analysis } from "@/lib/resume/analysis"
import { AnalysisError, analyzeText, textFromFile } from "@/lib/resume/analyze"

/*
 * POST /api/resume/analyze (spec 013), synchronous:
 *   multipart `resume` (PDF or .docx, <= 5 MB)  or  JSON { "source": "stored" }
 *   -> 200 { success: true, data: Analysis } | 4xx { success: false, error }
 * The page paces its own ~30s reveal; this answers as fast as it can.
 * Nothing is stored.
 */
const MAX_BYTES = 5 * 1024 * 1024

type Envelope = { success: true; data: Analysis } | { success: false; error: string }
const fail = (error: string, status = 400) => NextResponse.json<Envelope>({ success: false, error }, { status })

export async function POST(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { source?: string } | null
      if (body?.source !== "stored") return fail("Send a resume file, or { source: \"stored\" }.")
      const profile = await getProfile()
      if (!profile?.resume_text) return fail("There's no resume on file yet. Upload one instead.", 404)
      return NextResponse.json<Envelope>({ success: true, data: analyzeText(profile.resume_text, profile.resume_filename || "Resume on file") })
    }

    const file = (await request.formData().catch(() => null))?.get("resume")
    if (!(file instanceof File)) return fail("Attach your resume as a PDF or .docx file.")
    if (file.size > MAX_BYTES) return fail("Your resume needs to be under 5 MB.")
    return NextResponse.json<Envelope>({ success: true, data: analyzeText(await textFromFile(file), file.name) })
  } catch (e) {
    if (e instanceof AnalysisError) return fail(e.message, 422)
    throw e
  }
}
