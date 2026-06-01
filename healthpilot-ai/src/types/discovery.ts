/** Live healthcare facilities from OpenStreetMap (no manual database). */
export type DoctorSource = 'openstreetmap'

export type FacilityType = 'hospital' | 'clinic' | 'doctor' | 'health_centre' | 'other'

export interface DiscoveryDoctor {
  id: string
  source: DoctorSource
  facility_type: FacilityType
  full_name: string
  specialty: string
  specialty_slug: string | null
  qualification: string | null
  hospital_name: string | null
  address: string | null
  city: string | null
  city_slug: string | null
  province: string | null
  area: string | null
  latitude: number
  longitude: number
  distance_km: number
  phone: string | null
  whatsapp: string | null
  consultation_fee: number | null
  is_verified: boolean
  pmdc_number: string | null
  rating: number | null
  total_reviews: number
  experience_years: number | null
  accepts_online: boolean
  gender: 'male' | 'female' | null
  available_days: string[] | null
  osm_id?: string
  osm_type?: string
  ranking_score: number
  /** In-app booking disabled — use call / directions for live listings */
  can_book: boolean
}

export interface DiscoveryMeta {
  mode: 'gps' | 'city' | 'city_geocoded'
  latitude: number
  longitude: number
  radius_km: number
  facility_count: number
  specialty_filter: string | null
  data_source: 'openstreetmap'
}

export interface DiscoveryResponse {
  results: DiscoveryDoctor[]
  meta: DiscoveryMeta
}

/** Parse `osm-node-12345` into Overpass element type + id */
export function parseOsmPlaceId(placeId: string): { osmType: string; osmId: string } | null {
  const match = placeId.match(/^osm-(node|way|relation)-(\d+)$/i)
  if (!match) return null
  return { osmType: match[1], osmId: match[2] }
}
