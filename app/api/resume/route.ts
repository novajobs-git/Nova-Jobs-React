import { NextResponse } from "next/server"

import { parseResumeText, pdfToText } from "@/lib/profile/resume"
import type { ParsedResume } from "@/lib/profile/schema"
import { saveResume } from "@/lib/profile/store"

const MAX_BYTES = 5 * 1024 * 1024

type Envelope = { success: true; data: ParsedResume } | { success: false; error: string }
const fail = (error: string, status = 400) => NextResponse.json<Envelope>({ success: false, error }, { status })

export async function POST(request: Request) {
  // Auth check goes here once Clerk is wired (spec 008).
  const form = await request.formData().catch(() => null)
  const file = form?.get("resume")
  if (!(file instanceof File)) return fail("Attach your resume as a PDF.")
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return fail("Your resume needs to be a PDF.")
  if (file.size > MAX_BYTES) return fail("Your resume needs to be under 5 MB.")

  const pdf = new Uint8Array(await file.arrayBuffer())
  let text: string
  try {
    text = await pdfToText(pdf)
  } catch {
    return fail("We couldn't read that PDF. Try exporting it again, or upload another file.")
  }
  if (text.trim().length < 50) {
    return fail("This PDF has no readable text (it may be a scanned image). Upload a text-based PDF.")
  }

  const resumeId = await saveResume(pdf, text)
  return NextResponse.json<Envelope>({ success: true, data: { resumeId, fileName: file.name, ...parseResumeText(text) } })
}
