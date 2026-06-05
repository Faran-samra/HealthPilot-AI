import { describe, expect, it } from 'vitest'
import { conditionToChunks } from './chunk.ts'
import { SHARED_PAKISTAN_EMERGENCY_SLUG, buildSharedPakistanEmergencyChunk } from './chunk-meta.ts'
import type { NhsLocalizedCondition } from './types.ts'

const AAA: NhsLocalizedCondition = {
  slug: 'abdominal-aortic-aneurysm',
  condition_name: 'Abdominal aortic aneurysm',
  source_url: 'https://www.nhs.uk/conditions/abdominal-aortic-aneurysm/',
  source: 'nhs_uk',
  licence: 'OGL-3.0',
  category: 'A-Z conditions',
  scraped_at: '2026-01-01',
  localized_at: '2026-01-01',
  sections: {
    symptoms:
      'Symptoms\n\n- tummy or back pain\n- a pulsing feeling in your tummy',
    treatment: 'Treatment\n\nSurgery may be needed if large.',
  },
}

describe('conditionToChunks', () => {
  it('splits symptom bullets into separate chunks', () => {
    const chunks = conditionToChunks(AAA)
    const symptomChunks = chunks.filter((c) => c.section === 'symptoms')
    expect(symptomChunks.length).toBeGreaterThanOrEqual(2)
  })

  it('omits generic emergency chunk when no condition-specific guidance', () => {
    const chunks = conditionToChunks(AAA)
    expect(chunks.some((c) => c.section === 'emergency_advice_pakistan')).toBe(false)
  })

  it('tags urgency on emergency sections', () => {
    const withEmergency: NhsLocalizedCondition = {
      ...AAA,
      emergency_advice_pakistan: 'Call 1122 if rupture suspected.',
      sections: {
        ...AAA.sections,
        emergency_care: 'Immediate action: severe pain, call emergency.',
      },
    }
    const chunks = conditionToChunks(withEmergency)
    const emerg = chunks.find((c) => c.section === 'emergency_care')
    expect(emerg?.specialty_tags).toContain('urgency:emergency')
    expect(emerg?.embedding_text).toMatch(/Search aliases/i)
  })
})

describe('shared Pakistan emergency', () => {
  it('builds single shared slug', () => {
    const c = buildSharedPakistanEmergencyChunk()
    expect(c.slug).toBe(SHARED_PAKISTAN_EMERGENCY_SLUG)
    expect(c.source).toBe('pakistan')
  })
})
