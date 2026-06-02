/**
 * Live healthcare discovery — OpenStreetMap only (Overpass + Nominatim).
 * No Supabase doctor database dependency.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const NOMINATIM_HEADERS = {
  'User-Agent': 'HealthPilotAI/1.0 (https://healthpilot.pk; healthcare discovery)',
}

/** Fixed city centers — avoids Nominatim returning the wrong city. */
const PAKISTAN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  lahore: { lat: 31.5204, lng: 74.3587 },
  karachi: { lat: 24.8607, lng: 67.0011 },
  islamabad: { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.5651, lng: 73.0169 },
  faisalabad: { lat: 31.418, lng: 73.079 },
  multan: { lat: 30.1575, lng: 71.5249 },
  peshawar: { lat: 34.0151, lng: 71.5249 },
  quetta: { lat: 30.1798, lng: 66.975 },
  hyderabad: { lat: 25.3924, lng: 68.3737 },
  sialkot: { lat: 32.4945, lng: 74.5229 },
  gujranwala: { lat: 32.1877, lng: 74.1945 },
  abbottabad: { lat: 34.1688, lng: 73.2215 },
  sargodha: { lat: 32.0836, lng: 72.6711 },
  sukkur: { lat: 27.7052, lng: 68.8574 },
  bahawalpur: { lat: 29.3956, lng: 71.6722 },
  muzaffarabad: { lat: 34.37, lng: 73.47 },
  gilgit: { lat: 35.9208, lng: 74.3144 },
  mirpur: { lat: 33.1484, lng: 73.7519 },
}

const OSM_SPECIALTY_MAP: Record<string, string> = {
  general: 'general', physician: 'general', gp: 'general',
  cardiology: 'cardiology', cardiac: 'cardiology', heart: 'cardiology',
  dermatology: 'dermatology', skin: 'dermatology',
  orthopaedics: 'orthopedics', orthopedics: 'orthopedics',
  gynaecology: 'gynecology', gynecology: 'gynecology',
  paediatrics: 'pediatrics', pediatrics: 'pediatrics',
  neurology: 'neurology', otolaryngology: 'ent', ent: 'ent',
  ophthalmology: 'ophthalmology', psychiatry: 'psychiatry',
  urology: 'urology', gastroenterology: 'gastroenterology',
  endocrinology: 'endocrinology', pulmonology: 'pulmonology',
}

const SPECIALTY_LABELS: Record<string, string> = {
  general: 'General Physician', cardiology: 'Cardiologist',
  dermatology: 'Dermatologist', orthopedics: 'Orthopedic',
  gynecology: 'Gynecologist', pediatrics: 'Pediatrician',
  neurology: 'Neurologist', ent: 'ENT Specialist',
  ophthalmology: 'Ophthalmologist', psychiatry: 'Psychiatrist',
  urology: 'Urologist', gastroenterology: 'Gastroenterologist',
  endocrinology: 'Endocrinologist', pulmonology: 'Pulmonologist',
}

type FacilityType = 'hospital' | 'clinic' | 'doctor' | 'health_centre' | 'other'

