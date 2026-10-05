"use client"

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip, ChipInput } from "@/components/onboarding/chip-input"
import { SuggestionPanel, useSuggestion, WriteWithAIButton } from "@/components/resume/ai-suggestion"
import { RichTextEditor } from "@/components/resume/rich-text-editor"
import { emptyDoc, newId, type ResumeDoc } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

export type Update = (fn: (doc: ResumeDoc) => ResumeDoc) => void

interface SectionProps {
  doc: ResumeDoc
  update: Update
}

function Field({ id, label, className, ...input }: { id: string; label: string; className?: string } & React.ComponentProps<"input">) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input id={id} className="bg-card" {...input} />
    </div>
  )
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

type ListKey = "experience" | "education" | "projects"

/** Shared list behaviour: reorder and remove (with undo) for repeatable entries. */
function useEntries<K extends ListKey>(update: Update, key: K, noun: string) {
  type Entry = ResumeDoc[K][number]
  const patch = (id: string, fields: Partial<Entry>) =>
    update((d) => ({ ...d, [key]: (d[key] as Entry[]).map((e) => (e.id === id ? { ...e, ...fields } : e)) }))
  const shift = (index: number, by: number) => update((d) => ({ ...d, [key]: move(d[key] as Entry[], index, index + by) }))
  const remove = (index: number) => {
    let removed: Entry | undefined
    update((d) => {
      const list = [...(d[key] as Entry[])]
      removed = list.splice(index, 1)[0]
      return { ...d, [key]: list }
    })
    toast(`${noun} removed`, {
      action: {
        label: "Undo",
        onClick: () =>
          removed &&
          update((d) => {
            const list = [...(d[key] as Entry[])]
            list.splice(index, 0, removed!)
            return { ...d, [key]: list }
          }),
      },
    })
  }
  return { patch, shift, remove }
}

function EntryHeader({ title, index, count, noun, onShift, onRemove }: {
  title: string
  index: number
  count: number
  noun: string
  onShift: (by: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => onShift(-1)}>
        <ArrowUpIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${title} down`} disabled={index === count - 1} onClick={() => onShift(1)}>
        <ArrowDownIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${noun.toLowerCase()} ${title}`}
        onClick={onRemove}
        className="text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="w-full border-dashed">
      <PlusIcon data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-sm text-muted-foreground">{children}</p>
}

