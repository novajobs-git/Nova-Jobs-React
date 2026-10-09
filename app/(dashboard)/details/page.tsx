import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { DetailsForm } from "@/components/details/details-form"
import { profileToDraft } from "@/lib/profile/draft"
import { degreeFromResume } from "@/lib/profile/resume"
import { getProfile } from "@/lib/profile/store"

export const metadata: Metadata = { title: "My Details" }

export default async function DetailsPage() {
  // Layouts and pages render in parallel, so the layout's redirect alone isn't enough.
  const profile = await getProfile()
  if (!profile?.onboarding_complete) redirect("/onboarding")

  const draft = profileToDraft(profile)
  // Profiles saved before spec 014 have no degree yet: suggest one from the resume for the candidate to confirm.
  draft.highestDegree ??= degreeFromResume(profile.resume_text)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-8 md:px-6">
      <DetailsForm initial={draft} />
    </div>
  )
}
