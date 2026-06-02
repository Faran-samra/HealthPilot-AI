import type { Doctor } from '../lib/database.types'
import { cleanWorkplaceName } from './doctorWorkplace'
import { CITY_CENTERS } from './constants'
import { getCityCenterCoords, normalizeCitySlug } from './locationUtils'

export type LocationPrecision = 'exact' | 'hospital' | 'area' | 'city'

export type ResolvedDoctorPosition = {
  lat: number
  lng: number
  precision: LocationPrecision
}

const CENTER_EPS = 0.02

type Coord = { lat: number; lng: number }

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Major hospitals/clinics — partial name match within city. */
const HOSPITAL_COORDS: Array<{ keys: string[]; city: string } & Coord> = [
  { keys: ['services hospital', 'services hosp'], city: 'lahore', lat: 31.5139, lng: 74.3467 },
  { keys: ['doctors hospital', 'doctor hospital'], city: 'lahore', lat: 31.4798, lng: 74.3012 },
  { keys: ['shaukat khanum', 'skm', 'shaukat khanum memorial'], city: 'lahore', lat: 31.4674, lng: 74.317 },
  { keys: ['mayo hospital'], city: 'lahore', lat: 31.5634, lng: 74.3248 },
  { keys: ['jinnah hospital'], city: 'lahore', lat: 31.4842, lng: 74.3019 },
  { keys: ['fatima memorial', 'fatima memorial hospital'], city: 'lahore', lat: 31.5208, lng: 74.3295 },
  { keys: ['evercare', 'ever care'], city: 'lahore', lat: 31.479, lng: 74.353 },
  { keys: ['hameed latif', 'hameed latif hospital'], city: 'lahore', lat: 31.492, lng: 74.318 },
  { keys: ['national hospital'], city: 'lahore', lat: 31.528, lng: 74.355 },
  { keys: ['ameer ud din'], city: 'lahore', lat: 31.565, lng: 74.335 },
  { keys: ['munawar hospital'], city: 'lahore', lat: 31.51, lng: 74.34 },
  { keys: ['saleem memorial'], city: 'lahore', lat: 31.47, lng: 74.39 },
  { keys: ['chughtai', 'chughtais'], city: 'lahore', lat: 31.498, lng: 74.345 },
  { keys: ['ammar medical', 'ammar medical complex'], city: 'lahore', lat: 31.549, lng: 74.335 },

  { keys: ['aga khan', 'aga khan hospital'], city: 'karachi', lat: 24.8922, lng: 67.0746 },
  { keys: ['jinnah hospital', 'jinnah postgraduate'], city: 'karachi', lat: 24.8557, lng: 67.0112 },
  { keys: ['liaquat national'], city: 'karachi', lat: 24.877, lng: 67.069 },
  { keys: ['south city', 'south city hospital'], city: 'karachi', lat: 24.813, lng: 67.048 },
  { keys: ['siut'], city: 'karachi', lat: 24.864, lng: 67.01 },
  { keys: ['patel hospital'], city: 'karachi', lat: 24.882, lng: 67.195 },
  { keys: ['ziauddin', 'ziauddin hospital'], city: 'karachi', lat: 24.903, lng: 67.078 },

  { keys: ['shifa international', 'shifa hospital'], city: 'islamabad', lat: 33.6958, lng: 73.0553 },
  { keys: ['pims', 'pakistan institute of medical'], city: 'islamabad', lat: 33.706, lng: 73.055 },
  { keys: ['maroof international'], city: 'islamabad', lat: 33.684, lng: 73.047 },
  { keys: ['ali medical', 'ali medical centre'], city: 'islamabad', lat: 33.71, lng: 73.04 },

  { keys: ['holy family'], city: 'rawalpindi', lat: 33.595, lng: 73.052 },
  { keys: ['benazir bhutto hospital'], city: 'rawalpindi', lat: 33.58, lng: 73.04 },
  { keys: ['cmh rawalpindi', 'combined military hospital rawalpindi'], city: 'rawalpindi', lat: 33.6, lng: 73.1 },

  { keys: ['allied hospital'], city: 'faisalabad', lat: 31.418, lng: 73.079 },
  { keys: ['nishtar', 'nishtar hospital'], city: 'multan', lat: 30.198, lng: 71.465 },
  { keys: ['lady reading'], city: 'peshawar', lat: 34.015, lng: 71.565 },
  { keys: ['rehman medical'], city: 'peshawar', lat: 34.0, lng: 71.52 },
]

