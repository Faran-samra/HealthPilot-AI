import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js'
import { embedQuery, ragDebug } from './embeddings.ts'

export interface RagChunk {
  slug: string
  title: string
  content: string
  source: string | null
  section: string | null
  source_url: string | null
  similarity: number
}

/**
 * Retrieve medical knowledge for symptom analysis.
 * Prioritizes Pakistan guidance, then NHS clinical sections.
 */
export async function retrieveMedicalContext(
  query: string,
  specialtyHint?: string | null,
  matchCount = 5
): Promise<string> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return ''

  ragDebug('retrieve:start', {
    queryChars: query.length,
    preview: query.trim().slice(0, 120),
    matchCount,
    specialtyHint: specialtyHint ?? null,
  })

  const embedding = await embedQuery(query)
  if (!embedding) {
    ragDebug('retrieve:skip', { reason: 'no_embedding' })
    return ''
  }

  const supabase = createClient(url, key) as SupabaseClient

  const t0 = Date.now()
  const { data, error } = await supabase.rpc('match_medical_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    filter_specialty: specialtyHint ?? null,
    prefer_sources: ['pakistan', 'nhs_uk'],
  })

  if (error || !data?.length) {
    console.warn('RAG retrieval failed:', error?.message)
    ragDebug('retrieve:failed', { ms: Date.now() - t0, error: error?.message ?? 'no_rows' })
    return ''
  }

  const chunks = data as RagChunk[]
  ragDebug('retrieve:ok', {
    ms: Date.now() - t0,
    chunkCount: chunks.length,
    topMatches: chunks.map((c) => ({
      title: c.title,
      slug: c.slug,
      source: c.source,
      section: c.section,
      similarity: Math.round(c.similarity * 1000) / 1000,
    })),
  })
  const lines = chunks.map((c, i) => {
    const src = c.source === 'nhs_uk' ? 'NHS UK (reference)' : 'Pakistan guidelines'
    const section = c.section ? ` [${c.section}]` : ''
    return `[${i + 1}] ${src}${section} — ${c.title}\n${c.content}`
  })

  return [
    'Use the following retrieved references. Prioritize Pakistan emergency guidance for action steps.',
    'NHS excerpts are for medical facts only — adapt care pathways to Pakistan (1122, Edhi 115, hospital OPD).',
    'Do not diagnose. Do not copy UK phone numbers or NHS services into user-facing text.',
    '',
    ...lines,
  ].join('\n')
}
