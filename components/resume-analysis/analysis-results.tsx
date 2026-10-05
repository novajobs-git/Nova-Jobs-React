"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleCheckIcon, CircleXIcon, InfoIcon } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { bandFor, type Analysis, type Band, type GrammarIssue } from "@/lib/resume/analysis"
import { cn } from "@/lib/utils"

const VISIBLE = 3

// Full class strings so Tailwind can see them. Score color always sits next to its band word.
const TONE: Record<Band, { text: string; meter: string }> = {
  Strong: { text: "text-success-text", meter: "[&_[data-slot=progress-indicator]]:bg-success" },
  Fair: { text: "text-score-fair", meter: "[&_[data-slot=progress-indicator]]:bg-score-fair" },
  "Needs work": { text: "text-destructive", meter: "[&_[data-slot=progress-indicator]]:bg-destructive" },
}

const KIND_LABEL: Record<GrammarIssue["kind"], string> = {
  spelling: "Spelling",
  repeated: "Repeated word",
  first_person: "First person",
  tense: "Tense",
  punctuation: "Punctuation",
}

/** The single most useful next step, from the weakest category. */
function summaryLine(a: Analysis): string {
  const candidates = [
    { score: a.parsed.score, text: `ATS software misses ${a.parsed.checks.filter((c) => !c.passed).length} of ${a.parsed.checks.length} things it looks for. Start with Resume Parsed.` },
    { score: a.grammar.score, text: `${a.grammar.issues.length} possible spelling or grammar ${a.grammar.issues.length === 1 ? "issue" : "issues"} to check. Start with Spelling & Grammar.` },
    ...(a.impact.score === null
      ? []
      : [{ score: a.impact.score, text: `${a.impact.gaps.length} of ${a.impact.total} bullets have no number. Adding results is your biggest gain.` }]),
  ]
  const weakest = candidates.sort((x, y) => x.score - y.score)[0]
  return weakest.score >= 90 ? "Strong across the board. Fix the few items below and it's ready to send." : weakest.text
}

function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(target)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const start = performance.now()
    setValue(0)
    const timer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms)
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t === 1) window.clearInterval(timer)
    }, 16)
    return () => window.clearInterval(timer)
  }, [target, ms])
  return value
}

