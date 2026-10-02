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

export function parseResumeText(text: string): Omit<ParsedResume, "resumeId" | "fileName"> {
  return { skills: extractKeywords(text), contact: contactFrom(text) }
}
