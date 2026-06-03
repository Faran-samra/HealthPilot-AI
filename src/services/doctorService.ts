import { supabase } from '@/lib/supabase'
import type { Doctor } from '@/lib/database.types'
import {
  DOCTOR_CITY_LISTING_MAX,
  DOCTOR_SEARCH_LIMIT,
  NEAR_ME_CITY_RADIUS_KM,
  NEAR_ME_MAX_CITIES,
  NEAR_ME_MIN_RESULTS,
  SEARCH_RADIUS_KM,
} from '@/utils/constants'
import { annotateNearMeDistances } from '@/utils/doctorGeo'
import {
  getCityCenterCoords,
  nearbyCitySlugs,
  normalizeCitySlug,
} from '@/utils/locationUtils'
import { matchesGenderFilter } from '@/utils/doctorGender'
import {
  buildSpecialtyOrFilter,
  doctorMatchesSpecialtyFilter,
} from '@/utils/specialtyFilter'
import { isDirectoryListedDoctor } from '@/utils/doctorDirectoryFilter'
import { isDirectoryQualityDoctor } from '@/utils/doctorSanitize'

const CITY_FETCH_PAGE_SIZE = 1000

/** Lighter payload for directory cards (no profile_details / timings blobs). */
export const DIRECTORY_LIST_SELECT =
  'id,full_name,specialty,specialty_slug,qualification,experience_years,hospital_name,clinic_name,address,city,city_slug,province,area,latitude,longitude,phone,whatsapp,consultation_fee,languages,rating,total_reviews,profile_image_url,is_verified,verification_status,is_active,pmdc_number,accepts_online,gender,source,source_url'

const inflightSearches = new Map<string, Promise<DoctorSearchResult[]>>()

function searchCacheKey(params: DoctorSearchParams): string {
  return JSON.stringify({
    city: params.city,
    area: params.area,
    specialty: params.specialty,
    hospital: params.hospital,
    name: params.name,
    lat: params.latitude,
    lng: params.longitude,
    maxFee: params.maxFee,
    minFee: params.minFee,
    femaleOnly: params.femaleOnly,
    maleOnly: params.maleOnly,
    language: params.language,
    onlineOnly: params.onlineOnly,
    scopeToCity: params.scopeToCity,
    radiusKm: params.radiusKm,
  })
}

export interface DoctorSearchParams {
  specialty?: string
  city?: string
  area?: string
  hospital?: string
  name?: string
  latitude?: number
  longitude?: number
  radiusKm?: number
  radiiKm?: readonly number[]
  maxFee?: number
  minFee?: number
  femaleOnly?: boolean
  maleOnly?: boolean
  language?: string
  onlineOnly?: boolean
  scopeToCity?: boolean
}

export type DoctorSearchResult = Doctor & { distance_km?: number; distance_precise?: boolean }

export interface DoctorSearchMeta {
  mode: 'gps' | 'city' | 'city_radius_fallback' | 'directory_rpc' | 'gps_city_hybrid'
  radiusKm?: number
  citySlug?: string
  resultCount: number
}

function applyClientFilters(
  doctors: DoctorSearchResult[],
  params: DoctorSearchParams
): DoctorSearchResult[] {
  let results = doctors.filter(
    (d) => isDirectoryListedDoctor(d) && isDirectoryQualityDoctor(d)
  )
  if (params.specialty) {
    results = results.filter((d) => doctorMatchesSpecialtyFilter(d, params.specialty))
  }
  const { maxFee, minFee } = params
  if (maxFee != null) results = results.filter((d) => (d.consultation_fee ?? 0) <= maxFee)
  if (minFee != null) results = results.filter((d) => (d.consultation_fee ?? 0) >= minFee)
  if (params.femaleOnly) {
    results = results.filter((d) => matchesGenderFilter(d, 'female'))
  }
  if (params.maleOnly) {
    results = results.filter((d) => matchesGenderFilter(d, 'male'))
  }
  if (params.onlineOnly) results = results.filter((d) => d.accepts_online)
  if (params.hospital) {
    const h = params.hospital.toLowerCase()
    results = results.filter(
      (d) =>
        d.hospital_name?.toLowerCase().includes(h) ||
        (d as Doctor & { clinic_name?: string }).clinic_name?.toLowerCase().includes(h)
    )
  }
  if (params.language) {
    const lang = params.language.toLowerCase()
    results = results.filter((d) => d.languages?.some((l) => l.toLowerCase().includes(lang)))
  }
  return results
}

function genderFilterParam(_params: DoctorSearchParams): string | null {
  return null
}

