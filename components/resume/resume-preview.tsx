"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { RichContent } from "@/components/resume/rich-content"
import { docIsEmpty, safeHref, type ResumeDoc, type SectionId, type TemplateId } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

/*
 * The paper is a printed document, not app UI: its type sizes belong to the
 * template, in px at 96dpi so the preview matches the PDF. Everything around
 * the paper follows the dashboard tokens.
 */
const PAGE_W = 816
const PAGE_H = 1056

interface Look {
  paper: string
  header: string
  name: string
  headline: string
  contact: string
  sectionGap: string
  heading: string
  body: string
  entryTitle: string
  entryMeta: string
}

const LOOKS: Record<TemplateId, Look> = {
  classic: {
    paper: "font-serif px-[60px] py-[56px] text-[12.5px] leading-[1.45]",
    header: "text-center",
    name: "text-[26px] font-bold tracking-tight leading-tight",
    headline: "mt-1 text-[13.5px] text-paper-muted",
    contact: "mt-2 justify-center",
    sectionGap: "mt-[18px]",
    heading: "mb-2 border-b border-paper-rule pb-1 text-[12px] font-bold uppercase tracking-[0.08em]",
    body: "[&_li]:mt-[2px] [&_p+p]:mt-1",
    entryTitle: "font-bold",
    entryMeta: "italic text-paper-muted",
  },
  compact: {
    paper: "font-sans px-[48px] py-[44px] text-[11.5px] leading-[1.4]",
    header: "flex items-end justify-between gap-6 border-b border-paper-rule pb-3",
    name: "text-[22px] font-bold tracking-tight leading-tight",
    headline: "mt-0.5 text-[12.5px] text-paper-muted",
    contact: "flex-col items-end text-right",
    sectionGap: "mt-[12px]",
    heading: "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-paper-muted",
    body: "[&_li]:mt-px [&_p+p]:mt-0.5",
    entryTitle: "font-semibold",
    entryMeta: "text-paper-muted",
  },
  modern: {
    paper: "font-sans px-[56px] py-[52px] text-[12px] leading-[1.5]",
    header: "",
    name: "text-[30px] font-semibold tracking-[-0.02em] leading-none",
    headline: "mt-2 text-[14px] font-medium text-paper-muted",
    contact: "mt-3",
    sectionGap: "mt-[20px]",
    heading: "mb-2 border-l-[3px] border-paper-ink pl-2 text-[13px] font-semibold leading-tight",
    body: "[&_li]:mt-[2px] [&_p+p]:mt-1",
    entryTitle: "font-semibold",
    entryMeta: "text-paper-muted",
  },
}

const TITLES: Record<Exclude<SectionId, "contact">, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
}

interface PreviewProps {
  doc: ResumeDoc
  active: SectionId | ""
  onSelect: (id: SectionId) => void
}

