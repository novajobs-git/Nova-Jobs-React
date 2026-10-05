"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, LoaderCircleIcon, LogOutIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ChipInput, Chip } from "@/components/onboarding/chip-input"
import { ChoiceGroup } from "@/components/onboarding/choice-group"
import { ResumeDropzone } from "@/components/onboarding/resume-dropzone"
import { cn } from "@/lib/utils"
import {
  DISABILITY_STATUS,
  EEO_DEFAULTS,
  EXPERIENCE_YEARS,
  GENDER,
  RACE_ETHNICITY,
  VETERAN_STATUS,
  WORK_MODES,
  YES_NO,
} from "@/lib/profile/options"
import { onboardingSchema, stepSchemas, type OnboardingData, type ParsedResume, type StepKey } from "@/lib/profile/schema"

type Draft = Partial<OnboardingData>
type Errors = Partial<Record<string, string>>

const STEPS: { key: StepKey | "review"; title: string; subtitle?: string; section: string }[] = [
  { key: "resume", title: "Upload your resume", section: "Resume" },
  { key: "about", title: "About you", section: "About you" },
  { key: "links", title: "Your links", subtitle: "Optional", section: "Links" },
  { key: "preferences", title: "What you’re looking for", section: "Preferences" },
  { key: "skills", title: "Your skills", subtitle: "Jobs are matched on these.", section: "Skills" },
  { key: "authorization", title: "Are you authorized to work in the United States?", section: "Work authorization" },
  { key: "sponsorship", title: "Will you now or in the future require visa sponsorship?", section: "Sponsorship" },
  { key: "eeo", title: "Voluntary self-identification", subtitle: "Optional. Used only to answer these questions on applications.", section: "Self-identification" },
  { key: "review", title: "Review and finish", section: "Review" },
]

const INITIAL: Draft = {
  resumeId: "",
  resumeFileName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  targetTitles: [],
  targetLocations: [],
  workModes: [],
  currentTitle: "",
  desiredSalary: "",
  earliestStartDate: "",
  skills: [],
  ...EEO_DEFAULTS,
}

