/**
 * Step 6: Generate embeddings for medical_chunks (fast local batch by default).
 * npm run nhs:embed
 *
 * Fetches all rows with embedding IS NULL (paginated — Supabase caps at 1000/request).
 */
import '../../scripts/load-env.ts'
import { createClient } from '@supabase/supabase-js'
import {
  embedTextsBatch,
  embedThrottleMs,
  resolveEmbeddingProvider,
  EmbeddingApiError,
} from './lib/embed.ts'
import { buildEmbeddingText } from './lib/embed-text.ts'
import type { MedicalChunkDraft } from './lib/types.ts'
import { parseLimit } from './lib/paths.ts'
import { sleep } from './lib/fs.ts'
import { withSeedRetry } from './lib/seed-retry.ts'

const provider = resolveEmbeddingProvider()
const throttleMs = embedThrottleMs(provider)
const batchSize = Number(process.env.EMBED_BATCH_SIZE ?? 8)
const pageSize = Number(process.env.EMBED_PAGE_SIZE ?? 1000)

console.log(`Embedding provider: ${provider} (batch=${batchSize})`)

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const cliLimit = parseLimit(process.argv.slice(2))
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
  id: string
  slug: string
  title: string
  content: string
  source: string | null
  section: string | null
  condition_slug: string | null
}

function embeddingInput(row: ChunkRow): string {
  const draft: MedicalChunkDraft = {
    slug: row.slug,
    title: row.title,
    content: row.content,
    source: row.source === 'pakistan' ? 'pakistan' : 'nhs_uk',
    condition_slug: row.condition_slug ?? row.slug.replace(/^nhs-/, '').replace(/-(?:overview|symptoms|complications|causes|diagnosis|treatment|self_care|prevention|urgent_care|emergency_care|emergency-advice-pakistan|localized-pakistan-context)(?:-\d+)?$/, '') ?? 'unknown',
    section: row.section ?? 'overview',
    locale: 'en-GB',
    specialty_tags: [],
  }
  return buildEmbeddingText(draft)
}

async function fetchNullEmbeddingRows(maxRows?: number): Promise<ChunkRow[]> {
  const rows: ChunkRow[] = []
  let offset = 0

  while (true) {
    const remaining = maxRows ? maxRows - rows.length : pageSize
    if (maxRows && remaining <= 0) break

    const take = maxRows ? Math.min(pageSize, remaining) : pageSize
    const { data, error } = await supabase
      .from('medical_chunks')
      .select('id, slug, title, content, source, section, condition_slug')
      .in('source', ['nhs_uk', 'pakistan'])
      .is('embedding', null)
      .order('slug')
      .range(offset, offset + take - 1)

    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < take) break
    offset += data.length
  }

  return rows
}

async function countNullEmbeddings(): Promise<number> {
  const { count, error } = await supabase
    .from('medical_chunks')
    .select('id', { count: 'exact', head: true })
    .in('source', ['nhs_uk', 'pakistan'])
    .is('embedding', null)
  if (error) throw error
  return count ?? 0
}

const rows = await fetchNullEmbeddingRows(cliLimit ?? undefined)
if (!rows.length) {
  console.log('No chunks need embeddings.')
  process.exit(0)
}

const totalPending = cliLimit ?? (await countNullEmbeddings())
console.log(`Embedding ${rows.length} chunks (${totalPending} still null in DB)...`)

let failed = 0

for (let i = 0; i < rows.length; i += batchSize) {
  const slice = rows.slice(i, i + batchSize)
  try {
    const vectors = await embedTextsBatch(
      slice.map((r) => embeddingInput(r)),
      { provider, localBatchSize: 32 }
    )

    for (let j = 0; j < slice.length; j++) {
      const row = slice[j]!
      const vector = vectors[j]
      const { error } = await withSeedRetry(`save ${row.slug}`, () =>
        supabase.from('medical_chunks').update({ embedding: vector }).eq('id', row.id)
      )
      if (error) {
        failed++
        console.error(`  FAIL save ${row.slug}:`, error.message)
      }
    }

    console.log(`  ${Math.min(i + slice.length, rows.length)} / ${rows.length}`)
  } catch (e) {
    failed += slice.length
    console.error(`  FAIL embed batch @ ${slice[0]?.slug}:`, e instanceof Error ? e.message : e)
    for (const row of slice) {
      try {
        const [vector] = await embedTextsBatch([embeddingInput(row)], { provider, localBatchSize: 1 })
        const { error } = await withSeedRetry(`save ${row.slug}`, () =>
          supabase.from('medical_chunks').update({ embedding: vector }).eq('id', row.id)
        )
        if (!error) {
          failed--
          console.log(`  recovered ${row.slug}`)
        } else {
          console.error(`  FAIL save ${row.slug}:`, error.message)
        }
      } catch (oneErr) {
        console.error(`  FAIL single ${row.slug}:`, oneErr instanceof Error ? oneErr.message : oneErr)
      }
    }
    if (e instanceof EmbeddingApiError && e.isQuotaOrAuth) {
      console.error(
        '\nAPI rate limit / billing. For free full-speed ingest use:\n' +
          '  EMBEDDING_PROVIDER=local\n' +
          '  npm run nhs:embed\n'
      )
      process.exit(1)
    }
  }
  if (throttleMs > 0) await sleep(throttleMs)
}

const remaining = await countNullEmbeddings()
console.log(`Done. ${failed} failures. ${remaining} chunks still without embeddings.`)
if (remaining > 0 && !cliLimit) {
  console.log('Re-run: npm run nhs:embed  (until remaining is 0)')
}
