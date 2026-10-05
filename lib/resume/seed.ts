import type { StoredProfile } from "@/lib/profile/store"
import { bulletsDoc, emptyDoc, newId, paragraphsDoc, type ResumeDoc } from "./types"

/*
 * Best-effort first draft from the uploaded resume's extracted text. Resumes
 * tend to share one shape: CAPITALISED headings, entry lines ending in a date
 * range, and bulleted achievements whose long lines wrap onto the next line.
 * Anything this misses starts empty for the candidate to fill in.
 */

export type SectionKey = "summary" | "experience" | "education" | "projects" | "skills"

const HEADINGS: [RegExp, SectionKey][] = [
  [/^(SUMMARY|PROFILE|PROFESSIONAL SUMMARY|OBJECTIVE|ABOUT( ME)?)$/i, "summary"],
  [/EXPERIENCE|EMPLOYMENT|WORK HISTORY/i, "experience"],
  [/EDUCATION/i, "education"],
  [/PROJECTS?/i, "projects"],
  [/SKILLS|TECHNOLOGIES|TECHNICAL PROFICIENC/i, "skills"],
]

export const BULLET = /^[●•▪◦‣*-]\s*/
const MONTH = String.raw`(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}`
export const DATE_RANGE = new RegExp(String.raw`\s*(${MONTH})\s*[–—-]\s*(${MONTH}|Present|Current|Now)\s*$`, "i")

export interface Block {
  header: string | null
  bullets: string[]
}

/** A heading line: CAPITALISED, or a short Title Case line that names a known section. */
function headingKey(line: string): SectionKey | null | undefined {
  const caps = /^[A-Z][A-Z &/]{2,40}$/.test(line)
  const titled = /^[A-Z][A-Za-z &/]{2,40}$/.test(line) && line.split(/s+/).length <= 4
  if (!caps && !titled) return undefined
  const key = HEADINGS.find(([re]) => re.test(line))?.[1] ?? null
  // Unknown Title Case lines are ordinary content (e.g. a school name), not headings.
  return caps || key ? key : undefined
}

export function sectionsOf(text: string): Partial<Record<SectionKey, string[]>> {
  const out: Partial<Record<SectionKey, string[]>> = {}
  let current: string[] | null = null
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const key = headingKey(line)
    if (key !== undefined) {
      current = key ? (out[key] ??= []) : null
      continue
    }
    current?.push(line)
  }
  return out
}

export function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = []
  for (const line of lines) {
    const last = blocks.at(-1)
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "")
      if (last) last.bullets.push(item)
      else blocks.push({ header: null, bullets: [item] })
    } else if (last?.bullets.length && /^[a-z0-9(%&,.]/.test(line)) {
      // A wrapped bullet: long achievements spill onto a second line.
      last.bullets[last.bullets.length - 1] += ` ${line}`
    } else {
      blocks.push({ header: line, bullets: [] })
    }
  }
  return blocks
}

export function splitHeader(header: string, splitOnComma: boolean) {
  const range = header.match(DATE_RANGE)
  const rest = range ? header.slice(0, range.index).trim() : header
  let parts = rest.split(/\s+\|\s+/)
  if (parts.length < 2 && splitOnComma) {
    const at = rest.indexOf(", ")
    parts = at > 0 ? [rest.slice(0, at), rest.slice(at + 2)] : [rest]
  }
  return { a: parts[0] ?? "", b: parts.slice(1).join(" | "), start: range?.[1] ?? "", end: range?.[2] ?? "" }
}

export function seedResume(profile: StoredProfile): ResumeDoc {
  const sections = sectionsOf(profile.resume_text)

  const summaryBlocks = blocksOf(sections.summary ?? [])
  const summaryBullets = summaryBlocks.flatMap((b) => b.bullets)
  const summaryText = summaryBlocks.flatMap((b) => (b.header ? [b.header] : [])).join(" ")

  const links = [
    { label: "LinkedIn", url: profile.linkedin_url },
    { label: "GitHub", url: profile.github_url },
    { label: "Portfolio", url: profile.portfolio_url },
  ]
    .filter((l) => l.url)
    .map((l) => ({ id: newId(), ...l }))

  return {
    template: "classic",
    contact: {
      fullName: profile.full_name,
      headline: profile.job_title,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      links,
    },
    summary: summaryBullets.length ? bulletsDoc(summaryBullets) : paragraphsDoc(summaryText ? [summaryText] : []),
    experience: blocksOf(sections.experience ?? [])
      .filter((b) => b.header)
      .map((b) => {
        const h = splitHeader(b.header!, true)
        return { id: newId(), role: h.a, company: h.b, location: "", start: h.start, end: h.end, description: bulletsDoc(b.bullets) }
      }),
    education: blocksOf(sections.education ?? [])
      .filter((b) => b.header)
      .map((b) => {
        const h = splitHeader(b.header!, false)
        const [degree = "", ...rest] = h.b ? [h.b, ...b.bullets] : b.bullets
        return { id: newId(), school: h.a, degree, start: h.start, end: h.end, details: rest.length ? bulletsDoc(rest) : emptyDoc() }
      }),
    skills: profile.resume_skills,
    projects: blocksOf(sections.projects ?? [])
      .filter((b) => b.header)
      .map((b) => {
        const h = splitHeader(b.header!, false)
        return { id: newId(), name: h.a, tools: h.b, url: "", description: bulletsDoc(b.bullets) }
      }),
    updatedAt: null,
  }
}
