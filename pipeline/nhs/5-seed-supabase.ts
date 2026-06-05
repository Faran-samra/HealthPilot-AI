/**
 * Step 5: Upsert nhs_conditions + medical_chunks.
 * npm run nhs:seed
 *
 * Env: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Optional: SEED_CONDITIONS_BATCH=20, SEED_CHUNKS_MAX_BYTES=350000, SEED_BATCH_DELAY_MS=300
 */
import '../../scripts/load-env.ts'
import { createClient } from '@supabase/supabase-js'
import type { NhsLocalizedCondition } from './lib/types.ts'
import { NHS_DATA } from './lib/paths.ts'
import { listJsonFiles, readText, sleep } from './lib/fs.ts'
import { batchByPayloadSize, formatSeedError, withSeedRetry } from './lib/seed-retry.ts'

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

const CONDITIONS_BATCH = Number(process.env.SEED_CONDITIONS_BATCH ?? 20)
const CHUNKS_MAX_BYTES = Number(process.env.SEED_CHUNKS_MAX_BYTES ?? 350_000)
const BATCH_DELAY_MS = Number(process.env.SEED_BATCH_DELAY_MS ?? 300)
const FETCH_TIMEOUT_MS = Number(process.env.SEED_FETCH_TIMEOUT_MS ?? 120_000)

const supabase = createClient(url, key, {
  global: {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
  },
})

type ChunkRow = {
  slug: string
  title: string
  content: string
  source: string
  source_url?: string
  condition_slug: string
  section: string
  locale: string
  specialty_tags: string[]
}

function conditionRow(c: NhsLocalizedCondition) {
  return {
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
  }
}

function chunkRow(ch: ChunkRow) {
  return {
    slug: ch.slug,
    title: ch.title,
    content: ch.content,
    source: ch.source,
    source_url: ch.source_url ?? null,
    condition_slug: ch.condition_slug,
    section: ch.section,
    locale: ch.locale,
    specialty_tags: ch.specialty_tags ?? [],
  }
}

// Quick connectivity check
console.log(`Supabase: ${url}`)
const ping = await withSeedRetry('ping', () =>
  supabase.from('nhs_conditions').select('slug').limit(1)
)
if (ping.error) {
  console.error('Cannot reach Supabase:', ping.error.message)
  console.error(
    'Check internet/VPN/firewall, project URL, and service role key. Then re-run: npm run nhs:seed'
  )
  process.exit(1)
}

const { chunks: chunkList } = JSON.parse(await readText(NHS_DATA.chunks)) as { chunks: ChunkRow[] }

console.log('Upserting nhs_conditions...')
const localizedFiles = await listJsonFiles(NHS_DATA.localized)
const conditions: NhsLocalizedCondition[] = []
for (const file of localizedFiles) {
  conditions.push(JSON.parse(await readText(`${NHS_DATA.localized}/${file}`)) as NhsLocalizedCondition)
}

let conditionFailures = 0
for (let i = 0; i < conditions.length; i += CONDITIONS_BATCH) {
  const slice = conditions.slice(i, i + CONDITIONS_BATCH)
  const { error } = await withSeedRetry(`conditions ${i + 1}-${i + slice.length}`, () =>
    supabase.from('nhs_conditions').upsert(slice.map(conditionRow), { onConflict: 'slug' })
  )
  if (error) {
    conditionFailures += slice.length
    console.error(`  conditions batch @ ${slice[0]?.slug}:`, error.message)
    // Fall back to one-by-one for this batch
    for (const c of slice) {
      const one = await withSeedRetry(c.slug, () =>
        supabase.from('nhs_conditions').upsert(conditionRow(c), { onConflict: 'slug' })
      )
      if (one.error) {
        console.error(`    FAIL ${c.slug}:`, one.error.message)
      } else {
        conditionFailures--
      }
      await sleep(80)
    }
  }
  console.log(`  conditions ${Math.min(i + CONDITIONS_BATCH, conditions.length)} / ${conditions.length}`)
  if (BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS)
}

if (conditionFailures > 0) {
  console.warn(`Warning: ${conditionFailures} conditions may not have been saved.`)
}

console.log(`Upserting ${chunkList.length} medical_chunks...`)
const chunkBatches = batchByPayloadSize(chunkList, chunkRow, CHUNKS_MAX_BYTES)
console.log(`  ${chunkBatches.length} batches (max ~${Math.round(CHUNKS_MAX_BYTES / 1024)}KB each)`)

let chunkDone = 0
let chunkFailures = 0

for (let b = 0; b < chunkBatches.length; b++) {
  const batch = chunkBatches[b]!.map(chunkRow)
  const { error } = await withSeedRetry(`chunks batch ${b + 1}/${chunkBatches.length}`, () =>
    supabase.from('medical_chunks').upsert(batch, { onConflict: 'slug' })
  )

  if (error) {
    chunkFailures += batch.length
    console.error(`  batch ${b + 1} (${batch[0]?.slug}…):`, error.message)
    for (const ch of batch) {
      const one = await withSeedRetry(ch.slug, () =>
        supabase.from('medical_chunks').upsert(chunkRow(ch), { onConflict: 'slug' })
      )
      if (one.error) {
        console.error(`    FAIL ${ch.slug}:`, one.error.message)
      } else {
        chunkFailures--
        chunkDone++
      }
      await sleep(100)
    }
  } else {
    chunkDone += batch.length
  }

  console.log(`  ${chunkDone} / ${chunkList.length}`)
  if (BATCH_DELAY_MS > 0 && b < chunkBatches.length - 1) await sleep(BATCH_DELAY_MS)
}

if (chunkFailures > 0) {
  console.error(`\n${chunkFailures} chunks failed. Re-run: npm run nhs:seed`)
  process.exit(1)
}

console.log('Done. Run nhs:embed next.')
