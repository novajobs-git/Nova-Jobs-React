"use client"

import { useEffect, useRef, useState } from "react"
import { CircleCheckIcon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PdfFileIcon } from "@/components/icons/pdf-file-icon"
import type { Analysis } from "@/lib/resume/analysis"
import { cn } from "@/lib/utils"

/*
 * The paced reveal (spec 013). Every stage is a check that really ran on the
 * server; the analysis usually returns in a second or two, and each stage's
 * finding is revealed at its own pace so the candidate can follow what was
 * checked. If the server is slower than the pacing, the stage waits for it.
 */
const STAGES = [
  { key: "read", label: "Reading the file" },
  { key: "sections", label: "Finding sections" },
  { key: "grammar", label: "Checking spelling and grammar" },
  { key: "impact", label: "Measuring impact in your bullets" },
  { key: "score", label: "Scoring" },
] as const satisfies { key: keyof Analysis["stages"]; label: string }[]

const STAGE_MS = 6000
const TICK_MS = 150

interface ScanProgressProps {
  fileName: string
  analysis: Analysis | null
  canSkip: boolean
  onDone: () => void
  onCancel: () => void
}

export function ScanProgress({ fileName, analysis, canSkip, onDone, onCancel }: ScanProgressProps) {
  const [completed, setCompleted] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const stageStart = useRef(0)
  const analysisRef = useRef(analysis)
  analysisRef.current = analysis
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    stageStart.current = Date.now()
    let done = 0
    const timer = window.setInterval(() => {
      const inStage = Date.now() - stageStart.current
      if (inStage >= STAGE_MS && analysisRef.current) {
        done += 1
        stageStart.current = Date.now()
        setCompleted(done)
        setElapsed(0)
        if (done === STAGES.length) {
          window.clearInterval(timer)
          window.setTimeout(() => onDoneRef.current(), 700)
        }
      } else {
        setElapsed(Math.min(inStage, STAGE_MS))
      }
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  const active = Math.min(completed, STAGES.length - 1)
  const finished = completed === STAGES.length
  const waiting = !finished && elapsed >= STAGE_MS && !analysis
  // Hold just short of the next stage's mark until its finding is in.
  const fraction = (completed + (finished ? 0 : (elapsed / STAGE_MS) * 0.96)) / STAGES.length
  const secondsLeft = Math.max(1, Math.ceil(((STAGES.length - completed) * STAGE_MS - elapsed) / 1000))

  return (
    <section aria-labelledby="scan-title" className="border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-3 md:px-5">
        <PdfFileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</p>
        {canSkip && analysis && !finished && (
          <Button variant="outline" size="sm" onClick={onDone}>
            Show results
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="px-4 py-6 md:px-5 md:py-7">
        <div className="flex items-end justify-between gap-4">
          <h2 id="scan-title" className="min-w-0 text-lg font-semibold tracking-tight">
            <span key={finished ? "done" : active} className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              {finished ? "Analysis complete" : `${STAGES[active].label}…`}
            </span>
          </h2>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums" aria-hidden>
            {finished ? "Done" : waiting ? "Finishing up" : `About ${secondsLeft}s left`}
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          className="relative mt-4 h-1.5 overflow-hidden bg-muted"
        >
          <div
            className="absolute inset-0 origin-left bg-primary transition-transform duration-150 ease-linear motion-reduce:transition-none"
            style={{ transform: `scaleX(${fraction})` }}
          />
          {/* A light sweep across the track: the analysis is alive, not frozen. */}
          {!finished && (
            <div className="absolute inset-y-0 left-0 w-1/3 animate-[scan-sweep_1.6s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/45 to-transparent motion-reduce:hidden dark:via-white/20" />
          )}
        </div>

        <ol className="mt-6 grid gap-1" aria-live="polite">
          {STAGES.map((stage, i) => {
            const state = i < completed ? "done" : i === active && !finished ? "active" : "pending"
            return (
              <li
                key={stage.key}
                className={cn(
                  "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 px-2 py-2 transition-colors duration-300",
                  state === "active" && "bg-primary/[0.04]",
                )}
              >
                <span className="flex h-5 items-center">
                  {state === "done" ? (
                    <CircleCheckIcon className="size-4 text-foreground animate-in zoom-in-50 duration-300 motion-reduce:animate-none" aria-label="Done" />
                  ) : state === "active" ? (
                    <LoaderCircleIcon className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-label="In progress" />
                  ) : (
                    <CircleDashedIcon className="size-4 text-muted-foreground/60" aria-label="Not started" />
                  )}
                </span>
                <span className={cn("text-sm", state === "pending" ? "text-muted-foreground" : "font-medium")}>{stage.label}</span>
                {state === "done" && analysis && (
                  <span className="col-start-2 mt-0.5 text-sm text-muted-foreground tabular-nums animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
                    {analysis.stages[stage.key]}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