interface LiveFacility {
  id: string
  source: 'openstreetmap'
  facility_type: FacilityType
  full_name: string
  specialty: string
  specialty_slug: string | null
  qualification: string | null
  hospital_name: string | null
  address: string | null
  city: string | null
  city_slug: string | null
  province: string | null
  area: string | null
  latitude: number
  longitude: number
  distance_km: number
  phone: string | null
  whatsapp: string | null
  consultation_fee: number | null
  is_verified: boolean
  pmdc_number: string | null
  rating: number | null
  total_reviews: number
  experience_years: number | null
  accepts_online: boolean
  gender: string | null
  available_days: string[] | null
  osm_id?: string
  osm_type?: string
  ranking_score: number
  can_book: boolean
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function slugToLabel(slug: string): string {
  return SPECIALTY_LABELS[slug] ?? 'Healthcare Facility'
}

function resolveFacilityType(tags: Record<string, string>): FacilityType {
  const amenity = tags.amenity ?? ''
  const healthcare = tags.healthcare ?? ''
  if (amenity === 'hospital' || healthcare === 'hospital') return 'hospital'
  if (amenity === 'clinic' || healthcare === 'clinic') return 'clinic'
  if (amenity === 'doctors' || healthcare === 'doctor' || tags.office === 'doctor') return 'doctor'
  if (healthcare === 'centre' || healthcare === 'center') return 'health_centre'
  return 'other'
}

function inferSpecialty(name: string, tags: Record<string, string>) {
  const raw = tags['healthcare:speciality'] ?? tags['healthcare:specialty'] ?? ''
  if (raw) {
    const key = raw.toLowerCase().split(/[;,|]/)[0].trim()
    const slug = OSM_SPECIALTY_MAP[key]
    if (slug) return { slug, label: slugToLabel(slug) }
  }
  const ft = resolveFacilityType(tags)
  if (ft === 'hospital') return { slug: null, label: 'Hospital' }
  if (ft === 'clinic' || ft === 'doctor') return { slug: 'general', label: 'Clinic / General Care' }
  return { slug: null, label: 'Healthcare Facility' }
}

function specialtyMatchScore(resultSlug: string | null, filterSlug: string | null): number {
  if (!filterSlug) return 0.5
  if (!resultSlug) return 0.2
  if (resultSlug === filterSlug) return 1
  if (resultSlug === 'general') return 0.35
  return 0
}

function computeScore(f: LiveFacility, specialtyFilter: string | null, maxRadius: number): number {
  const distScore = maxRadius > 0 ? Math.max(0, 1 - f.distance_km / maxRadius) * 45 : 22
  const specScore = specialtyMatchScore(f.specialty_slug, specialtyFilter) * 30
  const contactScore = f.phone ? 15 : 0
  const typeBoost = f.facility_type === 'hospital' ? 10 : f.facility_type === 'clinic' ? 7 : 4
  return distScore + specScore + contactScore + typeBoost
}

function normalizeName(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(hospital|clinic|medical|centre|center|complex|trust)\b/g, '').trim()
}

function dedupeFacilities(list: LiveFacility[]): LiveFacility[] {
  const out: LiveFacility[] = []
  for (const f of list) {
    const dup = out.find((e) => {
      const dist = haversineKm(e.latitude, e.longitude, f.latitude, f.longitude)
      if (dist > 0.15) return false
      const a = normalizeName(e.full_name)
      const b = normalizeName(f.full_name)
      return a === b || a.includes(b) || b.includes(a)
    })
    if (dup) {
      if (!dup.phone && f.phone) dup.phone = f.phone
      if (!dup.address && f.address) dup.address = f.address
    } else {
      out.push(f)
    }
  }
  return out
}

function baseFacility(
  partial: Omit<LiveFacility, 'ranking_score' | 'can_book' | 'source' | 'is_verified' | 'total_reviews'>
): LiveFacility {
  return {
    ...partial,
    source: 'openstreetmap',
    is_verified: false,
    total_reviews: 0,
    ranking_score: 0,
    can_book: false,
  }
}

async function geocodeCity(cityLabel: string) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityLabel + ', Pakistan')}&format=json&limit=1`
  const res = await fetch(url, { headers: NOMINATIM_HEADERS })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.[0]) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

async function queryOverpass(lat: number, lng: number, radiusM: number) {
  const query = `[out:json][timeout:35];
