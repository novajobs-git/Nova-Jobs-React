/** Resume analysis result (spec 013). Shared by the API route and the page. */

export type Band = "Strong" | "Fair" | "Needs work"

/** Score bands: 75-100 Strong (green), 50-74 Fair (yellow), 0-49 Needs work (red). */
export const bandFor = (score: number): Band => (score >= 75 ? "Strong" : score >= 50 ? "Fair" : "Needs work")

export interface ParseCheck {
  label: string
  passed: boolean
  /** What to change when the check failed. */
  fix: string
}

export interface GrammarIssue {
  kind: "spelling" | "repeated" | "first_person" | "tense" | "punctuation"
  /** The flagged text with a little context, as it appears in the resume. */
  excerpt: string
  /** The exact word or phrase inside the excerpt. */
  flagged: string
  message: string
}

export interface ImpactGap {
  bullet: string
  suggestion: string
}

export interface Analysis {
  fileName: string
  overall: number
  /** One line per scanning stage, revealed as each stage completes. */
  stages: { read: string; sections: string; grammar: string; impact: string; score: string }
  parsed: { score: number; checks: ParseCheck[] }
  grammar: { score: number; issues: GrammarIssue[] }
  /** score is null when the resume has no bullet points to measure. */
  impact: { score: number | null; total: number; measured: number; gaps: ImpactGap[] }
}
