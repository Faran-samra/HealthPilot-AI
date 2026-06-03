/** Client-side filters for broken Marham scrape rows still in the directory. */

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

export function isGarbageDoctorName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true
  const n = name.trim()
  if (n.length < 4) return true
  if (/^dr\.?\s+dr\.?\s*$/i.test(n)) return true
  if (/^dr\.?\s+area\b/i.test(n)) return true
  if (/^dr\.?\s+doctors\s+in\b/i.test(n)) return true
  if (/^(asst|assoc)\s+prof\.?$/i.test(n)) return true
  if (/^\d+\s+best\b/i.test(n)) return true
  if (/\bbest\b.+\bin\b/i.test(n)) return true
  if (GARBAGE_NAME_RE.test(n.replace(/^dr\.?\s+/i, ''))) return true
  if (GARBAGE_NAME_RE.test(n)) return true
  const withoutHonorific = n
    .replace(/^(?:(?:asst|assoc|assistant|associate)\.?\s+)?(?:(?:dr|prof)\.?\s+)+/gi, '')
    .trim()
  if (withoutHonorific.length < 2) return true
  return false
}

export function isDirectoryQualityDoctor(doctor: {
  full_name?: string | null
  specialty?: string | null
  source?: string | null
}): boolean {
  const src = (doctor.source ?? 'healthpilot').toLowerCase()
  if (src === 'healthpilot' || src === 'manual') return false
  if (isGarbageDoctorName(doctor.full_name)) return false
  if (doctor.specialty && isGarbageDisplayText(doctor.specialty)) return false
  return true
}
