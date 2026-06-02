/**
 * Fetch public profile pages → normalized_payload on doctor_import_raw.
 *
 * Usage: npm run doctors:fetch -- --source marham [--limit 100]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { getConnector } from '../sources/registry.ts'
import type { DoctorSource } from '../lib/normalize.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const source = (arg('--source') ?? 'marham') as DoctorSource
  const limit = parseInt(arg('--limit') ?? '50', 10)

  const supabase = createClient(url, key)
  const connector = getConnector(source, supabase)

  const { data: pending, error } = await supabase
    .from('doctor_import_raw')
    .select('id, source_url')
    .eq('source', source)
    .eq('review_status', 'pending')
    .is('normalized_payload', null)
    .not('source_url', 'is', null)
    .limit(limit)

  if (error) throw error

  let ok = 0
  let fail = 0

  for (const row of pending ?? []) {
    if (!row.source_url) continue
    const result = await connector.fetchProfile(row.source_url)

    if (result.normalized) {
      await supabase
        .from('doctor_import_raw')
        .update({
          normalized_payload: result.normalized,
          full_name: result.normalized.full_name,
          specialty_raw: result.normalized.specialty,
          city_raw: result.normalized.city,
          pmdc_number: result.normalized.pmdc_number,
          fetch_status: 'fetched',
          last_error: null,
        })
        .eq('id', row.id)
      ok++
    } else {
      await supabase
        .from('doctor_import_raw')
        .update({
          fetch_status: 'fetch_failed',
          last_error: result.error ?? 'parse_failed',
        })
        .eq('id', row.id)
      fail++
    }
  }

  console.log(`[fetch] source=${source} ok=${ok} fail=${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
