/**
 * Fetch a single healthcare facility from OpenStreetMap by OSM id.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'HealthPilotAI/1.0 (https://healthpilot.pk; healthcare discovery)',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const osmType = (body.osm_type ?? 'node') as string
    const osmId = String(body.osm_id ?? '')

    if (!osmId) {
      return new Response(JSON.stringify({ error: 'osm_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const typeChar = osmType === 'node' ? 'N' : osmType === 'way' ? 'W' : 'R'
    const url = `https://nominatim.openstreetmap.org/details.php?osmtype=${typeChar}&osmid=${osmId}&format=json&addressdetails=1&extratags=1`

    const res = await fetch(url, { headers: NOMINATIM_HEADERS })
    if (!res.ok) {
      return new Response(JSON.stringify({ facility: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const place = data.localname ?? data.names?.name ?? data.names?.['name:en'] ?? null
    if (!place) {
      return new Response(JSON.stringify({ facility: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lat = parseFloat(data.centroid?.coordinates?.[1] ?? data.geometry?.[0]?.[1] ?? '0')
    const lng = parseFloat(data.centroid?.coordinates?.[0] ?? data.geometry?.[0]?.[0] ?? '0')

    const extratags = data.extratags ?? {}
    const addr = data.address ?? {}
    const amenity = extratags.amenity ?? data.category ?? ''
    const healthcare = extratags.healthcare ?? ''

    let facility_type: string = 'other'
    if (amenity === 'hospital' || healthcare === 'hospital') facility_type = 'hospital'
    else if (amenity === 'clinic' || healthcare === 'clinic') facility_type = 'clinic'
    else if (amenity === 'doctors' || healthcare === 'doctor') facility_type = 'doctor'

    const addressFromParts = [
      addr.road, addr.suburb, addr.city, addr.state,
    ].filter(Boolean).join(', ')
    const address =
      data.addresstags?.['addr:full'] ??
      (addressFromParts.length > 0 ? addressFromParts : null)

    const facility = {
      id: `osm-${osmType}-${osmId}`,
      source: 'openstreetmap',
      facility_type,
      full_name: place,
      specialty: facility_type === 'hospital' ? 'Hospital' : 'Healthcare Facility',
      specialty_slug: facility_type === 'doctor' || facility_type === 'clinic' ? 'general' : null,
      qualification: null,
      hospital_name: facility_type === 'hospital' ? place : null,
      address,
      city: addr.city ?? addr.town ?? null,
      city_slug: null,
      province: addr.state ?? null,
      area: addr.suburb ?? null,
      latitude: lat,
      longitude: lng,
      distance_km: 0,
      phone: extratags.phone ?? extratags['contact:phone'] ?? null,
      whatsapp: extratags['contact:whatsapp'] ?? null,
      consultation_fee: null,
      is_verified: false,
      pmdc_number: null,
      rating: null,
      total_reviews: 0,
      experience_years: null,
      accepts_online: false,
      gender: null,
      available_days: null,
      osm_id: osmId,
      osm_type: osmType,
      ranking_score: 0,
      can_book: false,
    }

    return new Response(JSON.stringify({ facility }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
