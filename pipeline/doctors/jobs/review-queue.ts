/**
 * Auto-review heuristics: approve imports with name + specialty + city; reject empty.
 *
 * Usage: npm run doctors:review [--limit 500]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { isGarbageDisplayText } from '../lib/sanitize.ts'

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

  const limit = parseInt(arg('--limit') ?? '500', 10)
  const supabase = createClient(url, key)

  const { data: pending, error } = await supabase
    .from('doctor_import_raw')
    .select('id, normalized_payload, full_name')
    .eq('review_status', 'pending')
    .limit(limit)

  if (error) throw error

  let approved = 0
  let rejected = 0

  for (const row of pending ?? []) {
    const norm = row.normalized_payload as {
      full_name?: string
      specialty?: string
      specialty_slug?: string
      city_slug?: string
    } | null

    const valid =
      Boolean(norm?.full_name && norm.full_name.length > 3) &&
      Boolean(norm?.specialty_slug) &&
      Boolean(norm?.city_slug) &&
      !isGarbageDisplayText(norm?.specialty)

    if (valid) {
      await supabase
        .from('doctor_import_raw')
        .update({ review_status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', row.id)
      approved++
    } else if (!norm && !row.full_name) {
      await supabase
        .from('doctor_import_raw')
        .update({ review_status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', row.id)
      rejected++
    }
  }

  console.log(`[review] approved=${approved} rejected=${rejected}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
