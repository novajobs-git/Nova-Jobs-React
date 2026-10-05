import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { JobsView } from "@/components/jobs/jobs-view"
import { getMatchedJobs } from "@/lib/jobs/matches"
import { getProfile } from "@/lib/profile/store"

export const metadata: Metadata = { title: "Dashboard" }

export default async function JobsPage() {
  // Layouts and pages render in parallel, so the layout's redirect alone isn't enough.
  const profile = await getProfile()
  if (!profile?.onboarding_complete) redirect("/onboarding")
  const jobs = await getMatchedJobs(profile)

  return (
    <div className="w-full px-4 pt-9 pb-10 sm:px-6 md:px-10">
      <JobsView jobs={jobs} firstName={profile.first_name} />
    </div>
  )
}
