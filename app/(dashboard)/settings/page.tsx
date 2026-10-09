import type { Metadata } from "next"

import { AutoApplySettings } from "@/components/settings/auto-apply-settings"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-8 md:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>
      <AutoApplySettings />
    </div>
  )
}
