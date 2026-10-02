"use client"

import { useRef, useState } from "react"
import { FileTextIcon, LoaderCircleIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ParsedResume } from "@/lib/profile/schema"

interface ResumeDropzoneProps {
  fileName?: string
  skillCount?: number
  onUploaded: (resume: ParsedResume) => void
  invalid?: boolean
}

type Envelope = { success: true; data: ParsedResume } | { success: false; error: string }

export function ResumeDropzone({ fileName, skillCount, onUploaded, invalid }: ResumeDropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const body = new FormData()
    body.append("resume", file)
    try {
      const res = (await (await fetch("/api/resume", { method: "POST", body })).json()) as Envelope
      if (res.success) onUploaded(res.data)
      else setError(res.error)
    } catch {
      setError("Upload failed. Check your connection and try again.")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        id="resume-file"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {fileName && !busy ? (
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-hover">
            <FileTextIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{fileName}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {skillCount ?? 0} skills found
            </p>
          </div>
          <Button variant="outline" className="bg-card" onClick={() => input.current?.click()}>
            Replace
          </Button>
        </div>
      ) : (
        <label
          htmlFor="resume-file"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            upload(e.dataTransfer.files[0])
          }}
          className={cn(
            "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.03]",
            dragging && "border-primary bg-primary/5",
            (invalid || error) && "border-destructive/50",
            busy && "pointer-events-none",
          )}
        >
          {busy ? (
            <>
              <LoaderCircleIcon className="size-7 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
              <span className="text-[15px] font-medium">Reading your resume…</span>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary-hover">
                <UploadIcon className="size-5" aria-hidden />
              </span>
              <span className="text-[15px] font-semibold">
                Drop your resume here, or <span className="text-primary-hover underline underline-offset-4">browse</span>
              </span>
              <span className="text-sm text-muted-foreground">PDF, up to 5 MB</span>
            </>
          )}
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
