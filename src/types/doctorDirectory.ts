/** Nationwide doctor directory (Supabase `doctors` table). */

export type DoctorDataSource =
  | 'pmdc'
  | 'marham'
  | 'oladoc'
  | 'hamariweb'
  | 'osm'
  | 'manual'
  | 'healthpilot'

export type DoctorVerificationStatus =
  | 'unverified'
  | 'verified'
  | 'cross_verified'
  | 'community_verified'

export interface DirectoryDoctor {
  id: string
  full_name: string
  specialty: string
  specialty_slug: string
  qualification: string | null
  experience_years: number | null
  hospital_name: string | null
  clinic_name: string | null
  address: string | null
  city: string
  city_slug: string | null
  province: string | null
  area: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  whatsapp: string | null
  consultation_fee: number | null
  languages: string[] | null
  rating: number
  total_reviews: number
  profile_image_url: string | null
  is_verified: boolean
  verification_status: DoctorVerificationStatus
  is_active: boolean
  pmdc_number: string | null
  accepts_online: boolean
  gender: 'male' | 'female' | null
  source: DoctorDataSource
  source_url: string | null
  distance_km?: number
  /** False when distance uses city-center estimate only. */
  distance_precise?: boolean
  location_precision?: 'exact' | 'hospital' | 'area' | 'city'
}

/** Map Supabase doctor row (with optional migration 010 fields) to directory card shape. */
export function toDirectoryDoctor(
  row: Record<string, unknown> & {
    id: string
    full_name: string
    specialty: string
    specialty_slug: string
    city: string
    rating: number
    total_reviews: number
    is_verified: boolean
    is_active: boolean
    accepts_online: boolean
  }
): DirectoryDoctor {
  const verification = (row.verification_status as DirectoryDoctor['verification_status'] | undefined)
    ?? (row.is_verified || row.pmdc_number ? 'verified' : 'unverified')

  return {
    id: row.id,
    full_name: row.full_name,
    specialty: row.specialty,
    specialty_slug: row.specialty_slug,
    qualification: (row.qualification as string | null) ?? null,
    experience_years: (row.experience_years as number | null) ?? null,
    hospital_name: (row.hospital_name as string | null) ?? null,
    clinic_name: (row.clinic_name as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    city: row.city,
    city_slug: (row.city_slug as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    area: (row.area as string | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    consultation_fee: (row.consultation_fee as number | null) ?? null,
    languages: (row.languages as string[] | null) ?? null,
    rating: row.rating,
    total_reviews: row.total_reviews,
    profile_image_url: (row.profile_image_url as string | null) ?? null,
    is_verified: row.is_verified,
    verification_status: verification,
    is_active: row.is_active,
    pmdc_number: (row.pmdc_number as string | null) ?? null,
    accepts_online: row.accepts_online,
    gender: (row.gender as DirectoryDoctor['gender']) ?? null,
    source: (row.source as DirectoryDoctor['source']) ?? 'healthpilot',
    source_url: (row.source_url as string | null) ?? null,
    distance_km: row.distance_km as number | undefined,
    distance_precise: row.distance_precise as boolean | undefined,
    location_precision: row.location_precision as DirectoryDoctor['location_precision'],
  }
}
