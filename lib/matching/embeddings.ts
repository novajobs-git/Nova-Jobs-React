import "server-only"

import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { normalizeTitle } from "./titles"

/*
 * Title embeddings (spec 014): gemini-embedding-001, 768 dims, L2-normalized,
 * so cosine similarity is a dot product. Job titles are embedded once at
 * ingestion (scripts/embed_titles.py); a candidate's target titles are
 * embedded when they're saved, and only titles not already cached are sent.
 * Opening the Jobs page never calls Gemini once both caches are filled.
 */
const MODEL = "gemini-embedding-001"
const DIMS = 768
const JOB_CACHE = path.join(process.cwd(), "data", "jobs", "title-embeddings.json")
// One demo candidate until Clerk exists (same id as lib/jobs/matches.ts).
const CANDIDATE_CACHE = path.join(process.cwd(), "data", "embeddings", "candidate.json")

interface CacheFile {
  model: string
  dims: number
  /** normalized title -> base64 little-endian float32 */
  titles: Record<string, string>
}

// Copied into a fresh buffer: small Buffers share a pool and may not be 4-byte aligned.
const decode = (b64: string) => new Float32Array(new Uint8Array(Buffer.from(b64, "base64")).buffer)

const encode = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64")

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

async function readCache(file: string): Promise<CacheFile | null> {
  try {
    const cache = JSON.parse(await readFile(file, "utf8")) as CacheFile
    return cache.model === MODEL && cache.dims === DIMS ? cache : null
  } catch {
    return null
  }
}

let jobCache: { version: number; vectors: Map<string, Float32Array> } | null = null

/** Job title vectors keyed by normalized title; version changes whenever embed_titles rewrites the file. */
export async function loadJobEmbeddings(): Promise<{ version: number; vectors: Map<string, Float32Array> }> {
  let version = 0
  try {
    version = (await stat(JOB_CACHE)).mtimeMs
  } catch {
    return { version, vectors: new Map() }
  }
  if (jobCache?.version !== version) {
    const cache = await readCache(JOB_CACHE)
    jobCache = { version, vectors: new Map(Object.entries(cache?.titles ?? {}).map(([t, v]) => [t, decode(v)])) }
  }
  return jobCache
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY is not set")
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: DIMS,
    })),
  })
  let res: Response | undefined
  // Rate limits clear within seconds; same backoff as engine/gemini.py.
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
    })
    if (res.status !== 429 && res.status < 500) break
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  if (!res?.ok) throw new Error(`Gemini embeddings failed (${res?.status})`)
  const { embeddings } = (await res.json()) as { embeddings: { values: number[] }[] }
  return embeddings.map(({ values }) => {
    const norm = Math.hypot(...values) || 1
    return Float32Array.from(values, (x) => x / norm)
  })
}

/**
 * Vectors for the candidate's target titles, embedding only titles not seen
 * before. Returns null if any title can't be embedded (no key, API down), and
 * matching then runs without the title filter rather than failing.
 */
export async function candidateTitleVectors(titles: string[]): Promise<Float32Array[] | null> {
  const wanted = [...new Set(titles.map(normalizeTitle).filter(Boolean))]
  if (wanted.length === 0) return null
  const cache = (await readCache(CANDIDATE_CACHE)) ?? { model: MODEL, dims: DIMS, titles: {} }
  const missing = wanted.filter((t) => !cache.titles[t])
  if (missing.length > 0) {
    try {
      const vectors = await embed(missing)
      missing.forEach((t, i) => (cache.titles[t] = encode(vectors[i])))
      // Keep only the current titles: the cache is this candidate's preference, not a history.
      cache.titles = Object.fromEntries(wanted.map((t) => [t, cache.titles[t]]))
      await mkdir(path.dirname(CANDIDATE_CACHE), { recursive: true })
      await writeFile(CANDIDATE_CACHE, JSON.stringify(cache), "utf8")
    } catch (e) {
      console.error("[matching] couldn't embed target titles:", e instanceof Error ? e.message : e)
      return null
    }
  }
  return wanted.map((t) => decode(cache.titles[t]))
}
