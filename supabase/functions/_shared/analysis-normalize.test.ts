import { describe, expect, it } from 'vitest'
import { normalizeSymptomAnalysisRaw } from './analysis-normalize.ts'

const base = {
  brief_summary: 'Stomach pain with fever',
  possible_conditions: ['A', 'B', 'C', 'D', 'E', 'F'],
  recommended_specialty: 'General Physician',
  recommended_specialty_slug: 'general',
  severity_level: 'moderate',
  explanation: 'Needs evaluation.',
  first_aid_tips: ['Rest', 'Fluids', 'a', 'b', 'c', 'd'],
  red_flags: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'],
  disclaimer: 'Not a diagnosis.',
  urdu_summary: 'ڈاکٹر سے ملیں۔',
}

describe('normalizeSymptomAnalysisRaw', () => {
  it('trims list fields to 5 items', () => {
    const norm = normalizeSymptomAnalysisRaw(base)
    expect(norm?.red_flags).toHaveLength(5)
    expect(norm?.possible_conditions).toHaveLength(5)
    expect(norm?.first_aid_tips).toHaveLength(5)
  })

  it('coerces invalid specialty slug to general', () => {
    const norm = normalizeSymptomAnalysisRaw({ ...base, recommended_specialty_slug: 'invalid' })
    expect(norm?.recommended_specialty_slug).toBe('general')
  })

  it('coerces semicolon-separated strings to arrays', () => {
    const { recommended_specialty: _drop, ...rest } = base
    const norm = normalizeSymptomAnalysisRaw({
      ...rest,
      first_aid_tips: 'Stay on side; Remove hazards; Time the episode',
      red_flags: 'Seizure over 5 minutes; Repeated seizures',
      possible_conditions: 'Possible epilepsy; Cluster seizures',
      recommended_specialty_slug: 'neurology',
    })
    expect(norm?.first_aid_tips).toEqual([
      'Stay on side',
      'Remove hazards',
      'Time the episode',
    ])
    expect(norm?.recommended_specialty).toBe('Neurologist')
  })

  it('derives recommended_specialty from slug when omitted', () => {
    const norm = normalizeSymptomAnalysisRaw({
      ...base,
      recommended_specialty_slug: 'neurology',
      recommended_specialty: undefined,
    })
    expect(norm?.recommended_specialty).toBe('Neurologist')
  })
})
