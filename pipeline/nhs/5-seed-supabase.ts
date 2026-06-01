/**
 * Step 5: Upsert nhs_conditions + medical_chunks.
 * npm run nhs:seed
 */
import '../../scripts/load-env.ts'
import { createClient } from '@supabase/supabase-js'
import type { NhsLocalizedCondition } from './lib/types.ts'
import { NHS_DATA } from './lib/paths.ts'
import { listJsonFiles, readText } from './lib/fs.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    'Missing Supabase credentials. Add to .env:\n' +
      '  VITE_SUPABASE_URL=...\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=...'
  )
  process.exit(1)
}

const supabase = createClient(url, key)
const { chunks: chunkList } = JSON.parse(await readText(NHS_DATA.chunks)) as {
  chunks: Array<{
    slug: string
    title: string
    content: string
    source: string
    source_url?: string
    condition_slug: string
    section: string
    locale: string
    specialty_tags: string[]
  }>
}

console.log('Upserting nhs_conditions...')
const localizedFiles = await listJsonFiles(NHS_DATA.localized)
for (const file of localizedFiles) {
  const c = JSON.parse(await readText(`${NHS_DATA.localized}/${file}`)) as NhsLocalizedCondition
  const { error } = await supabase.from('nhs_conditions').upsert(
    {
      slug: c.slug,
      condition_name: c.condition_name,
      source_url: c.source_url,
      source: c.source,
      licence: c.licence,
      category: c.category,
      sections: c.sections,
      when_to_seek_help_uk: c.when_to_seek_help_uk ?? null,
      emergency_advice_pakistan: c.emergency_advice_pakistan ?? null,
      localized_pakistan_context: c.localized_pakistan_context ?? null,
      scraped_at: c.scraped_at,
      localized_at: c.localized_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' }
  )
  if (error) console.error(`  ${c.slug}:`, error.message)
}

console.log(`Upserting ${chunkList.length} medical_chunks...`)
const BATCH = 50
for (let i = 0; i < chunkList.length; i += BATCH) {
  const batch = chunkList.slice(i, i + BATCH).map((ch) => ({
    slug: ch.slug,
    title: ch.title,
    content: ch.content,
    source: ch.source,
    source_url: ch.source_url ?? null,
    condition_slug: ch.condition_slug,
    section: ch.section,
    locale: ch.locale,
    specialty_tags: ch.specialty_tags,
  }))
  const { error } = await supabase.from('medical_chunks').upsert(batch, { onConflict: 'slug' })
  if (error) {
    console.error('Batch error:', error.message)
    process.exit(1)
  }
  console.log(`  ${Math.min(i + BATCH, chunkList.length)} / ${chunkList.length}`)
}

console.log('Done. Run nhs:embed next.')
