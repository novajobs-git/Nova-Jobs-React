import { GENERIC_SKILLS, SKILLS } from "./skills"

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Word-ish boundaries that also respect skills ending in symbols ("C++",
// "C#", ".NET"): a term must not touch another letter, digit, '+' or '#',
// and must not follow a '.' (so "Node.js" doesn't also count as "JS").
const PATTERNS: [string, RegExp][] = Object.entries(SKILLS).map(([name, aliases]) => {
  const terms = [name, ...aliases].map((t) => escape(t.toLowerCase()))
  return [name, new RegExp(`(?<![a-z0-9+#.])(?:${terms.join("|")})(?![a-z0-9+#])`, "i")]
})

/** Canonical skills found in free text, in dictionary order. */
export function extractKeywords(text: string): string[] {
  const haystack = text.replace(/\s+/g, " ")
  return PATTERNS.filter(([, re]) => re.test(haystack)).map(([name]) => name)
}

/** Skills that count toward a match score (generic soft skills removed). */
export function scorableKeywords(keywords: string[]): string[] {
  return keywords.filter((k) => !GENERIC_SKILLS.has(k))
}