function isCityListingMode(params: DoctorSearchParams, citySlug?: string | null): boolean {
  return Boolean(citySlug && params.latitude == null && params.longitude == null)
}

function radiusResultLimit(_params: DoctorSearchParams): number {
  return DOCTOR_SEARCH_LIMIT
}

function finalizeResults(
  doctors: DoctorSearchResult[],
  params: DoctorSearchParams,
  options: { capAt?: number } = {}
): DoctorSearchResult[] {
  const filtered = applyClientFilters(doctors, params)
  const cap = options.capAt
  if (cap == null) return filtered
  return filtered.slice(0, cap)
}

function applyCityQueryFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: DoctorSearchParams
) {
  if (params.specialty) query = query.or(buildSpecialtyOrFilter(params.specialty))
  if (params.name) query = query.ilike('full_name', `%${params.name}%`)
  if (params.area) query = query.ilike('area', `%${params.area}%`)
  if (params.maxFee) query = query.lte('consultation_fee', params.maxFee)
  if (params.minFee) query = query.gte('consultation_fee', params.minFee)
  if (params.onlineOnly) query = query.eq('accepts_online', true)
  if (params.hospital) {
    query = query.or(
      `hospital_name.ilike.%${params.hospital}%,clinic_name.ilike.%${params.hospital}%`
    )
  }
  return query
}

async function fetchCityDoctorsPage(
  params: DoctorSearchParams,
  citySlug: string,
  offset: number,
  pageEnd: number
): Promise<DoctorSearchResult[]> {
  let query = supabase
    .from('doctors')
    .select(DIRECTORY_LIST_SELECT)
    .eq('is_active', true)
    .eq('publication_status', 'published')
    .not('source', 'in', '("healthpilot","manual")')
    .eq('city_slug', citySlug)
    .order('rating', { ascending: false })

  query = applyCityQueryFilters(query, params)

  const { data, error } = await query.range(offset, pageEnd)
  if (error) throw error
  return (data ?? []) as DoctorSearchResult[]
}

/** Load published doctors in a city (parallel pages, lean columns). */
async function searchByCityQuery(
  params: DoctorSearchParams,
  citySlug: string
): Promise<DoctorSearchResult[]> {
  const pageStarts: number[] = []
  for (let offset = 0; offset < DOCTOR_CITY_LISTING_MAX; offset += CITY_FETCH_PAGE_SIZE) {
    pageStarts.push(offset)
  }

  const pages = await Promise.all(
    pageStarts.map((offset) => {
      const pageEnd = Math.min(offset + CITY_FETCH_PAGE_SIZE - 1, DOCTOR_CITY_LISTING_MAX - 1)
      return fetchCityDoctorsPage(params, citySlug, offset, pageEnd)
    })
  )

  const all: DoctorSearchResult[] = []
  for (const batch of pages) {
    if (batch.length === 0) continue
    all.push(...batch)
    if (batch.length < CITY_FETCH_PAGE_SIZE) break
  }

  return finalizeResults(all, params)
}

async function searchByCity(params: DoctorSearchParams, citySlug: string): Promise<DoctorSearchResult[]> {
  return searchByCityQuery(params, citySlug)
}

/** GPS Near Me: same city listings as browse, sorted by distance; widen only if sparse. */
async function searchNearMeGps(
  lat: number,
  lng: number,
  params: DoctorSearchParams
): Promise<DoctorSearchResult[]> {
  const primaryCity =
    normalizeCitySlug(params.city) ?? nearbyCitySlugs(lat, lng, { maxCities: 1 })[0] ?? 'lahore'

  const cityParams = { ...params, latitude: undefined, longitude: undefined }
  let merged = await searchByCity(cityParams, primaryCity)

  if (merged.length < NEAR_ME_MIN_RESULTS) {
    const extraCities = nearbyCitySlugs(lat, lng, {
      maxCities: NEAR_ME_MAX_CITIES,
      maxDistanceKm: NEAR_ME_CITY_RADIUS_KM,
    }).filter((slug) => slug !== primaryCity)

    if (extraCities.length > 0) {
      const batches = await Promise.all(
        extraCities.map((slug) => searchByCity(cityParams, slug))
      )
      const byId = new Map<string, DoctorSearchResult>()
      for (const row of [...merged, ...batches.flat()]) {
        byId.set(row.id, row)
      }
      merged = [...byId.values()]
    }
  }

  const filtered = finalizeResults(merged, params)
  return annotateNearMeDistances(filtered, lat, lng).slice(0, DOCTOR_CITY_LISTING_MAX)
}

