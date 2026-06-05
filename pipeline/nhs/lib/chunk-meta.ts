import type { MedicalChunkDraft } from './types.ts'

export type UrgencyLevel = 'emergency' | 'urgent' | 'routine'
export type AudienceTag = 'general' | 'adult' | 'child' | 'pregnancy'

export function inferUrgency(section: string): UrgencyLevel {
  if (section === 'emergency_care' || section === 'emergency_advice_pakistan') return 'emergency'
  if (section === 'urgent_care' || section === 'complications') return 'urgent'
  return 'routine'
}

export function inferAudience(text: string, section: string): AudienceTag {
  const t = text.toLowerCase()
  if (/pregnan|حامل|حمل|trimester|baby|infant|newborn|بچہ|child under/i.test(t)) {
    if (/pregnan|حامل|حمل/i.test(t)) return 'pregnancy'
    return 'child'
  }
  if (section === 'symptoms' && /\bbaby\b|\binfant\b/i.test(t)) return 'child'
  return 'general'
}

export function buildSpecialtyTags(draft: {
  section: string
  content: string
  urgency?: UrgencyLevel
  audience?: AudienceTag
}): string[] {
  const tags: string[] = []
  const urgency = draft.urgency ?? inferUrgency(draft.section)
  const audience = draft.audience ?? inferAudience(draft.content, draft.section)
  tags.push(`urgency:${urgency}`)
  tags.push(`audience:${audience}`)
  return tags
}

export function applyChunkMetadata(draft: MedicalChunkDraft): MedicalChunkDraft {
  draft.urgency = inferUrgency(draft.section)
  draft.audience = inferAudience(draft.content, draft.section)
  draft.specialty_tags = buildSpecialtyTags(draft)
  return draft
}

/** One shared chunk for generic Pakistan emergency guidance (avoids 600+ near-duplicate vectors). */
export const SHARED_PAKISTAN_EMERGENCY_SLUG = 'pakistan-general-emergency'

export function buildSharedPakistanEmergencyChunk(): MedicalChunkDraft {
  const draft: MedicalChunkDraft = {
    slug: SHARED_PAKISTAN_EMERGENCY_SLUG,
    title: 'Pakistan — When to seek emergency care',
    content: `[Pakistan guidance]\n\nFor life-threatening symptoms (severe pain, difficulty breathing, loss of consciousness, heavy bleeding, chest pain, stroke signs, severe allergic reaction), go to the nearest hospital emergency or call Rescue 1122 / Edhi 115 immediately.\n\nFor non-emergency concerns, visit a general physician or hospital OPD.`,
    source: 'pakistan',
    condition_slug: 'general-emergency',
    section: 'emergency_advice_pakistan',
    locale: 'en-PK',
    specialty_tags: [],
    urgency: 'emergency',
    audience: 'general',
  }
  draft.specialty_tags = buildSpecialtyTags(draft)
  return draft
}
