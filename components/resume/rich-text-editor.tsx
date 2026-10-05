"use client"

import { useRef, useState } from "react"
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import { BoldIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, Redo2Icon, Undo2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RichContent } from "@/components/resume/rich-content"
import { SuggestionPanel, useSuggestion, WriteWithAIButton } from "@/components/resume/ai-suggestion"
import { useIsMobile } from "@/hooks/use-mobile"
import type { RichNode, SuggestRequest } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  id: string
  label: string
  value: RichNode
  onChange: (doc: RichNode) => void
  placeholder: string
  /** Builds the request for "Write with AI"; omit for fields AI must not write (facts like education). */
  ai?: () => SuggestRequest
}

const contentClass = cn(
  "min-h-24 px-3 py-2 text-sm leading-relaxed outline-none",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p+p]:mt-2",
  "[&_a]:text-primary-hover [&_a]:underline [&_a]:underline-offset-2",
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
)

export function RichTextEditor({ id, label, value, onChange, placeholder, ai }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto"] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: { id, class: contentClass, "aria-labelledby": `${id}-label`, "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON() as RichNode),
  })

  const suggestion = useSuggestion(ai ?? (() => ({ kind: "summary" })))
  const accept = (edit: boolean) => {
    if (suggestion.state.status !== "ready" || !suggestion.state.suggestion.doc || !editor) return
    const chain = editor.chain().setContent(suggestion.state.suggestion.doc, { emitUpdate: true })
    ;(edit ? chain.focus("end") : chain).run()
    suggestion.reset()
  }

  return (
    <div className="grid gap-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {ai && <WriteWithAIButton onClick={suggestion.run} busy={suggestion.state.status === "loading"} />}
      </div>

      <div className="overflow-hidden rounded-md border border-input bg-card transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>

      {ai && (
        <SuggestionPanel
          state={suggestion.state}
          onRetry={suggestion.run}
          onDiscard={suggestion.reset}
          actions={
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => accept(true)}>
                Accept and edit
              </Button>
              <Button type="button" size="sm" onClick={() => accept(false)}>
                Accept
              </Button>
            </>
          }
        >
          {suggestion.state.status === "ready" && suggestion.state.suggestion.doc && (
            <RichContent doc={suggestion.state.suggestion.doc} className="text-sm leading-relaxed [&_li]:my-0.5 [&_p+p]:mt-2" />
          )}
        </SuggestionPanel>
      )}
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            link: e.isActive("link"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  })

  const run = (fn: (e: Editor) => void) => () => editor && fn(editor)

  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5 border-b bg-muted/30 px-1 py-1">
      <ToolButton label="Bold" shortcut="Ctrl+B" active={state?.bold} onClick={run((e) => e.chain().focus().toggleBold().run())}>
        <BoldIcon />
      </ToolButton>
      <ToolButton label="Italic" shortcut="Ctrl+I" active={state?.italic} onClick={run((e) => e.chain().focus().toggleItalic().run())}>
        <ItalicIcon />
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={state?.bulletList} onClick={run((e) => e.chain().focus().toggleBulletList().run())}>
        <ListIcon />
      </ToolButton>
      <ToolButton label="Numbered list" active={state?.orderedList} onClick={run((e) => e.chain().focus().toggleOrderedList().run())}>
        <ListOrderedIcon />
      </ToolButton>
      <Divider />
      <LinkControl editor={editor} active={!!state?.link} />
      <div className="ml-auto flex gap-0.5">
        <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={!state?.canUndo} onClick={run((e) => e.chain().focus().undo().run())}>
          <Undo2Icon />
        </ToolButton>
        <ToolButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!state?.canRedo} onClick={run((e) => e.chain().focus().redo().run())}>
          <Redo2Icon />
        </ToolButton>
      </div>
    </div>
  )
}

const Divider = () => <span className="mx-1 h-4 w-px bg-border" aria-hidden />

interface ToolButtonProps extends React.ComponentProps<"button"> {
  label: string
  shortcut?: string
  active?: boolean
}

function ToolButton({ label, shortcut, active, className, ...props }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active ?? undefined}
          // Keep the editor's selection when the toolbar is clicked.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
            active && "bg-primary/10 text-primary-hover hover:bg-primary/15 hover:text-primary-hover",
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 text-background/60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const withScheme = /^(https?:\/\/|mailto:)/i.test(value) ? value : value.includes("@") && !value.includes("/") ? `mailto:${value}` : `https://${value}`
  try {
    const url = new URL(withScheme)
    return url.protocol === "mailto:" || url.hostname.includes(".") ? url.href : null
  } catch {
    return null
  }
}

function LinkControl({ editor, active }: { editor: Editor | null; active: boolean }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsText, setNeedsText] = useState(false)

  const onOpenChange = (next: boolean) => {
    if (next && editor) {
      const { from, to, empty } = editor.state.selection
      setUrl((editor.getAttributes("link").href as string | undefined) ?? "")
      setText(empty ? "" : editor.state.doc.textBetween(from, to, " "))
      setNeedsText(empty && !editor.isActive("link"))
      setError(null)
    }
    setOpen(next)
  }

  const apply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editor) return
    const href = normalizeUrl(url)
    if (!href) return setError("Enter a full web address, like linkedin.com/in/you.")
    if (needsText) {
      const label = text.trim() || url.trim()
      editor.chain().focus().insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] }).run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    setOpen(false)
  }

  const remove = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run()
    setOpen(false)
  }

  const form = (
    <form onSubmit={apply} noValidate className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="link-url">Web address</Label>
        <Input
          id="link-url"
          value={url}
          autoFocus
          inputMode="url"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "link-url-error" : undefined}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          className="bg-card"
        />
        {error && (
          <p id="link-url-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {needsText && (
        <div className="grid gap-2">
          <Label htmlFor="link-text">Text to show</Label>
          <Input id="link-text" value={text} onChange={(e) => setText(e.target.value)} className="bg-card" />
        </div>
      )}
      <div className="flex justify-end gap-1.5">
        {active && (
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="mr-auto text-destructive hover:text-destructive">
            Remove link
          </Button>
        )}
        <Button type="submit" size="sm">
          {active ? "Update link" : "Add link"}
        </Button>
      </div>
    </form>
  )

  const trigger = (
    <ToolButton label={active ? "Edit link" : "Add link"} active={active}>
      <LinkIcon />
    </ToolButton>
  )

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active ? "Edit link" : "Add link"}</DialogTitle>
            <DialogDescription>Links stay clickable in the exported PDF.</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {form}
      </PopoverContent>
    </Popover>
  )
}
