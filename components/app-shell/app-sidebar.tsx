"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOutIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// "Dashboard" is the matched-jobs landing page (user flow step 3).
const NAV = [
  { href: "/jobs", label: "Dashboard" },
  { href: null, label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/resume", label: "Resume Builder" },
  { href: null, label: "Resume Analysis" },
  { href: null, label: "Settings" },
] as const

const itemClass =
  "relative flex h-10 w-full items-center rounded-lg px-3 text-[15px] text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/40"

const soon = (label: string) => () => toast(`${label} is coming soon`)

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="px-6 pt-6 pb-5">
        <Link href="/jobs" className="font-logo text-[32px] leading-none" aria-label="NovaJobs home">
          <span className="text-foreground">Nova</span>
          <span className="text-primary-hover">Jobs</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3.5">
        <SidebarMenu className="gap-1">
          {NAV.map((item) => {
            const active = item.href !== null && pathname.startsWith(item.href)
            return (
              <SidebarMenuItem key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      itemClass,
                      active &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-lg before:bg-primary-hover",
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button type="button" onClick={soon(item.label)} className={cn(itemClass, "text-left")}>
                    {item.label}
                  </button>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mx-3.5 mb-3 gap-1 border-t border-sidebar-border px-0 pt-4">
        <button type="button" onClick={soon("My Details")} className={cn(itemClass, "gap-2.5 text-[15px]")}>
          <UserRoundIcon className="size-[18px]" aria-hidden />
          My Details
        </button>
        <button
          type="button"
          onClick={soon("Log out")}
          className={cn(itemClass, "gap-2.5 text-destructive hover:bg-destructive/8 hover:text-destructive")}
        >
          <LogOutIcon className="size-[18px]" aria-hidden />
          Log out
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