/** Neighborhood / area pins per city. */
const AREA_COORDS: Record<string, Record<string, Coord>> = {
  lahore: {
    gulberg: { lat: 31.515, lng: 74.345 },
    'gulberg iii': { lat: 31.512, lng: 74.35 },
    'gulberg ii': { lat: 31.518, lng: 74.342 },
    dha: { lat: 31.47, lng: 74.39 },
    defence: { lat: 31.47, lng: 74.39 },
    'johar town': { lat: 31.4697, lng: 74.2726 },
    'model town': { lat: 31.483, lng: 74.325 },
    cantt: { lat: 31.52, lng: 74.38 },
    'cantt lahore': { lat: 31.52, lng: 74.38 },
    'bahria town': { lat: 31.385, lng: 74.185 },
    'garden town': { lat: 31.505, lng: 74.335 },
    township: { lat: 31.465, lng: 74.31 },
    'allama iqbal town': { lat: 31.455, lng: 74.29 },
    'wapda town': { lat: 31.445, lng: 74.265 },
    ichhra: { lat: 31.53, lng: 74.32 },
    ferozepur: { lat: 31.49, lng: 74.32 },
    'ferozepur road': { lat: 31.49, lng: 74.32 },
    samnabad: { lat: 31.545, lng: 74.31 },
    shadman: { lat: 31.535, lng: 74.33 },
    johar: { lat: 31.4697, lng: 74.2726 },
    valencia: { lat: 31.45, lng: 74.41 },
    askari: { lat: 31.48, lng: 74.42 },
    bedian: { lat: 31.44, lng: 74.42 },
    thokar: { lat: 31.45, lng: 74.26 },
    'thokar niaz baig': { lat: 31.45, lng: 74.26 },
    'jail road': { lat: 31.549, lng: 74.335 },
    jail: { lat: 31.549, lng: 74.335 },
  },
  karachi: {
    clifton: { lat: 24.813, lng: 67.03 },
    dha: { lat: 24.813, lng: 67.048 },
    defence: { lat: 24.813, lng: 67.048 },
    gulshan: { lat: 24.92, lng: 67.09 },
    'gulshan e iqbal': { lat: 24.92, lng: 67.09 },
    saddar: { lat: 24.86, lng: 67.01 },
    north: { lat: 24.95, lng: 67.05 },
    nazimabad: { lat: 24.92, lng: 67.03 },
    malir: { lat: 24.9, lng: 67.2 },
    korangi: { lat: 24.82, lng: 67.12 },
    fb: { lat: 24.87, lng: 67.04 },
    'federal b area': { lat: 24.87, lng: 67.04 },
  },
  islamabad: {
    f6: { lat: 33.729, lng: 73.068 },
    f7: { lat: 33.721, lng: 73.052 },
    f8: { lat: 33.71, lng: 73.04 },
    f10: { lat: 33.695, lng: 73.015 },
    f11: { lat: 33.684, lng: 73.0 },
    g6: { lat: 33.71, lng: 73.08 },
    g9: { lat: 33.7, lng: 73.04 },
    i8: { lat: 33.67, lng: 73.08 },
    bahria: { lat: 33.55, lng: 73.12 },
    'bahria town': { lat: 33.55, lng: 73.12 },
    blue: { lat: 33.65, lng: 73.15 },
    'blue area': { lat: 33.707, lng: 73.055 },
  },
  rawalpindi: {
    saddar: { lat: 33.6, lng: 73.05 },
    bahria: { lat: 33.55, lng: 73.12 },
    cantt: { lat: 33.6, lng: 73.1 },
  },
}

function isCityCenterPin(
  lat: number,
  lng: number,
  citySlug: string | null | undefined
): boolean {
  const center = getCityCenterCoords(citySlug)
  return Math.abs(lat - center.lat) < CENTER_EPS && Math.abs(lng - center.lng) < CENTER_EPS
}

function matchHospital(text: string, citySlug: string): Coord | null {
  const key = normalizeKey(text)
  if (!key) return null
  for (const entry of HOSPITAL_COORDS) {
    if (entry.city !== citySlug) continue
    if (entry.keys.some((k) => key.includes(k))) {
      return { lat: entry.lat, lng: entry.lng }
    }
  }
  return null
}

function matchArea(text: string, citySlug: string): Coord | null {
  const areas = AREA_COORDS[citySlug]
  if (!areas || !text.trim()) return null
  const key = normalizeKey(text)
  if (!key) return null

  let best: Coord | null = null
  let bestLen = 0
  for (const [areaName, coord] of Object.entries(areas)) {
    if (key.includes(areaName) && areaName.length > bestLen) {
      best = coord
      bestLen = areaName.length
    }
  }
  return best
}

/**
 * Best map position for distance sorting: stored pin → hospital → area → city center.
 */
export function resolveDoctorMapPosition(
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
): ResolvedDoctorPosition {
  const citySlug = normalizeCitySlug(doctor.city_slug ?? doctor.city) ?? 'lahore'
  const center = CITY_CENTERS[citySlug] ?? CITY_CENTERS.lahore

  if (doctor.latitude != null && doctor.longitude != null) {
    if (!isCityCenterPin(doctor.latitude, doctor.longitude, citySlug)) {
      return {
        lat: doctor.latitude,
        lng: doctor.longitude,
        precision: 'exact',
      }
    }
  }

  const hospitalLabel = cleanWorkplaceName(doctor.hospital_name)
  const clinicLabel = cleanWorkplaceName(doctor.clinic_name)
  const locationText = [doctor.area, doctor.address, hospitalLabel, clinicLabel]
    .filter(Boolean)
    .join(' ')

  const hospitalCoords = matchHospital(locationText, citySlug)
  if (hospitalCoords) {
    return { ...hospitalCoords, precision: 'hospital' }
  }

  const area =
    matchArea(locationText, citySlug) ??
    (doctor.area ? matchArea(doctor.area, citySlug) : null)
  if (area) {
    return { ...area, precision: 'area' }
  }

  if (doctor.latitude != null && doctor.longitude != null) {
    return {
      lat: doctor.latitude,
      lng: doctor.longitude,
      precision: 'city',
    }
  }

  return { lat: center.lat, lng: center.lng, precision: 'city' }
}

export function isDistancePrecise(precision: LocationPrecision): boolean {
  return precision === 'exact' || precision === 'hospital' || precision === 'area'
}
