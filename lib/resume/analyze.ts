import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"
import mammoth from "mammoth"
import nspell from "nspell"

import { extractKeywords } from "@/lib/matching/extract"
import { SKILLS } from "@/lib/matching/skills"
import { parseResumeText, pdfToText } from "@/lib/profile/resume"
import type { Analysis, GrammarIssue, ImpactGap, ParseCheck } from "./analysis"
import { blocksOf, BULLET, DATE_RANGE, sectionsOf, type Block } from "./seed"

/*
 * Scores a resume (spec 013): a read-only layer over the same text extraction
 * and section parser the onboarding upload and Resume Builder use. Nothing is
 * stored. Every finding quotes the candidate's own text.
 */

export class AnalysisError extends Error {}

export async function textFromFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") return await pdfToText(bytes)
    if (name.endsWith(".docx")) return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
  } catch {
    throw new AnalysisError("We couldn't read that file. Try exporting it again, or upload a PDF.")
  }
  throw new AnalysisError("Upload a PDF or Word (.docx) file.")
}

// Everyday resume and tech vocabulary en_US doesn't know; flagging these would bury real typos.
const RESUME_WORDS = `scalable scalability chatbot chatbots backend backends frontend frontends fullstack embedding embeddings
dataset datasets workflow workflows microservice microservices devops onboarding offboarding stakeholder stakeholders
runtime codebase codebases timeline timelines roadmap roadmaps toolchain analytics hackathon hackathons hyperparameter
hyperparameters preprocessing postprocessing finetune finetuned finetuning upskilled upskilling cybersecurity blockchain
middleware webhook webhooks containerized containerization serverless multithreaded multithreading async inference
latency throughput uptime downtime deployable deployments e-commerce ecommerce saas fintech healthtech edtech
cross-functional dashboarding dataflow dataflows geospatial multimodal tokenization vectorized vectorization
reusability maintainability observability orchestration orchestrated benchmarked benchmarking refactor refactored
refactoring debuggability onboarded subreddit app apps automations repo repos`.split(/\s+/)

// dictionary-en loads its files via import.meta.url, which bundlers mishandle; read them directly.
let speller: ReturnType<typeof nspell> | null = null
function spell() {
  if (!speller) {
    const dir = path.join(process.cwd(), "node_modules", "dictionary-en")
    speller = nspell({ aff: readFileSync(path.join(dir, "index.aff")), dic: readFileSync(path.join(dir, "index.dic")) })
    // The skills dictionary knows tech terms en_US doesn't ("kubernetes", "postgres").
    for (const [name, aliases] of Object.entries(SKILLS)) {
      for (const term of [name, ...aliases]) for (const w of term.toLowerCase().split(/[^a-z]+/)) if (w) speller.add(w)
    }
    for (const w of RESUME_WORDS) speller.add(w)
  }
  return speller
}

const excerptAround = (line: string, index: number, length: number) => {
  const start = Math.max(0, line.lastIndexOf(" ", Math.max(0, index - 30)))
  const end = line.indexOf(" ", Math.min(line.length, index + length + 30))
  return `${start > 0 ? "…" : ""}${line.slice(start, end === -1 ? undefined : end).trim()}${end !== -1 ? "…" : ""}`
}

// Parsed %: what an ATS needs to find. Weights sum to 100.
function parseChecks(text: string, sections: ReturnType<typeof sectionsOf>, roles: Block[]): { score: number; checks: ParseCheck[] } {
  const { contact, skills } = parseResumeText(text)
  const items: [number, ParseCheck][] = [
    [10, { label: "Full name at the top", passed: !!contact.firstName, fix: "Put your full first and last name alone on the first line, not initials." }],
    [10, { label: "Email address", passed: !!contact.email, fix: "Add an email address as plain text, not inside an image or header graphic." }],
    [10, { label: "Phone number", passed: !!contact.phone, fix: "Add a phone number, e.g. 470-513-9092." }],
    [20, { label: "Experience section", passed: !!sections.experience?.length, fix: "Head your work history with a plain “Experience” heading." }],
    [15, { label: "Dates on every role", passed: roles.length > 0 && roles.every((r) => DATE_RANGE.test(r.header ?? "")), fix: "End each role's title line with its dates, e.g. “Jan 2023 - Present”." }],
    [15, { label: "Education section", passed: !!sections.education?.length, fix: "Add an “Education” section, even with a single degree." }],
    [15, { label: "Skills ATS software recognizes", passed: !!sections.skills?.length || skills.length >= 5, fix: "Add a “Skills” section listing tools by name (e.g. Python, SQL, AWS)." }],
    [5, { label: "Summary", passed: !!sections.summary?.length, fix: "Open with a two-line summary of your role and strongest skills." }],
  ]
  const score = items.reduce((sum, [w, c]) => sum + (c.passed ? w : 0), 0)
  return { score, checks: items.map(([, c]) => c) }
}

