import type { DiscoveryDoctor, FacilityType } from '@/types/discovery'
import { getCityLabel } from '@/utils/locationUtils'

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/

export function prefersLatinDisplay(language: string): boolean {
  return !language.startsWith('ur')
}

function hasArabicScript(value: string): boolean {
  return ARABIC_SCRIPT.test(value)
}

function isAdminNoise(part: string): boolean {
  const lower = part.toLowerCase()
  if (part.length > 55) return true
  return (
    lower === 'pakistan' ||
    lower.includes('division') ||
    lower.includes('district') ||
    lower.includes('tehsil') ||
    /^punjab$/i.test(part) ||
    /^\d{5,}$/.test(part.trim())
  )
}

function latinCommaParts(text: string, max = 4): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && /[a-zA-Z0-9]/.test(p) && !hasArabicScript(p) && !isAdminNoise(p))
    .slice(0, max)
}

function extractFromAddress(address: string | null | undefined, latinOnly: boolean): string {
  if (!address?.trim()) return ''
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (!latinOnly) return parts.slice(0, 3).join(', ')
  const latin = parts.filter((p) => !hasArabicScript(p) && /[a-zA-Z]/.test(p) && !isAdminNoise(p))
  return latin.slice(0, 2).join(', ')
}

function pickField(
  primary: string | null | undefined,
  address: string | null | undefined,
  language: string,
  firstPartOnly = false
): string {
  const preferLatin = prefersLatinDisplay(language)
  if (!preferLatin) {
    return primary?.trim() || extractFromAddress(address, false) || ''
  }
  if (primary?.trim() && !hasArabicScript(primary)) {
    return firstPartOnly ? primary.split(',')[0]?.trim() ?? primary : primary.trim()
  }
  const fromAddr = extractFromAddress(address, true)
  if (!fromAddr) return primary?.trim() || ''
  return firstPartOnly ? fromAddr.split(',')[0]?.trim() ?? fromAddr : fromAddr
}

/** One-line location for facility cards (matches app language). */
type FacilityLocationFields = Pick<DiscoveryDoctor, 'area' | 'city_slug' | 'address'> & {
  city?: string | null
}

export function formatFacilityShortLocation(
  facility: FacilityLocationFields,
  language: string
): string {
  const city = facility.city_slug
    ? getCityLabel(facility.city_slug)
    : pickField(facility.city, facility.address, language)

  const area = pickField(facility.area, facility.address, language, true)

  if (area && city) {
    if (area.toLowerCase() === city.toLowerCase()) return city
    return `${area}, ${city}`
  }
  return area || city || ''
}

/** Secondary address line — hidden when only Urdu script and UI is English. */
export function formatFacilityDetailAddress(
  facility: FacilityLocationFields,
  language: string
): string | null {
  if (!facility.address?.trim()) return null

  if (!prefersLatinDisplay(language)) {
    return facility.address
  }

  const latin = latinCommaParts(facility.address, 4)
  if (latin.length > 0) return latin.join(', ')

  const short = formatFacilityShortLocation(facility, language)
  if (short) return null
  return null
}

export function facilityTypeKey(type: FacilityType): string {
  const keys: Record<FacilityType, string> = {
    hospital: 'doctors.facilityHospital',
    clinic: 'doctors.facilityClinic',
    doctor: 'doctors.facilityDoctor',
    health_centre: 'doctors.facilityHealthCentre',
    other: 'doctors.facilityOther',
  }
  return keys[type] ?? keys.other
}

/** Avoid duplicate Hospital + Hospital badges. */
export function facilityBadgeDisplay(
  facility: Pick<DiscoveryDoctor, 'facility_type' | 'specialty' | 'specialty_slug'>,
  t: (key: string) => string
): { typeLabel: string; specialtyLabel: string | null } {
  const typeLabel = t(facilityTypeKey(facility.facility_type))
  const spec = facility.specialty?.trim() ?? ''

  if (!facility.specialty_slug) {
    const redundant =
      spec.toLowerCase() === typeLabel.toLowerCase() ||
      (facility.facility_type === 'hospital' &&
        (spec === 'Hospital' || spec === typeLabel)) ||
      ((facility.facility_type === 'clinic' || facility.facility_type === 'doctor') &&
        (spec === 'Clinic / General Care' || spec.includes('Clinic')))
    return { typeLabel, specialtyLabel: redundant ? null : spec || null }
  }

  if (spec && spec.toLowerCase() !== typeLabel.toLowerCase()) {
    return { typeLabel, specialtyLabel: spec }
  }
  return { typeLabel, specialtyLabel: null }
}