export function ContactSection({ doc, update }: SectionProps) {
  const c = doc.contact
  const set = (fields: Partial<ResumeDoc["contact"]>) => update((d) => ({ ...d, contact: { ...d.contact, ...fields } }))
  const setLink = (id: string, fields: { label?: string; url?: string }) =>
    set({ links: c.links.map((l) => (l.id === id ? { ...l, ...fields } : l)) })

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label="Full name" autoComplete="name" value={c.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        <Field id="c-headline" label="Headline" value={c.headline} onChange={(e) => set({ headline: e.target.value })} />
        <Field id="c-email" label="Email" type="email" autoComplete="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
        <Field id="c-phone" label="Phone" type="tel" autoComplete="tel" value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
        <Field id="c-location" label="City and state" className="sm:col-span-2" value={c.location} onChange={(e) => set({ location: e.target.value })} />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Links</legend>
        {c.links.length === 0 && <EmptyNote>Add LinkedIn, GitHub or a portfolio.</EmptyNote>}
        {c.links.map((l, i) => (
          <div key={l.id} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2">
            <Input aria-label={`Link ${i + 1} name`} placeholder="LinkedIn" value={l.label} onChange={(e) => setLink(l.id, { label: e.target.value })} className="bg-card" />
            <Input aria-label={`Link ${i + 1} address`} placeholder="linkedin.com/in/you" inputMode="url" value={l.url} onChange={(e) => setLink(l.id, { url: e.target.value })} className="bg-card" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove link ${l.label || i + 1}`} onClick={() => set({ links: c.links.filter((x) => x.id !== l.id) })}>
              <XIcon />
            </Button>
          </div>
        ))}
        {c.links.length < 6 && (
          <Button type="button" variant="ghost" size="sm" className="justify-self-start text-primary-hover hover:text-primary-hover" onClick={() => set({ links: [...c.links, { id: newId(), label: "", url: "" }] })}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add link
          </Button>
        )}
      </fieldset>
    </div>
  )
}

export function SummarySection({ doc, update }: SectionProps) {
  return (
    <RichTextEditor
      id="summary"
      label="Professional summary"
      placeholder="Two or three sentences on what you do and what you're best at."
      value={doc.summary}
      onChange={(summary) => update((d) => ({ ...d, summary }))}
      ai={() => ({ kind: "summary" })}
    />
  )
}

export function ExperienceSection({ doc, update }: SectionProps) {
  const { patch, shift, remove } = useEntries(update, "experience", "Role")
  return (
    <div className="grid gap-4">
      {doc.experience.length === 0 && <EmptyNote>No roles yet. Add your most recent role first.</EmptyNote>}
      <ol className="grid divide-y">
        {doc.experience.map((e, i) => {
          const title = [e.role, e.company].filter(Boolean).join(" at ") || "New role"
          return (
            <li key={e.id} className="grid gap-3 py-4 first:pt-0">
              <EntryHeader title={title} index={i} count={doc.experience.length} noun="Role" onShift={(by) => shift(i, by)} onRemove={() => remove(i)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`${e.id}-role`} label="Job title" value={e.role} onChange={(ev) => patch(e.id, { role: ev.target.value })} />
                <Field id={`${e.id}-company`} label="Company" value={e.company} onChange={(ev) => patch(e.id, { company: ev.target.value })} />
                <Field id={`${e.id}-start`} label="Start" placeholder="Jan 2023" value={e.start} onChange={(ev) => patch(e.id, { start: ev.target.value })} />
                <Field id={`${e.id}-end`} label="End" placeholder="Present" value={e.end} onChange={(ev) => patch(e.id, { end: ev.target.value })} />
                <Field id={`${e.id}-location`} label="Location" placeholder="Optional" className="sm:col-span-2" value={e.location} onChange={(ev) => patch(e.id, { location: ev.target.value })} />
              </div>
              <RichTextEditor
                id={`${e.id}-description`}
                label="What you did"
                placeholder="One achievement per bullet. Lead with the result."
                value={e.description}
                onChange={(description) => patch(e.id, { description })}
                ai={() => ({ kind: "entry", doc: doc.experience.find((x) => x.id === e.id)?.description ?? e.description })}
              />
            </li>
          )
        })}
      </ol>
      <AddButton
        label="Add role"
        onClick={() =>
          update((d) => ({ ...d, experience: [...d.experience, { id: newId(), role: "", company: "", location: "", start: "", end: "", description: emptyDoc() }] }))
        }
      />
    </div>
  )
}

export function EducationSection({ doc, update }: SectionProps) {
  const { patch, shift, remove } = useEntries(update, "education", "School")
  return (
    <div className="grid gap-4">
      {doc.education.length === 0 && <EmptyNote>No education added.</EmptyNote>}
      <ol className="grid divide-y">
        {doc.education.map((e, i) => (
          <li key={e.id} className="grid gap-3 py-4 first:pt-0">
            <EntryHeader title={e.school || "New school"} index={i} count={doc.education.length} noun="School" onShift={(by) => shift(i, by)} onRemove={() => remove(i)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${e.id}-school`} label="School" className="sm:col-span-2" value={e.school} onChange={(ev) => patch(e.id, { school: ev.target.value })} />
              <Field id={`${e.id}-degree`} label="Degree" className="sm:col-span-2" value={e.degree} onChange={(ev) => patch(e.id, { degree: ev.target.value })} />
              <Field id={`${e.id}-start`} label="Start" placeholder="Aug 2019" value={e.start} onChange={(ev) => patch(e.id, { start: ev.target.value })} />
              <Field id={`${e.id}-end`} label="End" placeholder="May 2023" value={e.end} onChange={(ev) => patch(e.id, { end: ev.target.value })} />
            </div>
            <RichTextEditor
              id={`${e.id}-details`}
              label="Details"
              placeholder="Optional: honors, GPA, relevant coursework."
              value={e.details}
              onChange={(details) => patch(e.id, { details })}
            />
          </li>
        ))}
      </ol>
      <AddButton
        label="Add school"
        onClick={() => update((d) => ({ ...d, education: [...d.education, { id: newId(), school: "", degree: "", start: "", end: "", details: emptyDoc() }] }))}
      />
    </div>
  )
}

