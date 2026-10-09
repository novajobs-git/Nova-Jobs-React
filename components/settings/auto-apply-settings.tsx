"use client"

import { useState } from "react"

import { Switch } from "@/components/ui/switch"
import { useApplications } from "@/components/applications/applications-provider"
import type { EngineSettings } from "@/lib/engine/types"

/** The signed-in candidate's own Auto-Apply options; they don't change anyone else's. */
export function AutoApplySettings() {
  return (
    <section aria-labelledby="auto-apply-title" className="border bg-card">
      <header className="border-b px-4 py-3 md:px-5">
        <h2 id="auto-apply-title" className="text-base font-semibold">
          Auto-Apply
        </h2>
      </header>
      <div className="divide-y">
        <SettingRow
          setting="autoSubmit"
          title="Submit applications automatically"
          description="On: the engine fills each form and submits it. Off: it fills the form and stops, and you review it in the live view (Watch live in the Workbench) and click Submit yourself."
        />
        <SettingRow
          setting="autoApplyMatches"
          title="Apply to matches automatically"
          description="While Auto-Apply is on, your best new matches are queued and applied to without you clicking Apply, up to your daily limit. Off: only jobs you click Apply on are sent."
        />
      </div>
    </section>
  )
}

function SettingRow({ setting, title, description }: { setting: Exclude<keyof EngineSettings, "enabled">; title: string; description: string }) {
  const { engine, setEngineSettings } = useApplications()
  const [saving, setSaving] = useState(false)
  const id = `setting-${setting}`

  return (
    <div className="flex items-start justify-between gap-6 px-4 py-4 md:px-5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-medium">
          {title}
        </label>
        <p className="mt-1 max-w-[65ch] text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={engine.settings[setting]}
        disabled={saving}
        onCheckedChange={async (next) => {
          setSaving(true)
          await setEngineSettings({ [setting]: next })
          setSaving(false)
        }}
        className="mt-0.5 h-[26px]! w-[46px]! shrink-0 rounded-full! px-[2px] data-checked:bg-primary-hover *:size-5! *:rounded-full! *:data-checked:translate-x-5!"
      />
    </div>
  )
}
