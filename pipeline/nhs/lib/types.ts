export interface NhsSections {
  overview?: string
  symptoms?: string
  causes?: string
  diagnosis?: string
  treatment?: string
  prevention?: string
  when_to_seek_help?: string
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

export interface MedicalChunkDraft {
  slug: string
  title: string
  content: string
  source: 'nhs_uk' | 'pakistan'
  source_url?: string
  condition_slug: string
  section: string
  locale: string
  specialty_tags: string[]
}
