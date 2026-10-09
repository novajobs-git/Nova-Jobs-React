"use client"

import { useState } from "react"
import { TriangleAlertIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useApplications } from "@/components/applications/applications-provider"

interface AutoApplyConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Turning Auto-Apply on sends real applications to employers, so it needs
 * an explicit acknowledgement. The bullets follow the candidate's own
 * Settings, so they never promise or warn about something that won't happen.
 */
export function AutoApplyConfirm({ open, onOpenChange, onConfirm }: AutoApplyConfirmProps) {
  const { engine } = useApplications()
  const { autoSubmit, autoApplyMatches } = engine.settings
  const [understood, setUnderstood] = useState(false)

  const points = [
    autoSubmit
      ? "Applications submitted will not require your approval. The engine submits each one as soon as the form is filled."
      : "Each form is filled for you, then waits for you to review and submit it in the live view (Submit applications automatically is off in Settings).",
    autoApplyMatches
      ? "Your best new matches are applied to without you clicking Apply, up to your daily limit."
      : "Only jobs you've clicked Apply on are applied to, one at a time.",
    "Your saved profile and resume are used. Screening questions your profile doesn't cover are answered from your resume; demographic (EEO) questions are never guessed.",
    "You can pause or cancel any application in the Workbench, and turn Auto-Apply off at any time.",
  ]

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setUnderstood(false)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent className="gap-5 rounded-none sm:max-w-lg">
        <AlertDialogHeader className="items-start text-left">
          <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <TriangleAlertIcon className="size-5 shrink-0 text-destructive" aria-hidden />
            Turn on Auto-Apply?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm text-muted-foreground">
            Auto-Apply sends real applications to employers in your name. Before you turn it on:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="grid gap-2.5 text-sm">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="mt-[7px] size-1.5 shrink-0 bg-foreground" aria-hidden />
              <span className="text-pretty">{point}</span>
            </li>
          ))}
        </ul>

        <label htmlFor="auto-apply-understood" className="flex cursor-pointer items-start gap-3 border bg-muted/40 px-3 py-3 text-sm font-medium">
          <Checkbox
            id="auto-apply-understood"
            checked={understood}
            onCheckedChange={(checked) => setUnderstood(checked === true)}
            className="mt-0.5 size-[18px] rounded-none"
          />
          I understand, and I want to turn on auto apply
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-none"
            disabled={!understood}
            onClick={() => {
              setUnderstood(false)
              onConfirm()
            }}
          >
            Turn on Auto-Apply
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
