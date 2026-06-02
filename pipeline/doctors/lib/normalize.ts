/**
 * Normalize doctor fields for nationwide directory ingestion.
 */

const SPECIALTY_ALIASES: Record<string, string> = {
  'general physician': 'general',
  gp: 'general',
  physician: 'general',
  'general practitioner': 'general',
  cardiologist: 'cardiology',
  'heart specialist': 'cardiology',
  cardiology: 'cardiology',
  dermatologist: 'dermatology',
  dermatology: 'dermatology',
  'skin specialist': 'dermatology',
  gynecologist: 'gynecology',
  gynaecologist: 'gynecology',
  gynecology: 'gynecology',
  pediatrician: 'pediatrics',
  paediatrician: 'pediatrics',
  pediatrics: 'pediatrics',
  neurologist: 'neurology',
  neurology: 'neurology',
  orthopedics: 'orthopedics',
  orthopaedic: 'orthopedics',
  ent: 'ent',
  otolaryngologist: 'ent',
  psychiatrist: 'psychiatry',
  psychiatry: 'psychiatry',
  urologist: 'urology',
  urology: 'urology',
  pulmonologist: 'pulmonology',
  pulmonology: 'pulmonology',
}

const SPECIALTY_LABELS: Record<string, string> = {
  general: 'General Physician',
  cardiology: 'Cardiologist',
  dermatology: 'Dermatologist',
  gynecology: 'Gynecologist',
  pediatrics: 'Pediatrician',
  neurology: 'Neurologist',
  orthopedics: 'Orthopedic Surgeon',
  ent: 'ENT Specialist',
  psychiatry: 'Psychiatrist',
  urology: 'Urologist',
  pulmonology: 'Pulmonologist',
  gastroenterology: 'Gastroenterologist',
  endocrinology: 'Endocrinologist',
  ophthalmology: 'Ophthalmologist',
}

export function normalizeSpecialty(raw: string | null | undefined): {
  slug: string
  label: string
} {
  const key = (raw ?? 'general').toLowerCase().trim().replace(/\s+/g, ' ')
  const slugFromKey = key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'general'
  const slug = SPECIALTY_ALIASES[key] ?? slugFromKey
  const label = SPECIALTY_LABELS[slug] ?? raw?.trim() ?? 'General Physician'
  return { slug, label }
}

const MEDICAL_HONORIFIC =
  /^(?:dr|prof|asst|assoc|assistant|associate|mr|ms|mrs|miss)\.?\s/i

export function normalizeDoctorName(name: string): string {
  let n = name.trim().replace(/\s+/g, ' ')
  // "Dr. Prof. Dr. Haroon Javaid" → "Prof. Dr. Haroon Javaid"
  n = n.replace(/^dr\.?\s+(?=(?:prof|asst|assoc|assistant|associate)\.?\s)/i, '')
  n = n.replace(/^(dr\.?\s+){2,}/i, 'Dr. ')

  if (!MEDICAL_HONORIFIC.test(n)) {
    n = n.replace(/^(mr|ms|mrs)\.?\s+/i, '')
    n = `Dr. ${n}`
  }
  return n
}

export function normalizeCitySlug(city: string | null | undefined): string {
  return (city ?? 'lahore').toLowerCase().trim().replace(/\s+/g, '-')
}

export function parseFee(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return Math.round(raw)
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : null
}

export type DoctorSource = 'pmdc' | 'marham' | 'oladoc' | 'hamariweb' | 'osm' | 'manual' | 'healthpilot'

export type VerificationStatus = 'unverified' | 'verified' | 'cross_verified' | 'community_verified'

export interface NormalizedDoctorRow {
  full_name: string
  specialty: string
  specialty_slug: string
  qualification?: string | null
  experience_years?: number | null
  hospital_name?: string | null
  clinic_name?: string | null
  address?: string | null
  city: string
  city_slug: string
  province?: string | null
  area?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
  whatsapp?: string | null
  consultation_fee?: number | null
  gender?: 'male' | 'female' | null
  languages?: string[]
  pmdc_number?: string | null
  source: DoctorSource
  source_url?: string | null
  verification_status: VerificationStatus
  is_verified: boolean
  profile_details?: Record<string, unknown>
  available_days?: string[]
  available_times?: { practice_timings?: { day: string; start: string; end: string }[] }
}
