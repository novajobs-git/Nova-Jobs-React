import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ResumeAnalysis } from "@/components/resume-analysis/resume-analysis"
import { getProfile } from "@/lib/profile/store"

export const metadata: Metadata = { title: "Resume analysis" }

export default async function ResumeAnalysisPage() {
  // Layouts and pages render in parallel, so the layout's redirect alone isn't enough.
  const profile = await getProfile()
  if (!profile?.onboarding_complete) redirect("/onboarding")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 md:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Resume analysis</h1>
        <p className="mt-1.5 max-w-[65ch] text-pretty text-muted-foreground">
          See how applicant tracking systems read your resume, and what to fix first.
        </p>
      </header>
      <ResumeAnalysis storedFileName={profile.resume_text ? profile.resume_filename || "Resume on file" : null} />
    </div>
  )
}
