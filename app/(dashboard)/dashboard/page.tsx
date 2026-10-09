import type { Metadata } from "next"

import { ApplicationsByDay } from "@/components/dashboard/applications-by-day"
import { NeedsReview } from "@/components/dashboard/needs-review"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <div className="w-full px-4 pt-5 pb-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </header>
      <div className="flex min-w-0 flex-col gap-4">
        <ApplicationsByDay />
        <NeedsReview />
      </div>
    </div>
  )
}
