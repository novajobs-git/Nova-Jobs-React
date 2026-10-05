"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileDownIcon, InfoIcon, LoaderCircleIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResumePreview } from "@/components/resume/resume-preview"
import {
  ContactSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  SkillsSection,
  SummarySection,
  type Update,
} from "@/components/resume/resume-sections"
import { docIsEmpty, TEMPLATES, type ResumeDoc, type SectionId, type TemplateId } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

const snapshot = (doc: ResumeDoc) => JSON.stringify({ ...doc, updatedAt: null })
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function sectionMeta(doc: ResumeDoc): Record<SectionId, string> {
  return {
    contact: doc.contact.fullName || "Add your name",
    summary: docIsEmpty(doc.summary) ? "Empty" : "Written",
    experience: doc.experience.length ? plural(doc.experience.length, "role") : "Empty",
    education: doc.education.length ? plural(doc.education.length, "school") : "Empty",
    skills: doc.skills.length ? plural(doc.skills.length, "skill") : "Empty",
    projects: doc.projects.length ? plural(doc.projects.length, "project") : "Empty",
  }
}

const SECTIONS: { id: SectionId; title: string; Body: (p: { doc: ResumeDoc; update: Update }) => React.ReactNode }[] = [
  { id: "contact", title: "Contact", Body: ContactSection },
  { id: "summary", title: "Summary", Body: SummarySection },
  { id: "experience", title: "Experience", Body: ExperienceSection },
  { id: "education", title: "Education", Body: EducationSection },
  { id: "skills", title: "Skills", Body: SkillsSection },
  { id: "projects", title: "Projects", Body: ProjectsSection },
]

export function ResumeBuilder({ initial }: { initial: ResumeDoc }) {
  const [doc, setDoc] = useState(initial)
  const [savedSnapshot, setSavedSnapshot] = useState(() => (initial.updatedAt ? snapshot(initial) : ""))
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<SectionId | "">("contact")
  const [view, setView] = useState<"edit" | "preview">("edit")
  const [seedNote, setSeedNote] = useState(initial.updatedAt === null)

  const update: Update = useCallback((fn) => setDoc(fn), [])
  const current = useMemo(() => snapshot(doc), [doc])
  const dirty = current !== savedSnapshot

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    const sent = doc
    try {
      const res = await fetch("/api/resume/builder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      })
      const json = (await res.json().catch(() => null)) as { success: boolean; data?: { updatedAt: string }; error?: string } | null
      if (!json?.success || !json.data) throw new Error(json?.error || `The server answered ${res.status}.`)
      const updatedAt = json.data.updatedAt
      setDoc((d) => ({ ...d, updatedAt }))
      setSavedSnapshot(snapshot(sent))
      setSeedNote(false)
      toast.success("Resume saved", { description: "Your job matches now use these skills." })
    } catch (e) {
      toast.error("Resume not saved", { description: e instanceof Error ? e.message : "Try again." })
    } finally {
      setSaving(false)
    }
  }, [doc, saving])

  const exportPdf = () => {
    toast("Opening the print dialog", { description: "Choose “Save as PDF” as the destination." })
    // Let the toast paint before the dialog blocks the page.
    window.setTimeout(() => window.print(), 250)
  }

  // Ctrl/Cmd+S saves, like every other editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save])

  // Unsaved work: warn on reload/close and on in-app navigation.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]")
      if (!link || link.closest("[data-resume-paper]") || link.getAttribute("target") === "_blank") return
      if (!window.confirm("You have unsaved changes to your resume. Leave without saving?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  const selectFromPreview = (id: SectionId) => {
    setOpen(id)
    setView("edit")
    requestAnimationFrame(() =>
      document.getElementById(`section-${id}`)?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }),
    )
  }

  const meta = sectionMeta(doc)

  return (
    <div className="flex min-h-[calc(100svh-117px)] flex-col">
      <header className="sticky top-[66px] z-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-card/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-card/85 md:px-6 lg:h-16 lg:py-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">Resume builder</h1>
          <SaveStatus dirty={dirty} updatedAt={doc.updatedAt} />
        </div>

        <Tabs value={doc.template} onValueChange={(t) => update((d) => ({ ...d, template: t as TemplateId }))} className="order-last w-full sm:order-none sm:w-auto">
          <TabsList aria-label="Template" className="w-full sm:w-auto">
            {TEMPLATES.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={exportPdf}>
            <FileDownIcon data-icon="inline-start" aria-hidden />
            Export PDF
          </Button>
          <Button type="button" onClick={save} disabled={saving} className="min-w-20">
            {saving && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" data-icon="inline-start" aria-hidden />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as "edit" | "preview")} className="order-last w-full lg:hidden">
          <TabsList aria-label="Show" className="w-full">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
        <div
          data-resume-paper
          className={cn(
            "self-start px-4 py-6 sm:px-8 lg:sticky lg:top-[130px] lg:block lg:h-[calc(100svh-181px)] lg:overflow-y-auto lg:py-8",
            view === "edit" && "hidden",
          )}
        >
          <ResumePreview doc={doc} active={open} onSelect={selectFromPreview} />
          <p className="mx-auto mt-3 max-w-[816px] text-center text-xs text-muted-foreground">
            Click any part of the page to edit it. Dashed lines mark page breaks.
          </p>
        </div>

        <aside aria-label="Edit resume" className={cn("border-l bg-card lg:block", view === "preview" && "hidden")}>
          {seedNote && (
            <div className="flex items-start gap-2.5 border-b bg-primary/5 px-5 py-3 text-sm">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary-hover" aria-hidden />
              <p className="flex-1">
                <span className="font-medium">Pre-filled from your uploaded resume.</span>{" "}
                <span className="text-muted-foreground">Check each section, then save.</span>
              </p>
              <button
                type="button"
                onClick={() => setSeedNote(false)}
                aria-label="Dismiss"
                className="-m-1 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}

          <Accordion type="single" collapsible value={open} onValueChange={(v) => setOpen(v as SectionId | "")}>
            {SECTIONS.map(({ id, title, Body }) => (
              <AccordionItem key={id} value={id} id={`section-${id}`} className="scroll-mt-[240px] border-b px-5 lg:scroll-mt-[146px]">
                <AccordionTrigger className="items-center py-4 hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className="text-[15px] font-semibold">{title}</span>
                    <span
                      className={cn(
                        "truncate text-sm font-normal tabular-nums",
                        meta[id] === "Empty" ? "text-muted-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {meta[id]}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="h-auto pb-5">
                  <Body doc={doc} update={update} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </aside>
      </div>
    </div>
  )
}

function SaveStatus({ dirty, updatedAt }: { dirty: boolean; updatedAt: string | null }) {
  if (dirty) return <p className="text-sm text-muted-foreground">Unsaved changes</p>
  if (!updatedAt) return <p className="text-sm text-muted-foreground">Not saved yet</p>
  return (
    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
      Saved at {new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </p>
  )
}
