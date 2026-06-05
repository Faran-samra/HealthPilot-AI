import { describe, expect, it } from 'vitest'
import {
  buildEmergencyAdvicePakistan,
  hasConditionSpecificCareGuidance,
  localizeCondition,
} from './localize.ts'
import type { NhsStructuredCondition } from './types.ts'

describe('localizeCondition', () => {
  it('skips per-condition emergency chunk when NHS has no urgent sections', () => {
    const c: NhsStructuredCondition = {
      slug: 'abdominal-aortic-aneurysm',
      condition_name: 'Abdominal aortic aneurysm',
      source_url: 'https://www.nhs.uk/conditions/abdominal-aortic-aneurysm/',
      source: 'nhs_uk',
      licence: 'OGL-3.0',
      category: 'A-Z conditions',
      scraped_at: '2026-01-01',
      sections: { symptoms: 'Often no symptoms.' },
    }
    expect(hasConditionSpecificCareGuidance(c)).toBe(false)
    expect(buildEmergencyAdvicePakistan(c)).toBeUndefined()
    const loc = localizeCondition(c)
    expect(loc.emergency_advice_pakistan).toBeUndefined()
    expect(loc.localized_pakistan_context).toMatch(/adapted for users in Pakistan/)
  })

  it('builds emergency advice when urgent_care exists', () => {
    const c: NhsStructuredCondition = {
      slug: 'whooping-cough',
      condition_name: 'Whooping cough',
      source_url: 'https://www.nhs.uk/conditions/whooping-cough/',
      source: 'nhs_uk',
      licence: 'OGL-3.0',
      category: 'A-Z conditions',
      scraped_at: '2026-01-01',
      sections: {
        urgent_care: 'Urgent advice: baby under 6 months with symptoms.',
      },
      when_to_seek_help_uk: 'Urgent advice: baby under 6 months with symptoms.',
    }
    expect(hasConditionSpecificCareGuidance(c)).toBe(true)
    const advice = buildEmergencyAdvicePakistan(c)
    expect(advice).toMatch(/6 months/)
    expect(advice).toMatch(/Rescue 1122/)
  })
})
