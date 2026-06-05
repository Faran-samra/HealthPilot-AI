import type { MedicalSynonymExpansion } from './medical-synonyms.ts'

export interface RankableChunk {
  slug: string
  title: string
  content: string
  source: string | null
  section: string | null
  source_url: string | null
  similarity: number
}
import type { SymptomQueryContext } from './symptom-query.ts'
import { expandSymptomQueryForRag, significantTermsForRag } from './symptom-query.ts'

const OFF_TOPIC_FOR_JAUNDICE =
  /pulmonary fibrosis|idiopathic pulmonary|copd\b|asthma overview|diabetes type 2|eczema overview/i

/** Shared ingest chunk — avoid crowding out condition-specific results. */
const SHARED_PK_EMERGENCY_SLUG = 'pakistan-general-emergency'

const PREFERRED_SECTIONS = new Set([
  'symptoms',
  'complications',
  'urgent_care',
  'emergency_care',
  'emergency_advice_pakistan',
  'localized_pakistan_context',
  'overview',
  'treatment',
  'self_care',
  'causes',
  'prevention',
])

/** Parse NHS chunk slug → condition_slug (e.g. nhs-jaundice-symptoms → jaundice). */
export function parseConditionSlugFromChunkSlug(slug: string): string | null {
  if (!slug.startsWith('nhs-')) return null
  const rest = slug.slice(4)
  const m = rest.match(
    /^(.+)-(emergency-\d+|context|overview|symptoms|causes|diagnosis|treatment-\d+|prevention)$/
  )
  return m ? m[1] : null
}

export function slugMatchesBoost(chunkSlug: string, boostSlugs: string[]): boolean {
  const cond = parseConditionSlugFromChunkSlug(chunkSlug)
  if (!cond) return false
  return boostSlugs.some(
    (b) => cond === b || cond.startsWith(`${b}-`) || b.startsWith(cond) || b.startsWith(`${cond}-`)
  )
}

function isExcluded(chunkSlug: string, excludeFragments: string[]): boolean {
  const cond = parseConditionSlugFromChunkSlug(chunkSlug) ?? chunkSlug
  return excludeFragments.some((ex) => cond.includes(ex) || chunkSlug.includes(ex))
}

/** 0 = unrelated, 1 = strong match between chunk condition and primary slugs. */
export function computeSlugRelevance(
  chunkConditionSlug: string | null,
  primarySlugs: string[]
): number {
  if (!chunkConditionSlug || primarySlugs.length === 0) return 0

  for (const primary of primarySlugs) {
    if (chunkConditionSlug === primary) return 1
    if (
      chunkConditionSlug.startsWith(`${primary}-`) ||
      primary.startsWith(`${chunkConditionSlug}-`) ||
      primary.startsWith(chunkConditionSlug)
    ) {
      return 0.85
    }
    const chunkParts = chunkConditionSlug.split('-').filter((p) => p.length > 3)
    const primaryParts = primary.split('-').filter((p) => p.length > 3)
    const shared = chunkParts.filter((p) => primaryParts.includes(p))
    if (shared.length >= 2) return 0.75
    if (shared.length === 1 && shared[0].length >= 5) return 0.55
  }
  return 0
}

function countTermHits(blob: string, terms: string[]): number {
  return terms.filter((t) => t.length > 2 && blob.includes(t)).length
}

