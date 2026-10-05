"use client"

import { useState } from "react"
import { SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { SuggestRequest, Suggestion } from "@/lib/resume/types"

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; suggestion: Suggestion }
  | { status: "error"; error: string }

export async function requestSuggestion(request: SuggestRequest): Promise<Suggestion> {
  const res = await fetch("/api/resume/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  const json = (await res.json().catch(() => null)) as { success: boolean; data?: Suggestion; error?: string } | null
  if (!json?.success || !json.data) throw new Error(json?.error || "Couldn't reach the writing service. Try again.")
  return json.data
}

/** Suggest-then-accept: nothing reaches the document until the candidate accepts. */
export function useSuggestion(request: () => SuggestRequest) {
  const [state, setState] = useState<State>({ status: "idle" })
  const run = async () => {
    setState({ status: "loading" })
    try {
      setState({ status: "ready", suggestion: await requestSuggestion(request()) })
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : "Something went wrong. Try again." })
    }
  }
  return { state, run, reset: () => setState({ status: "idle" }) }
}

export function WriteWithAIButton({ onClick, busy, label = "Write with AI" }: { onClick: () => void; busy: boolean; label?: string }) {
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onClick} disabled={busy} className="-mr-1.5 text-primary-hover hover:text-primary-hover">
      <SparklesIcon data-icon="inline-start" aria-hidden />
      {busy ? "Writing…" : label}
    </Button>
  )
}

interface PanelProps {
  state: State
  onRetry: () => void
  onDiscard: () => void
  children?: React.ReactNode
  actions?: React.ReactNode
}

export function SuggestionPanel({ state, onRetry, onDiscard, children, actions }: PanelProps) {
  if (state.status === "idle") return null
  return (
    <div
      role="region"
      aria-label="AI suggestion"
      aria-live="polite"
      className="mt-2 rounded-lg border bg-muted/40 p-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Suggestion</span>
        {state.status === "ready" && state.suggestion.placeholder && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Placeholder: AI isn&rsquo;t connected yet
          </Badge>
        )}
      </div>

      {state.status === "loading" && (
        <div className="grid gap-2 py-1" aria-label="Writing suggestion">
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
              Close
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {children}
          <div className="mt-3 flex flex-wrap justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
            {actions}
          </div>
        </>
      )}
    </div>
  )
}
