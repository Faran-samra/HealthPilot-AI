import type { Doctor } from '@/lib/database.types'
import { haversineKm } from '@/utils/locationUtils'
import {
  isDistancePrecise,
  resolveDoctorMapPosition,
  type LocationPrecision,
} from '@/utils/doctorLocationResolve'

export type DoctorWithDistance = {
  distance_km?: number
  distance_precise?: boolean
  location_precision?: LocationPrecision
}

export function doctorCoords(
  doctor: Pick<
    Doctor,
    | 'latitude'
    | 'longitude'
    | 'city_slug'
    | 'city'
    | 'area'
    | 'address'
    | 'hospital_name'
    | 'clinic_name'
  >
): { lat: number; lng: number } {
  const pos = resolveDoctorMapPosition(doctor)
  return { lat: pos.lat, lng: pos.lng }
}

/** Near Me: distance from user GPS for every doctor (sorted nearest first). */
export function annotateNearMeDistances<T extends Doctor & { distance_km?: number }>(
  doctors: T[],
  userLat: number,
  userLng: number
): (T & DoctorWithDistance)[] {
  const annotated = doctors.map((d) => {
    const pos = resolveDoctorMapPosition(d)
    const distance_km =
      Math.round(haversineKm(userLat, userLng, pos.lat, pos.lng) * 10) / 10
    const distance_precise = isDistancePrecise(pos.precision)

    return {
      ...d,
      distance_km,
      distance_precise,
      location_precision: pos.precision,
    } as T & DoctorWithDistance
  })

  return sortNearMeDoctors(annotated)
}

export function sortNearMeDoctors<T extends Doctor & DoctorWithDistance>(doctors: T[]): T[] {
  return [...doctors].sort((a, b) => {
    const aDist = a.distance_km ?? 999
    const bDist = b.distance_km ?? 999
    if (aDist !== bDist) return aDist - bDist

    const aPrec = a.distance_precise ? 0 : 1
    const bPrec = b.distance_precise ? 0 : 1
    if (aPrec !== bPrec) return aPrec - bPrec

    return (b.rating ?? 0) - (a.rating ?? 0)
  })
}