export function computeChunkScore(
  chunk: RankableChunk,
  ctx: SymptomQueryContext,
  syn: MedicalSynonymExpansion,
  terms: string[],
  primarySlugs: string[]
): number {
  let score = chunk.similarity
  const blob = `${chunk.title} ${chunk.content}`.toLowerCase()
  const condSlug = parseConditionSlugFromChunkSlug(chunk.slug)
  const slugRel = computeSlugRelevance(condSlug, primarySlugs)
  const termHits = countTermHits(blob, terms)

  if (slugMatchesBoost(chunk.slug, primarySlugs)) {
    score += slugRel >= 1 ? 0.22 : 0.14
  } else if (primarySlugs.length > 0 && slugRel >= 0.55) {
    score += 0.1
  }

  if (isExcluded(chunk.slug, syn.excludeSlugFragments)) {
    score -= 0.4
  }

  if (primarySlugs.length > 0 && slugRel === 0 && termHits < 2) {
    score -= 0.48
  } else if (primarySlugs.length > 0 && slugRel === 0 && termHits < 3) {
    score -= 0.28
  }

  score += Math.min(termHits, 6) * 0.028

  if (chunk.section && PREFERRED_SECTIONS.has(chunk.section)) {
    score += 0.04
  }

  if (chunk.slug === SHARED_PK_EMERGENCY_SLUG && primarySlugs.length > 0) {
    score -= 0.38
  }

  const queryBlob = expandSymptomQueryForRag(ctx).toLowerCase()
  const queryUrgent =
    /emergency|urgent|severe|1122|can't breathe|cannot breathe|unconscious|bleeding|seizure|heart attack|chest pain/i.test(
      queryBlob
    )
  if (queryUrgent && (chunk.section === 'emergency_care' || chunk.section === 'urgent_care')) {
    score += 0.08
  }
  if (queryUrgent && chunk.slug === SHARED_PK_EMERGENCY_SLUG && primarySlugs.length === 0) {
    score += 0.12
  }

  if (
    /jaundice|icterus|یرقان|yellow.*(skin|eyes)|bilirubin/i.test(queryBlob) &&
    OFF_TOPIC_FOR_JAUNDICE.test(blob) &&
    slugRel < 0.5 &&
    termHits < 2
  ) {
    score -= 0.42
  }

  return score
}

function chunkIsRelevant(
  chunk: RankableChunk,
  primarySlugs: string[],
  terms: string[],
  excludeFragments: string[],
  minTermHits: number
): boolean {
  if (isExcluded(chunk.slug, excludeFragments)) return false

  const condSlug = parseConditionSlugFromChunkSlug(chunk.slug)
  const blob = `${chunk.title} ${chunk.content}`.toLowerCase()
  const slugRel = computeSlugRelevance(condSlug, primarySlugs)
  const termHits = countTermHits(blob, terms)
  if (slugRel >= 0.55 || slugMatchesBoost(chunk.slug, primarySlugs)) return true
  if (termHits >= minTermHits) return true
  return false
}

export interface RankedRagResult {
  chunks: RankableChunk[]
  boostedSlugs: string[]
}

export function rankAndFilterChunks(
  rawChunks: RankableChunk[],
  ctx: SymptomQueryContext,
  syn: MedicalSynonymExpansion,
  maxChunks = 4,
  minSimilarity = 0.52
): RankedRagResult {
  const primarySlugs = syn.conditionSlugs
  const terms = [...new Set([...significantTermsForRag(ctx), ...syn.searchTerms])]

  const ranked = rawChunks
    .filter((c) => c.similarity >= minSimilarity)
    .map((c) => ({
      chunk: c,
      score: computeChunkScore(c, ctx, syn, terms, primarySlugs),
    }))
    .filter(({ score }) => score >= minSimilarity - 0.08)
    .sort((a, b) => b.score - a.score)

  const hasPrimaryIntent = primarySlugs.length > 0

  let selected = ranked
  if (hasPrimaryIntent) {
    const relevant = ranked.filter(({ chunk }) =>
      chunkIsRelevant(chunk, primarySlugs, terms, syn.excludeSlugFragments, 2)
    )
    if (relevant.length > 0) {
      selected = relevant
    } else {
      const loose = ranked.filter(({ chunk }) =>
        chunkIsRelevant(chunk, primarySlugs, terms, syn.excludeSlugFragments, 3)
      )
      selected = loose.length > 0 ? loose : []
    }
  }

  const chunks = selected.slice(0, maxChunks).map((r) => r.chunk)

  return {
    chunks,
    boostedSlugs: primarySlugs,
  }
}
