import { supabase } from '@/lib/supabase'
import type { DiscoveryDoctor, DiscoveryResponse } from '@/types/discovery'
import { parseOsmPlaceId } from '@/types/discovery'
import { getCityCenterCoords, getCityLabel, normalizeCitySlug } from '@/utils/locationUtils'

export interface LiveCareSearchParams {
  city?: string
  cityLabel?: string
  area?: string
  hospital?: string
  specialty?: string
  latitude?: number
  longitude?: number
  radiusKm?: number
}

/**
 * Discover real hospitals, clinics, and doctors via OpenStreetMap (live data).
 * No dependency on manually seeded Supabase doctor records.
 */
export async function discoverLiveCare(
  params: LiveCareSearchParams
): Promise<DiscoveryResponse> {
  const citySlug = normalizeCitySlug(params.city) ?? 'lahore'
  const cityLabel = params.cityLabel ?? getCityLabel(citySlug)

  const hasGps = params.latitude != null && params.longitude != null
  const center = hasGps
    ? { lat: params.latitude!, lng: params.longitude! }
    : getCityCenterCoords(citySlug)

  const { data, error } = await supabase.functions.invoke<DiscoveryResponse>(
    'discover-doctors',
    {
      body: {
        latitude: center.lat,
        longitude: center.lng,
        city: citySlug,
        city_label: cityLabel,
        use_gps: hasGps,
        radius_km: params.radiusKm ?? 25,
        specialty: params.specialty ?? null,
        area: params.area ?? null,
        hospital: params.hospital ?? null,
      },
    }
  )

  if (error) throw error
  if (!data?.results) throw new Error('No facilities found — try another city or enable Near Me')
  if ('error' in data && typeof (data as { error: string }).error === 'string') {
    throw new Error((data as { error: string }).error)
  }

  return data
}

/** Fetch a single OSM facility by HealthPilot place id (e.g. osm-node-5255424740). */
export async function fetchLiveFacilityById(
  placeId: string
): Promise<DiscoveryDoctor | null> {
  const parsed = parseOsmPlaceId(placeId)
  if (!parsed) return null

  const { data, error } = await supabase.functions.invoke<{ facility: DiscoveryDoctor | null }>(
    'get-facility',
    {
      body: { osm_type: parsed.osmType, osm_id: parsed.osmId },
    }
  )

  if (error) throw error
  return data?.facility ?? null
}

/** @deprecated Use discoverLiveCare */
export const discoverDoctors = discoverLiveCare
