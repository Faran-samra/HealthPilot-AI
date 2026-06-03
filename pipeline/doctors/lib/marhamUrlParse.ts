import { isKnownCitySlug, parseCityFromMarhamSlug } from '../../../src/utils/pakistanCityExtract.ts'

/** Strip honorific prefixes from profile slug before building display name. */
const PROFILE_SLUG_PREFIX =
  /^(?:(?:asst|assoc|assistant|associate)-prof-)?(?:(?:asst|assoc|assistant|associate)-)?(?:(?:dr|prof)\-)?/i

const NON_PROFILE_SLUG = /^(area-|hospital-|clinic-|specialit|best-|top-|\d+)/i

/** Specialty directory pages (not a person), e.g. pediatric-gastroenterologist, eye-surgeon */
const SPECIALTY_LISTING_SLUG =
  /(?:specialist|surgeon|ologist|physician|dentist|cardiologist|gynecologist|pathologist|radiologist|nutritionist|counselor|anesthetist|physiotherapist|nephrologist|oncologist|pulmonologist|neurologist|psychiatrist|urologist|dermatologist|audiologist|endocrinologist|gastroenterologist|hematologist|cosmetologist|chiropractor|acupuncturist|homeopath|midwife|pharmacist)$/i

export interface MarhamProfilePath {
  citySlug: string
  specialtySlug: string
  profileSlug: string
}

export function isValidMarhamProfileSlug(slug: string): boolean {
  const s = slug.toLowerCase().trim()
  if (s.length < 3 || s.length > 120) return false
  if (NON_PROFILE_SLUG.test(s)) return false
  if (SPECIALTY_LISTING_SLUG.test(s)) return false
  if (/^\d/.test(s)) return false
  return /^[a-z0-9-]+$/.test(s)
}

/** True for /doctors/{city}/{specialty}/{person-slug} (not area or specialty index pages). */
export function isMarhamDoctorProfileUrl(url: string): boolean {
  return parseMarhamProfilePath(url) != null
}

/** Parse /doctors/{city}/{specialty}/{profile-slug} */
export function parseMarhamProfilePath(url: string): MarhamProfilePath | null {
  try {
    const parts = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean)
    if (parts[0] !== 'doctors' || parts.length !== 4) return null

    const citySlug = parts[1].toLowerCase()
    const specialtySlug = parts[2].toLowerCase()
    const profileSlug = parts[3].toLowerCase()

    if (!isValidMarhamProfileSlug(profileSlug)) return null
    if (SPECIALTY_LISTING_SLUG.test(profileSlug)) return null

    return { citySlug, specialtySlug, profileSlug }
  } catch {
    return null
  }
}

export function nameFromMarhamProfileSlug(profileSlug: string): string {
  let body = profileSlug.toLowerCase().trim()
  for (let i = 0; i < 4; i++) {
    const next = body.replace(PROFILE_SLUG_PREFIX, '').trim()
    if (next === body) break
    body = next
  }
  if (!body) return ''
  return body
    .split('-')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

export function specialtyHintFromPathSegment(specialtySlug: string): string {
  return specialtySlug.replace(/-/g, ' ').trim()
}

export function resolveCitySlugFromMarhamUrl(url: string): string | null {
  const path = parseMarhamProfilePath(url)
  if (path) return path.citySlug
  const legacySlug = url.split('/').filter(Boolean).pop()
  if (!legacySlug) return null
  return parseCityFromMarhamSlug(legacySlug)
}
