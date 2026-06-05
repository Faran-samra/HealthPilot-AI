/**
 * Legacy fallback chain. Prefer `classifySymptomRoute` in `model-router.ts`
 * for severity-aware Haiku vs Sonnet selection.
 */
export const MODELS = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
] as const

export type ClaudeModel = (typeof MODELS)[number]

export const SPECIALTY_SLUGS = [
  'general', 'cardiology', 'dermatology', 'orthopedics', 'gynecology',
  'pediatrics', 'neurology', 'ent', 'ophthalmology', 'psychiatry',
  'urology', 'gastroenterology', 'endocrinology', 'pulmonology',
] as const

export type SpecialtySlug = (typeof SPECIALTY_SLUGS)[number]

export const SPECIALTY_LABELS: Record<SpecialtySlug, string> = {
  general: 'General Physician',
  cardiology: 'Cardiologist',
  dermatology: 'Dermatologist',
  orthopedics: 'Orthopedic specialist',
  gynecology: 'Gynecologist',
  pediatrics: 'Pediatrician',
  neurology: 'Neurologist',
  ent: 'ENT specialist',
  ophthalmology: 'Ophthalmologist',
  psychiatry: 'Psychiatrist',
  urology: 'Urologist',
  gastroenterology: 'Gastroenterologist',
  endocrinology: 'Endocrinologist',
  pulmonology: 'Pulmonologist',
}

export const SEVERITY_LEVELS = ['mild', 'moderate', 'severe', 'emergency'] as const

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]