(
  nwr["amenity"~"hospital|clinic|doctors"](around:${radiusM},${lat},${lng});
  nwr["healthcare"~"hospital|clinic|doctor|centre|center|pharmacy"](around:${radiusM},${lat},${lng});
  nwr["office"="doctor"](around:${radiusM},${lat},${lng});
);
out center tags;`

  for (const endpoint of OVERPASS_URLS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (res.ok) return await res.json()
    } catch { /* try next */ }
  }
  return { elements: [] }
}

async function queryNominatimNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  citySlug: string | null
): Promise<LiveFacility[]> {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
  const viewbox = [lng - lngDelta, lat + latDelta, lng + lngDelta, lat - latDelta].join(',')

  const queries = [
    'hospital', 'clinic', 'medical centre', 'health centre', 'doctor',
    'physician', 'dental clinic', 'medical college hospital',
  ]
  const seen = new Set<string>()
  const results: LiveFacility[] = []

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=50&viewbox=${viewbox}&bounded=1&addressdetails=1`
    try {
      const res = await fetch(url, { headers: NOMINATIM_HEADERS })
      if (!res.ok) continue
      const items = await res.json()
      for (const item of items) {
        const key = `${item.osm_type}-${item.osm_id}`
        if (seen.has(key) || !item.name) continue
        const itemLat = parseFloat(item.lat)
        const itemLng = parseFloat(item.lon)
        const dist = haversineKm(lat, lng, itemLat, itemLng)
        if (dist > radiusKm) continue
        seen.add(key)

        const tags: Record<string, string> = {
          amenity: item.type === 'hospital' ? 'hospital' : item.type === 'clinic' ? 'clinic' : '',
          healthcare: item.class === 'amenity' ? item.type : '',
        }
        const facility_type = resolveFacilityType(tags)
        const { slug, label } = inferSpecialty(item.name, tags)

        results.push(baseFacility({
          id: `osm-${item.osm_type}-${item.osm_id}`,
          facility_type,
          full_name: item.name,
          specialty: label,
          specialty_slug: slug,
          qualification: null,
          hospital_name: facility_type === 'hospital' ? item.name : null,
          address: item.display_name ?? null,
          city: item.address?.city ?? item.address?.town ?? null,
          city_slug: citySlug,
          province: item.address?.state ?? null,
          area: item.address?.suburb ?? item.address?.neighbourhood ?? null,
          latitude: itemLat,
          longitude: itemLng,
          distance_km: Math.round(dist * 100) / 100,
          phone: item.extratags?.phone ?? null,
          whatsapp: null,
          consultation_fee: null,
          pmdc_number: null,
          rating: null,
          experience_years: null,
          accepts_online: false,
          gender: null,
          available_days: null,
          osm_id: String(item.osm_id),
          osm_type: item.osm_type,
        }))
      }
    } catch { continue }
  }
  return results
}

function overpassToFacility(
  el: Record<string, unknown>,
  originLat: number,
  originLng: number,
  citySlug: string | null
): LiveFacility | null {
  const tags = (el.tags ?? {}) as Record<string, string>
  const name = tags.name ?? tags['name:en'] ?? null
  if (!name) return null

  const lat = (el.lat ?? (el.center as { lat?: number })?.lat) as number | undefined
  const lng = (el.lon ?? (el.center as { lon?: number })?.lon) as number | undefined
  if (lat == null || lng == null) return null

  const facility_type = resolveFacilityType(tags)
  const { slug, label } = inferSpecialty(name, tags)
  const osmType = String(el.type ?? 'node')
  const osmId = String(el.id ?? '')

  const addrParts = [
    tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'],
    tags['addr:city'], tags['addr:postcode'],
  ].filter(Boolean)

  return baseFacility({
    id: `osm-${osmType}-${osmId}`,
    facility_type,
    full_name: name,
    specialty: label,
    specialty_slug: slug,
    qualification: null,
    hospital_name: facility_type === 'hospital' ? name : tags.operator ?? null,
    address: addrParts.length ? addrParts.join(', ') : tags['addr:full'] ?? null,
    city: tags['addr:city'] ?? null,
    city_slug: citySlug,
    province: tags['addr:province'] ?? null,
    area: tags['addr:suburb'] ?? tags['addr:district'] ?? null,
    latitude: lat,
    longitude: lng,
    distance_km: Math.round(haversineKm(originLat, originLng, lat, lng) * 100) / 100,
    phone: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null,
    whatsapp: tags['contact:whatsapp'] ?? null,
    consultation_fee: null,
    pmdc_number: null,
    rating: null,
    experience_years: null,
    accepts_online: false,
    gender: null,
    available_days: null,
    osm_id: osmId,
    osm_type: osmType,
  })
}

