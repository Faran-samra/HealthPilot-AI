import { describe, expect, it } from 'vitest'
import {
  applyRomanUrduPhraseMap,
  normalizeSymptomQueryForEmbedding,
} from './rag-query-normalize.ts'
import { parseSymptomQueryContext } from './symptom-query.ts'

describe('applyRomanUrduPhraseMap', () => {
  it('maps peeli aankhen and bukhar to English tokens', () => {
    const out = applyRomanUrduPhraseMap('Mujhe peeli aankhen hain aur bukhar hai')
    expect(out).toMatch(/yellow eyes jaundice/i)
    expect(out).toMatch(/fever/i)
  })
})

describe('normalizeSymptomQueryForEmbedding', () => {
  it('produces English-only embedding text for Roman Urdu jaundice complaint', () => {
    const ctx = parseSymptomQueryContext(
      ['Mujhe peeli aankhen hain aur peshab gehra hai', '3 din se'],
      []
    )
    const norm = normalizeSymptomQueryForEmbedding(ctx)
    expect(norm.text).toMatch(/jaundice|yellow eyes/i)
    expect(norm.text).toMatch(/liver|hepatitis|gallbladder/i)
    expect(norm.conditionSlugs).toContain('jaundice')
    expect(norm.matchedSummaries.length).toBeGreaterThan(0)
    expect(norm.text).not.toMatch(/Mujhe peeli/)
  })

  it('maps bukhar to fever concepts in embedding text', () => {
    const ctx = parseSymptomQueryContext(['Mujhe bukhar hai'], [])
    const norm = normalizeSymptomQueryForEmbedding(ctx)
    expect(norm.text).toMatch(/fever/i)
    expect(norm.clinicalConcepts).toContain('fever')
  })

  it('adds jaundice clinical focus when yellow fever phrase without body fever', () => {
    const ctx = parseSymptomQueryContext(['yellow eyes for 3 days', 'no fever'], [])
    const norm = normalizeSymptomQueryForEmbedding(ctx)
    expect(norm.text).toMatch(/jaundice/i)
    expect(norm.text).toMatch(/Clinical focus/i)
    expect(norm.text).not.toMatch(/arbovirus/i)
  })
})
