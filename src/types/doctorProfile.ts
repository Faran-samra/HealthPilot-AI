/** Extended profile fields (from Marham scrape or manual entry). */

export interface PracticeTimingRow {
  day: string
  start: string
  end: string
}

export interface DoctorProfileDetails {
  professional_statement?: string
  services?: string[]
  diseases?: string[]
  practice_timings?: PracticeTimingRow[]
  /** WhatsApp number digits for wa.me (e.g. 923001234567) */
  marham_whatsapp?: string
}

export function parseProfileDetails(raw: unknown): DoctorProfileDetails {
  if (!raw || typeof raw !== 'object') return {}
  return raw as DoctorProfileDetails
}
