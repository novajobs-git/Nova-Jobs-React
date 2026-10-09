/*
 * Title normalization for embeddings (spec 014): drop level words, numerals,
 * brackets, location words and scraped "New" badges, so similarity measures
 * the role only (the level is judged by the seniority filter).
 * Mirror of normalize_title() in scripts/ats/requirements.py; job and
 * candidate titles must normalize identically to share one embedding cache.
 */
const LEVEL_WORDS =
  /(?<!technical )\b(senior|sr|staff|principal|lead|director|head of|vp|vice president|distinguished|fellow|junior|jr|associate|intern(ship)?|co-?op|entry[- ]level|entry|new grad(uate)?|graduate|early career|mid[- ]level|intermediate)\b\.?\+?/gi

const EDGE = " ,-/.&+"

export function normalizeTitle(title: string): string {
  let t = title.trim().replace(/(?<=[a-z])New$/, "")
  t = t.toLowerCase()
  t = t.replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
  t = t.replace(LEVEL_WORDS, " ")
  t = t.replace(/\b(i{1,3}|iv|v|[1-5])\b/g, " ")
  t = t.replace(/\b(remote|hybrid|onsite|on-site|us|usa|united states)\b/g, " ")
  t = t.replace(/[^a-z0-9+#/&,. -]/g, " ")
  t = t.replace(/\s+/g, " ").replace(/\s+([,/])/g, "$1")
  let start = 0
  let end = t.length
  while (start < end && EDGE.includes(t[start])) start++
  while (end > start && EDGE.includes(t[end - 1])) end--
  return t.slice(start, end)
}
