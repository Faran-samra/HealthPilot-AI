import { describe, expect, it } from 'vitest'
import {
  inferConditionSlugsFromText,
  mergeSynonymExpansionWithInferred,
} from './condition-slug-inference.ts'
import { expandMedicalSynonyms } from './medical-synonyms.ts'

describe('condition-slug-inference', () => {
  it('infers dehydration from English/Roman complaint', () => {
    expect(inferConditionSlugsFromText('muje Dehydration hai 4 dino se')).toContain('dehydration')
  })

  it('infers jaundice from clinical English terms', () => {
    expect(inferConditionSlugsFromText('yellow eyes and jaundice for 3 days')).toContain('jaundice')
  })

  it('merges inferred slugs into synonym expansion', () => {
    const merged = mergeSynonymExpansionWithInferred(
      'I have migraine headache',
      expandMedicalSynonyms('headache')
    )
    expect(merged.conditionSlugs).toContain('migraine')
  })
})