export function AnalysisResults({ analysis, onReset }: { analysis: Analysis; onReset: () => void }) {
  const overall = useCountUp(analysis.overall)
  const { parsed, grammar, impact } = analysis
  const failedChecks = parsed.checks.filter((c) => !c.passed)
  const passedChecks = parsed.checks.filter((c) => c.passed)

  return (
    <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
      <section aria-labelledby="overall-title" className="flex flex-wrap items-center gap-x-8 gap-y-5 border bg-card px-4 py-5 md:px-6 md:py-6">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-5xl font-bold tracking-tight tabular-nums", TONE[bandFor(analysis.overall)].text)}>{overall}</span>
          <span className="text-lg text-muted-foreground tabular-nums">/100</span>
        </div>
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="overall-title" className="text-base font-semibold">
            Overall: <span className={TONE[bandFor(analysis.overall)].text}>{bandFor(analysis.overall)}</span>
          </h2>
          <p className="mt-1 text-pretty text-muted-foreground">{summaryLine(analysis)}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{analysis.fileName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            Analyze another
          </Button>
          <Button asChild>
            <Link href="/resume">Fix in Resume Builder</Link>
          </Button>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Category
          title="Resume Parsed"
          explain="How much of your resume applicant tracking systems can read: your contact details, standard section headings, and dated roles."
          score={parsed.score}
          meta={`${passedChecks.length} of ${parsed.checks.length} checks passed`}
        >
          {failedChecks.length === 0 ? (
            <AllClear>Everything an ATS looks for was found.</AllClear>
          ) : (
            <FindingList
              items={failedChecks.map((c) => (
                <div key={c.label} className="flex gap-2.5">
                  <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">
                      <span className="sr-only">Missing: </span>
                      {c.label}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{c.fix}</p>
                  </div>
                </div>
              ))}
            />
          )}
          {passedChecks.length > 0 && (
            <Accordion type="single" collapsible className="mt-2 border-t">
              <AccordionItem value="passed" className="border-b-0">
                <AccordionTrigger className="py-3 text-sm text-muted-foreground hover:no-underline">
                  {passedChecks.length} {passedChecks.length === 1 ? "check" : "checks"} passed
                </AccordionTrigger>
                <AccordionContent className="h-auto pb-1">
                  <ul className="grid gap-2">
                    {passedChecks.map((c) => (
                      <li key={c.label} className="flex items-center gap-2.5 text-sm">
                        <CircleCheckIcon className="size-4 shrink-0 text-success-text" aria-hidden />
                        <span>
                          <span className="sr-only">Found: </span>
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </Category>

        <Category
          title="Spelling & Grammar"
          explain="Possible typos, repeated words, stray punctuation, first-person words, and present tense on roles that have ended. Checked on our server against an English dictionary plus tech terms. Names of people and companies aren't spell-checked."
          score={grammar.score}
          meta={grammar.issues.length ? `${grammar.issues.length} ${grammar.issues.length === 1 ? "issue" : "issues"} found` : "No issues found"}
        >
          {grammar.issues.length === 0 ? (
            <AllClear>No spelling or grammar issues found.</AllClear>
          ) : (
            <FindingList
              items={grammar.issues.map((issue, i) => (
                <div key={`${issue.kind}-${issue.flagged}-${i}`}>
                  <p className="text-xs font-medium text-muted-foreground">{KIND_LABEL[issue.kind]}</p>
                  <p className="mt-1 text-sm">
                    <Flagged excerpt={issue.excerpt} flagged={issue.flagged} />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                </div>
              ))}
            />
          )}
        </Category>

        <Category
          title="Quantifiable Impact"
          explain="The share of your experience and project bullets that include a number: a %, a $ amount, a count, or a time. Recruiters look for results, not duties. Aim for 80% or more."
          score={impact.score}
          meta={impact.total ? `${impact.measured} of ${impact.total} bullets include a number` : "No bullet points found"}
        >
          {impact.score === null ? (
            <p className="text-sm text-muted-foreground">
              No bullet points were found under Experience or Projects. List each role&rsquo;s achievements as bullets so they can be measured.
            </p>
          ) : impact.gaps.length === 0 ? (
            <AllClear>Every bullet includes a measurable result.</AllClear>
          ) : (
            <FindingList
              items={impact.gaps.map((gap, i) => (
                <div key={i}>
                  <p className="line-clamp-3 border-l-2 border-border pl-3 text-sm">{gap.bullet}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{gap.suggestion}</p>
                </div>
              ))}
            />
          )}
        </Category>
      </div>
    </div>
  )
}

function Category({ title, explain, score, meta, children }: {
  title: string
  explain: string
  score: number | null
  meta: string
  children: React.ReactNode
}) {
  const id = title.toLowerCase().replace(/\W+/g, "-")
  const tone = score === null ? null : TONE[bandFor(score)]
  return (
    <section aria-labelledby={id} className="border bg-card">
      <header className="border-b px-4 py-4 md:px-5">
        <div className="flex items-center gap-1.5">
          <h3 id={id} className="text-base font-semibold">
            {title}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What ${title} means`}
                className="flex size-6 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <InfoIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-pretty">{explain}</TooltipContent>
          </Tooltip>
          <span className={cn("ml-auto text-2xl font-semibold tracking-tight tabular-nums", tone?.text ?? "text-muted-foreground")}>{score === null ? "n/a" : `${score}%`}</span>
        </div>
        <Progress
          value={score ?? 0}
          aria-label={`${title} score`}
          className={cn("mt-3 [&_[data-slot=progress-indicator]]:duration-700 motion-reduce:[&_[data-slot=progress-indicator]]:transition-none", tone?.meter)}
        />
        <p className="mt-2 flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>{meta}</span>
          {tone && <span className={cn("font-medium", tone.text)}>{bandFor(score!)}</span>}
        </p>
      </header>
      <div className="px-4 py-4 md:px-5">{children}</div>
    </section>
  )
}

function FindingList({ items }: { items: React.ReactNode[] }) {
  const shown = items.slice(0, VISIBLE)
  const rest = items.slice(VISIBLE)
  return (
    <>
      <ul className="grid gap-4">
        {shown.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {rest.length > 0 && (
        <Accordion type="single" collapsible className="mt-4 border-t">
          <AccordionItem value="more" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-medium text-primary-hover hover:no-underline">
              Show {rest.length} more
            </AccordionTrigger>
            <AccordionContent className="h-auto pb-1">
              <ul className="grid gap-4">
                {rest.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </>
  )
}

function Flagged({ excerpt, flagged }: { excerpt: string; flagged: string }) {
  const at = excerpt.indexOf(flagged)
  if (at === -1) return <>{excerpt}</>
  return (
    <>
      {excerpt.slice(0, at)}
      <mark className="bg-destructive/10 px-0.5 text-foreground underline decoration-destructive decoration-wavy underline-offset-4">{flagged}</mark>
      {excerpt.slice(at + flagged.length)}
    </>
  )
}

function AllClear({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn("flex items-center gap-2.5 text-sm")}>
      <CircleCheckIcon className="size-4 shrink-0 text-success-text" aria-hidden />
      {children}
    </p>
  )
}
