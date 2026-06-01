import type { DiscoveryDoctor } from '@/types/discovery'
import { specialtyMatchScore } from '@/utils/specialtyMapping'

const WEIGHTS = {
  distance: 45,
  specialty: 30,
  contact: 15,
  facilityType: 10,
} as const

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function facilityTypeScore(type: DiscoveryDoctor['facility_type']): number {
  switch (type) {
    case 'hospital':
      return 1
    case 'clinic':
      return 0.85
    case 'doctor':
      return 0.75
    case 'health_centre':
      return 0.7
    default:
      return 0.5
  }
}

export function computeRankingScore(
  facility: DiscoveryDoctor,
  specialtyFilter: string | null,
  maxRadiusKm: number
): number {
  const distanceScore =
    maxRadiusKm > 0
      ? Math.max(0, 1 - facility.distance_km / maxRadiusKm) * WEIGHTS.distance
      : WEIGHTS.distance * 0.5

  const specialtyScore = specialtyMatchScore(facility.specialty_slug, specialtyFilter) * WEIGHTS.specialty

  let contactScore = 0
  if (facility.phone) contactScore += WEIGHTS.contact * 0.7
  if (facility.whatsapp) contactScore += WEIGHTS.contact * 0.3

  const typeScore = facilityTypeScore(facility.facility_type) * WEIGHTS.facilityType

  return distanceScore + specialtyScore + contactScore + typeScore
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(hospital|clinic|medical|centre|center|complex|trust)\b/g, '')
    .trim()
}

/** Deduplicate OSM facilities at the same location / similar name */
export function dedupeOsmFacilities(facilities: DiscoveryDoctor[]): DiscoveryDoctor[] {
  const merged: DiscoveryDoctor[] = []

  for (const f of facilities) {
    const duplicate = merged.find((existing) => {
      const dist = haversineKm(
        existing.latitude,
        existing.longitude,
        f.latitude,
        f.longitude
      )
      if (dist > 0.15) return false
      const a = normalizeName(existing.full_name)
      const b = normalizeName(f.full_name)
      return a === b || a.includes(b) || b.includes(a)
    })

    if (duplicate) {
      if (!duplicate.phone && f.phone) duplicate.phone = f.phone
      if (!duplicate.address && f.address) duplicate.address = f.address
      if (duplicate.facility_type === 'other' && f.facility_type !== 'other') {
        duplicate.facility_type = f.facility_type
      }
    } else {
      merged.push(f)
    }
  }

  return merged
}

export function rankDiscoveryResults(
  facilities: DiscoveryDoctor[],
  specialtyFilter: string | null,
  maxRadiusKm: number
): DiscoveryDoctor[] {
  return facilities
    .map((f) => ({
      ...f,
      ranking_score: computeRankingScore(f, specialtyFilter, maxRadiusKm),
    }))
    .sort((a, b) => {
      if (b.ranking_score !== a.ranking_score) return b.ranking_score - a.ranking_score
      return a.distance_km - b.distance_km
    })
}
