/** Reject scraped CSS/JS blobs mistaken for display fields. */

const GARBAGE_PATTERNS = [
  /\{[\s\S]*\}/,
  /@media\s*\(/i,
  /\.off-panel/i,
  /line-height:\s*0/i,
  /flex-direction:/i,
  /margin-inline:/i,
  /<style/i,
  /<\/style/i,
]

export function isGarbageDisplayText(value: string | null | undefined): boolean {
  if (!value) return true
  const s = value.trim()
  if (s.length < 2) return true
  if (s.length > 100) return true
  return GARBAGE_PATTERNS.some((re) => re.test(s))
}

export function cleanDisplayText(value: string | null | undefined, maxLen = 80): string | null {
  if (!value) return null
  let s = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (isGarbageDisplayText(s)) return null
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s || null
}
