"use client"

import { useRef, useState } from "react"
import { FileTextIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** The reason a file can't be analyzed, or null if it can. */
function rejectReason(file: File): string | null {
  const name = file.name.toLowerCase()
  if (name.endsWith(".doc")) return "Older .doc files can't be read. Save it as .docx or PDF and upload again."
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return `“${file.name}” isn't a PDF or Word (.docx) file.`
  if (file.size > MAX_BYTES) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`
  if (file.size === 0) return `“${file.name}” is empty.`
  return null
}

interface UploadPanelProps {
  storedFileName: string | null
  onFile: (file: File) => void
  onStored: () => void
}

export function UploadPanel({ storedFileName, onFile, onStored }: UploadPanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const take = (file: File | undefined) => {
    if (input.current) input.current.value = ""
    if (!file) return
    const reason = rejectReason(file)
    if (reason) {
      toast.error("Can't analyze that file", { description: reason })
      return
    }
    onFile(file)
  }

  return (
    <section aria-labelledby="upload-title" className="border bg-card">
      <h2 id="upload-title" className="sr-only">
        Choose a resume
      </h2>
      <div className="p-4 md:p-5">
        <input ref={input} id="analysis-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
        <label
          htmlFor="analysis-file"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            take(e.dataTransfer.files[0])
          }}
          className={cn(
            "group flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 text-center transition-colors duration-150",
            "hover:border-primary/50 hover:bg-primary/[0.03] has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <span
            className={cn(
              "flex size-12 items-center justify-center bg-primary/10 text-primary-hover transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none",
              dragging && "-translate-y-1",
            )}
          >
            <UploadIcon className="size-5" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold">
            {dragging ? (
              "Drop to analyze"
            ) : (
              <>
                Drop your resume here, or <span className="text-primary-hover underline underline-offset-4">browse</span>
              </>
            )}
          </span>
          <span className="text-sm text-muted-foreground">PDF or Word (.docx), up to 5 MB</span>
        </label>
      </div>

      {storedFileName && (
        <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 md:px-5">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-muted-foreground">On file: </span>
            <span className="font-medium">{storedFileName}</span>
          </p>
          <Button variant="outline" size="sm" onClick={onStored}>
            Analyze this one
          </Button>
        </div>
      )}

      <p className="border-t px-4 py-3 text-sm text-muted-foreground md:px-5">
        Your file is read once to score it and isn&rsquo;t saved. Your profile and job matches don&rsquo;t change.
      </p>
    </section>
  )
}
