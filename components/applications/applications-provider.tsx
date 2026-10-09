"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { Application } from "@/lib/applications/types"
import type { Engine, EngineSettings } from "@/lib/engine/types"
import type { Job } from "@/lib/jobs/types"

type QueueAction = "pause" | "resume" | "cancel"

interface ApplicationsContextValue {
  applications: Application[]
  engine: Engine
  /** Queues the job; resolves to its place in line, or null if it couldn't be queued. */
  apply: (job: Job) => Promise<number | null>
  control: (jobId: string, action: QueueAction) => Promise<void>
  /** The top-bar toggle: runs the engine. */
  autoApply: boolean
  setAutoApply: (on: boolean) => Promise<void>
  setEngineSettings: (patch: Partial<EngineSettings>) => Promise<boolean>
}

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null)

const POLL_MS = 3000

type State = { applications: Application[]; engine: Engine }
type Envelope<T> = { success: true; data: T } | { success: false; error: string }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!json?.success) throw new Error(json && !json.success ? json.error : `The server answered ${res.status}.`)
  return json.data
}

/*
 * The candidate's applications and the Auto-Apply engine, shared by the Jobs
 * page, Dashboard and Workbench. The engine (engine/worker.py) changes
 * applications in the background, so this polls while anything is moving.
 */
export function ApplicationsProvider({ initial, children }: { initial: State; children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial)
  const { applications, engine } = state

  const busy = engine.settings.enabled || engine.status.state === "stopping" || applications.some((a) => a.status === "applying")
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => {
      call<State>("/api/applications").then(setState, () => {})
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [busy])

  const apply = useCallback(async (job: Job) => {
    try {
      const next = await call<State>("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id }) })
      setState(next)
      const queued = next.applications.filter((a) => a.status === "queued").sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
      return queued.findIndex((a) => a.jobId === job.id) + 1 || null
    } catch (e) {
      toast.error(`Couldn't queue ${job.role}`, { description: e instanceof Error ? e.message : "Try again." })
      return null
    }
  }, [])

  const control = useCallback(async (jobId: string, action: QueueAction) => {
    try {
      setState(await call<State>("/api/applications/control", { method: "POST", body: JSON.stringify({ jobId, action }) }))
    } catch (e) {
      toast.error(`Couldn't ${action} that application`, { description: e instanceof Error ? e.message : "Try again." })
    }
  }, [])

  const setEngineSettings = useCallback(async (patch: Partial<EngineSettings>) => {
    try {
      const next = await call<Engine>("/api/engine", { method: "PUT", body: JSON.stringify(patch) })
      setState((s) => ({ ...s, engine: next }))
      return true
    } catch (e) {
      toast.error("Couldn't update Auto-Apply", { description: e instanceof Error ? e.message : "Try again." })
      return false
    }
  }, [])

  const setAutoApply = useCallback(
    async (on: boolean) => {
      if (!(await setEngineSettings({ enabled: on }))) return
      toast(on ? "Auto-Apply is on" : "Auto-Apply is off", {
        description: on
          ? "The engine applies to your queue one job at a time."
          : "The engine stops after the application it's working on.",
      })
    },
    [setEngineSettings],
  )

  const value = useMemo(
    () => ({ applications, engine, apply, control, autoApply: engine.settings.enabled, setAutoApply, setEngineSettings }),
    [applications, engine, apply, control, setAutoApply, setEngineSettings],
  )
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>
}

export function useApplications() {
  const ctx = useContext(ApplicationsContext)
  if (!ctx) throw new Error("useApplications must be used within ApplicationsProvider")
  return ctx
}

/** Queued jobs in the order they'll be worked on. */
export function queueOrder(applications: Application[]): Application[] {
  return applications
    .filter((a) => a.status === "queued")
    .sort((a, b) => Date.parse(a.queuedAt) - Date.parse(b.queuedAt))
}
