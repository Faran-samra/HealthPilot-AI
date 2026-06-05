import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js'
import { embedQuery, ragDebug } from './embeddings.ts'
import { normalizeSymptomQueryForEmbedding } from './rag-query-normalize.ts'
import {
  parseSymptomQueryContext,
  type SymptomQueryContext,
} from './symptom-query.ts'
import { rankAndFilterChunks } from './rag-ranking.ts'

export interface RagChunk {
  slug: string
  title: string
  content: string
  source: string | null
  section: string | null
  source_url: string | null
  similarity: number
}

export interface RagSourceRef {
  title: string
  source: string
  section: string | null
  similarity: number
}

export interface RagRetrievalResult {
  context: string
  sources: RagSourceRef[]
  chunkCount: number
  /** Set when retrieval ran — for trace / debugging */
  boostedConditions?: string[]
}

export type RagRetrievalMethod = 'vector' | 'slug_fallback' | 'none'

export interface SymptomRagResult extends RagRetrievalResult {
  status: 'ok' | 'none'
  method: RagRetrievalMethod
}

function minSimilarity(): number {
  const raw = Deno.env.get('RAG_MIN_SIMILARITY')
  const n = raw ? Number(raw) : 0.52
  return Number.isFinite(n) ? n : 0.52
}

/** Rich query from conversation with medical synonym expansion. */
export function buildSymptomRagQuery(
  userLines: string[],
  assistantLines: string[] = [],
  existingCtx?: SymptomQueryContext
): string {
  const ctx = existingCtx ?? parseSymptomQueryContext(userLines, assistantLines)
  return normalizeSymptomQueryForEmbedding(ctx).text
}

/** Optional specialty filter for match_medical_chunks. */
export function inferSpecialtyHintForRag(text: string): string | null {
  const t = text.toLowerCase()
  if (/chest|heart|cardiac|سینے|sina/i.test(t)) return 'cardiology'
  if (/skin|rash|itch|خارش|khujli/i.test(t)) return 'dermatology'
  if (/pregn|حاملہ|حمل/i.test(t)) return 'gynecology'
  if (/child|baby|infant|بچہ/i.test(t)) return 'pediatrics'
  if (/epilepsy|seizure|convulsion|\bfits\b|doray|behosh|سر درد|sar dard|headache|migraine|stroke/i.test(t))
    return 'neurology'
  if (/cough|breath|asthma|کھانسی|khansi|سانس/i.test(t)) return 'pulmonology'
  if (
    /jaundice|icterus|یرقان|yellow.*(skin|eyes)|bilirubin|liver|hepat|جگر|peeli|zard|yarqan/i.test(t)
  ) {
    return 'gastroenterology'
  }
  if (/stomach|abdomen|vomit|nausea|پیٹ|pet dard|قے/i.test(t)) return 'gastroenterology'
  if (/dehydrat|ORS|rehydration|piyas|pyaas|پیاس/i.test(t)) return 'general'
  if (/acromegaly|gigantism|pituitary|growth hormone|haath.*barh|face.*barh|enlarged hands/i.test(t)) {
    return 'endocrinology'
  }
  if (/bone|joint|back pain|کمر|جوڑ/i.test(t)) return 'orthopedics'
  if (/anxiety|depress|stress|mental|ذہنی/i.test(t)) return 'psychiatry'
  if (/bukhar|bukhaar|fever|بخار/i.test(t)) return null
  return null
}

export function formatRagContext(chunks: RagChunk[]): string {
  const lines = chunks.map((c, i) => {
    const src = c.source === 'nhs_uk' ? 'NHS UK (reference)' : 'Pakistan guidelines'
    const section = c.section ? ` [${c.section}]` : ''
    return `[${i + 1}] ${src}${section} — ${c.title}\n${c.content}`
  })

  return [
    'Use the following retrieved references when they clearly apply to this case.',
    'Prioritize Pakistan emergency guidance for action steps.',
    'NHS excerpts are medical facts only — adapt to Pakistan (Rescue 1122, Edhi 115, local OPD).',
    'Do not diagnose. Do not copy UK phone numbers or NHS booking services into user-facing text.',
    'If references do not match the patient story, ignore them and rely on the conversation.',
    '',
    ...lines,
  ].join('\n')
}

/**
 * Retrieve NHS / Pakistan chunks from medical_chunks (pgvector).
 */
