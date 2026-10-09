/** One candidate's Auto-Apply settings (data/engine/settings/<candidate>.json). */
export interface EngineSettings {
  /** The Auto-Apply toggle in the top bar: runs this candidate's engine. */
  enabled: boolean
  /** Settings: queue new matches without the candidate clicking Apply. */
  autoApplyMatches: boolean
  /** Settings: the engine clicks Submit itself. Off: it fills the form and the candidate submits in the live view. */
  autoSubmit: boolean
}

/** What a candidate gets before they change anything. Mirrors DEFAULT_SETTINGS in engine/store.py. */
export const DEFAULT_ENGINE_SETTINGS: EngineSettings = { enabled: false, autoApplyMatches: false, autoSubmit: false }

export type EngineState = "off" | "stopping" | "starting" | "idle" | "applying" | "limit" | "not_running"

export interface EngineStatus {
  state: EngineState
  /** What the engine is doing, in the candidate's words. */
  message: string
  jobId: string | null
}

export interface Engine {
  settings: EngineSettings
  status: EngineStatus
}
