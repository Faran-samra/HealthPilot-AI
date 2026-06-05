export interface NhsSections {
  overview?: string
  symptoms?: string
  causes?: string
  diagnosis?: string
  treatment?: string
  prevention?: string
  /** Urgent GP / 111 style advice (localized for Pakistan in chunks) */
  urgent_care?: string
  /** Call 999 / A&E style emergencies */
  emergency_care?: string
  when_to_seek_help?: string
  complications?: string
  self_care?: string
  other?: string
}

export interface NhsStructuredCondition {
  slug: string
  condition_name: string
  source_url: string
  source: 'nhs_uk'
  licence: 'OGL-3.0'
  category: 'A-Z conditions'
  scraped_at: string
  sections: NhsSections
  when_to_seek_help_uk?: string
}

export interface NhsLocalizedCondition extends NhsStructuredCondition {
  emergency_advice_pakistan?: string
  localized_pakistan_context?: string
  localized_at: string
}

export type ChunkUrgency = 'emergency' | 'urgent' | 'routine'
export type ChunkAudience = 'general' | 'adult' | 'child' | 'pregnancy'

export interface MedicalChunkDraft {
  slug: string
  title: string
  content: string
  /** Stored in DB `content`; if set, used for embedding instead of content */
  embedding_text?: string
  source: 'nhs_uk' | 'pakistan'
  source_url?: string
  condition_slug: string
  section: string
  locale: string
  specialty_tags: string[]
  urgency?: ChunkUrgency
  audience?: ChunkAudience
}
