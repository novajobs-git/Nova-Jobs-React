import "server-only"

import { extractText, getDocumentProxy } from "unpdf"

import { extractKeywords } from "@/lib/matching/extract"
import type { ParsedResume } from "./schema"

export async function pdfToText(pdf: Uint8Array): Promise<string> {
  // pdf.js transfers (detaches) the buffer it is given; parse a copy so the
  // caller can still store the original bytes.
  const doc = await getDocumentProxy(pdf.slice())
  const { text } = await extractText(doc, { mergePages: true })
  return text
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const LINKEDIN = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i
const GITHUB = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i
const URL_LIKE = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:dev|io|me|com|net|design|site|app)(?:\/[\w./-]*)?/gi

const withScheme = (url: string) => (url.startsWith("http") ? url : `https://${url}`)

/** Best-effort contact details; anything not found is left for the candidate to type. */
function contactFrom(text: string): ParsedResume["contact"] {
  const email = text.match(EMAIL)?.[0]
  const linkedin = text.match(LINKEDIN)?.[0]
  const github = text.match(GITHUB)?.[0]
  const portfolio = [...text.matchAll(URL_LIKE)]
    .map((m) => m[0])
    .find((u) => !/linkedin|github|gmail|yahoo|outlook|hotmail|icloud/i.test(u) && !email?.includes(u))

  // Resumes almost always open with the candidate's name on its own line.
  const firstLine = text.split(/\n/).map((l) => l.trim()).find(Boolean) ?? ""
  const nameParts = /^[A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+){1,3}$/.test(firstLine) ? firstLine.split(/\s+/) : []

  return {
    firstName: nameParts[0],
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
    email,
    phone: text.match(PHONE)?.[0],
    linkedinUrl: linkedin && withScheme(linkedin),
    githubUrl: github && withScheme(github),
    portfolioUrl: portfolio && withScheme(portfolio),
  }
}

// Highest first: the first pattern that matches is the candidate's highest degree.
const DEGREE_PATTERNS: [NonNullable<ParsedResume["highestDegree"]>, RegExp][] = [
  ["PhD", /\bph\.?\s?d\b|\bdoctor(ate| of philosophy)\b/i],
  ["Master’s", /\bmaster(?:'s|’s|s)?\s+(of|in|degree)\b|\bm\.?s\.?c?\.?\s+(in|of)\b|\bm\.?tech\b|\bm\.?eng\b|\bmba\b|\bm\.?c\.?a\b/i],
  ["Bachelor’s", /\bbachelor(?:'s|’s|s)?\b|\bb\.?s\.?c?\.?\s+(in|of)\b|\bb\.?tech\b|\bb\.?e\.?\s+(in|of)\b|\bb\.?a\.?\s+(in|of)\b|\bb\.?c\.?a\b/i],
  ["Associate", /\bassociate(?:'s|’s)?\s+(of|in|degree)\b|\ba\.?a\.?s\.?\s+(in|of)\b/i],
]

/** Best guess at the highest degree held; the candidate confirms it in onboarding. */
export function degreeFromResume(text: string): ParsedResume["highestDegree"] {
  return DEGREE_PATTERNS.find(([, re]) => re.test(text))?.[0]
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MONTH = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`
const DATE_RANGE = new RegExp(
  String.raw`(?:${MONTH}\s*|(\d{1,2})/)?((?:19|20)\d\d)\s*(?:-|–|—|to)\s*(?:(?:${MONTH}\s*|(\d{1,2})/)?((?:19|20)\d\d)|(present|current|now|today))`,
  "gi",
)
// Dates next to these words belong to schooling, not work.
const EDUCATION_NEARBY = /universit|college|school|institute|bachelor|master|degree|gpa|b\.?tech|m\.?tech|b\.?s\b|m\.?s\b|ph\.?d|coursework/i

/**
 * Years of work from the resume's date ranges (spec 014): overlapping jobs
 * are merged, schooling dates skipped. Null when no work dates were found.
 */
export function yearsFromResume(text: string, now = new Date()): number | null {
  const toMonth = (year: string, month?: string, numeric?: string, end = false) => {
    const m = month ? MONTHS.indexOf(month.slice(0, 3).toLowerCase()) : numeric ? Number(numeric) - 1 : end ? 11 : 0
    return Number(year) * 12 + Math.min(Math.max(m, 0), 11)
  }
  const spans: [number, number][] = []
  for (const m of text.matchAll(DATE_RANGE)) {
    if (EDUCATION_NEARBY.test(text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 60))) continue
    const start = toMonth(m[3], m[1], m[2])
    const end = m[7] ? now.getFullYear() * 12 + now.getMonth() : toMonth(m[6], m[4], m[5], true)
    if (end > start && end - start < 40 * 12) spans.push([start, end])
  }
  if (spans.length === 0) return null
  spans.sort((a, b) => a[0] - b[0])
  let months = 0
  let [curStart, curEnd] = spans[0]
  for (const [s, e] of spans.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e)
    else {
      months += curEnd - curStart
      ;[curStart, curEnd] = [s, e]
    }
  }
  months += curEnd - curStart
  return Math.round((months / 12) * 10) / 10
}

export function parseResumeText(text: string): Omit<ParsedResume, "resumeId" | "fileName"> {
  return { skills: extractKeywords(text), highestDegree: degreeFromResume(text), contact: contactFrom(text) }
}
