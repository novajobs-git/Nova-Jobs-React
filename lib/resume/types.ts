import { z } from "zod"

/** Tiptap's JSON shape. Rich text is stored and rendered as JSON, never as HTML. */
export interface RichNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: RichNode[]
}

const richNode: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() })).optional(),
    content: z.array(richNode).optional(),
  }),
)

export const TEMPLATES = [
  { id: "classic", label: "Classic" },
  { id: "compact", label: "Compact" },
  { id: "modern", label: "Modern" },
] as const
export type TemplateId = (typeof TEMPLATES)[number]["id"]

const text = z.string().max(300)

export const resumeDocSchema = z.object({
  template: z.enum(["classic", "compact", "modern"]),
  contact: z.object({
    fullName: text,
    headline: text,
    email: text,
    phone: text,
    location: text,
    links: z.array(z.object({ id: z.string(), label: text, url: text })).max(6),
  }),
  summary: richNode,
  experience: z.array(
    z.object({ id: z.string(), role: text, company: text, location: text, start: text, end: text, description: richNode }),
  ),
  education: z.array(z.object({ id: z.string(), school: text, degree: text, start: text, end: text, details: richNode })),
  skills: z.array(z.string().trim().min(1).max(60)).max(80),
  projects: z.array(z.object({ id: z.string(), name: text, tools: text, url: text, description: richNode })),
  updatedAt: z.string().nullable(),
})

export type ResumeDoc = z.infer<typeof resumeDocSchema>
export type ExperienceEntry = ResumeDoc["experience"][number]
export type EducationEntry = ResumeDoc["education"][number]
export type ProjectEntry = ResumeDoc["projects"][number]
export type SectionId = "contact" | "summary" | "experience" | "education" | "skills" | "projects"

export const suggestRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("summary") }),
  z.object({ kind: z.literal("entry"), doc: richNode }),
  z.object({ kind: z.literal("skills"), skills: z.array(z.string()) }),
])
export type SuggestRequest = z.infer<typeof suggestRequestSchema>
export interface Suggestion {
  /** Always true until Gemini is wired. */
  placeholder: boolean
  doc?: RichNode
  skills?: string[]
}

export const emptyDoc = (): RichNode => ({ type: "doc", content: [{ type: "paragraph" }] })

export const paragraphsDoc = (paragraphs: string[]): RichNode =>
  paragraphs.length
    ? { type: "doc", content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) }
    : emptyDoc()

export const bulletsDoc = (items: string[]): RichNode =>
  items.length
    ? {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
          },
        ],
      }
    : emptyDoc()

/** Plain text of each paragraph (list items included), in document order. */
export function docLines(node: RichNode): string[] {
  if (node.type === "paragraph") {
    const line = (node.content ?? []).map((n) => n.text ?? "").join("").trim()
    return line ? [line] : []
  }
  return (node.content ?? []).flatMap(docLines)
}

export const docIsEmpty = (node: RichNode) => docLines(node).length === 0

/** A clickable href for a typed address, or null; only web and mail links. */
export function safeHref(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  return /^(https?:\/\/|mailto:)/i.test(withScheme) ? withScheme : null
}

export const newId =() => Math.random().toString(36).slice(2, 10)
