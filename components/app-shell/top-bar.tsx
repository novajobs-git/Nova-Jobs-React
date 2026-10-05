"use client"

import { BellIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { useApplications } from "@/components/applications/applications-provider"

export function TopBar({ candidateName }: { candidateName: string }) {
  const { autoApply, setAutoApply } = useApplications()

  return (
    <header className="sticky top-0 z-20 flex h-[66px] shrink-0 items-center gap-3 border-b bg-card px-4 md:px-8">
      <SidebarTrigger className="-ml-1.5 md:hidden" />
      <div className="ml-auto flex items-center gap-3">
        <Button
          variant="outline"
          className="hidden h-9 gap-2 border-primary/25 bg-primary/8 px-3.5 font-normal text-foreground/80 hover:bg-primary/12 sm:inline-flex"
          onClick={() => toast("My Details is coming soon")}
        >
          <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden />
          My Details
        </Button>

        <label className="flex items-center gap-2.5 text-[15px] font-medium text-foreground/85">
          Auto-Apply
          <Switch
            checked={autoApply}
            onCheckedChange={(on) => {
              setAutoApply(on)
              toast(on ? "Auto-Apply turned on" : "Auto-Apply paused")
            }}
            className="h-[26px]! w-[46px]! px-[2px] data-checked:bg-primary-hover *:size-5! *:data-checked:translate-x-5!"
          />
        </label>

        <Button
          variant="outline"
          size="icon"
          aria-label="Notifications, 1 unread"
          className="relative border-primary/25 bg-primary/8 text-muted-foreground hover:bg-primary/12"
          onClick={() => toast("No new notifications")}
        >
          <BellIcon className="size-[18px]" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-none bg-destructive" aria-hidden />
        </Button>

        <span
          className="flex size-10 items-center justify-center rounded-lg bg-primary-hover text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/30"
          aria-label={candidateName}
          role="img"
        >
          {candidateName[0]?.toUpperCase()}
        </span>
      </div>
    </header>
  )
}
