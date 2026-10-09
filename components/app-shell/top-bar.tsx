"use client"

import { useState } from "react"
import Link from "next/link"
import { BellIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { useApplications } from "@/components/applications/applications-provider"
import { AutoApplyConfirm } from "@/components/app-shell/auto-apply-confirm"

export function TopBar({ candidateName }: { candidateName: string }) {
  const { autoApply, setAutoApply } = useApplications()
  // Turning on sends applications without asking, so it is confirmed first; turning off never is.
  const [confirming, setConfirming] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-[66px] shrink-0 items-center gap-3 border-b bg-card px-4 md:px-8">
      <SidebarTrigger className="-ml-1.5 md:hidden" />
      <div className="ml-auto flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          className="hidden h-9 gap-2 px-2 font-normal text-foreground/80 hover:bg-transparent hover:text-foreground sm:inline-flex"
        >
          <Link href="/details">
            <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden />
            My Details
          </Link>
        </Button>

        <label className="flex items-center gap-2.5 text-[15px] font-medium text-foreground/85">
          Auto-Apply
          <Switch
            checked={autoApply}
            onCheckedChange={(on) => (on ? setConfirming(true) : setAutoApply(false))}
            // Round, unlike the square system: the one toggle that runs the engine reads as a switch at a glance.
            className="h-[26px]! w-[46px]! rounded-full! px-[2px] data-checked:bg-primary-hover *:size-5! *:rounded-full! *:data-checked:translate-x-5!"
          />
        </label>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications, 1 unread"
          className="relative text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => toast("No new notifications")}
        >
          <BellIcon className="size-[18px]" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-none bg-destructive" aria-hidden />
        </Button>

        <span className="flex size-10 items-center justify-center text-muted-foreground" aria-label={candidateName} role="img">
          <UserRoundIcon className="size-[22px]" aria-hidden />
        </span>
      </div>
      <AutoApplyConfirm open={confirming} onOpenChange={setConfirming} onConfirm={() => setAutoApply(true)} />
    </header>
  )
}
