import { CITY_CENTERS } from './constants'

export interface MapPoint {
  lat: number
  lng: number
}

export function getCityCenter(city: string): MapPoint {
  const key = city.toLowerCase()
  return CITY_CENTERS[key] ?? CITY_CENTERS.lahore
}

export function getMapBounds(points: MapPoint[]) {
  if (points.length === 0) return null

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  }
}

/** Free turn-by-turn directions via OpenStreetMap (no API key). */
export function getDirectionsUrl(to: MapPoint, from?: MapPoint): string {
  if (from) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.lng},${from.lat};${to.lng},${to.lat}`
  }
  return `https://www.openstreetmap.org/?mlat=${to.lat}&mlon=${to.lng}#map=16/${to.lat}/${to.lng}`
}

/** Open location in OpenStreetMap. */
export function getOpenStreetMapUrl(point: MapPoint): string {
  return `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`
}

export function haversineKm(a: MapPoint, b: MapPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
