/**
 * Set doctors.gender from name heuristics (scraped rows are often null).
 *
 *   npm run doctors:backfill-gender
 *   npm run doctors:backfill-gender -- --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { inferGenderFromName } from '../../../src/utils/doctorGender.ts'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: rows, error } = await supabase
    .from('doctors')
    .select('id, full_name, gender')
    .eq('publication_status', 'published')
    .is('gender', null)
    .limit(5000)

  if (error) throw error
  let updated = 0
  let skipped = 0

  for (const row of rows ?? []) {
    const inferred = inferGenderFromName(row.full_name)
    if (!inferred) {
      skipped++
      continue
    }
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('doctors')
        .update({ gender: inferred })
        .eq('id', row.id)
      if (upErr) throw upErr
    }
    updated++
  }

  console.log(
    dryRun ? '[dry-run] ' : '',
    `Gender backfill: ${updated} updated, ${skipped} still unknown (${rows?.length ?? 0} null rows scanned)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
