/**
 * Fix hospital_name/clinic_name stored as Marham title blobs (no re-fetch).
 *
 *   npm run doctors:clean-workplaces
 */
import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { cleanWorkplaceName } from '../../../src/utils/doctorWorkplace.ts'

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
    .select('id, hospital_name, clinic_name')
    .or('hospital_name.ilike.% at %,clinic_name.ilike.% at %')
    .limit(5000)

  if (error) throw error

  let updated = 0
  for (const row of rows ?? []) {
    const hospital = cleanWorkplaceName(row.hospital_name)
    const clinic = cleanWorkplaceName(row.clinic_name)
    const nextHospital = hospital ?? row.hospital_name
    const nextClinic = clinic ?? row.clinic_name

    if (nextHospital === row.hospital_name && nextClinic === row.clinic_name) continue

    const { error: upErr } = await supabase
      .from('doctors')
      .update({
        hospital_name: nextHospital,
        clinic_name: nextClinic,
      })
      .eq('id', row.id)

    if (!upErr) updated++
  }

  console.log(`[clean-workplaces] updated ${updated} of ${rows?.length ?? 0} rows`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
