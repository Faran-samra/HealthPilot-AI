import {
  SPECIALTY_LABELS,
  SPECIALTY_SLUGS,
  SEVERITY_LEVELS,
  type SpecialtySlug,
} from './models.ts'

const MAX_LIST = 5

function trimStrings(arr: unknown, max: number): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 500))
    .slice(0, max)
}

/** Llama/Groq often return one string instead of JSON arrays — split safely. */
export function coerceToStringArray(val: unknown, max = MAX_LIST): string[] {
  if (Array.isArray(val)) return trimStrings(val, max)
  if (typeof val !== 'string' || !val.trim()) return []

  const text = val.trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (Array.isArray(parsed)) return trimStrings(parsed, max)
    } catch {
      /* fall through */
    }
  }

  const parts = text
    .split(/\n+|(?:\s*;\s*)|(?:\s*•\s*)|(?:\d+\.\s+)/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length > 0)

  return parts.slice(0, max).map((s) => s.slice(0, 500))
}

function coerceSeverity(val: unknown): (typeof SEVERITY_LEVELS)[number] {
  if (typeof val === 'string' && SEVERITY_LEVELS.includes(val as (typeof SEVERITY_LEVELS)[number])) {
    return val as (typeof SEVERITY_LEVELS)[number]
  }
  return 'moderate'
}

function coerceSpecialtySlug(val: unknown): SpecialtySlug {
  if (typeof val === 'string' && SPECIALTY_SLUGS.includes(val as SpecialtySlug)) {
    return val as SpecialtySlug
  }
  return 'general'
}

function deriveSpecialtyLabel(slug: SpecialtySlug, existing?: unknown): string {
  if (typeof existing === 'string' && existing.trim().length > 0) {
    return existing.trim().slice(0, 200)
  }
  return SPECIALTY_LABELS[slug]
}

/** Fix common LLM overshoots (e.g. 6+ red_flags) before Zod — avoids costly Claude re-runs. */
export function normalizeSymptomAnalysisRaw(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const normalized: Record<string, unknown> = { ...o }

  normalized.possible_conditions = coerceToStringArray(o.possible_conditions, MAX_LIST)
  normalized.first_aid_tips = coerceToStringArray(o.first_aid_tips, MAX_LIST)
  normalized.red_flags = coerceToStringArray(o.red_flags, MAX_LIST)

  if (typeof o.explanation === 'string') {
    normalized.explanation = o.explanation.trim().slice(0, 4000)
  }
  if (typeof o.brief_summary === 'string') {
    normalized.brief_summary = o.brief_summary.trim().slice(0, 800)
  }
  if (typeof o.urdu_summary === 'string') {
    normalized.urdu_summary = o.urdu_summary.trim().slice(0, 2000)
  }
  if (typeof o.disclaimer === 'string') {
    normalized.disclaimer = o.disclaimer.trim().slice(0, 1500)
  }
  if (typeof o.primary_condition === 'string') {
    normalized.primary_condition = o.primary_condition.trim().slice(0, 300)
  }

  normalized.severity_level = coerceSeverity(o.severity_level)
  const slug = coerceSpecialtySlug(o.recommended_specialty_slug)
  normalized.recommended_specialty_slug = slug
  normalized.recommended_specialty = deriveSpecialtyLabel(slug, o.recommended_specialty)

  if (
    o.condition_confidence === 'high' ||
    o.condition_confidence === 'medium' ||
    o.condition_confidence === 'low'
  ) {
    normalized.condition_confidence = o.condition_confidence
  } else {
    normalized.condition_confidence = 'medium'
  }

  if (!normalized.brief_summary && typeof normalized.primary_condition === 'string') {
    normalized.brief_summary = normalized.primary_condition
  }

  if (!Array.isArray(normalized.first_aid_tips) || normalized.first_aid_tips.length === 0) {
    normalized.first_aid_tips = ['Stay with the person during symptoms', 'Seek medical advice promptly']
  }
  if (!Array.isArray(normalized.red_flags) || normalized.red_flags.length === 0) {
    normalized.red_flags = [
      'Symptoms worsen rapidly or become prolonged',
      `Call Rescue 1122 or Edhi 115 in an emergency`,
    ]
  }
  if (!Array.isArray(normalized.possible_conditions) || normalized.possible_conditions.length === 0) {
    normalized.possible_conditions = ['Needs in-person medical evaluation']
  }
  if (typeof normalized.disclaimer !== 'string' || !String(normalized.disclaimer).trim()) {
    normalized.disclaimer =
      'This is health guidance only, not a medical diagnosis. Please consult a qualified doctor in Pakistan.'
  }
  if (typeof normalized.urdu_summary !== 'string' || !String(normalized.urdu_summary).trim()) {
    normalized.urdu_summary =
      'Yeh sirf rehnumai hai, mukammal tashkhees nahi. Barah-e-karam jald doctor se mashwara karein.'
  }

  return normalized
}
