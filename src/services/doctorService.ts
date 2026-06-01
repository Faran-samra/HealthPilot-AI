import { supabase } from '@/lib/supabase'
import type { Doctor } from '@/lib/database.types'
import {
  DOCTOR_SEARCH_LIMIT,
  SEARCH_RADIUS_KM,
} from '@/utils/constants'
import { getCityCenterCoords, normalizeCitySlug } from '@/utils/locationUtils'

export interface DoctorSearchParams {
  specialty?: string
  /** City slug (e.g. "lahore") or display name — normalized internally. */
  city?: string
  area?: string
  hospital?: string
  latitude?: number
  longitude?: number
  radiusKm?: number
  maxFee?: number
  femaleOnly?: boolean
  onlineOnly?: boolean
  /** When true, GPS search is scoped to the selected city. Default: true. */
  scopeToCity?: boolean
}

export type DoctorSearchResult = Doctor & { distance_km?: number }

export interface DoctorSearchMeta {
  mode: 'gps' | 'city' | 'city_radius_fallback'
  radiusKm?: number
  citySlug?: string
  resultCount: number
}

function applyClientFilters(
  doctors: DoctorSearchResult[],
  { maxFee, femaleOnly, onlineOnly, hospital }: DoctorSearchParams
): DoctorSearchResult[] {
  let results = doctors
  if (maxFee) results = results.filter((d) => (d.consultation_fee ?? 0) <= maxFee)
  if (femaleOnly) results = results.filter((d) => d.gender === 'female')
  if (onlineOnly) results = results.filter((d) => d.accepts_online)
  if (hospital) {
    results = results.filter((d) =>
      d.hospital_name?.toLowerCase().includes(hospital.toLowerCase())
    )
  }
  return results
}

async function searchByRadius(
  lat: number,
  lng: number,
  params: DoctorSearchParams,
  citySlug?: string | null
): Promise<DoctorSearchResult[]> {
  const radii = params.radiusKm ? [params.radiusKm] : [...SEARCH_RADIUS_KM]
  const scopeToCity = params.scopeToCity !== false

  for (const radiusKm of radii) {
    const { data, error } = await supabase.rpc('doctors_within_radius', {
      lat,
      lng,
      radius_km: radiusKm,
      specialty_filter: params.specialty ?? null,
      city_slug_filter: scopeToCity && citySlug ? citySlug : null,
      area_filter: params.area ?? null,
      result_limit: DOCTOR_SEARCH_LIMIT,
    })

    if (error) throw error
    const filtered = applyClientFilters((data ?? []) as DoctorSearchResult[], params)
    if (filtered.length >= 3 || radiusKm === radii[radii.length - 1]) {
      return filtered
    }
  }

  return []
}

async function searchByCity(params: DoctorSearchParams, citySlug: string): Promise<DoctorSearchResult[]> {
  let query = supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .eq('city_slug', citySlug)
    .order('rating', { ascending: false })

  if (params.specialty) query = query.eq('specialty_slug', params.specialty)
  if (params.area) query = query.ilike('area', `%${params.area}%`)
  if (params.maxFee) query = query.lte('consultation_fee', params.maxFee)
  if (params.femaleOnly) query = query.eq('gender', 'female')
  if (params.onlineOnly) query = query.eq('accepts_online', true)
  if (params.hospital) query = query.ilike('hospital_name', `%${params.hospital}%`)

  const { data, error } = await query.limit(DOCTOR_SEARCH_LIMIT)
  if (error) throw error
  return applyClientFilters((data ?? []) as DoctorSearchResult[], params)
}

/**
 * Find doctors using the best available location signal:
 * 1. GPS + PostGIS radius (scoped to city when possible)
 * 2. City slug + optional area filter
 * 3. City-center radius fallback when city search returns nothing
 */
export async function findNearbyDoctors(
  params: DoctorSearchParams
): Promise<DoctorSearchResult[]> {
  const citySlug = normalizeCitySlug(params.city)
  const { latitude, longitude } = params

  if (latitude != null && longitude != null) {
    return searchByRadius(latitude, longitude, params, citySlug)
  }

  if (citySlug) {
    const cityResults = await searchByCity(params, citySlug)
    if (cityResults.length > 0) return cityResults

    // Fallback: search from city center coordinates within 50 km
    const center = getCityCenterCoords(citySlug)
    const radiusResults = await searchByRadius(center.lat, center.lng, {
      ...params,
      radiusKm: 50,
      scopeToCity: true,
    }, citySlug)

    return radiusResults
  }

  // No city or GPS — return top-rated nationwide (limited)
  let query = supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .order('rating', { ascending: false })

  if (params.specialty) query = query.eq('specialty_slug', params.specialty)
  if (params.maxFee) query = query.lte('consultation_fee', params.maxFee)
  if (params.femaleOnly) query = query.eq('gender', 'female')
  if (params.onlineOnly) query = query.eq('accepts_online', true)
  if (params.hospital) query = query.ilike('hospital_name', `%${params.hospital}%`)

  const { data, error } = await query.limit(DOCTOR_SEARCH_LIMIT)
  if (error) throw error
  return applyClientFilters((data ?? []) as DoctorSearchResult[], params)
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/** Count active doctors per city — useful for empty-state messaging. */
export async function getDoctorCountByCity(citySlug: string): Promise<number> {
  const { count, error } = await supabase
    .from('doctors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('city_slug', normalizeCitySlug(citySlug) ?? citySlug)

  if (error) throw error
  return count ?? 0
}
