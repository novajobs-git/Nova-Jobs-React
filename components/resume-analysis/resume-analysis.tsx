"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { AnalysisResults } from "@/components/resume-analysis/analysis-results"
import { ScanProgress } from "@/components/resume-analysis/scan-progress"
import { UploadPanel } from "@/components/resume-analysis/upload-panel"
import type { Analysis } from "@/lib/resume/analysis"

type Phase =
  | { name: "upload" }
  | { name: "scanning"; fileName: string; analysis: Analysis | null; run: number }
  | { name: "results"; analysis: Analysis }

// After one full analysis, later runs offer a "Show results" skip.
const SEEN_KEY = "novajobs:resume-analysis-seen"
const seenBefore = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1"
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1")
  } catch {
    // Private mode: the skip just won't be offered.
  }
}

type Envelope = { success: true; data: Analysis } | { success: false; error: string }

export function ResumeAnalysis({ storedFileName }: { storedFileName: string | null }) {
  const [phase, setPhase] = useState<Phase>({ name: "upload" })
  const [canSkip, setCanSkip] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const run = useRef(0)

  const start = async (fileName: string, init: RequestInit) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    const id = ++run.current
    setCanSkip(seenBefore())
    setPhase({ name: "scanning", fileName, analysis: null, run: id })
    try {
      const res = await fetch("/api/resume/analyze", { method: "POST", signal: controller.signal, ...init })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!json?.success) throw new Error(json?.error || `The analysis service answered ${res.status}. Try again.`)
      setPhase((p) => (p.name === "scanning" && p.run === id ? { ...p, analysis: json.data } : p))
    } catch (e) {
      if (controller.signal.aborted) return
      setPhase({ name: "upload" })
      toast.error("Couldn't analyze your resume", {
        description: e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Check your connection and try again.",
      })
    }
  }

  const analyzeFile = (file: File) => {
    const body = new FormData()
    body.append("resume", file)
    start(file.name, { body })
  }

  const analyzeStored = () =>
    start(storedFileName ?? "Resume on file", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "stored" }) })

  const reset = () => {
    abort.current?.abort()
    setPhase({ name: "upload" })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="grid gap-4">
      {phase.name === "upload" && <UploadPanel storedFileName={storedFileName} onFile={analyzeFile} onStored={analyzeStored} />}
      {phase.name === "scanning" && (
        <ScanProgress
          key={phase.run}
          fileName={phase.fileName}
          analysis={phase.analysis}
          canSkip={canSkip}
          onCancel={reset}
          onDone={() => {
            if (!phase.analysis) return
            markSeen()
            setPhase({ name: "results", analysis: phase.analysis })
          }}
        />
      )}
      {phase.name === "results" && <AnalysisResults analysis={phase.analysis} onReset={reset} />}
    </div>
  )
}
