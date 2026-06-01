import { describe, expect, it } from 'vitest'
import { quickTriage, lookupSymptomCache } from '@/utils/symptomTriage'

describe('quickTriage', () => {
  it('flags emergency chest pain', () => {
    const result = quickTriage('severe crushing chest pain radiating to arm')
    expect(result.isEmergency).toBe(true)
    expect(result.severity).toBe('emergency')
  })

  it('returns mild for vague headache', () => {
    const result = quickTriage('mild headache after poor sleep')
    expect(result.isEmergency).toBe(false)
  })
})

describe('lookupSymptomCache', () => {
  it('matches chest pain pattern', () => {
    const cached = lookupSymptomCache('chest pain when walking')
    expect(cached?.recommended_specialty_slug).toBe('cardiology')
  })
})
