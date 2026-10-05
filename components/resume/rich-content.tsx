import { Fragment, type ReactNode } from "react"

import type { RichNode } from "@/lib/resume/types"

// Stored JSON is rendered as React elements, so a saved document can never inject markup.
const SAFE_HREF = /^(https?:\/\/|mailto:)/i

function withMarks(text: string, marks: RichNode["marks"]): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{child}</strong>
      case "italic":
        return <em>{child}</em>
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : ""
        return SAFE_HREF.test(href) ? (
          <a href={href} rel="noopener noreferrer" className="underline underline-offset-2">
            {child}
          </a>
        ) : (
          child
        )
      }
      default:
        return child
    }
  }, text)
}

function renderNode(node: RichNode, key: number): ReactNode {
  const children = node.content?.map(renderNode)
  switch (node.type) {
    case "doc":
      return <Fragment key={key}>{children}</Fragment>
    case "paragraph":
      return <p key={key}>{children}</p>
    case "bulletList":
      return (
        <ul key={key} className="list-disc pl-[1.15em]">
          {children}
        </ul>
      )
    case "orderedList":
      return (
        <ol key={key} start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined} className="list-decimal pl-[1.3em]">
          {children}
        </ol>
      )
    case "listItem":
      return <li key={key}>{children}</li>
    case "hardBreak":
      return <br key={key} />
    case "text":
      return <Fragment key={key}>{withMarks(node.text ?? "", node.marks)}</Fragment>
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

export function RichContent({ doc, className }: { doc: RichNode; className?: string }) {
  return <div className={className}>{renderNode(doc, 0)}</div>
}
