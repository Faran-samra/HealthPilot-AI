import { PAKISTAN_CITIES, CITY_CENTERS, type PakistanCity } from './constants'
import type { Profile } from '@/lib/database.types'

export interface ResolvedSearchLocation {
  citySlug: string
  cityLabel: string
  province: string | null
  area: string | null
}

/** Normalize any city string to a lowercase slug (e.g. "Lahore" → "lahore"). */
export function normalizeCitySlug(city?: string | null): string | null {
  if (!city?.trim()) return null
  return city.trim().toLowerCase().replace(/\s+/g, '-')
}

export function getCityMeta(citySlug?: string | null): PakistanCity | null {
  const slug = normalizeCitySlug(citySlug)
  if (!slug) return null
  return PAKISTAN_CITIES.find((c) => c.value === slug) ?? null
}

export function getCityLabel(citySlug?: string | null): string {
  const meta = getCityMeta(citySlug)
  if (meta) return meta.label
  const slug = normalizeCitySlug(citySlug)
  if (!slug) return 'Pakistan'
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
}

export function getCityCenterCoords(citySlug?: string | null): { lat: number; lng: number } {
  const slug = normalizeCitySlug(citySlug) ?? 'lahore'
  return CITY_CENTERS[slug] ?? CITY_CENTERS.lahore
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Pick the nearest supported Pakistan city for a GPS point (for labels & fallbacks). */
export function nearestCitySlug(lat: number, lng: number): string {
  let best = 'lahore'
  let bestDist = Infinity
  for (const [slug, center] of Object.entries(CITY_CENTERS)) {
    const d = haversineKm(lat, lng, center.lat, center.lng)
    if (d < bestDist) {
      bestDist = d
      best = slug
    }
  }
  return best
}

export interface CareLocation {
  latitude: number
  longitude: number
  citySlug: string
  cityLabel: string
  source: 'gps' | 'profile' | 'default'
}

/** Resolve where to search for care: GPS first, then profile city, then Lahore. */
export function resolveCareLocation(
  gps: { lat: number; lng: number } | null,
  profileCity?: string | null
): CareLocation {
  if (gps) {
    const citySlug = nearestCitySlug(gps.lat, gps.lng)
    return {
      latitude: gps.lat,
      longitude: gps.lng,
      citySlug,
      cityLabel: getCityLabel(citySlug),
      source: 'gps',
    }
  }

  const citySlug = normalizeCitySlug(profileCity) ?? 'lahore'
  const center = getCityCenterCoords(citySlug)
  return {
    latitude: center.lat,
    longitude: center.lng,
    citySlug,
    cityLabel: getCityLabel(citySlug),
    source: profileCity ? 'profile' : 'default',
  }
}

/** Pick city/area for doctor search from URL params, profile, or default. */
export function resolveSearchLocation(
  searchParams: URLSearchParams,
  profile?: Profile | null
): ResolvedSearchLocation {
  const citySlug =
    normalizeCitySlug(searchParams.get('city')) ??
    normalizeCitySlug(profile?.city) ??
    'lahore'

  const meta = getCityMeta(citySlug)
  const area = searchParams.get('area') ?? profile?.area ?? null

  return {
    citySlug,
    cityLabel: meta?.label ?? getCityLabel(citySlug),
    province: meta?.province ?? null,
    area: area?.trim() || null,
  }
}

export function buildDoctorSearchUrl(options: {
  specialty?: string
  city?: string
  area?: string
  nearMe?: boolean
}): string {
  const params = new URLSearchParams()
  if (options.specialty) params.set('specialty', options.specialty)
  if (options.city) params.set('city', normalizeCitySlug(options.city) ?? options.city)
  if (options.area) params.set('area', options.area)
  if (options.nearMe) params.set('nearMe', '1')
  const query = params.toString()
  return query ? `/doctors?${query}` : '/doctors'
}
