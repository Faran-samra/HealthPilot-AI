import { useEffect, useMemo, useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { resolveCareLocation, type CareLocation } from '@/utils/locationUtils'

const SESSION_KEY = 'healthpilot_gps_location'

function readCachedGps(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lat: number; lng: number; ts: number }
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

function writeCachedGps(lat: number, lng: number) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ lat, lng, ts: Date.now() }))
}

/**
 * Care search location: prefers device GPS (actual position), then profile city.
 */
export function useCareLocation(profileCity?: string | null, enabled = true) {
  const geo = useGeolocation()
  const [cachedGps, setCachedGps] = useState(() => readCachedGps())

  useEffect(() => {
    if (!enabled) return
    if (!geo.location && !cachedGps && !geo.loading) geo.requestLocation()
  }, [enabled, cachedGps, geo.location, geo.loading, geo.requestLocation])

  useEffect(() => {
    if (geo.location) {
      writeCachedGps(geo.location.lat, geo.location.lng)
      setCachedGps(geo.location)
    }
  }, [geo.location])

  const gps = geo.location ?? cachedGps

  const careLocation = useMemo(
    () => (enabled ? resolveCareLocation(gps, profileCity) : null),
    [enabled, gps, profileCity]
  )

  return {
    careLocation,
    loading: enabled && geo.loading && !gps,
    error: geo.error,
    retryLocation: geo.requestLocation,
  }
}

export type { CareLocation }
