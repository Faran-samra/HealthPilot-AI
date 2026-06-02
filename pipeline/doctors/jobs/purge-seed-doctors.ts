/**
 * Delete legacy demo/seed doctors from Supabase (same rules as migration 014).
 *
 * Usage: npm run doctors:purge-seed
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: demo, error: listErr } = await supabase
    .from('doctors')
    .select('id, full_name, source, pmdc_number')
    .or('source.eq.healthpilot,source.eq.manual')

  if (listErr) throw listErr

  const ids = (demo ?? []).map((d) => d.id)
  if (ids.length === 0) {
    console.log('[purge-seed] no healthpilot/manual doctors found')
    return
  }

  const { error: delErr } = await supabase.from('doctors').delete().in('id', ids)
  if (delErr) throw delErr

  console.log(`[purge-seed] removed ${ids.length} demo doctor(s):`)
  for (const d of demo ?? []) {
    console.log(`  - ${d.full_name} (${d.source}, ${d.pmdc_number ?? 'no pmdc'})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
