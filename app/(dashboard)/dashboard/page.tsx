import type { Metadata } from "next"

import { ApplicationsView } from "@/components/applications/applications-view"

export const metadata: Metadata = { title: "Applications" }

export default function ApplicationsPage() {
  return (
    <div className="w-full px-4 pt-5 pb-8">
      <ApplicationsView />
    </div>
  )
}