export function SkillsSection({ doc, update }: SectionProps) {
  const setSkills = (skills: string[]) => update((d) => ({ ...d, skills }))
  const suggestion = useSuggestion(() => ({ kind: "skills", skills: doc.skills }))
  const found = suggestion.state.status === "ready" ? (suggestion.state.suggestion.skills ?? []) : []
  const pending = found.filter((s) => !doc.skills.some((k) => k.toLowerCase() === s.toLowerCase()))

  return (
    <div className="grid gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label htmlFor="skills" className="text-sm font-medium">
          Skills
        </Label>
        <WriteWithAIButton label="Find skills" onClick={suggestion.run} busy={suggestion.state.status === "loading"} />
      </div>
      <p className="text-sm text-muted-foreground">Jobs are matched on these. Saving updates your matches.</p>
      <ChipInput id="skills" value={doc.skills} onChange={setSkills} placeholder="Type a skill and press Enter" />
      <SuggestionPanel
        state={suggestion.state}
        onRetry={suggestion.run}
        onDiscard={suggestion.reset}
        actions={
          pending.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSkills([...doc.skills, ...pending])
                suggestion.reset()
              }}
            >
              Add all {pending.length}
            </Button>
          )
        }
      >
        <p className="mb-2 text-sm text-muted-foreground">Found in your uploaded resume. Add the ones that are true for you.</p>
        {pending.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {pending.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => setSkills([...doc.skills, s])} className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Add ${s}`}>
                  <Chip label={`+ ${s}`} className="border-dashed bg-transparent hover:bg-primary/8" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">All added.</p>
        )}
      </SuggestionPanel>
    </div>
  )
}

export function ProjectsSection({ doc, update }: SectionProps) {
  const { patch, shift, remove } = useEntries(update, "projects", "Project")
  return (
    <div className="grid gap-4">
      {doc.projects.length === 0 && <EmptyNote>No projects yet. They help most early in a career.</EmptyNote>}
      <ol className="grid divide-y">
        {doc.projects.map((p, i) => (
          <li key={p.id} className="grid gap-3 py-4 first:pt-0">
            <EntryHeader title={p.name || "New project"} index={i} count={doc.projects.length} noun="Project" onShift={(by) => shift(i, by)} onRemove={() => remove(i)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${p.id}-name`} label="Project name" className="sm:col-span-2" value={p.name} onChange={(ev) => patch(p.id, { name: ev.target.value })} />
              <Field id={`${p.id}-tools`} label="Built with" placeholder="Python, FastAPI" value={p.tools} onChange={(ev) => patch(p.id, { tools: ev.target.value })} />
              <Field id={`${p.id}-url`} label="Link" placeholder="Optional" inputMode="url" value={p.url} onChange={(ev) => patch(p.id, { url: ev.target.value })} />
            </div>
            <RichTextEditor
              id={`${p.id}-description`}
              label="Description"
              placeholder="What it does and the result it had."
              value={p.description}
              onChange={(description) => patch(p.id, { description })}
              ai={() => ({ kind: "entry", doc: doc.projects.find((x) => x.id === p.id)?.description ?? p.description })}
            />
          </li>
        ))}
      </ol>
      <AddButton
        label="Add project"
        onClick={() => update((d) => ({ ...d, projects: [...d.projects, { id: newId(), name: "", tools: "", url: "", description: emptyDoc() }] }))}
      />
    </div>
  )
}
