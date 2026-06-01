/** Anthropic model fallback chain — single source of truth for edge functions. */
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

export const SEVERITY_LEVELS = ['mild', 'moderate', 'severe', 'emergency'] as const

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]