export function ResumePreview({ doc, active, onSelect }: PreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(PAGE_H)
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    const paper = paperRef.current
    if (!frame || !paper) return
    const observer = new ResizeObserver(() => {
      if (!frame.clientWidth) return // hidden behind the mobile Edit tab
      setScale(Math.min(1, frame.clientWidth / PAGE_W))
      setHeight(Math.max(PAGE_H, paper.offsetHeight))
      setMeasured(true)
    })
    observer.observe(frame)
    observer.observe(paper)
    return () => observer.disconnect()
  }, [])

  const pages = Math.ceil(height / PAGE_H)

  return (
    <div
      ref={frameRef}
      // On screen a click selects the section; links only work in the exported PDF.
      onClickCapture={(e) => (e.target as Element).closest("a") && e.preventDefault()}
      className={cn("mx-auto w-full max-w-[816px] transition-opacity duration-200", !measured && "opacity-0")}
    >
      <div className="relative" style={{ height: height * scale }}>
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})`, width: PAGE_W }}>
          <div ref={paperRef} className="relative min-h-[1056px] rounded-sm bg-paper text-paper-ink shadow-sm ring-1 ring-black/5">
            <Paper doc={doc} active={active} onSelect={onSelect} />
            {Array.from({ length: pages - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/40"
                style={{ top: PAGE_H * (i + 1) }}
              >
                <span className="absolute -top-2.5 right-3 rounded-sm bg-primary px-1.5 font-sans text-[11px] font-medium text-primary-foreground">
                  Page {i + 2}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <PrintCopy doc={doc} />
    </div>
  )
}

const subscribe = () => () => {}

/** A clean copy at body level, so printing skips the app shell and the preview's scaling. */
function PrintCopy({ doc }: { doc: ResumeDoc }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  if (!mounted) return null
  return createPortal(
    <div data-resume-print className="hidden bg-paper text-paper-ink print:block">
      <Paper doc={doc} print />
    </div>,
    document.body,
  )
}

interface PaperProps {
  doc: ResumeDoc
  active?: SectionId | ""
  onSelect?: (id: SectionId) => void
  print?: boolean
}

function Paper({ doc, active, onSelect, print }: PaperProps) {
  const look = LOOKS[doc.template]
  const { contact } = doc
  const contactItems = [contact.location, contact.phone, contact.email].filter(Boolean)
  const links = contact.links.flatMap((l) => {
    const href = safeHref(l.url)
    return href ? [{ ...l, href }] : []
  })

  const section = (id: SectionId, children: React.ReactNode, className?: string) => (
    <section
      key={id}
      data-section={id}
      onClick={onSelect && (() => onSelect(id))}
      className={cn(
        "relative break-inside-avoid-page",
        !print &&
          "cursor-pointer rounded-none outline-2 outline-offset-[6px] outline-transparent transition-[outline-color] duration-200 hover:outline-primary/20 motion-reduce:transition-none",
        !print && active === id && "outline-primary/55 hover:outline-primary/55",
        className,
      )}
    >
      {children}
    </section>
  )

  const heading = (id: Exclude<SectionId, "contact">) => <h2 className={look.heading}>{TITLES[id]}</h2>

  return (
    <div className={cn(look.paper, print && "p-0")}>
      {section(
        "contact",
        <header className={look.header}>
          <div>
            <h1 className={cn(look.name, !contact.fullName && "text-paper-muted")}>{contact.fullName || "Your name"}</h1>
            {contact.headline && <p className={look.headline}>{contact.headline}</p>}
          </div>
          {(contactItems.length > 0 || links.length > 0) && (
            <p className={cn("flex flex-wrap gap-x-2 gap-y-0.5", look.contact)}>
              {[...contactItems, ...links.map((l) => l.label || l.url)].map((item, i, all) => {
                const link = links.find((l) => (l.label || l.url) === item)
                return (
                  <span key={`${item}-${i}`} className="whitespace-nowrap">
                    {link ? (
                      <a href={link.href} rel="noopener noreferrer" className="underline underline-offset-2">
                        {item}
                      </a>
                    ) : (
                      item
                    )}
                    {doc.template !== "compact" && i < all.length - 1 && <span className="ml-2 text-paper-rule">|</span>}
                  </span>
                )
              })}
            </p>
          )}
        </header>,
      )}

      {!docIsEmpty(doc.summary) &&
        section("summary", <>{heading("summary")}<RichContent doc={doc.summary} className={look.body} /></>, look.sectionGap)}

      {doc.experience.length > 0 &&
        section(
          "experience",
          <>
            {heading("experience")}
            <div className="grid gap-[10px]">
              {doc.experience.map((e) => (
                <article key={e.id} className="break-inside-avoid">
                  <EntryHead
                    look={look}
                    title={doc.template === "modern" ? e.role : [e.role, e.company].filter(Boolean).join(", ")}
                    sub={doc.template === "modern" ? [e.company, e.location].filter(Boolean).join(" | ") : e.location}
                    dates={[e.start, e.end].filter(Boolean).join(" - ")}
                  />
                  {!docIsEmpty(e.description) && <RichContent doc={e.description} className={cn("mt-1", look.body)} />}
                </article>
              ))}
            </div>
          </>,
          look.sectionGap,
        )}

      {doc.projects.length > 0 &&
        section(
          "projects",
          <>
            {heading("projects")}
            <div className="grid gap-[8px]">
              {doc.projects.map((p) => (
                <article key={p.id} className="break-inside-avoid">
                  <p>
                    <span className={look.entryTitle}>{p.name || "Untitled project"}</span>
                    {p.tools && <span className={look.entryMeta}> | {p.tools}</span>}
                    {safeHref(p.url) && (
                      <a href={safeHref(p.url)!} rel="noopener noreferrer" className="ml-1.5 underline underline-offset-2">
                        {p.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                  </p>
                  {!docIsEmpty(p.description) && <RichContent doc={p.description} className={cn("mt-0.5", look.body)} />}
                </article>
              ))}
            </div>
          </>,
          look.sectionGap,
        )}

      {doc.education.length > 0 &&
        section(
          "education",
          <>
            {heading("education")}
            <div className="grid gap-[8px]">
              {doc.education.map((e) => (
                <article key={e.id} className="break-inside-avoid">
                  <EntryHead look={look} title={e.school} sub={e.degree} dates={[e.start, e.end].filter(Boolean).join(" - ")} />
                  {!docIsEmpty(e.details) && <RichContent doc={e.details} className={cn("mt-0.5", look.body)} />}
                </article>
              ))}
            </div>
          </>,
          look.sectionGap,
        )}

      {doc.skills.length > 0 &&
        section("skills", <>{heading("skills")}<p>{doc.skills.join(", ")}</p></>, look.sectionGap)}
    </div>
  )
}

function EntryHead({ look, title, sub, dates }: { look: Look; title: string; sub: string; dates: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className={look.entryTitle}>{title || "Untitled"}</p>
        {dates && <p className="shrink-0 tabular-nums">{dates}</p>}
      </div>
      {sub && <p className={look.entryMeta}>{sub}</p>}
    </>
  )
}
