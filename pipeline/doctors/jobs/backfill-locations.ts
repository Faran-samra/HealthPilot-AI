/**
 * Set latitude/longitude from hospital/area lookup, then city center fallback.
 *
 * Usage: npm run doctors:backfill-locations
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { resolveDoctorMapPosition } from '../../../src/utils/doctorLocationResolve.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const { data: rows, error } = await supabase
    .from('doctors')
    .select('id, city_slug, city, area, address, hospital_name, clinic_name, latitude, longitude')
    .eq('publication_status', 'published')
    .limit(5000)

  if (error) throw error

  let updated = 0
  const byPrecision: Record<string, number> = {}

  for (const row of rows ?? []) {
    const pos = resolveDoctorMapPosition(row)
    byPrecision[pos.precision] = (byPrecision[pos.precision] ?? 0) + 1

    const needsUpdate =
      row.latitude == null ||
      row.longitude == null ||
      Math.abs((row.latitude ?? 0) - pos.lat) > 0.0001 ||
      Math.abs((row.longitude ?? 0) - pos.lng) > 0.0001

    if (!needsUpdate) continue

    const { error: e2 } = await supabase
      .from('doctors')
      .update({ latitude: pos.lat, longitude: pos.lng })
      .eq('id', row.id)
    if (!e2) updated++
  }

  console.log(`[backfill-locations] updated ${updated} doctors`)
  console.log('[backfill-locations] resolved precision:', byPrecision)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
