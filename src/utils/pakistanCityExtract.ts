import { PAKISTAN_CITIES } from './constants'
import { getCityMeta } from './locationUtils'

/** City slugs longest-first so "rawalpindi" wins over shorter partial matches. */
export const PAKISTAN_CITY_SLUGS = [...PAKISTAN_CITIES.map((c) => c.value)].sort(
  (a, b) => b.length - a.length
)

const CITY_SLUG_SET = new Set<string>(PAKISTAN_CITY_SLUGS)

export function isKnownCitySlug(slug: string | null | undefined): boolean {
  if (!slug?.trim()) return false
  const n = slug.trim().toLowerCase().replace(/\s+/g, '-')
  return CITY_SLUG_SET.has(n)
}

export function normalizeCitySlugLocal(city: string | null | undefined): string | null {
  if (!city?.trim()) return null
  const slug = city.trim().toLowerCase().replace(/\s+/g, '-')
  return slug || null
}

const MARHAM_SPECIALTY_TAIL_WORDS = new Set([
  'specialist',
  'surgeon',
  'physician',
  'doctor',
  'consultant',
  'pathologist',
  'dentist',
  'cardiologist',
  'gynecologist',
  'dermatologist',
  'neurologist',
  'urologist',
  'pediatrician',
  'psychiatrist',
  'audiologist',
  'nutritionist',
  'oncologist',
  'radiologist',
  'orthopedic',
  'ent',
])

/** Match trailing segment(s) of a Marham profile slug to a city (known or Marham slug). */
export function parseCityFromMarhamSlug(slug: string): string | null {
  const parts = slug.toLowerCase().split('-').filter(Boolean)
  if (parts.length < 2) return null

  for (let n = Math.min(3, parts.length - 1); n >= 1; n--) {
    const candidate = parts.slice(-n).join('-')
    if (CITY_SLUG_SET.has(candidate)) return candidate
    if (n >= 2 && candidate.length >= 4) return candidate
  }

  const last = parts[parts.length - 1]
  if (last.length >= 3 && !MARHAM_SPECIALTY_TAIL_WORDS.has(last)) return last

  return null
}

/** Detect a known city in free text using word boundaries (avoids substring false positives). */
export function detectCityInText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const lower = text.toLowerCase()
  for (const slug of PAKISTAN_CITY_SLUGS) {
    const pattern = slug.replace(/-/g, '[\\s-]')
    const re = new RegExp(`\\b${pattern}\\b`, 'i')
    if (re.test(lower)) return slug
  }
  return null
}

/** Prefer the rightmost comma segment that matches a known Pakistan city. */
export function parseCityFromLocationText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null

  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  for (let i = parts.length - 1; i >= 0; i--) {
    const slug = normalizeCitySlugLocal(parts[i])
    if (slug && CITY_SLUG_SET.has(slug)) return slug
    const detected = detectCityInText(parts[i])
    if (detected) return detected
  }

  return detectCityInText(text)
}

export function getCityDisplayName(citySlug: string): string {
  const meta = getCityMeta(citySlug)
  if (meta) return meta.label
  return citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, ' ')
}

export function resolveMarhamDoctorCity(input: {
  profileSlug: string
  urlCitySlug?: string | null
  jsonCity?: string | null
  areaLine?: string | null
}): { city: string; city_slug: string; province: string | null } {
  const fromArea = parseCityFromLocationText(input.areaLine)
  const fromJson = input.jsonCity
    ? parseCityFromLocationText(input.jsonCity) ??
      (isKnownCitySlug(input.jsonCity) ? normalizeCitySlugLocal(input.jsonCity) : null)
    : null
  const fromUrl = input.urlCitySlug ? normalizeCitySlugLocal(input.urlCitySlug) : null
  const fromSlug = parseCityFromMarhamSlug(input.profileSlug)

  const city_slug = fromArea ?? fromJson ?? fromUrl ?? fromSlug ?? 'lahore'
  const meta = getCityMeta(city_slug)

  return {
    city_slug,
    city: meta?.label ?? getCityDisplayName(city_slug),
    province: meta?.province ?? null,
  }
}

/** True when stored city disagrees with the city named in address/area text. */
export function cityConflictsWithAddress(
  storedCitySlug: string | null | undefined,
  addressOrArea: string | null | undefined
): boolean {
  const fromText = parseCityFromLocationText(addressOrArea)
  if (!fromText || !storedCitySlug) return false
  const stored = normalizeCitySlugLocal(storedCitySlug)
  return Boolean(stored && stored !== fromText)
}
