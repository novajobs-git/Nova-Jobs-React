import { redirect } from "next/navigation"

import { ApplicationsProvider } from "@/components/applications/applications-provider"
import { WorkbenchDock } from "@/components/applications/workbench-dock"
import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { TopBar } from "@/components/app-shell/top-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getApplications } from "@/lib/applications/store"
import { currentCandidateId } from "@/lib/candidate"
import { getEngine } from "@/lib/engine/store"
import { getProfile } from "@/lib/profile/store"

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile()
  if (!profile?.onboarding_complete) redirect("/onboarding")
  const candidateId = await currentCandidateId()
  const [applications, engine] = await Promise.all([getApplications(candidateId), getEngine(candidateId)])

  return (
    <ApplicationsProvider initial={{ applications, engine }}>
      <SidebarProvider style={{ "--sidebar-width": "15.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <TopBar candidateName={profile.full_name} />
          <div className="min-w-0 flex-1">{children}</div>
          <WorkbenchDock />
        </SidebarInset>
      </SidebarProvider>
    </ApplicationsProvider>
  )
}