export function OnboardingFlow() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<Draft>(INITIAL)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const step = STEPS[index]
  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onResume = (resume: ParsedResume) => {
    setDraft((d) => {
      const filled = { ...d, resumeId: resume.resumeId, resumeFileName: resume.fileName, skills: resume.skills }
      // Pre-fill only what the candidate hasn't typed themselves.
      for (const [k, v] of Object.entries(resume.contact) as [keyof ParsedResume["contact"], string | undefined][]) {
        if (v && !d[k]) filled[k] = v
      }
      return filled
    })
    setErrors({})
  }

  const goTo = (i: number) => {
    setIndex(i)
    setErrors({})
    window.scrollTo({ top: 0 })
  }

  const next = async () => {
    if (step.key !== "review") {
      const result = stepSchemas[step.key].safeParse(draft)
      if (!result.success) {
        setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0] ?? step.key), i.message])))
        return
      }
      goTo(index + 1)
      return
    }
    const payload = onboardingSchema.safeParse(draft)
    if (!payload.success) {
      const field = String(payload.error.issues[0]?.path[0] ?? "")
      goTo(Math.max(0, STEPS.findIndex((s) => s.key !== "review" && field in stepSchemas[s.key].shape)))
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = (await (await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload.data) })).json()) as { success: boolean; error?: string }
      if (!res.success) throw new Error(res.error)
      router.push("/jobs")
      router.refresh()
    } catch (e) {
      setSaveError(e instanceof Error && e.message ? e.message : "Couldn’t save your profile. Try again.")
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Mirrors the dashboard: logo where the sidebar puts it, controls where TopBar puts them. */}
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="flex h-[66px] items-center gap-3 px-4 md:pr-8 md:pl-6">
          <Link href="/" className="font-logo text-[32px] leading-none" aria-label="NovaJobs">
            <span className="text-foreground">Nova</span>
            <span className="text-primary-hover">Jobs</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              Step {index + 1} of {STEPS.length}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className="flex size-10 items-center justify-center rounded-lg bg-primary-hover text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/30 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {draft.firstName?.trim() ? draft.firstName.trim()[0].toUpperCase() : <UserRoundIcon className="size-[18px]" aria-hidden />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {/* Wire to Clerk sign-out with spec 008, same as the sidebar's Log out. */}
                <DropdownMenuItem variant="destructive" onSelect={() => toast("Log out is coming soon")}>
                  <LogOutIcon aria-hidden />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Progress
          value={((index + 1) / STEPS.length) * 100}
          aria-label="Onboarding progress"
          className="h-1 rounded-none bg-primary/10 *:bg-primary-hover *:transition-transform *:duration-500"
        />
      </header>

      <main className="flex flex-1 justify-center px-5 pt-10 pb-16 sm:pt-16">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
          className="w-full max-w-[560px]"
        >
          <div key={step.key} className="animate-in duration-300 fade-in slide-in-from-right-3 motion-reduce:animate-none">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight text-balance">{step.title}</h1>
            {step.subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{step.subtitle}</p>}
            <div className="mt-8">
              <StepBody stepKey={step.key} draft={draft} set={set} errors={errors} onResume={onResume} onEdit={goTo} />
            </div>
          </div>

          {saveError && (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {saveError}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between gap-3">
            {index > 0 ? (
              <Button type="button" variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={() => goTo(index - 1)}>
                <ArrowLeftIcon data-icon="inline-start" /> Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" className="h-11 min-w-36 px-6 text-[15px]" disabled={saving}>
              {saving && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" data-icon="inline-start" />}
              {step.key === "review" ? (saving ? "Saving…" : "Finish") : "Continue"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

interface StepBodyProps {
  stepKey: StepKey | "review"
  draft: Draft
  set: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void
  errors: Errors
  onResume: (r: ParsedResume) => void
  onEdit: (index: number) => void
}

function StepBody({ stepKey, draft, set, errors, onResume, onEdit }: StepBodyProps) {
  switch (stepKey) {
    case "resume":
      return (
        <>
          <ResumeDropzone fileName={draft.resumeFileName} skillCount={draft.skills?.length} onUploaded={onResume} invalid={!!errors.resumeId} />
          <FieldError message={errors.resumeId} />
        </>
      )

    case "about":
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="firstName" label="First name" autoComplete="given-name" draft={draft} set={set} errors={errors} />
          <TextField id="lastName" label="Last name" autoComplete="family-name" draft={draft} set={set} errors={errors} />
          <TextField id="email" label="Email" type="email" autoComplete="email" draft={draft} set={set} errors={errors} className="sm:col-span-2" />
          <TextField id="phone" label="Phone" type="tel" autoComplete="tel" draft={draft} set={set} errors={errors} className="sm:col-span-2" />
          <TextField id="location" label="City and state" placeholder="Austin, TX" autoComplete="address-level2" draft={draft} set={set} errors={errors} className="sm:col-span-2" />
        </div>
      )

    case "links":
      return (
        <div className="grid gap-5">
          <TextField id="linkedinUrl" label="LinkedIn" type="url" placeholder="https://linkedin.com/in/you" draft={draft} set={set} errors={errors} />
          <TextField id="githubUrl" label="GitHub" type="url" placeholder="https://github.com/you" draft={draft} set={set} errors={errors} />
          <TextField id="portfolioUrl" label="Portfolio or website" type="url" placeholder="https://" draft={draft} set={set} errors={errors} />
        </div>
      )

    case "preferences":
      return (
        <div className="grid gap-6">
          <FieldShell id="targetTitles" label="Job titles you want" error={errors.targetTitles}>
            <ChipInput id="targetTitles" value={draft.targetTitles ?? []} onChange={(v) => set("targetTitles", v)} placeholder="e.g. Frontend Engineer, then Enter" invalid={!!errors.targetTitles} />
          </FieldShell>
          <FieldShell id="targetLocations" label="Preferred locations" error={errors.targetLocations}>
            <ChipInput id="targetLocations" value={draft.targetLocations ?? []} onChange={(v) => set("targetLocations", v)} placeholder="e.g. New York, NY, then Enter" />
          </FieldShell>
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium">Work setup</legend>
            <div className="flex flex-wrap gap-2.5">
              {WORK_MODES.map((mode) => {
                const checked = draft.workModes?.includes(mode) ?? false
                return (
                  <label
                    key={mode}
                    className={cn(
                      "flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-4 text-[15px] transition-colors hover:border-primary/40",
                      checked && "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(on) =>
                        set("workModes", on ? [...(draft.workModes ?? []), mode] : (draft.workModes ?? []).filter((m) => m !== mode))
                      }
                    />
                    {mode}
                  </label>
                )
              })}
            </div>
            <FieldError message={errors.workModes} />
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="currentTitle" label="Current or last job title" draft={draft} set={set} errors={errors} />
            <FieldShell id="yearsExperience" label="Years of experience" error={errors.yearsExperience}>
              <Select value={draft.yearsExperience ?? ""} onValueChange={(v) => set("yearsExperience", v as OnboardingData["yearsExperience"])}>
                <SelectTrigger id="yearsExperience" className="h-11! w-full bg-card" aria-invalid={!!errors.yearsExperience || undefined}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y} years
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
            <TextField id="desiredSalary" label="Desired salary (USD / year)" placeholder="120,000" inputMode="numeric" draft={draft} set={set} errors={errors} />
            <TextField id="earliestStartDate" label="Earliest start date" type="date" draft={draft} set={set} errors={errors} />
          </div>
        </div>
      )

    case "skills": {
      const skills = draft.skills ?? []
      return (
        <>
          <ChipInput id="skills" value={skills} onChange={(v) => set("skills", v)} placeholder="Add a skill, then Enter" invalid={!!errors.skills} />
          {skills.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No skills found in your resume yet.</p>}
          <FieldError message={errors.skills} />
        </>
      )
    }

    case "authorization":
      return (
        <>
          <ChoiceGroup name="workAuthorization" options={YES_NO} value={draft.workAuthorization} onChange={(v) => set("workAuthorization", v as OnboardingData["workAuthorization"])} invalid={!!errors.workAuthorization} label="Work authorization" size="lg" />
          <FieldError message={errors.workAuthorization} />
        </>
      )

    case "sponsorship":
      return (
        <>
          <ChoiceGroup name="needsSponsorship" options={YES_NO} value={draft.needsSponsorship} onChange={(v) => set("needsSponsorship", v as OnboardingData["needsSponsorship"])} invalid={!!errors.needsSponsorship} label="Visa sponsorship" size="lg" />
          <FieldError message={errors.needsSponsorship} />
        </>
      )

    case "eeo":
      return (
        <div className="grid gap-8">
          <EeoQuestion label="Gender" name="gender" options={GENDER} value={draft.gender} onChange={(v) => set("gender", v as OnboardingData["gender"])} />
          <EeoQuestion label="Race / ethnicity" name="raceEthnicity" options={RACE_ETHNICITY} value={draft.raceEthnicity} onChange={(v) => set("raceEthnicity", v as OnboardingData["raceEthnicity"])} />
          <EeoQuestion label="Veteran status" name="veteranStatus" options={VETERAN_STATUS} value={draft.veteranStatus} onChange={(v) => set("veteranStatus", v as OnboardingData["veteranStatus"])} />
          <EeoQuestion label="Disability status" name="disabilityStatus" options={DISABILITY_STATUS} value={draft.disabilityStatus} onChange={(v) => set("disabilityStatus", v as OnboardingData["disabilityStatus"])} />
        </div>
      )

    case "review":
      return <Review draft={draft} onEdit={onEdit} />
  }
}

function EeoQuestion({ label, name, options, value, onChange }: { label: string; name: string; options: readonly string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold">{label}</legend>
      <ChoiceGroup name={name} options={options} value={value} onChange={onChange} label={label} />
    </fieldset>
  )
}

type TextKey = "firstName" | "lastName" | "email" | "phone" | "location" | "linkedinUrl" | "githubUrl" | "portfolioUrl" | "currentTitle" | "desiredSalary" | "earliestStartDate"

interface TextFieldProps extends Omit<React.ComponentProps<typeof Input>, "id"> {
  id: TextKey
  label: string
  draft: Draft
  set: StepBodyProps["set"]
  errors: Errors
}

function TextField({ id, label, draft, set, errors, className, ...input }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={errors[id]} className={className}>
      <Input
        id={id}
        value={draft[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        aria-invalid={!!errors[id] || undefined}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        className="h-11 bg-card text-[15px]"
        {...input}
      />
    </FieldShell>
  )
}

function FieldShell({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-destructive">
      {message}
    </p>
  )
}

function Review({ draft, onEdit }: { draft: Draft; onEdit: (index: number) => void }) {
  const stepIndex = (key: StepKey) => STEPS.findIndex((s) => s.key === key)
  const join = (v?: string[]) => (v?.length ? v.join(", ") : "—")
  const sections: { key: StepKey; rows: [string, string | React.ReactNode][] }[] = [
    { key: "resume", rows: [["File", draft.resumeFileName || "—"]] },
    {
      key: "about",
      rows: [
        ["Name", `${draft.firstName ?? ""} ${draft.lastName ?? ""}`.trim() || "—"],
        ["Email", draft.email || "—"],
        ["Phone", draft.phone || "—"],
        ["Location", draft.location || "—"],
      ],
    },
    {
      key: "links",
      rows: [
        ["LinkedIn", draft.linkedinUrl || "—"],
        ["GitHub", draft.githubUrl || "—"],
        ["Portfolio", draft.portfolioUrl || "—"],
      ],
    },
    {
      key: "preferences",
      rows: [
        ["Job titles", join(draft.targetTitles)],
        ["Locations", join(draft.targetLocations)],
        ["Work setup", join(draft.workModes)],
        ["Experience", draft.yearsExperience ? `${draft.yearsExperience} years` : "—"],
        ["Salary", draft.desiredSalary ? `$${draft.desiredSalary}` : "—"],
        ["Start date", draft.earliestStartDate || "—"],
      ],
    },
    {
      key: "skills",
      rows: [["", <span key="s" className="flex flex-wrap gap-1.5">{(draft.skills ?? []).map((s) => <Chip key={s} label={s} className="h-7 text-xs" />)}</span>]],
    },
    { key: "authorization", rows: [["Authorized to work in the US", draft.workAuthorization ?? "—"]] },
    { key: "sponsorship", rows: [["Requires sponsorship", draft.needsSponsorship ?? "—"]] },
    {
      key: "eeo",
      rows: [
        ["Gender", draft.gender ?? "—"],
        ["Race / ethnicity", draft.raceEthnicity ?? "—"],
        ["Veteran status", draft.veteranStatus ?? "—"],
        ["Disability status", draft.disabilityStatus ?? "—"],
      ],
    },
  ]

  return (
    <div className="divide-y rounded-panel border bg-card">
      {sections.map(({ key, rows }) => (
        <section key={key} className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">{STEPS[stepIndex(key)].section}</h2>
            <button type="button" onClick={() => onEdit(stepIndex(key))} className="text-sm font-medium text-primary-hover hover:underline hover:underline-offset-4">
              Edit
            </button>
          </div>
          <dl className="grid gap-1.5">
            {rows.map(([label, value], i) => (
              <div key={i} className="grid gap-x-4 text-sm sm:grid-cols-[11rem_1fr]">
                {label && <dt className="text-muted-foreground">{label}</dt>}
                <dd className={cn("break-words", !label && "sm:col-span-2")}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
