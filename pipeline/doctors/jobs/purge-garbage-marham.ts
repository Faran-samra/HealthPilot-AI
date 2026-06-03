/**
 * Deactivate junk Marham rows (Dr. dr, area listings) and reset imports for re-fetch.
 *
 * Usage: npm run doctors:purge-garbage-marham [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import '../../../scripts/load-env.ts'
import { isGarbageDoctorName } from '../lib/sanitize.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const dryRun = process.argv.includes('--dry-run')
  const supabase = createClient(url, key)

  const { data: doctors, error } = await supabase
    .from('doctors')
    .select('id, full_name, specialty_slug, source_url, source')
    .eq('source', 'marham')
    .eq('publication_status', 'published')

  if (error) throw error

  const badSpecialty = new Set([
    'dr',
    'area',
    'prof',
    'assoc',
    'asst',
    'pediatric',
    'general',
    'neuro',
    'gastroenterologist',
    'nephrologist',
    'anesthetist',
    'counselor',
    'physiotherapist',
    'nutritionist',
    'eye-surgeon',
    'liver-specialist',
    'aqsa',
  ])

  const bad = (doctors ?? []).filter(
    (d) =>
      isGarbageDoctorName(d.full_name) ||
      badSpecialty.has(d.specialty_slug ?? '') ||
      (d.source_url != null &&
        d.source_url.split('/').filter(Boolean).length < 5 &&
        !/\/dr-/.test(d.source_url)),
  )

  console.log(`[purge] found ${bad.length} garbage published doctors`)

  for (const doc of bad) {
    console.log(`  - ${doc.full_name} (${doc.specialty_slug}) ${doc.source_url ?? ''}`)
    if (dryRun) continue

    await supabase
      .from('doctors')
      .update({ is_active: false, publication_status: 'draft' })
      .eq('id', doc.id)

    if (doc.source_url) {
      await supabase
        .from('doctor_import_raw')
        .update({
          normalized_payload: null,
          fetch_status: 'sitemap_only',
          review_status: 'pending',
          published_doctor_id: null,
          merged_doctor_id: null,
        })
        .eq('source', 'marham')
        .eq('source_url', doc.source_url)
    }
  }

  if (!dryRun) {
    console.log('[purge] deactivated doctors; reset imports for re-fetch with: npm run doctors:fetch -- --source marham --limit 500')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
