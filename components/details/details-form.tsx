"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { STEPS, StepBody, type Draft, type Errors } from "@/components/onboarding/onboarding-flow"
import { onboardingSchema, stepSchemas, type OnboardingData, type ParsedResume, type StepKey } from "@/lib/profile/schema"

/*
 * My Details: everything collected in onboarding, editable in one place.
 * Each section is the onboarding step's own body and validation, so the
 * fields, options and rules (e.g. EEO answers are only ever the candidate's
 * choice) can't drift between the two screens.
 */
const SECTIONS: { id: string; title: string; subtitle?: string; steps: StepKey[] }[] = [
  { id: "resume", title: "Resume", subtitle: "Replacing it updates your skills from the new file.", steps: ["resume"] },
  { id: "about", title: "About you", steps: ["about"] },
  { id: "links", title: "Your links", subtitle: "Optional", steps: ["links"] },
  { id: "preferences", title: "What you’re looking for", steps: ["preferences"] },
  { id: "skills", title: "Your skills", subtitle: "Jobs are matched on these.", steps: ["skills"] },
  { id: "work", title: "Work authorization", steps: ["authorization", "sponsorship"] },
  { id: "eeo", title: "Voluntary self-identification", subtitle: "Optional. Used only to answer these questions on applications.", steps: ["eeo"] },
]

const stepTitle = (key: StepKey) => STEPS.find((s) => s.key === key)?.title ?? ""

export function DetailsForm({ initial }: { initial: Draft }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved])

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // A new resume replaces the file and its skills; contact details already filled in stay as they are.
  const onResume = (resume: ParsedResume) => {
    setDraft((d) => {
      const next = { ...d, resumeId: resume.resumeId, resumeFileName: resume.fileName, skills: resume.skills }
      for (const [k, v] of Object.entries(resume.contact) as [keyof ParsedResume["contact"], string | undefined][]) {
        if (v && !d[k]) next[k] = v
      }
      return next
    })
    setErrors((e) => ({ ...e, resumeId: undefined, skills: undefined }))
  }

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const save = async () => {
    const next: Errors = {}
    let firstSection: string | null = null
    for (const section of SECTIONS) {
      for (const step of section.steps) {
        const result = stepSchemas[step].safeParse(draft)
        if (!result.success) {
          for (const issue of result.error.issues) next[String(issue.path[0] ?? step)] ??= issue.message
          firstSection ??= section.id
        }
      }
    }
    setErrors(next)
    const payload = onboardingSchema.safeParse(draft)
    if (firstSection || !payload.success) {
      toast.error("Some details need fixing", { description: "Check the highlighted fields." })
      document.getElementById(`details-${firstSection ?? "about"}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      })
      const json = (await res.json().catch(() => null)) as { success: boolean; data?: { matchedJobs: number }; error?: string } | null
      if (!json?.success) throw new Error(json?.error || `The server answered ${res.status}.`)
      setSaved(JSON.stringify(draft))
      toast.success("Details saved", {
        description: json.data ? `Your job matches were updated: ${json.data.matchedJobs} jobs match.` : undefined,
      })
      router.refresh()
    } catch (e) {
      toast.error("Details not saved", { description: e instanceof Error ? e.message : "Try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="sticky top-[66px] z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Details</h1>
          <p className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "Used to fill in every application."}</p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft(JSON.parse(saved) as Draft)
                setErrors({})
              }}
              disabled={saving}
            >
              Discard changes
            </Button>
          )}
          <Button onClick={save} disabled={saving || !dirty} className="min-w-28">
            {saving && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" data-icon="inline-start" aria-hidden />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} id={`details-${section.id}`} aria-labelledby={`details-${section.id}-title`} className="scroll-mt-40 border bg-card">
          <header className="border-b px-4 py-3 md:px-5">
            <h2 id={`details-${section.id}-title`} className="text-base font-semibold">
              {section.title}
            </h2>
            {section.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{section.subtitle}</p>}
          </header>
          <div className="grid gap-8 px-4 py-5 md:px-5">
            {section.steps.map((step) => (
              <div key={step}>
                {section.steps.length > 1 && <p className="mb-3 text-[15px] font-medium text-pretty">{stepTitle(step)}</p>}
                <StepBody stepKey={step} draft={draft} set={set} errors={errors} onResume={onResume} onEdit={() => {}} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
