import "server-only"

import type { StoredProfile } from "@/lib/profile/store"
import { extractKeywords } from "@/lib/matching/extract"
import { bulletsDoc, docLines, paragraphsDoc, type RichNode, type SuggestRequest, type Suggestion } from "./types"

/*
 * Placeholder for the Gemini call (not wired yet). It only reshapes what the
 * candidate already wrote or stored, so it can never invent a fact; the
 * real model must keep that rule.
 */
export class SuggestError extends Error {}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function tightenBullets(doc: RichNode): RichNode {
  const items = docLines(doc)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => sentenceCase(s.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "")))
    .filter((s) => s.length > 2)
  if (!items.length) {
    throw new SuggestError("Add a few notes first. Write with AI rewrites what you give it and won't invent experience.")
  }
  return bulletsDoc(items)
}

function summaryFrom(profile: StoredProfile, skills: string[]): RichNode {
  const title = profile.job_title.trim()
  if (!title) throw new SuggestError("Add your current title in your profile first.")
  const years = profile.years_experience.replace(/[–—]/g, " to ").replace(/\s+/g, " ").trim()
  const top = skills.slice(0, 6)
  const opening = years ? `${title} with ${years} years of experience.` : `${title}.`
  const core =
    top.length > 1 ? ` Core skills include ${top.slice(0, -1).join(", ")} and ${top.at(-1)}.` : top.length ? ` Core skill: ${top[0]}.` : ""
  return paragraphsDoc([opening + core])
}

export function suggest(request: SuggestRequest, profile: StoredProfile): Suggestion {
  switch (request.kind) {
    case "summary":
      return { placeholder: true, doc: summaryFrom(profile, profile.resume_skills) }
    case "entry":
      return { placeholder: true, doc: tightenBullets(request.doc) }
    case "skills": {
      const have = new Set(request.skills.map((s) => s.toLowerCase()))
      const found = extractKeywords(profile.resume_text).filter((s) => !have.has(s.toLowerCase()))
      if (!found.length) throw new SuggestError("Every skill found in your uploaded resume is already listed.")
      return { placeholder: true, skills: found }
    }
  }
}
