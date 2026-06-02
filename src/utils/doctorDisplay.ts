import { cleanWorkplaceName, getDisplayWorkplace } from '@/utils/doctorWorkplace'
import {
  cityConflictsWithAddress,
  getCityDisplayName,
  parseCityFromLocationText,
} from '@/utils/pakistanCityExtract'
import { normalizeCitySlug } from '@/utils/locationUtils'

/** Client-side guard for corrupted scraped specialty text. */

const GARBAGE = /\{[\s\S]*\}|@media|\.off-panel|line-height:\s*0|flex-direction:/i

export function formatDoctorSpecialty(specialty: string | null | undefined, slug?: string | null): string {
  if (!specialty) return slugToLabel(slug)
  const s = specialty.trim().replace(/&amp;/g, '&')
  if (s.length > 80 || GARBAGE.test(s)) return slugToLabel(slug)
  const marhamTitle = s.match(/\s-\s([^-]+?)\s+at\s/i)
  if (marhamTitle) return marhamTitle[1].trim()
  if (/^dr\.?\s/i.test(s) && s.length > 40) return slugToLabel(slug)
  return s
}

/** Format clinic location for cards and detail (no "null — null"). */
export function formatDoctorLocation(doctor: {
  hospital_name?: string | null
  clinic_name?: string | null
  area?: string | null
  address?: string | null
  city?: string | null
  city_slug?: string | null
}): string {
  const address = doctor.address?.trim()
  const area = doctor.area?.trim()

  // Marham "Area:" is usually a full line (e.g. "North Nazimabad, Karachi") — don't append wrong city column.
  if (address) {
    if (cityConflictsWithAddress(doctor.city_slug ?? doctor.city, address)) {
      return address
    }
    const city = doctor.city?.trim()
    if (city && !address.toLowerCase().includes(city.toLowerCase())) {
      const addrCity = parseCityFromLocationText(address)
      if (!addrCity || addrCity === normalizeCitySlug(city)) {
        return `${address}, ${city}`
      }
    }
    return address
  }

  const workplace = getDisplayWorkplace(doctor)
  const parts: string[] = []

  if (workplace) parts.push(workplace)
  if (area && area.toLowerCase() !== workplace?.toLowerCase()) {
    parts.push(area)
  }

  const cityFromArea = parseCityFromLocationText(area)
  const citySlug = cityFromArea ?? normalizeCitySlug(doctor.city_slug ?? doctor.city)
  const cityLabel = citySlug ? getCityDisplayName(citySlug) : doctor.city?.trim()

  if (
    cityLabel &&
    !parts.some((p) => p.toLowerCase().includes(cityLabel.toLowerCase()))
  ) {
    parts.push(cityLabel)
  }

  if (parts.length > 0) return parts.join(', ')

  if (cityLabel) return cityLabel
  return ''
}

export function formatDoctorMapLabel(doctor: {
  hospital_name?: string | null
  clinic_name?: string | null
  area?: string | null
  address?: string | null
  city?: string | null
}): string {
  const line = formatDoctorLocation(doctor)
  return line || 'Practice location'
}

export { cleanWorkplaceName, getDisplayWorkplace }

function slugToLabel(slug?: string | null): string {
  if (!slug) return 'General Physician'
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