export async function retrieveMedicalContext(
  query: string,
  specialtyHint?: string | null,
  matchCount = 5,
  filterContext?: SymptomQueryContext,
  signal?: AbortSignal
): Promise<RagRetrievalResult> {
  const empty: RagRetrievalResult = { context: '', sources: [], chunkCount: 0 }
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return empty

  const ctx =
    filterContext ??
    parseSymptomQueryContext(query.trim().split('\n').filter(Boolean), [])

  const normalized = normalizeSymptomQueryForEmbedding(ctx)
  const embeddingText = normalized.text.trim()
  if (!embeddingText) return empty

  ragDebug('retrieve:start', {
    queryChars: embeddingText.length,
    embeddingPreview: embeddingText.slice(0, 160),
    originalPreview: normalized.originalUserText.slice(0, 80),
    concepts: normalized.clinicalConcepts.slice(0, 12),
    matchCount,
    specialtyHint: specialtyHint ?? null,
    boostSlugs: ctx.medicalSynonyms.conditionSlugs,
    matchedSummaries: normalized.matchedSummaries,
  })

  if (signal?.aborted) {
    ragDebug('retrieve:aborted', { stage: 'before_embed' })
    return empty
  }

  const embedding = await embedQuery(embeddingText, signal)
  if (!embedding) {
    ragDebug('retrieve:skip', { reason: 'no_embedding' })
    return empty
  }

  if (signal?.aborted) {
    ragDebug('retrieve:aborted', { stage: 'before_rpc' })
    return empty
  }

  const supabase = createClient(url, key) as SupabaseClient
  const minSim = minSimilarity()

  const t0 = Date.now()
  const fetchCount = Math.max(matchCount * 5, 20)
  const { data, error } = await supabase.rpc('match_medical_chunks', {
    query_embedding: embedding,
    match_count: fetchCount,
    filter_specialty: specialtyHint ?? null,
    prefer_sources: ['pakistan', 'nhs_uk'],
  })

  if (error || !data?.length) {
    console.warn('RAG retrieval failed:', error?.message)
    ragDebug('retrieve:failed', { ms: Date.now() - t0, error: error?.message ?? 'no_rows' })
    return empty
  }

  const rawChunks = data as RagChunk[]
  const { chunks, boostedSlugs } = rankAndFilterChunks(
    rawChunks,
    ctx,
    ctx.medicalSynonyms,
    matchCount,
    minSim
  )

  if (!chunks.length) {
    ragDebug('retrieve:below_threshold', {
      minSim,
      rawCount: rawChunks.length,
      afterFilter: 0,
      boostSlugs: boostedSlugs,
    })
    return empty
  }

  ragDebug('retrieve:ok', {
    ms: Date.now() - t0,
    chunkCount: chunks.length,
    boostSlugs: boostedSlugs,
    topMatches: chunks.map((c) => ({
      title: c.title,
      slug: c.slug,
      source: c.source,
      section: c.section,
      similarity: Math.round(c.similarity * 1000) / 1000,
    })),
  })

  const sources: RagSourceRef[] = chunks.map((c) => ({
    title: c.title,
    source: c.source === 'nhs_uk' ? 'NHS UK' : 'Pakistan guidelines',
    section: c.section,
    similarity: Math.round(c.similarity * 100) / 100,
  }))

  return {
    context: formatRagContext(chunks),
    sources,
    chunkCount: chunks.length,
    boostedConditions: boostedSlugs,
  }
}

/** RAG with timeout — analysis continues without references if embed/RPC is slow. */
export async function retrieveMedicalContextWithTimeout(
  query: string,
  specialtyHint?: string | null,
  matchCount = 4,
  timeoutMs = 2000,
  filterContext?: SymptomQueryContext
): Promise<RagRetrievalResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await retrieveMedicalContext(
      query,
      specialtyHint,
      matchCount,
      filterContext,
      controller.signal
    )
  } catch {
    return { context: '', sources: [], chunkCount: 0 }
  } finally {
    clearTimeout(timer)
  }
}

export function formatRagRoutingNote(result: RagRetrievalResult): string {
  if (result.chunkCount === 0) return 'rag:none'
  const top = result.sources[0]
  const topSim = top ? top.similarity : 0
  const boost =
    result.boostedConditions?.length ? `;boost=${result.boostedConditions.slice(0, 4).join(',')}` : ''
  return `rag:${result.chunkCount}chunks;top=${top?.title?.slice(0, 40) ?? 'n/a'};sim=${topSim}${boost}`
}

export function formatSymptomRagNote(rag: SymptomRagResult): string {
  if (rag.status !== 'ok') return `rag:none;method=${rag.method}`
  const top = rag.sources[0]
  const boost =
    rag.boostedConditions?.length ? `;boost=${rag.boostedConditions.slice(0, 4).join(',')}` : ''
  return `rag:${rag.chunkCount}chunks;method=${rag.method};top=${top?.title?.slice(0, 40) ?? 'n/a'};sim=${top?.similarity ?? 0}${boost}`
}

/** System hint when LLM must run without retrieved chunks. */
export function buildRagMissedPromptBlock(rag: SymptomRagResult): string {
  if (rag.chunkCount > 0) return ''
  return [
    '',
    '## Medical reference retrieval',
    `Status: no NHS/Pakistan chunks retrieved (method=${rag.method}).`,
    'Answer conservatively from the patient conversation only.',
    'Do not invent conditions or symptoms the patient did not report.',
    'Recommend an appropriate doctor type and basic tests when clinically indicated.',
  ].join('\n')
}
