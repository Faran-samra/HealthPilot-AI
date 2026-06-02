/**
 * Fix city_slug / city / province / coords from address and re-parsed Marham rules.
 *
 * Usage: npm run doctors:backfill-cities
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import {
  cityConflictsWithAddress,
  parseCityFromLocationText,
  getCityDisplayName,
} from '../../../src/utils/pakistanCityExtract.ts'
import { getCityMeta } from '../../../src/utils/locationUtils.ts'
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
    .select('id, city, city_slug, province, area, address, hospital_name, clinic_name, latitude, longitude')
    .eq('source', 'marham')
    .eq('publication_status', 'published')
    .limit(5000)

  if (error) throw error

  let updated = 0

  for (const row of rows ?? []) {
    const locationText = row.address ?? row.area
    const parsedSlug = parseCityFromLocationText(locationText)
    const needsFix =
      parsedSlug &&
      (cityConflictsWithAddress(row.city_slug ?? row.city, locationText) ||
        row.city_slug !== parsedSlug)

    if (!needsFix || !parsedSlug) continue

    const meta = getCityMeta(parsedSlug)
    const pos = resolveDoctorMapPosition({
      ...row,
      city_slug: parsedSlug,
      city: meta?.label ?? getCityDisplayName(parsedSlug),
    })

    const { error: e2 } = await supabase
      .from('doctors')
      .update({
        city_slug: parsedSlug,
        city: meta?.label ?? getCityDisplayName(parsedSlug),
        province: meta?.province ?? row.province,
        latitude: pos.lat,
        longitude: pos.lng,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (!e2) updated++
  }

  console.log(`[backfill-cities] updated ${updated} doctors with corrected city`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
