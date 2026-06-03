/**
 * Fetch public profile pages → normalized_payload on doctor_import_raw.
 *
 * Usage:
 *   npm run doctors:fetch -- --source marham [--limit 100]
 *   npm run doctors:fetch -- --source marham --limit 500 --concurrency 8 --rps 4
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { mapPool } from '../lib/async-pool.ts'
import { isGarbageDoctorName } from '../lib/sanitize.ts'
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
  const concurrency = parseInt(arg('--concurrency') ?? process.env.MARHAM_FETCH_CONCURRENCY ?? '6', 10)
  const rps = parseFloat(arg('--rps') ?? process.env.MARHAM_RPS ?? '3')

  const supabase = createClient(url, key)
  const connector = getConnector(source, supabase, { requestsPerSecond: rps })

  const { data: pending, error } = await supabase
    .from('doctor_import_raw')
    .select('id, source_url')
    .eq('source', source)
    .eq('review_status', 'pending')
    .is('normalized_payload', null)
    .not('source_url', 'is', null)
    .limit(limit)

  if (error) throw error

  const rows = pending ?? []
  if (rows.length === 0) {
    console.log(`[fetch] source=${source} nothing pending (run harvest first)`)
    return
  }

  console.log(`[fetch] source=${source} rows=${rows.length} concurrency=${concurrency} rps=${rps}`)

  let ok = 0
  let fail = 0

  await mapPool(rows, concurrency, async (row) => {
    if (!row.source_url) return
    const result = await connector.fetchProfile(row.source_url)

    if (result.normalized && !isGarbageDoctorName(result.normalized.full_name)) {
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
  })

  console.log(`[fetch] source=${source} ok=${ok} fail=${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
