import { readFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"

/*
 * Serves company logos downloaded by the scrapers into data/logos/ (spec 011).
 * Files are named by a hash of their bytes, so they never change and can be
 * cached forever.
 */
const LOGO_DIR = path.join(process.cwd(), "data", "logos")
const FILE = /^[a-f0-9]{20}\.(png|jpg|gif|webp|svg|ico|avif)$/

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/logos/[file]">) {
  const { file } = await ctx.params
  const ext = FILE.exec(file)?.[1]
  if (!ext) return new Response("Not found", { status: 404 })
  try {
    const body = await readFile(path.join(LOGO_DIR, file))
    return new Response(body, {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // Logos come from third-party boards: an SVG opened directly must not run scripts on our origin.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
