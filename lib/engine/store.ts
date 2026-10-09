import "server-only"

import { spawn } from "node:child_process"
import { existsSync, openSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import { DEFAULT_ENGINE_SETTINGS, type Engine, type EngineSettings, type EngineStatus } from "./types"

/*
 * The app's side of the Auto-Apply engine (spec 012). Each candidate has
 * their own settings, status and Python worker (engine/worker.py
 * --candidate <id>); the app and the engine talk through files in data/
 * (see engine/store.py). Replaced by Supabase rows in spec 008.
 */
const ENGINE_DIR = path.join(process.cwd(), "data", "engine")
const PYTHON = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")

const files = (candidateId: string) => ({
  settings: path.join(ENGINE_DIR, "settings", `${candidateId}.json`),
  status: path.join(ENGINE_DIR, "status", `${candidateId}.json`),
  spawn: path.join(ENGINE_DIR, "spawn", `${candidateId}.json`),
  log: path.join(ENGINE_DIR, "logs", `${candidateId}.log`),
})

/** A worker whose heartbeat is older than this has died. */
const STALE_MS = 20_000
/** Playwright takes a few seconds to load before the first heartbeat. */
const STARTUP_GRACE_MS = 30_000

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return null
  }
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 1), "utf8")
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(tmp, file)
    } catch (e) {
      // Windows: the engine has the file open for a moment.
      if ((e as NodeJS.ErrnoException).code !== "EPERM" || attempt >= 20) throw e
      await new Promise((r) => setTimeout(r, 50 * attempt))
    }
  }
}

async function readSettings(candidateId: string): Promise<EngineSettings> {
  return { ...DEFAULT_ENGINE_SETTINGS, ...(await readJson<Partial<EngineSettings>>(files(candidateId).settings)) }
}

interface StatusFile {
  state: string
  message: string
  jobId: string | null
  heartbeatAt: string
}

async function readStatus(candidateId: string, settings: EngineSettings): Promise<EngineStatus> {
  const f = files(candidateId)
  const file = await readJson<StatusFile>(f.status)
  const alive = !!file && file.state !== "off" && Date.now() - Date.parse(file.heartbeatAt) < STALE_MS
  if (!settings.enabled) {
    return alive
      ? { state: "stopping", message: "Finishing the current application, then stopping", jobId: file!.jobId }
      : { state: "off", message: "Auto-Apply is off", jobId: null }
  }
  if (alive) return { state: file!.state as EngineStatus["state"], message: file!.message, jobId: file!.jobId }
  const spawned = await readJson<{ at: string }>(f.spawn)
  if (spawned && Date.now() - Date.parse(spawned.at) < STARTUP_GRACE_MS) {
    return { state: "starting", message: "Starting the engine", jobId: null }
  }
  return {
    state: "not_running",
    message: `The engine stopped unexpectedly. Details are in data/engine/logs/${candidateId}.log.`,
    jobId: null,
  }
}

export async function getEngine(candidateId: string): Promise<Engine> {
  const settings = await readSettings(candidateId)
  return { settings, status: await readStatus(candidateId, settings) }
}

/** True while this candidate's worker is alive (or starting). */
export async function engineRunning(candidateId: string): Promise<boolean> {
  const { status } = await getEngine(candidateId)
  return !["off", "not_running"].includes(status.state)
}

/** Starts this candidate's worker if Auto-Apply is on and none is alive or starting. */
export async function ensureWorker(candidateId: string): Promise<void> {
  const { settings, status } = await getEngine(candidateId)
  if (!settings.enabled || status.state !== "not_running") return
  if (!existsSync(PYTHON)) {
    throw new Error("The engine's Python environment is missing. Set up .venv from scripts/requirements.txt.")
  }
  const f = files(candidateId)
  await mkdir(path.dirname(f.log), { recursive: true })
  const log = openSync(f.log, "a")
  const child = spawn(PYTHON, ["-u", "-m", "engine.worker", "--candidate", candidateId], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
  })
  child.unref()
  await writeJsonAtomic(f.spawn, { at: new Date().toISOString(), pid: child.pid })
}

/** Changes this candidate's settings only. */
export async function updateSettings(candidateId: string, patch: Partial<EngineSettings>): Promise<Engine> {
  await writeJsonAtomic(files(candidateId).settings, { ...(await readSettings(candidateId)), ...patch })
  // Turning off needs nothing else: the worker exits after the current application.
  await ensureWorker(candidateId)
  return getEngine(candidateId)
}