async function searchByRadius(
  lat: number,
  lng: number,
  params: DoctorSearchParams,
  citySlug?: string | null
): Promise<DoctorSearchResult[]> {
  const radii =
    params.radiiKm ?? (params.radiusKm != null ? [params.radiusKm] : [...SEARCH_RADIUS_KM])
  const scopeToCity = params.scopeToCity !== false

  for (const radiusKm of radii) {
    const { data, error } = await supabase.rpc('doctors_within_radius', {
      lat,
      lng,
      radius_km: radiusKm,
      specialty_filter: params.specialty ?? null,
      city_slug_filter: scopeToCity && citySlug ? citySlug : null,
      area_filter: params.area ?? null,
      name_filter: params.name?.trim() || null,
      gender_filter: genderFilterParam(params),
      max_fee_filter: params.maxFee ?? null,
      min_fee_filter: params.minFee ?? null,
      language_filter: params.language?.trim() || null,
      result_limit: radiusResultLimit(params),
    })

    if (error) throw error
    const filtered = finalizeResults((data ?? []) as DoctorSearchResult[], params, {
      capAt: DOCTOR_SEARCH_LIMIT,
    })
    if (filtered.length >= 3 || radiusKm === radii[radii.length - 1]) {
      return filtered
    }
  }

  return []
}

async function findNearbyDoctorsUncached(
  params: DoctorSearchParams
): Promise<DoctorSearchResult[]> {
  const citySlug = normalizeCitySlug(params.city)
  const { latitude, longitude } = params

  if (latitude != null && longitude != null) {
    return searchNearMeGps(latitude, longitude, params)
  }

  if (citySlug) {
    const cityResults = await searchByCity(params, citySlug)
    if (cityResults.length > 0 || isCityListingMode(params, citySlug)) {
      return cityResults
    }

    const center = getCityCenterCoords(citySlug)
    return searchByRadius(
      center.lat,
      center.lng,
      { ...params, radiusKm: 50, scopeToCity: true },
      citySlug
    )
  }

  const { data, error } = await supabase.rpc('search_doctors_directory', {
    city_slug_filter: null,
    specialty_filter: params.specialty ?? null,
    area_filter: params.area ?? null,
    name_filter: params.name?.trim() || null,
    hospital_filter: params.hospital ?? null,
    gender_filter: genderFilterParam(params),
    max_fee_filter: params.maxFee ?? null,
    min_fee_filter: params.minFee ?? null,
    language_filter: params.language?.trim() || null,
    result_limit: DOCTOR_CITY_LISTING_MAX,
    result_offset: 0,
  })

  if (!error && data?.length) {
    return finalizeResults((data ?? []) as DoctorSearchResult[], params)
  }

  let query = supabase
    .from('doctors')
    .select(DIRECTORY_LIST_SELECT)
    .eq('is_active', true)
    .eq('publication_status', 'published')
    .not('source', 'in', '("healthpilot","manual")')
    .order('rating', { ascending: false })

  query = applyCityQueryFilters(query, params)

  const { data: fallback, error: e2 } = await query.limit(DOCTOR_CITY_LISTING_MAX)
  if (e2) throw e2
  return finalizeResults((fallback ?? []) as DoctorSearchResult[], params)
}

export async function findNearbyDoctors(
  params: DoctorSearchParams
): Promise<DoctorSearchResult[]> {
  const key = searchCacheKey(params)
  const existing = inflightSearches.get(key)
  if (existing) return existing

  const promise = findNearbyDoctorsUncached(params).finally(() => {
    inflightSearches.delete(key)
  })
  inflightSearches.set(key, promise)
  return promise
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', id)
    .eq('publication_status', 'published')
    .single()

  if (error) throw error
  return data
}

export async function getDoctorCountByCity(citySlug: string): Promise<number> {
  const { count, error } = await supabase
    .from('doctors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('publication_status', 'published')
    .not('source', 'in', '("healthpilot","manual")')
    .eq('city_slug', normalizeCitySlug(citySlug) ?? citySlug)

  if (error) throw error
  return count ?? 0
}

/** Cities that have at least one published directory doctor (for location filter). */
export async function getCitiesWithDoctorCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('doctors')
      .select('city_slug')
      .eq('is_active', true)
      .eq('publication_status', 'published')
      .not('source', 'in', '("healthpilot","manual")')
      .not('city_slug', 'is', null)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const batch = data ?? []
    if (batch.length === 0) break

    for (const row of batch) {
      const slug = normalizeCitySlug(row.city_slug as string)
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }

    if (batch.length < pageSize) break
    offset += pageSize
  }

  return counts
}