function applyFilters(
  results: LiveFacility[],
  params: { specialty?: string; hospital?: string; area?: string; facilities_only?: boolean }
): LiveFacility[] {
  let filtered = results

  if (params.facilities_only) {
    filtered = filtered.filter((d) => d.facility_type !== 'doctor')
  }
  if (params.specialty) {
    filtered = filtered.filter((d) =>
      !d.specialty_slug ||
      d.specialty_slug === params.specialty ||
      d.specialty_slug === 'general' ||
      d.facility_type === 'hospital'
    )
  }
  if (params.hospital) {
    const h = params.hospital.toLowerCase()
    filtered = filtered.filter((d) =>
      d.full_name.toLowerCase().includes(h) ||
      d.hospital_name?.toLowerCase().includes(h)
    )
  }
  if (params.area) {
    const a = params.area.toLowerCase()
    filtered = filtered.filter((d) =>
      d.area?.toLowerCase().includes(a) ||
      d.address?.toLowerCase().includes(a)
    )
  }
  return filtered
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      latitude, longitude, city, city_label, radius_km = 25,
      specialty, area, hospital, use_gps, facilities_only = true,
    } = body

    const citySlug = typeof city === 'string' ? city.toLowerCase().trim() : null

    let lat = typeof latitude === 'number' ? latitude : undefined
    let lng = typeof longitude === 'number' ? longitude : undefined
    let mode: 'gps' | 'city' | 'city_geocoded' = use_gps ? 'gps' : 'city'

    if (lat == null || lng == null) {
      if (citySlug && PAKISTAN_CITY_COORDS[citySlug]) {
        lat = PAKISTAN_CITY_COORDS[citySlug].lat
        lng = PAKISTAN_CITY_COORDS[citySlug].lng
        mode = 'city'
      } else {
        const label = city_label ?? (citySlug ? `${citySlug}, Pakistan` : 'Lahore, Pakistan')
        const geocoded = await geocodeCity(
          typeof label === 'string' && !label.includes(',') ? `${city_label ?? citySlug}, Pakistan` : label
        )
        if (!geocoded) {
          return new Response(JSON.stringify({ error: 'Could not resolve city location' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        lat = geocoded.lat
        lng = geocoded.lng
        mode = 'city_geocoded'
      }
    }
    const radiusM = Math.round(radius_km * 1000)

    const [overpassData, nominatimData] = await Promise.all([
      queryOverpass(lat!, lng!, radiusM),
      queryNominatimNearby(lat!, lng!, radius_km, citySlug),
    ])

    const overpassList = ((overpassData.elements ?? []) as Record<string, unknown>[])
      .map((el) => overpassToFacility(el, lat!, lng!, citySlug))
      .filter((f): f is LiveFacility => f != null)

    const seen = new Set<string>()
    const combined: LiveFacility[] = []
    for (const f of [...overpassList, ...nominatimData]) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      combined.push(f)
    }

    const deduped = dedupeFacilities(combined)
    const ranked = deduped
      .map((f) => ({ ...f, ranking_score: computeScore(f, specialty ?? null, radius_km) }))
      .sort((a, b) => b.ranking_score - a.ranking_score || a.distance_km - b.distance_km)

    const filtered = applyFilters(ranked, {
      specialty,
      hospital,
      area,
      facilities_only: Boolean(facilities_only),
    }).slice(0, 60)

    return new Response(JSON.stringify({
      results: filtered,
      meta: {
        mode,
        latitude: lat,
        longitude: lng,
        radius_km,
        facility_count: filtered.length,
        specialty_filter: specialty ?? null,
        data_source: 'openstreetmap',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Discovery failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
