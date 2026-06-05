/**
 * Reliable symptom RAG — vector search with slug fallback when embedding fails.
 * Always call before final LLM analysis for symptom-based queries.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js'
import type {
  RagChunk,
  RagRetrievalResult,
  RagSourceRef,
  SymptomRagResult,
} from './rag.ts'
import {
  buildSymptomRagQuery,
  formatRagContext,
  inferSpecialtyHintForRag,
  retrieveMedicalContext,
} from './rag.ts'

export type { SymptomRagResult } from './rag.ts'
export { buildRagMissedPromptBlock, formatSymptomRagNote } from './rag.ts'
import { rankAndFilterChunks } from './rag-ranking.ts'
import { parseSymptomQueryContext, type SymptomQueryContext } from './symptom-query.ts'

const SECTION_PRIORITY: Record<string, number> = {
  emergency_advice_pakistan: 0,
  localized_pakistan_context: 1,
  symptoms: 2,
  urgent_care: 3,
  emergency_care: 4,
  overview: 5,
  treatment: 6,
  causes: 7,
  diagnosis: 8,
  prevention: 9,
}

function supabaseAdmin(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key) as SupabaseClient
}

function slugFallbackScore(row: {
  source: string | null
  section: string | null
}): number {
  let score = 0.72
  if (row.source === 'pakistan') score += 0.12
  if (row.source === 'nhs_uk') score += 0.04
  const sec = row.section ?? ''
  score += (10 - (SECTION_PRIORITY[sec] ?? 8)) * 0.01
  return Math.min(0.92, score)
}

function toRagChunk(row: {
  slug: string
  title: string
  content: string
  source: string | null
  section: string | null
  source_url: string | null
  similarity: number
}): RagChunk {
  return {
    slug: row.slug,
    title: row.title,
    content: row.content,
    source: row.source,
    section: row.section,
    source_url: row.source_url,
    similarity: row.similarity,
  }
}

function buildResultFromChunks(
  chunks: RagChunk[],
  method: SymptomRagResult['method'],
  boostedSlugs?: string[]
): SymptomRagResult {
  if (!chunks.length) {
    return { context: '', sources: [], chunkCount: 0, status: 'none', method: 'none' }
  }

  const sectionLabels: Record<string, string> = {
    emergency_advice_pakistan: 'Emergency advice (Pakistan)',
    localized_pakistan_context: 'Pakistan health context',
    symptoms: 'Symptoms',
    treatment: 'Treatment',
    self_care: 'Self-care',
    when_to_seek_help: 'When to seek help',
  }

  const sources: RagSourceRef[] = chunks.map((c) => ({
    title: c.title,
    source: c.source === 'nhs_uk' ? 'NHS UK' : 'Pakistan guidelines',
    section: c.section ? (sectionLabels[c.section] ?? c.section) : c.section,
    similarity: Math.round(c.similarity * 100) / 100,
  }))

  return {
    context: formatRagContext(chunks),
    sources,
    chunkCount: chunks.length,
    boostedConditions: boostedSlugs,
    status: 'ok',
    method,
  }
}

/** Direct DB lookup by inferred NHS condition_slug — no embedding required. */
export async function retrieveChunksByConditionSlugs(
  slugs: string[],
  matchCount = 4
): Promise<RagChunk[]> {
  const supabase = supabaseAdmin()
  const unique = [...new Set(slugs.filter(Boolean))].slice(0, 10)
  if (!supabase || !unique.length) return []

  const { data, error } = await supabase
    .from('medical_chunks')
    .select('slug, title, content, source, section, source_url, condition_slug')
    .in('condition_slug', unique)
    .not('content', 'is', null)
    .limit(Math.max(matchCount * 6, 24))

  if (error || !data?.length) {
    if (error) console.warn('slug RAG query failed:', error.message)
    return []
  }

  const ranked = (data as Array<{
    slug: string
    title: string
    content: string
    source: string | null
    section: string | null
    source_url: string | null
  }>)
    .map((row) =>
      toRagChunk({
        ...row,
        similarity: slugFallbackScore(row),
      })
    )
    .sort((a, b) => b.similarity - a.similarity)

  const seen = new Set<string>()
  const picked: RagChunk[] = []
  for (const chunk of ranked) {
    const cond = chunk.slug.replace(/^nhs-/, '').split('-')[0] ?? chunk.slug
    const key = `${cond}:${chunk.section ?? 'x'}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(chunk)
    if (picked.length >= matchCount) break
  }

  return picked
}

export interface SymptomRagOptions {
  matchCount?: number
  /** Wall-clock budget for vector path; slug fallback uses remaining time. */
  timeoutMs?: number
}

/**
 * Primary RAG entry for symptom finalize:
 * 1) English-normalized vector search (with embedding provider fallback)
 * 2) Slug-based chunk fetch when vector returns nothing
 */
export async function retrieveSymptomMedicalContext(
  userLines: string[],
  assistantLines: string[] = [],
  options: SymptomRagOptions = {}
): Promise<SymptomRagResult> {
  const matchCount = options.matchCount ?? 4
  const timeoutMs = options.timeoutMs ?? 4500
  const ctx = parseSymptomQueryContext(userLines, assistantLines)
  const conversationText = userLines.join(' ')
  const ragQuery = buildSymptomRagQuery(userLines, assistantLines, ctx)
  const specialtyHint = inferSpecialtyHintForRag(`${conversationText} ${ragQuery}`)

  const vectorBudget = Math.max(2800, timeoutMs - 1000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), vectorBudget)

  let vectorResult: RagRetrievalResult = { context: '', sources: [], chunkCount: 0 }
  try {
    vectorResult = await retrieveMedicalContext(
      ragQuery,
      specialtyHint,
      matchCount,
      ctx,
      controller.signal
    )
  } finally {
    clearTimeout(timer)
  }

  if (vectorResult.chunkCount > 0) {
    return {
      ...vectorResult,
      status: 'ok',
      method: 'vector',
    }
  }

  const boostSlugs = ctx.medicalSynonyms.conditionSlugs
  if (!boostSlugs.length) {
    return { context: '', sources: [], chunkCount: 0, status: 'none', method: 'none' }
  }

  const rawSlugChunks = await retrieveChunksByConditionSlugs(boostSlugs, matchCount)
  if (!rawSlugChunks.length) {
    return { context: '', sources: [], chunkCount: 0, status: 'none', method: 'none' }
  }

  const minSim = 0.45
  const { chunks, boostedSlugs } = rankAndFilterChunks(
    rawSlugChunks,
    ctx,
    ctx.medicalSynonyms,
    matchCount,
    minSim
  )

  const finalChunks = chunks.length ? chunks : rawSlugChunks.slice(0, matchCount)
  return buildResultFromChunks(finalChunks, 'slug_fallback', boostedSlugs)
}
