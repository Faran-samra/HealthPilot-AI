/**
 * Infer NHS condition_slug values from free-text symptoms (EN / Urdu / Roman Urdu).
 * Complements rule-based medical-synonyms.ts for broad coverage.
 */

import { NHS_CONDITION_REGISTRY, type NhsSlugEntry } from './nhs-slug-registry.ts'

const MAX_INFERRED = 8

function normalizeForMatch(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/overview\s*-\s*/gi, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
}

function wordIncludes(haystack: string, word: string): boolean {
  if (word.length < 3) return false
  if (word.length <= 4) {
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)
  }
  return haystack.includes(` ${word} `) || haystack.includes(word)
}

function scoreEntry(entry: NhsSlugEntry, text: string): number {
  let score = 0
  const slugPhrase = entry.slug.replace(/-/g, ' ')
  const name = entry.name.toLowerCase().replace(/^overview\s*-\s*/i, '').trim()

  if (slugPhrase.length >= 4 && wordIncludes(text, slugPhrase)) score += 12
  if (name.length >= 4 && wordIncludes(text, name)) score += 12

  const slugParts = entry.slug.split('-').filter((p) => p.length >= 4)
  const nameParts = name.split(/\s+/).filter((p) => p.length >= 4)
  const parts = [...new Set([...slugParts, ...nameParts])]

  for (const part of parts) {
    if (wordIncludes(text, part)) score += 3
  }

  return score
}

/** Match user conversation text to NHS condition slugs (highest confidence first). */
export function inferConditionSlugsFromText(text: string): string[] {
  const t = normalizeForMatch(text)
  if (t.trim().length < 3) return []

  const scored: { slug: string; score: number }[] = []
  for (const entry of NHS_CONDITION_REGISTRY) {
    const score = scoreEntry(entry, t)
    if (score >= 6) scored.push({ slug: entry.slug, score })
  }

  scored.sort((a, b) => b.score - a.score)

  const picked: string[] = []
  for (const { slug } of scored) {
    if (picked.length >= MAX_INFERRED) break
    if (!picked.includes(slug)) picked.push(slug)
  }
  return picked
}

export function mergeSynonymExpansionWithInferred(
  text: string,
  syn: {
    conditionSlugs: string[]
    searchTerms: string[]
    anchorText: string
    excludeSlugFragments: string[]
  }
): {
  conditionSlugs: string[]
  searchTerms: string[]
  anchorText: string
  excludeSlugFragments: string[]
} {
  const inferred = inferConditionSlugsFromText(text)
  if (!inferred.length) return syn

  const slugSet = new Set([...syn.conditionSlugs, ...inferred])
  const termSet = new Set(syn.searchTerms)
  for (const slug of inferred) {
    termSet.add(slug.replace(/-/g, ' '))
    const entry = NHS_CONDITION_REGISTRY.find((e) => e.slug === slug)
    if (entry) {
      termSet.add(entry.name.toLowerCase())
    }
  }

  let anchorText = syn.anchorText
  const newSlugs = inferred.filter((s) => !syn.conditionSlugs.includes(s))
  if (newSlugs.length) {
    anchorText += `\n[Inferred NHS conditions: ${newSlugs.join(', ')}]`
  }

  return {
    anchorText,
    conditionSlugs: [...slugSet],
    searchTerms: [...termSet],
    excludeSlugFragments: syn.excludeSlugFragments,
  }
}
