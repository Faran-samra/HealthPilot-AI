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

const GARBAGE_NAME_RE =
  /^(?:dr\.?\s+)?(dr|area|assoc|prof|asst|general|pediatric|neuro|cardiology|gynecologist|dentist|anesthetist|counselor|physiotherapist|nutritionist|pathologist|radiologist|urologist|cardiologist|oncologist|surgeon|physician|pulmonologist|neurologist|psychiatrist|dermatologist|audiologist|endocrinologist|gastroenterologist|hematologist|liver specialist)$/i

/** Broken URL fallback or specialty listing titles (e.g. "Dr. dr", "Dr. pediatric"). */
export function isGarbageDoctorName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true
  const n = name.trim()
  if (n.length < 4) return true
  if (/^dr\.?\s+dr\.?\s*$/i.test(n)) return true
  if (/^(asst|assoc)\s+prof\.?$/i.test(n)) return true
  if (/^\d+\s+best\b/i.test(n)) return true
  if (/\bbest\b.+\bin\b/i.test(n)) return true
  if (GARBAGE_NAME_RE.test(n.replace(/^dr\.?\s+/i, ''))) return true
  if (GARBAGE_NAME_RE.test(n)) return true
  const withoutHonorific = n.replace(/^(?:(?:asst|assoc|assistant|associate)\.?\s+)?(?:(?:dr|prof)\.?\s+)+/gi, '').trim()
  if (withoutHonorific.length < 2) return true
  return false
}

export function cleanDisplayText(value: string | null | undefined, maxLen = 80): string | null {
  if (!value) return null
  let s = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (isGarbageDisplayText(s)) return null
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s || null
}
