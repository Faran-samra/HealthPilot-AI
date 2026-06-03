import { findNearbyDoctors } from '@/services/doctorService'
import { useDoctorsDirectoryStore } from '@/store/doctorsDirectoryStore'
import { toDirectoryDoctor } from '@/types/doctorDirectory'

export function cityDirectoryCacheKey(citySlug: string): string {
  return `city=${citySlug}`
}

export function isCityOnlyDirectorySearch(cacheKey: string, citySlug: string): boolean {
  const p = new URLSearchParams(cacheKey)
  if (p.get('city') !== citySlug) return false
  return (
    !p.get('specialty') &&
    !p.get('name') &&
    !p.get('area') &&
    !p.get('hospital') &&
    !p.get('maxFee') &&
    !p.get('minFee') &&
    !p.get('female') &&
    !p.get('male') &&
    !p.get('language') &&
    p.get('nearMe') !== '1'
  )
}

export const PREFETCH_CITY_SLUGS = [
  'lahore',
  'karachi',
  'islamabad',
  'rawalpindi',
  'faisalabad',
  'multan',
  'peshawar',
  'gujranwala',
  'sargodha',
  'bahawalpur',
] as const

const inflightCities = new Set<string>()

/** Warm cache for a city list (no filters). Safe to call repeatedly. */
export function prefetchCityDirectory(citySlug: string): void {
  const key = cityDirectoryCacheKey(citySlug)
  const store = useDoctorsDirectoryStore.getState()
  if (store.peek(key) || inflightCities.has(key)) return

  inflightCities.add(key)
  findNearbyDoctors({ city: citySlug })
    .then((rows) => {
      store.put(key, rows.map((r) => toDirectoryDoctor(r)))
    })
    .catch(() => {
      /* ignore background prefetch errors */
    })
    .finally(() => {
      inflightCities.delete(key)
    })
}

export function prefetchCitiesIdle(cities: readonly string[]): void {
  const run = () => cities.forEach((c) => prefetchCityDirectory(c))
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2500 })
  } else {
    window.setTimeout(run, 400)
  }
}
