import type { DoctorSource, NormalizedDoctorRow, VerificationStatus } from './normalize.ts'

export type { DoctorSource, NormalizedDoctorRow, VerificationStatus }

export type ImportReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'

export interface RawImportRecord {
  source: DoctorSource
  external_id: string
  source_url: string
  payload: Record<string, unknown>
  full_name?: string | null
  specialty_raw?: string | null
  city_raw?: string | null
  pmdc_number?: string | null
}

export interface SitemapHarvestResult {
  source: DoctorSource
  urls: string[]
  errors: string[]
}

export interface ConnectorConfig {
  source: DoctorSource
  userAgent: string
  requestsPerSecond: number
  maxRetries: number
}

export interface ProfileFetchResult {
  external_id: string
  source_url: string
  normalized: NormalizedDoctorRow | null
  raw_html_length?: number
  error?: string
}

export const DEFAULT_CONNECTOR_CONFIG: ConnectorConfig = {
  source: 'manual',
  userAgent: 'HealthPilot-DirectoryBot/1.0 (+https://healthpilot.ai; directory-ingest)',
  requestsPerSecond: 1,
  maxRetries: 2,
}