// Spelling & grammar: local dictionary plus resume-specific rules.
function grammarIssues(lines: string[], roles: Block[]): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  const seen = new Set<string>()
  const add = (issue: GrammarIssue) => {
    const key = `${issue.kind}:${issue.flagged.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      issues.push(issue)
    }
  }
  const sp = spell()

  for (const raw of lines) {
    const line = raw.replace(BULLET, "")
    // Skip contact lines and links: emails and URLs aren't prose.
    if (/@|https?:|www\.|\.com\b/.test(line)) continue

    // Only lowercase words: capitalised ones are mostly names of people, companies and schools.
    for (const m of line.matchAll(/\b[a-z][a-z']{2,}\b/g)) {
      const word = m[0].replace(/'s$/, "")
      if (sp.correct(word)) continue
      const suggestion = sp.suggest(word)[0]
      add({
        kind: "spelling",
        flagged: m[0],
        excerpt: excerptAround(line, m.index, m[0].length),
        message: suggestion ? `Possible misspelling. Did you mean “${suggestion}”?` : "Not found in the dictionary. Check the spelling.",
      })
    }
    for (const m of line.matchAll(/\b(\w+)\s+\1\b/gi)) {
      add({ kind: "repeated", flagged: m[0], excerpt: excerptAround(line, m.index, m[0].length), message: `“${m[1]}” is repeated.` })
    }
    for (const m of line.matchAll(/,,|\s[,.;:](?![\w])|[.]{2}(?!\.)/g)) {
      add({ kind: "punctuation", flagged: m[0].trim(), excerpt: excerptAround(line, m.index, m[0].length), message: "Stray or doubled punctuation." })
    }
  }

  for (const role of roles) {
    const current = /present|current|now/i.test(role.header?.match(DATE_RANGE)?.[2] ?? "")
    for (const bullet of role.bullets) {
      const fp = bullet.match(/\b(I|my|me)\b/)
      if (fp) {
        add({ kind: "first_person", flagged: fp[0], excerpt: excerptAround(bullet, fp.index ?? 0, fp[0].length), message: "Resume bullets drop “I”, “me” and “my”. Start with the action." })
      }
      const first = bullet.split(/\s+/)[0] ?? ""
      // "Manages" / "Managing" on a role that has ended.
      if (!current && /^[A-Z][a-z]{2,}(s|ing)$/.test(first) && !/ss$/.test(first)) {
        add({ kind: "tense", flagged: first, excerpt: excerptAround(bullet, 0, first.length), message: "This role has ended. Use the past tense (e.g. “Managed”, not “Manages”)." })
      }
    }
  }
  return issues
}

const NUMBER = /\d|%|\$|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundreds?|thousands?|millions?|billions?|doubled|tripled|halved)\b/i

function suggestionFor(bullet: string): string {
  if (/\b(reduc|improv|increas|optimi[sz]|cut|boost|grew|speed|faster|lower)/i.test(bullet)) return "Say by how much: a %, a time saved, or a before-and-after number."
  if (/\b(built|develop|creat|design|implement|launch|ship)/i.test(bullet)) return "Add scale: users, requests, records, revenue, or how many teams used it."
  if (/\b(led|lead|manag|mentor|coordinat|supervis)/i.test(bullet)) return "Add team size, budget, or how many projects you ran."
  return "Add one number that shows the result: volume, frequency, money, or time."
}

export function analyzeText(text: string, fileName: string): Analysis {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < 40) {
    throw new AnalysisError("This file has almost no readable text (it may be a scanned image). ATS software can't read it either, so upload a text-based PDF or .docx.")
  }

  const sections = sectionsOf(text)
  const roles = blocksOf(sections.experience ?? []).filter((b) => b.header)
  const projects = blocksOf(sections.projects ?? []).filter((b) => b.header)

  const parsed = parseChecks(text, sections, roles)

  const issues = grammarIssues(lines, roles)
  const penalty = issues.reduce((sum, i) => sum + (i.kind === "spelling" ? 4 : 3), 0)
  const grammar = { score: Math.max(0, 100 - penalty), issues }

  const bullets = [...roles, ...projects].flatMap((b) => b.bullets)
  const gaps: ImpactGap[] = bullets.filter((b) => !NUMBER.test(b)).map((b) => ({ bullet: b, suggestion: suggestionFor(b) }))
  const measured = bullets.length - gaps.length
  const impact = { score: bullets.length ? Math.round((measured / bullets.length) * 100) : null, total: bullets.length, measured, gaps }

  const overall = Math.round(
    impact.score === null ? parsed.score * 0.5 + grammar.score * 0.5 : parsed.score * 0.3 + grammar.score * 0.3 + impact.score * 0.4,
  )

  const found = (["summary", "experience", "education", "skills", "projects"] as const).filter((k) => sections[k]?.length)
  const names = found.map((k) => k[0].toUpperCase() + k.slice(1))
  const spelling = issues.filter((i) => i.kind === "spelling").length
  const other = issues.length - spelling

  return {
    fileName,
    overall,
    stages: {
      read: `Read ${words.toLocaleString("en-US")} words and ${extractKeywords(text).length} recognizable skills`,
      sections: names.length
        ? `Found ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`}${roles.length ? `, ${roles.length} ${roles.length === 1 ? "role" : "roles"}` : ""}`
        : "No standard section headings found",
      grammar: issues.length
        ? [spelling && `${spelling} possible spelling ${spelling === 1 ? "issue" : "issues"}`, other && `${other} other ${other === 1 ? "issue" : "issues"}`].filter(Boolean).join(", ")
        : "No issues found",
      impact: bullets.length ? `${measured} of ${bullets.length} bullets include a number` : "No bullet points found",
      score: `Overall score ${overall}`,
    },
    parsed,
    grammar,
    impact,
  }
}
