import { describe, expect, it } from 'vitest'
import { expandMedicalSynonyms } from './medical-synonyms.ts'
import { parseConditionSlugFromChunkSlug, rankAndFilterChunks } from './rag-ranking.ts'
import { parseSymptomQueryContext } from './symptom-query.ts'

describe('rag-ranking', () => {
  it('parses condition slug from NHS chunk slug', () => {
    expect(parseConditionSlugFromChunkSlug('nhs-jaundice-symptoms')).toBe('jaundice')
    expect(parseConditionSlugFromChunkSlug('nhs-hepatitis-b-symptoms')).toBe('hepatitis-b')
    expect(parseConditionSlugFromChunkSlug('nhs-sickle-cell-disease-treatment-1')).toBe(
      'sickle-cell-disease'
    )
  })

  it('boosts jaundice chunks over unrelated high-similarity chunks', () => {
    const userLines = ['yellow eyes and dark urine for 3 days']
    const ctx = parseSymptomQueryContext(userLines, [])
    const syn = expandMedicalSynonyms(userLines.join(' '))

    const ranked = rankAndFilterChunks(
      [
        {
          slug: 'nhs-idiopathic-pulmonary-fibrosis-overview',
          title: 'Overview - Idiopathic pulmonary fibrosis',
          content: 'lung fibrosis cough breathlessness',
          source: 'nhs_uk',
          section: 'overview',
          source_url: null,
          similarity: 0.59,
        },
        {
          slug: 'nhs-jaundice-symptoms',
          title: 'Jaundice — symptoms',
          content: 'yellowing of the eyes and skin jaundice bilirubin liver',
          source: 'nhs_uk',
          section: 'symptoms',
          source_url: null,
          similarity: 0.54,
        },
      ],
      ctx,
      syn,
      2,
      0.52
    )

    expect(ranked.chunks[0]?.slug).toContain('jaundice')
    expect(ranked.boostedSlugs).toContain('jaundice')
  })

  it('down-ranks yellow-fever virus slug for jaundice presentation', () => {
    const userLines = ['peeli aankhen', 'no fever']
    const ctx = parseSymptomQueryContext(userLines, [])
    const syn = expandMedicalSynonyms(userLines.join(' '))

    const ranked = rankAndFilterChunks(
      [
        {
          slug: 'nhs-yellow-fever-prevention',
          title: 'Yellow fever — prevention',
          content: 'mosquito travel vaccination Africa',
          source: 'nhs_uk',
          section: 'prevention',
          source_url: null,
          similarity: 0.58,
        },
        {
          slug: 'nhs-jaundice-causes',
          title: 'Jaundice — causes',
          content: 'liver hepatitis bilirubin yellow eyes',
          source: 'nhs_uk',
          section: 'causes',
          source_url: null,
          similarity: 0.53,
        },
      ],
      ctx,
      syn,
      1,
      0.52
    )

    expect(ranked.chunks[0]?.slug).toContain('jaundice')
  })

  it('boosts dehydration chunks over tangential high-similarity pages', () => {
    const userLines = ['muje Dehydration hai', '4 dino se', 'nhi']
    const ctx = parseSymptomQueryContext(userLines, [])
    const syn = expandMedicalSynonyms(userLines.join(' '))

    const ranked = rankAndFilterChunks(
      [
        {
          slug: 'nhs-diabetes-insipidus-overview',
          title: 'Overview - Diabetes insipidus',
          content: 'excessive thirst urination dehydration hormone',
          source: 'nhs_uk',
          section: 'overview',
          source_url: null,
          similarity: 0.58,
        },
        {
          slug: 'nhs-kidney-stones-emergency_advice_pakistan',
          title: 'Overview - Kidney stones — Emergency advice (Pakistan)',
          content: 'drink fluids dehydration pain',
          source: 'nhs_uk',
          section: 'emergency_advice_pakistan',
          source_url: null,
          similarity: 0.57,
        },
        {
          slug: 'nhs-dehydration-overview',
          title: 'Dehydration — overview',
          content: 'dehydration thirst dry mouth ORS oral rehydration fluids',
          source: 'nhs_uk',
          section: 'overview',
          source_url: null,
          similarity: 0.52,
        },
      ],
      ctx,
      syn,
      2,
      0.52
    )

    expect(ranked.chunks[0]?.slug).toContain('dehydration')
    expect(ranked.boostedSlugs).toContain('dehydration')
  })
})
