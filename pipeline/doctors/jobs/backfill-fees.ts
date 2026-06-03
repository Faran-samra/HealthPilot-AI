/**
 * Re-parse Marham pages and update consultation_fee only.
 *
 * Usage: npm run doctors:backfill-fees [--limit 500]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { MarhamConnector } from '../sources/marham/connector.ts'
import { extractMarhamConsultationFee } from '../lib/html-extract.ts'

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

  const limit = parseInt(arg('--limit') ?? '2000', 10)
  const supabase = createClient(url, key)
  const connector = new MarhamConnector(supabase)

  const { data: rows, error } = await supabase
    .from('doctors')
    .select('id, full_name, source_url, consultation_fee')
    .eq('source', 'marham')
    .eq('publication_status', 'published')
    .not('source_url', 'is', null)
    .limit(limit)

  if (error) throw error

  let updated = 0
  let unchanged = 0
  let failed = 0

  for (const row of rows ?? []) {
    if (!row.source_url) continue
    try {
      const { ok, text } = await connector.http.fetchText(row.source_url)
      if (!ok || !text) {
        failed++
        continue
      }

      const fee = extractMarhamConsultationFee(text)
      if (fee == null) {
        unchanged++
        continue
      }

      if (row.consultation_fee === fee) {
        unchanged++
        continue
      }

      await supabase
        .from('doctors')
        .update({ consultation_fee: fee, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      console.log(`[fee] ${row.full_name}: ${row.consultation_fee ?? '—'} → ${fee}`)
      updated++
    } catch {
      failed++
    }
  }

  console.log(`[backfill-fees] updated=${updated} unchanged=${unchanged} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
