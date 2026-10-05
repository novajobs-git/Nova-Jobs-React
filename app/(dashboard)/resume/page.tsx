import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ResumeBuilder } from "@/components/resume/resume-builder"
import { getProfile } from "@/lib/profile/store"
import { getBuiltResume } from "@/lib/resume/store"

export const metadata: Metadata = { title: "Resume builder" }

export default async function ResumePage() {
  // Layouts and pages render in parallel, so the layout's redirect alone isn't enough.
  const profile = await getProfile()
  if (!profile?.onboarding_complete) redirect("/onboarding")

  return <ResumeBuilder initial={await getBuiltResume(profile)} />
}
